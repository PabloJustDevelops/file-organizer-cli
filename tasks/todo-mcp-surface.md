# Tasks: mcp-surface

> Plan: [plan-mcp-surface.md](plan-mcp-surface.md) · Cada task = sesión enfocada,
> orden por dependencia.
> Spec: [SPEC-mcp-surface.md](../docs/specs/SPEC-mcp-surface.md)

- [x] Task 1: `buildOrganizeOptions` en el core
  - Acceptance: resolutor puro override > config > default; `recursive` default
    `false`; arrastra `config` (rules/locale/sizeBuckets/plugins) y
    `pluginBaseDir` cuando se pasa.
  - Verify: `bun run test` → AC-11 ✅
  - Files: `src/core/organize-options.ts`, `tests/unit/organize-options.test.ts`

- [x] Task 2: CLI y MCP usan el builder
  - Acceptance: `organize.ts` y `handleToolCall` resuelven por el mismo camino;
    el MCP honra `recursive`, `plugins`, `locale`, `sizeBuckets` de la config.
  - Verify: `bun run test` → AC-5…AC-8 ✅
  - Files: `src/cli/commands/organize.ts`, `src/mcp/server.ts`,
    `tests/integration/mcp-handlers.test.ts`

- [x] Task 3: MCP sin efectos al importar + versión real
  - Acceptance: importar `src/mcp/server.ts` no arranca nada ni escribe a stdout;
    `createMcpServer()`/`startMcpServer()` exportados; versión desde
    `package.json`.
  - Verify: `bun run test` → AC-12, AC-13 ✅
  - Files: `src/mcp/server.ts`

- [x] Task 4: Entrypoints (bin + `fo mcp`)
  - Acceptance: `file-organizer-mcp` en `bin` apuntando a `dist/mcp/index.js`;
    comando `mcp` registrado en el CLI; stdout limpio (logger en `error`).
  - Verify: `bun run test` → AC-1…AC-4 ✅
  - Files: `src/mcp/index.ts`, `src/cli/commands/mcp.ts`, `src/cli/index.ts`,
    `tsup.config.ts`, `packages/cli/package.json`

- [x] Task 5: `add_rule` valida
  - Acceptance: regla inválida → error MCP y config intacta; regla válida →
    persistida y validable.
  - Verify: `bun run test` → AC-9, AC-10 ✅
  - Files: `src/mcp/server.ts`, `tests/integration/mcp-handlers.test.ts`

- [x] Task 6: Docs de consumo
  - Acceptance: `docs/MCP.md` con la config de cliente, la lista de tools y el
    default `dryRun: true`; puntero desde `README.md`.
  - Verify: `bun run test` → AC-14 ✅
  - Files: `docs/MCP.md`, `README.md`, `tests/unit/docs.test.ts`

- [x] Task 7: E2E del handshake
  - Acceptance: spawn del binario construido + initialize/initialized/tools/list
    con JSON-RPC válido y sin contaminación de stdout.
  - Verify: `bunx vitest run tests/e2e/mcp.test.ts` → AC-2, AC-3, AC-12, AC-13 ✅
  - Files: `tests/e2e/mcp.test.ts`

- [x] Task 8: Cierre del módulo
  - Acceptance: gates verdes; spec → Implemented.
  - Verify: `bun run test:coverage` (34 files, 315 passed / 1 skipped, branch 91.59%) ✅ +
    `bun run lint` (0 errores, 104 files) ✅
  - Files: `docs/specs/SPEC-mcp-surface.md`

## Estado

- [x] Todos los tasks completos → spec pasa a Status: Implemented (2026-09-11).
- Hallazgo: el MCP no era solo inalcanzable — resolvía la config distinto que el
  CLI (ignoraba recursive/plugins/locale/sizeBuckets y hardcodeaba
  `recursive: true` en preview). Se arregló en el core con
  `buildOrganizeOptions`, compartido por ambos adaptadores.
- Siguiente módulo del capability map: `governance`.
