# Spec: plugin-loader

> Status: **Implemented** (2026-09-04) — AC-1…AC-13 trazados a tests · Created: 2026-09-04
> Module of: [CAPABILITY-MAP-plugins.md](CAPABILITY-MAP-plugins.md) (`plugin-loader`, depends on `plugin-contract`)
> Process: spec-driven-development (Specify phase)

## 1. Objective

Load plugins from the three v1 sources — **programmatic objects**, **local
files**, and **npm packages** — validate every candidate against the plugin
contract, enforce name uniqueness across all sources, and expose a registry
the rest of the system (hooks, rules, transform) consumes.

Success looks like: `PluginRegistry` returns only valid, uniquely-named,
ready-to-use `OrganizerPlugin` objects; every failure mode produces a typed
`PluginError` subclass saying exactly what was expected vs. received.

## 2. Non-goals

- Reading `plugins:` from YAML or validating the config field (→ `config-plugins`)
- Running hooks or transforms (→ `plugin-hooks`, `plugin-transform`)
- Downloading/installing npm packages — resolution only; an uninstalled
  package is a `PluginNotFoundError`, not an automatic install
- Remote plugin manifests, version pinning/locking, plugin sandboxing
- Named-export discovery, factory-function plugins (OQ-1 of the contract spec)

## 3. Design

### Sources and routing

| Source | Detection | Resolution |
|---|---|---|
| Programmatic | object passed to `register()` | `validatePlugin`, store |
| Local file | spec starts with `./`, `../`, or is absolute | `path.resolve(baseDir, spec)` → existence check → `importModule(resolved)` |
| npm package | any other string (bare specifier) | `resolvePackage(spec)` → `importModule(resolved)` |

- `baseDir` defaults to the config file's directory when loading from config
  context, `process.cwd()` otherwise (assumption #3).
- npm resolution uses the user's project as context (`createRequire` rooted
  at the config directory), never the CLI's own `node_modules` (assumption #2).

### Module extraction

The loaded namespace must expose a **default export**; it is passed to
`validatePlugin`. Missing default → `PluginExportError`. Export that fails
validation → the original `PluginTypeError`/`PluginFieldError` propagates.

### Registry API

```typescript
class PluginRegistry {
  register(plugin: OrganizerPlugin): OrganizerPlugin;   // programmatic
  load(spec: string, options?: { baseDir?: string }): Promise<OrganizerPlugin>;
  list(): readonly OrganizerPlugin[];
}
```

- `load()` routes by the table above; both paths end in `register()`, so
  validation and dedup are single-point.
- `Organizer.loadPlugin(plugin)` (PLUGINS.md API) delegates to `register()`.

### Error taxonomy (extends `PluginError` from `plugin-contract`)

| Class | When |
|---|---|
| `PluginNotFoundError` | local path does not exist / npm package not installed |
| `PluginLoadError` | `importModule` itself throws (syntax error, bad build); carries `cause` |
| `PluginExportError` | module has no default export |
| `DuplicatePluginError` | a plugin with the same `name` is already registered |

Defined in `src/core/plugins/loader.ts`, exported from the barrel.

### Edge injection (testability, Constitution Art. II)

```typescript
interface LoaderEdges {
  fileExists?(path: string): Promise<boolean>;
  resolvePackage?(name: string): string;          // throws if unresolvable
  importModule?(path: string): Promise<unknown>;  // returns module namespace
}
```

All optional with real defaults (`fs-extra` pathExists, `createRequire`
resolution, dynamic `import()`); unit tests inject fakes — no memfs, no
module mocking.

### Module surface

```
src/core/plugins/loader.ts   → PluginRegistry + loader error classes
src/core/plugins/index.ts    → barrel grows
src/core/organizer.ts        → +loadPlugin() delegation (thin)
```

## 4. Commands

```
Test:      bun run test (from packages/cli; vitest)
Lint:      bun run lint (oxlint + tsc --noEmit)
Coverage:  bun run test:coverage
```

## 5. Testing strategy

- **Unit** (`tests/unit/plugins/loader.test.ts`): all error paths and routing
  via injected edge fakes — pure, deterministic, no real fs or dynamic imports.
- **Integration** (`tests/integration/plugin-loader.test.ts`): real fixture
  plugin written to a temp dir, loaded end-to-end with default edges (real
  `import()`), per Constitution Art. II's "suspicious → real temp dirs" rule.
- Every AC below maps to one of these two files.

## 6. Acceptance criteria

| ID   | Given | When | Then | Test |
|------|-------|------|------|------|
| AC-1 | a valid plugin object | `register()` | stored; `list()` contains it; returns same reference | unit |
| AC-2 | an invalid object (bad name/version/non-object) | `register()` | throws the contract's `PluginTypeError`/`PluginFieldError`; `list()` unchanged | unit |
| AC-3 | a registered plugin; second object with same `name` | `register()` | throws `DuplicatePluginError`; `list()` unchanged | unit |
| AC-4 | local spec `./fixture.js`, file exists, valid default export | `load()` | resolves to absolute path under `baseDir`; imports, validates, stores | unit |
| AC-5 | local spec pointing to missing file | `load()` | throws `PluginNotFoundError`; `importModule` never called | unit |
| AC-6 | bare specifier; `resolvePackage` resolves | `load()` | imports resolved path; validates; stores | unit |
| AC-7 | bare specifier; `resolvePackage` throws | `load()` | throws `PluginNotFoundError` with package name in message | unit |
| AC-8 | module import fails | `load()` | throws `PluginLoadError` carrying the original `cause` | unit |
| AC-9 | module without default export | `load()` | throws `PluginExportError` | unit |
| AC-10 | module whose default fails contract validation | `load()` | throws the contract's field error; nothing stored | unit |
| AC-11 | loaded plugin with duplicate `name` | `load()` | throws `DuplicatePluginError` | unit |
| AC-12 | `Organizer` instance | `organizer.loadPlugin(valid)` | plugin registered on the organizer's registry | unit |
| AC-13 | real fixture plugin file on disk | `load()` with default edges | end-to-end load via real `import()`; validates; retrievable from `list()` | integration |

## 7. Boundaries

- **Always:** validate every candidate before storing; single dedup point;
  typed errors with expected-vs-received detail; never auto-install packages.
- **Ask first:** changing the registry API surface (downstream modules consume
  it); adding a new source type (e.g., directories, `~` expansion).
- **Never:** execute a plugin during loading beyond its module side effects
  (hooks run only in `plugin-hooks`); swallow load errors; resolve npm
  packages from the CLI's own install tree.

## 8. Types & docs touched

- `src/core/plugins/loader.ts` (new), `src/core/plugins/index.ts` (barrel),
  `src/core/organizer.ts` (+`loadPlugin`).
- `docs/PLUGINS.md`: after this module ships, the "Register plugin /
  programmatic" section reflects reality; full re-validation when all modules
  land (per Constitution Art. III).

## 9. Open questions

- OQ-1: Should `load()` also accept an options bag with `locale`-style
  plugin settings (constructor params for plugins)? **Default: no for v1** —
  plugins are stateless objects; settings land in v2 if a real plugin needs them.
- OQ-2: `DuplicatePluginError` — error or warning-skip? **Default: error**;
  silent skipping hides config mistakes (Constitution Art. I: report, don't guess).

## 10. Changelog

- 2026-09-04 — spec drafted; assumptions #1–#7 recorded in session.
- 2026-09-04 — aprobada con defaults (OQ-1 = sin settings en v1, OQ-2 = duplicado lanza error).
- 2026-09-04 — **implementada**: AC-1…AC-12 en
  `tests/unit/plugins/loader.test.ts` (23 casos, edges fakes puras), AC-13 en
  `tests/integration/plugin-loader.test.ts` (3 casos: fixture real vía
  `import()` nativo + `pathToFileURL`, missing file, npm no resolvable vía
  `createRequire` real). Cobertura 100% stmts/lines/funcs en `loader.ts`;
  lint 0 errores. `Organizer.loadPlugin()`/`listPlugins()` delegan al registry.
