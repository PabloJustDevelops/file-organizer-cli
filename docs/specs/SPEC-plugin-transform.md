# Spec: plugin-transform

> Status: **Implemented** (2026-09-04) · Created: 2026-09-04
> Verified: 234 tests green; `transform.ts` 100% stmts/branches/funcs/lines;
> AC-1…AC-7 unit, AC-8…AC-10 integration (real fs + real import).
> Module of: [CAPABILITY-MAP-plugins.md](CAPABILITY-MAP-plugins.md) (`plugin-transform`, depends on `plugin-contract`)
> Process: spec-driven-development (Specify phase) — last module of the pilot

## 1. Objective

Make `transform?(file: FileInfo): Promise<FileInfo>` real: apply it to the
scanned working set **before rule matching**, so plugins can normalize file
metadata (e.g. lowercase extensions) and organizing decisions use the
transformed view. Closes the PLUGINS.md contract; doc re-validation ships in
the same task list.

## 2. Background

- Capability map: "Apply `transform(file)` in the pipeline before
  matching/organizing".
- PLUGINS.md documents `transform` with the extension-lowercasing example —
  this module makes that sentence true.
- Like hooks/rules, transform failures are **never fatal** (capability map
  promise): reported via `result.pluginErrors`, the run continues.

## 3. Design

**D1 — pure module `core/plugins/transform.ts`** (mirrors hooks/rules):
`applyTransforms(plugins, files)` → `{ files, failures }`. Sequential,
registration order, per-plugin then per-file isolation.

**D2 — pipeline placement:** scan → **transform** → rules injection →
`beforeOrganize` → match → move → `afterOrganize`. Consequence:
`beforeOrganize`'s `context.files` is the **transformed** working set —
what hash/verify plugins see is what the run will decide on.

**D3 — decision-layer semantics (v1):** transforms mutate `FileInfo` in
memory only — they never touch disk themselves. Rule matching AND composed
destination paths (including the file name, built as `name.extension`)
follow transformed metadata. (Real use: remap `log` → `txt` so `*.txt`
rules route logs; the file lands as `text/notes.txt` — the rename happens
on the move.) Two grounding facts discovered while writing this spec:
the scanner already lowercases extensions (`getFileInfo`), so PLUGINS.md's
canonical lowercase example is a no-op in practice; and the engine's
extension fast-path compares case-sensitively against the normalized value.
Transforms that rename files in place are out of scope (OQ-1).

**D4 — isolation granularity: per file.** A transform that throws for one
file leaves that file in its pre-plugin state, records
`{ plugin, hook: 'transform', error }`, and the rest of the files from the
same plugin still transform. Justification: files are independent; one bad
row shouldn't sink the batch.

**D5 — untrusted return values:** the contract enforces `transform` is a
*function*, not what it returns. A `null`/non-object return would poison
`matchFiles` downstream → treated as a per-file failure, original file
kept. (Reachable at runtime — plugins are untrusted even after V1–V5.)

**D6 — error channel:** `PluginHookName` union gains `'transform'`;
failures flow through the existing `result.pluginErrors` + `logger.error`
with the `[plugins]` prefix. No new error type needed (same shape as hooks).

**D7 — idempotency:** transforms run per `organize()` call on the fresh
scan — no cross-invocation state (unlike rules injection). `preview()` →
`organize()` re-applies them naturally; pure metadata transforms are
repeatable by construction.

## 4. Acceptance criteria

Unit (`applyTransforms`, pure):
- **AC-1** no plugins → files pass through unchanged.
- **AC-2** plugin without `transform` → passthrough.
- **AC-3** plugin with `transform` → every file mapped, order preserved.
- **AC-4** throwing transform on file A: failure recorded
  (`hook: 'transform'`, plugin name, message), A unchanged, file B from the
  same plugin still transformed, later plugins unaffected.
- **AC-5** transform returning `null` → failure recorded, original kept.
- **AC-6** two transforming plugins compose (second sees first's output).
- **AC-7** non-Error throw (string) captured via `String(err)`.

Integration:
- **AC-8** real plugin on disk remaps `notes.log` → extension `txt`: the
  `*.txt` rule matches only after the transform (A/B: without plugins
  nothing moves) and the file lands as `text/notes.txt` (D3 proven
  end-to-end, destination name composed from transformed metadata).
- **AC-9** failing transform → `result.pluginErrors` has the entry, files
  still organized (non-fatal).
- **AC-10** `beforeOrganize` context reflects transformed `files` (D2).

## 5. Open questions (resolved with defaults)

- **OQ-1**: should transforms rename files on disk? → **No in v1**
  (decision-layer only; a future `renameTransforms` opt-in can revisit).
- **OQ-2**: per-file or per-plugin isolation? → **Per file** (D4).

## 6. Files

- New: `packages/cli/src/core/plugins/transform.ts`
- Edit: `core/plugins/hooks.ts` (union), `core/plugins/index.ts` (exports),
  `core/organizer.ts` (wiring after scan)
- Tests: `tests/unit/plugins/transform.test.ts` (new),
  `tests/integration/plugin-loader.test.ts` (extend, AC-8…AC-10)

## 7. Docs (same task list)

Re-validate `docs/PLUGINS.md` against implementation. Known findings from
grounding: (a) `import type ... from 'file-organizer-cli'` doesn't compile —
the package `main` is the bin entry (`program.parse()` at import); plugins
need **zero imports** (plain objects); (b) `compressOldFiles` example reads
`f.modifiedAt` from `MovedFile`, which has `from`/`to`/`rule` only;
(c) programmatic `import { Organizer }` section needs an honest
availability note; (d) document D3 semantics in a Transform section.

## 8. Traceability

- Constitution Art. I (safety): plugin runtime misbehavior cannot abort the
  run (D4/D5) nor touch disk (D3).
- Art. II (layering): pure module in `core/plugins`, no config/CLI imports.
- Art. IV: every AC traced to a test; coverage target 100% in 4 metrics.
