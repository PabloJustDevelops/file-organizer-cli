# ADR 0010 — Coverage surface includes the adapter layer

- **Status:** Accepted
- **Date:** 2026-09-12
- **Amends:** [ADR-0006](0006-coverage-ratchet-thresholds.md) (surface only — no threshold value changed)

## Context

ADR-0006 set the coverage ratchet and its rules of engagement over a surface of
`src/core/**`, `src/utils/**` and `src/config/loader.ts`. The command and UI
wrappers were excluded with the rationale that they "are exercised via E2E".

Measurement on 2026-09-12 showed that rationale hid a blind spot: the E2E suite
spawns the built binary as a **child process** against `dist/`, so it contributes
**zero** v8 coverage. The excluded adapter layer measured **5% statements in
`src/cli` (8 of its 11 files at 0%)** and **45% in `src/mcp`**. That layer is
exactly where the user-facing contract lives — exit codes, `--json` stdout
purity, the prompt flow, MCP tool dispatch — which made it the worst place in the
package to have no signal.

## Decision

1. `coverage.include` gains `src/cli/**/*.ts` and `src/mcp/**/*.ts`.
2. All four thresholds stay at **100**, and no threshold value moved: the adapter
   layer was driven to 100% in the same change, so ADR-0006 rule 1 ("never lower
   a threshold") was not exercised. Widening a denominator is not lowering a bar.
3. `src/tui/**` stays outside the surface. Ink component internals and the
   `useOrganizer` hook are rendering behaviour, not an adapter contract. The CLI
   wrapper for the TUI (`src/cli/commands/tui.ts`) **is** in scope, because it
   lives under `src/cli`.
4. The two process entry points (`src/cli/index.ts`, `src/mcp/index.ts`) are in
   scope, covered in-process by stubbing their terminal call
   (`Command.prototype.parse`) and mocking the stdio transport.

## Consequences

- **+** A regression in any command's error path or flag wiring now fails CI.
- **+** Coverage becomes a real completion signal for adapter work (the `dedup`
  backup path, the `watch` flag signature) instead of an unverified claim.
- **−** The adapter tests depend on commander's `parseAsync(argv, { from: 'user' })`
  contract and on the MCP SDK's `InMemoryTransport`. A major bump of either means
  revisiting `tests/unit/cli-*.test.ts` and `tests/unit/mcp-server.test.ts`.
- **−** Two latent issues surfaced and were removed rather than papered over:
  `src/cli/commands/watch.ts` had an unreachable ternary for `pluginBaseDir`
  (after the no-config early return) and an unreachable non-Error fallback in its
  `--debounce` catch. Both now go through the shared `errorMessage` helper,
  matching the cycle-2 policy of deleting dead branches instead of contriving
  tests around them.

## Notes

`tests/unit/cli-harness.ts` is the shared in-process adapter harness: it captures
stdio, resets `process.exitCode`, pins `process.cwd`, and isolates the home
directory per test.

The `os.homedir()` mock there is not optional. `HistoryStore` captures the home
directory at *module load*, and Node caches `os.homedir()` for the lifetime of the
process — so relocating `HOME`/`USERPROFILE` alone would silently keep writing to
the developer's real `~/.file-organizer`. Adapter modules are therefore imported
through `vi.resetModules()` + dynamic `import()` after the isolation is in place.
