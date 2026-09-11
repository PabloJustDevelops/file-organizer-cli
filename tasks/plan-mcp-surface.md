# Plan: mcp-surface

> Spec: [SPEC-mcp-surface.md](../docs/specs/SPEC-mcp-surface.md)
> OQ-1 dos entrypoints, OQ-2 extraer el builder compartido, OQ-3 `dryRun` sigue en `true`
> Fase 2 del proceso spec-driven-development · Módulo 2 del
> [capability map](../docs/specs/CAPABILITY-MAP-cli-cycle2.md)

## Componentes y orden

1. **`buildOrganizeOptions`** (`src/core/organize-options.ts`): resolutor puro
   override > config > default; pasa `config` completo para arrastrar `rules`,
   `locale`, `sizeBuckets`, `plugins`.
2. **Cablearlo en el CLI** (`organize.ts`) y en el MCP (`handleToolCall`): una
   sola resolución para los dos adaptadores.
3. **MCP sin efectos al importar** (`src/mcp/server.ts`): `createMcpServer()` +
   `startMcpServer()`; sin `main()` de nivel superior; versión desde
   `package.json`.
4. **Entrypoints**: `src/mcp/index.ts` (bin `file-organizer-mcp`) y
   `src/cli/commands/mcp.ts` (`fo mcp`, logger en `error`, aviso por stderr).
5. **`add_rule` valida** con `validateRuleCore` antes de escribir.
6. **Docs**: `docs/MCP.md` + puntero en `README.md`.
7. **Tests**: unit (builder, import sin efectos), integración (paridad),
   E2E (handshake JSON-RPC contra el binario), packaging (el entry viaja).
8. **Cierre** — gates verdes; spec → Implemented.

## Decisiones técnicas

- **Un builder compartido, no dos resoluciones:** el bug de paridad de hoy es
  exactamente que el MCP resolvió distinto que el CLI; arreglarlo en el core y
  re-superficializarlo es lo que manda la Constitución (Art. II/VII).
- **Pasar `config` entero a `organize()`** en vez de reenviar campos sueltos:
  `organize()` ya lee `rules`, `locale`, `sizeBuckets` y `plugins` desde
  `config`; así no hay lista de campos que se desincronice.
- **`src/mcp/index.ts` separado del módulo servidor:** permite que `server.ts`
  sea importable (tests, `fo mcp`) sin arrancar nada, y deja el binario como el
  único punto que ejecuta.
- **Bin además de `fo mcp`:** los clientes MCP configuran `command` + `args`; un
  binario con nombre propio es el target estándar y no depende de que `fo` esté
  en el PATH.
- **`fo mcp` silencia el logger** (`setLogLevel('error')`) y avisa por
  `console.error`: stdout es el canal del protocolo, no un log.
- **`add_rule` valida en el borde:** el MCP es una frontera externa; escribir
  config sin validar contradice Art. VI.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Romper la firma de `handleToolCall` (tests existentes) | Se conserva `(name, args, options)`; solo cambia la resolución interna |
| El handshake E2E depende del SDK | Se habla JSON-RPC a mano por stdio (initialize/initialized/tools/list); sin dependencias extra |
| Salida no-JSON contaminando stdout | AC-3 lo verifica parseando cada línea de stdout |
| Cambiar `tsup` rompe el tarball (test de packaging) | Se **agrega** `mcp/index` y se mantiene `mcp/server`; AC-1 y el test de packaging lo cubren |
| Duplicar el bin en `fo mcp` y el binario | Ambos llaman a `startMcpServer()`; sin lógica propia |

## Puntos de verificación

- Tras Task 1-3: AC-11, AC-12 en verde.
- Tras Task 4-6: AC-1…AC-4, AC-13, AC-14.
- Tras Task 5: AC-9, AC-10.
- Cierre: AC-5…AC-8 + gates completos.
