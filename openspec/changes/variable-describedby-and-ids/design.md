# Design: variable-describedby-and-ids

Decisions D1-D7 come from the planner intake (`docs/agent-work/prop-20261028-2/intake.md:90-119`).
Line numbers are at head `47a7b05`; the intake cites `9cf7e21`, where the `controlInput` and
`renderVariables` lines are 4 lower and the element tag is at `:217`.

## Context

- `instanceId(state, name, data?)` (`src/element/renderers.ts:95-102`) returns
  `${idPrefix ?? 'pr'}-${name}` and, with data, appends `-${data.replace(/[^\w-]+/g, '-')}`
  (`:101`).
- Callers with data: the variable control id (`:543` in `controlInput`, `:639` in
  `renderVariables`), the comparison group `aria-controls` and `id`, and the add-on help id that
  the add-on card references with `aria-describedby`. The other callers pass no data.
- Variable field: `<label for=${id}>` (`:652`), help `<p id="${id}-help">` only with
  `control.description` (`:653`), `controlInput` (`:654`), error `<p class="pr-field__error"
  role="alert">` without id only when `invalid` (`:655-661`).
- `controlInput(state, control, invalid)` (`:536-623`) builds `id` itself (`:543`). Controls:
  checkbox (`:545-555`), select (`:558-574`), slider with a range input (`id`, `:579-592`) and a
  number input with no id and an `aria-label` (`:593-606`), number/text input (`:610-622`).

## Decisions

### D1. Two slices, in order

S1 (describedby) then S2 (injective ids), one capability each. Both edit
`src/element/renderers.ts`, so the implementation tasks cannot run in parallel. S1 is the
user-visible fix and does not depend on the encoding; S2 changes test expectations S1 does not
touch. Each can be merged and reverted alone.

### D2. Injective encoding of the data part

Keep `[A-Za-z0-9]`. Walk the string by code point (`for...of`) and write every other code point,
`-` and `_` included, as `_` + the lowercase hexadecimal code point value without leading zeros +
`_`.

| Data | Encoded |
|---|---|
| `a b` | `a_20_b` |
| `a-b` | `a_2d_b` |
| `a_b` | `a_5f_b` |
| `座席` | `_5ea7__5e2d_` |
| `席位` | `_5e2d__4f4d_` |
| `Core Features` | `Core_20_Features` |
| `priceByRegion.eu price[0]` | `priceByRegion_2e_eu_20_price_5b_0_5d_` |
| `😀` (U+1F600) | `_1f600_` |
| `extraStorage`, `a02` | unchanged |

Why it is injective: outside an escape the output holds only letters and digits; `_` appears only
as an escape delimiter, and an escape ends at the next `_`. So the output decodes in one way only,
and two different data values give two different outputs.

Why it is safe under suffixes: encoded data never contains `-`. So `<name>-<data>` and
`<name>-<data>-help` / `<name>-<data>-error` can be parsed in one way only, as long as the static
names stay distinct. For path `x` the help id is `pr-variable-x-help`; the control id of path
`x-help` is `pr-variable-x_2d_help`.

Options considered:

- Keep `-` and escape only the other characters: `a b` and `a-b` differ, but `x` + `-help` still
  equals the id of `x-help`. Rejected.
- `encodeURIComponent`: `%` breaks unescaped CSS selectors. Rejected.
- Base64: unreadable, and needs `+`, `/`, `=` handling. Rejected.
- A counter or a hash per value: ids no longer follow from the data and tests cannot predict them.
  Rejected.

### D3. Help and error ids, and the attribute binding

The help id stays `${id}-help`; the error id is `${id}-error`. `controlInput` builds the
`aria-describedby` value from the `id`, `control.description` and `invalid` it already receives,
so its signature does not change. Order: help first, then error. Every input of the control gets
it: the checkbox, the select, both inputs of the slider, and the number/text input.

The value is bound quoted (`aria-describedby="${describedBy}"`), as the add-on card already does.
Reason: the test harness (`tests/unit/element-instance-ids.test.ts:87-90`) splits a quoted value
on whitespace, but reads only the first token of an unquoted binding, so a two-token value would be
half checked. When neither id applies the binding is lit `nothing`, so the attribute is absent
rather than empty.

### D4. Requirements and where they live

- New `req~variable-field-describedby~1` (S1), capability `variable-field-describedby`.
- `req~element-instance-ids~2` (S2), capability `element-instance-ids`. Revision 2 because the
  meaning changes: `~1` (`docs/agent-work/phase0-hygiene/spec.md:117-157`) defines the data part as
  sanitized (`[^\w-]+` -> `-`) and pins `pr-3-group-Core-Features`; `~2` defines the injective
  encoding and replaces that scenario.
- `openspec/specs/` holds no living spec, so `element-instance-ids` has nothing to MODIFY. The delta
  uses `## ADDED Requirements` with the complete `~2` text, as `phase1a-design-systems` does for
  its capabilities (`openspec/changes/phase1a-design-systems/proposal.md:63-66`). The OFT revision
  still moves to `~2`: S2 moves every `~1` tag (`src/element/renderers.ts:93`,
  `src/element/pricing-renderer-element.ts:221`, `tests/unit/element-instance-ids.test.ts:145,222,302`,
  `tests/browser/element-instance-ids.spec.ts:6`), so no `~1` coverage is left.

### D5. No feature flag

Each slice is one small capability, revertible with its PR, and touches no stored or public format.

### D6. No ADR

No new architecture, dependency or public format.

### D7. Tests first, per slice

Each slice is a test-designer task (T, red before, G3) followed by an implementer task (I, frozen
test, G4), as in phase 0 (`docs/agent-work/phase0-hygiene/intake.md:216-219`). The T and I tasks of
one slice merge together. Each I adds a patch changeset in the style of
`.changeset/phase0-instance-ids.md`.

## Requirement notes

The requirement statements are short (OpenSpec warns above 500 characters); these notes fix their
terms. The scenarios pin each one with concrete values.

`req~variable-field-describedby~1` (tests: `tests/unit/variable-field-describedby.test.ts`):

- `<control id>` is the control's instance id `pr-<n>-variable-<data>` (`req~element-instance-ids~2`),
  or `pr-variable-<data>` without an instance prefix.
- "Every input of its control": the checkbox of a boolean control, the select, both the range and
  the number input of a slider, and the number or text input.
- The two ids are separated by one space, help first.
- The description element carries `<control id>-help` and the error text element carries
  `<control id>-error`; each renders only when it applies, as today. The label, both texts and
  `role="alert"` do not change.

`req~element-instance-ids~2` (tests: `tests/unit/element-instance-ids.test.ts`, browser
`tests/browser/element-instance-ids.spec.ts`):

- The hex value has no leading zeros (`_20_`, not `_0020_`); a code point outside the BMP is one
  escape (`_1f600_`).
- It covers the static ids of `~1` (`pr-loading-title`, `pr-title`, `pr-plans-title`,
  `pr-variables-title`, `pr-comparison-title`, `pr-addons-title`, `pr-metadata-title`,
  `pr-dialog-title`, `pr-dialog-description`), the data ids `pr-variable-<path>`,
  `pr-group-<group id>` and `pr-addon-help-<add-on id>`, and the ids built from them by a suffix
  (`-help`, `-error`).
- Every `aria-labelledby`, `aria-describedby`, `aria-controls` and `for` value points to an id with
  the same prefix. Output without an instance prefix uses `pr`.
- Ids whose data part has only ASCII letters and digits are the same as under `~1`.
- The breakdown keeps `pr-breakdown-<n>` (`req~summary-breakdown-unique-ids~1`).

## Risks

- S2-T rewrites existing assertions; a wrong expected string would freeze a wrong encoding.
  Mitigation: the reviewer checks the D2 table, in particular `a_20_b`, `a_2d_b` and
  `_5ea7__5e2d_`.
- `role="alert"` together with `aria-describedby` may make the error be read twice (Q3).
- A host that selected a data-derived id in its own CSS or scripts sees a new form (Q1). Ids are
  not a documented hook, and no doc, example or browser spec selects one (intake, verified facts).
- Both implementation slices edit `renderers.ts`; S2-I starts only after S1 is merged (Q4).

## Migration

None. No stored data or public API. The id change is stated in the S2 changeset.

## Open questions

- Q1 (owner, may be stated in the S2 PR): data-derived ids change form. Patch while ids are not
  public (`.changeset/phase0-instance-ids.md:10`); minor and risk medium if the owner treats them as
  public. Recommendation: patch, stated in the changeset.
- Q3 (ui-qa): the error is announced by `role="alert"` and is also in `aria-describedby`. Out of
  scope unless ui-qa reports a double reading in S1; then a followup chooses between `role="alert"`
  and `aria-live="polite"`.
- Q4 (coordinator): re-check open PRs for edits to `src/element/renderers.ts` before S1-I starts.
