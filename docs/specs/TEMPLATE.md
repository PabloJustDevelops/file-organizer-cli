# Spec: <Feature Name>

> Status: Draft | Active | Implemented | Superseded by [ADR/Spec link]
> Author: · Created: YYYY-MM-DD · Last validated against code: YYYY-MM-DD

## 1. Problem

What user problem does this solve, and why now? Two or three sentences. Link
relevant discussions or issues.

## 2. Non-goals

Explicitly out of scope. Anything not listed here but adjacent is a non-goal
until a new spec says otherwise.

## 3. Behavior

Describe the behavior once, in terms of the core (per Constitution Articles II
and VII) — not per adapter. If the behavior differs on a surface (CLI flag vs
TUI key vs MCP tool), note the mapping in §6.

## 4. Acceptance criteria

Written to be testable. Each criterion gets an ID and, once implemented, a
traceability link to the test that covers it.

| ID   | Given (precondition)                    | When (action)              | Then (observable outcome)                  | Test |
|------|-----------------------------------------|----------------------------|--------------------------------------------|------|
| AC-1 | a directory with 3 `.jpg` files         | `fo organize --dry-run`    | exit 0; 3 "would move" lines; no files changed on disk | `tests/integration/organizer.test.ts` |
| AC-2 | ...                                     | ...                        | ...                                        | —    |

Rules of thumb:
- "Then" must be observable via command output, exit code, or filesystem state.
- If you cannot name the test column, the criterion is either a wish or
  belongs in §3.
- One criterion, one behavior. Split compound sentences.

## 5. Config & types touched

New or changed entries in `src/types/index.ts`, `config/loader.ts`
(normalization + validation + error message), and `docs/RULES.md`. If none,
write "none". See Constitution Article VI.

## 6. Adapter mapping (CLI / TUI / MCP)

| Behavior        | CLI                | TUI                | MCP                |
|-----------------|--------------------|--------------------|--------------------|
| Example: preview| `--dry-run` flag   | preview screen     | `dry_run` param    |

Leave a cell empty only if the adapter intentionally does not expose the
behavior — say why beneath the table.

## 7. Safety review

Per Constitution Article I: what can this feature destroy, how is it gated
(dry-run, conflict strategy, undo), and what does the failure path report?

## 8. Open questions

Unresolved decisions, each with an owner. Move resolved items into §3–§7 with
the ADR or commit reference.

## 9. Changelog

- YYYY-MM-DD — spec drafted
- YYYY-MM-DD — AC-3 linked to test, status → Implemented
