# @pablojustdevs/file-organizer-cli

Rule-based file organization from the terminal. Define patterns in YAML — `fo`
does the rest.

## Install

```bash
npm install -g @pablojustdevs/file-organizer-cli
```

Or run it without installing:

```bash
npx @pablojustdevs/file-organizer-cli --help
```

Requires Node.js **>= 18** (20 LTS recommended). The installed binaries are
`fo`, `file-organizer`, and `fo-tui`.

## Quick Start

```bash
fo config init                       # create .file-organizer.yaml
fo organize ~/Downloads --dry-run    # preview every move
fo organize ~/Downloads              # apply
fo watch ~/Downloads                 # auto-organize new files
```

## Commands

| Command | Description |
|---------|-------------|
| `fo organize [source]` | Organize files in a directory |
| `fo watch [source]` | Watch and auto-organize new files |
| `fo rules list` | List configured rules |
| `fo rules add` | Add a rule interactively |
| `fo rules remove` | Remove a rule |
| `fo undo` | Undo the last operation |
| `fo undo --list` | Show operation history |
| `fo config init` | Create a config file |
| `fo config show` | Display current config |
| `fo config validate` | Validate config syntax |
| `fo dedup [source]` | Find (and optionally delete) duplicate files |
| `fo-tui [source]` | Open the interactive TUI |

Machine-readable output: `organize`, `rules list`, and `config show` accept
`--json` (pure JSON on stdout, no prompts). Exit codes are `0` on success and
`1` on any failure.

```bash
fo organize ~/Downloads --dry-run --json | jq '.moved | length'
```

`fo dedup --delete` is undoable: duplicates move to a backup and `fo undo`
restores them. `fo watch` runs an initial pass on start (`--no-initial` to
skip) and keeps destination folders out of its events and scans.

## Configuration

```yaml
rules:
  - name: Images
    patterns: ["*.jpg", "*.png", "*.gif"]
    destination: "./images/{year}/{month}"

  - name: Documents
    patterns: ["*.pdf", "*.docx", "*.xlsx"]
    destination: "./documents/{type}"

conflictResolution: rename  # rename | overwrite | skip | newest
```

Destination templates support `{year}`, `{month}`, `{type}`, `{extension}`,
`{name}`, `{sizeBucket}`, and more. Full reference:
[rules guide](https://github.com/PabloJustDevelops/file-organizer-cli/blob/main/docs/RULES.md).

## Plugins

Extend `fo` with hooks, custom rules, and file transforms — a plugin is a plain
object with a default export. See the
[plugins guide](https://github.com/PabloJustDevelops/file-organizer-cli/blob/main/docs/PLUGINS.md).

## Documentation

- [Project README](https://github.com/PabloJustDevelops/file-organizer-cli#readme)
- [Rules & config reference](https://github.com/PabloJustDevelops/file-organizer-cli/blob/main/docs/RULES.md)
- [Plugins guide](https://github.com/PabloJustDevelops/file-organizer-cli/blob/main/docs/PLUGINS.md)

## License

MIT
