# Capability Map: Landing (v1)

> Status: Approved · Date: 2026-09-04
> Process: spec-driven-development, Phase 0
> Scope note: the landing lives in the gitignored `landing/` directory
> (local-only by decision). Specs and tasks ARE tracked in this repo; the
> landing code itself is not — CI cannot build it, so verification is local
> (`astro build` + AC checklists) and the user reviews visually.

## Modules

| Module id                | Responsibility                                                                 | Depends on |
|--------------------------|--------------------------------------------------------------------------------|------------|
| `landing-content-truth`  | Sync content with reality: plugins section, honest install command, version, repo links | — |
| `landing-taste`          | Visual identity pass with `design-taste-frontend`: typography, palette, spacing system | `landing-content-truth` |
| `landing-impeccable`     | Polish pass with `impeccable` (critique → polish): contrast, motion, responsive, a11y | `landing-taste` |

Build order: `landing-content-truth` → `landing-taste` → `landing-impeccable`
(a re-skinned lie would still be a lie; content first, then identity, then
polish).

## Notes

- The new skills (`design-taste-frontend`, `impeccable`, `astro`) are
  installed at project level and drive phases 2–3.
- Content gaps found during grounding: no plugins section (the system is the
  pilot's headline feature), install command references the taken npm name,
  version badge says 0.1.0 while the repo is at 0.1.0-rc.1, no GitHub link.
- Verification contract: every AC that claims a visual/behavioral outcome is
  checked by local build + browser inspection (`agent-browser`), never by
  unit tests — the landing has no test infrastructure and v1 won't add one.
