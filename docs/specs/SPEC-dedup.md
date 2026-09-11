# Spec: dedup

> Status: **Implemented** (retroactive, 2026-09-11) · Created: 2026-09-11
> Module of: [CAPABILITY-MAP-cli-cycle2.md](CAPABILITY-MAP-cli-cycle2.md) (`governance`)
> Process: spec-driven-development (retroactive — describes shipped behavior)

## 1. Objective

Find duplicate files by content and (optionally) remove them **reversibly**:
`fo dedup [source]`. Removal is a mutation, so it obeys Constitution Art. I.

## 2. Non-goals

- Choosing which copy to keep interactively (the newest wins).
- Similar-but-not-identical files (content hash, not heuristics).
- OS trash integration (recovery is via backup + `fo undo`).

## 3. Behavior

1. Scan the directory (git-ignored/hidden excluded; `-r` for subdirectories).
2. Group by size first (cheap), then hash only same-size candidates (sha256).
3. Report each group and the recoverable space; without `--delete` nothing is
   touched.
4. With `--delete`, keep the **newest** copy per group and move the rest into the
   history backup store (`<historyDir>/dedup/`), recording an undo entry.
5. `-y` skips the confirmation prompt; per-file failures are reported and, if any
   occurred, the command exits 1.

## 4. Acceptance criteria

| ID   | Given | When | Then | Test |
|------|-------|------|------|------|
| AC-1 | two identical files | `dedup . -r` | exit 0; a group is reported; both files stay | `tests/e2e/cli.test.ts` |
| AC-2 | the same fixture | `dedup . -r --delete -y` | one copy removed, the newest kept | `tests/e2e/safe-mutations.test.ts` |
| AC-3 | after AC-2 | `undo -y` | the removed copy is restored at its original path | `tests/e2e/safe-mutations.test.ts` |
| AC-4 | a file | `HistoryStore.moveToBackup` | moved into `<historyDir>/dedup/`, extension preserved | `tests/unit/history-store.test.ts` |
| AC-5 | operations | `recordRemovals` | persisted as an undo entry, trimmed to `historySize` | `tests/unit/organizer-removals.test.ts` |
| AC-6 | duplicate candidates | `findDuplicates` | only same-size candidates are hashed (size prefilter) | — **not directly covered** (internal optimization; observed end-to-end through AC-1/AC-2) |

## 5. Adapter mapping

| Behavior | CLI |
|----------|-----|
| Report only | `fo dedup` |
| Remove | `fo dedup --delete -y` |
| Restore | `fo undo` |

## 6. Boundaries

- **Always:** removal is undoable; keep the newest copy of each group.
- **Never:** `fs.remove` a user file — move it to the backup store instead.
