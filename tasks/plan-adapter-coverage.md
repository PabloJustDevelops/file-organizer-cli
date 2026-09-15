# Plan: adapter-coverage

> Spec: [SPEC-adapter-coverage.md](../docs/specs/SPEC-adapter-coverage.md)
> (Draft 2026-09-12; OQ-1 = cubrir los entry points con stub del parse,
> OQ-2 = forma + valor donde sea barato)
> Fase 2 del proceso spec-driven-development · Iniciativa de una sola capacidad
> (Phase 0 omitida: un consumidor — el gate de CI — y un entregable)

## Componentes y orden

1. **Arnés compartido** (`tests/unit/cli-harness.ts`) — captura de `console.*` y
   `process.stdout.write`, reset de `process.exitCode`, temp dirs con limpieza, y
   un helper de invocación (`vi.resetModules()` + `parseAsync`).
2. **`src/cli/ui/output.ts`** — `fail()` (exit code + JSON), `printJson`,
   `printRules`, `printHistory`, `printConfig`, `printWelcome`, `printFileStats`.
3. **`src/cli/ui/prompts.ts`** — `inquirer` mockeado; valor devuelto + forma de
   cada pregunta (incluidas las ramas de tamaño y fecha).
4. **`src/mcp/server.ts` + `src/mcp/index.ts`** — `handleToolCall` ya está
   cubierto por `tests/integration/mcp-handlers.test.ts`; faltan `formatResult`,
   `createMcpServer` (handlers de list/call), `startMcpServer` y el entry.
5. **Comandos I** — `config.ts`, `rules.ts`.
6. **Comandos II** — `organize.ts`, `undo.ts`.
7. **Comandos III** — `dedup.ts`, `watch.ts`.
8. **Comandos IV** — `mcp.ts`, `tui.ts`.
9. **Entry** — `src/cli/index.ts`, con stub de `Command.prototype.parse` antes
   del import para que el auto-parse no dispare.
10. **Cierre** — ampliar `coverage.include`, verificar 100% × 4, ADR-0010,
    actualizar docs y correr el pipeline completo.

## Decisiones técnicas

- **In-process, nunca spawn:** el E2E ya prueba el binario empaquetado; acá se
  importa y se invoca, para que la cobertura se atribuya a `src/`.
- **`parseAsync` + `vi.resetModules()`:** cada test recibe un `Command` fresco y
  los valores de opciones no se arrastran entre tests. Validado con un spike
  antes de planificar.
- **`process.exitCode`, no `process.exit`:** los comandos fallan seteando el
  exit code (SPEC-cli-contract). El test lo assertea y lo resetea en `afterEach`
  — un `process.exit` real mataría el runner.
- **`inquirer` mockeado:** sin TTY. Se assertea el valor devuelto **y** la forma
  de la pregunta, para no perder el contrato del prompt.
- **Plataforma determinista en `tui.ts`:** `process.platform` y `WT_SESSION` se
  fijan por test en vez de depender del OS del runner (ADR-0002: determinismo).
- **Include al final:** durante el desarrollo se mide con
  `--coverage.include="src/cli/**/*.ts"`; `vitest.config.ts` se toca una sola vez,
  cuando ya está en 100. Así el gate nunca queda en un estado intermedio rojo.
- **Sin thresholds por glob:** no hacen falta. La superficie nueva llega a 100 en
  el mismo cambio, así que el 100 global de ADR-0006 se mantiene sin bajarlo.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Estado compartido entre tests al reusar el `Command` | `vi.resetModules()` + import dinámico por test |
| `process.exit(1)` mata el runner (p. ej. `tui`, `undo`) | Stub de `process.exit` que lanza, capturado con `expect(...).toThrow` |
| `watch` registra handlers de SIGINT/SIGTERM y no retorna | `vi.spyOn(process, 'on')` para capturar el handler y ejecutarlo con `process.exit` stubbeado |
| `tui.ts` depende del OS y de variables de terminal | `Object.defineProperty(process, 'platform')` + `WT_SESSION`/`TERM_PROGRAM` por test |
| `watch` llama `loadAppConfig()` sin argumentos → lee el config real del dev | Mock del módulo loader en el test de `watch` |
| Entry con side effects al importar | Stub de `Command.prototype.parse` antes del import; restaurar después |
| `dedup` hashea archivos reales (streams) | Fixtures reales en temp dir; grupos por tamaño/duplicados y no-duplicados |

## Puntos de verificación

- Tras cada grupo de tests: `bunx vitest run <archivos>` verde.
- Tras el grupo 4: `bun run lint` sigue limpio (typecheck incluido).
- Cierre: `bun run test:coverage` con el include ampliado → exit 0 y 100% × 4 en
  todo `src/` salvo `src/tui/**`; `bun run test` completo verde.
