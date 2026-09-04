# ADR 0004 — Three adapters (CLI, TUI, MCP) over one core

- **Status:** Accepted (retroactive)
- **Date:** 2026-09-04

## Context

The same organization behavior needs three interaction surfaces: a scripting
CLI (`fo`), an interactive terminal UI (`fo-tui`, Ink), and an MCP server for
AI agents. Duplicating logic across them guarantees drift — the exact problem
SDD exists to prevent.

## Decision

Implement all behavior once in `src/core/` and expose it through three
adapters:

- **CLI** (`src/cli/`, commander) — scripting and automation.
- **TUI** (`src/tui/`, Ink/React) — interactive use.
- **MCP** (`src/mcp/server.ts`, `@modelcontextprotocol/sdk`) — agent
  integration; handlers are structured to be testable without stdio/SDK
  plumbing (`tests/integration/mcp-handlers.test.ts`).

Adapters never reimplement matching, templating, or conflict logic; parity
bugs are fixed in the core. This is codified as Article II of the constitution.

## Consequences

- **+** One implementation of each behavior; three surfaces benefit together.
- **+** MCP server inherits tested core logic — agent behavior is trustworthy.
- **−** Core APIs must stay adapter-agnostic (no `chalk`, no `process.exit`
  in core), which occasionally costs refactoring discipline.
- **−** Cross-adapter features (e.g., a new flag) need touches in several
  places plus a parity test.
