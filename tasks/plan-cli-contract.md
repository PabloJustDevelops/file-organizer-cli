# Plan: cli-contract

> Spec: [SPEC-cli-contract.md](../docs/specs/SPEC-cli-contract.md)
> (aprobada 2026-09-11; OQ-1 = `process.exitCode`, OQ-2 = sin envelope,
> OQ-3 = stderr solo warnings/errores)
> Fase 2 del proceso spec-driven-development · Módulo 3 del
> [capability map](../docs/specs/CAPABILITY-MAP-cli-adoption.md)

## Componentes y orden

1. **Helper `fail()` + emisores JSON** (`src/cli/ui/output.ts`) — un punto para
   reportar fallo (log a stderr + `process.exitCode = 1`) y para volcar JSON
   plano a stdout (`printJson`).
2. **Conversión de exit codes** — cada `return` silencioso pasa a `fail(...)`:
   `organize` (sin config), `rules list/add/remove/test` (sin config y en catch),
   `config init/show/validate` (sin config y en catch), `watch` (sin config).
3. **`--json` en `organize`** — flag, modo no interactivo (implica `-y`), supresión
   del logger de info, y payload `{ dryRun, moved, skipped, errors, pluginErrors? }`
   tanto en éxito como en el camino "no hay archivos".
4. **`--json` en `rules list` y `config show`** — array de reglas / objeto de
   config, sin color, sin logs.
5. **E2E `cli-contract` + docs** — AC-1…AC-14 con el arnés existente; nota de
   `--json` y códigos de salida en el README.
6. **Cierre** — suite + lint limpios; spec → Implemented.

## Decisiones técnicas

- **`process.exitCode = 1` en vez de `process.exit(1)`** (OQ-1): deja fluir
  stdout/stderr y ejecutar cleanup; el proceso termina solo con código 1. El
  único `process.exit` que queda es el bailout del TUI en raw mode.
- **Un solo helper `fail(message, json = false)`**: en modo texto loguea a
  stderr; en modo JSON escribe `{ "error": … }` a stdout (y además loguea a
  stderr). Evita duplicar la decisión por comando.
- **JSON sin envelope** (OQ-2): resultado crudo en éxito; `{ error }` en fallo.
- **Modo JSON = level `error`**: `setLogLevel('error')` al inicio del action,
  así `logger.info` (que va a stdout) no rompe el payload.
- **`--json` implica no-interactivo**: se salta el prompt de ≥20 archivos; sin
  esto, un script quedaría colgado y el stdout contaminado.
- **Boundary con `config-integrity`:** no se toca validación de contenido
  (regex, `patterns[]`, coherencia de `recursive`).

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Scripts que hoy asumen exit 0 en fallo | Es el bugfix; se documenta en README y (luego) CHANGELOG vía `adoption-docs` |
| Silenciar logs oculta info útil | Solo en modo `--json`; sin el flag, la salida humana no cambia (AC-13) |
| `process.exitCode` no aplica si algo llama a `process.exit` | Se eliminan los `process.exit(1)` de los caminos convertidos; queda solo el del TUI |
| El prompt ≥20 archivos reaparece en scripts | `--json` implica `-y`; AC-14 lo cubre con stdin cerrado |
| Duplicar lógica JSON por comando | Un `printJson` compartido y un `fail` compartido |

## Puntos de verificación

- Tras Task 1-2: AC-1…AC-6 en verde (exit codes).
- Tras Task 3-4: AC-7…AC-12 y AC-14 en verde (JSON).
- Cierre: AC-13 sin regresión + `bun run test` + `bun run lint` limpios.
