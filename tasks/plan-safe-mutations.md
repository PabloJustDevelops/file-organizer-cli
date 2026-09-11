# Plan: safe-mutations

> Spec: [SPEC-safe-mutations.md](../docs/specs/SPEC-safe-mutations.md)
> (aprobada 2026-09-11; OQ-1 `dedup/`, OQ-2 `-y`, OQ-3 aprendizaje dinámico,
> OQ-4 pase inicial por defecto)
> Fase 2 del proceso spec-driven-development · Módulo 4 del
> [capability map](../docs/specs/CAPABILITY-MAP-cli-adoption.md)

## Componentes y orden

1. **Backup por movimiento** (`HistoryStore.moveToBackup`) — mover a
   `<historyDir>/dedup/<uuid><ext>`, sin copiar.
2. **Registro de undo** (`Organizer.recordRemovals`) — append de una entrada
   `rule: 'dedup'` respetando `historySize`, reusando el history existente.
3. **`dedup` reversible** — `-y`; `--delete` mueve a backup y registra; errores
   parciales reportados y exit 1 si hubo alguno.
4. **Ignores derivados de `destination`** (`buildDestinationIgnores`) +
   `DEFAULT_IGNORES` sin nombres de destino + aprendizaje dinámico por función
   `ignored`.
5. **Flags de `watch`** — `parseDebounce` validado y cableado; `organizeOnStart`
   implementa el pase inicial de `--no-initial`.
6. **Tests** — unit (puros), integración (chokidar real, `idle()`), E2E
   (dedup→undo, `--debounce` inválido).
7. **Docs + cierre** — README; suite + lint limpios; spec → Implemented.

## Decisiones técnicas

- **Reusar el history de `organize`:** una entrada de dedup es un `UndoEntry` con
  `operations = [{from: original, to: backup, rule: 'dedup'}]`; `undo` ya sabe
  restaurar moviendo `op.to → op.from`, incluido el fallback a nombre único si el
  original fue ocupado. Cero maquinaria nueva de restauración.
- **`moveToBackup` mueve (no copia):** un duplicado no aporta nada en su sitio;
  mover es atómico y no duplica espacio. Distinto de `backupReplacedFile`
  (copy), que protege un archivo que el usuario **sí** quiere conservar.
- **Ignore estático + dinámico:** el estático (`**/<primer-segmento>/**`) actúa
  desde el arranque; el dinámico aprende los directorios realmente usados
  (`moved.to`), necesario para destinos sin raíz estática como `./{year}`.
- **`ignored` como función con `Set` mutable:** chokidar evalúa la función por
  path, así que añadir dirs tras cada pase no requiere reconstruir el watcher.
- **`parseDebounce` puro y validado:** número entero > 0; el flag deja de ser
  decorativo y un valor inválido falla antes de arrancar el watcher.
- **`organizeOnStart` en `ready`:** un pase inicial antes de asentarse en watch;
  `--no-initial` lo desactiva realmente.
- **Boundary con `config-integrity`:** solo se *lee* config (destinos); no se
  toca validación de contenido.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Ignore dinámico sobre-ignora una carpeta que el usuario quiere vigilar | Solo se ignoran directorios que el propio run usó como destino; el usuario puede ajustar reglas |
| Tests de integración con chokidar flaky | Reusar `idle()` y esperas de asentamiento; sin aserciones de timing fino |
| `organizeOnStart` cambia comportamiento (pase inicial nuevo) | Es el fix del flag ya documentado; cubierto por AC-9/AC-10 y anotado en el changelog |
| Backups de dedup crecen sin límite | Comparten el history dir; `fo undo` los consume; documentado (limpieza = OQ futura) |
| Registro de undo con `Organizer` que también escanea | `recordRemovals` no escanea ni mueve nada: solo persiste la entrada |

## Puntos de verificación

- Tras Task 1-3: AC-1…AC-4 y AC-11 en verde.
- Tras Task 4-5: AC-5…AC-10 en verde.
- Cierre: `bun run test` + `bun run lint` limpios y spec → Implemented.
