# Spec: organize

> Status: **Implemented** (retroactive, 2026-09-11) · Created: 2026-09-11
> Module of: [CAPABILITY-MAP-cli-cycle2.md](CAPABILITY-MAP-cli-cycle2.md) (`governance`)
> Process: spec-driven-development (retroactive — describes shipped behavior)

## 1. Objective

Move files in a directory to rule-defined destinations, safely and predictably:
`fo organize [source]`. This is the tool's core command; the spec records the
behavior that already ships so its acceptance criteria trace to tests
(Constitution Art. III/IV).

## 2. Non-goals

- The rules engine's matching and template semantics → `docs/RULES.md` and
  `tests/unit/rules-engine.test.ts`.
- Watch mode → [SPEC-watch.md](SPEC-watch.md).
- Reverting a run → [SPEC-undo.md](SPEC-undo.md).

## 3. Behavior

1. Resolve the source directory and locate a config (explicit `-c`, else walking
   up from the source).
2. Load and validate the config; a missing or invalid config fails with exit 1.
3. Resolve options through the shared core helper (`buildOrganizeOptions`):
   explicit flag → config → default. `recursive` defaults to `false`.
4. Load configured plugins **before** scanning; a broken spec aborts the run
   before any file moves.
5. Scan → match rules (highest `priority` first, first match wins) → resolve the
   destination template → resolve conflicts (`rename`/`overwrite`/`skip`/`newest`)
   → move.
6. `--dry-run` performs every step except the move.
7. A real run that would move ≥20 files asks for confirmation unless `-y`.
8. `--json` prints a single JSON payload to stdout and never prompts.
9. The run is recorded in history for `fo undo`.

## 4. Acceptance criteria

| ID   | Given | When | Then | Test |
|------|-------|------|------|------|
| AC-1 | a dir with matching files + config | `organize --dry-run` | exit 0; files reported; nothing moved on disk | `tests/e2e/cli.test.ts` |
| AC-2 | the same fixture | `organize -y` | files land at the rule destination | `tests/e2e/cli.test.ts` |
| AC-3 | several rules with different priorities | `matchFile` | the highest priority wins; first match in order | `tests/unit/rules-engine.test.ts` |
| AC-4 | a destination that already exists | each conflict strategy | `rename` suffixes, `overwrite` replaces, `skip` leaves, `newest` keeps the newer | `tests/integration/conflict-resolution.test.ts` |
| AC-5 | a config with `plugins: ["./p.js"]` | `organize()` | the plugin loads before the scan; a bad spec aborts before any move | `tests/integration/plugin-loader.test.ts` |
| AC-6 | a valid config | `organize --json` | stdout is pure JSON with `dryRun`, `moved`, `skipped`, `errors` | `tests/e2e/cli-contract.test.ts` |
| AC-7 | no config | `organize` | exit 1 | `tests/e2e/cli-contract.test.ts` |
| AC-8 | destination templates | `resolveDestination` | `{year}`, `{type}`, `{monthName}`, `{parent}`, `{sizeBucket}`, `{now:…}` resolve | `tests/unit/template-variables.test.ts` |
| AC-9 | `excludeDirs` set | `FileScanner.scan` | files under those roots are skipped | `tests/unit/file-scanner.test.ts` |
| AC-10 | `organizer.preview()` | run | identical behavior to a dry run, no mutation | `tests/integration/mcp-handlers.test.ts` |

## 5. Adapter mapping

| Behavior | CLI | MCP |
|----------|-----|-----|
| Preview | `--dry-run` | `organize_files` with `dryRun: true` (default) |
| Apply | `organize -y` | `organize_files` with `dryRun: false` |

## 6. Boundaries

- **Always:** validate config before scanning; load plugins before any move;
  preview must never mutate.
- **Never:** move a file the rules did not match; clobber without the configured
  conflict strategy and an undo record.
