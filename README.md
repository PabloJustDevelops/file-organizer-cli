# file-organizer-cli

[![CI](https://github.com/PabloJustDevelops/file-organizer-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/PabloJustDevelops/file-organizer-cli/actions/workflows/ci.yml)

Rule-based file organization from the terminal. Define patterns in YAML — `fo` does the rest.

## Features

- **Rule-based organization** — Define patterns and destinations in YAML
- **Dynamic variables** — `{year}`, `{month}`, `{extension}`, `{type}` build paths from file metadata
- **Dry-run mode** — Preview every move before it happens
- **Watch mode** — Monitor a folder and organize new files automatically
- **Undo** — Revert the last operation (persists between sessions)
- **Conflict handling** — `rename`, `overwrite`, `skip`, or `newest`
- **Conditions** — Filter by size, date, regex, or extension
- **Plugins** — Hooks, custom rules, and file transforms, with error isolation
- **TUI** — Interactive terminal interface for organizing files

## Requirements

- **Node.js >= 18** (20 LTS recommended). This installs the `fo`,
  `file-organizer`, and `fo-tui` binaries.

## Installation

```bash
npm install -g @pablojustdevs/file-organizer-cli
```

Or run it without installing:

```bash
npx @pablojustdevs/file-organizer-cli --help
```

**From source (development):**

Requires Node.js 22.12+ locally (see `.nvmrc`) — the test suite runs on
Vitest 5, which needs that Node baseline; this does not affect the published
package's `engines.node` (`>=18`).

```bash
git clone https://github.com/PabloJustDevelops/file-organizer-cli
cd file-organizer-cli
bun install
bun run build:cli
bun install -g ./packages/cli
```

## Quick Start

```bash
# Create a config file
fo config init

# Preview what would happen
fo organize ~/Downloads --dry-run

# Organize for real
fo organize ~/Downloads

# Watch a folder
fo watch ~/Downloads
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
| `fo dedup [source]` | Find duplicates; `--delete` moves them to a restorable backup |
| `fo-tui [source]` | Open interactive TUI |
| `fo mcp` | Run the MCP server over stdio (for MCP clients) |

### Interactive TUI

`fo-tui` needs a terminal with raw-mode support. On Windows use Windows
Terminal, Git Bash, or WSL — classic PowerShell and CMD are not supported; use
`fo organize` there instead.

### Machine-readable output

`organize`, `rules list`, and `config show` accept `--json`:

```bash
fo organize ~/Downloads --dry-run --json | jq '.moved | length'
fo rules list --json
fo config show --json
```

In `--json` mode stdout carries **only** the JSON payload (logs go to stderr)
and the command never prompts. Exit codes are `0` on success and `1` on any
failure, including a missing or invalid config.

### Watch mode

`fo watch` organizes what is already in the folder when it starts (disable with
`--no-initial`), then re-runs as files arrive. `--debounce <ms>` controls the
settle window. Destination folders are excluded from both events and scans, so
custom destinations never make the watcher fight its own moves.

### Removing duplicates

`fo dedup --delete` does not really delete: duplicates move to a backup and are
recorded in history, so `fo undo` restores them.

## Configuration

`.file-organizer.yaml`:

```yaml
rules:
  - name: Images
    patterns: ["*.jpg", "*.png", "*.gif"]
    destination: "./images/{year}/{month}"

  - name: Documents
    patterns: ["*.pdf", "*.docx", "*.xlsx"]
    destination: "./documents/{type}"

  - name: Videos
    patterns: ["*.mp4", "*.mkv", "*.mov"]
    destination: "./videos/{year}"

conflictResolution: rename  # rename | overwrite | skip | newest

plugins:                     # optional; loaded before any file is touched
  - ./my-plugin.js           # local, relative to this config file
  - file-organizer-compress  # npm package
```

### Destination Variables

Placeholders are **case-insensitive** (`{Year}` works like `{year}`). Unknown
placeholders are left as literal text and `fo` warns about them at organize
time (and `fo config validate` reports them).

| Variable | Example | Description |
|----------|---------|-------------|
| `{year}` | `2026` | File modification year |
| `{month}` | `09` | Modification month (01-12) |
| `{monthName}` | `septiembre` | Month name — honors the `locale` config |
| `{day}` | `15` | Modification day |
| `{year-month}` / `{yearMonth}` | `2026-09` | Year-month compound |
| `{extension}` | `jpg` | File extension |
| `{name}` | `photo` | Filename without extension |
| `{type}` | `image` | File category (image, document, video, etc.) |
| `{parent}` | `inbox` | Name of the subfolder the file was scanned from |
| `{sizeBucket}` | `medium` | `tiny` <1KB, `small` <100KB, `medium` <1MB, `large` <100MB, `huge` ≥ |
| `{now:year-month}` | `2026-09` | **Run-time** date (not file date); accepts any date format: `year`, `month`, `monthName`, `day`, `year-month` |
| `{match}` / `{match1}` | `project42` | Capture group from the rule's regex condition |

### Locale

```yaml
locale: es-ES   # BCP-47 tag; affects {monthName} and {now:monthName}
```

Invalid tags are rejected by `fo config validate`.

### Conflict Resolution

| Strategy | Behavior |
|----------|----------|
| `rename` | Adds suffix: `file (1).jpg` |
| `overwrite` | Replaces existing file |
| `skip` | Leaves conflicting files in place |
| `newest` | Keeps the most recently modified |

## Plugins

Extend `fo` with your own JavaScript — a plugin is a plain object with a
default export (no imports required):

```javascript
// my-plugin.js
export default {
  name: 'my-plugin',
  version: '1.0.0',

  // Lifecycle hooks
  async beforeOrganize(context) {
    console.log(`Organizing ${context.files.length} files...`);
  },
  async afterOrganize(context) {
    console.log(`Moved ${context.results.moved.length} files!`);
  },

  // Extra matching rules (validated like YAML rules)
  customRules() {
    return [{ name: 'Logs', patterns: ['*.log'], destination: './logs' }];
  },

  // Decision-layer transform (e.g. remap extensions so rules route them)
  async transform(file) {
    return { ...file, extension: file.extension === 'log' ? 'txt' : file.extension };
  },
};
```

Register it in your config and it loads before any file is touched:

```yaml
plugins:
  - ./my-plugin.js                 # local path, relative to this config
  - file-organizer-compress        # npm package
```

A failing plugin never aborts a run: hook, rule, and transform errors are
captured per item and reported in the result (`pluginErrors`). Full guide
with the complete API, semantics, and publishing steps:
**[docs/PLUGINS.md](docs/PLUGINS.md)**.

## Project Structure

```
packages/
└── cli/          # The CLI tool
    ├── src/      # Source code
    ├── dist/     # Build output
    └── tests/    # Unit, integration & e2e tests
```

## Troubleshooting

- **`No config file found` (exit 1)** — run `fo config init` in the directory you
  want to organize, or pass `-c <path>`.
- **`Invalid configuration: …`** — `fo config validate` names the offending rule
  and field.
- **Unknown template variable warnings** — a token like `{quartal}` is left
  literal; see [`docs/RULES.md`](docs/RULES.md) for the supported variables.
- **Watch behaves unexpectedly** — `--debounce <ms>` sets the settle window,
  `--no-initial` skips the initial pass, and destination folders are never
  re-scanned.
- **A command failed but printed nothing useful** — a non-zero exit code means it
  did not do what you asked; `--json` prints `{ "error": … }` for scripts.

## Development

```bash
# Install
bun install

# Run tests (vitest)
bun run test

# Build CLI
bun run build:cli

# Lint (oxlint + typecheck)
bun run lint
```

## Governance & Spec-Driven Development

How this project is built — read before adding a feature:

| Doc | Purpose |
|-----|---------|
| [`docs/constitution.md`](docs/constitution.md) | Non-negotiable principles (safety, pure core, spec-before-code) |
| [`docs/specs/`](docs/specs/) | Feature specs with testable acceptance criteria · [template](docs/specs/TEMPLATE.md) |
| [`docs/decisions/`](docs/decisions/) | Architecture Decision Records — how and why, immutable once accepted |
| [`docs/RULES.md`](docs/RULES.md) | Rules engine & config reference |
| [`docs/PLUGINS.md`](docs/PLUGINS.md) | Plugin system — hooks, rules, transforms, publishing |
| [`docs/MCP.md`](docs/MCP.md) | MCP server — client config and tools |

Workflow for user-facing behavior: **spec (`docs/specs/<feature>.md`) → plan → tasks → implement → tests linked from the spec's acceptance criteria.**

## License

MIT
