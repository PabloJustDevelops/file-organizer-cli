# Release Runbook — file-organizer-cli

> Status: **Pre-release (repo public)** · Created: 2026-09-04
> Complement to [ADR-0005](0005-github-actions-gates.md) (CI gates) and
> `.github/workflows/release.yml`.

## Current posture (private phase)

- The repository went **public** on 2026-09-04; the ruleset
  `main-protection` requires the 5 CI checks (strict) and forbids
  force-push and deletion on `main`.
- `release.yml` only fires on `release: created` — it does nothing on
  branch pushes or tags alone. With no `NPM_TOKEN` secret configured and
  no GitHub Release published, **nothing can reach npm**.
- The npm tarball is already clean: `npm pack --dry-run` (after a build)
  ships 12 files — built `dist/`, `package.json`, `README.md`, `LICENSE` —
  source, tests, tooling, and sourcemaps are excluded. (Updated 2026-09-11:
  the package now carries its own `README.md`/`LICENSE` because npm reads them
  from the package directory, not the repo root.)

## Dry run 0.1.0-rc.1 (2026-09-04) — validated

Executed per this runbook with NO `NPM_TOKEN` configured:

- PR #1 (version bump) merged through the branch-protection ruleset:
  5/5 required checks green, squash-merged. Direct pushes to `main` are
  now rejected by the ruleset — version bumps must go via PR.
- GitHub prerelease `v0.1.0-rc.1` created on the squash commit;
  `release.yml` fired: build matrix ✅ on all 3 OSes, `publish` ❌
  (expected: missing auth). npm registry untouched — zero side effects.

Conclusion: the pipeline is release-ready; the only failing step is the
one gated on credentials, by design.

## Resolved 2026-09-11: npm name (was a blocker)

`npm view file-organizer-cli` → **1.1.0 exists, owned by someone else**. The
package now publishes under the scoped name
**`@pablojustdevs/file-organizer-cli`** with
`publishConfig.access = "public"` (a scoped package defaults to restricted, so
this is required for a public publish). Updated in the same change:

- `packages/cli/package.json` → `name`, metadata
  (`repository`/`homepage`/`bugs`/`author`), `publishConfig.access`
- `packages/cli/README.md` + `packages/cli/LICENSE` (npm includes these only
  from the package directory)
- `docs/PLUGINS.md` install/import snippets
- `README.md` install instructions

The scope name was later corrected to `@pablojustdevs` (2026-09-11): npm only
accepts a scope that matches your username or one of your orgs, and the
publisher's username is `pablojustdevs` — `@pablojustdevelops` is not owned and
would have been rejected at publish. No remaining scope prerequisite: the scope
is the publisher's own username.

## Going public — checklist

1. **Flip visibility**: `gh repo edit <owner>/<repo> --visibility public`
   (or via Settings → Danger Zone). ✅ done 2026-09-04.
2. **Configure npm automation**: add the `NPM_TOKEN` secret
   (repo → Settings → Secrets and variables → Actions).
3. **Name**: ✅ resolved 2026-09-11 — scoped
   `@pablojustdevs/file-organizer-cli` with `publishConfig.access = "public"`.
4. **Version**: bump `packages/cli/package.json` via PR (current
   `0.1.0-rc.1`), e.g. `0.1.0` for the first public release.
5. **Smoke the tarball**: `npm pack --dry-run` in `packages/cli`; install
   the tarball in a scratch project and run `fo --help`. (Verified
   2026-09-04: 14 files, dist only. Re-verified 2026-09-11 post-scoping:
   12 files — `dist/` + `README.md` + `LICENSE`, no sourcemaps.)
6. **Validate first with a prerelease**: repeat the `0.1.0-rc.1` pattern
   once credentials exist — the publish step must succeed against the
   `-rc.1` dist-tag before cutting a real `latest`.
7. **Publish**: create a GitHub **Release** (not just a tag) targeting
   `main` — `release.yml` runs tests + build on 3 OSes, then publishes.
   Keep tests green before publishing; the workflow does not run
   coverage.

## Rollback

- npm: `npm unpublish @pablojustdevs/file-organizer-cli@<version>` within
  the grace window, or `npm deprecate` afterwards.
- GitHub: delete the release; `release.yml` does not retry on its own.
