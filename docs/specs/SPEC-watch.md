# Spec: watch

> Status: **Implemented** (retroactive, 2026-09-11) · Created: 2026-09-11
> Module of: [CAPABILITY-MAP-cli-cycle2.md](CAPABILITY-MAP-cli-cycle2.md) (`governance`)
> Process: spec-driven-development (retroactive — describes shipped behavior)

## 1. Objective

Keep a directory organized as files arrive: `fo watch [source]`. The watcher must
never fight its own output, must honor its flags, and must organize what is
already there on start.

## 2. Non-goals

- The organize pipeline itself → [SPEC-organize.md](SPEC-organize.md).
- Long-term watching of network/removable filesystems.

## 3. Behavior

1. Derive ignore globs from each rule's `destination` first segment, and skip
   those destination directories **in the scan too** — ignoring events alone is
   not enough, since a pass would still re-match files already there.
2. Learn destination directories at runtime (for templated roots like `./{year}`)
   and exclude them from both events and scans.
3. On `ready`, run one initial organize pass unless `--no-initial` is given.
4. Coalesce bursts of events over the `--debounce` window (default 1000 ms);
   `--debounce` is validated before the watcher starts.
5. Queue one follow-up pass if an event arrives while a pass is running; never
   drop it.
6. A failing pass is logged and the watcher keeps running.

## 4. Acceptance criteria

| ID   | Given | When | Then | Test |
|------|-------|------|------|------|
| AC-1 | a watched dir | a matching file is dropped | it is organized to its destination | `tests/integration/watcher.test.ts` |
| AC-2 | a file in a subdirectory | dropped | it is organized (recursive scan) | `tests/integration/watcher.test.ts` |
| AC-3 | a custom destination with a pre-existing file | a pass runs | the destination folder is not re-scanned or re-matched | `tests/integration/watcher.test.ts` |
| AC-4 | a watched operation | after the move | the operation is recorded in undo history | `tests/integration/watcher.test.ts` |
| AC-5 | rules with templated destinations | `buildDestinationIgnores` / `buildDestinationDirs` | returns the right globs/dirs; absolute roots skipped | `tests/unit/watcher.test.ts` |
| AC-6 | `"2500"` / `"abc"` / `"0"` | `parseDebounce` | returns 2500; throws for the others | `tests/unit/watcher.test.ts` |
| AC-7 | an existing matching file | start with `organizeOnStart` true/false | organized on start, or untouched | `tests/integration/watcher.test.ts` |
| AC-8 | a valid config | `watch --debounce abc` | exit 1 before watching starts | `tests/e2e/safe-mutations.test.ts` |
| AC-9 | a pass that throws (bad plugin spec) | an event fires | logged; the watcher survives | `tests/integration/watcher.test.ts` |

## 5. Adapter mapping

| Behavior | CLI |
|----------|-----|
| Initial pass | `--no-initial` disables it |
| Debounce | `--debounce <ms>` |

## 6. Boundaries

- **Always:** exclude the watcher's own destinations from events **and** scans.
- **Never:** re-trigger on the files it just moved; silently ignore `--debounce`.
