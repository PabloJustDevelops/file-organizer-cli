# Tasks: adoption-docs

> Plan: [plan-adoption-docs.md](plan-adoption-docs.md) · Cada task = sesión
> enfocada, orden por dependencia.
> Spec: [SPEC-adoption-docs.md](../docs/specs/SPEC-adoption-docs.md)

- [x] Task 1: `CHANGELOG.md`
  - Acceptance: Keep a Changelog headings; entrada `[0.1.0] - unreleased` con
    scoped name, LICENSE, `--json`/exit codes, dedup undo, watch fixes, E2E.
  - Verify: `tests/unit/docs.test.ts` + revisión ✅
  - Files: `CHANGELOG.md`

- [x] Task 2: `CONTRIBUTING.md`
  - Acceptance: prerequisitos (bun), `bun install`/`test`/`lint`/`build`, flujo
    spec-before-code, política de ADRs, gates de CI.
  - Verify: `tests/unit/docs.test.ts` + revisión ✅
  - Files: `CONTRIBUTING.md`

- [x] Task 3: README raíz onboarding-first
  - Acceptance: requisitos (Node >=18) antes de instalar; sección TUI con caveat
    de Windows; Troubleshooting (sin config, config inválida, variables
    desconocidas, flags de watch); comandos solo implementados.
  - Verify: revisión contra `fo --help` ✅
  - Files: `README.md`

- [x] Task 4: README del paquete en paridad
  - Acceptance: la tabla de comandos coincide con el set soportado del raíz.
  - Verify: revisión ✅ (ambos listan dedup y fo-tui)
  - Files: `packages/cli/README.md`

- [x] Task 5: `tests/unit/docs.test.ts`
  - Acceptance: asserta presencia de `CHANGELOG.md`/`CONTRIBUTING.md` y los
    headings clave del README y del CHANGELOG.
  - Verify: `bun run test` → 4/4 ✅
  - Files: `tests/unit/docs.test.ts`

- [x] Task 6: Cierre del módulo
  - Acceptance: suite y lint limpios; spec → Implemented.
  - Verify: `bun run test` (30 files, 277 passed / 1 skipped) ✅ +
    `bun run lint` (0 errores, 97 files) ✅
  - Files: `docs/specs/SPEC-adoption-docs.md`

## Estado

- [x] Todos los tasks completos → spec pasa a Status: Implemented (2026-09-11).
- [x] **Ciclo 1 del capability map completo** (5/5 módulos).
- Deuda diferida al ciclo 2, registrada en el capability map:
  `config-integrity`, `governance`, `mcp-surface`.
- Pendiente humano (no de código): poseer el scope `@pablojustdevs` en npm,
  configurar `NPM_TOKEN`, y el PR de versión `0.1.0`.
