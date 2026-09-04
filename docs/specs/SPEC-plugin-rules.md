# Spec: plugin-rules

> Status: **Implemented** (2026-09-04) — AC-1…AC-10 trazados a tests
> Module of: [CAPABILITY-MAP-plugins.md](CAPABILITY-MAP-plugins.md) (`plugin-rules`, depends on `plugin-contract`)
> Process: spec-driven-development (Specify → Implement, single session per user request)

## 1. Objective

Let plugins contribute organization rules via `customRules()`: validated with
the same rules as YAML rules, injected into the rules engine with correct
priority, deduplicated by rule name — and failures reported non-fatally,
consistent with the hooks module.

Success looks like: a plugin's rule beats a lower-priority config rule and
moves files; a plugin returning garbage rules is reported in
`result.pluginErrors` while organize continues untouched.

## 2. Non-goals

- Rule *modification* by plugins (only addition)
- Template warnings for plugin rules in CLI output (adapter concern, later)
- Hot-reloading rules when plugin files change
- New rule types beyond what `Rule` supports

## 3. Design

### Pipeline placement (`Organizer.organize`)

```
load plugins → scan → INJECT plugin rules → beforeOrganize hooks
            → match + move loop → history → afterOrganize hooks → return
```

Injection happens after the `setRules(...)` block and before `matchFiles`,
so plugin rules compete with config rules on the same priority sort.

### Validation refactor (single source of truth)

`validateRule` / `validateCondition` move from `config/loader.ts` to
**`src/core/rule-validation.ts`** (core must not depend on config; config
imports from core — fixes layering, Art. II). Both YAML rules and plugin
rules go through the identical validation.

### Injection semantics

```typescript
// src/core/plugins/rules.ts
collectPluginRules(plugins): { rules: Rule[]; failures: PluginRuleFailure[] }
// pure: calls customRules(), validates each rule, isolates errors
```

| Situation | Behavior |
|---|---|
| plugin has no `customRules` | skipped silently |
| `customRules()` throws | captured (plugin + message); no rules from that plugin |
| returns non-array | captured; no rules from that plugin |
| individual rule invalid | captured naming plugin + rule; **other rules from same plugin still injected** |
| rule name == config rule name | captured conflict; config rule wins; other rules injected |
| rule name already injected by plugins (re-pass) | silently skipped (idempotency, see below) |

`RulesEngine` gains `hasRule(name): boolean`. The Organizer tracks
`pluginRuleNames: Set<string>` per instance:

- engine has name + it's ours → skip silently (preview→organize double pass)
- engine has name + it's NOT ours → conflict captured, rule skipped
- engine lacks name → `addRule`, record in set (also covers the reset case:
  `setRules` wipes engine, name missing → re-injected fresh)

Error channel: reuse `result.pluginErrors`, with `hook: 'customRules'`
(`PluginHookName` union extends to `'beforeOrganize' | 'afterOrganize' | 'customRules'`).
One reporting channel for all plugin contributions.

### Module surface

```
src/core/rule-validation.ts   → validateRule/validateCondition (moved from config)
src/core/plugins/rules.ts     → collectPluginRules + failure type
src/core/plugins/index.ts     → barrel grows
src/core/rules-engine.ts      → +hasRule(name)
src/core/organizer.ts         → injection site + merge failures
src/config/loader.ts          → imports validateRule from core (no local copy)
```

## 4. Commands

```
Test:      bun run test (from packages/cli; vitest)
Lint:      bun run lint (oxlint + tsc --noEmit)
Coverage:  bun run test:coverage
```

## 5. Testing strategy

- **Unit** (`tests/unit/plugins/rules.test.ts`): pure `collectPluginRules`
  tests — validation, isolation, non-array, throwing customRules.
- **Wiring** (`tests/integration/organizer-options.test.ts`): injection vs
  config rules (priority, conflicts), idempotency double-pass, disabled rule.
- **Integration** (`tests/integration/plugin-loader.test.ts`): real plugin
  file with `customRules()` matching `*.xyz` (currently unmatched) →
  end-to-end move by the plugin's rule.

## 6. Acceptance criteria

| ID | Given | When | Then | Test |
|----|-------|------|------|------|
| AC-1 | plugin `customRules` returns valid rule with priority 20; config rule priority 10 matches same file | organize | plugin rule wins; `moved[0].rule` = plugin rule name | wiring |
| AC-2 | plugin returns one invalid rule (no destination) + one valid | organize | invalid captured in `pluginErrors` (`hook: 'customRules'`); valid rule injected and used | wiring |
| AC-3 | `customRules()` returns a non-array | organize | captured error; organize proceeds with config rules only | unit |
| AC-4 | plugin rule name duplicates a config rule name | organize | conflict captured; config rule wins; organize proceeds | wiring |
| AC-5 | no plugins with customRules | organize | `pluginErrors` absent; engine rules exactly config's | wiring |
| AC-6 | preview() then organize() (double pass, no setRules reset between) | both passes | rules injected once; no duplicate/conflict errors; matching works in both | wiring |
| AC-7 | plugin without customRules | organize | skipped silently, no entries | unit |
| AC-8 | plugin rule with `enabled: false` | organize | rule injected (visible via engine) but matches nothing | wiring |
| AC-9 | real plugin file with `customRules` matching `*.xyz` | organize end-to-end | `other.xyz` moved by the plugin's rule to its destination | integration |
| AC-10 | two plugins inject rules with different priorities | organize | all injected; sorted correctly among config rules by priority | wiring |

## 7. Boundaries

- **Always:** validate plugin rules with the same validator as YAML rules;
  isolate per rule (one bad rule doesn't sink the plugin's other rules);
  report every skipped rule.
- **Ask first:** allowing plugins to modify/remove rules; new rule types;
  making plugin rule conflicts fatal.
- **Never:** inject unvalidated rules; let a plugin rule silently shadow a
  config rule; abort organize because a plugin rule was invalid.

## 8. Types & docs touched

- `src/core/rule-validation.ts` (moved), `src/core/plugins/rules.ts` (new),
  barrel, `rules-engine.ts` (+hasRule), `organizer.ts`, `config/loader.ts`.
- `PluginHookName` extends to `'customRules'`; `pluginErrors` documented as
  the single plugin-contribution error channel.
- `docs/PLUGINS.md` re-validated at pilot close-out (final task).

## 9. Open questions

- OQ-1: Should plugin rules support template variables like `{match1}` from
  the plugin's own regex conditions? **Default: yes automatically** — they go
  through the same engine resolution; no extra work, covered by AC-9.

## 10. Changelog

- 2026-09-04 — spec drafted; full cycle authorized by user in a single session.
- 2026-09-04 — **implementada**: refactor validateRule→core/rule-validation.ts
  (neutro, suite de config como red); hasRule en engine;
  collectPluginRules con aislamiento por regla; wiring con dedup
  engine-first (reinyección tras reset de setRules incluida). 209 tests en
  verde; rules.ts 100% stmts/lines/funcs (ramas 93%: rama defensiva
  no-Error inalcanzable vía API pública). Lint 0 errores.
- 2026-09-04 — **bug latente corregido**: RulesEngine.setRules/constructor
  ordenaban el array del caller in situ (sort muta) y lo almacenaban por
  referencia; addRule filtraba estado del engine al array compartido de
  config. Fix: copia antes de ordenar. Destapado por AC-2/AC-4/AC-6.
- 2026-09-04 — API programática completa: Organizer.loadSpec(spec, {baseDir})
  delega al registry y comparte clave de dedup con los specs de config.
