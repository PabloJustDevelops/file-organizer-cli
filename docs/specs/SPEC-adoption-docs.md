# Spec: adoption-docs

> Status: **Implemented** (2026-09-11; AC-1…AC-11 verified) · Created: 2026-09-11
> Module of: [CAPABILITY-MAP-cli-adoption.md](CAPABILITY-MAP-cli-adoption.md) (`adoption-docs`, depends on `distribution`, `cli-contract`)
> Process: spec-driven-development (Specify phase)

## 1. Objective

The CLI now installs, exits honestly, emits JSON, and mutates safely — but the
repo still speaks only to its author. There is no `CHANGELOG.md`, no
`CONTRIBUTING.md`, the README has no requirements or troubleshooting, and the
TUI is sold as working on Windows where it is not.

Success looks like: a newcomer can evaluate the tool, install it, recover from
the common failure, and contribute a change without leaving the repository —
and no doc claims behavior that does not exist (Constitution Art. III).

## 2. Non-goals

- **MCP documentation** — the server is built but unreachable; documenting it
  now would repeat the PLUGINS.md mistake. Deferred to `mcp-surface` (cycle 2).
- Retroactive specs for existing commands, the stale Constitution line about
  PLUGINS.md, and archiving the orphan `tasks/` landing files → `governance`
  (cycle 2).
- Shell completions, a docs site, translations, or marketing copy.
- Changing any runtime behavior: this module edits documents and adds one docs
  test.

## 3. Design

### README (root) — onboarding-first

Restructure the existing README into the order a newcomer reads it:

1. What it is (one sentence) + badges
2. **Requirements** — Node.js >= 18 (20 LTS recommended), explicitly
3. Install (`npm i -g` / `npx`, scoped name) + from-source
4. Quick start
5. Commands table (must list only implemented commands, `dedup` included)
6. Scripting — `--json` + exit codes
7. Watch mode and duplicate removal (already added by prior modules; keep)
8. Configuration — link to `docs/RULES.md` and `docs/PLUGINS.md`
9. **TUI caveat** — `fo-tui` needs raw mode; on Windows use Windows Terminal /
   Git Bash / WSL, not classic PowerShell/CMD
10. **Troubleshooting** — no config found (exit 1), invalid config, unknown
    template variables, watch flags
11. Development, Governance links, License

### package README — npm-facing subset

`packages/cli/README.md` stays a concise subset for the npm page: install,
quick start, command table, config example, links to the repo docs. It must not
diverge on supported commands.

### CHANGELOG — Keep a Changelog + SemVer

- `CHANGELOG.md` at the repo root, Keep a Changelog headings
  (`Added`/`Changed`/`Fixed`).
- First entry `## [0.1.0] - unreleased` (OQ-1) capturing cycle 1: scoped package
  name + LICENSE + metadata, `--json` and non-zero exit codes, undoable dedup,
  destination-aware watch, E2E harness.
- A short note that entries are added in the same PR as the change
  (Constitution Art. III).

### CONTRIBUTING — compact and operational

`CONTRIBUTING.md` at the repo root: prerequisites (bun), the four commands
(`bun install`, `bun run test`, `bun run lint`, `bun run build`), the
spec-before-code workflow (spec → plan → tasks → implement, linking
`docs/specs/TEMPLATE.md`), where ADRs live and their immutability rule, the CI
gates, and the PR expectations (spec updated in the same PR, tests linked).

### Traceability

One small automated check, `tests/unit/docs.test.ts`, asserts the presence and
basic shape of the docs (files exist; CHANGELOG has Keep a Changelog headings;
README has Requirements/Scripting/Troubleshooting sections) so a required doc
cannot silently disappear.

## 4. Commands

```
Test:   bun run test
Lint:   bun run lint
Build:  bun run build
```

## 5. Testing strategy

- `tests/unit/docs.test.ts` — file presence + heading shapes (cheap, no I/O
  beyond reading repo files).
- Everything else is review: the ACs that say "review" are verified by reading
  the rendered Markdown against the shipped behavior (`fo --help`, `--json`,
  `dedup`, `watch`) — documentation truth is not automatable, but it is
  checkable, and Article III makes it a requirement.

## 6. Acceptance criteria

| ID   | Given | When | Then | Test |
|------|-------|------|------|------|
| AC-1 | README | reading the top | states Node.js >= 18 before the install commands | review |
| AC-2 | README | Commands section | lists only implemented commands, including `fo dedup` | review + `fo --help` |
| AC-3 | README | reading | documents `--json` and the `0`/`1` exit-code contract | review (see `cli-contract` ACs) |
| AC-4 | README | TUI section | states the Windows raw-mode caveat and the `fo organize` fallback | review |
| AC-5 | README | Troubleshooting section | covers no config, invalid config, unknown template variables, watch flags | review |
| AC-6 | root | listing files | `CHANGELOG.md` and `CONTRIBUTING.md` exist | `tests/unit/docs.test.ts` |
| AC-7 | CHANGELOG.md | reading | Keep a Changelog headings; an entry for `0.1.0` with Added/Changed/Fixed | `tests/unit/docs.test.ts` (headings) + review |
| AC-8 | CHANGELOG 0.1.0 entry | reading | covers scoped name, LICENSE, `--json`, undoable dedup, watch fixes, E2E | review |
| AC-9 | CONTRIBUTING.md | reading | gives setup + test/lint/build, the spec-before-code workflow, ADR policy and CI gates | review |
| AC-10 | README | reading | does not advertise unimplemented behavior (no MCP, no completions) | review |
| AC-11 | `packages/cli/README.md` | reading | command table matches the root README's supported set | review |

## 7. Boundaries

- **Always:** docs must match shipped behavior; new user-facing changes update
  the docs in the same change; a linked doc is a promise.
- **Ask first:** adding a docs site or generators; translating the docs;
  documenting MCP before `mcp-surface`.
- **Never:** advertise unimplemented behavior (Constitution Art. III); let the
  package README contradict the root README; add a CHANGELOG entry for behavior
  that has not shipped.

## 8. Types & docs touched

- New: `CHANGELOG.md`, `CONTRIBUTING.md`, `tests/unit/docs.test.ts`.
- Edited: `README.md`, `packages/cli/README.md`.
- No `src/` change.

## 9. Open questions

- **OQ-1:** First entry as `## [0.1.0] - unreleased` or a dated release?
  Default: **unreleased** — the package has not been published yet.
- **OQ-2:** Keep two READMEs (root + npm-facing) or derive one from the other?
  Default: **keep both**; the package README is a concise subset, reviewed by
  hand (only `LICENSE` parity is asserted).
- **OQ-3:** Document the MCP server now? Default: **no** → `mcp-surface`.

## 10. Changelog

- 2026-09-11 — spec drafted (cycle-1 module `adoption-docs`).
- 2026-09-11 — **implemented and verified AC-1…AC-11.** Added `CHANGELOG.md`
  (Keep a Changelog, `[0.1.0] - unreleased`) and `CONTRIBUTING.md` (setup,
  spec-first workflow, ADRs, CI gates); README gained Requirements, a TUI
  Windows caveat, and Troubleshooting. `tests/unit/docs.test.ts` guards file
  presence and headings. Full suite 30 files, 277 passed / 1 skipped; lint 0.
- 2026-09-11 — **cycle 1 complete:** all five capability-map modules
  (`distribution`, `verification`, `cli-contract`, `safe-mutations`,
  `adoption-docs`) implemented and verified. Cycle 2 debt carried in the map:
  `config-integrity`, `governance`, `mcp-surface`.
