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
- The npm tarball is already clean: `npm pack --dry-run` ships 14 files
  (built `dist/`, `package.json`, README) — source, tests, and tooling are
  excluded via `.npmignore`.

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

## Blocker found: npm name taken

`npm view file-organizer-cli` → **1.1.0 exists, owned by someone else**.
Before any real publish, pick a new package name (e.g. a scoped name like
`@<user>/file-organizer-cli`, which needs no name squatting) and update:

- `packages/cli/package.json` → `name`
- `docs/PLUGINS.md` install/import snippets
- `README.md` install instructions
- `peerDependencies` guidance in PLUGINS.md

## Going public — checklist

1. **Flip visibility**: `gh repo edit <owner>/<repo> --visibility public`
   (or via Settings → Danger Zone). ✅ done 2026-09-04.
2. **Configure npm automation**: add the `NPM_TOKEN` secret
   (repo → Settings → Secrets and variables → Actions).
3. **Name**: resolve the npm-name blocker above (scoped name recommended).
4. **Version**: bump `packages/cli/package.json` via PR (current
   `0.1.0-rc.1`), e.g. `0.1.0` for the first public release.
5. **Smoke the tarball**: `npm pack --dry-run` in `packages/cli`; install
   the tarball in a scratch project and run `fo --help`. (Verified
   2026-09-04: 14 files, dist only.)
6. **Validate first with a prerelease**: repeat the `0.1.0-rc.1` pattern
   once credentials exist — the publish step must succeed against the
   `-rc.1` dist-tag before cutting a real `latest`.
7. **Publish**: create a GitHub **Release** (not just a tag) targeting
   `main` — `release.yml` runs tests + build on 3 OSes, then publishes.
   Keep tests green before publishing; the workflow does not run
   coverage.

## Rollback

- npm: `npm unpublish file-organizer-cli@<version>` within the grace
  window, or `npm deprecate` afterwards.
- GitHub: delete the release; `release.yml` does not retry on its own.
