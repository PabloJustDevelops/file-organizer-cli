# Plan: plugin-rules

> Spec: [SPEC-plugin-rules.md](../docs/specs/SPEC-plugin-rules.md)

## Componentes y orden

1. **Refactor de capa:** `validateRule`/`validateCondition` → nuevo
   `src/core/rule-validation.ts`; `config/loader.ts` importa desde core.
2. **`RulesEngine.hasRule(name)`** — para dedup/conflicto por nombre.
3. **`src/core/plugins/rules.ts`** — `collectPluginRules(plugins)` puro:
   llama `customRules()`, valida cada regla con el validador de core,
   aísla errores por regla; `PluginRuleFailure` mapea a `PluginHookError`
   con `hook: 'customRules'`.
4. **Wiring organizer** — inyección entre `setRules` y `matchFiles`;
   merge de fallos a `result.pluginErrors`.
5. **Tests** — unit (collect) + wiring (prioridad/conflicto/idempotencia) +
   integración real (`*.xyz` → movido por regla de plugin).

## Decisiones técnicas

- **Idempotencia:** `pluginRuleNames: Set<string>` por instancia de
  Organizer. Nombre en engine y es nuestro → skip silencioso (doble pasada
  preview→organize). En engine y NO es nuestro → conflicto capturado, skip.
  No está → `addRule` + registrar. Cubre también el caso `setRules` reset.
- **Aislamiento por regla:** una regla inválida no hunde las demás del mismo
  plugin (más útil que aislar solo por plugin).
- **Canal de errores:** reutiliza `pluginErrors` (`hook: 'customRules'`) —
  un solo canal para toda contribución de plugins.
- **Config gana:** conflicto de nombre = config rule wins (la config es el
  contrato explícito del usuario; la contribución del plugin es aditiva).

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Romper config-loader al mover validateRule | solo se mueve, exports idénticos; suite de config-loader existente es la red |
| Doble inyección en doble pasada | pluginRuleNames (ver arriba) + test AC-6 |
| Validación duplicada | mismo validateRule que YAML; tests de config ya cubren el validador |

## Puntos de verificación

- Tras Task 1: suite completa en verde (refactor neutro).
- Tras Task 2-3: ACs wiring en verde.
- Cierre: integración real + coverage + lint + spec Implemented.
