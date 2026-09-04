# Spec: config-plugins

> Status: **Implemented** (2026-09-04) — AC-1…AC-12 trazados a tests · Created: 2026-09-04
> Module of: [CAPABILITY-MAP-plugins.md](CAPABILITY-MAP-plugins.md) (`config-plugins`, depends on `plugin-loader`)
> Process: spec-driven-development (Specify phase)

## 1. Objective

Make `plugins:` a first-class field of `.file-organizer.yaml`: validated at
config load, reported by `fo config validate`, and actually consumed by
`Organizer.organize()` so the field is never dead config. Local specs resolve
against the config file's directory; npm specifiers against the user's project.

Success looks like: a user adds `plugins: ["./my-plugin.js"]` to their YAML,
`fo config validate` checks its structure, `fo organize` loads the plugin
before touching a single file — and any bad entry fails fast with an
actionable `Invalid config: …` message.

## 2. Non-goals

- Running hooks or transforms (→ `plugin-hooks`, `plugin-transform`)
- Injecting `customRules()` (→ `plugin-rules`)
- Installing npm packages; existence is only checked at organize time
- Migrating the legacy global `AppConfig.plugins` field (separate decision)
- Plugin settings/constructor params (loader OQ-1 default: none in v1)

## 3. Design

### Config surface

```yaml
# .file-organizer.yaml
plugins:
  - ./my-plugin.js          # local, relative to this config file
  - file-organizer-compress # npm bare specifier
```

- `OrganizeConfig` gains `plugins?: string[]` (assumption #1). Optional;
  absent = no plugins. The legacy `AppConfig.plugins` stays untouched.
- `CONFIG_SCHEMA` (JSON Schema) gains the `plugins` definition
  (`array` of `string`, `minItems` when present).
- `docs/RULES.md` and the README config section document the field.

### Validation (structural only, at the config boundary)

In `validateAndNormalizeConfig`, after existing fields:

| # | Rule | Error |
|---|------|-------|
| C1 | `plugins`, when present, is an array | `Invalid config: plugins must be an array of strings` |
| C2 | Every entry is a non-empty string | `Invalid config: plugins[<i>] must be a non-empty string` |
| C3 | No duplicates within the array | `Invalid config: plugins[<i>] duplicates "<spec>"` |

**`fo config validate` stays side-effect-free** (assumption #2): it never
imports or executes plugin files. Resolution, existence, contract validation,
and dedup happen at organize time via `plugin-loader` — this keeps config
validation a safe, fast, offline check (Constitution Art. I).

### Consumption at organize time (assumption #4)

`Organizer.organize()` gains a `pluginBaseDir?: string` option (defaults to
`process.cwd()`). When `config.plugins` is present and non-empty, before
scanning:

1. For each spec, in order: `this.plugins.load(spec, { baseDir })`.
2. Any failure (`PluginNotFoundError`, `PluginLoadError`, …) propagates —
   organize **aborts before scanning or moving anything**.
3. Loaded plugins join the organizer's registry (dedup by name applies across
   config + programmatic sources).

The CLI `organize` command passes the config file's directory as
`pluginBaseDir`; watch does the same.

### Module surface

```
src/config/loader.ts        → +plugins normalization/validation (C1–C3)
src/config/schema.ts        → +plugins JSON Schema definition
src/core/organizer.ts       → consume config.plugins before scanning
src/cli/commands/organize.ts → pass pluginBaseDir (config dir)
```

## 4. Commands

```
Test:      bun run test (from packages/cli; vitest)
Lint:      bun run lint (oxlint + tsc --noEmit)
Coverage:  bun run test:coverage
```

## 5. Testing strategy

- **Unit** (`tests/unit/config-loader.test.ts` extends): C1–C3 valid/invalid
  matrices, including index numbers in messages and duplicate detection.
- **Unit** (`tests/unit/plugins/` + organizer options): organize aborts on a
  bad plugin spec *before* scanning; valid spec registers the plugin;
  `pluginBaseDir` default and explicit value honored.
- **Integration** (`tests/integration/plugin-loader.test.ts` extends): YAML
  file on disk with a real local plugin → `organize()` loads and registers it
  end-to-end; bad spec → organize throws, **no files moved**.

## 6. Acceptance criteria

| ID | Given | When | Then | Test |
|----|-------|------|------|------|
| AC-1 | YAML without `plugins` | `loadConfig` | `config.plugins` is `undefined`; behavior identical to today | unit (config-loader) |
| AC-2 | `plugins: ["./a.js"]` | `loadConfig` | normalized to the same array | unit (config-loader) |
| AC-3 | `plugins: "x"` (string, not array) | `loadConfig` | throws `Invalid config: plugins must be an array of strings` | unit (config-loader) |
| AC-4 | `plugins: ["", 42]` | `loadConfig` | throws naming `plugins[0]`/`plugins[1]` as non-empty string | unit (config-loader) |
| AC-5 | `plugins: ["./a.js", "./a.js"]` | `loadConfig` | throws `duplicates "./a.js"` naming the second index | unit (config-loader) |
| AC-6 | valid config with plugins | `fo config validate` | success message; **no plugin file imported/executed** | unit (config-loader + spy-free edges unchanged) |
| AC-7 | organize with valid `plugins: ["./real.js"]` and `pluginBaseDir` | `organizer.organize()` | plugin registered before scanning; organize proceeds | unit (organizer options) |
| AC-8 | organize with unresolvable plugin spec | `organizer.organize()` | throws `PluginNotFoundError`; **no scan, no moves** (files untouched) | unit (organizer options) |
| AC-9 | same-name plugin registered programmatically and in config | `organizer.organize()` | `DuplicatePluginError` propagates (loader OQ-2: error, not skip) | unit (organizer options) |
| AC-10 | real YAML on disk + real local plugin file | `organize()` end-to-end | plugin loaded via real edges; registered in `organizer.listPlugins()` | integration |
| AC-11 | real YAML with bad spec on disk | `organize()` end-to-end | throws; directory contents byte-identical to before | integration |
| AC-12 | CLI organize with config | `fo organize` | passes config dir as `pluginBaseDir` (config-relative local specs resolve) | integration |

## 7. Boundaries

- **Always:** fail fast before any filesystem mutation; structural-only
  validation at config time; error messages name the offending index/spec.
- **Ask first:** making `plugins` mandatory; auto-installing packages;
  merging global `AppConfig.plugins` with YAML `plugins`.
- **Never:** import/execute plugin files during `fo config validate`;
  silently skip invalid entries; move files before plugins finish loading.

## 8. Types & docs touched

- `src/types/index.ts` (`OrganizeConfig.plugins`), `src/config/loader.ts`,
  `src/config/schema.ts`, `src/core/organizer.ts`,
  `src/cli/commands/organize.ts`.
- `docs/RULES.md` (+plugins section), `README.md` (config table).
- `fo config validate` output unchanged when no plugins present.

## 9. Open questions

- OQ-1: Should local specs also accept `~/...` (home expansion)?
  **Default: no for v1** — loader spec already scoped detection to `./`,
  `../`, absolute; `~` is a new loader concern, not a config one.
- OQ-2: Report loaded plugin names in organize output ("Loaded 2 plugins")?
  **Default: yes, debug-level log** — visible with `--verbose`, silent
  otherwise; keeps default output stable.

## 10. Changelog

- 2026-09-04 — spec drafted; assumptions #1–#5 recorded in session.
- 2026-09-04 — aprobada con defaults (OQ-1 = sin expansión `~`, OQ-2 = log debug).
- 2026-09-04 — **implementada**: C1–C3 en config-loader (AC-1…AC-6);
  organizer consume `plugins`/`pluginBaseDir` con `loadedSpecs` para
  idempotencia preview→organize (AC-7…AC-9 + test de idempotencia); CLI
  organize/watch pasan el dirname del config (AC-12 vía integración real);
  YAML real + plugin real end-to-end y abort byte-idéntico (AC-10/AC-11).
  Cobertura: loader.ts 100% stmts/lines/funcs; lint 0 errores. Docs:
  README + RULES.md documentan el campo. Extra: organizer.test.ts aislado
  del history dir global (flake preexistente destapado por los nuevos tests).
