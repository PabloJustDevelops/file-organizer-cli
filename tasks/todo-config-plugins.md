# Tasks: config-plugins

> Plan: [plan.md](plan.md) · Cada task = sesión enfocada, orden por dependencia.
> Spec: [SPEC-config-plugins.md](../docs/specs/SPEC-config-plugins.md)

- [x] Task 1: Tipos + validación C1–C3 + JSON Schema
  - Acceptance: `OrganizeConfig.plugins?: string[]`; mensajes de error con
    índice (`plugins[1] must be a non-empty string`, `duplicates "./a.js"`);
    `CONFIG_SCHEMA` con `plugins`.
  - Verify: `bun run test` → AC-1…AC-6 en verde en config-loader.test.ts
  - Files: `src/types/index.ts`, `src/config/loader.ts`, `src/config/schema.ts`,
    `tests/unit/config-loader.test.ts`

- [x] Task 2: Consumo en Organizer + idempotencia + edges inyectables
  - Acceptance: `organize()` carga `plugins` (flat o config) antes de
    escanear; specs repetidos se cargan una sola vez por instancia;
    `pluginEdges` en constructor; fallo aborta sin escanear ni mover.
  - Verify: `bun run test` → AC-7, AC-8, AC-9 + test de idempotencia en verde
  - Files: `src/core/organizer.ts`, `tests/integration/organizer-options.test.ts`

- [x] Task 3: Wiring CLI (organize + watch)
  - Acceptance: `fo organize` pasa `plugins` y `pluginBaseDir` =
    dirname del config resuelto; `watch.ts` ídem si FolderWatcher lo permite.
  - Verify: `bun run lint` (tsc verifica el wiring); revisión de FolderWatcher
  - Files: `src/cli/commands/organize.ts`, `src/cli/commands/watch.ts`

- [x] Task 4: Integración real + cierre (README y RULES.md documentados)
  - Acceptance: YAML real en temp dir + plugin real cargado end-to-end
    (AC-10); spec rota lanza y el directorio queda byte-idéntico (AC-11);
    specs config-relativos resuelven contra pluginBaseDir (AC-12 ajustado).
  - Verify: `bun run test:coverage` + `bun run lint` (gate CI completo)
  - Files: `tests/integration/plugin-loader.test.ts`, docs si procede

## Estado

- [x] Todos los tasks completos → spec pasa a Status: Implemented (2026-09-04).
  Siguientes módulos del capability map (independientes): plugin-hooks,
  plugin-rules, plugin-transform.
