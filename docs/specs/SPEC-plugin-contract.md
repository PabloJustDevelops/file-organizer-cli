# Spec: plugin-contract

> Status: **Implemented** (2026-09-04) — todos los ACs trazados a tests · Created: 2026-09-04
> Module of: [CAPABILITY-MAP-plugins.md](CAPABILITY-MAP-plugins.md) (`plugin-contract`, no dependencies)
> Process: spec-driven-development (Specify phase)

## 1. Objective

Formalize the contract every plugin obeys: the `OrganizerPlugin` interface,
its validation rules, and the typed errors used by every other plugin module.
This module contains **no I/O and no loading logic** — it is the vocabulary
the loader, config, hooks, rules, and transform modules share.

Success looks like: any object can be checked against the contract with one
call (`validatePlugin`), producing either a valid `OrganizerPlugin` or a
typed, actionable error — and every downstream module consumes those errors
instead of inventing its own.

## 2. Non-goals

- Discovering or loading plugins (→ `plugin-loader`)
- Reading `plugins:` from YAML (→ `config-plugins`)
- Running hooks safely at runtime (→ `plugin-hooks`)
- Injecting rules or transforming files (→ `plugin-rules`, `plugin-transform`)
- Publishing or versioning plugin packages

## 3. Contract design

The interface stays as documented in `docs/PLUGINS.md` and typed today in
`src/types/index.ts` (backward compatible, assumption #1):

```typescript
interface OrganizerPlugin {
  name: string;      // kebab-case, unique among loaded plugins
  version: string;   // valid semver
  beforeOrganize?(context: OrganizeContext): Promise<void>;
  afterOrganize?(context: OrganizeContext): Promise<void>;
  customRules?(): Rule[];
  transform?(file: FileInfo): Promise<FileInfo>;
}
```

### Validation rules (`validatePlugin(candidate: unknown)`)

| # | Rule | Error type |
|---|------|------------|
| V1 | Candidate is a non-null object | `PluginTypeError` |
| V2 | `name` is a non-empty kebab-case string (`/^[a-z0-9]+(-[a-z0-9]+)*$/`) | `PluginFieldError` (`field: 'name'`) |
| V3 | `version` is a valid semver string | `PluginFieldError` (`field: 'version'`) |
| V4 | Each present optional member is the correct type: hooks/`transform` are functions returning Promise, `customRules` is a function returning `Rule[]` | `PluginFieldError` (`field: <name>`) |
| V5 | Valid candidate → returns the same object typed as `OrganizerPlugin` (no mutation, no cloning) | — |

- Unknown extra properties are **allowed** (forward compatibility) — never rejected.
- Errors carry `pluginName` when known, and a human-readable message stating
  what was expected vs. what was received.
- `PluginError` is the base class; modules catch the base, escalate the specific.

### Module surface

```
src/core/plugins/contract.ts   → types + validatePlugin + error classes
src/core/plugins/index.ts      → public barrel (grows per module)
```

## 4. Commands

```
Test:      bun run test (from packages/cli; vitest)
Lint:      bun run lint (oxlint + tsc --noEmit)
Coverage:  bun run test:coverage
```

## 5. Testing strategy

- Framework: Vitest, pure unit tests — **no filesystem, no module mocking**
  (memfs not needed; this module is pure logic).
- Location: `packages/cli/tests/unit/plugins/contract.test.ts`.
- Every V-rule above maps to at least one test case, including the error
  type, `field`, and message shape.
- No adapter tests needed: nothing user-visible changes until a consuming
  module ships.

## 6. Acceptance criteria

| ID  | Given | When | Then | Test |
|-----|-------|------|------|------|
| AC-1 | a valid plugin object | `validatePlugin` | returns it typed as `OrganizerPlugin`, same reference (V5) | `tests/unit/plugins/contract.test.ts` |
| AC-2 | `null`, `undefined`, a string, a number, an array | `validatePlugin` | throws `PluginTypeError` with descriptive message (V1) | same file |
| AC-3 | object with missing or invalid `name` (empty, CamelCase, spaces) | `validatePlugin` | throws `PluginFieldError` with `field: 'name'` (V2) | same file |
| AC-4 | object with non-semver `version` (`"1.0"`, `"abc"`) | `validatePlugin` | throws `PluginFieldError` with `field: 'version'` (V3) | same file |
| AC-5 | hook defined as non-function (e.g. `beforeOrganize: 'x'`) | `validatePlugin` | throws `PluginFieldError` with `field: 'beforeOrganize'` (V4) | same file |
| AC-6 | plugin with extra unknown properties | `validatePlugin` | passes; extras preserved on returned object | same file |
| AC-7 | minimal valid plugin (`name` + `version` only, zero hooks) | `validatePlugin` | passes — all members optional except name/version | same file |
| AC-8 | each error instance | `instanceof PluginError` | true for `PluginTypeError` and both `PluginFieldError` variants | same file |

## 7. Boundaries

- **Always:** pure module (no fs, no logger calls at this layer); errors carry
  expected-vs-received detail; JSDoc on the public surface.
- **Ask first:** changing the `OrganizerPlugin` interface shape (breaks
  backward compat with PLUGINS.md and downstream modules).
- **Never:** perform I/O or loading here; mutate the candidate object;
  silently "fix" invalid fields.

## 8. Types & docs touched

- `src/types/index.ts`: `OrganizerPlugin` moves conceptually to the contract
  module (re-exported from `types` for compatibility — one definition only).
- `docs/PLUGINS.md`: gets a "status: implemented in v1" note when the last
  module ships (per constitution Art. III).

## 9. Open questions

- OQ-1: Should `validatePlugin` also accept a *factory function* returning a
  plugin (common npm pattern)? — **Owner: Pablo. Default: no for v1** (keeps
  V1–V5 simple); reconsider if a real plugin needs it.
- OQ-2: ESM-only plugins for v1? (npm resolution is `plugin-loader`'s
  problem, but the contract doc should state the expectation.)
  **Default: ESM-only**, matching this package (`"type": "module"`).

## 10. Changelog

- 2026-09-04 — spec drafted from capability map; assumptions #1–#5 recorded.
- 2026-09-04 — aprobada con defaults (OQ-1 = no factory, OQ-2 = ESM-only).
- 2026-09-04 — **implementada**: AC-1…AC-8 en verde en
  `tests/unit/plugins/contract.test.ts` (33 casos); cobertura 100%
  statements/lines/functions en `contract.ts`; lint (oxlint + tsc) limpio.
  `OrganizerPlugin` definido una sola vez en `core/plugins/contract.ts`,
  re-exportado desde `types/index.ts`.
