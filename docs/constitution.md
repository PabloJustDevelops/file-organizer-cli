# Project Constitution

**file-organizer-cli** — non-negotiable principles for how this codebase is built.
Every feature spec, plan, and code review defers to this document. Amendments
require a new ADR (see `docs/decisions/`).

Version: 1.0 · Adopted: 2026-09-04

---

## Article I — Safety above convenience

This tool moves, overwrites, and deletes user files. Destructive action is the
product, so it is governed, never incidental.

- Every mutating path (`organize`, watch mode, future commands) MUST have a
  `--dry-run` equivalent that previews identical behavior without side effects.
- File conflicts MUST be resolved through an explicit `conflictResolution`
  strategy — never silently clobbered.
- Any operation that overwrites an existing file MUST be reversible (`undo`,
  with backups persisted for `overwrite`/`newest`).
- When in doubt, skip and report. A file left in place is recoverable; a file
  written to the wrong place may not be.

## Article II — Pure core, thin edges

The core engine (rules matching, template variables, conflict resolution,
planning) contains zero I/O decisions and zero UI logic.

- Core logic MUST be testable in memory (pure functions or `memfs`), with no
  real filesystem access in unit tests.
- CLI (commander), TUI (Ink), and MCP server are adapters over the same core.
  A behavior is implemented once in the core and exposed by each adapter.
- Adapters MUST NOT reimplement core behavior; parity bugs are fixed in the
  core, then re-surfaced.

## Article III — Spec before code

User-facing behavior starts as a spec before implementation begins.

- Features with a user-visible contract live in `docs/specs/<feature>.md` with
  **acceptance criteria written to be testable** (see `docs/specs/TEMPLATE.md`).
- When behavior changes, the spec changes in the **same PR** as the code.
  A spec that no longer matches reality is a bug of equal severity to a code bug.
- Documentation that describes unimplemented behavior MUST be marked as
  *Planned — not implemented* until it ships. (Known offender: `PLUGINS.md`.)
- Architectural decisions that constrain future work are recorded as ADRs in
  `docs/decisions/`, numbered sequentially, never edited after acceptance —
  superseded, not rewritten.

## Article IV — Every behavior has an executable check

A spec criterion that cannot be traced to a test is a wish, not a requirement.

- Each acceptance criterion in a spec MUST link to the test covering it
  (test file + describe name).
- The CI coverage gate (`bun run test:coverage` in `.github/workflows/ci.yml`)
  is the floor, not the goal: the goal is *traceability* from spec → test → code.
- Integration tests cover adapter surfaces (organizer end-to-end, watcher,
  conflict resolution, MCP handlers) against real directory semantics via
  `memfs` or temp dirs.

## Article V — Types are the first spec

TypeScript's compiler is the cheapest spec-enforcement tool we have.

- `tsc --noEmit` and oxlint (including the custom `anti-slop` plugin) run in
  CI and MUST pass — no suppressions without a written justification comment.
- Public types in `src/types/index.ts` are contracts: changing them requires
  updating the specs that reference them and the tests that exercise them.
- No unchecked type assertions, no widened `unknown` without narrowing —
  enforced by `tools/oxlint/anti-slop/`.

## Article VI — Config is a contract

The YAML file is the user's promise to the tool; validation is the tool's
promise back.

- Every config surface MUST be validatable (`fo config validate`) **before**
  any file is moved; invalid config aborts before scanning.
- New config fields MUST be: added to `src/types/index.ts`, normalized and
  validated in `config/loader.ts` with actionable error messages, documented
  in `docs/RULES.md`, and covered by a `config-loader` test.
- Unknown template variables are reported, never silently interpolated.

## Article VII — Adapters are secondary, specs are shared

CLI, TUI, and MCP are three windows onto one engine.

- A behavior spec describes the behavior once, not per-adapter.
- Adapter-specific details (flags, TUI keys, MCP tool names) are documented in
  adapter-facing docs (`README.md`, `SKILL.md`), not in the behavior spec.
- New adapters must prove parity with existing behavior via integration tests
  before being marked stable.
