# Tasks: governance

> Plan: [plan-governance.md](plan-governance.md) · Cada task = sesión enfocada,
> orden por dependencia.
> Spec: [SPEC-governance.md](../docs/specs/SPEC-governance.md)

- [x] Task 1: ADR-0009 (enmienda de la Constitución)
  - Acceptance: ADR-0009 documenta por qué la línea de `PLUGINS.md` era falsa y
    qué la reemplaza; enlazado desde la enmienda.
  - Verify: revisión ✅
  - Files: `docs/decisions/0009-constitution-plugin-status.md`

- [x] Task 2: Corregir `docs/constitution.md`
  - Acceptance: Art. III ya no acusa a `PLUGINS.md` de no estar implementado; la
    regla planned-vs-shipped sigue.
  - Verify: `bun run test` → AC-3 ✅
  - Files: `docs/constitution.md`

- [x] Task 3: Archivar los huérfanos
  - Acceptance: `tasks/plan.md` y `tasks/todo.md` ya no existen; las copias con
    cabecera *Superseded* viven en `tasks/archive/`; hay un README que lo explica.
  - Verify: `bun run test` → AC-4, AC-5 ✅
  - Files: `tasks/archive/*`, borrado de `tasks/plan.md`, `tasks/todo.md`

- [x] Task 4: Cinco specs retroactivas
  - Acceptance: `SPEC-organize|watch|undo|dedup|config.md` con Objective,
    Non-goals y tabla de ACs que nombra tests reales.
  - Verify: `bun run test` → AC-1, AC-2, AC-6 ✅
  - Files: `docs/specs/SPEC-{organize,watch,undo,dedup,config}.md`

- [x] Task 5: Guardas en `docs.test.ts`
  - Acceptance: los checks de AC-1…AC-6 pasan.
  - Verify: `bun run test` → 11/11 en `docs.test.ts` ✅
  - Files: `tests/unit/docs.test.ts`

- [x] Task 6: Cierre del módulo
  - Acceptance: gates verdes; spec → Implemented.
  - Verify: `bun run test:coverage` (34 files, 320 passed / 1 skipped, branch 91.62%) ✅ +
    `bun run lint` (0 errores) ✅
  - Files: `docs/specs/SPEC-governance.md`

## Estado

- [x] Todos los tasks completos → spec pasa a Status: Implemented (2026-09-11).
- [x] **Ciclo 2 completo** (3/3 módulos: config-integrity, mcp-surface, governance).
- La guarda de AC-5 se auto-aplicó: cazó una referencia mía al spec eliminado en
  el propio plan de governance, y se corrigió.
- Pendiente único del objetivo: publicar a npm cuando el usuario confirme el
  token con Bypass 2FA.
