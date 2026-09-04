# Spec: plugin-hooks

> Status: **Implemented** (2026-09-04) — AC-1…AC-10 trazados a tests
> Module of: [CAPABILITY-MAP-plugins.md](CAPABILITY-MAP-plugins.md) (`plugin-hooks`, depends on `plugin-contract`)
> Process: spec-driven-development (Specify → Implement, single session per user request)

## 1. Objective

Execute plugin lifecycle hooks (`beforeOrganize` / `afterOrganize`) around
the organize pipeline, with **error isolation**: a failing plugin never
aborts an organize run — its failure is captured, logged, and reported in
the result alongside the successful work.

Success looks like: one broken plugin among five produces four working hook
invocations, one captured error, moved files untouched — and zero surprises
in the default output.

## 2. Non-goals

- Injecting `customRules()` (→ `plugin-rules`)
- File transformation (→ `plugin-transform`)
- Loading plugins (→ `plugin-loader`) or validating them (→ `plugin-contract`)
- Hook timeouts, retries, or parallel execution
- Sandboxing hook side effects (plugins are user-installed, trusted code)

## 3. Design

### Placement in the pipeline (`Organizer.organize`)

```
load plugins → scan → beforeOrganize(ctx) → match + move loop
            → history → afterOrganize(ctx) → return result
```

`OrganizeContext` requires `files` (scanned) and `results` — hence
`beforeOrganize` runs after the scan with an empty result and `afterOrganize`
after the loop with the filled one. This matches the documented semantics in
PLUGINS.md ("Organizing N files…" / "Moved N files!").

Context shape passed to both hooks:

```typescript
{ source: sourceDir,
  config: { ...(config ?? { rules: rules ?? [] }), dryRun },  // AC-6
  files,               // same array instance for both hooks
  results }            // same OrganizeResult instance; empty at before, filled at after
```

### Isolation semantics

| Situation | Behavior |
|---|---|
| hook resolves | next plugin continues |
| hook rejects/throws | captured as `{ plugin, hook, error }`; **next plugin continues**; organize proceeds |
| plugin has no such hook | skipped silently (optional member) |
| all hooks fail | all errors collected; moves still happen |

Failures are **reported, never swallowed**: each one is `logger.error`-logged
and collected in `result.pluginErrors` (new optional field, so existing
consumers are unaffected).

```typescript
// types (re-exported from core/plugins/hooks.ts)
interface PluginHookError {
  plugin: string;                                // plugin name
  hook: 'beforeOrganize' | 'afterOrganize';
  error: string;                                 // message
}
interface OrganizeResult {
  moved: MovedFile[]; skipped: SkippedFile[]; errors: OrganizeError[];
  pluginErrors?: PluginHookError[];              // absent when empty
}
```

### Module surface

```
src/core/plugins/hooks.ts  → runBeforeOrganize / runAfterOrganize + PluginHookError
src/core/plugins/index.ts  → barrel grows
src/core/organizer.ts      → two call sites, merge errors into result
src/types/index.ts         → OrganizeResult.pluginErrors (type-only re-export)
```

Hook runner functions are pure: `(plugins, context) => Promise<PluginHookError[]>`.
Sequential `await` in registration order (`plugins.list()` order).

## 4. Commands

```
Test:      bun run test (from packages/cli; vitest)
Lint:      bun run lint (oxlint + tsc --noEmit)
Coverage:  bun run test:coverage
```

## 5. Testing strategy

- **Unit** (`tests/unit/plugins/hooks.test.ts`): pure runner tests — order,
  isolation, skipping, error shape. No fs, no organizer.
- **Organizer wiring** (`tests/integration/organizer-options.test.ts`):
  `organizer.loadPlugin(...)` with hook spies (closures over test state),
  real organize run, assert `result.pluginErrors` and that moves happened.
- **Integration** (`tests/integration/plugin-loader.test.ts`): real fixture
  plugin file whose `beforeOrganize` writes a marker file; end-to-end proof
  the hook executed with real context data.

## 6. Acceptance criteria

| ID | Given | When | Then | Test |
|----|-------|------|------|------|
| AC-1 | two plugins with `beforeOrganize` | organize | both called once, in registration order, `context.files` populated, `context.source` = source dir | unit |
| AC-2 | plugin with `afterOrganize` | organize completes with 1 moved file | `afterOrganize` receives `results.moved` of length 1 | unit |
| AC-3 | hook that throws | organize | moves still happen; `result.pluginErrors` has `{ plugin, hook, error }`; error was logged | wiring |
| AC-4 | failing `beforeOrganize` + healthy second plugin | organize | second plugin's `afterOrganize` still runs; `pluginErrors` has exactly 1 entry | wiring |
| AC-5 | no plugins registered | organize | `result.pluginErrors` is `undefined`; behavior identical to today | wiring |
| AC-6 | organize with `dryRun: true` | hooks run | `context.config.dryRun === true` in both hooks | unit |
| AC-7 | two plugins appending to a shared log via closures | organize | log order proves sequential registration-order execution | unit |
| AC-8 | real fixture plugin (real fs) whose `beforeOrganize` writes a marker file | organize end-to-end | marker exists after run; hook saw real scanned filenames | integration |
| AC-9 | two plugins, both hooks throwing | organize | `pluginErrors` has 4 entries (2 plugins × 2 hooks); all moves fine | unit |
| AC-10 | plugin with only `name`/`version` (no hooks) | organize | no error, no entry, no crash | unit |

## 7. Boundaries

- **Always:** isolate per plugin (one failure never blocks others); report
  every failure (log + result); keep hook execution sequential and ordered.
- **Ask first:** making `pluginErrors` mandatory; adding hook timeouts or
  parallelism; new hook types (e.g. `onError`, `onConflict`).
- **Never:** abort organize because a hook failed; swallow a hook failure
  without reporting it; run hooks before plugin loading completes.

## 8. Types & docs touched

- `src/core/plugins/hooks.ts` (new), barrel, `src/core/organizer.ts`,
  `src/types/index.ts` (`OrganizeResult.pluginErrors` — optional, additive).
- `docs/PLUGINS.md` hook section re-validated at pilot close-out (final task).

## 9. Open questions

- OQ-1: Should `beforeOrganize` failures abort when the run is NOT a dry-run?
  **Default: no** — isolation is unconditional in v1; revisiting needs a real
  plugin use case that demands veto power.
- OQ-2: Surface `pluginErrors` in CLI output? **Default: debug-level log
  only** (matches config-plugins OQ-2); CLI summary changes are an adapter
  concern for a later pass.

## 10. Changelog

- 2026-09-04 — spec drafted; assumptions #1–#5 recorded; full cycle
  authorized by user in a single session.
- 2026-09-04 — **implementada**: runners puros en `hooks.ts` con cobertura
  100% (statements/branches/functions/lines); wiring en organizer (contexto
  compartido before/after, `pluginErrors` mergeado); 10 unit + 3 wiring +
  1 integración real (marker file con filenames reales del scan). Lint 0
  errores. Nota de tipos: `OrganizeContext` se importa desde `types`
  (fuente de verdad de los adaptadores), no desde `contract.ts`.
