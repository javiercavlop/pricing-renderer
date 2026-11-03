# Proposal: the "Add-on" marker follows `availableFor`

Change `addon-marker-available-for`. Proposal P-20261101-1 (UX-7, kind feature, size S, risk low),
approved by the owner. Planner intake: `docs/agent-work/prop-20261101-1/intake.md`; handoff:
`docs/agent-work/prop-20261101-1/handoff.md`. Line numbers are at base `09363ed`.

## Owner approval and CRP-U7

The owner's approval of P-20261101-1 is also the owner's answer to CRP-U7
(`docs/agent-work/pending-phases/plan.md:557-559`): item 6 R3 is amended so that the marker follows
`availableFor`, and Q-D of CRP-U7 is answered with "keep R6" (no marker in mixed rows). This change
therefore amends R3 of `docs/agent-work/spectra-item6-addon-marker/spec.md` and keeps its R6. The
item 6 spec is edited in place at R1, R3, R7, R9, AC2 and AC7, and each edit names P-20261101-1
and CRP-U7.

## Why

INTENT link: **O1, "real-world Pricing2Yaml pricings render legibly"** (`INTENT.md`, section "O1").
UX-7 (`docs/agent-work/ux-review/report.md:482-500`) sets the metric "misleading marker cells" with
the target 0 (`:496`).

Today:

- `isAddOnOnlyRow` (`src/core/view-model.ts:611-620`) checks every add-on of `viewModel.addOns` and
  never reads `availableFor`.
- Both layouts compute one boolean per row (`src/element/renderers.ts:804`, `:907`) and pass it to
  every cell (`:826`, `:922`). `renderValue` then shows "Add-on" in place of the em dash
  (`:211-217`).
- So a cell says "Add-on" on a plan that cannot buy any add-on that provides the row. At the
  selected plan this happens in 81 rows of 14 SPECTRA fixtures and in 56 stress-fixture rows (PR #72
  CI, job 123038643751, `UX_COUNTS` lines; intake E3). Example: every Mailchimp add-on is restricted
  to paid plans (`tests/fixtures/spectra/mailchimp/2024.yml:759-845`), yet the FREE column shows
  "Add-on".

## What changes

- In an add-on-only row, a plan cell shows "Add-on" only when an add-on that provides the row is
  available for that cell's plan (`availableFor` empty or containing the plan id).
- Every other cell of that row shows the existing em dash with "Not included".
- Both layouts (table and compact) follow the same rule.
- Rows with a plan value (mixed rows) keep their em dashes, as item 6 R6 says.
- Which rows count as add-on only does not change: `isAddOnOnlyRow` and the detected SPECTRA count
  of 166 stay.

## Impact

- Capability: `addon-marker` (ADDED): `req~addon-marker-per-plan-availability~1` and
  `req~addon-marker-helper-internal~1`. One capability; the second requirement bounds the first.
- Code areas: `src/core/view-model.ts` (a new internal helper `addOnProvidesForPlan`) and the two
  cell call sites in `src/element/renderers.ts`. One patch changeset.
- Tests: `tests/unit/addon-marker.test.ts`, `tests/unit/ux-counts.test.ts` and
  `tests/browser/spectra-addon-marker.spec.ts`. Their R3-derived assertions ("one marker per plan")
  change with this change (intake E8).
- Docs: `docs/agent-work/spectra-item6-addon-marker/spec.md` (R1, R3, R7, R9, AC2, AC7).
- Public API: none. No type, attribute, event, CSS part, data attribute, i18n key or feature flag
  (`req~addon-marker-helper-internal~1`, item 6 R7).
- Visual baselines: none move. The demo pricing has no add-on-only row
  (`tests/unit/addon-marker.test.ts:361-368`), so it renders no marker before or after.
- R9 rendered counts may change if a SPECTRA row has no plan that can buy a providing add-on
  (intake Q1). Design.md D4 describes the measurement and the one-line amendment.
- Risks: design.md, "Risks".

## Out of scope

- UX-8: hiding add-ons the selected plan cannot use (`report.md:502-514`).
- A new i18n text such as "not available on this plan". Unavailable cells use the existing em dash
  and `pricing.notIncluded`.
- `dependsOn` and `excludes` chains (an add-on available for a plan but needing another add-on that
  is not). They stay as today.
- A shared availability helper for `src/core/resolve.ts`, `src/element/renderers.ts` and
  `src/core/view-model.ts`. That is a followup refactor.
- Changing which rows are add-on only, plan highlight lists, add-on cards and effects, CSS and the
  i18n catalogs.
