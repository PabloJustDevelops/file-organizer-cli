# Spec: landing-taste-redesign

> Status: **Implemented** (2026-09-04) · Created: 2026-09-04 · **Rev 1** (user review)
> Module 2 of 3 of [CAPABILITY-MAP-landing.md](CAPABILITY-MAP-landing.md)
> (`landing-taste`, after `landing-content-truth`). Process:
> spec-driven-development, Specify phase.
> Skill: `design-taste-frontend` (loaded; audit + dials in the conversation record).
>
> **Rev 1 (2026-09-04):** user approved direction (mono + saturated pop,
> typographic transcript, motion 5, single-pass overhaul) and requested the
> forest green accent be replaced. New accent: **International Klein Blue
> `oklch(0.47 0.2 263)`** — canonical Swiss-poster accent, ~7:1 contrast
> with white (AA/AAA-safe for buttons and the CTA panel). All D/AC references
> to the green accent now read Klein blue.

## 1. Objective

Complete visual overhaul of the landing in **one pass**, replacing the
current "warm editorial" language (forest green pill buttons, rounded cards,
numbered feature list, fake terminal window) with a **Swiss/poster mono
system**: pure neutrals, one saturated Klein-blue accent, typographic hierarchy,
zero shadows, zero fake chrome. Content and information architecture stay
frozen (approved in SPEC-landing-content-truth).

## 2. Design Read & Dials (from design-taste-frontend)

- **Reading this as:** redesign-overhaul of a CLI devtool landing for
  developers, with a Swiss/mono typographic language, one saturated pop of
  green, native CSS on Astro.
- **Dials:** `DESIGN_VARIANCE 7 · MOTION_INTENSITY 5 · VISUAL_DENSITY 3`.
- **Mode:** Redesign - Overhaul. IA, copy, section list, nav labels, anchor
  IDs: **frozen** (11.C of the skill).

## 3. Brand tokens to preserve (audit result)

These survive the overhaul (they were correct):

- **Accent:** deep forest green `oklch(0.42 0.08 145)` family.
- **Type:** Geist + Geist Mono, already self-hosted-style via Google Fonts
  (fine for a local landing; no `<link>` change needed).
- **A11y:** `:focus-visible` global, `prefers-reduced-motion` blocks, semantic
  landmarks, single h1.
## 4. Decisions (D1–D10)

**D1 — Neutrals go pure.** Warm-tinted neutrals (hue 106) are replaced by
true neutrals: `oklch(0.98 0 0)` canvas, `oklch(0.16 0 0)` text,
`oklch(0.44 0 0)` muted. No warm cast anywhere. The terminal panel keeps a
near-black neutral: `oklch(0.15 0 0)`.

**D2 — One accent, locked.** The saturated pop is **Klein blue**
`oklch(0.47 0.2 263)` (Rev 1: replaces forest green per user request). It
appears as: primary button fill (white text), text links/arrows, feature
keys, CTA panel background, selection tint. Nowhere else. Semantic warn
color only inside the transcript.

**D3 — All-sharp radius lock.** `border-radius: 0` everywhere: buttons,
panels, code blocks, chips, the CTA panel. Exceptions: circular logo mark
(brand mark). Documented in CSS comment.

**D4 — Zero shadows.** All `box-shadow` values are removed. Depth comes from
1px borders (`--border` / `--border-strong`) and the dark transcript panel.

**D5 — Typographic transcription replaces the terminal window.** The fake
window chrome (title bar, three dots, title, window shadow) is deleted. In
its place, a full-bleed dark panel (`oklch(0.15 0 0)`, mono, 13.5px) with
the **real CLI output**, faithful to `ResultSummary.tsx`:

```
$ fo organize . --dry-run
Scanning...
  IMG_2024.jpg → images/2024/08
  report.pdf   → documents/pdf
  video.mp4    → video/
  ...6 more
4 files · 1 skipped · 0 errors

$ fo organize .
✓ Organization Complete
Files moved: 4
```

Line-level color: prompt `$` in accent, moves in light text, summary line
muted, `✓ Organization Complete` in accent. No blinking cursor (fake life).
No title bar. `role="img"` + aria-label describing the transcript.
(Rev 1: transcript stays neutral dark — the accent lives on the page, not
inside the transcript except the `$` prompts.)

**D6 — Eyebrows rationed.** Section labels ("How it works", "Plugins",
"Configuration", "Get started") are deleted as decorative eyebrows (current
count: 5-6 across 4 sections, banned). Section headlines carry the sections.
The hero keeps exactly one small mono eyebrow: `File organizer for the
terminal` (categorizes, does not enumerate; no version stamp, that lives in
install per content-truth spec). Total page count: 1 ≤ ceil(5/3).

**D7 — Feature list de-numbered and re-typed.** The `01…05` numbers are
deleted (banned step labels). Each item becomes **key: value** mono pairs —
key in accent, description in muted — mirroring the YAML config the product
is about:

```
patterns    Glob patterns, regex, size thresholds, date ranges...
destinations {year}/{month}/{extension} build paths from metadata...
dry-run     Every move previewed before it happens...
watch       Monitors a folder and organizes new files automatically...
undo        Reverts the last operation...
```

**D8 — Hero stack tightened to 4 elements.** Current hero has 6 text
elements (eyebrow, h1, sub, actions, meta strip with dots, plus CTA labels).
New stack: eyebrow (D6), h1 (2 lines max), sub (≤20 words), actions (2 CTAs).
The `hero-meta` strip and its decorative dots are **deleted**; its claims
already live in features. Hero padding-block-start ≤ 96px; h1 clamp
34-56px; sub max-width 46ch.

**D9 — Single layout family discipline.** Current page has 3 consecutive
text+code splits (plugins x2, config). New rhythm: features = full-width
list rows (changed in D7), plugins = split text+code **once** (merging the
two plugin code blocks: the JS plugin example stays, the 2-line YAML
registration folds into the JS block's caption below it), config = split
reversed (code left, text right). No 3-in-a-row same-family sections.

**D10 — Motion stays fluid, motivated, CSS-only.** Keep (motivated): hero
rise on load, staggered feature rows, hover shifts. Delete: per-line terminal
metronome (the transcript is static typography now), the `blink` cursor.
Keep `prefers-reduced-motion` collapse. No GSAP/Motion (no JS animation
library in an Astro page with no framework).

## 5. Acceptance criteria (verifiable via `bun run build` + browser)

- **AC-1:** Zero shadows: `grep -c box-shadow global.css` returns 0 matches.
- **AC-2:** `border-radius` appears only on `.logo-mark` (7px) and the
  cursor is deleted with the chrome (transcript is sharp). No other radius.
- **AC-3:** Neutral tokens have zero chroma (hue 0 or 0 chroma): canvas,
  text, muted, faint, border, border-strong, surface.
  - Sub-check: no `106` hue in neutral definitions; no `142` hue anywhere
  except where this spec's Rev 1 note references the old green.
  - chroma ≤ 0.005 tolerance (perceptual neutrality)
- **AC-3b:** Accent family is the single colored family: **Klein blue
  (hue 263)**. Warn/error color exists ONLY in the transcript (warn line) —
  no other colored element on the page. Code syntax colors count as content,
  not chrome, so they are permitted inside code blocks as content (documented
  exception). Code syntax uses blue-family + neutral grays only (single
  accent lock).
  - chroma ≤ 0.005 tolerance (perceptual neutrality)
- **AC-4:** Hero has exactly 4 text elements: eyebrow, h1, sub, actions. No
  meta strip, no dots (grep `hero-meta` → 0 matches in both files).
  h1 ≤ 2 lines at 1280px viewport; sub ≤ 20 words.
- **AC-5:** Feature list has no `01…05` numbers (grep `feature-num` → 0) and
  renders 5 key:value rows (key mono accent, desc muted).
- **AC-6:** Section labels deleted except hero eyebrow: grep `section-label` →
  only the hero eyebrow class remains (renamed or removed from the other 4
  usages). Page has ≤ 2 eyebrow-type elements total (hero + none).
- **AC-7:** Terminal chrome deleted: grep `terminal-bar`, `terminal-dot`,
  `terminal-title`, `terminal-cursor` → 0 matches. Transcript is a dark
  panel with `role="img"` and aria-label mentioning dry-run.
  Transcript contains the real summary lines (`Organization Complete`,
  `Files moved:`).
- **AC-8:** Em-dash audit: zero `—` or `–` in visible strings in
  index.astro (copy audit done at rewrite time; em-dash ban per skill 9.G).
  Hyphens in ranges are hyphens.
- **AC-9:** Navigation single-line at desktop (4 links + logo, current
  labels/anchors frozen), nav height ≤ 72px (currently 56px, keep).
- **AC-10:** Responsive collapses: ≤860px single column; ≤580px stacked
  CTAs, nav links hidden. Frozen anchors `#install/#features/#plugins/#config`
  still resolve.
- **AC-11:** `bun run build` passes with no errors; browser check: no
  horizontal overflow at 1280 and 375 widths.

## 6. Assumptions on the table

- Google Fonts `<link>` stays (self-hosting is a separate concern; taste
  only re-skins).
- The `astro.config.mjs` and `tsconfig.json` fixes from content-truth remain
  untouched.
- Code syntax colors inside code blocks are content, not chrome, but stay
  inside the green + neutral family to honor the single-accent lock.
- The CTA panel stays a full-bleed **Klein blue** panel with white text (it
  is the one big color block of the Swiss poster); its buttons invert (white
  bg, blue text) - re-contrast checked in implementation.
- Radius exceptions: `.logo-mark` (brand mark, documented in CSS comment);
  transcript cursor deleted so no exception needed there.

## 7. Verification plan

- `cd landing && bun run build` (AC-11)
- grep audits for AC-1/2/4/5/6/7/8 (mechanical, in the verification step)
- agent-browser: structure + AC-4/AC-9/AC-11 visual check at 1280/375.
- Screenshots before/after for the user to compare.

## 8. Out of scope

- Module 3 (`landing-impeccable`) polish pass: critique/audit refinements,
  Lighthouse, dark mode evaluation, copy polish beyond the em-dash audit.
- npm name decision (runbook blocker), self-hosting fonts.
