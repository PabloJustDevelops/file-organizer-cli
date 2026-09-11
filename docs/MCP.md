# MCP Server Guide

`file-organizer-cli` ships a [Model Context Protocol](https://modelcontextprotocol.io)
server so an MCP client (Claude Desktop, Cursor, …) can organize files through
the same engine the `fo` CLI uses.

## Two ways to start it

Both start the identical server over **stdio**:

```bash
file-organizer-mcp     # the dedicated binary (what client configs point at)
fo mcp                 # same server via the CLI
```

## Client configuration

Point your MCP client at the binary. Example (`claude_desktop_config.json` /
Cursor `mcp.json`):

```json
{
  "mcpServers": {
    "file-organizer": {
      "command": "npx",
      "args": ["-y", "@pablojustdevs/file-organizer-cli", "mcp"]
    }
  }
}
```

If you installed the package globally, you can call the binary directly:

```json
{
  "mcpServers": {
    "file-organizer": {
      "command": "file-organizer-mcp"
    }
  }
}
```

The server reads `.file-organizer.yaml` from the directory being organized (or
from `config` when you pass it), so it behaves exactly like `fo organize`.

## Tools

| Tool | What it does | Safety |
|------|--------------|--------|
| `organize_files` | Organize a directory using the config | **`dryRun` defaults to `true`** — pass `dryRun: false` to actually move files |
| `preview_organization` | Show what would move, without moving | Read-only |
| `list_rules` | List the configured rules | Read-only |
| `add_rule` | Add a rule to the config | Validates before writing; rejects an invalid rule |
| `undo_last` | Undo the last organize | Restores from the history backup |

## Behavior notes

- **Config is honored the same way as the CLI.** `recursive`, `plugins`,
  `locale` and `sizeBuckets` from `.file-organizer.yaml` all apply — both
  adapters resolve options through the same core helper, so there is no drift.
- **`recursive` defaults to `false`** (as in the CLI); a config that sets
  `recursive: true` is respected.
- **Rules are validated on write.** `add_rule` runs the same validation as the
  YAML loader, so the MCP surface can never persist a config that
  `fo config validate` would reject.
- **History lives in `~/.file-organizer`**, shared with the CLI — `undo_last`
  reverts the most recent operation regardless of which adapter ran it.
