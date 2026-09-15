# ADR 0011 — Node.js >=22.13.0 as the supported baseline

- **Status:** Accepted
- **Date:** 2026-09-15

## Context

`packages/cli/package.json` published `engines.node: ">=18.0.0"` while the
development environment already required Node 22.12+ for Vitest 5
(documented in `README.md`/`CONTRIBUTING.md` as a split: `>=18` for the
published package, `22.12+` to run the test suite). `SPEC-distribution.md`
even recorded this as an open question (OQ-5, "keep `>=18`? default: yes").

That split stopped being sustainable once the six blocked runtime majors
were re-evaluated:

- `vitest@5` / `@vitest/coverage-v8@5` (already adopted, ADR-0006/CHANGELOG):
  requires `^22.12.0` (also `>=23.5.0`, `^21.7.0`, `^20.12.0`).
- `commander@15`: requires `>=22.12.0`.
- `chokidar@5`: requires `>=20.19.0`.
- `chalk@6`: requires `>=22`.
- `inquirer@14`: requires `^22.13.0 || ^20.17.0 || >=23.5.0`.

Node 18 reached End-of-Life 2025-04-30 and Node 20 reaches End-of-Life
2026-04-30 — both are already unsupported or about to be by the time this
lands. Every dependency major this cycle needed to touch converges on Node
22, and the two oldest LTS lines are EOL or expiring, so keeping `>=18` in
`engines.node` was documenting a promise the dependency tree no longer keeps.

## Decision

Raise the supported Node baseline to **`>=22.13.0`** everywhere:

- `packages/cli/package.json` `engines.node`: `>=18.0.0` → `>=22.13.0`.
- root `package.json` `engines.node`: `>=18.0.0` → `>=22.13.0` (this is the
  Bun-run workspace root; it gates local/CI tooling, not the published
  package, but there is no reason for it to claim a lower floor than the
  package it wraps).
- `packages/cli/devDependencies["@types/node"]`: `^20` → `^22`, matching the
  new floor.
- `.nvmrc`: `22.12.0` → `22.13.0` (the exact floor all five deps agree on).
- `packages/cli/tsup.config.ts` `target` stays `node18` intentionally — see
  Consequences.

`22.13.0` is chosen (not `22.12.0`) because `chalk@6` alone requires `>=22`
without a documented `22.12` allowance question mark, and `commander@15`
picks `22.12.0`; `22.13.0` is the highest of the five floors and therefore
the only version that satisfies every dependency's `engines` field
simultaneously without relying on npm's non-enforcement of `engines` at
install time.

This is a support-policy decision, not a code change: no runtime behavior in
`src/` depends on Node 22 features. It is recorded as an ADR (not just a
version bump) because it changes what a published `>=18` promise meant to
downstream users, matching Constitution Article III's rule that decisions
constraining future work get an ADR.

## Consequences

- **+** `bun install` (and `npm install`) no longer sits on dependency majors
  whose `engines.node` field silently disagreed with the package's own
  claim — the four points (root, cli package, `@types/node`, `.nvmrc`) now
  say the same thing.
- **+** One Node baseline to document instead of two (published package vs.
  dev environment), removing the `README.md`/`CONTRIBUTING.md` footnote that
  explained the split.
- **−** Anyone still on Node 18 or 20 LTS can no longer install this package
  globally without upgrading Node first. Both lines are EOL or within one
  release of it, so this trades a shrinking audience for dependencies that
  are already required in dev.
- **−** `tsup.config.ts`'s `target: 'node18'` is **not** raised in this ADR:
  it controls the ECMAScript syntax level tsup transpiles *down to*, not the
  Node version required to *run* the build — keeping it conservative costs
  nothing and avoids scope creep into a syntax-lowering change nobody asked
  for. Revisit only if a future dependency requires newer output syntax.
- **−** `npm`/`bun` do not hard-block an install on a failing `engines` field
  by default (it is a warning), so users on unsupported Node still need to
  hit a runtime error to notice — no code change enforces this ADR at
  install time; `engines.node` remains advisory per npm's default behavior.

## Notes

Superseded doc: `SPEC-distribution.md` OQ-5 ("Bump `engines.node` from
`>=18` (EOL) to `>=20`? Default: keep `>=18`") is resolved by this ADR as
**`>=22.13.0`**, not `>=20` — the dependency floors already require 22, so
stopping at 20 would have needed a second bump within the same cycle.
