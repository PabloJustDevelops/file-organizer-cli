# ADR 0009 — Constitution amendment: plugin status claim

- **Status:** Accepted
- **Date:** 2026-09-11

## Context

`docs/constitution.md` (Art. III) states the rule that documentation must mark
unimplemented behavior as *Planned — not implemented*, and illustrates it with
"(Known offender: `PLUGINS.md`.)".

That illustration became false. The plugin system shipped (six specs and a
capability map under `docs/specs/`, plus unit and integration tests), and
`docs/PLUGINS.md` was re-validated against the implementation in cycle 1. The
rule is still correct; the example now accuses a document that is accurate,
which is exactly the kind of drift the Constitution itself calls "a bug of equal
severity to a code bug".

The Constitution carries its own amendment clause: "Amendments require a new ADR
(see `docs/decisions/`)." This is that ADR.

## Decision

Amend Article III's third bullet to state the rule without the stale example,
and to reflect current reality: the plugin system is implemented and
`PLUGINS.md` describes shipped behavior. The bullet links this ADR as its
amendment record.

## Consequences

- **+** The Constitution no longer contradicts the repository, so it can be read
  as trustworthy on first contact.
- **+** The amendment follows the document's own procedure (ADR-first), keeping
  the decision auditable.
- **−** ADRs are immutable and numbered sequentially; a future change to this
  text needs ADR-0010 rather than an edit here.

## Verification

- `tests/unit/docs.test.ts` asserts `constitution.md` no longer names
  `PLUGINS.md` as an offender while still stating the planned-vs-shipped rule.
