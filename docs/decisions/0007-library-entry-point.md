# ADR 0007 — Library entry point for programmatic consumers

- **Status:** Accepted
- **Date:** 2026-09-04

## Context

The package shipped with `main` pointing at the CLI binary
(`dist/cli/index.js`), which calls `program.parse()` at import time. Every
programmatic use documented in `docs/PLUGINS.md` —
`import { Organizer } from 'file-organizer-cli'` or
`import type { OrganizerPlugin }` — could never work: importing the package
spawned the CLI, and plugin authors had no types to import. The pilot's
PLUGINS.md re-validation flagged this as the doc's central falsehood.

## Decision

Introduce a dedicated, side-effect-free library entry:

- `src/index.ts` re-exports the public API (`Organizer`, `FileScanner`,
  `RulesEngine`, the full plugin system, config loaders, logger, shared
  types). It contains zero logic — Constitution Art. II: surface, not
  behavior.
- `package.json` declares it via modern `exports`: `"."` → library
  (types + ESM), `"./bin"` → the CLI binary. `main`/`types` are kept in sync
  for tooling that ignores `exports`.
- `tsup` gains the `index` entry and `dts: true`, so `dist/index.d.ts`
  ships real types instead of a hand-maintained stub.

## Consequences

- **+** Plugin authors get real, compilable type imports
  (`import type { OrganizerPlugin } from 'file-organizer-cli'`).
- **+** Library consumers can embed the organizer without spawning a CLI
  process; import-time side effects are structurally excluded.
- **+** `dist/cli/index.js` behavior is unchanged; npm bin entries untouched.
- **−** The public surface is now contract: renames require a deprecation
  cycle. `tests/unit/public-api.test.ts` guards the documented names.
- **−** `dts: true` adds a type-emission pass to the build (~seconds).

## Verification

- `tests/unit/public-api.test.ts`: every documented export present; the
  dynamic import completes without side effects.
- Real-node smoke test of `dist/index.js`: import, `new Organizer()`,
  `validatePlugin` roundtrip.
