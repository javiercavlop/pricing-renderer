# UX stress pricings

Synthetic Pricing2Yaml documents that reproduce the extremes the SPECTRA review found in real
pricings. They are built by `build.ts`; no YAML is checked in. The builder has no random input
(a fixed seed per shape), so the same document is built in vitest and in Playwright.

Shapes (plans, features, usage limits, add-ons):

- okta: 0 plans, 140 features, 1 usage limit, 18 add-ons (no plans, a long comparison).
- zoom: 4 plans, 143 features, 6 usage limits, 16 add-ons (the longest comparison).
- clickup: 5 plans, 136 features, 38 usage limits, 4 add-ons (many usage limits).
- webflow: 15 plans, 90 features, 12 usage limits, 8 add-ons (a wide plan grid).
- salesforce: 6 plans, 120 features, 8 usage limits, 14 add-ons (many add-ons).
- github: 4 plans, 80 features, 10 usage limits, 14 add-ons (many add-ons, a long plan name).

Each shape exists in EUR and USD, with a monthly and an annual default billing period (24
fixtures). The annual document lists the discounted monthly price and bills `annual` at 1; the
monthly document bills `monthly` at 1. Texts are long on purpose (feature, plan and add-on
descriptions of 100 to 250 characters).

- `build.ts` exports `stressFixtures`, `findStressFixture(id)`, `buildStressPricing(fixture)` and
  `buildStressYaml(fixture)`. Fixture ids read `<shape>-<currency>-<period>`, for example
  `zoom-eur-annual`.
- `metrics.ts` exports `loneLastCard(gridColumns, cardsPerRow)`, a pure function that is true only
  when the grid has more than one column, more than one row and a last row of one card.
  `tests/unit/ux-stress-metrics.test.ts` covers it.
- `tests/unit/ux-stress-fixtures.test.ts` parses every fixture with the renderer's parser and checks
  the counts.
- `tests/browser/ux-stress.spec.ts` prints a `SPECTRA_UX_SUMMARY` line per fixture and viewport.
  Besides the page and renderer heights, sticky state and horizontal scroll, the line carries:
  - `sectionHeightsInViewports`: the height of the first element of each `data-pr-part`, divided by
    the viewport height and rounded, to show which section makes the page long.
  - `planGrid.cardWidths`: the smallest and largest plan card width in px (null without cards).
  - `planGrid.firstCtaBottom`: the bottom of the first call to action, in px from the renderer top.
  - `planGrid.layoutBreakdown`: the offsets and heights of the blocks above the plan grid and of the
    first card's children.
  - `planGrid.loneLastCard`: the result of `loneLastCard` for the measured grid.
  - `layoutVariant`: `auto` for the default layout. At 375 light/en a second line follows with
    `layoutVariant: "table"` (the `layout="table"` attribute set on the element, then removed), so the
    scrolling table can be compared with the cards.
  - `text`: `awkwardBreaks` and `truncatedTexts` from `measureText`.
  - `expanded`: `rendererHeightInViewports` after `revealAllRows`, and `finished` (false when 100
    rounds were not enough). It runs last in a pass because it changes the page; every pass applies the
    pricing again.
  - `addOns`: null without add-ons; else `cardsRendered`, `cardsDisabled` (`data-available="false"`),
    `rowSpreads` (cards and height spread per grid row) and `summaryInViewport` (does
    `[data-pr-part="summary"]` intersect the viewport with the first, middle and last add-on card
    scrolled to the centre; null when there is no summary).
  - `visiblePlanColumns`: plan header cells fully inside `.pr-table-scroll` at `scrollLeft` 0; null
    when the layout is cards or none.
  - `contrast`: the axe `color-contrast` violation count and the first three node targets. It never
    fails the test.
  - A `SPECTRA_UX_TOTAL` line per fixture with the total time in ms.
- Variants: 1440x900 and 375x812, each in light/en and dark/es, plus 1024x768 light/en (five passes
  and the table pass per fixture).
- Fixtures: the default run uses okta, clickup and webflow. `UX_STRESS_ALL=1` runs all six shapes
  (okta, clickup, webflow, zoom, salesforce, github). The pure helpers `countCellsFullyInside`,
  `addOnRowSpreads` and `intersectsViewport` in `metrics.ts` are covered by the unit test.
