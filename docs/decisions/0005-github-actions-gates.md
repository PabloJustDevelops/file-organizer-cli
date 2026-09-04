# ADR 0005 — GitHub Actions as the enforcement layer

- **Status:** Accepted (retroactive)
- **Date:** 2026-09-04

## Context

The constitution requires machine-enforced gates (lint, types, tests,
coverage). These must run identically for every contributor and on every
platform the CLI supports, without local discipline.

## Decision

Use GitHub Actions with three workflows:

- **`ci.yml`** — primary gate for `main`/PRs: lint (`oxlint` + `tsc`),
  vitest, coverage gate, and build, split per package (cli / www).
- **`test.yml`** — cross-platform matrix (ubuntu, windows, macos) running
  typecheck, tests, and build; uploads coverage artifacts.
- **`release.yml`** — on GitHub release: cross-platform build + npm publish
  of `packages/cli` using `NPM_TOKEN`.

Merges to `main` are gated on CI passing.

## Consequences

- **+** Constitution Articles IV and V are enforced automatically — no PR
  can skip lint, types, tests, or coverage.
- **+** Windows/macOS breakage is caught before release, not by users.
- **−** Every job pays Bun setup cost; matrix runs triple CI minutes.
- **−** Two overlapping workflows (`ci.yml`, `test.yml`) duplicate steps;
  consolidation is acceptable future cleanup as long as gates are preserved.

## Notes

`ci.yml` invokes `bun run test` in `packages/cli`, which maps to vitest via
that package's scripts; `test.yml` calls `bun test` directly. This works only
because both exist — a known quirk to unify when the workflows are
consolidated.
