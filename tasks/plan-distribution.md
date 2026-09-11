# Plan: distribution

> Spec: [SPEC-distribution.md](../docs/specs/SPEC-distribution.md)
> (aprobada 2026-09-11; OQ-1 resuelto = `@pablojustdevelops`)
> Fase 2 del proceso spec-driven-development · Módulo 1 del
> [capability map](../docs/specs/CAPABILITY-MAP-cli-adoption.md)

## Componentes y orden

1. **`LICENSE` + metadata legal** — `LICENSE` MIT en la raíz (holder = autor),
   `author`/`license` en `packages/cli/package.json`. Primero: AC-1/AC-3.
2. **Identidad scoped + publish config** — `name` →
   `@pablojustdevelops/file-organizer-cli`; `publishConfig.access: "public"`;
   `repository`/`homepage`/`bugs`/`engines`/`keywords`. Los `bin`
   (`fo`, `file-organizer`, `fo-tui`) no cambian.
3. **Fix `prepublishOnly`** — `bun test` (runner integrado de Bun) →
   `bun run test` (vitest). El gate de pre-publicación corre la suite real.
4. **Higiene del tarball** — excluir `*.map`; confirmar que npm auto-incluye
   `README.md` y `LICENSE`; sin `src/`, `tests/`, `tools/`.
5. **Tests de metadata + packaging** (vitest, autocontenidos) — asertar
   campos de `package.json` y el set de archivos de `npm pack --dry-run --json`.
6. **Referencias de nombre en docs** — README (sección install), `PLUGINS.md`
   (snippets de import/install), runbook ADR-0008 (estado del blocker).
7. **Cierre** — build + `bun run test` + `bun run lint` + evidencia de pack.

## Decisiones técnicas

- **`publishConfig.access: "public"` en vez de tocar `release.yml`:** una sola
  fuente de verdad; funciona igual para `npm publish` manual y para CI, sin
  depender de que el workflow recuerde el flag.
- **Excluir sourcemaps vía `.npmignore`:** `*.map` hoy embarca ~478 KB
  (post-build) que no aportan al consumidor del CLI; los maps siguen en el
  build del repo. OQ-3 default.
- **README/LICENSE no van a `files`:** npm los incluye siempre; agregarlos al
  allowlist sería redundante y frágil.
- **`engines` se mantiene `>=18`** (OQ-5): alcance > modernidad; el README
  recomendará 20 LTS.
- **Versión:** `0.1.0-rc.1` se mantiene en código; el bump a `0.1.0` ocurre en
  el PR de release (OQ-4), no en este módulo.
- **Boundary con `adoption-docs`:** este módulo solo corrige las *referencias
  al nombre* (install/import); la reescritura de onboarding, requisitos,
  troubleshooting, `CHANGELOG` y `CONTRIBUTING` es de `adoption-docs`.
- **Boundary con `verification`:** AC-6 y AC-10 (install smoke, `fo --version`
  contra el binario real) se cierran en el módulo `verification`, que aporta el
  harness E2E. Aquí se cierran AC-1…AC-5, AC-7.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| El scope no existe en npm → publish falla | Prerrequisito humano: crear/poseer `@pablojustdevelops` antes de publicar; el módulo no publica |
| Cambiar `name` rompe enlaces globales previos | Solo cambia el nombre del paquete; los `bin` siguen iguales. Documentar `npm uninstall -g file-organizer-cli` si existía |
| `files` + `.npmignore` se contradicen | El test de packaging asevera el set real vía `npm pack --dry-run --json` |
| Quitar maps dificulta depurar | Maps se quedan en el build local; solo se excluyen del tarball |
| `publishConfig` no aplica en algún registry corporativo | AC-8 se valida con `npm publish --dry-run` local |

## Puntos de verificación

- Tras Task 1-2: tests de metadata en verde (AC-1…AC-4, AC-7).
- Tras Task 3: test de packaging en verde (AC-5).
- Tras Task 4: grep sin referencias al nombre unscoped (AC-2).
- Cierre: `bun run build` + `bun run test` + `bun run lint` limpios y
  `npm pack --dry-run` mostrando `dist/` + `README.md` + `LICENSE`.
