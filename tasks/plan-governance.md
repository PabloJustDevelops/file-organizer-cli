# Plan: governance

> Spec: [SPEC-governance.md](../docs/specs/SPEC-governance.md)
> OQ-1 una spec por comando, OQ-2 archivar, OQ-3 enmienda con ADR
> Fase 2 del proceso spec-driven-development · Módulo 3 del
> [capability map](../docs/specs/CAPABILITY-MAP-cli-cycle2.md)

## Componentes y orden

1. **ADR-0009** — enmienda de la Constitución (Art. III: la cláusula de
   enmienda exige un ADR). Se escribe antes de tocar `constitution.md`.
2. **Corregir `docs/constitution.md`** — quitar la acusación obsoleta sobre
   `PLUGINS.md`, manteniendo la regla planned-vs-shipped.
3. **Archivar los huérfanos** — `tasks/plan.md` y `tasks/todo.md` →
   `tasks/archive/plan-landing-editorial-revamp.md` y
   `todo-landing-editorial-revamp.md`, con cabecera *Superseded*, más un
   `tasks/archive/README.md`.
4. **Cinco specs retroactivas** — `SPEC-organize|watch|undo|dedup|config.md`,
   con ACs trazados a tests que existen hoy.
5. **Guardas en `docs.test.ts`** — presencia y trazabilidad de las cinco specs,
   la corrección de la Constitución, los huérfanos archivados y el grep de que
   ningún doc activo mencione el spec de la landing ya eliminado.
6. **Cierre** — gates verdes; spec → Implemented.

## Decisiones técnicas

- **ADR antes de la enmienda:** la propia Constitución dice "Amendments require a
  new ADR"; el ADR documenta por qué la línea estaba mal y qué la reemplaza. La
  Constitución no es un ADR, así que editarla con su propio procedimiento es lo
  correcto (a diferencia de los ADR, que son inmutables).
- **Specs as-implemented, no as-ideal:** cada fila de AC nombra un archivo de test
  que existe hoy; donde la cobertura es parcial se dice, en vez de inventar un
  test. Art. IV: un criterio sin test es un deseo.
- **Archivar y renombrar, no borrar:** `tasks/plan.md`/`todo.md` son los nombres
  por defecto del flujo SDD; dejarlos apuntando a un spec eliminado engaña al
  lector. Se conserva el contenido con cabecera *Superseded* y se libera el
  nombre.
- **Sin cambios en `src/`:** el módulo es documental; el único código nuevo es el
  test de guardas.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Specs retroactivas que describan de más (ideal ≠ real) | Cada AC se escribe leyendo el código y el test que lo cubre; se verifican con `bun run test` |
| Citar un test que no existe | AC-6 del test de docs verifica que cada archivo citado exista en disco |
| El archive confunde con `tasks/` activo | `tasks/archive/README.md` explica qué es y por qué está ahí |
| Editar la Constitución sin procedimiento | ADR-0009 primero, enlazado desde la propia enmienda |

## Puntos de verificación

- Tras Task 1-2: AC-3 en verde.
- Tras Task 3: AC-4, AC-5.
- Tras Task 4-5: AC-1, AC-2, AC-6.
- Cierre: `bun run test` + `bun run lint` limpios.
