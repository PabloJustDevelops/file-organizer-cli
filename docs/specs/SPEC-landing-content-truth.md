# Spec: landing-content-truth

> Status: **Implemented** (2026-09-04) · Created: 2026-09-04
> Verified: `astro build` green; browser inspection: 0 npm references,
> version eyebrow rc.1, plugins section present, heading hierarchy intact.
> Module of: [CAPABILITY-MAP-landing.md](CAPABILITY-MAP-landing.md)
> Process: spec-driven-development (Specify phase)

## 1. Objective

Make the landing tell the truth about the product: the plugin system (the
pilot's headline feature) must be visible, and every version/install/link
claim must match the repo state. No visual redesign here — content and
structure only, in the current design system.

## 2. Grounding facts (verified today)

- No plugins content anywhere on the page (hero-meta, features grid,
  sections: hero/install/features/config/cta only).
- Install command: `npm install -g file-organizer-cli` — **the npm name is
  taken by another package** (ADR-0008 blocker). Any publish will use a
  different (likely scoped) name; the page cannot promise an npm install
  that isn't ours.
- Version eyebrow says `v0.1.0`; repo is at `0.1.0-rc.1`.
- Nav links: Features, Config, npm (npmjs.com/package/file-organizer-cli —
  points at someone else's package), no GitHub link.
- CTA section ends the page; footer is minimal.

## 3. Design decisions

- **D1 — Plugins gets a dedicated section** (after features), mirroring the
  README's Plugins section: plain-object example, config registration,
  error-isolation guarantee, link to `docs/PLUGINS.md` on GitHub.
- **D2 — Install command → clone+build+link** (matches README
  Installation). The npm button/link is removed or relabeled until the
  package name blocker is resolved (ADR-0008). Hero CTA becomes
  "Get started" → `#install`.
- **D3 — Version eyebrow → `v0.1.0-rc.1`** (single source: the eyebrow).
- **D4 — Nav gains GitHub** (repo URL), npm link dropped while the name is
  not ours.
- **D5 — Structure**: hero → install → features → **plugins (new)** →
  config → cta. No changes to Layout/head/fonts in this spec.

## 4. Acceptance criteria

- **AC-1** A "Plugins" section exists between features and config, with a
  plain-object example, YAML registration snippet, the error-isolation
  sentence, and a link to `docs/PLUGINS.md` (GitHub URL).
- **AC-2** No `npm install` command and no npmjs.com link anywhere on the
  page.
- **AC-3** Install section shows the clone→build→link flow, matching
  README's Installation.
- **AC-4** Version eyebrow reads `v0.1.0-rc.1`.
- **AC-5** Nav contains a GitHub link to
  `PabloJustDevelops/file-organizer-cli`; no npm link in nav.
- **AC-6** `astro build` succeeds after the changes.
- **AC-7** (a11y, pre-polish baseline) new sections keep heading order
  (single h1, h2 per section) and the terminal example keeps
  `role="img"` + `aria-label`.

## 5. Open questions (defaults applied)

- OQ-1: keep the terminal mock in the hero? → **Yes** (it is the product's
  proof object; taste phase may restyle it).
- OQ-2: mention `0.1.0-rc.1` pre-release status? → **Yes, in the install
  section** ("pre-release; API stable, name pending").

## 6. Verification

Local only: `cd landing && astro build` (AC-6) + browser inspection of
AC-1…AC-5, AC-7 with `agent-browser` (screenshots against this spec).
