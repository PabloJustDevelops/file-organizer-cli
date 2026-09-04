# Smell Report — file-organizer-cli landing

**Date:** 2026-09-03
**Mode:** smell
**Score:** 6/10 — PRESENT

---

## TL;DR

The landing avoids the worst tech-cliche traps (no indigo gradient, no centered hero, real terminal proof object). But it still carries 4 generic tells: feature tile grid with decorative icon toppers, stat monument with inflated numbers, unearned backdrop blur on the appbar, and CTA footer reverting to centered-stack safety. The core composition is strong — these are refinement-level smells, not identity failure.

**Primary recommendation:** Run `/design deslop` to replace feature cards with a denser, more specific layout, cut the stats to real numbers, and give the CTA footer the same asymmetric energy as the hero.

---

## Heuristic Scores

| # | Heuristic | Score | Key Finding |
|---|---|---|---|
| 1 | Tech gradient | 1 | PASS — No blue-violet or indigo-cyan gradients detected |
| 2 | Generic tech hue | 1 | PASS — Uses forest green (oklch 145), not default blue-purple |
| 3 | Feature tile grid | 0 | FAIL — 6 identical icon+heading+desc cards in uniform 3-col grid |
| 4 | Accent rail | 1 | PASS — No decorative colored stripes on cards |
| 5 | Unearned blur | 0 | FAIL — backdrop-filter: blur on appbar with no depth system justification |
| 6 | Stat monument | 0 | FAIL — "∞" and "0 dependencies" are inflated placeholder claims |
| 7 | Icon topper | 0 | FAIL — Decorative unicode icons (§◈◉⟳↶⚙) above each feature |
| 8 | Bounce everywhere | 1 | PASS — Motion is restrained, uses ease-out, has reduced-motion fallback |
| 9 | Default type | 1 | PASS — Geist + Geist Mono is a deliberate pairing with reasoning |
| 10 | Center stack | 0 | FAIL — CTA footer reverts to centered composition |

**Total: 6/10**

---

## Findings

| # | Severity | Discipline | Location | Before | After | Why |
|---|---|---|---|---|---|---|
| 1 | MEDIUM | Layout | `index.html:777-807` | 6 feature cards in uniform 3×2 grid, equal weight, decorative icon toppers | Editorial list layout with hierarchy — lead with the most differentiated feature, group supporting ones, or use a denser table-like scan pattern | Card grid reads as template. Every feature gets equal visual weight regardless of actual differentiation. |
| 2 | LOW | Voice | `index.html:696-708` | Stats: "6 Condition types", "∞ Rules supported", "0 Dependencies" | Real, specific numbers or remove entirely. "∞" is meaningless. "0 dependencies" is a bullet point, not a hero stat. | Stat monument filling space where product story belongs. The numbers don't tell the visitor anything they couldn't get from a README. |
| 3 | LOW | Layout | `index.html:80-87` | Appbar uses `backdrop-filter: blur(12px)` with semi-transparent bg | Solid background or very subtle tint. Blur should earn its place with layered content beneath it. | Floating chrome over a flat page with no z-index layering. The blur does no work here. |
| 4 | LOW | Composition | `index.html:848-861` | CTA footer: centered heading + centered pills + accent flood | Asymmetric split or left-aligned action with terminal-style proof. Keep the hero's compositional language. | Reverts to safe centered stack after an asymmetric hero. Feels like two different pages. |
| 5 | LOW | Writing | `index.html:773, 852` | "Everything you need to automate file chaos" / "Clean folders start here" | Specific, concrete copy that names the actual user state: "Stop sorting ~/Downloads by hand" | Generic benefit statement that could apply to any organizer tool. No project-specific voice. |

---

## Considered but Rejected

| Location | Candidate | Rejected because |
|---|---|---|
| `index.html:155-168` | Eyebrow badge is generic | The version badge is specific to this project (CLI tool v0.1.0), not a decorative chip |
| `index.html:242-316` | Terminal might be seen as fake "screenshot" | Terminal content is realistic dry-run output with actual command names. This is legitimate proof. |
| `index.html:512-518` | CTA uses accent color flood | The brief is a landing page — accent flood on CTA is appropriate when earned. Could use more tension. |

---

## Verification

| Check | Method | Result |
|---|---|---|
| Color palette inspection | Visual scan of CSS custom properties | PASS — Forest green is domain-atypical for file tools |
| Composition symmetry scan | Section-by-section layout analysis | MIXED — Hero asymmetric, features uniform, CTA centered |
| Type reasoning verification | Font stack + weight scale review | PASS — Geist chosen for weight contrast, mono for terminal |
| Icon function analysis | Feature icon inspection | FAIL — Unicode glyphs carry no semantic content |
| Motion audit | Animation + reduced-motion check | PASS — Restrained entrance, respects prefers-reduced-motion |
| Contrast sampling | APCA estimation on key pairs | PASS — Text/muted/border values have clear lightness separation |

---

## Verdict

**Needs changes** — No HIGH smells. The structural foundation (asymmetric hero, real terminal proof, deliberate color/type) is sound. The issues are concentrated in the features section (uniform cards, decorative icons) and a CTA footer that breaks compositional consistency. A deslop pass will resolve the remaining odor without requiring redesign.
