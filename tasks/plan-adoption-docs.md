# Plan: adoption-docs

> Spec: [SPEC-adoption-docs.md](../docs/specs/SPEC-adoption-docs.md)
> (aprobada 2026-09-11; OQ-1 `unreleased`, OQ-2 dos READMEs, OQ-3 sin MCP)
> Fase 2 del proceso spec-driven-development · Módulo 5 del
> [capability map](../docs/specs/CAPABILITY-MAP-cli-adoption.md)

## Componentes y orden

1. **`CHANGELOG.md`** — Keep a Changelog + SemVer; entrada `[0.1.0] - unreleased`
   con lo del ciclo 1.
2. **`CONTRIBUTING.md`** — setup (bun), comandos, spec-before-code, ADRs, gates.
3. **README raíz** — reorden onboarding-first: requisitos, TUI caveat,
   troubleshooting; comandos solo implementados.
4. **README del paquete** — paridad de comandos con el raíz.
5. **`tests/unit/docs.test.ts`** — presencia y headings mínimos.
6. **Cierre** — suite + lint limpios; spec → Implemented.

## Decisiones técnicas

- **Keep a Changelog + SemVer** (OQ-1): `## [0.1.0] - unreleased` porque el
  paquete todavía no se publicó; las entradas se añaden en el mismo PR que el
  cambio (Constitution Art. III).
- **Dos READMEs mantenidos a mano** (OQ-2): el raíz es el documento completo; el
  del paquete, un subconjunto npm-facing. Solo `LICENSE` tiene paridad
  asertada; los READMEs se revisan a ojo.
- **MCP fuera** (OQ-3): no se documenta lo inalcanzable.
- **`docs.test.ts` mínimo:** asserts de existencia y de headings clave
  (`## Requirements`, `### Troubleshooting`, `## [` + `### Added`), no de prosa
  — así no se vuelve frágil ante cada edición de texto.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| El test de docs se vuelve frágil | Solo asserts de presencia/headings, nunca de contenido literal largo |
| README raíz y del paquete divergen | Ambos listan el mismo set de comandos; AC-11 de revisión |
| Documentar comportamiento aún no shipeado | Non-goal explícito (MCP) y AC-10 de revisión contra `fo --help` |
| CHANGELOG con fechas falsas | `unreleased` hasta que exista publish real |

## Puntos de verificación

- Tras Task 1-2: `tests/unit/docs.test.ts` en verde.
- Tras Task 3-4: revisión de READMEs contra `fo --help`.
- Cierre: `bun run test` + `bun run lint` limpios; spec → Implemented.
