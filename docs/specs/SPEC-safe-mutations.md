# Spec: safe-mutations

> Status: **Implemented** (2026-09-11; AC-1…AC-11 verified) · Created: 2026-09-11
> Module of: [CAPABILITY-MAP-cli-adoption.md](CAPABILITY-MAP-cli-adoption.md) (`safe-mutations`, depends on `config-integrity` relaxed — reads config only)
> Process: spec-driven-development (Specify phase)

## 1. Objective

Bring the two mutating surfaces that bypass the project's own safety rules in
line with Constitution Article I ("any operation that overwrites must be
reversible"; "when in doubt, skip and report"):

- `dedup --delete` **deletes files irreversibly** — no backup, no undo.
- `watch` **fights itself** on custom destinations: the ignore list is hardcoded
  to `images/`, `documents/`, `videos/`…, so a config pointing at `./photos`
  makes the watcher react to its own moves. Its `--debounce` flag is also parsed
  and then ignored (the watcher hardcodes 500 ms), and `--no-initial` does
  nothing because no initial pass is ever run.

Success looks like: deleting duplicates is undoable like everything else, and
watch mode is destination-aware, honors its flags, and does the initial pass it
advertises.

## 2. Non-goals

- OS recycle bin integration — recovery is via backup + `fo undo`, not the
  system trash.
- Interactive selection of which duplicate to keep (newest is kept).
- `dedup` as an organize rule or a plugin.
- Config content validation (regex/patterns/`recursive`) → `config-integrity`.
- Watch performance tuning beyond wiring the existing debounce.

## 3. Design

### dedup becomes undoable

- `HistoryStore.moveToBackup(originalPath): Promise<string>` — **moves** a file
  into `<historyDir>/dedup/<uuid><ext>` and returns the backup path (today only
  `backupReplacedFile` exists, which *copies*).
- `Organizer.recordRemovals(removals: MovedFile[]): Promise<void>` — appends an
  `UndoEntry` (`rule: 'dedup'`) and persists it, respecting `historySize`. Uses
  the same history as `organize`, so `fo undo` restores dedup deletions with the
  machinery that already exists (`undo` moves `op.to → op.from`).
- `dedup` gains `-y, --yes` (skip the confirmation prompt, needed for
  automation). `--delete` without `-y` still prompts.
- Deletion becomes: move → collect `{from, to: backupPath, rule: 'dedup'}` →
  `recordRemovals`. Per-file failures are reported; if any occurred the command
  exits 1 (via `fail`) while the successful ones stay recorded and undoable.

### watch is destination-aware

- `buildDestinationIgnores(rules: Rule[]): string[]` (pure, exported from
  `core/watcher.ts`): for each rule `destination`, strip a leading `./`, take the
  first path segment (stopping at `/` or `{`) and emit `**/<segment>/**`.
  Absolute destinations are skipped (they are outside the watched tree).
- `DEFAULT_IGNORES` is trimmed to destination-independent entries only
  (`node_modules`, `.git`, `dist`, `.cache`, `*.tmp`); the hardcoded `images/`,
  `documents/`, … are removed, since they are now derived from config.
- **Destination folders are also excluded from the scan.**
  `buildDestinationDirs(rules, sourceDir): string[]` resolves the static prefix
  of each destination to an absolute directory; `ScanOptions` gains
  `excludeDirs`, and `FileScanner.scan` filters out any file under those roots.
  Ignoring chokidar events alone is not enough — a watch-triggered pass would
  still scan the destination and could re-match files already there (e.g. a
  `.png` sitting in a destination that another rule targets elsewhere).
- **Dynamic learning:** chokidar's `ignored` becomes a function over a
  `Set<string>` of destination directories; after each organize pass every
  `moved.to` directory (and its ancestors, up to the source root) joins the same
  set, which is also fed to `excludeDirs`. This covers destinations whose static
  root *is* the source dir (e.g. `./{year}`). User `watchIgnorePatterns` from
  `AppConfig` still apply. The watcher derives all of this from the organizer's
  rules, so there is a single source of truth.

### watch flags actually work

- `parseDebounce(value: string): number` — integer > 0 or throw; `watch` uses it
  (default `1000`) and passes it to `FolderWatcher` instead of the hardcoded 500.
- `FolderWatcher` gains `organizeOnStart` (default `true`), mapped from
  `--no-initial`; on `ready` it runs one organize pass before settling into
  watch. This makes the advertised initial organization real.

## 4. Commands

```
Test:      bun run test
Build:     bun run build
Lint:      bun run lint
Manual:    fo dedup ~/Downloads -r --delete -y && fo undo
```

## 5. Testing strategy

- **E2E** (`tests/e2e/safe-mutations.test.ts`): dedup delete → undo round trip,
  and history visibility via `fo undo --list`; invalid `--debounce` exits 1.
- **Unit**: `buildDestinationIgnores` and `parseDebounce` are pure functions.
- **Integration** (`tests/integration/watcher.test.ts` extends): a custom
  destination is organized once and not re-organized; `organizeOnStart` moves
  existing files on start, and does nothing when disabled. Reuses the existing
  real-chokidar helpers (`idle()`), no timing assertions beyond settling.
- **Unit** (`tests/unit/history-store.test.ts` extends): `moveToBackup` moves
  (not copies) and preserves the extension.

## 6. Acceptance criteria

| ID   | Given | When | Then | Test |
|------|-------|------|------|------|
| AC-1 | a dir with 2 identical files | `fo dedup . -r` | exit 0; reports a group; both files still present | e2e |
| AC-2 | the same dir | `fo dedup . -r --delete -y` | exit 0; one copy removed from its path; the kept copy intact | e2e |
| AC-3 | after AC-2 | `fo undo -y` | exit 0; the removed copy is restored at its original path | e2e |
| AC-4 | after AC-2 | `fo undo --list` | the dedup operation appears in history | e2e |
| AC-5 | rules with `./photos/{year}`, `./documents`, and an absolute destination | `buildDestinationIgnores` / `buildDestinationDirs` | globs cover `photos`+`documents`; dirs resolve to `<source>/photos`; absolute/templated roots skipped | unit |
| AC-6 | watcher with `./photos` (jpg) and `./graphics` (png) destinations, a `.png` pre-placed in `photos/` | an unrelated `.jpg` is dropped | the pass runs; the `.png` stays in `photos/` and is **not** moved to `graphics/` (destination excluded from the scan) | integration |
| AC-7 | `"2500"`, `"abc"`, `"0"`, `"-5"` | `parseDebounce` | `2500`; throws for the other three | unit |
| AC-8 | a valid config | `fo watch . --debounce abc` | exit 1; validation happens before watching starts | e2e |
| AC-9 | a dir with an existing matching file | watcher starts with `organizeOnStart: true` | the existing file is organized on start | integration |
| AC-10 | the same dir | watcher starts with `organizeOnStart: false` | nothing is organized on start | integration |
| AC-11 | a file in the history dir | `moveToBackup` | file is moved into `<historyDir>/dedup/`, extension preserved | unit |

## 7. Boundaries

- **Always:** a deletion must be restorable via `fo undo`; validate flags before
  starting long-running work; keep `dedup` without `--delete` read-only.
- **Ask first:** changing the backup directory layout; making `--delete` not
  require `-y`; making `organizeOnStart` default to `false`.
- **Never:** call `fs.remove` on user files in `dedup --delete`; keep hardcoded
  destination names in `DEFAULT_IGNORES`; silently ignore `--debounce`.

## 8. Types & docs touched

- `src/utils/history-store.ts` (+`moveToBackup`), `src/core/organizer.ts`
  (+`backupForRemoval`, +`recordRemovals`), `src/core/watcher.ts`
  (+`buildDestinationIgnores`, +`buildDestinationDirs`, +`organizeOnStart`,
  dynamic ignores), `src/core/file-scanner.ts` (+`ScanOptions.excludeDirs`),
  `src/cli/commands/watch.ts` (+`parseDebounce`, wired `--debounce`/
  `--no-initial`), `src/cli/commands/dedup.ts` (+`-y`, backup + history).
- New: `tests/e2e/safe-mutations.test.ts`, `tests/unit/watcher.test.ts`.
- Docs: `README.md` / `packages/cli/README.md` (dedup is undoable; watch flags).

## 9. Open questions

- **OQ-1:** Backup directory name for removed duplicates — `dedup/` or reuse
  `replaced/`? Default: **`dedup/`** (different semantics: move vs copy).
- **OQ-2:** Should `--delete` also accept `--force`, or is `-y` enough?
  Default: **`-y` only**, matching `organize`/`undo`.
- **OQ-3:** Dynamic ignore learning now, or rely on static roots? Default:
  **implement it** (the chosen option), since `./{year}`-style destinations have
  no static root.
- **OQ-4:** Is `organizeOnStart` default `true` the right fix for the dead
  `--no-initial`? Default: **yes** — it realizes the documented behavior.

## 10. Changelog

- 2026-09-11 — spec drafted (cycle-1 module `safe-mutations`).
- 2026-09-11 — **implemented and verified AC-1…AC-11.** `dedup --delete` moves
  duplicates to `<historyDir>/dedup/` and records an undo entry, so `fo undo`
  restores them; `-y` added. Watch derives its destination ignores from the
  organizer's rules, learns templated destinations at runtime, validates
  `--debounce`, and runs the initial pass that `--no-initial` disables.
- 2026-09-11 — design correction found while testing: chokidar ignores only
  filter **events**, not the scan, so keeping outputs out of the watcher
  required `ScanOptions.excludeDirs` + `buildDestinationDirs` too. AC-6 asserts
  the observable outcome (a destination file is not re-matched by another rule).
- 2026-09-11 — full suite 29 files, 273 passed / 1 skipped; lint 0 errors.
