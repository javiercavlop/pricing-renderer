# Add-on only marker in the comparison (SPECTRA review, item 6)

Source: `docs/agent-work/visual-review-spectra/report.md`, section 4.6.
Metrics: `docs/agent-work/visual-review-spectra/metrics.json` (`addOnOnlyRows`).

## Problem

Many comparison rows have no value in any plan but are provided by at least one add-on. Today every
plan cell of such a row renders an em dash with "Not included". The reader concludes that the
capability does not exist, although it can be bought as an add-on. Across the SPECTRA fixtures
this affects 166 rows (Okta excluded, see R9).

## Definitions

- Empty cell: a plan cell whose value is `false`, `null` or `undefined` (the cells rendered as an
  em dash).
- Add-on provides a row: for a `feature` row, the add-on `features[row.id]` is non-empty after
  `unwrapValue`; for a `usage-limit` row, `usageLimits[row.id]` or `usageLimitsExtensions[row.id]`
  is non-empty after `unwrapValue`. Non-empty means not an empty cell.
- Only add-ons of `viewModel.addOns` count (private add-ons are absent there unless the
  visibility is `all`).

## Requirements

- R1. A row is add-on only when every plan cell of the row is empty and at least one add-on of
  `viewModel.addOns` provides it. The function `isAddOnOnlyRow(viewModel, row): boolean` MUST
  implement this definition and MUST be exported from `src/core/view-model.ts`. Amended by
  P-20261101-1 (owner answer to CRP-U7): the per-cell test
  `addOnProvidesForPlan(viewModel, row, planId): boolean` MUST also be exported from
  `src/core/view-model.ts` only; it is true when some add-on of `viewModel.addOns` provides the row
  and its `availableFor` is empty or contains `planId`. `isAddOnOnlyRow` itself does not change.
- R2. A row that at least one plan includes (any plan cell not empty), a row that no plan and no
  add-on provides, and a row provided only by an add-on whose value is empty (`false`, `null`)
  MUST NOT be add-on only. A row provided only by a private add-on MUST NOT be add-on only when
  the view model hides private add-ons, and MUST be add-on only when the visibility is `all`.
- R3. Amended by P-20261101-1 (owner answer to CRP-U7; OpenSpec change
  `addon-marker-available-for`, `req~addon-marker-per-plan-availability~1`). In
  `renderComparison`, in the table layout and in the compact layout, the marker is decided per cell.
  A plan cell of an add-on-only row MUST render the marker only when at least one add-on of
  `viewModel.addOns` that provides the row is available for that cell's plan (`availableFor` empty
  or containing the plan id). The marker is
  `<span class="pr-value pr-value--addon">` containing a `<span aria-hidden="true">` with the text
  `t('pricing.addOnOnly')` and a `<span class="pr-sr-only">` with the text
  `t('pricing.addOnOnlySr')`; a marked cell MUST NOT render the em dash, `pr-value--excluded` or
  the text "Not included". Every other plan cell of that row MUST render the em dash with
  `pr-value--excluded` and "Not included".
- R4. The marker MUST NOT rely on colour alone: it carries visible text and a text alternative for
  screen readers (R3).
- R5. The i18n catalogs MUST contain `pricing.addOnOnly` = "Add-on" (en) / "Complemento" (es) and
  `pricing.addOnOnlySr` = "Available as add-on" (en) / "Disponible como complemento" (es).
- R6. Every other empty cell MUST keep the em dash (`pr-value--excluded`, "Not included"). This
  includes the empty cells of rows where only some plans are empty, and the cells of rows that
  nothing provides.
- R7. Item 6 is not a public API change. `isAddOnOnlyRow` MUST NOT be re-exported from
  `src/core/index.ts`. Amended by P-20261101-1 (owner answer to CRP-U7,
  `req~addon-marker-helper-internal~1`): `addOnProvidesForPlan` MUST NOT be re-exported from
  `src/core/index.ts` either, and the per-cell marker adds no feature flag. `PricingComparisonRow` and `src/core/types.ts` MUST NOT change. The change
  MUST NOT add an attribute, event, CSS part or data attribute. Plan highlight lists and add-on
  effects MUST remain unchanged.
- R8. `src/styles/base.css` MUST define `.pr-value--addon` with `color: var(--pr-color-link)`, the
  background `color-mix(in srgb, var(--pr-color-accent) 11%, var(--pr-color-surface-raised))`
  and `white-space: nowrap`. The text contrast ratio (WCAG relative luminance) of
  `--pr-color-link` over that background MUST be at least 4.5:1 in the light theme, the dark
  theme and the automatic dark theme, computed from the values in `src/styles/theme.css`.
- R9. SPECTRA counts. The sum of the add-on-only rows over the fixtures in `tests/fixtures/spectra`,
  without Okta, MUST equal 166, the add-on-only count of `metrics.json`. Amended by P-20261101-1
  (owner answer to CRP-U7): a marked row is a row rendered with at least one marker, not one
  marker per plan; the detected count of 166 does not change. For every fixture except Okta the
  number of marked rows MUST equal `addOnOnlyRows` of `metrics.json`, unless the measurement of
  P-20261101-1 (intake Q1) shows a row with no plan that can buy a providing add-on; then this line
  states the measured counts instead.
  Marked rows per fixture: GitHub 32, Salesforce 44, Mailchimp 16, Postman 14, Zoom 13, Tableau 10.
  Okta has no plans: its rows are counted vacuously in `metrics.json` (307 with Okta), it renders
  no comparison rows, so it is skipped in the sum and MUST render no marker.

## Acceptance criteria

1. A feature row and a usage-limit row provided only by an add-on, and a row provided only by a
   `usageLimitsExtensions` entry, are add-on only; a row provided by a plan and an add-on, a row
   with one plan true and another false, a row nobody provides, a row whose only add-on value is
   `false`, and a row of a hidden private add-on are not (R1, R2).
2. In both layouts an add-on-only row of a two-plan pricing whose providing add-on is available for
   both plans contains exactly two markers with the texts "Add-on" and "Available as add-on", and
   no `pr-value--excluded`. Amended by P-20261101-1 (owner answer to CRP-U7): when the providing
   add-on is available for one plan only, the row contains one marker in that plan's cell and the
   em dash with "Not included" in the other (R3, R4).
3. With the `es` catalog the markers read "Complemento" and "Disponible como complemento" (R5).
4. The rows that are not add-on only keep their em dashes: one for a row with one empty plan, two
   for a row nothing provides (R6).
5. `src/core/index.ts` exports no `isAddOnOnlyRow`; `src/core/view-model.ts` does (R7).
6. The contrast of `.pr-value--addon` is at least 4.5:1 in the three themes (R8).
7. The SPECTRA counts of R9 hold in both layouts. Amended by P-20261101-1 (owner answer to
   CRP-U7): a marked row has at least one marker, and the markers of a row sit only in the cells of
   plans for which a providing add-on is available.

Tests: `tests/unit/addon-marker.test.ts`.

## Visual baselines

The demo pricing (`tests/fixtures/acme-pricing.yml`) has no add-on-only row, so no screenshot
baseline changes.

## Out of scope

Plan highlight lists, add-on cards and effects, and any new public attribute, event, CSS part or
data attribute.
