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

- Scoped package identity (`@pablojustdevs/file-organizer-cli`) with a
  `LICENSE`, npm metadata, and a public `publishConfig`.
- `--json` output for `organize`, `rules list`, and `config show`.
- **MCP server is now reachable**: a `file-organizer-mcp` binary and a `fo mcp`
  command, with a consumption guide in [`docs/MCP.md`](docs/MCP.md).
- End-to-end test harness driving the built binary, plus a tarball install smoke
  test.

### Changed

- Failed commands now exit non-zero instead of reporting success.
- **`recursive` now defaults to `false`.** A config that omits it no longer
  descends into subdirectories; opt in per run with `-r` (or set
  `recursive: true`). This matches the flag and the docs, and is the safer
  default.
- `condition.pattern` and every `patterns[]` entry are validated at config
  time, so a bad regex or an empty pattern fails `fo config validate` naming the
  rule — instead of throwing mid-organize.
- The MCP server resolves config through the same core helper as the CLI, so it
  now honors `recursive`, `plugins`, `locale` and `sizeBuckets`, and `add_rule`
  validates before writing.
- `watch` derives its ignores from rule destinations (and excludes them from the
  scan), validates `--debounce`, and runs the initial pass that `--no-initial`
  documents.
- The CLI entry no longer requires the TUI stack (`react`/`ink`); they load
  lazily, and `react` is a declared dependency so `fo-tui` works anywhere.
- **The coverage gate now includes the adapter layer.** `src/cli/**` and
  `src/mcp/**` are measured and enforced at 100% alongside the core, so a
  regression in a command's error path or flag wiring fails CI instead of
  shipping (see [ADR-0010](docs/decisions/0010-coverage-surface-adapter-layer.md)).

### Removed

- The unused `condition.match` field (accepted but never read).
- The unused `copyFile` helper (no callers, not part of the public API).
- Dead branches that could never be reached: the rule-condition `switch` default
  (now exhaustive, so an unknown type fails closed instead of matching
  everything), the nullish fallbacks on `split()[0]` where the value is never
  nullish, and the redundant guard in the watcher's destination walk.
- The unreachable `pluginBaseDir` ternary in `watch` — the no-config branch
  returns earlier, so the `undefined` arm could never run — and its unreachable
  non-`Error` fallback for `--debounce`. Both now use the shared `errorMessage`
  helper.

### Fixed

- `dedup --delete` is reversible: duplicates move to a backup recorded in
  history, so `fo undo` restores them.
- `prepublishOnly` runs the vitest suite instead of Bun's built-in test runner.
- Publishing a prerelease no longer fails for a missing dist-tag.
- The move fallback that re-homes a file under a unique name now actually
  triggers: `fs-extra`'s "dest already exists." error carries no `code`, so the
  `EEXIST`/`EPERM` check never matched and the run failed instead of recovering.
- `organize()` honors `config.conflictResolution`. Only the flat option was
  read, so library callers passing a config silently got `rename` while the
  CLI/MCP adapters (via `buildOrganizeOptions`) got the configured resolution.
- One caught-error site still inlined its own `instanceof Error` check, which
  shadowed the shared helper and left the non-`Error` fallback unreachable.

[0.1.0]: https://github.com/PabloJustDevelops/file-organizer-cli/releases
