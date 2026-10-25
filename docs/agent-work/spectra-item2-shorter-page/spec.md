# Shorter page: only differences by default, configurable toolbar (SPECTRA item 2)

Source: `docs/agent-work/visual-review-spectra/report.md` section 4.2. Approved by the owner
(CRP `crp-spectra-phase2-improvements`, all recommended), including the new public attributes
`only-differences` and `toolbar-threshold` and the default look change for pricings with more than
100 comparison rows.

## Problem

Search, "Only differences", expand/collapse all and the 30-row cap per group already exist, but
"Only differences" is always off at load (`_onlyDifferences` is `false`), so ClickUp starts with all
174 rows. The toolbar threshold (more than 40 rows in total) is fixed and cannot be configured. The
counter (`pricing.rowsShown`) shows the number of filtered rows, not the rows actually on the page,
and when the filters match nothing the comparison is just empty with no message.

## Requirements

### `req~shorter-page-only-differences~1`

The renderer element SHALL expose a tri-state property `onlyDifferences?: boolean`, reflected from
the attribute `only-differences`, whose value is the initial state of the comparison's "Only
differences" checkbox.

- Attribute absent: `undefined` (automatic default, see `req~shorter-page-auto-default~1`).
- Attribute present with an empty value, or with any value other than `false`: `true`.
- Attribute value `false`: `false`.
- The conversion is the exported helper
  `onlyDifferencesConverter.fromAttribute(value: string | null): boolean | undefined` in
  `src/element/pricing-renderer-element.ts`.
- A click on the checkbox overrides the initial state until the pricing is reloaded (a new load) or
  the property or attribute changes; then the override is dropped and the new value applies.

Scenario: Given a renderer with `only-differences="false"` and a pricing of 174 rows with 4 plans,
When it loads, Then the checkbox is unchecked and all rows are filtered by search only; When the
user checks the checkbox, Then only rows whose values differ are rendered; When the attribute is
then set to `""`, Then the checkbox is checked and the user's override is dropped.

### `req~shorter-page-auto-default~1`

WHILE `onlyDifferences` is `undefined`, the renderer SHALL turn "Only differences" on at load if and
only if all of these hold, and SHALL leave it off otherwise:

- the total number of comparison rows of the pricing (sum of the rows of every
  `viewModel.comparisonGroups` entry, before any filter) is strictly greater than
  `AUTO_DIFFERENCES_MIN_ROWS` (100);
- `viewModel.plans.length >= 2`;
- the comparison toolbar is visible (total rows greater than the toolbar threshold), so the user can
  always switch the filter off.

Exported from `src/element/renderers.ts`: `AUTO_DIFFERENCES_MIN_ROWS = 100`,
`comparisonRowTotal(viewModel): number` and
`resolveOnlyDifferences(viewModel, initial: boolean | undefined, toolbarThreshold?: number): boolean`.
An explicit `initial` (`true` or `false`) wins; `toolbarThreshold` defaults to 40.

- Okta 2024 (0 plans): off.
- The SPECTRA pricings strictly over 100 rows with at least 2 plans: on.
- Deskera (exactly 100 rows): off.

Scenario: Given the ClickUp fixture (174 rows, at least 2 plans) and no `only-differences`
attribute, When the renderer loads, Then the checkbox is checked and no rendered row has the same
value for every plan; Given the Deskera fixture (100 rows), When it loads, Then the checkbox is
unchecked.

### `req~shorter-page-toolbar-threshold~1`

The renderer element SHALL expose a property `toolbarThreshold: number` (attribute
`toolbar-threshold`, Lit type `Number`, default `DEFAULT_TOOLBAR_THRESHOLD` = 40 exported from
`src/element/renderers.ts`) and SHALL render the comparison toolbar (search, only differences,
expand/collapse all, counter) if and only if the total number of comparison rows is greater than the
threshold.

- A value that is not a finite number (for example `NaN` from `toolbar-threshold="abc"`) or is
  negative falls back to 40.
- Default behaviour is unchanged: 40 rows render no toolbar, 41 rows render the toolbar.
- `RenderState` gets an optional field `toolbarThreshold?: number`; absent means 40, so existing
  callers that build `RenderState` without it keep working.
- The sticky toolbar of item 1 is unchanged.

Scenario: Given a pricing with 20 rows and `toolbar-threshold="10"`, When it renders, Then
`data-pr-part="comparison-toolbar"` is present; Given the same pricing with
`toolbar-threshold="-5"`, When it renders, Then the toolbar is absent (threshold 40).

### `req~shorter-page-counter~1`

WHILE the comparison toolbar is rendered, its counter (`aria-live="polite"`) SHALL read the i18n key
`pricing.rowsShownOf` with `shown` and `total`.

- `en`: `{shown} of {total} items`; `es`: `{shown} de {total} elementos`.
- `shown`: the number of comparison rows actually rendered, that is the rows of expanded groups
  after the 30-row cap per group (a non-empty search expands every group, as today); rows of
  collapsed groups are not counted. It equals the number of `data-pr-part="comparison-row"` elements
  (table layout) or `pr-feature-card` articles (compact layout) in the output.
- `total`: the number of all comparison rows of the pricing, before search and only differences.
- The key `pricing.rowsShown` stays in both catalogs (custom catalogs may use it) but is no longer
  rendered.

Scenario: Given the ClickUp fixture with "Only differences" off and an empty search, When it
renders in the table layout, Then the counter text is `<n> of 174 items` where `<n>` is the number
of `data-pr-part="comparison-row"` elements in the output.

### `req~shorter-page-empty-state~1`

IF the pricing has plans and comparison groups AND the search and/or only differences leave 0 rows,
THEN the comparison SHALL render, below the toolbar,
`<p class="pr-empty" role="status" data-pr-part="comparison-empty">` with the key
`pricing.noMatches` and no table and no compact cards.

- `en`: `No matching items`; `es`: `Sin resultados`.
- The toolbar stays visible so the user can clear the search; the counter reads `0 of <total>`.
- The no-plans path (`pricing.noComparison`, item 5) and pricings with no comparison groups are
  unchanged.

Scenario: Given the ClickUp fixture and the search `zzzz-no-match`, When it renders in the table
and the compact layouts, Then the output contains `data-pr-part="comparison-empty"` with
`No matching items`, the toolbar, the counter `0 of 174 items`, and no `<table`, no
`comparison-row` and no `pr-feature-card`.

### `req~shorter-page-no-look-change~1`

WHILE the pricing has 40 comparison rows or fewer and the options are the defaults, the renderer
SHALL render the comparison exactly as before this change: no toolbar, only differences off,
identical markup.

- The demo pricing `tests/fixtures/acme-pricing.yml`, used by every Playwright visual baseline,
  renders byte-identical comparison markup.
- `src/styles/base.css` is not changed and no new CSS is introduced (the empty state reuses
  `pr-empty`), so no screenshot baseline moves.

Scenario: Given `tests/fixtures/acme-pricing.yml` and default options, When the comparison renders
in the table and the compact layouts, Then the output has no `data-pr-part="comparison-toolbar"`
and is identical to the output before the change.

## Measurable criteria

- (a) Unit: a `resolveOnlyDifferences` table over all 37 fixtures in `tests/fixtures/spectra`
  (default options), checked against total rows, plan count and threshold; Okta and Deskera off.
- (b) Unit: the counter `shown` equals the rendered row elements for every fixture x
  {only differences on, off} x {search empty, `a`} x {table, compact}, and `total` equals
  `comparisonRowTotal`.
- (c) Unit: the empty state (search with no match; only differences that leaves 0 rows), table and
  compact, `en` and `es`.
- (d) Unit: the acme comparison markup has no toolbar and is unchanged.
- (e) Unit: `onlyDifferencesConverter.fromAttribute` for `null`, `""`, `"true"`, `"false"`, `"x"`;
  threshold fallback for `NaN`, `Infinity` and `-1`; 40 rows no toolbar, 41 rows toolbar.
- (f) Browser (CI only, the workers have no browser): `tests/browser/spectra-shorter-page.spec.ts`
  at 1440x900 measures the renderer height in viewports (renderer height / viewport height) with
  default options for clickup, zoom, salesforce and webflow, and for the same pricing forced to
  `onlyDifferences = false`:
  - default height <= forced-off height + 1px;
  - default height not above the phase 1 collapsed baseline plus 0.15 screens (clickup 4.54, zoom
    6.25, salesforce 6.05, webflow 8.82);
  - clickup <= 5 screens;
  - the values for all four are logged as `SPECTRA_SHORTER {...}` lines.

## Out of scope and known limit

The report's "at most 3 screens" target is NOT met and is not claimed. Only differences cannot
shorten Webflow (its 15 plans differ almost everywhere), and each group is already capped at 30 rows
with only the first group expanded at load, so the saving at load is bounded by the rows removed
from the first group. The threshold measured is 5 screens at 1440, hard for clickup only; zoom,
salesforce and webflow are reported, not gated. The expanded state (all groups expanded, no cap) is
not measured here. The sticky toolbar from item 1 is unchanged. The browser checks cannot run in
the worker environment; CI verifies them.
