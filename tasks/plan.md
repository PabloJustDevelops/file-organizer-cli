# Plan: landing-content-truth

> Spec: [SPEC-landing-content-truth.md](../docs/specs/SPEC-landing-content-truth.md)
> Module 1/3 of CAPABILITY-MAP-landing. Local-only landing; verification by
> `astro build` + browser inspection.

1. Content edits in `landing/src/pages/index.astro`: nav (GitHub, no npm),
   version eyebrow, hero CTA/meta, install band (clone flow + pre-release
   note), new plugins section (example + registration), CTA links.
2. Minimal CSS for `.install-note` / `.plugin-registration`.
3. Fix `landing/tsconfig.json` (self-contained, extends astro base) — the
   move out of `packages/` broke its `extends` path.
4. Verify: `astro build` + agent-browser inspection of AC-1…AC-7.
