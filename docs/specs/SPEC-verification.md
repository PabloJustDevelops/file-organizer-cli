# Spec: verification

> Status: **Implemented** (2026-09-11; AC-1…AC-10 verified) · Created: 2026-09-11
> Module of: [CAPABILITY-MAP-cli-adoption.md](CAPABILITY-MAP-cli-adoption.md) (`verification`, depends on `distribution`)
> Process: spec-driven-development (Specify phase)

## 1. Objective

Close the gap between what the project *claims* and what it *provably does*.
Today `vitest.config.ts` justifies excluding command/UI wrappers because they are
"exercised via E2E", but no E2E exists: every test imports the library, none runs
the `fo` binary. The bugs that actually hurt users live exactly there (exit
codes, flag wiring, prompts, the install path).

Success looks like: one command (`bun run test`) runs the built CLI against real
directories in isolated temp environments and asserts exit codes, output, and
filesystem state — plus an install smoke that packs the tarball and runs the
installed binaries. Distribution's AC-6/AC-10 (currently verified by hand) become
automatic, and later modules get a harness to close their own ACs.

## 2. Non-goals

- The **failure-path exit-code contract** (non-zero on error) → `cli-contract`.
  This module records current behavior; it does not fix it.
- Interactive prompts without `-y` and the Ink TUI (no TTY in CI).
- `watch` mode timing (debounce/latency is inherently flaky) — covered by the
  existing integration test with an injected watcher, not E2E.
- Plugin loading E2E (already covered by `tests/integration/plugin-loader.test.ts`).
- Adding OSes or restructuring CI workflows (ADR-0005 consolidation is cycle 2).

## 3. Design

### Location and runner

- `tests/e2e/*.test.ts`, picked up by the existing include glob
  (`tests/**/*.test.ts`) and run by `bun run test` — one command, no new script.
- A vitest **globalSetup** (`tests/e2e/global-setup.ts`) ensures a fresh build
  once per run (`bun run build`), so the suite always exercises the packaged
  artifact. `dist/` is therefore guaranteed current; the packaging test's
  `buildIfNeeded()` stays as a safety net.

### Invoking the binary

- Spawn `process.execPath` (the same Node running the tests) with
  `dist/cli/index.js` as the script — portable, no reliance on `node` in `PATH`,
  and no shell (so no `.cmd`/DEP0190 pitfalls on Windows).
- A shared helper (`tests/e2e/helpers.ts`) exposes
  `runCli(args, { cwd, env }) -> { status, stdout, stderr }`.

### Isolation (critical)

`Organizer`'s history store defaults to `~/.file-organizer`. E2E must never read
or write the developer's real history, so every spawn sets `HOME` **and**
`USERPROFILE` (Windows `os.homedir()` source) to a per-test temp directory.
Each test also gets its own `mkdtemp` working directory, removed afterwards.

### What gets covered

Happy paths only (exit 0), because failure-path exit codes are `cli-contract`'s
deliverable: version/help, config init+validate, organize dry-run (no mutation),
organize for real (files land at rule destinations), undo (files restored),
rules list, dedup detection (no deletion), and the packed-tarball install smoke.

## 4. Commands

```
Test:         bun run test            # vitest run, includes tests/e2e
Build (once): bun run build           # also triggered by e2e globalSetup
Lint:         bun run lint
Coverage:     bun run test:coverage   # e2e excluded from the coverage include
```

## 5. Testing strategy

- **E2E** (`tests/e2e/cli.test.ts`): spawn the built binary per scenario; assert
  exit code, stdout/stderr substrings, and real filesystem state before/after.
- **Install smoke** (`tests/e2e/install.test.ts`): `npm pack` the real tarball,
  `npm install -g --prefix <temp>` it, then run the installed `fo` /
  `file-organizer` / `fo-tui` shims and assert `--version` / `--help`.
- Coverage exclude is unchanged: E2E drives the process boundary, it does not
  need to inflate the core coverage ratchet.

## 6. Acceptance criteria

| ID   | Given | When | Then | Test |
|------|-------|------|------|------|
| AC-1 | a fresh build | `fo --version` | exit 0; stdout equals `packages/cli/package.json` version | `tests/e2e/cli.test.ts` |
| AC-2 | a fresh build | `fo --help` | exit 0; output lists `organize`, `watch`, `rules`, `undo`, `config`, `dedup` | `tests/e2e/cli.test.ts` |
| AC-3 | an empty temp dir | `fo config init` then `fo config validate` | exit 0 both; `.file-organizer.yaml` exists | `tests/e2e/cli.test.ts` |
| AC-4 | temp dir with 3 `.jpg` + config | `fo organize . --dry-run` | exit 0; output reports 3 files; **no file moved on disk** | `tests/e2e/cli.test.ts` |
| AC-5 | same fixture | `fo organize . -y` | exit 0; the 3 files exist under the rule destination; originals gone | `tests/e2e/cli.test.ts` |
| AC-6 | the AC-5 end state | `fo undo -y` | exit 0; the 3 files are back at their original paths | `tests/e2e/cli.test.ts` |
| AC-7 | config with named rules | `fo rules list` | exit 0; each rule name appears in output | `tests/e2e/cli.test.ts` |
| AC-8 | temp dir with 2 byte-identical files | `fo dedup . -r` | exit 0; reports a duplicate group; **neither file deleted** | `tests/e2e/cli.test.ts` |
| AC-9 | a packed tarball | install into a temp prefix | `fo`, `file-organizer`, `fo-tui` shims exist; `fo --version` exits 0 | `tests/e2e/install.test.ts` |
| AC-10 | any E2E run | before tests | `dist/cli/index.js` exists (globalSetup built it) | `tests/e2e/global-setup.ts` |

## 7. Boundaries

- **Always:** isolate home/history per spawn; clean up temp dirs; assert real
  filesystem state, not just output; keep E2E non-interactive (`-y`).
- **Ask first:** changing `vitest.config.ts` include/exclude; adding a CI step;
  splitting E2E into a separate `test:e2e` command.
- **Never:** touch the developer's real `~/.file-organizer`; assert failure-path
  exit codes here (that is `cli-contract`); add timing-based assertions on
  `watch`.

## 8. Types & docs touched

- New: `tests/e2e/helpers.ts`, `tests/e2e/global-setup.ts`,
  `tests/e2e/cli.test.ts`, `tests/e2e/install.test.ts`.
- `packages/cli/vitest.config.ts` (register `globalSetup`).
- No `src/` change: this module adds verification, not behavior.
- Feeds back into `README.md` "Development" only if the commands change (they
  do not) and closes distribution AC-6/AC-10.

## 9. Open questions

- **OQ-1:** globalSetup **always** rebuilds (deterministic, +~7 s per run) vs
  only when `dist/` is missing (faster, risks testing a stale build locally)?
  Default: **always rebuild** — a silent stale binary is worse than 7 seconds.
- **OQ-2:** Split E2E into `test:e2e` later to keep the unit loop fast?
  Default: not now (one command was chosen); revisit if the suite gets slow.
- **OQ-3:** Does the install smoke run on the 3-OS matrix? Default: yes wherever
  `bun run test` runs (`test.yml` matrix); `ci.yml` stays ubuntu-only.

## 10. Changelog

- 2026-09-11 — spec drafted (cycle-1 module `verification`).
- 2026-09-11 — **implemented and verified AC-1…AC-10.** Harness: `runCli` spawns
  `process.execPath` + `dist/cli/index.js` with isolated `HOME`/`USERPROFILE`;
  `globalSetup` rebuilds once per run; 7 CLI scenarios + 1 install smoke
  (real `npm pack` + `npm install --prefix`). Full suite: 26 files, 250 passed /
  1 skipped; lint 0 errors.
- 2026-09-11 — the harness found a real `distribution` defect on first run:
  the CLI entry statically imported `react`/`ink` (via `tuiCommand`), so
  `fo --version` crashed under bun's isolated `node_modules`
  (`ERR_MODULE_NOT_FOUND`). Fixed in `distribution` (lazy TUI import + `react`
  as a direct dependency); see SPEC-distribution changelog.
- 2026-09-11 — cost accepted: `bun run test` now builds first (~4 s → ~36 s).
  OQ-2 (separate `test:e2e`) remains the escape hatch if it becomes annoying.
