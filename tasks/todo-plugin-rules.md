# Tasks: plugin-rules

> Plan: [plan.md](plan.md) · Spec: SPEC-plugin-rules.md

- [x] Task 1: Refactor validateRule a core + hasRule en engine (neutro, bug de aliasing en setRules corregido)
  - Acceptance: `core/rule-validation.ts` creado; config importa de core;
    `hasRule(name)` disponible; suite en verde sin cambios de comportamiento.
  - Verify: `bun run test` (suite completa neutra)
  - Files: `src/core/rule-validation.ts`, `src/config/loader.ts`,
    `src/core/rules-engine.ts`

- [x] Task 2: collectPluginRules + wiring organizer
  - Acceptance: inyección tras setRules, antes de matchFiles; fallos a
    `pluginErrors`; idempotencia doble pasada; conflicto = config wins.
  - Verify: AC-1…AC-8, AC-10 en verde
  - Files: `src/core/plugins/rules.ts`, `src/core/plugins/index.ts`,
    `src/core/organizer.ts`, `src/core/plugins/hooks.ts` (union hook name),
    tests unit + wiring

- [x] Task 3: Integración real + cierre (AC-9 end-to-end, coverage 100% stmts en rules.ts, lint limpio)
  - Acceptance: `other.xyz` movido por regla de plugin real (AC-9);
    coverage + lint limpios; spec Implemented.
  - Verify: `bun run test:coverage` + `bun run lint`
  - Files: `tests/integration/plugin-loader.test.ts`, spec, tasks

## Estado

- [x] Todos los tasks completos → spec pasa a Status: Implemented (2026-09-04).
  Último módulo del capability map: plugin-transform.
