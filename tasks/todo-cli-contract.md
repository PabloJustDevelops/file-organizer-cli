# Tasks: cli-contract

> Plan: [plan-cli-contract.md](plan-cli-contract.md) · Cada task = sesión enfocada,
> orden por dependencia.
> Spec: [SPEC-cli-contract.md](../docs/specs/SPEC-cli-contract.md)

- [x] Task 1: Helpers `fail()` y `printJson()` en `ui/output.ts`
  - Acceptance: `fail(msg, json)` loguea a stderr y setea `process.exitCode = 1`
    (o escribe `{error}` a stdout en modo JSON); `printJson(value)` escribe JSON
    plano sin color.
  - Verify: `bun run lint` ✅
  - Files: `src/cli/ui/output.ts`

- [x] Task 2: Conversión de exit codes en los comandos
  - Acceptance: ningún fallo sale 0 — `organize`/`watch` sin config;
    `rules list/add/remove/test` sin config y en catch; `config init/show/validate`
    sin config y en catch. Éxitos siguen en 0.
  - Verify: `bun run test` → AC-1…AC-6 + AC-13 ✅
  - Files: `src/cli/commands/{organize,watch,rules,config}.ts`

- [x] Task 3: `--json` en `organize`
  - Acceptance: flag añadido; modo no interactivo (implica `-y`); logger de info
    suprimido; payload `{dryRun,moved,skipped,errors,pluginErrors?}` en éxito y
    en "no hay archivos"; fallo → `{error}` + exit 1.
  - Verify: `bun run test` → AC-7, AC-8, AC-9, AC-12, AC-14 ✅
  - Files: `src/cli/commands/organize.ts`

- [x] Task 4: `--json` en `rules list` y `config show`
  - Acceptance: `rules list --json` → array de reglas; `config show --json` →
    objeto de config; ambos sin logs ni color; fallo → `{error}` + exit 1.
  - Verify: `bun run test` → AC-10, AC-11 ✅
  - Files: `src/cli/commands/{rules,config}.ts`

- [x] Task 5: E2E de contrato + docs
  - Acceptance: `tests/e2e/cli-contract.test.ts` cubre AC-1…AC-12 y AC-14;
    README documenta `--json` y los exit codes.
  - Verify: `bunx vitest run tests/e2e/cli-contract.test.ts` → 12/12 ✅
  - Files: `tests/e2e/cli-contract.test.ts`, `README.md`,
    `packages/cli/README.md`

- [x] Task 6: Cierre del módulo
  - Acceptance: suite y lint limpios; spec → Status: Implemented.
  - Verify: `bun run test` (27 files, 262 passed / 1 skipped) ✅ +
    `bun run lint` (0 errores, 94 files) ✅
  - Files: `docs/specs/SPEC-cli-contract.md`

## Estado

- [x] Todos los tasks completos → spec pasa a Status: Implemented (2026-09-11).
- Implementación sin tocar `src/cli/index.ts`: el modo JSON silencia el logger
  por comando (`setLogLevel('error')`), no globalmente.
- `undo` con historial vacío y `dedup` sin duplicados siguen en exit 0
  (no-op exitoso, fuera de alcance).
- Nota: errores parciales de `organize` (archivos que fallan individualmente)
  siguen reportándose en el payload con exit 0; cambiarlo excede este spec.
- Siguiente módulo: `safe-mutations` (dedup reversible, ignores de watch
  derivados de destinos, cableado de `--debounce`).
