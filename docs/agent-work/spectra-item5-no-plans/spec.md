# Pricing with no plans (SPECTRA review, item 5)

Source: `docs/agent-work/visual-review-spectra/report.md`, section 4.5 ("Okta with 0 plans").
Approved by the owner through CRP `crp-spectra-phase2-improvements` (all recommended).

## Problem

With `viewModel.plans.length === 0` (for example `tests/fixtures/spectra/okta/2024.yml`) the
renderer showed 141 comparison rows with no value columns, because `renderTableComparison`
maps over an empty plan list. The page also showed "No plans are available." and 18 add-ons,
and "only differences" hid every row.

## Requirements

- R1. When the view model has no plans, the comparison section MUST NOT render a table, compact
  cards, comparison rows or the comparison toolbar.
- R2. In that case the comparison section MUST show a clear status text, `pricing.noComparison`
  ("There are no plans to compare." / "No hay planes que comparar."), in the existing
  `pr-empty` style.
- R3. The add-ons section MUST keep rendering exactly as before.
- R4. A pricing with at least one plan MUST render the comparison exactly as before.
- R5. The change MUST NOT add a public attribute or property. The new key is added to both
  the `en` and `es` catalogs.

## Acceptance criteria

1. Okta 2024, table and compact layouts: output has no `<table`, `comparison-row` or
   `pr-feature-card`, and contains the status text.
2. Okta 2024 with the `es` catalog: output contains the Spanish status text.
3. Okta 2024 add-ons: one add-on card per add-on in the view model.
4. Acme pricing (with plans): table and compact comparison unchanged, no status text.

Tests: `tests/unit/no-plans.test.ts`.

## Out of scope

Styles and `src/element/pricing-renderer-element.ts` (another PR is in flight).
