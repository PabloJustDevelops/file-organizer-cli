# Tasks: landing-taste-redesign

> Plan: [plan.md](plan.md) · Each task = one focused session.

- [x] Task 1: Rewrite `global.css` (tokens, IKB accent, sharp radii, zero
  shadows, transcript + key:value styles)
  - Acceptance: AC-1, AC-2, AC-3, AC-3b mechanical greps pass.
  - Files: `landing/src/styles/global.css`

- [x] Task 2: Rewrite `index.astro` structure + copy (hero stack, transcript,
  features, plugins merge, config reverse, CTA, em-dash audit)
  - Acceptance: AC-4, AC-5, AC-6, AC-7, AC-8, AC-9.
  - Files: `landing/src/pages/index.astro`

- [x] Task 3: Motion + responsive set (D10), `Layout.astro` theme-color
  - Acceptance: AC-10, AC-11; reduced-motion collapse intact.
  - Files: `landing/src/styles/global.css`, `landing/src/layouts/Layout.astro`

- [x] Task 4: Verify — `bun run build`, grep audits, browser 1280/375 +
  screenshots, spec → Implemented, tasks complete.
