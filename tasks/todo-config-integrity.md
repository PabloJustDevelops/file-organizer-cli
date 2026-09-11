# Tasks: config-integrity

> Plan: [plan-config-integrity.md](plan-config-integrity.md) · Cada task = sesión
> enfocada, orden por dependencia.
> Spec: [SPEC-config-integrity.md](../docs/specs/SPEC-config-integrity.md)

- [x] Task 1: Regex + `patterns[]` en `validateRuleCore`
  - Acceptance: `condition.pattern` inválido lanza nombrando la regla; `type:
    regex` sin pattern lanza; cada elemento de `patterns[]` debe ser string no
    vacío (con índice); el resto de condiciones intacto.
  - Verify: `bun run test` → AC-1…AC-6 ✅
  - Files: `src/core/rule-validation.ts`, `tests/unit/config-loader.test.ts`

- [x] Task 2: Eliminar `condition.match`
  - Acceptance: el campo ya no existe en `RuleCondition`, `CONFIG_SCHEMA` ni en
    la validación; `tsc --noEmit` limpio.
  - Verify: `bun run lint` + AC-10 ✅
  - Files: `src/types/index.ts`, `src/config/schema.ts`,
    `src/core/rule-validation.ts`

- [x] Task 3: Unificar default de `recursive`
  - Acceptance: `recursive` ausente → `false`; `true` explícito → `true`;
    `getExampleConfig()` sigue en `false`; CHANGELOG anota el cambio.
  - Verify: `bun run test` → AC-7…AC-9 ✅
  - Files: `src/config/loader.ts`, `CHANGELOG.md`

- [x] Task 4: `RULES.md` fiel al motor
  - Acceptance: documenta `{yearMonth}`, `{parent}`, `{sizeBucket}`, `{now:…}`,
    `{match}`, la insensibilidad a mayúsculas, y los knobs (`recursive` default,
    `dryRun`, `includeHidden`, `locale`, `sizeBuckets`).
  - Verify: `bun run test` → AC-14 ✅
  - Files: `docs/RULES.md`, `tests/unit/docs.test.ts`

- [x] Task 5: E2E `fo config validate` + ejemplos
  - Acceptance: config con regex inválido → exit 1 y stderr nombra la regla;
    config válido → exit 0; `config-examples/advanced.yaml` valida.
  - Verify: `bunx vitest run tests/e2e/config-integrity.test.ts` → AC-12, AC-13, AC-16 ✅
  - Files: `tests/e2e/config-integrity.test.ts`

- [x] Task 6: Aislamiento por regla en plugins (AC-15)
  - Acceptance: una regla de plugin con regex inválido se reporta como fallo por
    regla y el run continúa.
  - Verify: `bun run test` → AC-15 ✅
  - Files: `tests/unit/plugins/rules.test.ts`

- [x] Task 7: Cierre del módulo
  - Acceptance: suite y lint verdes; spec → Status: Implemented.
  - Verify: `bun run test:coverage` (32 files, 301 passed / 1 skipped, branch 91.05%) ✅ +
    `bun run lint` (0 errores, 99 files) ✅
  - Files: `docs/specs/SPEC-config-integrity.md`

## Estado

- [x] Todos los tasks completos → spec pasa a Status: Implemented (2026-09-11).
- Extra no planificado: bug de documentación destapado por la validación nueva —
  `(?i)` (inline flag, inválido en JS) en `RULES.md` y en
  `config-examples/advanced.yaml`; corregido, más AC-16 que valida todo ejemplo.
- Siguiente módulo del capability map: `mcp-surface`.
