# Contributing

Thanks for taking the time to contribute. This project is built spec-first —
please read this before opening a pull request.

## Prerequisites

- [Bun](https://bun.sh) — package manager and script runner
- Node.js >= 18 (20 LTS recommended) — to run the built CLI
- Node.js 22.12+ for the development environment (see `.nvmrc`) — Vitest 5
  (`packages/cli`'s test runner) requires it. This is separate from the
  published package's `engines.node` (`>=18`), which targets end users.

## Setup

```bash
bun install          # install the workspace
bun run test         # vitest: unit + integration + e2e
bun run lint         # oxlint + tsc --noEmit
bun run build:cli    # tsup → packages/cli/dist
```

Run a single file with `bunx vitest run tests/unit/<name>.test.ts`.

## Spec before code

User-facing behavior starts as a spec, not a commit:

1. **Spec** — `docs/specs/<feature>.md`, following
   [`docs/specs/TEMPLATE.md`](docs/specs/TEMPLATE.md). Every acceptance
   criterion must be observable (output, exit code, or filesystem state) and
   name the test that covers it.
2. **Plan** — `tasks/plan-<feature>.md`: components, order, risks.
3. **Tasks** — `tasks/todo-<feature>.md`: one focused session each.
4. **Implement** — follow the plan; link tests from the spec's criteria.

A change that alters behavior updates its spec in the same PR. A spec that no
longer matches reality is treated as a bug. Requests that bundle several
independently testable capabilities start with a capability map
(`docs/specs/CAPABILITY-MAP-*.md`).

## Architecture decisions

Durable decisions live in `docs/decisions/` as numbered ADRs. They are
**immutable once accepted**: supersede them with a new ADR instead of editing.

## Tests

- `tests/unit/` — pure logic (in-memory, `memfs` where useful)
- `tests/integration/` — real filesystem and adapter surfaces
- `tests/e2e/` — drives the built binary; builds it first via `globalSetup`

`bun run test` is the full gate; `bun run test:coverage` enforces the coverage
ratchet.

## CI gates

A pull request must pass lint (`oxlint` + `tsc --noEmit`), the vitest suite, the
coverage gate, and the build. The test workflow also runs the suite on Windows
and macOS.

## Pull requests

- Keep the diff scoped to one capability; update the spec and docs alongside it.
- Reference the spec section the PR implements.
- Never commit secrets or generated build output.
