# ADR 0006 — Coverage ratchet thresholds

- **Status:** Accepted
- **Date:** 2026-09-04

## Context

The global coverage gate (`vitest.config.ts` thresholds) sat at 70/60/70/70
(statements/branches/functions/lines) while actual global coverage reached
90.46/88.95/88.61/90.46 during the plugin-system pilot. A 20–28 point slack
means any amount of untested core code can land in CI without a signal —
the gate stopped being informative.

Constitution Article IV makes traceability and coverage enforcement a
non-negotiable; a gate this loose does not enforce anything.

## Decision

Raise the global thresholds to a **ratchet level** — just under the current
actual numbers, with a small margin so legitimate in-progress PRs are not
brittle:

- statements: 70 → **88** → **90** (amended 2026-09-04, after plugin-transform)
- branches: 60 → **88** → **90** (amended 2026-09-04, after plugin-transform)
- functions: 70 → **85** → **90** (amended 2026-09-04, after plugin-transform)
- lines: 70 → **88** → **90** (amended 2026-09-04, after plugin-transform)

Rules of engagement going forward:

1. **Never lower a threshold.** If a change drops below the gate, the change
   is missing tests — not the gate being wrong.
2. **Raise when coverage improves.** Whenever global coverage climbs past a
   threshold by a full point or more, raise the threshold to lock it in.
3. `core/plugins/*` is already at 100% across all four metrics; new plugin
   modules should land the same way.

## Consequences

- **+** New uncovered code fails CI immediately; the gate is informative again.
- **+** The pilot's quality gains (100% in core/plugins) are structurally
  protected, not dependent on reviewer memory.
- **−** CI gets stricter with no grace period for contributors who were
  relying on the old slack — communicated in the constitution reference.

## Notes

`utils/logger.ts` was flagged here as the weakest area (78.7% stmts). It has
since been brought to **100% across all four metrics** (unit tests in
`tests/unit/logger.test.ts`, 2026-09-04): level filtering, console sink
routing, argument forwarding, and the file-output branches (append format,
no-path no-op, swallowed write errors) — the chalk color paths are covered by
asserting on the *sink calls*, so no E2E was needed for the gate.

Current actuals after the pilot (logger + plugin-transform all at 100%×4):
91.92 / 90.22 / 92.12 / 91.92 — thresholds raised to 90 across the board per
rule 2. The next full-point milestone is statements/lines at 93.
