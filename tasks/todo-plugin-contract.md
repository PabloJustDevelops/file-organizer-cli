# Tasks: plugin-contract

> Plan: [plan.md](plan.md) · Cada task = sesión enfocada, orden por dependencia.

- [x] Task 1: Jerarquía de errores + regla V1
  - Acceptance: `PluginError`, `PluginTypeError`, `PluginFieldError` (con
    `pluginName?`, `field?`) existen; `validatePlugin(null|undefined|string|number|array)`
    lanza `PluginTypeError`.
  - Verify: `bun run test` → AC-2 y AC-8 en verde
  - Files: `src/core/plugins/contract.ts`, `tests/unit/plugins/contract.test.ts`

- [x] Task 2: Reglas V2 (name kebab-case) + V3 (version semver)
  - Acceptance: nombres inválidos (vacío, CamelCase, espacios) →
    `PluginFieldError` con `field: 'name'`; versiones no-semver (`"1.0"`,
    `"abc"`) → `PluginFieldError` con `field: 'version'`; semver con
    prerelease válido pasa.
  - Verify: `bun run test` → AC-3 y AC-4 en verde
  - Files: ídem Task 1

- [x] Task 3: Regla V4 (tipos de miembros opcionales) + V5 (sin mutación)
  - Acceptance: hook no-función → `PluginFieldError` con `field` del miembro;
    objeto válido se devuelve por referencia intacta (mismo objeto, extras
    preservados).
  - Verify: `bun run test` → AC-5, AC-6, AC-1 en verde
  - Files: ídem Task 1

- [x] Task 4: Plugin mínimo válido + barrel + re-export desde types
  - Acceptance: plugin solo con `name`+`version` pasa (AC-7);
    `src/core/plugins/index.ts` re-exporta contrato;
    `types/index.ts` re-exporta `OrganizerPlugin` desde contract.ts sin
    duplicar definición.
  - Verify: `bun run test` → AC-7 en verde; `bun run lint` → tsc sin errores
    de imports rotos
  - Files: ídem + `src/core/plugins/index.ts`, `src/types/index.ts`

- [x] Task 5: Cierre — cobertura y lint (100% stmts/lines/funcs en contract.ts, lint 0 errores)
  - Acceptance: todos los ACs (AC-1…AC-8) en verde; cobertura de
    `contract.ts` sin líneas sin cubrir en la rama de errores.
  - Verify: `bun run test:coverage` + `bun run lint` limpios (gate CI completo)
  - Files: solo ajustes si algo queda descubierto

## Estado

- [x] Todos los tasks completos → spec pasa a Status: Implemented (2026-09-04).
  Siguiente módulo del capability map: `plugin-loader`.
