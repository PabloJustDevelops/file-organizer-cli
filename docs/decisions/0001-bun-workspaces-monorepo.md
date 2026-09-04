# ADR 0001 — Bun workspaces monorepo

- **Status:** Accepted (retroactive)
- **Date:** 2026-09-04
- **Deciders:** @pablo

## Context

The project ships two packages: the CLI (`packages/cli`) and a landing page
(`packages/www`, Astro). They share TypeScript configuration and release
tooling, and the CLI is published to npm while the site is not. The runtime
choice also determines test tooling and CI shape.

## Decision

Use **Bun** as package manager and script runner, with npm **workspaces**:

- Root `package.json` declares `"workspaces": ["packages/*"]` and delegates
  scripts via `bun run --cwd packages/cli ...`.
- `bun.lock` is the single lockfile; no parallel `package-lock.json`.
- Published artifacts remain Node-compatible: `engines.node >= 18`.
- The `www` package is never published; only `packages/cli` has npm metadata.

## Consequences

- **+** One install command (`bun install`) for all packages; shared TS base
  config via `tsconfig.base.json`.
- **+** Build/bundle via `tsup`, which fits Bun's ESM-first workflow.
- **−** CI must set up Bun explicitly (`oven-sh/setup-bun@v2`) on every job.
- **−** Contributors without Bun must install it; Node alone can run the
  published CLI but not the dev scripts as written.
