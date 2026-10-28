# Intake: P-20261028-2, link variable help and error text to their controls; collision-free ids

- Proposal: P-20261028-2 (kind feature, size S, risk low, owner-approved). Planner intake, 2026-10-28.
- Base: `9cf7e21` (task branch `task/6168e44879304acd`).
- INTENT link: **O2, "accessibility and visual-regression guards stay green"** (`INTENT.md:46`;
  `ROADMAP.md:10`).
- Origin: phase 0 deferrals "R1-REV-005/UIQ-004 sanitizer non-injective ids; R1-REV-006/UIQ-003
  aria-describedby variable help (pre-existing)" (`docs/agent-work/phase0-hygiene/handoff.md:3`),
  and the followups fb2444faf8e84201, 4b204ca3395244a4 and 1f3e865decae4631 named by the proposal.

## Objective

When a screen reader user focuses a variable control, it reads the variable's description and,
if the field is invalid, its error, not only the label. Ids built from pricing data (variable
paths, group ids, add-on ids) never collide, including the help and error ids built from them, so
`for`, `aria-controls` and `aria-describedby` always point to the right element.

## Verified facts (file:line at `9cf7e21`)

- `instanceId` at `src/element/renderers.ts:95-102` returns `${prefix}-${name}` plus, with data,
  `-${data.replace(/[^\w-]+/g, '-')}` (`:101`). It is not exported from the public `./element`
  entry (`package.json:41-44`; no match for `renderers|instanceId` in `src/element/index.ts`).
- Collisions, derived from `:101`:
  - `a b`, `a-b`, `a.b` and `a  b` all give `a-b`: `-` is kept and a run of other characters
    becomes one `-`.
  - JS `\w` without the `u` flag is ASCII `[A-Za-z0-9_]`, so any CJK-only value (for example
    `座席` and `席位`) becomes `-`. All such values share one id.
  - Suffix collision (not in the proposal): the help id is `${id}-help` (`:649`). For path `x` it
    is `pr-variable-x-help`, which is also the input id of path `x-help`. Because `-` stays as it
    is, appending to an id or extending a name can collide even with an injective character
    escape. See D2.
- Callers of `instanceId` with data: variable ids `:539` (in `controlInput`) and `:635` (in
  `renderVariables`), group `aria-controls` `:772` and group `id` `:782`, add-on help `:1117`
  (target of `aria-describedby` at `:1158`). The other callers pass no data (`:282,309,390,462,624,
  944,1313,1490,1532,1533`; element `src/element/pricing-renderer-element.ts:1125`).
- Variable field: `<label for=${id}>` `:648`, the help `<p id="${id}-help">` only when
  `control.description` `:649`, then `controlInput` `:650`, then, only when `invalid`,
  `<p class="pr-field__error" role="alert">` with no id `:653-655`.
- `controlInput` (`:532-619`) receives `(state, control, invalid)` and builds the id itself
  (`:539`). Controls: boolean checkbox `:541-551`, select `:554-570`, slider `:574-603` with a
  range input (`id` `:576`) and a number input with no id and an `aria-label` (`:589-602`),
  number/text input `:606-618`. None of them has `aria-describedby`: the only uses in the file are
  `:1158` (add-ons) and `:1541` (dialog).
- The proposal's other evidence also holds: the radio names use `instanceId` (`:309`, `:462`), and
  so do the group ids (`:772`, `:782`) and the add-on help id (`:1117`).
- Requirement `req~element-instance-ids~1` is in `docs/agent-work/phase0-hygiene/spec.md:117-134`
  (tags at `renderers.ts:93`, `pricing-renderer-element.ts:217`, and the tests). Its scenario
  pins the sanitized form `pr-3-group-Core-Features` (`spec.md:151`). `openspec/specs/` does not
  exist. `openspec/changes/` holds only `add-subscription-change-flow`.
- Tests that pin today's encoding and must change in S2:
  `tests/unit/element-instance-ids.test.ts:230-231` (`pr-3-group-Core-Features`), `:279`
  (`pr-7-variable-priceByRegion-eu-price-0-`), `:285` (`pr-9-addon-help-extra-storage`). Tests that
  stay valid under D2: `:278` (`/^pr-7-variable-[\w-]+$/`), `:245` and `:309` (alphanumeric group
  ids from `acme-pricing.yml:23-45` tags), and `tests/unit/addon-grid.test.ts:405-407`
  (`pr-addon-help-a02`, ids `a01`..`a09`).
- Test harness limit: `attributeValues` (`element-instance-ids.test.ts:87-90`) splits a quoted
  value on whitespace, but an unquoted lit binding flattens to `name=v1 v2`, and the unquoted
  branch `([^"\s>]+)` sees only `v1`. So a two-token `aria-describedby` must be bound quoted, as
  `:1158` already is, or the check misses the second id.
- The acme fixture's variable controls have no `description` (`tests/fixtures/acme-pricing.yml:167-184`),
  so S1's tests need a synthetic control with a description, as the existing test does with
  `variableControls` at `element-instance-ids.test.ts:266-274`.
- Ids are not a documented hook: "Ids are not a documented styling hook; `data-pr-part` hooks are
  unchanged" (`.changeset/phase0-instance-ids.md:10`). No doc, example or browser spec selects a
  data-derived id (grep `#pr-|pr-(\d+-)?(variable|group|addon-help)-` over `tests`, `examples`,
  `docs`, `src`: only the unit tests above and agent-work notes).
- `@axe-core/playwright` is a dev dependency (`package.json:99`). `fast-check` is not.
- Commands: `typecheck`, `lint`, `format:check`, `test` (`package.json:131-135`).

## Scope

1. S1: `aria-describedby` on every variable control, pointing to the help id when a description
   exists and to a new error id when the field is invalid (both inputs of the slider), and an id
   on the error `<p>`.
2. S2: an injective encoding of the data part of `instanceId`. It is also safe when a suffix is
   appended (D2). The existing tests change to the new form, and new cases cover `a b`/`a-b`,
   CJK values and the help/error suffixes.

## Non-goals

- No change to `data-pr-part` hooks, CSS classes or visible text.
- No change to the add-on help (`:1117-1158`) or the dialog (`:1532-1541`) except the encoding
  of their data part in S2.
- No change to the change-review element's ids (`src/element/change-review-renderers.ts:141,415`
  use static parts, not data).
- No change to `role="alert"` on the error (`:653`), and no new i18n key.
- No public export of `instanceId` and no documented id format.
- No `acceptance/**` and no `openspec/specs/**` (the coordinator writes the OpenSpec change).

## Decisions taken in this intake

- D1. Two slices, one capability each, run in order (S1 then S2). Reason: both edit
  `src/element/renderers.ts`, so they cannot run in parallel. S1 is the user-visible fix and does
  not depend on the encoding. S2 changes test expectations that S1 does not touch. Each one can
  be merged and reverted on its own.
- D2. The encoding keeps `[A-Za-z0-9]` and writes every other code point, `-` and `_` included,
  as `_<lowercase hex>_`. For example `a b` gives `a_20_b`, `a-b` gives `a_2d_b`, and `座席` gives
  `_5ea7__5e2d_`. The string is walked by code point (`for...of`), so a surrogate pair is one
  escape. Reason: `_` appears only as an escape delimiter, so the encoding can be decoded and is
  injective. Since encoded data never contains `-`, `name-data` and `name-data-help/-error` can
  be parsed in one way only, as long as the static names stay distinct. That closes the suffix
  collision found above. Ids made only of letters and digits do not change
  (`addon-grid.test.ts:405-407`, the acme groups). Alternative ruled out: keeping `-` readable
  (see Ruled out).
- D3. The help id stays `${id}-help`, and the error id is `${id}-error`. `controlInput` builds
  `aria-describedby` from the same `id`, `control.description` and `invalid` it already has
  (`:532-539`). The attribute is quoted, and absent (lit `nothing`) when neither id exists. Order:
  help first, then error. Reason: no signature change, and D2 makes both suffixes safe.
- D4. Requirements: a new `req~variable-field-describedby~1` (S1) and a revision
  `req~element-instance-ids~2` that adds "the data part is injective, also under the help/error
  suffixes" and replaces the scenario at `phase0-hygiene/spec.md:151` (S2). The coordinator
  places them in the OpenSpec change. Tags move from `~1` to `~2` in S2's files.
- D5. No feature flag. Reason: each slice is one small capability, can be reverted with its PR,
  and touches no stored or public format.
- D6. No ADR. Reason: no new architecture, dependency or public format.
- D7. Each slice is a test-designer task (T, red-before, G3) followed by an implementer task (I,
  frozen test, G4), as in phase 0 (`docs/agent-work/phase0-hygiene/intake.md:216-219`). The T and
  I tasks of one slice are merged together. Each I adds a patch changeset in the style of
  `.changeset/phase0-instance-ids.md`.

## Ruled out

- Fixing only `aria-describedby` (proposal alternative 1): the R1-REV-005/UIQ-004 collision would
  stay a known deferral, and S1 adds one more suffix (`-error`) to an id scheme that can collide.
- Keeping `-` as it is and escaping only the other characters (the proposal's example): `a b` and
  `a-b` would then differ, but `x` + `-help` would still equal the id of path `x-help`.
- `encodeURIComponent` or base64: `%` is legal in an id but breaks unescaped CSS selectors. Base64
  ids are unreadable and need `+`, `/` and `=` handling.
- A per-instance counter or hash per data value: ids would no longer follow from the data, and the
  tests could not predict them.

## Checks used below

Registered set (indexes from the coordinator): `C-install` `["pnpm", "install", "--frozen-lockfile"]`,
`C-type` `["pnpm", "typecheck"]`, `C-lint` `["pnpm", "lint"]`, `C-test` `["pnpm", "test"]`,
`C-format` `["pnpm", "format:check"]`. A red-before check has this form (G3, timeout 300):

`{"argv": ["pnpm", "exec", "vitest", "run", "<test file>"], "type": "red_before", "expect_exit": [1], "expect_pattern": "AssertionError|expected", "overlay": ["<test file>"]}`

Every T and I task runs all five. The browser spec runs in CI only. A slice's PR is green only
when the CI `quality` job and the chromium shards pass on its head.

## Slices

### S1: variable help and error linked to the control

- Capability: `req~variable-field-describedby~1`. Risk **low**, score 0: no risk area, no public
  API, no external input beyond what is already rendered, one module, and about 25 source lines.
- S1-T, test-designer, turn budget 30. Owns `tests/unit/variable-field-describedby.test.ts` (new).
  Read-only: `src/element/renderers.ts:532-664`, `tests/unit/element-instance-ids.test.ts:66-143`
  (copy the `flatten`/`attributeValues`/`stateFor` pattern; do not import from that file).
  Cases, with `renderVariables` and `idPrefix: 'pr-7'`, and synthetic controls of each type
  (boolean, select, slider, number, text) with a `description`:
  - each control's `aria-describedby` contains `pr-7-variable-<path>-help`, and that id exists;
  - for the slider, both the range and the number input carry it;
  - no description and valid: no `aria-describedby` value;
  - invalid (an expression price that depends on the path, as at `renderers.ts:636-645`): the
    error `<p>` has id `pr-7-variable-<path>-error`, and `aria-describedby` lists help, then
    error;
  - every reference resolves inside the output.
  Red-before: the red-before form above on this file.
- S1-I, implementer, turn budget 30. Owns `src/element/renderers.ts` (only `controlInput` and the
  error `<p>` in `renderVariables`, `:532-664`) and `.changeset/variable-field-describedby.md`
  (patch). Read-only: the frozen S1-T test, D3. Tag `[impl->req~variable-field-describedby~1]`.
  Checks: `C-install`, `C-type`, `C-lint`, `C-test`, `C-format`.
- Size: about 25 source lines plus about 120 test lines. Depends on: the OpenSpec change (G1).
- ui-qa: with a screen reader (NVDA or VoiceOver), focus a described slider, a described select
  and an invalid number field, and check that the description and the error are read once. The
  error has `role="alert"` (`:653`), so it may be announced twice; report it, do not change it
  here (Q3).

### S2: injective instance ids

- Capability: `req~element-instance-ids~2`. Risk **low**, score 2: pricing data from the document
  (external input, +2) goes into attribute values. lit escapes the values, and the change narrows
  the character set. One module, under 200 source lines, no public export (`instanceId` is not in
  `src/element/index.ts`), and ids are not a documented hook (`phase0-instance-ids.md:10`).
- S2-T, test-designer, turn budget 30. Owns `tests/unit/element-instance-ids.test.ts`. Updates
  `:230-231` to `pr-3-group-Core_20_Features`, `:279` to the D2 form of
  `priceByRegion.eu price[0]`, and `:285` to `pr-9-addon-help-extra_20_storage`. Moves the
  `[utest->...]` tags (`:145,222,302`) to `~2`. Adds:
  - two variables `a b` and `a-b` in one `renderVariables` output: no id appears twice;
  - two groups `a b` and `a-b` in one `renderComparison` output: distinct ids, and each
    `aria-controls` resolves;
  - CJK paths `座席` and `席位`: distinct ids, each `/^pr-7-variable-[\w-]+$/`;
  - suffix: variables `x` (with a description) and `x-help` in one output: no duplicate id;
  - letters and digits only (`extraStorage`, `a02`): the id is unchanged;
  - an astral code point (an emoji): one escape, not two.
  `tests/browser/element-instance-ids.spec.ts` needs no change (it checks duplicates and
  resolution, not the form). Red-before: the red-before form above on this file.
- S2-I, implementer, turn budget 25. Owns `src/element/renderers.ts` (only `instanceId`,
  `:93-102`, and its tag), `src/element/pricing-renderer-element.ts` (only the tag at `:217`,
  `~1` to `~2`), `tests/browser/element-instance-ids.spec.ts` (only the tag at `:6`), and
  `.changeset/injective-instance-ids.md` (patch: "data-derived ids now escape every character
  other than letters and digits"). Checks: `C-install`, `C-type`, `C-lint`, `C-test`, `C-format`.
- Size: about 15 source lines plus about 80 test lines. Depends on: S1 merged (D1; shared
  `renderers.ts`), and the OpenSpec change with `~2` (G1).

### Ownership and order

| Order | Task | Owns | Parallel with |
|---|---|---|---|
| 1 | S1-T | `tests/unit/variable-field-describedby.test.ts` | S2-T |
| 2 | S1-I | `renderers.ts`, `.changeset/variable-field-describedby.md` | none |
| 1 | S2-T | `tests/unit/element-instance-ids.test.ts` | S1-T |
| 3 | S2-I | `renderers.ts`, element file tag, browser spec tag, `.changeset/injective-instance-ids.md` | none |

S1-T and S2-T own disjoint files and can run in parallel. S1-I and S2-I share `renderers.ts`, so
S2-I starts after S1-I is merged. S2-T's frozen test must not depend on S1, so it must not assert
an `-error` id. Other changes in flight: none of `openspec/changes/` touches `renderers.ts`, as far
as the files show. The coordinator re-checks the open PRs (Q4).

## Gates per slice

As in the earlier intakes (`docs/agent-work/prop-20261027-3/intake.md:156-176`), the skills I read
define no G5 or G7, so the coordinator maps them.

| Gate | S1 | S2 |
|---|---|---|
| G1 openspec validate --strict | change level, before T | same change, `~2` delta |
| G2 EPIC review | applies (new requirement) | applies (revised requirement) |
| G3 red-before | S1-T, new test file | S2-T, updated test file |
| G4 acceptance freeze | S1-I runs the frozen S1-T test | S2-I runs the frozen S2-T test |
| G5 | not defined in the skills I read | same |
| G6 trace | `req~variable-field-describedby~1` impl and utest | `req~element-instance-ids~2` impl and utest, no `~1` left |
| G7 | not defined in the skills I read | same |
| G8 mutation | if registered: `controlInput` | if registered: `instanceId` |
| G9 dependency and licence | N/A (no dependency) | N/A |
| G10 secrets | applies if registered | applies if registered |
| G11 review | one reviewer (low) | one reviewer (low), plus a check of the D2 injectivity argument |
| G12 ui-qa | applies: screen reader check above, axe on the variables section | axe `duplicate-id-aria` clean in the browser spec (CI) |
| G13 how-to-test | applies: the demo variables, focus each control | applies: a pricing with `a b`/`a-b` groups, inspect the ids |

## Open questions

Needs a CRP (owner): none required. The proposal is owner-approved, and no public API, stored
format or threshold changes. One point the owner may want to see stated in the S2 PR:

- Q1. The data-derived ids change for any value with a character other than a letter or digit
  (for example `pr-<n>-group-Core-Features` becomes `pr-<n>-group-Core_20_Features`). Ids are not
  a documented hook (`phase0-instance-ids.md:10`), so this is a patch. If the owner treats ids as
  public, S2 becomes minor and risk medium (+3). Recommendation: patch, stated in the changeset.

For the coordinator:

- Q2. Where the requirements go: a new OpenSpec change (for example
  `openspec/changes/link-variable-help-ids/`) with a delta for `element-instance-ids`, although
  `~1` lives only in `docs/agent-work/phase0-hygiene/spec.md`. The coordinator chooses the
  convention.
- Q3. `role="alert"` together with `aria-describedby` may make the error be read twice. Keep it
  out of scope unless ui-qa reports it in S1. If it does, a followup decides between `role="alert"`
  and `aria-live="polite"`.
- Q4. Re-check the open PRs for any other change to `src/element/renderers.ts` before S1-I starts.
