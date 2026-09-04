# Plan: landing-taste-redesign

> Spec: [SPEC-landing-taste-redesign.md](../docs/specs/SPEC-landing-taste-redesign.md)
> (Rev 1: Klein blue accent). Phase 2 — approved by user
> ("adelante" + accent change accepted).

## Strategy

Two rewrites: `global.css` (tokens + component styles) and `index.astro`
(structure per D5-D9), plus `Layout.astro` theme-color. Mechanical grep
audits enforce the bans (shadows, radii, eyebrows, em-dashes, dots).

## Task order

1. **Tokens & base CSS** — pure-neutral OKLCH palette, IKB accent
   (D1-D4), buttons, appbar, layout containers. Delete shadow rules.
2. **index.astro structure** — hero stack to 4 elements (D8), transcript
   replacing terminal window (D5), key:value features (D7), plugins merge
   (D9), config reversed, CTA recolor, copy em-dash audit (AC-8).
3. **Motion & responsive** — fluid CSS-only set per D10, collapses at
   860/580, focus-visible, reduced-motion.
4. **Layout.astro** — theme-color to accent hex.
5. **Verify** — build + grep audits (AC-1..AC-9), browser 1280/375,
   screenshots, close spec.
