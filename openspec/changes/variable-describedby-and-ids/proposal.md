# Proposal: link variable help and error text to their controls; collision-free instance ids

Change `variable-describedby-and-ids`. Proposal P-20261028-2 (kind feature, size S, risk low),
approved by the owner. Planner intake: `docs/agent-work/prop-20261028-2/intake.md`. Base: `9cf7e21`;
line numbers below are at the current head `47a7b05` unless marked otherwise.

## Why

INTENT link: **O2, "accessibility and visual-regression guards stay green"** (`INTENT.md:46`,
`ROADMAP.md:10`). Origin: the phase 0 deferrals "R1-REV-005/UIQ-004 sanitizer non-injective ids;
R1-REV-006/UIQ-003 aria-describedby variable help (pre-existing)"
(`docs/agent-work/phase0-hygiene/handoff.md:3`) and the followups fb2444faf8e84201,
4b204ca3395244a4 and 1f3e865decae4631.

Today:

- A variable field renders its description as `<p id="${id}-help">` (`src/element/renderers.ts:653`)
  and, when invalid, an error `<p class="pr-field__error" role="alert">` with no id
  (`renderers.ts:657-659`). No control built by `controlInput` (`renderers.ts:536-623`) has
  `aria-describedby`, so a screen reader that focuses the control reads only the label.
- `instanceId` (`renderers.ts:95-102`) replaces each run of `[^\w-]` in the data part with one `-`
  and keeps `-` as it is. So `a b`, `a-b`, `a.b` and `a  b` all give `a-b`; every CJK-only value
  gives `-` (`\w` is ASCII without the `u` flag); and the help id of path `x`
  (`pr-variable-x-help`) equals the control id of path `x-help`. Duplicate ids break `for`,
  `aria-controls` and `aria-describedby`.

## What changes

- **variable-field-describedby**: every input of a variable control references the field's
  description and, when the field is invalid, its error text through `aria-describedby`. The error
  text gets the id `<control id>-error`. The help id `<control id>-help` stays.
- **element-instance-ids**: the data part of an id keeps ASCII letters and digits and writes every
  other code point, `-` and `_` included, as `_<lowercase hex>_` (`a b` -> `a_20_b`,
  `a-b` -> `a_2d_b`, `座席` -> `_5ea7__5e2d_`). Ids made only of letters and digits do not change.
- No visible change: no new text, class, `data-pr-part` hook or i18n key.

## Why two capabilities

The owner-approved proposal holds both, and they share `src/element/renderers.ts`:

1. **variable-field-describedby** is the user-visible accessibility fix. It does not depend on the
   encoding and can merge alone (slice S1).
2. **element-instance-ids** revises the phase 0 requirement so that ids are injective, also under
   the `-help` and `-error` suffixes that S1 relies on (slice S2). It changes only test
   expectations and the body of `instanceId`.

Each is one slice, merged and revertible on its own, in the order S1 then S2 (design.md D1).

## Impact

- Capabilities: `variable-field-describedby` (ADDED, `req~variable-field-describedby~1`) and
  `element-instance-ids` (ADDED to OpenSpec as `req~element-instance-ids~2`; it revises `~1`, which
  lives only in `docs/agent-work/phase0-hygiene/spec.md:117-157`; see design.md D4).
- Code areas: `src/element/renderers.ts` (`instanceId`, `controlInput`, the error `<p>` in
  `renderVariables`), the tag in `src/element/pricing-renderer-element.ts:221`, the tag in
  `tests/browser/element-instance-ids.spec.ts:6`, unit tests, two patch changesets.
- Public API: none. `instanceId` is not exported from `./element` (`package.json:41-44`,
  `src/element/index.ts`). Ids are not a documented hook
  (`.changeset/phase0-instance-ids.md:10`).
- Rendered ids: every data-derived id with a character other than an ASCII letter or digit changes
  form (for example `pr-3-group-Core-Features` becomes `pr-3-group-Core_20_Features`). Treated as a
  patch (design.md, open question Q1).
- Risks: design.md, "Risks".

## Out of scope

- `data-pr-part` hooks, CSS classes, visible text, i18n keys.
- The add-on help (`renderers.ts` add-on cards) and the dialog, except the encoding of their data
  part in S2.
- The change-review element's ids (`src/element/change-review-renderers.ts`; static parts only).
- `role="alert"` on the error text (Q3).
- A public export of `instanceId` or a documented id format.
- The breakdown id `pr-breakdown-<n>` (`req~summary-breakdown-unique-ids~1`).
