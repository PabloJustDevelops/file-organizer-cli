# Release Runbook — file-organizer-cli

> Status: **Pre-release (private repo)** · Created: 2026-09-04
> Complement to [ADR-0005](0005-github-actions-gates.md) (CI gates) and
> `.github/workflows/release.yml`.

## Current posture (private phase)

- The repository is **private** while the plugin system stabilizes.
- `release.yml` only fires on `release: created` — it does nothing on
  branch pushes or tags alone. With no `NPM_TOKEN` secret configured and
  no GitHub Release published, **nothing can reach npm**.
- The npm tarball is already clean: `npm pack --dry-run` ships 14 files
  (built `dist/`, `package.json`, README) — source, tests, and tooling are
  excluded via `.npmignore`.

## Going public — checklist

1. **Flip visibility**: `gh repo edit <owner>/<repo> --visibility public`
   (or via Settings → Danger Zone).
2. **Configure npm automation**: add the `NPM_TOKEN` secret
   (repo → Settings → Secrets and variables → Actions).
3. **Version**: bump `packages/cli/package.json` (current `0.1.0`), e.g.
   `0.1.0` first public release.
4. **Smoke the tarball**: `npm pack --dry-run` in `packages/cli`; install
   the tarball in a scratch project and run `fo --help`.
5. **Publish**: create a GitHub **Release** (not just a tag) targeting
   `main` — `release.yml` runs tests + build on 3 OSes, then publishes.
   Keep `bun test` green before publishing; the workflow does not run
   coverage.

## Rollback

- npm: `npm unpublish file-organizer-cli@<version>` within the grace
  window, or `npm deprecate` afterwards.
- GitHub: delete the release; `release.yml` does not retry on its own.
