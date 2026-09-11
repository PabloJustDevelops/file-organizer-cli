# Spec: mcp-surface

> Status: **Implemented** (2026-09-11; AC-1…AC-14 verified) · Created: 2026-09-11
> Module of: [CAPABILITY-MAP-cli-cycle2.md](CAPABILITY-MAP-cli-cycle2.md) (`mcp-surface`, depends on `distribution`, `cli-contract`, `config-integrity`)
> Process: spec-driven-development (Specify phase)

## 1. Objective

Make the MCP server **reachable and honest**. Today `dist/mcp/server.js` is built
and shipped, but:

- **Nothing can invoke it.** There is no `bin`, no `fo mcp` — a user cannot
  configure it in an MCP client without guessing a path inside the tarball.
- **Importing it starts it.** `main()` runs at module top level, so the module
  has an import-time side effect (it cannot be reused or tested without spawning
  a server).
- **It re-implements instead of reusing the core.** `organize_files` ignores
  `config.recursive`, `config.plugins`, `config.locale` and
  `config.sizeBuckets`; `preview_organization` hardcodes `recursive: true`;
  `add_rule` writes rules **without validation**, so MCP can persist a config
  that `fo config validate` would reject.

Success looks like: a user copies one JSON block into their MCP client config and
`fo`'s tools work, with the same behavior the CLI has — same defaults, same
plugins, same validation.

## 2. Non-goals

- New MCP tools or resources; the tool set stays as-is.
- Stage-only / trusted-publishing work, or anything in the npm publish path.
- Auth for the MCP server — it runs locally over stdio.
- Rewriting the MCP SDK usage; the protocol plumbing stays.

## 3. Design

### Reachable two ways

- **`file-organizer-mcp` bin** → new `src/mcp/index.ts`, which calls
  `startMcpServer()`. This is what MCP client configs point at.
- **`fo mcp` command** → a thin `src/cli/commands/mcp.ts` that starts the same
  server. Convenient when `fo` is already installed/linked.

### `src/mcp/server.ts` becomes side-effect-free

- Export `createMcpServer()` (pure construction + handlers) and
  `startMcpServer()` (connect a stdio transport). Remove the top-level `main()`
  call so importing the module never starts a server.
- **stdout discipline:** stdio MCP owns stdout for protocol frames, so the
  `fo mcp` command sets the logger to `error` and prints its one notice to
  **stderr**. Any info-level CLI logging would corrupt the stream.
- Server `version` comes from `package.json` (via `createRequire`), not a
  hardcoded `'0.1.0'`.

### Parity via a shared options builder

Both adapters must resolve config the same way (Constitution Art. II/VII:
implement once in the core, surface in each adapter). Add a pure
`buildOrganizeOptions(config, overrides)` in `src/core/organize-options.ts`:

- Resolves `dryRun`, `recursive`, `includeHidden`, `conflictResolution` from
  overrides → config → defaults.
- Passes the whole `config` through, so `organize()` picks up `rules`,
  `locale`, `sizeBuckets` and `plugins` from the single source of truth.
- Carries `pluginBaseDir` when given (config-relative plugin resolution).

`organize.ts` (CLI) and `handleToolCall` (MCP) both use it, so a fixed default
fixes both adapters at once.

### `add_rule` validates before writing

`add_rule` runs the candidate through `validateRuleCore` (the same function the
YAML loader uses) and returns an MCP error on failure, so an agent cannot write
a config that the CLI would reject.

### Documented consumption

`docs/MCP.md` with the exact client config (`command` + `args`), the tool list,
and the safety note that `organize_files` defaults to `dryRun: true`. A short
pointer from `README.md`.

## 4. Commands

```
Build:   bun run build
Test:    bun run test
Lint:    bun run lint
Manual:  node packages/cli/dist/mcp/index.js     # speaks MCP over stdio
         fo mcp                                   # same server via the CLI
```

## 5. Testing strategy

- **Unit/integration** (`tests/integration/mcp-handlers.test.ts` extends):
  parity — `recursive`/`locale`/`sizeBuckets`/`plugins` come from config;
  `add_rule` rejects an invalid rule.
- **Unit** (`tests/unit/organize-options.test.ts`): the resolver's precedence
  (override > config > default), including the `recursive` default of `false`.
- **E2E** (`tests/e2e/mcp.test.ts`): spawn the **built** `dist/mcp/index.js`,
  perform the JSON-RPC handshake (initialize → initialized → tools/list) and
  assert the tool names; assert the process writes no non-JSON data to stdout.
- **Packaging** (existing `packaging.test.ts` extends): `dist/mcp/index.js`
  ships in the tarball.

## 6. Acceptance criteria

| ID   | Given | When | Then | Test |
|------|-------|------|------|------|
| AC-1 | a completed build | `dist/mcp/index.js` | exists and is listed in `package.json` `bin` as `file-organizer-mcp` | packaging test |
| AC-2 | the built MCP entry | spawn it and send `initialize` + `tools/list` | stdout carries valid JSON-RPC; the five tools are listed | e2e |
| AC-3 | the MCP entry | inspect stdout of a handshake | no non-JSON lines (no logging leaks into the protocol stream) | e2e |
| AC-4 | `fo mcp` | `.command('mcp')` registered | the command exists and its help describes the stdio server | e2e (`fo --help`) |
| AC-5 | a config with `recursive: true` | MCP `organize_files` without `recursive` | the run scans recursively (config honored) | integration (mcp-handlers) |
| AC-6 | a config with `plugins: ['./p.js']` | MCP `organize_files` | the plugin loads (no `PluginNotFoundError` when the file exists) | integration (mcp-handlers) |
| AC-7 | a config with `locale: 'es-ES'` | MCP `organize_files` | `{monthName}` resolves in Spanish | integration (mcp-handlers) |
| AC-8 | a config with custom `sizeBuckets` | MCP `organize_files` | `{sizeBucket}` uses the custom thresholds | integration (mcp-handlers) |
| AC-9 | `add_rule` with an invalid rule (no patterns / bad regex) | `handleToolCall('add_rule', …)` | returns an error; the config file is unchanged | integration (mcp-handlers) |
| AC-10 | a valid `add_rule` | `handleToolCall('add_rule', …)` | the rule is persisted and validates | integration (mcp-handlers) |
| AC-11 | `buildOrganizeOptions` | override vs config vs default | override wins, then config, then default (`recursive` default `false`) | unit |
| AC-12 | `src/mcp/server.ts` | import it | no server starts, no stdout output (side-effect-free) | e2e (mcp) |
| AC-13 | the MCP server info | `initialize` result | `serverInfo.version` equals `packages/cli/package.json` version | e2e |
| AC-14 | `docs/MCP.md` | read | documents the client config, the tools, and the `dryRun` default | docs test |

## 7. Boundaries

- **Always:** keep the MCP adapter thin over the core; validate before writing
  config; keep stdout clean on a stdio server.
- **Ask first:** adding new MCP tools; changing an existing tool's schema; a
  network/HTTP transport.
- **Never:** let an adapter resolve config differently from another (fix in the
  core); write a config the loader would reject; log to stdout in `fo mcp`.

## 8. Types & docs touched

- New: `src/mcp/index.ts`, `src/cli/commands/mcp.ts`, `src/core/organize-options.ts`,
  `docs/MCP.md`, `tests/unit/organize-options.test.ts`, `tests/e2e/mcp.test.ts`.
- Edited: `src/mcp/server.ts` (side-effect-free + version + parity),
  `src/cli/index.ts` (register `mcp`), `src/cli/commands/organize.ts` (use the
  shared builder), `tsup.config.ts` (+`mcp/index` entry), `packages/cli/package.json`
  (+bin), `README.md`, `tests/integration/mcp-handlers.test.ts`,
  `tests/integration/packaging.test.ts`.

## 9. Open questions

- **OQ-1:** One entrypoint or two? Default: **both** — the bin is the standard MCP
  client target; `fo mcp` helps when `fo` is linked.
- **OQ-2:** Extract `buildOrganizeOptions` or duplicate resolution per adapter?
  Default: **extract** — Art. II forbids adapters reimplementing core behavior.
- **OQ-3:** Should `organize_files` default `dryRun` to `false`? Default: **no** —
  `true` is the safe default for an agent-driven tool.

## 10. Changelog

- 2026-09-11 — spec drafted (cycle-2 module `mcp-surface`).
- 2026-09-11 — **implemented and verified AC-1…AC-14.** Added the
  `file-organizer-mcp` bin and the `fo mcp` command (lazy import, stdout kept
  clean); `src/mcp/server.ts` is now side-effect-free with `createMcpServer()` /
  `startMcpServer()` and reports the package version; extracted
  `buildOrganizeOptions` so CLI and MCP resolve config identically; `add_rule`
  validates before writing; `docs/MCP.md` documents consumption.
- 2026-09-11 — parity gaps closed by sharing the core helper: the MCP now honors
  config `recursive`, `plugins`, `locale` and `sizeBuckets` (previously ignored),
  and `preview_organization` no longer hardcodes `recursive: true`.
- 2026-09-11 — full suite: 34 files, 315 passed / 1 skipped; coverage branch
  91.59%; lint 0 errors. E2E drives the built entry with a real JSON-RPC
  handshake.
