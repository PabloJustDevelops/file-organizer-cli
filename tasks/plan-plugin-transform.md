# Plan: plugin-transform

> Spec: [SPEC-plugin-transform.md](../docs/specs/SPEC-plugin-transform.md) (full-cycle execution, same pattern as hooks/rules)
> Last module of the plugin-system pilot.

## Order & rationale

1. **`core/plugins/transform.ts`** (pure) — `PluginHookName` gains
   `'transform'`; `applyTransforms(plugins, files)` returns
   `{ files, failures }`. Per-file isolation (D4) + untrusted-return guard
   (D5). Unit tests AC-1…AC-7 trace here.
2. **Organizer wiring** — after `scanner.scan`, before rules injection:
   `const { files, failures } = await applyTransforms(...)`, log + merge
   `pluginErrors` (same `[plugins]` prefix). Integration AC-8…AC-10 trace
   here.
3. **PLUGINS.md re-validation** — pilot close-out: fix import claims (a),
   `compressOldFiles` (b), programmatic availability note (c), add Transform
   section documenting D3 (d). Cross-check every code block against the
   implemented contract.

## Key decisions baked in

- Placement: scan → **transform** → rules → beforeOrganize → match (D2) —
  `context.files` shows the transformed set.
- v1 is decision-layer only (D3): metadata transforms, no disk renames.
- No new error type: `PluginHookError` with `hook: 'transform'` (D6).
- No idempotency machinery needed (D7) — fresh scan each call.

## Verification

- `bun run test` (all green, ACs traced)
- `bun run test:coverage` (transform.ts at 100%×4)
- `bun run lint` (oxlint + tsc clean)
