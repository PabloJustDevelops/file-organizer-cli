# Plan: config-integrity

> Spec: [SPEC-config-integrity.md](../docs/specs/SPEC-config-integrity.md)
> OQ-1 `recursive` → `false`, OQ-2 `pattern` permitido en cualquier tipo, OQ-3 `match` se elimina
> Fase 2 del proceso spec-driven-development · Módulo 1 del
> [capability map](../docs/specs/CAPABILITY-MAP-cli-cycle2.md)

## Componentes y orden

1. **`validateRuleCore` — regex y `patterns[]`** (`src/core/rule-validation.ts`):
   compilar `condition.pattern` cuando existe; exigir `pattern` para `type: regex`;
   validar cada elemento de `patterns[]`; pasar el nombre de la regla a
   `validateCondition` para mensajes accionables.
2. **Eliminar `condition.match`** de `types`, `schema.ts` y la validación.
3. **Unificar el default de `recursive`** en `loader.ts` (`=== true`) y anotar
   el cambio de comportamiento.
4. **`docs/RULES.md` fiel al motor** — variables y knobs que faltan.
5. **Tests** — unit (config-loader, rules-engine, docs, plugins/rules) + E2E
   (`fo config validate`).
6. **Cierre** — `bun run test` + `bun run lint`; spec → Implemented.

## Decisiones técnicas

- **Validar en `validateRuleCore`, no en el loader:** es el único punto que
  comparten YAML y reglas de plugins (Art. II); el loader ya delega ahí.
- **Compilar el regex con `new RegExp(pattern)` sin flags** para la validación
  sintáctica: el motor lo usa con `'i'`, y el flag no cambia si compila.
- **Exigir `pattern` en `type: regex`:** hoy un regex sin pattern hace match de
  todo (`if (!condition.pattern) return true`), lo contrario de lo que promete el
  tipo. Se convierte en error de config.
- **`patterns[]` con el mismo estilo que `plugins[]`** (índice en el mensaje):
  coherencia de mensajes y de tests.
- **`recursive` por defecto `false`:** coincide con el flag `-r` (opt-in), con
  `getExampleConfig()` y con `RULES.md`, y es el default más seguro (no entra en
  subdirectorios sin que se lo pidan). `watch` no se ve afectado porque pasa su
  valor explícito.
- **Eliminar `condition.match`:** declarado, validado y nunca leído; aceptar un
  campo que no hace nada es una mentira de validación (Art. VI). Pre-1.0 y sin
  nada publicado, no hay consumidores.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Cambiar el default de `recursive` altera runs existentes | Ningún test depende del default actual; se documenta en CHANGELOG; `-r` sigue disponible y `watch` no cambia |
| Romper reglas de plugins con la validación más estricta | Es el comportamiento deseado (falla temprano y por regla); AC-15 verifica el aislamiento por regla |
| Eliminar `condition.match` rompe el tipo público | grep confirma que no se usa en src/tests/docs; typecheck (`tsc --noEmit`) lo prueba |
| Mensajes de error más largos rompen tests existentes | Se revisan los tests que asertan mensajes de condición |

## Puntos de verificación

- Tras Task 1-2: AC-1…AC-11 en verde.
- Tras Task 4: AC-12…AC-15 en verde.
- Cierre: `bun run test` + `bun run lint` limpios.
