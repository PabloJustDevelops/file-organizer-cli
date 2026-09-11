# Tasks: verification

> Plan: [plan-verification.md](plan-verification.md) · Cada task = sesión enfocada,
> orden por dependencia.
> Spec: [SPEC-verification.md](../docs/specs/SPEC-verification.md)

- [x] Task 1: Helpers del arnés E2E
  - Acceptance: `runCli(args, cwd, home)` spawnea `process.execPath` +
    `dist/cli/index.js` sin shell, con `HOME`/`USERPROFILE` al temp dir;
    utilidades de temp dir/config/limpieza exportadas.
  - Verify: `bun run lint` ✅ (typecheck incluido)
  - Files: `tests/e2e/helpers.ts`

- [x] Task 2: globalSetup + registro en vitest
  - Acceptance: `bun run test` compila una vez antes de los tests; el binario
    existe cuando arrancan los E2E.
  - Verify: `bun run test` → AC-10 ✅
  - Files: `tests/e2e/global-setup.ts`, `vitest.config.ts`

- [x] Task 3: Happy paths del CLI
  - Acceptance: AC-1…AC-8 — version, help, config init/validate, organize
    dry-run (sin mutación), organize real (archivos en destino), undo
    (restaurados), rules list, dedup (sin borrar).
  - Verify: `bunx vitest run tests/e2e` → 7/7 verdes ✅
  - Files: `tests/e2e/cli.test.ts`

- [x] Task 4: Install smoke del tarball
  - Acceptance: AC-9 — `npm pack` real + install en prefix temporal; los shims
    `fo`/`file-organizer`/`fo-tui` existen y el entry instalado corre
    `--version` con exit 0.
  - Verify: `bunx vitest run tests/e2e` → AC-9 verde ✅
  - Files: `tests/e2e/install.test.ts`

- [x] Task 5: Cierre del módulo
  - Acceptance: suite y lint limpios; spec → Status: Implemented; AC-6/AC-10 de
    `distribution` cubiertos por esta automatización.
  - Verify: `bun run test` (26 files, 250 passed / 1 skipped) ✅ +
    `bun run lint` (0 errores, 93 files) ✅
  - Files: `docs/specs/SPEC-verification.md`,
    `docs/specs/SPEC-distribution.md`

## Estado

- [x] Todos los tasks completos → spec pasa a Status: Implemented (2026-09-11).

### Defecto de `distribution` encontrado por el arnés

El arnés hizo exactamente su trabajo: `dist/cli/index.js` importaba `react`/`ink`
**estáticamente** porque `cli/index.ts` registra `tuiCommand`, y bajo el
`node_modules` aislado de bun `react` no era resoluble → `fo --version` abortaba
con `ERR_MODULE_NOT_FOUND`. El install smoke se salvaba solo porque npm
auto-instala el peer `react` de ink. Arreglado en `distribution`:

- `src/cli/commands/tui.ts` → `import()` diferido de `ink`/`react`/`App` dentro
  del action, así el CLI no exige el stack TUI.
- `packages/cli/package.json` → `react` pasa a dependencia directa (peer no
  opcional de ink) para que `fo-tui` funcione en cualquier gestor.

### Nota de rendimiento

`bun run test` ahora compila en `globalSetup` (OQ-1): la suite pasó de ~4 s a
~36 s. Si el loop se vuelve molesto, OQ-2 propone separar `test:e2e`.
