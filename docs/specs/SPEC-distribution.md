# Spec: distribution

> Status: **Implemented** (2026-09-11; AC-1…AC-11 verified) · Created: 2026-09-11
> Module of: [CAPABILITY-MAP-cli-adoption.md](CAPABILITY-MAP-cli-adoption.md) (`distribution`, depends on —)
> Process: spec-driven-development (Specify phase)

## 1. Objective

Make `fo` installable and identifiable by anyone who does not have this repo
cloned. Today the only documented path is `git clone` + `bun install -g
./packages/cli`, and the npm package name `file-organizer-cli` is already owned
by a third party, so `npm i -g` / `npx` cannot work.

Success looks like: a stranger runs one `npm i -g @pablojustdevelops/file-organizer-cli`
(or `npx`), gets a working `fo`, and the published tarball carries a license, a
README, real types, and no source/tests. The package is publishable by CI with
no manual flags.

## 2. Non-goals

- Actually publishing to npm / configuring `NPM_TOKEN` (human step in the
  release runbook, out of code scope).
- Claiming the npm scope/org (human, external to the repo).
- The MCP entrypoint (`dist/mcp/server.js` is built but unreachable) → cycle 2
  `mcp-surface`.
- Shell completions and `--json` output → `cli-contract` / cycle 2.
- Changing the release process model (GitHub Release → `release.yml` stays).

## 3. Design

### Identity

- Package name becomes scoped: `@pablojustdevelops/file-organizer-cli`
  (OQ-1 resolved). The bin names stay `fo`, `file-organizer`, `fo-tui` — only
  the package name changes, so every existing command keeps working.
- A single source of truth for the name: `packages/cli/package.json`. Docs,
  README, `docs/PLUGINS.md` snippets, and the release runbook reference it; no
  doc may keep advertising the unscoped install target.

### Legal + metadata

- Add `LICENSE` at the repository root (MIT, matching `package.json`), with a
  correct copyright holder (OQ-2).
- `packages/cli/package.json` gains: `repository`, `homepage`, `bugs`,
  `author` (with URL), `license` (present), `engines` (kept), and
  `publishConfig.access = "public"`.

### Publishability

- `publishConfig.access = "public"` makes the scoped publish work without
  `--access public`; `release.yml`'s `npm publish` then needs no flag change
  (AC-8). This is required — a scoped package defaults to restricted access.
- Fix `prepublishOnly`: it currently runs `bun test`, which invokes **Bun's**
  built-in test runner, not the project's vitest suite. It must run the real
  suite (`bun run test`).

### Tarball hygiene

- The package declares `files: ["dist/**/*.js", "dist/**/*.d.ts"]`; `dist/` is
  produced by `tsup` (`cli/index`, `mcp/server`, `tui/index`, `index` + `dts`).
  Explicit patterns — not a bare `dist` — are required: **npm cannot exclude
  files matched by `files` via `.npmignore`**, so a `dist` entry force-ships the
  `*.js.map` files.
- npm always includes `package.json`, `README.md`, and `LICENSE` — but only from
  the **package directory**, not the repo root. `packages/cli/` therefore
  carries its own `README.md` (npm-facing) and `LICENSE` (kept identical to the
  root copy, asserted by a test).
- Verified 2026-09-11 with a working toolchain:
  - **Without a build**: `npm pack --dry-run` ships exactly 1 file
    (`package.json`) — `dist/` is absent.
  - **After a build**: it ships 14 files — 13 under `dist/` (including 4
    `*.js.map`) plus `package.json` — still **no `README` and no `LICENSE`**
    because neither exists yet.
  Post-change it must contain the `dist/` outputs **plus** `README.md` and
  `LICENSE`, and no `src/`, `tests/`, or `tools/`.
- Sourcemaps: `tsup` emits `*.js.map`; shipping them is optional (OQ-3).

### Install surface

- README "Installation" is rewritten around the scoped name, with `npm i -g`
  and `npx @pablojustdevelops/file-organizer-cli` forms, Node requirement, and no
  clone-based path as the primary route.

## 4. Commands

```
Build:      bun run build            # tsup, from packages/cli
Test:       bun run test             # vitest run
Lint:       bun run lint             # oxlint + tsc --noEmit
Pack check: npm pack --dry-run       # from packages/cli, after build
Install:    npm install -g ./pablojustdevelops-file-organizer-cli-<version>.tgz
```

## 5. Testing strategy

- **Packaging check** (automated, `verification` module): run
  `npm pack --dry-run --json` after a build and assert the file set — required
  entries present, forbidden entries absent. This is the executable form of
  AC-5.
- **Install smoke** (automated where possible, else scripted): install the
  produced tarball into a scratch prefix and assert `fo --help` / `fo --version`
  exit 0 (AC-6, AC-10).
- **Metadata assertions**: a small test reads `packages/cli/package.json` and
  asserts the required fields (AC-2…AC-4) — cheap, no I/O beyond the file.
- Manual: `npm publish --dry-run` with a local `.npmrc` to confirm a scoped
  public publish would be accepted (AC-8), without credentials.

## 6. Acceptance criteria

| ID   | Given | When | Then | Test |
|------|-------|------|------|------|
| AC-1 | repo root and `packages/cli/` | listing files | `LICENSE` exists in both, is MIT, names the copyright holder, and both copies are identical | metadata test |
| AC-2 | `packages/cli/package.json` | reading `name` | equals `@pablojustdevelops/file-organizer-cli`; no doc references the unscoped install target | metadata test + grep |
| AC-3 | `packages/cli/package.json` | inspecting metadata | `repository`, `homepage`, `bugs`, `author`, `license`, `engines`, `keywords` all present | metadata test |
| AC-4 | `packages/cli/package.json` | inspecting publish config | `publishConfig.access === "public"` and `bin` still maps `fo`, `file-organizer`, `fo-tui` | metadata test |
| AC-5 | a completed build | `npm pack --dry-run --json` | includes `dist/cli/index.js`, `dist/mcp/server.js`, `dist/tui/index.js`, `dist/index.js`, `dist/index.d.ts`, `package.json`, `README.md`, `LICENSE`; excludes `src/`, `tests/`, `tools/`, and `*.map` | packaging test |
| AC-6 | the packed tarball | `npm install -g <tarball>` in a scratch prefix | `fo`, `file-organizer`, `fo-tui` are executable; `fo --help` exits 0 | install smoke |
| AC-7 | `packages/cli/package.json` | inspecting `prepublishOnly` | runs the vitest suite (`bun run test`), not `bun test` | metadata test |
| AC-8 | a scoped `publishConfig.access = "public"` | `npm publish --dry-run` | publish is accepted without `--access public` | manual |
| AC-9 | README | reading Installation | documents scoped `npm i -g` and `npx` forms; does not require cloning | docs review |
| AC-10 | built CLI | `fo --version` | prints `packages/cli/package.json` version | install smoke |
| AC-11 | built `dist/index.js` | importing it | exposes the library entry with zero side effects (unchanged, ADR-0007) | `tests/unit/public-api.test.ts` |

## 7. Boundaries

- **Always:** ship `LICENSE` + metadata before any publish; verify the tarball
  *after* a build; keep one source of truth for the package name.
- **Ask first:** changing the package name again; bumping `engines.node`;
  adding `--provenance` or other publish flags; publishing to npm.
- **Never:** publish without a `LICENSE`; ship `src/`, `tests/`, or `tools/` in
  the tarball; leave an unscoped install instruction in any doc.

## 8. Types & docs touched

- New: `LICENSE`, and (cycle-1 docs) `CHANGELOG.md`, `CONTRIBUTING.md` via
  `adoption-docs`.
- `packages/cli/package.json`, `.github/workflows/release.yml` (publish step now
  derives a dist-tag from the version), `README.md`, `docs/PLUGINS.md`,
  `docs/decisions/0008-release-runbook.md`.
- `src/cli/commands/tui.ts` (defect fix from `verification`: lazy TUI import) and
  `packages/cli/package.json` (`react` as a direct dependency).
- No `src/types/index.ts` change: this module touches no runtime contract.

## 9. Open questions

- **OQ-1:** ~~Exact npm scope/handle~~ **Resolved: `@pablojustdevelops`.** The
  scope must be owned on npm before publish (human step).
- **OQ-2:** Copyright holder line for `LICENSE` (full name or handle?). Default:
  match `package.json` `author`.
- **OQ-3:** Ship sourcemaps in the tarball? Default: **no** — exclude `*.map`,
  keep the package lean; maps remain available in the repo build for debugging.
  (Today 4 `*.js.map` files, ~478 KB compressed-inflating, ship by default.)
- **OQ-4:** First public version: keep `0.1.0-rc.1` or promote to `0.1.0`?
  Default: promote to `0.1.0` on first public publish.
- **OQ-5:** Bump `engines.node` from `>=18` (EOL) to `>=20`? Default: keep
  `>=18` for reach, document 20 LTS as recommended.

## 10. Changelog

- 2026-09-11 — spec drafted (cycle-1 module `distribution`).
- 2026-09-11 — OQ-1 resolved (`@pablojustdevelops`); tarball evidence measured
  (1 file without build → 14 files post-build, no LICENSE/README, maps shipped);
  baseline green with a restored toolchain: build ✅, `bun run test` → 236
  passed / 1 skipped, `bun run lint` → 0 errors.
- 2026-09-11 — **implemented and verified AC-1…AC-11.** Findings folded in:
  npm ignores `.npmignore` for anything matched by `files` (hence explicit
  `dist/**/*.js` + `dist/**/*.d.ts` patterns and no maps); npm reads
  README/LICENSE from the package directory, so `packages/cli/` carries its own
  copies (parity asserted). Post-change tarball = 12 files.
- 2026-09-11 — release blocker found and fixed: `npm publish` refuses a
  prerelease without `--tag`, so `release.yml` would have failed the runbook's
  `-rc.1` validation. The publish step now derives the dist-tag from the
  version (`rc` for `0.1.0-rc.1`, `latest` otherwise).
  Verified: `npm publish --dry-run --tag rc` → exit 0, *"with tag rc and public
  access"*; install smoke in an isolated prefix → `fo`/`file-organizer`/`fo-tui`
  on PATH, `fo --version` = `0.1.0-rc.1`, `fo --help` exit 0 (AC-6/AC-10).
  Automation of the install smoke belongs to `verification`.
- 2026-09-11 — defect found by the `verification` harness and fixed here: the
  CLI entry (`dist/cli/index.js`) **statically imported `react`/`ink`** because
  it registers `tuiCommand`, so under bun's isolated `node_modules` `react` is
  not resolvable and `fo --version` aborted with `ERR_MODULE_NOT_FOUND`. AC-6
  only "passed" manually thanks to npm auto-installing ink's peer `react`.
  Fix: `tui.ts` lazily `import()`s the TUI stack, and `react` is declared as a
  direct dependency so `fo-tui` works on any package manager. Re-verified: E2E
  install smoke green under bun.
