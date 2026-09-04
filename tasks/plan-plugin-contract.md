# Plan: plugin-contract

> Spec: [SPEC-plugin-contract.md](../docs/specs/SPEC-plugin-contract.md)
> (aprobada con defaults: OQ-1 = sin factory functions en v1, OQ-2 = ESM-only)
> Fase 2 del proceso spec-driven-development

## Componentes y orden

1. **Jerarquía de errores** (`PluginError` base → `PluginTypeError`,
   `PluginFieldError`) — primero, porque los tests de validación asertan
   contra estos tipos.
2. **`validatePlugin`** con reglas V1→V5 en orden incremental
   (cada regla = un task; ver tasks/todo.md).
3. **Barrel público** `src/core/plugins/index.ts` que re-exporte el contrato
   (crece con cada módulo posterior del capability map).

## Decisiones técnicas

- **Ubicación:** `src/core/plugins/contract.ts` — módulo nuevo dentro del
  core, sin dependencias (ni fs, ni logger, ni yaml). Cumple Art. II.
- **`OrganizerPlugin`:** se mueve su definición única a `contract.ts`;
  `src/types/index.ts` lo re-exporta para no romper imports existentes.
  Una sola definición, dos rutas de import.
- **Semver:** validación con regex propia estricta (semver completo:
  `MAJOR.MINOR.PATCH` con prerelease opcional) — sin dependencia externa
  (`semver` como paquete no está en dependencies y añadirlo para un check
  de formato viola "ask first" por una regex).
- **Kebab-case:** `/^[a-z0-9]+(-[a-z0-9]+)*$/`.
- **Errores:** clases que extienden `Error`, con `pluginName?: string` y
  `field?: string`; mensajes con expected-vs-received. `PluginFieldError`
  usa `field` como discriminador en tests.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Regex semver demasiado laxa/estricta | AC-4 cubre casos límite (`"1.0"`, `"abc"`); prerelease validado con test explícito |
| Romper imports existentes de `types/index.ts` | Re-export mantiene compatibilidad; `tsc --noEmit` en CI lo verifica |
| Validación `typeof fn === 'function'` demasiado débil para V4 | V4 chequea función, no el tipo de retorno en runtime (imposible sin invocar); documentado en JSDoc — el contrato de retorno se verifica en tiempo de tipos |

## Puntos de verificación

- Tras Task 1: `bun run test` en verde con errores tipados.
- Tras Tasks 2–5: todos los ACs en verde, cobertura sin huecos en contract.ts.
- Cierre: `bun run lint` (oxlint + tsc) limpio — gate de CI completo.
