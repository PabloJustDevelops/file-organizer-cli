# ADR 0003 — Custom oxlint plugin as executable code standards

- **Status:** Accepted (retroactive)
- **Date:** 2026-09-04

## Context

The team wants to prevent a recurring class of low-quality TypeScript patterns
(unsafe assertions, widened types, shape-named symbols) without adopting a
heavyweight lint stack. oxlint supports custom JS plugins, and the project
already maintains a set of bespoke rules.

## Decision

Maintain a custom oxlint plugin, `tools/oxlint/anti-slop/`, loaded through
`oxlint.config.mjs`, as the project's executable style/correctness standard:

- `tsc --noEmit` + oxlint run as a single `bun run lint` gate in CI.
- Anti-slop rules are `error` level: `no-chained-type-assertions`,
  `no-known-value-widening`, `no-unknown-parameters`, `no-unknown-returns`,
  `no-unknown-type-aliases`, `no-unsafe-dictionary-type`,
  `no-widen-then-assert`, among others.
- Disabled rules carry an inline comment explaining why (e.g.,
  `no-module-mocking` — tests mock `fs` via memfs).

## Consequences

- **+** Standards are enforced by machine, not review memory — the closest
  thing to a "constitution the compiler reads".
- **+** Fast: oxlint is Rust-based; linting adds negligible CI time.
- **−** The plugin is project-local tooling (`tools/` is excluded from linting
  itself and from the published package); breaking changes to oxlint's plugin
  API become our maintenance burden.
- **−** Rule authoring is Rust-adjacent JS; contributors need context before
  adding rules.
