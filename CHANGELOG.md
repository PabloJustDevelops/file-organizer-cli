# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Entries are added in the same change that ships the behavior
(see [`docs/constitution.md`](docs/constitution.md), Article III).

## [0.1.0] - unreleased

First public release candidate — not yet published to npm.

### Added

- Scoped package identity (`@pablojustdevelops/file-organizer-cli`) with a
  `LICENSE`, npm metadata, and a public `publishConfig`.
- `--json` output for `organize`, `rules list`, and `config show`.
- End-to-end test harness driving the built binary, plus a tarball install smoke
  test.

### Changed

- Failed commands now exit non-zero instead of reporting success.
- `watch` derives its ignores from rule destinations (and excludes them from the
  scan), validates `--debounce`, and runs the initial pass that `--no-initial`
  documents.
- The CLI entry no longer requires the TUI stack (`react`/`ink`); they load
  lazily, and `react` is a declared dependency so `fo-tui` works anywhere.

### Fixed

- `dedup --delete` is reversible: duplicates move to a backup recorded in
  history, so `fo undo` restores them.
- `prepublishOnly` runs the vitest suite instead of Bun's built-in test runner.
- Publishing a prerelease no longer fails for a missing dist-tag.

[0.1.0]: https://github.com/PabloJustDevelops/file-organizer-cli/releases
