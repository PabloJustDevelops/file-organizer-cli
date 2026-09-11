# Tasks: landing-editorial-revamp

> **Superseded** — archived 2026-09-11. See
> [`tasks/archive/README.md`](README.md). Not actionable.

> Plan: [plan.md](plan.md) · Each task = one focused session.

- [ ] Task 1: Rewrite `global.css` component layer (poster type, hairlines,
  code-on-canvas, bleed, install-as-type, CTA band, motion)
  - Acceptance: AC-1, AC-2, AC-3, AC-6 greps pass.
  - Files: `landing/src/styles/global.css`

- [ ] Task 2: Restructure `index.astro` (transcript bleed, code captions,
  install line, CTA band, copy audit)
  - Acceptance: AC-7 greps; structure matches D3-D9.
  - Files: `landing/src/pages/index.astro`

- [ ] Task 3: `Layout.astro` theme-color
  - Acceptance: meta theme-color = ink hex.

- [ ] Task 4: Verify — build, greps, browser evals (h1 ≥72px @1280,
  transcript right-edge bleed, no overflow @1280/375), a11y snapshot,
  screenshots 1280/375.

- [ ] Task 5: AC-10 impeccable gate — taste Pre-Flight checklist documented
  pass/fail; spec → Implemented.
