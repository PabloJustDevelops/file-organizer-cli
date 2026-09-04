# ADR 0002 — Vitest + memfs for in-memory core testing

- **Status:** Accepted (retroactive)
- **Date:** 2026-09-04

## Context

The rules engine, template variables, and conflict resolution are pure logic;
testing them against a real disk is slow, flaky in CI across three OSes
(ubuntu/windows/macos), and risks touching real user files. A file organizer's
worst failure mode is a test that writes to the developer's real Downloads.

## Decision

Use **Vitest** as the test runner with **memfs** for filesystem-dependent unit
tests. Core modules are written so they receive their filesystem
implementation or operate on injected in-memory state, allowing:

- `tests/unit/*` — pure logic and memfs-backed behavior, no disk.
- `tests/integration/*` — organizer end-to-end, watcher, conflict resolution,
  overwrite-backup, and MCP handlers, still isolated from the real FS.

Coverage runs via `@vitest/coverage-v8` and is enforced in CI
(`bun run test:coverage`).

## Consequences

- **+** Deterministic, OS-independent tests across the CI matrix.
- **+** Safety guarantee by construction: tests cannot damage real files.
- **−** memfs semantics can drift subtly from real filesystems (e.g., case
  sensitivity, permissions); anything suspicious gets an integration test with
  real temp directories before we trust it.
- **−** `oxlint`'s `no-module-mocking` rule is disabled because tests mock
  `fs` via memfs (documented in `oxlint.config.mjs`).
