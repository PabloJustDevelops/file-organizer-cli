# Tasks: plugin-transform

> Plan: [plan.md](plan.md) · Last module + pilot close-out.

- [x] Task 1: `core/plugins/transform.ts` — runner + unit tests AC-1…AC-7 (✅ + AC-5b/5c para ramas)
  - Acceptance: `applyTransforms` pure runner; per-file isolation; untrusted-return guard; `'transform'` in hook-name union; barrel exports.
  - Verify: `bun run test`
  - Files: `src/core/plugins/transform.ts`, `src/core/plugins/hooks.ts`, `src/core/plugins/index.ts`, `tests/unit/plugins/transform.test.ts`

- [x] Task 2: Organizer wiring — transform after scan, before rules (AC-8…AC-10) (✅ A/B real: sin plugins `*.txt` no matchea `.log`)
  - Acceptance: transformed set drives matching and `context.files`; failures non-fatal via `pluginErrors`.
  - Verify: `bun run test`
  - Files: `src/core/organizer.ts`, `tests/integration/plugin-loader.test.ts`

- [x] Task 3: PLUGINS.md re-validation + pilot close-out (✅ imports eliminados, ejemplos corregidos, semántica documentada; ratchet 90/90/90/90)
  - Acceptance: doc matches implementation (imports, examples, semantics); spec/tasks marked done.
  - Verify: `bun run lint` + `bun run test:coverage`
  - Files: `docs/PLUGINS.md`, `docs/specs/SPEC-plugin-transform.md`, `tasks/todo.md`
