# Capability Map: Plugin System (v1)

> Status: Approved · Date: 2026-09-04
> Process: spec-driven-development skill, Phase 0
> Scope decision (v1): **local file plugins + npm packages**, both supported.
> Programmatic API (`organizer.loadPlugin()`) is in scope; remote/plugin-market
> concepts are not.

## Modules

| Module id         | Responsibility                                                                 | Depends on      |
|-------------------|--------------------------------------------------------------------------------|-----------------|
| `plugin-contract` | `OrganizerPlugin` interface, plugin metadata validation, error types            | —               |
| `plugin-loader`   | Discover + load plugins: local paths (`./my-plugin.js`) and npm packages        | `plugin-contract` |
| `config-plugins`  | `plugins:` field in `.file-organizer.yaml`: normalization, validation, `fo config validate` reporting | `plugin-loader` |
| `plugin-hooks`    | Lifecycle execution: `beforeOrganize` / `afterOrganize` with error isolation (one failing plugin never aborts an organize run) | `plugin-contract` |
| `plugin-rules`    | Inject `customRules()` into the rules engine (priority + dedup of rule names)   | `plugin-contract` |
| `plugin-transform`| Apply `transform(file)` in the pipeline before matching/organizing              | `plugin-contract` |

Build order: `plugin-contract` → `plugin-loader` → `config-plugins` →
`plugin-hooks`, `plugin-rules`, `plugin-transform` (last three independent,
can proceed incrementally or in parallel).

## Notes

- All modules live in the core (`src/core/` per Constitution Article II); CLI,
  TUI, and MCP inherit plugin behavior with no adapter changes.
- Drift note: `docs/PLUGINS.md` described this system before it existed. This
  map is the first SDD artifact of the pilot that turns that documentation
  into real, tested behavior. PLUGINS.md gets re-validated against the specs
  when the last module ships.
- Programmatic registration (`loadPlugin(myPlugin)`) belongs to
  `plugin-loader` as the third source besides local paths and npm packages.
