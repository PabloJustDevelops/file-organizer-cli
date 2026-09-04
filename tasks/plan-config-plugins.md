# Plan: config-plugins

> Spec: [SPEC-config-plugins.md](../docs/specs/SPEC-config-plugins.md)
> (aprobada con defaults: OQ-1 = sin expansión `~`, OQ-2 = log debug de plugins cargados)
> Fase 2 del proceso spec-driven-development

## Componentes y orden

1. **Tipos** — `OrganizeConfig.plugins?: string[]`; `OrganizeOptions` gana
   `plugins?: string[]` y `pluginBaseDir?: string`.
2. **Validación C1–C3** en `validateAndNormalizeConfig` (después del bloque
   `sizeBuckets`), mensajes con índice: `Invalid config: plugins[<i>] ...`.
3. **`CONFIG_SCHEMA`** — definición `plugins` (array de strings).
4. **Consumo en `Organizer.organize()`** — cargar specs antes de escanear,
   `pluginBaseDir` (default `process.cwd()`), log debug (OQ-2).
5. **Wiring CLI** — `organize.ts` pasa `plugins: config.plugins` y
   `pluginBaseDir: path.dirname(path.resolve(configPath))`; `watch.ts` ídem
   si `FolderWatcher` reenvía opciones.
6. **Tests** — unit (config-loader), integration (organizer-options con
   edges fakes), integration real (plugin-loader test: YAML + fixture real).

## Decisiones técnicas

- **Idempotencia de carga (riesgo principal):** `fo organize` llama primero a
  `preview()` (dry-run) y luego a `organize()`. Si cargar no es idempotente,
  la segunda pasada lanzaría `DuplicatePluginError`. Solución:
  `private loadedSpecs = new Set<string>()` en `Organizer` — un spec ya
  cargado por instancia se salta; nombres duplicados desde specs DISTINTOS
  siguen siendo error. Sin cambios en `PluginRegistry`.
- **Inyección de edges en Organizer:** el constructor gana
  `pluginEdges?: LoaderEdges` → `new PluginRegistry(pluginEdges)`. Los tests
  de AC-7/8/9 inyectan fakes; la integración real usa edges por defecto.
  Consistente con ADR-0002 (inyección, no mocking).
- **Flat vs config:** `plugins` sigue el patrón existente de `rules`:
  `options.plugins ?? options.config?.plugins` — CLI pasa plano, watch puede
  pasar `config`.
- **Watch:** `FolderWatcher` se revisa; si reenvía un objeto de opciones a
  `organizer.organize()`, se añaden `plugins`/`pluginBaseDir`; si no, watch
  queda para el módulo `plugin-hooks` (nota en spec).
- **Cobertura:** `config/loader.ts` y `core/organizer.ts` ya están en el
  include de cobertura — las ramas nuevas deben quedar cubiertas.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| preview() + organize() duplican carga | `loadedSpecs` (ver arriba); test específico de idempotencia |
| Tests memfs rompen con edges reales del loader | AC-7/8/9 usan `pluginEdges` fakes; solo AC-10+ toca fs real |
| `configPath` relativo en CLI | `path.dirname(path.resolve(configPath))` siempre |
| Romper config existente sin `plugins` | AC-1: ausente = `undefined`, comportamiento idéntico |

## Puntos de verificación

- Tras Task 1-2: config-loader tests en verde (AC-1…AC-6).
- Tras Task 3-4: organizer options + idempotencia en verde (AC-7…AC-9 + nueva).
- Cierre: integración real (AC-10…AC-12) + lint + cobertura completa.
