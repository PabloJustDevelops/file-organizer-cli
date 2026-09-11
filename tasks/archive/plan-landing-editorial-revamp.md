# Plan: landing-editorial-revamp

> **Superseded** — archived 2026-09-11. This plan targeted
> `docs/specs/SPEC-landing-editorial-revamp.md`, which was removed when the
> landing was moved out of this repository (PRs #6, #7). Kept as a record; not
> actionable. See [`tasks/archive/README.md`](README.md).

> Spec: [SPEC-landing-editorial-revamp.md](../docs/specs/SPEC-landing-editorial-revamp.md)
> (approved: "Aprobar y ejecutar"). Folds in module 3 (impeccable) as AC-10.

## Strategy

The boxes and the tame type are structural, so this is a rewrite of
`global.css` + targeted restructure of `index.astro` (transcript bleed,
install-as-type, CTA band). Tokens stay (paper/ink/blue), so the CSS rewrite
keeps the token layer and replaces the component layer.

## Task order

1. **Tokens + component CSS rewrite** — poster type scale (D2), hairline
   system (D3), code-on-canvas (D4), bleed figure (D5), install-as-type
   (D6), CTA band (D7), hairline-draw motion (D8).
2. **index.astro restructure** — transcript bleed wrapper, captions above
   code, install line + text-copy action, CTA band, copy audit (AC-7).
3. **Layout.astro** — theme-color to paper-adjacent ink (closing band is
   blue; ink is the page color).
4. **Verify** — build, grep audits (AC-1/2/3/6/7), browser evals
   (AC-4/5/8), a11y snapshot (AC-9), screenshots.
5. **AC-10 impeccable gate** — taste-skill Pre-Flight checklist, item by
   item, documented; close spec → Implemented.
