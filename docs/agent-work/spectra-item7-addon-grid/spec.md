# Add-on grid: dense cards, equal height, filter and cap (SPECTRA item 7)

Source: `docs/agent-work/visual-review-spectra/report.md` section 4.7. Approved by the owner
(CRP `crp-spectra-phase2-improvements`, all recommended), including the new public attribute
`add-on-filter-threshold` and the look change for pricings with more than 8 add-ons.

## Problem

The add-on cards sit in a grid of 1 column, 2 columns from 600px and 3 columns from 1200px
(container width). Their content varies a lot: description, availability, dependency, excludes,
quantity constraints and a `<details class="pr-addon-effects">` of effects, all in the
always-visible area except the effects. Cards of one row therefore show their controls at different
heights and long cards dominate the row. Pricings with 11 to 18 add-ons (Okta 18, Zoom 16,
Salesforce 14, GitHub 14, Postman 12, UserGuiding 11) render an unfiltered wall of cards with no way
to search them and no cap, so the estimated total in the right column (sticky from 840px) or in the
mobile bottom bar sits next to a list the user has to scroll through to compare.

## Requirements

### `req~addon-grid-no-look-change~1`

WHILE the pricing has 8 add-ons or fewer and the options are the defaults, the renderer SHALL render
the add-on section with the same elements, attributes, classes and text as before this change
(the serialized DOM is equivalent; Lit comment markers and whitespace-only text nodes may differ).

- The demo pricing `tests/fixtures/acme-pricing.yml` (3 add-ons), used by every Playwright visual
  baseline, renders equivalent add-on markup (same elements, attributes and text): the grid's class is exactly `pr-addon-grid`, the
  cards have no `pr-addon-card--dense`, the effects summary reads `pricing.effects`, and there is no
  `pr-addon-main` wrapper, no add-on toolbar and no show-more button.
- All new CSS lives in new rules under the new classes only (`pr-addon-grid--dense`,
  `pr-addon-card--dense`, `pr-addon-main`, `pr-addon-toolbar`); no existing rule of
  `src/styles/base.css` is edited, so no screenshot baseline moves.

Scenario: Given `tests/fixtures/acme-pricing.yml` and default options, When the add-on section
renders, Then its markup is equivalent to the output before the change, has no
`pr-addon-grid--dense` and no `data-pr-part="addon-toolbar"`.

### `req~addon-grid-dense-details~1`

WHILE `viewModel.addOns.length` is greater than `ADDON_DENSE_THRESHOLD` (8, exported from
`src/element/renderers.ts`), the renderer SHALL render the add-on grid in dense mode, moving the
secondary paragraphs of each card into its disclosure.

- The grid gets the extra class `pr-addon-grid--dense` and each card the extra class
  `pr-addon-card--dense`.
- The paragraphs of `pricing.availableFor`, `pricing.dependsOn`, `pricing.excludes` and
  `pricing.quantityConstraints` leave the always-visible area and are rendered inside the existing
  `<details class="pr-addon-effects">`, together with the effects.
- In dense mode the summary of that disclosure reads the new i18n key `pricing.moreDetails`: `en`
  `More details`, `es` `Más detalles`.
- The disclosure is rendered when it has any content (at least one of those paragraphs or at least
  one effect), and not otherwise.
- The `pricing.notAvailable` status stays visible, outside the disclosure.
- The element with id `pr-addon-help-<id>` (the `aria-describedby` target of the card's checkbox)
  is always rendered, even when the moved paragraphs leave it empty.

Scenario: Given a pricing with 9 add-ons where add-on `sso` has `availableFor` set and no effects,
When it renders, Then the grid has `pr-addon-grid--dense`, the `sso` card has
`pr-addon-card--dense`, its `availableFor` paragraph is inside `details.pr-addon-effects` whose
summary is `More details`, and `pr-addon-help-sso` is present; Given the same pricing with locale
`es`, Then the summary is `Más detalles`; Given an add-on unavailable for the selected plan, Then
`pricing.notAvailable` is rendered outside the disclosure; Given an add-on with no availability,
dependency, excludes, constraints or effects, Then its card renders no `details.pr-addon-effects`.

### `req~addon-grid-equal-height~1`

WHILE the add-on grid is in dense mode, the renderer SHALL render every card of one grid row with
the same height (difference at most 1px with every disclosure closed), with the disclosure and the
quantity stepper at the bottom of the card.

- In dense mode `.pr-addon-card__details` grows (`flex: 1 1 auto`) inside the card, which is
  already a flex column, so the disclosure and the stepper after it sit at the bottom.
- Measured in a browser test (CI only) on okta, zoom, salesforce, github, postman and userguiding at
  1440, 1024 and 375 wide. At 375 the grid has one column, so every row has one card and the check
  is trivial there; it is kept to guard the single-column layout.

Scenario: Given the Zoom fixture at 1440 wide with every disclosure closed, When the add-on grid
renders, Then for every group of cards with the same top offset the tallest and the shortest card
differ by at most 1px.

### `req~addon-grid-filter~1`

WHILE `viewModel.addOns.length` is greater than the add-on filter threshold (default
`DEFAULT_ADDON_FILTER_THRESHOLD` = 13, so 14 add-ons or more), the renderer SHALL render an add-on
toolbar with a search input and a counter above the add-on grid.

- Filter mode applies to Okta (18), Zoom (16), Salesforce (14) and GitHub (14); Postman (12),
  UserGuiding (11) and Box (9) are dense only.
- Only in filter mode, the toolbar and the grid are wrapped in `<div class="pr-addon-main">`, which
  takes the left column of `.pr-addon-layout`; the summary stays in the right column.
- The toolbar is `<div class="pr-comparison-toolbar pr-addon-toolbar" data-pr-part="addon-toolbar">`.
- The search input reuses the `.pr-search` markup of the comparison toolbar; its label and
  placeholder read the new key `pricing.searchAddOns`: `en` `Search add-ons`, `es`
  `Buscar complementos`.
- The counter (`aria-live="polite"`) reads `pricing.rowsShownOf` with `shown` = the number of add-on
  cards rendered and `total` = the number of all add-ons of the pricing.
- The search matches the add-on name and description, case-insensitive, after trimming the search
  text.
- The add-on toolbar is not sticky: a new rule scoped to `.pr-addon-toolbar` overrides the sticky
  position of `.pr-comparison-toolbar`.

Scenario: Given the Okta fixture (18 add-ons) and default options, When it renders, Then
`data-pr-part="addon-toolbar"` is inside `.pr-addon-main`, the input placeholder is
`Search add-ons` and the counter reads `8 of 18 items`; Given the Postman fixture (12 add-ons),
When it renders, Then there is no `data-pr-part="addon-toolbar"` and no `.pr-addon-main`.

### `req~addon-grid-cap~1`

WHILE the add-on grid is in filter mode, the search is empty and the add-ons are not revealed, the
renderer SHALL render only the first `ADDON_VISIBLE_CAP` (8, exported from
`src/element/renderers.ts`) add-ons plus every selected add-on, in the original order, followed by a
show-more button.

- The button is a quiet button (`pr-button pr-button--quiet`) reading `pricing.showRemaining` with
  `count` = the number of add-ons not rendered; it is rendered only when that count is greater
  than 0.
- The button calls the new optional action `revealAddOns`; after it, all add-ons are rendered.
- A non-empty search renders every matching add-on plus every selected add-on (a selected add-on is
  never hidden), in the original order, and no show-more button.
- When no card is rendered, the renderer renders
  `<p class="pr-empty" role="status" data-pr-part="addon-empty">` with `pricing.noMatches`, and the
  toolbar stays visible.
- The search text and the revealed flag live in the element and are reset on a new load. They reach
  the renderer through optional `RenderState` fields (`addOnSearch?: string`,
  `addOnsRevealed?: boolean`, `addOnFilterThreshold?: number`) and optional `RenderActions`
  (`updateAddOnSearch?`, `revealAddOns?`), so existing callers that build `RenderState` and
  `RenderActions` without them keep compiling; absent fields mean an empty search, not revealed and
  threshold 13.
- Out of filter mode the add-on search has no effect: every add-on is rendered.

Scenario: Given a pricing with 18 add-ons where the 12th add-on is selected and the search is
empty, When it renders, Then 9 cards are rendered (the first 8 and the 12th, in that order) and the
button reads `Show 9 more`; When the user clicks it, Then 18 cards are rendered and no show-more
button; Given the search `SSO` typed with a leading and a trailing space, matching 2 add-ons
(`sso` in the name of one, in the description of the other) and none of them selected, Then 3 cards are rendered (the 2 matches and the selected one) and no show-more button;
Given the search `zzzz-no-match` and no selected add-on, Then `data-pr-part="addon-empty"` reads
`No matching items` (`es`: `Sin resultados`) and the counter reads `0 of 18 items`.

### `req~addon-grid-threshold-attribute~1`

The renderer element SHALL expose a public property `addOnFilterThreshold: number` (attribute
`add-on-filter-threshold`, Lit type `Number`, default `DEFAULT_ADDON_FILTER_THRESHOLD` = 13), in the
same style as `toolbarThreshold`, whose value is the add-on filter threshold.

- The exported helper `addOnFilterThresholdOf(value: unknown): number` in
  `src/element/renderers.ts` returns the value when it is a finite number greater than or equal to
  0, and 13 otherwise (for example `NaN` from `add-on-filter-threshold="abc"`, `Infinity` or `-1`).
- `0` turns filter mode on from the first add-on (any pricing with add-ons); the show-more button
  still appears only when add-ons are hidden.

Scenario: Given a pricing with 5 add-ons and `add-on-filter-threshold="0"`, When it renders, Then
`data-pr-part="addon-toolbar"` is present, 5 cards are rendered and no show-more button; Given
the Okta fixture with `add-on-filter-threshold="-5"`, Then the threshold is 13 and the toolbar is
present; Given the Okta fixture with `add-on-filter-threshold="20"`, Then there is no toolbar and
18 cards are rendered.

### `req~addon-grid-total-visible~1`

The renderer SHALL keep the estimated total (`renderSummary`) unchanged: in the right column of
`.pr-addon-layout`, sticky from 840px container width, and in the mobile bottom bar below that.

- This change adds no markup for the total. The requirement is satisfied by the existing summary
  behaviour plus the cap of `req~addon-grid-cap~1`: in filter mode the initial list is at most 8
  cards plus the selected ones, so the user reaches the total sooner.
- In filter mode the summary stays the sibling of `.pr-addon-main` inside `.pr-addon-layout`.

Scenario: Given the Okta fixture and default options, When it renders, Then the summary markup is
the same as before the change and is a direct child of `.pr-addon-layout`.

## Measurable criteria

- (a) Unit: a per-fixture table over all 37 fixtures in `tests/fixtures/spectra` (default options,
  nothing selected) of {dense, filter, initially rendered cards <= 8 + selected}; expected values in
  the table below.
- (b) Unit: the acme add-on markup is unchanged, has no `pr-addon-grid--dense`, no
  `pr-addon-card--dense`, no `pr-addon-main` and no `data-pr-part="addon-toolbar"`.
- (c) Unit: search by name and by description (case-insensitive, trimmed), a selected add-on is
  never hidden (empty search and non-matching search), reveal renders every add-on and removes the
  button, the empty state and the counter, in `en` and `es`.
- (d) Unit: `addOnFilterThresholdOf` for `13`, `0`, `NaN`, `Infinity`, `-1` and a non-number; the
  attribute `add-on-filter-threshold` maps to the property with fallback 13.
- (e) Browser (CI only, the workers have no browser): `tests/browser/spectra-addon-grid.spec.ts`
  measures, for okta, zoom, salesforce, github, postman and userguiding at 1440, 1024 and 375 wide
  with every disclosure closed:
  - the height difference of the cards in each grid row is at most 1px;
  - for the filter pricings (okta, zoom, salesforce, github) the initially rendered cards are at
    most 8;
  - typing a search term into the add-on toolbar renders fewer cards than before it;
  - the values are logged as `SPECTRA_ADDON_GRID {...}` lines.

Expected values for (a):

| Fixture           | Add-ons | Dense | Filter | Initial cards   |
| ----------------- | ------- | ----- | ------ | --------------- |
| Okta              | 18      | yes   | yes    | 8, show 10 more |
| Zoom              | 16      | yes   | yes    | 8, show 8 more  |
| Salesforce        | 14      | yes   | yes    | 8, show 6 more  |
| GitHub            | 14      | yes   | yes    | 8, show 6 more  |
| Postman           | 12      | yes   | no     | 12, no button   |
| UserGuiding       | 11      | yes   | no     | 11, no button   |
| Box               | 9       | yes   | no     | 9, no button    |
| Other 30 fixtures | 0 to 8  | no    | no     | all, no button  |

Box (9 add-ons) is dense by the same rule (more than 8). Fixtures with 0 add-ons render no add-on
section.

## Out of scope

- Grouping add-ons by tags (item 9).
- Any screenshot baseline movement: no baseline is updated by this change.
- The browser criteria are verified only in CI; the worker environment cannot run them.
- The report's acceptance "first viewport of the add-on section shows at most 8 cards" is covered
  by the count of rendered cards, not by a viewport measurement.
