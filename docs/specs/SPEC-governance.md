# Spec: governance

> Status: **Implemented** (2026-09-11; AC-1…AC-6 verified) · Created: 2026-09-11
> Module of: [CAPABILITY-MAP-cli-cycle2.md](CAPABILITY-MAP-cli-cycle2.md) (`governance`, depends on —)
> Process: spec-driven-development (Specify phase)

## 1. Objective

Close the gap between "the Constitution says every behavior has a spec" and the
repo's reality. Three concrete debts:

- **Five user-facing commands exist without a spec** — `organize`, `watch`,
  `undo`, `dedup`, `config`. Their behavior is real and tested, but nothing
  traces an acceptance criterion to that test (Art. III/IV).
- **`docs/constitution.md` contradicts the code**: it names `PLUGINS.md` as a
  "known offender" for documenting unimplemented behavior, but the plugin system
  shipped and PLUGINS.md was re-validated against it in cycle 1.
- **`tasks/plan.md` and `tasks/todo.md` are orphans**: they describe a landing
  plan whose spec was removed from this repo, so the default SDD filenames point
  at a deliverable that no longer exists here.

Success looks like: every shipped command has a spec whose criteria name the
tests that prove them; the Constitution describes the repo as it is; and the
`tasks/` namespace no longer advertises removed work.

## 2. Non-goals

- Changing any runtime behavior. This module edits documents and adds a docs
  test — no `src/` change.
- Re-specifying the plugin system (already covered by six specs + capability map).
- Re-specifying `tui` / `mcp` beyond their existing scope (the TUI is described
  in the README; `mcp` is covered by `SPEC-mcp-surface.md`).
- Rewriting the Constitution's principles; only the stale factual claim is fixed.

## 3. Design

### Retroactive specs for the shipped commands

One spec per command, in `docs/specs/`, written **as-implemented**:

| Spec | Describes |
|------|-----------|
| `SPEC-organize.md` | scan → match → resolve destination → move, dry-run, confirmation |
| `SPEC-watch.md` | destination-aware ignore, debounce, initial pass, stability |
| `SPEC-undo.md` | history entry shape, restore semantics, overwrite backups |
| `SPEC-dedup.md` | size-prefilter + hash grouping, keep-newest, reversible `--delete` |
| `SPEC-config.md` | config discovery, validation, `init`/`show`/`validate` |

Each follows the repo template: Objective, Non-goals, Behavior (described once,
per Art. VII), and an acceptance-criteria table whose **every row names a
real test file** that currently covers it. Where a criterion is only partially
covered, the row says so rather than inventing a test.

### Constitution correction

Article III's bullet is reframed to state the rule without the stale example:
documentation must mark unimplemented behavior as *Planned — not implemented*,
and the bullet points at the current state (plugin system shipped; `PLUGINS.md`
re-validated). The rule stays; the false "offender" claim goes.

### Archive the orphan `tasks/` files

`tasks/plan.md` and `tasks/todo.md` move to `tasks/archive/` under names that say
what they are — `plan-landing-editorial-revamp.md` /
`todo-landing-editorial-revamp.md` — each prefixed with a **Superseded** header
noting the landing now lives outside this repo. Freeing the unprefixed
`plan.md`/`todo.md` names removes the misleading default while keeping the record
(git history alone is not a usable index for a reader browsing `tasks/`).

### Guarding it

`tests/unit/docs.test.ts` grows checks for: the five specs exist and each links at
least one **existing** test file; the Constitution no longer names PLUGINS.md as
an offender; the orphan files are gone and the archived copies carry a
*Superseded* header; and no *active* spec/task references the removed landing
spec (the archive and this spec are the only allowed mentions).

## 4. Commands

```
Test:  bun run test
Lint:  bun run lint
```

## 5. Testing strategy

- **Unit** (`tests/unit/docs.test.ts` extends): presence + traceability of the
  five specs; Constitution no longer names PLUGINS.md as an offender; the orphan
  files are gone and the archived copies exist.
- **Grep** (in the same test): no reference to `SPEC-landing-editorial-revamp`.

## 6. Acceptance criteria

| ID   | Given | When | Then | Test |
|------|-------|------|------|------|
| AC-1 | `docs/specs/` | read | `SPEC-organize.md`, `SPEC-watch.md`, `SPEC-undo.md`, `SPEC-dedup.md`, `SPEC-config.md` exist | unit (docs) |
| AC-2 | each of the five specs | read | has an Objective, a Non-goals section, and an acceptance-criteria table with ≥1 row naming a real test file | unit (docs) |
| AC-3 | `docs/constitution.md` | read | no longer claims `PLUGINS.md` is unimplemented; the planned-vs-shipped rule remains | unit (docs) |
| AC-4 | `tasks/` | list | `plan.md` and `todo.md` are gone; `tasks/archive/plan-landing-editorial-revamp.md` and `todo-landing-editorial-revamp.md` exist with a Superseded header | unit (docs) |
| AC-5 | active docs (everything under `docs/specs/` except this spec, and `tasks/` except `tasks/archive/`) | grep | no reference to `SPEC-landing-editorial-revamp` (the archive and this spec are the only allowed mentions) | unit (docs) |
| AC-6 | the five specs' AC tables | cross-check | every cited test file exists on disk | unit (docs) |

## 7. Boundaries

- **Always:** a spec criterion names the test that proves it; docs describe only
  what ships.
- **Ask first:** deleting historical task records outright (archive chosen);
  editing an accepted ADR (Constitution Art. III).
- **Never:** invent a test reference; leave the default `tasks/plan.md`/`todo.md`
  pointing at removed work; document unimplemented behavior as shipped.

## 8. Types & docs touched

- New: `docs/specs/SPEC-organize.md`, `SPEC-watch.md`, `SPEC-undo.md`,
  `SPEC-dedup.md`, `SPEC-config.md`, `tasks/archive/*`, `tasks/archive/README.md`.
- Edited: `docs/constitution.md`, `tests/unit/docs.test.ts`.
- Removed: `tasks/plan.md`, `tasks/todo.md` (moved to the archive).
- No `src/` change.

## 9. Open questions

- **OQ-1:** One combined "commands" spec or one per command? Default: **one per
  command** — Art. VII keeps a behavior spec scoped to a single capability.
- **OQ-2:** Archive or delete the orphans? Default: **archive** — the record is
  cheap and the reader loses nothing.
- **OQ-3:** Amend the Constitution outright? It is not an ADR (those are
  immutable), and it carries an explicit amendment clause: "Amendments require a
  new ADR". Default: **record a short ADR** for the amendment and fix the text.

## 10. Changelog

- 2026-09-11 — spec drafted (cycle-2 module `governance`).
- 2026-09-11 — **implemented and verified AC-1…AC-6.** Five retroactive specs
  (`organize`, `watch`, `undo`, `dedup`, `config`), each AC traced to an existing
  test; the Constitution's stale `PLUGINS.md` line replaced via ADR-0009; the
  orphan landing `tasks/plan.md` + `todo.md` archived under `tasks/archive/` with
  *Superseded* headers; `docs.test.ts` guards all of it.
- 2026-09-11 — the new guard immediately caught a real lapse: my own
  `tasks/plan-governance.md` referenced the removed landing spec, which AC-5
  forbids. Reworded. Full suite: 34 files, 320 passed / 1 skipped; branch 91.62%;
  lint 0 errors.
