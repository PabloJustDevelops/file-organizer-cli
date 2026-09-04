# Tasks: plugin-hooks

> Plan: [plan.md](plan.md) · Spec: SPEC-plugin-hooks.md

- [x] Task 1: Tipos + runners puros (hooks.ts 100% cobertura)
  - Acceptance: `PluginHookError`, `runBeforeOrganize`, `runAfterOrganize`;
    barrel actualizado; types re-exporta.
  - Verify: AC-1, AC-2, AC-6, AC-7, AC-9, AC-10 en verde (unit puros)
  - Files: `src/core/plugins/hooks.ts`, `src/core/plugins/index.ts`,
    `src/types/index.ts`, `tests/unit/plugins/hooks.test.ts`

- [x] Task 2: Wiring en Organizer
  - Acceptance: before tras scan, after tras loop+history; errores mergeados
    a `result.pluginErrors`; sin plugins → campo ausente.
  - Verify: AC-3, AC-4, AC-5 en verde (organizer-options.test.ts)
  - Files: `src/core/organizer.ts`

- [x] Task 3: Integración real + cierre
  - Acceptance: fixture real cuyo beforeOrganize escribe marker (AC-8);
    cobertura y lint limpios; spec a Implemented.
  - Verify: `bun run test:coverage` + `bun run lint`
  - Files: `tests/integration/plugin-loader.test.ts`, spec, tasks

## Estado

- [x] Todos los tasks completos → spec pasa a Status: Implemented (2026-09-04).
  Siguientes módulos (independientes): plugin-rules, plugin-transform.
