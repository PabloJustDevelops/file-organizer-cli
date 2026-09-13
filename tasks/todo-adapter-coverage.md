# Tasks: adapter-coverage

> Plan: [plan-adapter-coverage.md](plan-adapter-coverage.md) · Cada task = sesión
> enfocada, orden por dependencia.
> Spec: [SPEC-adapter-coverage.md](../docs/specs/SPEC-adapter-coverage.md)

- [x] Task 1: Arnés compartido de tests in-process
  - Acceptance: helpers de captura de stdio, reset de `process.exitCode`, temp
    dirs con limpieza y un helper de invocación (`vi.resetModules()` +
    `parseAsync`); sin tocar código de producción.
  - Verify: `bun run lint`
  - Files: `tests/unit/cli-harness.ts`

- [x] Task 2: `src/cli/ui/output.ts` al 100%
  - Acceptance: AC-2 — `fail()` con y sin `--json`, `printJson`, `printRules`
    (vacío, deshabilitada, con condición), `printHistory` (vacío, varias),
    `printConfig`, `printWelcome`, `printFileStats` (tamaños).
  - Verify: `bunx vitest run tests/unit/cli-output.test.ts`
  - Files: `tests/unit/cli-output.test.ts`

- [x] Task 3: `src/cli/ui/prompts.ts` al 100%
  - Acceptance: AC-3 — `promptForRule` con y sin condición; `promptForCondition`
    para las cuatro ramas (regex/extension/size/date) incluidos los validadores;
    `promptForConflictResolution`, `confirmAction`, `selectRule` (vacío y
    cancelar), `promptForDirectory`.
  - Verify: `bunx vitest run tests/unit/cli-prompts.test.ts`
  - Files: `tests/unit/cli-prompts.test.ts`

- [x] Task 4: `src/mcp/server.ts` + `src/mcp/index.ts` al 100%
  - Acceptance: AC-4 — `formatResult` en sus tres formas, `createMcpServer`
    (list + call, incluida la rama de excepción), `startMcpServer` con transporte
    mockeado, y el entry que reporta el fallo por stderr con exit code 1.
  - Verify: `bunx vitest run tests/unit/mcp-server.test.ts`
  - Files: `tests/unit/mcp-server.test.ts`

- [x] Task 5: comandos `config` + `rules` al 100%
  - Acceptance: AC-5 — `config init/show/validate/example` (con y sin `--json`,
    con y sin config, y sus ramas de error), y `rules list/add/remove/test`.
  - Verify: `bunx vitest run tests/unit/cli-config-command.test.ts tests/unit/cli-rules-command.test.ts`
  - Files: `tests/unit/cli-config-command.test.ts`, `tests/unit/cli-rules-command.test.ts`

- [x] Task 6: comandos `organize` + `undo` al 100%
  - Acceptance: AC-6 — `organize` con `--dry-run`, real, `--json`, sin config,
    sin archivos, umbral de confirmación (≥20), `--interactive`, `--conflict`;
    `undo` con `--list`, historial vacío, confirmación aceptada/rechazada y error.
  - Verify: `bunx vitest run tests/unit/cli-organize-command.test.ts tests/unit/cli-undo-command.test.ts`
  - Files: `tests/unit/cli-organize-command.test.ts`, `tests/unit/cli-undo-command.test.ts`

- [x] Task 7: comandos `dedup` + `watch` al 100%
  - Acceptance: AC-7 — `dedup` sin duplicados, con duplicados en modo reporte,
    `--delete` con y sin confirmación, y el camino de fallo de borrado; `watch`
    con debounce válido/inválido, sin config, y shutdown por señal.
  - Verify: `bunx vitest run tests/unit/cli-dedup-command.test.ts tests/unit/cli-watch-command.test.ts`
  - Files: `tests/unit/cli-dedup-command.test.ts`, `tests/unit/cli-watch-command.test.ts`

- [x] Task 8: comandos `mcp` + `tui` al 100%
  - Acceptance: AC-8 — `mcp` arranca el server mockeado y reporta el fallo;
    `tui` aborta con exit 1 cuando no hay raw mode y renderiza cuando sí.
  - Verify: `bunx vitest run tests/unit/cli-mcp-command.test.ts tests/unit/cli-tui-command.test.ts`
  - Files: `tests/unit/cli-mcp-command.test.ts`, `tests/unit/cli-tui-command.test.ts`

- [x] Task 9: entry `src/cli/index.ts` al 100%
  - Acceptance: AC-9 — construcción del programa (versión, flags globales,
    comandos registrados, alias `init`) y el hook `preAction` en sus ramas
    (verbose/quiet/log-file).
  - Verify: `bunx vitest run tests/unit/cli-index.test.ts`
  - Files: `tests/unit/cli-index.test.ts`

- [x] Task 10: Cierre — gate ampliado, ADR y docs
  - Acceptance: AC-1/AC-10/AC-11 — `coverage.include` con `src/cli/**` +
    `src/mcp/**`, umbrales en 100, `bun run test:coverage` y `bun run test`
    verdes, `bun run lint` limpio, ADR-0010 escrito, spec a Implemented,
    CHANGELOG actualizado.
  - Verify: `bun run test:coverage` + `bun run lint` + `bun run build`
  - Files: `vitest.config.ts`, `docs/decisions/0010-*.md`,
    `docs/specs/SPEC-adapter-coverage.md`, `CHANGELOG.md`

## Estado

- [x] Todos los tasks completos → spec pasa a **Status: Implemented** (2026-09-12).

### Resultado

- `bun run test:coverage` → 54 archivos, 534 passed / 1 skipped, **100 / 100 / 100 / 100**,
  exit 0. Superficie: `src/core/**`, `src/utils/**`, `src/config/loader.ts`,
  `src/cli/**`, `src/mcp/**` (todo `src` menos `src/tui/**`).
- `bun run lint` → 0 errores, 0 warnings. `bun run build` → limpio.
- Se amplió solo el `include`: **ningún umbral numérico bajó** (la superficie nueva
  llegó a 100 en el mismo cambio). Registrado en ADR-0010.

### Decisiones que cambiaron durante la ejecución

- **OQ-1 resuelto cubriendo, no excluyendo**: los entry points (`src/cli/index.ts`,
  `src/mcp/index.ts`) se cubren in-process stubbeando su llamada terminal
  (`Command.prototype.parse`) y mockeando el transporte stdio.
- **El aislamiento del home necesitó un mock de `os.homedir()`.** Mudar
  `HOME`/`USERPROFILE` no alcanzaba: `HistoryStore` captura el home al importar el
  módulo y Node **cachea `os.homedir()`** por proceso, así que el historial seguía
  escribiéndose en el `~/.file-organizer` real. Los módulos adaptadores se importan
  siempre con `vi.resetModules()` + `import()` dinámico **después** de aislar.
- **`from: 'user'` en `parseAsync` interpreta el array como argumentos**, no como
  `[node, script, ...]`. En un comando hoja (`organizeCommand`) un `'organize'`
  inicial se consume como `[source]` — quedó documentado en `runCommand`.
- **`process.chdir` no existe en workers de vitest**: el cwd determinista se logra
  con un spy sobre `process.cwd`.

### Defectos encontrados al medir (rama muerta, no forzada)

1. `src/cli/commands/watch.ts` — el ternario de `pluginBaseDir` tenía su rama
   `undefined` inalcanzable: el `return` del camino "sin config" ya garantiza que
   `configPath` es truthy.
2. `src/cli/commands/watch.ts` — el `catch` de `--debounce` llevaba un fallback
   no-`Error` inalcanzable: `parseDebounce` es local y solo lanza `Error`.

Ambos se eliminaron usando el helper compartido `errorMessage(err)` — la misma
política del ciclo 2 (borrar ramas muertas en vez de escribir tests artificiales
alrededor). El cambio de comportamiento es nulo.
