# Spec: config-integrity

> Status: **Implemented** (2026-09-11; AC-1…AC-16 verified) · Created: 2026-09-11
> Module of: [CAPABILITY-MAP-cli-cycle2.md](CAPABILITY-MAP-cli-cycle2.md) (`config-integrity`, depends on —)
> Process: spec-driven-development (Specify phase)

## 1. Objective

Make the config file's promise enforceable **before any file moves**
(Constitution Art. VI). Today three things slip past validation and only
surface later — or never:

- An invalid regex in `condition.pattern` is accepted at load time and throws
  during `organize`, far from the mistake, naming no rule.
- `patterns[]` elements are cast, not checked: `patterns: [42, ""]` is accepted.
- `recursive` has **two different defaults**: the loader normalizes a missing
  value to `true`, while the CLI flag, `getExampleConfig()` and `RULES.md` all
  treat it as off. Which behavior you get depends on which adapter you use.

Success looks like: `fo config validate` rejects a bad regex and a bad
`patterns` entry, naming the rule and the index; `recursive` behaves the same
everywhere and is documented; and `RULES.md` describes the variables and knobs
the engine actually implements.

## 2. Non-goals

- Unifying the TUI/MCP `recursive` call sites into one shared default (they pass
  explicit values today) — tracked in `governance`.
- Plugin-contract validation changes beyond sharing the same messages (that
  logic already lives in `validateRuleCore`).
- Adding new destination variables or condition types.
- Making `fo config validate` import plugins (it stays offline; cycle-1 rule).

## 3. Design

### Regex validated at config time

In `validateCondition` (core, shared by YAML and plugin rules):

- When `pattern` is present, compile it (`new RegExp(pattern)`) and rethrow as
  `Invalid rule "<name>": condition.pattern is not a valid regex: <reason>`.
- When `condition.type === 'regex'` and `pattern` is **absent**, throw
  `Invalid rule "<name>": regex condition requires a pattern`. Today that case
  silently matches every file, which is the opposite of what the type promises.
  (`RulesEngine.validateRule` already documents this intent.)

The rule name is threaded into `validateCondition` so every condition error
names the rule — actionable messages are an Article VI requirement.

### `patterns[]` elements validated

`validateRuleCore` currently does `patterns: raw.patterns as string[]`. Replace
with an element-wise check: every entry must be a non-empty string, else
`Invalid rule "<name>": patterns[<i>] must be a non-empty string`. Mirrors the
`plugins[]` validation style already in `loader.ts` (index-naming messages).

### `recursive` default unified to `false`

- `loader.ts`: `recursive: raw.recursive !== false` → `recursive: raw.recursive === true`.
- This matches: the `-r, --recursive` flag semantics (opt-in), `getExampleConfig()`
  (`recursive: false`), and `RULES.md`.
- Recorded as a behavior change in the CHANGELOG: a config that omits `recursive`
  no longer descends into subdirectories. Chosen because it is the **safer**
  default (Art. I: don't reach into places the user did not ask about) and
  because it is what the docs and CLI already implied.
- `watch` is unaffected: it passes `organizeRecursive` explicitly (its own
  default of `true` is a deliberate watch-mode choice).

### Dead `condition.match` removed

`condition.match` is declared in `types`, in the JSON schema, and validated —
but **never read** by the engine (`{match1}` captures come from
`condition.pattern`). A silently-accepted no-op field is a validation lie, so it
is removed from the type, the schema, and validation. Pre-1.0 with nothing
published, so there are no consumers to migrate.

### `RULES.md` made faithful

Add the variables the engine implements but the guide omits — `{yearMonth}`,
`{parent}`, `{sizeBucket}`, `{now:<format>}`, `{match}` — plus the
case-insensitivity rule, and document the config knobs (`recursive` default,
`dryRun`, `includeHidden`, `locale`, `sizeBuckets`). Every row must trace to a
token in `RulesEngine.getTemplateWarnings`'s known set.

### Shipped examples must validate

Tightening validation exposed a pre-existing bug: both `docs/RULES.md` and
`config-examples/advanced.yaml` shipped `pattern: "(?i)(screenshot|…)"`, and
**JavaScript does not support inline flag modifiers** — `new RegExp('(?i)…')`
throws `Invalid group`. The engine already applies the `i` flag at match time,
so the inline flag is both invalid and unnecessary: removed from both. A test
now validates every shipped example (AC-16) so a copy-pasteable config can never
again be one that the tool rejects.

## 4. Commands

```
Build:  bun run build
Test:   bun run test
Lint:   bun run lint
Manual: fo config validate     # must name the offending rule + index
```

## 5. Testing strategy

- **Unit** (`tests/unit/config-loader.test.ts` extends): regex accept/reject,
  missing-pattern rejection, `patterns[]` element matrix, `recursive` default.
- **Unit** (`tests/unit/rules-engine.test.ts` extends): a valid regex still
  matches/captures as before (no regression).
- **Unit** (`tests/unit/docs.test.ts` extends): `RULES.md` documents the
  previously-missing variables (guards against silent doc rot).
- **E2E** (`tests/e2e/config-integrity.test.ts`): `fo config validate` exits 1
  and names the rule for a bad regex; exits 0 for a good one.

## 6. Acceptance criteria

| ID   | Given | When | Then | Test |
|------|-------|------|------|------|
| AC-1 | a rule with `condition.pattern: "(["` | `validateAndNormalizeConfig` | throws naming the rule and "not a valid regex" | unit (config-loader) |
| AC-2 | a rule with a valid `condition.pattern` | `validateAndNormalizeConfig` | accepted; `condition.pattern` unchanged | unit (config-loader) |
| AC-3 | `condition.type: regex` with no `pattern` | `validateAndNormalizeConfig` | throws "requires a pattern", naming the rule | unit (config-loader) |
| AC-4 | `condition.type: size` with no `pattern` | `validateAndNormalizeConfig` | accepted (only regex requires a pattern) | unit (config-loader) |
| AC-5 | `patterns: [42]`, `patterns: [""]`, `patterns: [null]` | `validateAndNormalizeConfig` | throws naming `patterns[0]` as a non-empty string | unit (config-loader) |
| AC-6 | `patterns: ["*.jpg", "*.png"]` | `validateAndNormalizeConfig` | accepted, values preserved | unit (config-loader) |
| AC-7 | a config omitting `recursive` | `validateAndNormalizeConfig` | `recursive === false` | unit (config-loader) |
| AC-8 | `recursive: true` | `validateAndNormalizeConfig` | `recursive === true` | unit (config-loader) |
| AC-9 | `getExampleConfig()` | inspect | `recursive === false` (agrees with the loader default) | unit (config-loader) |
| AC-10 | `condition.match` in a rule | type/schema inspect | the field no longer exists in `RuleCondition` or `CONFIG_SCHEMA` | unit (config-loader) + typecheck |
| AC-11 | a valid regex with a capture group | `RulesEngine.matchFile` + destination `{match1}` | still matches and captures (no regression) | unit (rules-engine) |
| AC-12 | a config with a bad regex | `fo config validate` | exit 1; stderr names the rule | e2e |
| AC-13 | a valid config | `fo config validate` | exit 0 | e2e |
| AC-14 | `docs/RULES.md` | read | documents `{yearMonth}`, `{parent}`, `{sizeBucket}`, `{now:`, `{match}` and the `recursive` default | unit (docs) |
| AC-15 | a plugin rule with a bad regex | `collectPluginRules` | reported as a per-rule failure, run continues (error isolation intact) | unit (plugins/rules) |
| AC-16 | every `config-examples/*.yaml` and `getExampleConfig()` | `validateAndNormalizeConfig` | all validate | unit (config-loader) |

## 7. Boundaries

- **Always:** validate content at config time; name the rule and index in every
  error; keep `fo config validate` offline.
- **Ask first:** changing a default a released version depends on (n/a pre-1.0);
  removing a public type field.
- **Never:** let an invalid regex reach `new RegExp` at organize time; accept a
  no-op field as if it worked; document a variable the engine does not resolve.

## 8. Types & docs touched

- `src/core/rule-validation.ts` (regex + patterns + drop `match`, thread name),
  `src/config/loader.ts` (`recursive` default), `src/config/schema.ts` (drop
  `match`), `src/types/index.ts` (drop `RuleCondition.match`).
- `docs/RULES.md` (variables + knobs).
- New: `tests/e2e/config-integrity.test.ts`.
- `CHANGELOG.md` (behavior change: `recursive` default).

## 9. Open questions

- **OQ-1:** `recursive` default direction — `false` (chosen: matches flag/docs,
  safer) vs `true` (matches current loader). Resolved in favour of `false`;
  revisit only if real configs relied on the implicit `true`.
- **OQ-2:** Reject `condition.pattern` on non-regex types? Default: **no** —
  `{matchN}` consumes it on any type, so it stays allowed and validated.
- **OQ-3:** Drop `condition.match` now or deprecate? Default: **drop** — unused,
  undocumented, nothing published.

## 10. Changelog

- 2026-09-11 — spec drafted (cycle-2 module `config-integrity`).
- 2026-09-11 — **implemented and verified AC-1…AC-16.** Regex and `patterns[]`
  validated in `validateRuleCore` (naming the rule and index); `recursive`
  default unified to `false`; dead `condition.match` removed; `RULES.md`
  rewritten for the variables and knobs the engine actually resolves.
- 2026-09-11 — finding: tightening validation exposed a shipped bug — both
  `docs/RULES.md` and `config-examples/advanced.yaml` used `(?i)`, which
  JavaScript rejects (`Invalid group`). Fixed both; added AC-16 so every shipped
  example must validate. Full suite: 32 files, 301 passed / 1 skipped;
  coverage branch 91.05%; lint 0 errors.
