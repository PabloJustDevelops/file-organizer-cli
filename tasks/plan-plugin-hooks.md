# Plan: plugin-hooks

> Spec: [SPEC-plugin-hooks.md](../docs/specs/SPEC-plugin-hooks.md)
> Fase 2 del proceso spec-driven-development

## Componentes y orden

1. **Tipos** — `PluginHookError` en `core/plugins/hooks.ts`, re-exportado;
   `OrganizeResult.pluginErrors?: PluginHookError[]` (aditivo, opcional).
2. **Runners puros** — `runBeforeOrganize(plugins, context)` /
   `runAfterOrganize(plugins, context)` → `Promise<PluginHookError[]>`;
   secuenciales en orden de registro, aislamiento por plugin.
3. **Wiring organizer** — dos call sites: tras scan (before) y tras el loop
   de moves + history (after); merge de errores en el result.
4. **Tests** — unit puros (AC-1,2,6,7,9,10) + wiring (AC-3,4,5) +
   integración real con fixture que escribe un marker file (AC-8).

## Decisiones técnicas

- **Runners puros, no métodos del Organizer:** el contexto ya existe
  (`OrganizeContext`); runners son funciones de `(plugins, ctx)`. Los tests
  unit no necesitan instancia de Organizer ni fs (Art. II).
- **Aislamiento:** `try/catch` por plugin, por hook. El error se captura como
  `{ plugin, hook, error: message }` — nunca se propaga.
- **Orden:** `plugins.list()` ya devuelve en orden de registro; `for..of` con
  `await` secuencial. Sin `Promise.all` (v1: predecible > rápido).
- **dry-run:** los hooks corren igual; el contexto lleva
  `config.dryRun = true` para que el plugin distinga (decisión de spec #4).
- **`pluginErrors` opcional:** `absent when empty` — los consumidores
  existentes (CLI output, MCP summary) no cambian (AC-5).
- **Integración AC-8:** fixture plugin en temp dir cuyo `beforeOrganize`
  hace `fs.writeFile(marker)` con `context.files.map(f => f.name).join()`;
  prueba contexto real + ejecución real vía import() nativo.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Romper consumidores de `OrganizeResult` | campo opcional aditivo; AC-5 cubre ausencia |
| Hooks duplicados si preview+organize corren hooks dos veces | aceptado y deseado: cada pasada ejecuta su ciclo completo; loadedSpecs evita solo la recarga de plugins, no la ejecución de hooks |
| Flakiness en integración (fs real) | marker file en temp dir dedicado + cleanup; patrón ya usado en plugin-loader.test.ts |

## Puntos de verificación

- Tras Task 1-2: unit tests de runners en verde.
- Tras Task 3: wiring tests en verde; suite completa sin regresiones.
- Cierre: cobertura + lint + spec a Implemented.
