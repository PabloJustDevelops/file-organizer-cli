# Spec: config

> Status: **Implemented** (retroactive, 2026-09-11) · Created: 2026-09-11
> Module of: [CAPABILITY-MAP-cli-cycle2.md](CAPABILITY-MAP-cli-cycle2.md) (`governance`)
> Process: spec-driven-development (retroactive — describes shipped behavior)

## 1. Objective

The YAML config is the user's contract with the tool, so it must be creatable,
inspectable, and validated **before** anything moves (Constitution Art. VI):
`fo config init | show | validate`.

## 2. Non-goals

- The full field reference → `docs/RULES.md`.
- `config set` / interactive editing (the TUI and `rules add` cover editing).

## 3. Behavior

1. `config init [path]` writes a starter config (`.file-organizer.yaml` by
   default) with three example rules; `--example` includes the full set.
2. `config show` loads and prints the normalized config as JSON.
3. `config validate [path]` loads the config and reports success or a specific
   error; unknown destination template tokens are reported as warnings.
4. Discovery: when no `-c` is given, the config is found by walking up from the
   working directory (`.file-organizer.yaml`, `.yml`, `file-organizer.yaml`,
   `.yml`).
5. Validation is content-aware: every `patterns[]` element must be a non-empty
   string, a `pattern` must compile as a regex, a `regex` condition requires a
   `pattern`, and `recursive` defaults to `false`.
6. All three commands exit 1 on failure (missing/invalid config) and 0 on
   success; `show`/`validate` do not import plugins.

## 3a. `AppConfig.logLevel` (the global app config, not the YAML)

`AppConfig` (persisted via `conf`, read/written by `loadAppConfig`/
`saveAppConfig`) carries a `logLevel` field, separate from the per-project
YAML config above. It sets the CLI's default log verbosity when no explicit
flag is given.

1. The CLI entry's shared `preAction` hook (`src/cli/index.ts`) resolves the
   effective log level for every command in this order:
   1. `--verbose` → `debug`.
   2. `--quiet` → `error`.
   3. Neither flag → the persisted `AppConfig.logLevel` (`loadAppConfig()`),
      which itself defaults to `info` (`DEFAULT_CONFIG.logLevel`).
2. This resolution happens **before** each command's own action runs. A
   command that then forces its own level — `organize`/`rules list`/
   `config show` under `--json` (SPEC-cli-contract), and `fo mcp` — still
   wins, because those calls happen later, inside the action itself.
3. There is currently no CLI surface to *set* `AppConfig.logLevel` (no
   `fo config set`, per the Non-goals above); it is only writable
   programmatically via `saveAppConfig`, or by editing the `conf` store file
   directly. Until such a surface exists, this option is reachable but not
   yet user-facing through a command.

## 4. Acceptance criteria

| ID   | Given | When | Then | Test |
|------|-------|------|------|------|
| AC-1 | an empty dir | `config init` then `config validate` | both exit 0; the file exists | `tests/e2e/cli.test.ts` |
| AC-2 | a valid config | `config show --json` | exit 0; stdout parses as the config object | `tests/e2e/cli-contract.test.ts` |
| AC-3 | no config | `config show` | exit 1 | `tests/e2e/cli-contract.test.ts` |
| AC-4 | a config with a bad regex | `config validate` | exit 1; stderr names the rule | `tests/e2e/config-integrity.test.ts` |
| AC-5 | an invalid `patterns[]` entry | `validateAndNormalizeConfig` | throws naming `patterns[i]` | `tests/unit/config-loader.test.ts` |
| AC-6 | `recursive` omitted | `validateAndNormalizeConfig` | `recursive === false` | `tests/unit/config-loader.test.ts` |
| AC-7 | every shipped example | `validateAndNormalizeConfig` | all validate | `tests/unit/config-loader.test.ts` |
| AC-8 | a config with `plugins` | `loadConfig` | structure validated; plugins never imported at validate time | `tests/unit/config-loader.test.ts` |
| C1 | no `--verbose`/`--quiet` | any command runs | the effective log level is `AppConfig.logLevel` | `tests/unit/cli-index.test.ts` |
| C2 | `AppConfig.logLevel` set to a non-default value | `--verbose` or `--quiet` is also given | the flag wins | `tests/unit/cli-index.test.ts` |
| C3 | `AppConfig.logLevel` set to a non-default value | `organize --json` / `rules list --json` / `config show --json` / `fo mcp` | the command still forces `error` (unchanged from SPEC-cli-contract) | `tests/unit/cli-organize-command.test.ts`, `tests/unit/cli-mcp-command.test.ts` |
| C4 | `DEFAULT_CONFIG` | inspecting `logLevel` | still defaults to `'info'` (unchanged) | `tests/unit/config-loader.test.ts` |

## 5. Adapter mapping

| Behavior | CLI | MCP |
|----------|-----|-----|
| Validate | `fo config validate` | — (rules validated on `add_rule`) |
| Show | `fo config show [--json]` | `list_rules` |
| Default log level | `preAction` hook, all commands | not applicable (MCP always forces `error`) |

## 6. Boundaries

- **Always:** validate before any file moves; actionable errors naming the rule
  and index; `validate` stays offline (never imports plugins); `--verbose`/
  `--quiet` win over the persisted `AppConfig.logLevel`.
- **Never:** accept a config the loader would reject at organize time; let
  `AppConfig.logLevel` override `--json`'s or `fo mcp`'s forced `error` level.
