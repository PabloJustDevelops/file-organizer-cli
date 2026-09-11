# Spec: cli-contract

> Status: **Implemented** (2026-09-11; AC-1…AC-14 verified) · Created: 2026-09-11
> Module of: [CAPABILITY-MAP-cli-adoption.md](CAPABILITY-MAP-cli-adoption.md) (`cli-contract`, depends on —)
> Process: spec-driven-development (Specify phase)

## 1. Objective

Make the CLI honest to whatever is driving it — a script, a CI job, or a human.
Today several failure paths log a message and `return`, so the process exits
**0**: `fo organize` with no config, `fo rules list/add/remove`, `fo config
show/init` all report success to `$?` while doing nothing. A script cannot tell
"nothing to do" from "I could not run".

Success looks like: every failed command exits non-zero, every successful one
exits 0, and the read/compute commands (`organize`, `rules list`, `config show`)
can emit machine-readable JSON when asked — so automation stops scraping
human-formatted output.

## 2. Non-goals

- Config *content* validation (regex `condition.pattern`, `patterns[]` elements,
  the `recursive` default divergence) → `config-integrity` (cycle 2).
- `dedup --delete` reversibility and watch self-conflict → `safe-mutations`.
- `watch` runtime exit behavior (it runs until interrupted).
- A JSON envelope for **every** command and error shape → only the three
  commands below, and only `{ "error": … }` for failures (OQ-2).
- MCP output parity; the MCP server has its own return contract.

## 3. Design

### Exit codes

- **0** = the command did what was asked. **1** = anything else. Commander
  already exits 1 on usage errors (unknown command/flag), so a single
  convention keeps the surface predictable.
- A shared helper (`fail(message)` in `src/cli/ui/output.ts`) logs the error and
  sets `process.exitCode = 1`; commands return instead of `process.exit(1)` so
  streams flush and cleanup runs (OQ-1). The TUI's raw-mode bailout keeps
  `process.exit(1)`.
- Every existing `return` on a failure branch becomes a `fail(...)` +
  `return`. Success paths are untouched.

Failure branches to convert (current behavior → target):

| Command | Situation | Today | Target |
|---|---|---|---|
| `organize` | no config found | logs warn, exit 0 | exit 1 (+ `--json` error) |
| `rules list/add/remove` | no config found | logs warn, exit 0 | exit 1 |
| `rules add/remove` | save/validation error | logs error, exit 0 | exit 1 |
| `config show` | no config / invalid config | logs warn/error, exit 0 | exit 1 |
| `config init` | write error | logs error, exit 0 | exit 1 |
| `config validate` | invalid config | exit 1 (already) | unchanged |
| `organize`, `undo`, `watch`, `dedup` | thrown error | exit 1 (already) | unchanged |

### `--json`

- New flag on `organize`, `rules list`, and `config show`.
- **stdout carries only JSON.** In JSON mode the logger's info/debug output is
  suppressed (level `error`), so the existing "Found N files" chatter cannot
  corrupt the payload; warnings/errors go to stderr as usual.
- **`--json` implies non-interactive.** The ≥20-file confirmation prompt is
  skipped (equivalent to `-y`): JSON mode is for automation, and a prompt would
  both corrupt stdout and hang a script.
- Shapes (no envelope on success — OQ-2):
  - `organize` → `{ dryRun, moved: [{from,to,rule}], skipped: [{file,reason}], errors: [{file,error}], pluginErrors? }`
  - `rules list` → the normalized `Rule[]`
  - `config show` → the normalized `OrganizeConfig`
  - any failure → `{ "error": "<message>" }` on stdout, exit 1
- Output is plain (`JSON.stringify(obj, null, 2)`), never colorized (AC-13).

## 4. Commands

```
Test:      bun run test          # includes tests/e2e
Build:     bun run build         # also via e2e globalSetup
Lint:      bun run lint
Manual:    fo organize ~/Downloads --json | jq .moved
```

## 5. Testing strategy

- **E2E** (`tests/e2e/cli-contract.test.ts`): exit codes are process-level, so
  they are asserted by running the built binary (the harness already isolates
  `HOME`/`USERPROFILE` and temp dirs).
- JSON assertions: capture stdout, `JSON.parse` it, assert the shape — and grep
  stdout for **absence** of ANSI escapes / log prefixes.
- Regression guard: the existing happy-path E2E (`cli.test.ts`) already asserts
  exit 0 for success; extend it with `--json` variants rather than duplicating.

## 6. Acceptance criteria

| ID   | Given | When | Then | Test |
|------|-------|------|------|------|
| AC-1 | a temp dir with no config | `fo organize .` | message on stderr; exit **1** | `tests/e2e/cli-contract.test.ts` |
| AC-2 | a temp dir with no config | `fo rules list` | exit **1** | `tests/e2e/cli-contract.test.ts` |
| AC-3 | a temp dir with no config | `fo rules remove` | exit **1** (no crash, no prompt) | `tests/e2e/cli-contract.test.ts` |
| AC-4 | a temp dir with no config | `fo config show` | exit **1** | `tests/e2e/cli-contract.test.ts` |
| AC-5 | an invalid `.file-organizer.yaml` | `fo config show` | exit **1** | `tests/e2e/cli-contract.test.ts` |
| AC-6 | a valid config | `fo config init` then `fo config validate` | exit **0** both (regression) | `tests/e2e/cli-contract.test.ts` |
| AC-7 | 3 `.jpg` + valid config | `fo organize . --dry-run --json` | exit 0; stdout parses; `moved` has 3 entries; no file moved | `tests/e2e/cli-contract.test.ts` |
| AC-8 | same fixture | `fo organize . -y --json` | exit 0; stdout parses; `moved` has 3 entries | `tests/e2e/cli-contract.test.ts` |
| AC-9 | no config | `fo organize . --json` | exit 1; stdout is `{ "error": … }` | `tests/e2e/cli-contract.test.ts` |
| AC-10 | a valid config | `fo rules list --json` | exit 0; stdout parses as an array of rules | `tests/e2e/cli-contract.test.ts` |
| AC-11 | a valid config | `fo config show --json` | exit 0; stdout parses as the config object | `tests/e2e/cli-contract.test.ts` |
| AC-12 | any JSON-mode run | inspect stdout | contains no ANSI escape sequences | `tests/e2e/cli-contract.test.ts` |
| AC-13 | an existing success path | `fo --version` / `fo --help` | still exit 0 (no regression) | `tests/e2e/cli.test.ts` |
| AC-14 | 20 `.jpg` + valid config, stdin closed | `fo organize . --json` | exit 0; does not prompt or hang; stdout parses as JSON | `tests/e2e/cli-contract.test.ts` |

## 7. Boundaries

- **Always:** non-zero on failure; stdout is pure JSON in JSON mode; leave human
  output unchanged without the flag.
- **Ask first:** adding `--json` beyond the three commands; introducing a uniform
  `{ok,data|error}` envelope; changing codes where 1 is already returned.
- **Never:** exit 0 after a failed operation; print logs to stdout in JSON mode;
  colorize JSON.

## 8. Types & docs touched

- `src/cli/ui/output.ts` (+`fail`, +`printJson`),
  `src/cli/commands/{organize,watch,rules,config}.ts`.
- JSON mode silences info logging **per command** via `setLogLevel('error')`;
  `src/cli/index.ts` is untouched.
- New: `tests/e2e/cli-contract.test.ts`.
- Docs: `README.md` / `packages/cli/README.md` (document `--json` and exit codes);
  `docs/RULES.md` unchanged.

## 9. Open questions

- **OQ-1:** `process.exitCode = 1` (flush-safe, natural exit) vs `process.exit(1)`?
  Default: **exitCode**, keeping `process.exit` only for the TUI raw-mode path.
- **OQ-2:** Add a `{ ok: true, data }` envelope later? Default: **no envelope
  now** — raw result on success, `{ error }` on failure; revisit if consumers ask.
- **OQ-3:** Should `organize --json` also emit the human summary to stderr?
  Default: **no** — stderr carries only warnings/errors.

## 10. Changelog

- 2026-09-11 — spec drafted (cycle-1 module `cli-contract`).
- 2026-09-11 — **implemented and verified AC-1…AC-14.** `fail()` sets
  `process.exitCode` (OQ-1) and writes `{error}` to stdout in JSON mode; every
  silent `return` on a failure branch now exits 1; `--json` added to
  `organize`/`rules list`/`config show` with info logging silenced per command
  (OQ-2/3: no envelope) and non-interactive behaviour.
- 2026-09-11 — E2E `tests/e2e/cli-contract.test.ts` 12/12; full suite 27 files,
  262 passed / 1 skipped; lint 0 errors. Out of scope by design: partial
  `organize` errors stay exit 0 and are reported in the payload.
