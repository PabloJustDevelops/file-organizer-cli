# Plan: verification

> Spec: [SPEC-verification.md](../docs/specs/SPEC-verification.md)
> (aprobada 2026-09-11; OQ-1 = globalSetup recompila siempre, OQ-2 = sin
> `test:e2e` por ahora, OQ-3 = corre donde corra `bun run test`)
> Fase 2 del proceso spec-driven-development · Módulo 2 del
> [capability map](../docs/specs/CAPABILITY-MAP-cli-adoption.md)

## Componentes y orden

1. **`tests/e2e/helpers.ts`** — `runCli(args, cwd, home)` que spawnea
   `process.execPath` con `dist/cli/index.js`, sin shell, con `HOME`/`USERPROFILE`
   aislados; utilidades de temp dir, escritura de config y limpieza.
2. **`tests/e2e/global-setup.ts` + vitest.config** — build único por corrida
   (`bun run build`) antes de los tests, registrado como `globalSetup`.
3. **`tests/e2e/cli.test.ts`** — happy paths AC-1…AC-8 sobre directorios reales.
4. **`tests/e2e/install.test.ts`** — AC-9: pack real + install en prefix temporal
   + ejecución del entry instalado.
5. **Cierre** — `bun run test` + `bun run lint` limpios; ACs de distribution
   (AC-6/AC-10) pasan a estar automatizados.

## Decisiones técnicas

- **`process.execPath` + `dist/cli/index.js`:** mismo Node que corre los tests,
  sin depender de `node` en `PATH`. Sin `shell: true` — en Windows los `.cmd` no
  se pueden spawnear sin shell (EINVAL) y `shell:true` con args dispara DEP0190.
- **Aislamiento de home:** cada spawn fija `HOME` y `USERPROFILE` (fuente de
  `os.homedir()` en Windows) al temp dir del test, para que `undo`/history nunca
  toquen `~/.file-organizer` real.
- **globalSetup siempre compila:** evita probar un `dist` viejo en silencio;
  cuesta ~7 s por corrida (suite actual ~4 s).
- **Sin TTY / siempre `-y`:** los comandos con prompt se ejecutan no
  interactivos; `dedup` sin `--delete` no borra nada.
- **Cobertura intacta:** `tests/e2e` queda fuera del `coverage.include` (ya
  excluido por glob); el ratchet no se diluye.
- **Ejecución del entry instalado, no del shim:** AC-9 asevera que los shims
  existen (`fo`/`fo.cmd`/`fo.ps1` según OS) y corre
  `node <prefix>/node_modules/@pablojustdevs/file-organizer-cli/dist/cli/index.js`
  para no volver a chocar con el spawn de `.cmd`.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Build en globalSetup alarga todo `bun run test` | Aceptado (OQ-1); si molesta, OQ-2 lo separa en `test:e2e` |
| E2E contaminan el historial real del dev | `HOME`/`USERPROFILE` a temp dir por spawn; asserts de undo dentro del temp |
| Flakiness por timing | Nada de `watch`/debounce; solo comandos sincrónicos con exit code |
| `npm install` del tarball tarda/necesita red | Usa el tarball local y `--prefix` temporal; timeout holgado; es un test, no el loop caliente |
| Rutas con espacios (Windows/mac) | Todo vía `path.join`, cwd explícito, sin concatenación de comandos |

## Puntos de verificación

- Tras Task 1-2: `dist/cli/index.js` existe antes de cualquier E2E.
- Tras Task 3: AC-1…AC-8 en verde.
- Tras Task 4: AC-9 en verde.
- Cierre: `bun run test` completo + `bun run lint` sin errores; AC-6/AC-10 de
  `distribution` quedan cubiertos por AC-9/AC-10 de este módulo.
