# Capability Map: CLI Cycle 2 — Integrity, MCP, Governance

> Status: **Cycle 2 complete** (2026-09-11) · Process: spec-driven-development, Phase 0
> Predecessor: [CAPABILITY-MAP-cli-adoption.md](CAPABILITY-MAP-cli-adoption.md) (cycle 1, complete)
> Scope: the three modules cycle 1 deferred, in dependency order.

## Outcome

| Module id          | Spec                                                    | Status |
|--------------------|---------------------------------------------------------|--------|
| `config-integrity` | [SPEC-config-integrity.md](SPEC-config-integrity.md)     | Implemented — AC-1…AC-16 |
| `mcp-surface`      | [SPEC-mcp-surface.md](SPEC-mcp-surface.md)               | Implemented — AC-1…AC-14 |
| `governance`       | [SPEC-governance.md](SPEC-governance.md)                 | Implemented — AC-1…AC-6 |

Shipped: config content validated at config time (regex, `patterns[]`, unified
`recursive` default, dead `condition.match` removed, `RULES.md` made faithful);
the MCP server made reachable and brought to config parity with the CLI; the five
shipped commands given retroactive specs, the Constitution amended via ADR-0009,
and the orphan landing tasks archived.

Remaining from the standing objective: publish `0.1.0-rc.1` (blocked on a token
with Bypass 2FA).

## Why a map

Cycle 1 made the CLI installable, honest to scripts, and safe to mutate with.
Cycle 2 closes the three debts it recorded — each independently testable, so
each gets its own spec rather than one oversized one (skill Phase 0).

## Modules

| Module id          | Responsibility                                                                                          | Depends on                                  |
|--------------------|---------------------------------------------------------------------------------------------------------|---------------------------------------------|
| `config-integrity` | Validate config content at config time: regex `condition.pattern`, every `patterns[]` element, unified `recursive` default, faithful `RULES.md` | — (verification harness from cycle 1)       |
| `mcp-surface`      | Make the built MCP server actually reachable (`fo mcp` + a `file-organizer-mcp` bin) and document how to consume it | `config-integrity` (config still validates), cycle-1 `distribution` + `cli-contract` |
| `governance`       | Retroactive specs for the existing commands; fix the stale Constitution line; archive the orphan landing `tasks/` | —                                           |

Build order: `config-integrity` → `mcp-surface` → `governance`.

## Out of scope (recorded, not lost)

| Item | Why deferred |
|------|--------------|
| npm publish (~0.1.0-rc.1) | Standing objective: last, and only after the user confirms a token with Bypass 2FA |
| Stage-only / trusted publishing (OIDC) | npm deprecates bypass-2FA direct publish in Jan 2027; adopt when it actually bites |
| Retiring `--access`-era tooling in `release.yml` | Works today; revisit with trusted publishing |

## Notes

- No architectural rewrite: every module stays within the existing adapter/core
  boundary, governed by the Constitution (Art. I–VII).
- `config-integrity` deliberately runs first: `mcp-surface` reuses its validated
  config path, and `governance` will reference the config contract it tightens.
- Verification harness (cycle 1) is assumed present: `tests/e2e/*` drives the
  built binary in the default `bun run test`.
