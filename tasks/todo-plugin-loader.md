# Tasks: plugin-loader

> Plan: [plan.md](plan.md) · Cada task = sesión enfocada, orden por dependencia.
> Spec: [SPEC-plugin-loader.md](../docs/specs/SPEC-plugin-loader.md)

- [x] Task 1: Taxonomía de errores + `register`/`list` con dedup
  - Acceptance: 4 clases de error nuevas; `register()` valida vía
    `validatePlugin`, rechaza duplicados con `DuplicatePluginError`,
    `list()` es snapshot readonly.
  - Verify: `bun run test` → AC-1, AC-2, AC-3 en verde
  - Files: `src/core/plugins/loader.ts`, `tests/unit/plugins/loader.test.ts`,
    `src/core/plugins/index.ts`

- [x] Task 2: `load()` routing + archivos locales
  - Acceptance: specs locales (`./`, `../`, absolutos) se resuelven contra
    `baseDir`; archivo inexistente → `PluginNotFoundError` sin llamar a
    `importModule`; fallo de import → `PluginLoadError` con `cause`.
  - Verify: `bun run test` → AC-4, AC-5, AC-8 en verde
  - Files: ídem Task 1

- [x] Task 3: Routing npm con `createRequire` enraizado en `baseDir`
  - Acceptance: bare specifier se resuelve vía edge `resolvePackage`
    (default: `createRequire(baseDir/package.json).resolve`); paquete no
    instalado → `PluginNotFoundError` con el nombre del paquete.
  - Verify: `bun run test` → AC-6, AC-7 en verde
  - Files: ídem Task 1

- [x] Task 4: Export missing + propagación de validación + dedup vía load
  - Acceptance: namespace sin default → `PluginExportError`; default
    inválido → el `PluginFieldError`/`PluginTypeError` original cruza
    `load()`; plugin cargado con nombre duplicado → `DuplicatePluginError`;
    nada queda registrado en ningún fallo.
  - Verify: `bun run test` → AC-9, AC-10, AC-11 en verde
  - Files: ídem Task 1

- [x] Task 5: `Organizer.loadPlugin()` + integración real + cierre (100% cobertura en loader.ts, lint limpio)
  - Acceptance: `organizer.loadPlugin(valid)` registra (AC-12); fixture real
    en temp dir se carga end-to-end con edges reales vía `import()` nativo
    (AC-13); cobertura de `loader.ts` sin huecos; lint limpio.
  - Verify: `bun run test:coverage` + `bun run lint` (gate CI completo)
  - Files: + `src/core/organizer.ts`,
    `tests/integration/plugin-loader.test.ts`

## Estado

- [x] Todos los tasks completos → spec pasa a Status: Implemented (2026-09-04).
  Siguiente módulo del capability map: `config-plugins`.
