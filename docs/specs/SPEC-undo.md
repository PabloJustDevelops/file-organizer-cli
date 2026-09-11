# Spec: undo

> Status: **Implemented** (retroactive, 2026-09-11) · Created: 2026-09-11
> Module of: [CAPABILITY-MAP-cli-cycle2.md](CAPABILITY-MAP-cli-cycle2.md) (`governance`)
> Process: spec-driven-development (retroactive — describes shipped behavior)

## 1. Objective

Every mutating operation must be reversible (Constitution Art. I): `fo undo`
restores the most recent one. This spec records that contract and its limits.

## 2. Non-goals

- Undoing an arbitrary operation in the middle of history (only the last entry).
- Undoing a run performed under a different history directory.

## 3. Behavior

1. Each real `organize` (and each reversible `dedup --delete`) appends one
   history entry: `{ id, timestamp, operations: [{from, to, rule}], replaced? }`.
2. History persists in `~/.file-organizer/history.json`, capped at `historySize`
   (default 50); the oldest entry is dropped when it overflows.
3. `undo` pops the last entry and processes its operations in reverse, moving
   `to → from`. If the original location is taken, it falls back to a unique name
   rather than failing mid-revert.
4. For `overwrite`/`newest` clobbering, the replaced file was backed up first and
   is restored to its original path.
5. A corrupt history file is quarantined (`.corrupt-<ts>`), warned about, and
   replaced with a clean one — it is never silently discarded.
6. `undo --list` prints the operation history.

## 4. Acceptance criteria

| ID   | Given | When | Then | Test |
|------|-------|------|------|------|
| AC-1 | an organize run | `undo -y` | moved files are back at their original paths | `tests/e2e/cli.test.ts` |
| AC-2 | an original path taken since | `undo` | the file is restored under a unique name, not lost | `tests/integration/conflict-resolution.test.ts` |
| AC-3 | an `overwrite` run | `undo` | the clobbered file is restored from its backup | `tests/integration/overwrite-backup.test.ts` |
| AC-4 | entries saved by one instance | a second instance loads | history persists | `tests/unit/history-store.test.ts` |
| AC-5 | a corrupt history file | load | quarantined, warned, clean history starts | `tests/integration/overwrite-backup.test.ts` |
| AC-6 | a `dedup --delete` run | `undo -y` | the removed duplicate is restored | `tests/e2e/safe-mutations.test.ts` |
| AC-7 | history with entries | `undo --list` | the operation appears | `tests/e2e/safe-mutations.test.ts` |
| AC-8 | an empty history | `undo_last` (MCP) | reports nothing to undo | `tests/integration/mcp-handlers.test.ts` |
| AC-9 | history over `historySize` | add an entry | the oldest is trimmed | `tests/unit/organizer-removals.test.ts` |

## 5. Adapter mapping

| Behavior | CLI | MCP |
|----------|-----|-----|
| Undo last | `fo undo [-y]` | `undo_last` |
| History | `fo undo --list` | — |

## 6. Boundaries

- **Always:** a clobbered file is backed up before the move and restored on undo.
- **Never:** fail mid-revert (fall back to a unique name); silently drop a
  corrupt history file.
