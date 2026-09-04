# Plan: plugin-loader

> Spec: [SPEC-plugin-loader.md](../docs/specs/SPEC-plugin-loader.md)
> (aprobada con defaults: OQ-1 = sin settings en v1, OQ-2 = duplicado lanza error)
> Fase 2 del proceso spec-driven-development

## Componentes y orden

1. **Taxonomía de errores del loader** (`PluginNotFoundError`,
   `PluginLoadError` con `cause`, `PluginExportError`,
   `DuplicatePluginError`) — primero, los tests asertan contra estos tipos.
2. **`PluginRegistry.register`/`list`** — almacenamiento por nombre, dedup
   en punto único, delegación a `validatePlugin`.
3. **`load()` — routing y archivos locales** — detección (`./`, `../`,
   absoluto vs bare), `fileExists` default, mapeo de fallos de import a
   `PluginLoadError`.
4. **`load()` — paquetes npm** — `resolvePackage` default con `createRequire`
   enraizado en `baseDir`.
5. **Export missing + propagación de validación** — `PluginExportError`,
   el error de contrato cruza `load()` intacto.
6. **`Organizer.loadPlugin()`** — delegación thin + test de integración con
   fixture real.

## Decisiones técnicas

- **Ubicación:** `src/core/plugins/loader.ts`; barrel crece; `organizer.ts`
  solo gana `loadPlugin()`.
- **Windows-first:** el `import()` dinámico recibe siempre
  `pathToFileURL(resolved).href` — importar por ruta absoluta plana falla en
  Windows (el entorno del usuario) y es la causa nº1 de bugs de loaders ESM.
- **`Error.cause`:** `target: ES2022` en `tsconfig.base.json` lo permite
  nativamente; `PluginLoadError` lo expone sin dependencias.
- **`createRequire`:** se enraíza con
  `createRequire(path.join(baseDir, 'package.json'))` para que la resolución
  use el `node_modules` del proyecto del usuario, no el del CLI.
- **Almacenamiento:** `Map<string, OrganizerPlugin>` por `name` — el dedup
  es gratis y `list()` devuelve snapshot readonly.
- **Detección local vs npm:** `path.isAbsolute(spec) || spec.startsWith('./')
  || spec.startsWith('../')`; todo lo demás es bare specifier npm.
- **Edges opcionales** con defaults reales (`fs-extra.pathExists`,
  `createRequire.resolve`, `import()` dinámico) — unit tests inyectan fakes
  puras, cero mocking de módulos.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| `import()` de rutas Windows falla | `pathToFileURL` siempre; test de integración real en AC-13 lo prueba de verdad |
| `createRequire` enraizado falla si `baseDir` no tiene `package.json` | No lo necesita: `createRequire` solo usa el path como ancla de resolución |
| Registro contaminado si `load()` valida pero falla el dedup | Validar y dedup DENTRO de `register()` único punto; `load()` nunca inserta directo |
| Cobertura de `loader.ts` (incluido en threshold) | Todos los caminos de error cubiertos con edges fakes en unit tests |

## Puntos de verificación

- Tras Task 1-2: register/dedup/local routing en verde.
- Tras Task 3-4: todos los ACs unit en verde.
- Cierre: AC-13 integración real + `bun run lint` limpio + cobertura sin
  huecos en `loader.ts`.
