# Tasks: safe-mutations

> Plan: [plan-safe-mutations.md](plan-safe-mutations.md) · Cada task = sesión
> enfocada, orden por dependencia.
> Spec: [SPEC-safe-mutations.md](../docs/specs/SPEC-safe-mutations.md)

- [x] Task 1: `HistoryStore.moveToBackup`
  - Acceptance: mueve el archivo a `<historyDir>/dedup/<uuid><ext>` y devuelve
    la ruta del backup; el original desaparece; extensión preservada.
  - Verify: `bun run test` → AC-11 ✅
  - Files: `src/utils/history-store.ts`, `tests/unit/history-store.test.ts`

- [x] Task 2: `Organizer.backupForRemoval` + `recordRemovals`
  - Acceptance: persiste una `UndoEntry` con las operaciones dadas, respetando
    `historySize`; no escanea ni mueve archivos.
  - Verify: `bun run test` → AC-4 ✅
  - Files: `src/core/organizer.ts`

- [x] Task 3: `dedup --delete` reversible
  - Acceptance: `-y/--yes`; `--delete` mueve cada duplicado a backup y registra
    la entrada; fallo por archivo reportado y exit 1 si hubo alguno; sin
    `--delete` sigue siendo solo lectura (AC-1 en `cli.test.ts`).
  - Verify: `bun run test` → AC-2, AC-3, AC-4 ✅
  - Files: `src/cli/commands/dedup.ts`

- [x] Task 4: Ignores derivados de `destination` (+ exclusión del scan)
  - Acceptance: `buildDestinationIgnores` cubre los primeros segmentos;
    `buildDestinationDirs` resuelve prefijos estáticos; `DEFAULT_IGNORES` sin
    nombres de destino; `ignored` como función que aprende `moved.to`; el scan
    excluye los directorios de destino (`ScanOptions.excludeDirs`).
  - Verify: `bun run test` → AC-5, AC-6 ✅
  - Files: `src/core/watcher.ts`, `src/core/file-scanner.ts`,
    `tests/unit/watcher.test.ts`, `tests/integration/watcher.test.ts`

- [x] Task 5: `--debounce` y pase inicial de `watch`
  - Acceptance: `parseDebounce` valida entero > 0; `watch` lo cablea (default
    1000); `organizeOnStart` (default true) corre un pase al arrancar y
    `--no-initial` lo desactiva.
  - Verify: `bun run test` → AC-7, AC-8, AC-9, AC-10 ✅
  - Files: `src/cli/commands/watch.ts`, `src/core/watcher.ts`,
    `tests/integration/watcher.test.ts`

- [x] Task 6: E2E de safe-mutations
  - Acceptance: dedup delete → undo round trip y `--debounce abc` → exit 1.
  - Verify: `bunx vitest run tests/e2e/safe-mutations.test.ts` ✅
  - Files: `tests/e2e/safe-mutations.test.ts`

- [x] Task 7: Docs + cierre
  - Acceptance: README documenta que `dedup --delete` es reversible y los flags
    de watch; suite y lint limpios; spec → Implemented.
  - Verify: `bun run test` (29 files, 273 passed / 1 skipped) ✅ +
    `bun run lint` (0 errores, 96 files) ✅
  - Files: `README.md`, `packages/cli/README.md`,
    `docs/specs/SPEC-safe-mutations.md`

## Estado

- [x] Todos los tasks completos → spec pasa a Status: Implemented (2026-09-11).
- Corrección de diseño durante la implementación: los ignores de chokidar solo
  filtran eventos, no el escaneo. Añadido `ScanOptions.excludeDirs` +
  `buildDestinationDirs` para que el propio output no se re-escanee.
- El watcher deriva destinos del organizer (una sola fuente de verdad); `watch.ts`
  ya no calcula ignores.
- Nota: backups de dedup comparten el history dir; su limpieza periódica queda
  como deuda futura (documentada en la spec).
- Siguiente módulo: `adoption-docs` (README de onboarding, CHANGELOG,
  CONTRIBUTING).
