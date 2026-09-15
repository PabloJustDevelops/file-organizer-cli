# Spec: adapter-coverage

> Status: **Implemented** (2026-09-12; AC-1…AC-11 verified)
> Created: 2026-09-12
> Initiative: single capability — SDD Phase 0 skipped (see §1)
> Predecessor: [CAPABILITY-MAP-cli-cycle2.md](CAPABILITY-MAP-cli-cycle2.md) (the
> gate surface this module widens)
> Decision: [ADR-0010](../decisions/0010-coverage-surface-adapter-layer.md)
> Process: spec-driven-development (Specify phase)

## 1. Objective

Put the adapter layer — `src/cli/**` and `src/mcp/**` — inside the coverage
ratchet and drive it to **100% on all four metrics** with in-process unit tests.

`vitest.config.ts` measures only `src/core/**`, `src/utils/**` and
`src/config/loader.ts` (100% × 4), and justifies leaving the wrappers out
because "they are exercised via E2E". That rationale has a blind spot: the E2E
suite spawns the built binary as a **child process** against `dist/`, so it
contributes **zero** v8 coverage. Measured on 2026-09-12:

| Area | statements | note |
|---|---|---|
| `src/cli` (11 files) | **5%** | 8 files at 0%; `output.ts` 19.7%, `watch.ts` 35.7% |
| `src/mcp` (2 files) | **45.2%** | `server.ts` 46.6%, `index.ts` 0% |

The adapter layer is exactly where the user-facing contract lives — exit codes,
`--json` stdout purity, the prompt flow, MCP tool dispatch. It is the worst
place to have no signal.

Success looks like: `bun run test:coverage` enforces 100% over the adapter layer
too, so a regression in any command's error path or flag wiring fails CI.

**Phase 0 skipped (single capability).** One consumer (the CI gate), one
deliverable (a widened surface at 100%), and the subparts cannot ship
independently — a gate that includes `src/cli/**` but not `src/mcp/**` is not a
shippable intermediate. So it is specified as one module, not decomposed.

## 2. Non-goals

- `src/tui/**` (Ink components, `useOrganizer`): rendering internals, not an
  adapter contract. Stays outside the include.
- Changing production behavior. This module adds tests and gate config only. If
  a defect surfaces it is fixed under the owning module's spec, and reported in
  §8 — the same "debt recorded, not silently absorbed" rule earlier cycles used.
- Instrumenting the E2E child process. v8 coverage is in-process; the two levels
  stay complementary (E2E proves the *packaged binary*, these tests prove the
  *in-process contract*).
- New E2E scenarios.

## 3. Design

**Surface.** `coverage.include` gains `src/cli/**/*.ts` and `src/mcp/**/*.ts`.
`src/tui/**` remains out. Thresholds stay at 100 globally (ADR-0006 rule 1 is not
exercised: no numeric threshold is lowered — the new files reach 100 in the same
change).

**In-process, never spawned.** A test imports the module under test, invokes it,
and asserts. Nothing is spawned (that is E2E's job), so coverage is attributed
to `src/`.

**Commander actions.** `await command.parseAsync(argv, { from: 'user' })` on a
freshly imported module (`vi.resetModules()` + dynamic `import()`), so no
command state leaks between tests. Validated by a throwaway spike before this
spec was written. Failure paths assert `process.exitCode === 1` — the commands
set `process.exitCode`, never `process.exit` (SPEC-cli-contract) — and
`afterEach` resets it.

**Prompts.** `inquirer` is mocked at the module boundary. Assertions cover both
the returned value and the question shape (name/type/choices/validate), so the
prompt contract stays pinned without a TTY.

**stdio capture.** `console.log/warn/error` and `process.stdout.write` are
spied, matching `tests/unit/logger.test.ts`. `--json` purity is asserted on the
raw `process.stdout.write` payload.

**Filesystem.** Real temp dirs under `os.tmpdir()`; the adapters call `fs-extra`
directly. (Plugin-loading fixtures need the repo-local base from
`plugin-loader.test.ts` — no new plugin fixtures are added here.)

**Isolation.** Every history/config touch points at a temp dir
(`new Organizer({ historyDir })`, `loadAppConfig(dir)`); the developer's real
`~/.file-organizer` is never read or written.

## 4. Commands

```
Test:          bun run test
Coverage gate: bun run test:coverage
Lint:          bun run lint
Build:         bun run build
One file:      bunx vitest run tests/unit/cli-output.test.ts
```

## 5. Acceptance criteria

| ID    | Given | When | Then (observable) | Test |
|-------|-------|------|-------------------|------|
| AC-1  | the repo at this change | `bun run test:coverage` | exit 0; `coverage.include` covers `src/cli/**` + `src/mcp/**`; all four thresholds are 100 | `vitest.config.ts` (gate runs in `.github/workflows/ci.yml`) |
| AC-2  | `tests/unit/cli-output.test.ts` | the suite runs | `src/cli/ui/output.ts` at 100% × 4 | `tests/unit/cli-output.test.ts` |
| AC-3  | `tests/unit/cli-prompts.test.ts` | the suite runs | `src/cli/ui/prompts.ts` at 100% × 4 | `tests/unit/cli-prompts.test.ts` |
| AC-4  | `tests/unit/mcp-server.test.ts`, `tests/unit/mcp-entry.test.ts` | the suite runs | `src/mcp/server.ts` + `src/mcp/index.ts` at 100% × 4 | same two files |
| AC-5  | `tests/unit/cli-config-command.test.ts`, `tests/unit/cli-rules-command.test.ts` | the suite runs | `src/cli/commands/config.ts` + `rules.ts` at 100% × 4 | same two files |
| AC-6  | `tests/unit/cli-organize-command.test.ts`, `tests/unit/cli-undo-command.test.ts` | the suite runs | `src/cli/commands/organize.ts` + `undo.ts` at 100% × 4 | same two files |
| AC-7  | `tests/unit/cli-dedup-command.test.ts`, `tests/unit/cli-watch-command.test.ts` | the suite runs | `src/cli/commands/dedup.ts` + `watch.ts` at 100% × 4 | same two files |
| AC-8  | `tests/unit/cli-mcp-command.test.ts`, `tests/unit/cli-tui-command.test.ts` | the suite runs | `src/cli/commands/mcp.ts` + `tui.ts` at 100% × 4 | same two files |
| AC-9  | `tests/unit/cli-index.test.ts` | the suite runs | `src/cli/index.ts` at 100% × 4 | `tests/unit/cli-index.test.ts` |
| AC-10 | the full suite | `bun run test` and `bun run lint` | 0 test failures, 0 lint errors; no `src/` behavior change | whole suite + `oxlint`/`tsc` |
| AC-11 | `ADR-0010` | read | records the widened surface, the `src/tui/**` boundary, and that no threshold was lowered | `docs/decisions/0010-*.md` |

## 6. Boundaries

- **Always:** reset `process.exitCode`; isolate history/home per test; mock
  prompts; assert on observable output or filesystem state; clean up temp dirs.
- **Ask first:** adding a production refactor for testability; excluding any
  adapter file from the include.
- **Never:** spawn a process to earn coverage; touch the real
  `~/.file-organizer`; lower an existing threshold (ADR-0006 rule 1).

## 7. Open questions

- **OQ-1:** the two process entry points (`src/cli/index.ts`,
  `src/mcp/index.ts`) run `program.parse()` / `startMcpServer()` at import time.
  Cover in-process by stubbing the terminal call, or exclude them as wiring
  already proven by E2E? **Default: cover** — stub `Command.prototype.parse` /
  mock the server module and assert the wiring (global flags, the `init` alias,
  the error handler). Revisit only if the stub proves brittle across commander
  versions.
- **OQ-2:** assert the prompt *question definitions* (shape) or only the returned
  values? **Default:** shape + value where cheap, value only for the long forms.

## 8. Changelog

- 2026-09-12 — spec drafted.
- 2026-09-12 — **implemented and verified AC-1…AC-11.** `coverage.include` now
  covers `src/cli/**` + `src/mcp/**`; all four thresholds remain 100 (nothing was
  lowered — the new surface reached 100 in the same change). `bun run test:coverage`
  → 54 files, 534 passed / 1 skipped, **100 / 100 / 100 / 100**, exit 0;
  `bun run lint` clean.
  - Harness: `tests/unit/cli-harness.ts` (stdio capture, `process.exitCode` reset,
    pinned `process.cwd`, per-test home isolation with an `os.homedir()` mock —
    Node caches it, so relocating `HOME` alone was not enough).
  - MCP is exercised through a real in-memory round trip
    (`Client` over `InMemoryTransport`), not by poking at internals.
  - **Defects found while measuring** (both in `watch`): an unreachable
    `pluginBaseDir` ternary left of the no-config early return, and an unreachable
    non-`Error` fallback in the `--debounce` catch. Removed in favour of the
    shared `errorMessage` helper rather than contrived around — the same policy
    cycle 2 applied to dead branches.
  - OQ-1 answered: the entry points were covered, not excluded. OQ-2: prompt
    question shapes are asserted for the forms where a wrong `name`/`type`
    silently breaks the flow.
