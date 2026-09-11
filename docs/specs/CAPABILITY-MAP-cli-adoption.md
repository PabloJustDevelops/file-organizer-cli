# Capability Map: CLI Adoption Refinement (v1)

> Status: **Cycle 1 complete** (2026-09-11) · Date: 2026-09-11
> Process: spec-driven-development skill, Phase 0
> Scope decision (cycle 1): the **adoption MVP** — `distribution`,
> `verification`, `cli-contract`, `safe-mutations`, `adoption-docs`.
> Cycle 2 (deferred): `governance`, `mcp-surface`, `config-integrity`.

## Why a map

The request ("refine the CLI so people can actually use it") bundles several
independently testable capabilities: packaging, machine-contract behavior,
mutation safety, test infrastructure, and documentation. Each can ship and be
verified on its own, so they are specified as separate modules rather than one
oversized spec (skill Phase 0).

## Modules (cycle 1)

| Module id         | Responsibility                                                                                     | Depends on                          |
|-------------------|----------------------------------------------------------------------------------------------------|-------------------------------------|
| `distribution`    | npm identity (scoped name), `LICENSE`, package metadata, tarball hygiene, publish config, install docs surface | —                                   |
| `verification`    | E2E harness that runs the built `fo` binary; packaging checks; traceability AC → test                | `distribution` (needs a buildable, packable package) |
| `cli-contract`    | Consistent exit codes on failure paths, error semantics, `--json` machine-readable output           | —                                   |
| `safe-mutations`  | Reversible `dedup --delete` (backup + undo); `watch` ignores derived from rule destinations; wire `--debounce` | `config-integrity` (relaxed: reads config destinations only, no loader change) |
| `adoption-docs`   | README onboarding, requirements matrix, troubleshooting, `CHANGELOG.md`, `CONTRIBUTING.md`          | `distribution`, `cli-contract`      |

Build order: `distribution` → `verification` → `cli-contract` → `safe-mutations`
→ `adoption-docs`.

## Deferred to cycle 2 (recorded, not lost)

| Module id         | Responsibility                                                                 | Known debt carried |
|-------------------|--------------------------------------------------------------------------------|--------------------|
| `config-integrity`| Loader validation: regex `condition.pattern` checked at config time; every `patterns[]` element a non-empty string; unify the `recursive` default divergence (loader `true` vs CLI `false`); `RULES.md` faithful to code | regex typos currently crash `organize` at runtime naming no rule; `recursive` default is adapter-dependent |
| `governance`      | Retroactive specs for `organize`/`watch`/`undo`/`dedup`/`config`/`mcp`; fix the Constitution's stale "PLUGINS.md is a known offender" line; archive the orphan `tasks/plan.md` + `tasks/todo.md` that reference the removed landing | user-facing behaviors exist without spec or AC traceability (Constitution Art. III/IV) |
| `mcp-surface`     | A real MCP entrypoint (`fo mcp` or a `file-organizer-mcp` bin) + consumption docs | `dist/mcp/server.js` is built but unreachable; MCP cannot be configured by a user |

## Notes

- Every module lives across the existing adapter/core boundary; no architectural
  rewrite. The Constitution (Art. I–VII) governs all of them.
- `safe-mutations` originally depended on `config-integrity`; cycle 1 relaxes it
  because deriving watcher ignores from `rule.destination` only *reads* config
  and does not require loader changes.
- Environment prerequisite (blocking Implement/Verify, not Specify): this
  working tree has no working toolchain — `bun` is not installed and
  `node_modules` is a broken half-install (514 packages stranded in
  `node_modules/.old_modules-b23ef9daead5eb2e`). Restoration is required before
  any `bun run test|lint|build` gate can execute.
