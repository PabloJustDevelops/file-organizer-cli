# Tasks: distribution

> Plan: [plan-distribution.md](plan-distribution.md) · Cada task = sesión enfocada,
> orden por dependencia.
> Spec: [SPEC-distribution.md](../docs/specs/SPEC-distribution.md)

- [x] Task 1: `LICENSE` + metadata legal
  - Acceptance: `LICENSE` MIT en la raíz con el holder correcto; `author` y
    `license` presentes y consistentes en `packages/cli/package.json`.
  - Verify: `bun run test` → AC-1, AC-3 en verde ✅
  - Files: `LICENSE`, `packages/cli/package.json`

- [x] Task 2: Identidad scoped + publish config + fix `prepublishOnly`
  - Acceptance: `name` = `@pablojustdevs/file-organizer-cli`;
    `publishConfig.access === "public"`; `repository`/`homepage`/`bugs`/
    `engines`/`keywords` presentes; `bin` intacto; `prepublishOnly` corre
    vitest (`bun run test`), no `bun test`.
  - Verify: `bun run test` → AC-2, AC-4, AC-7 en verde ✅
  - Files: `packages/cli/package.json`

- [x] Task 3: Higiene del tarball + test de packaging
  - Acceptance: el tarball post-build incluye `dist/**`, `README.md` y
    `LICENSE`, y excluye `src/`, `tests/`, `tools/` y `*.map`.
  - Verify: `bun run test` → AC-5 en verde ✅ (12 archivos reales)
  - Files: `packages/cli/.npmignore`, `packages/cli/LICENSE`,
    `packages/cli/README.md`,
    `packages/cli/tests/integration/packaging.test.ts`,
    `packages/cli/tests/unit/package-metadata.test.ts`

- [x] Task 4: Referencias de nombre en docs
  - Acceptance: sin referencias de instalación sin scopear en README ni en
    `PLUGINS.md`; README documenta `npm i -g` y `npx` con el nombre scoped y
    el requisito de Node; runbook ADR-0008 refleja el blocker resuelto.
  - Verify: grep sin targets de instalación unscoped ✅; AC-9
  - Files: `README.md`, `docs/PLUGINS.md`,
    `docs/decisions/0008-release-runbook.md`

- [x] Task 5: Cierre del módulo
  - Acceptance: build, suite y lint limpios; evidencia de pack y de publish
    registrada; spec → Status: Implemented.
  - Verify: `bun run build` ✅ + `bun run test` (242 passed / 1 skipped) ✅ +
    `bun run lint` (0 errores) ✅ + `npm pack --dry-run` (12 archivos) ✅ +
    `npm publish --dry-run --tag rc` (exit 0, public access) ✅
  - Files: `docs/specs/SPEC-distribution.md`,
    `.github/workflows/release.yml`

## Estado

- [x] Todos los tasks completos → spec pasa a Status: Implemented (2026-09-11).
- Extra no planificado (bug de release): `release.yml` publicaba un prerelease
  sin `--tag`, lo que npm rechaza. El publish step ahora deriva el dist-tag.
- Pendiente humano (no de código): crear/poseer el scope `@pablojustdevs`
  en npm y configurar `NPM_TOKEN`.
- Siguiente módulo del capability map: `verification` (harness E2E del binario,
  que automatiza AC-6/AC-10 e instala el tarball en un prefix aislado).
