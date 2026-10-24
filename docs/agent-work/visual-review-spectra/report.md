# Visual review of pricing-renderer with real SPECTRA pricings: phase 1 report

Scope: 37 real pricings in `tests/fixtures/spectra/`. Sizes come from `metrics.md` and
`metrics.json` (same folder, reproduced by `tests/unit/spectra-layout-metrics.test.ts`). Browser
measurements come from `tests/browser/spectra-review.spec.ts` and only exist in CI; section 6 holds
the numbers of the CI `browsers` job of this pull request (partial coverage, see 6.1). Code
references are to the current head.

## 1. Summary

- Real pricings are far bigger than the demo pricing: median 65 comparison rows, 9 pricings with 100
  or more, maximum 174. Descriptions are missing on 1839 of 2743 rows (67%).
- Differences-only, search and a 30-row "show more" cap already exist but are off, hidden below 41
  rows, or poorly counted. Nothing keeps the plan header in view while scrolling a 150-row table.
- The estimated total sits after the whole comparison, or at the end of the page without add-ons.
- Texts are raw: `3 unit`, raw ids in "Requires ..." and in the confirm dialog, em dashes for rows
  only an add-on gives.
- Okta (0 plans, 141 rows, 18 add-ons) shows a table with no values.
- CI numbers (section 6, 29 of 37 pricings at least): at 1440 the renderer is 2.4 to 8.8 screens
  tall (median 4.85), at 375 3.95 to 44.6 (webflow). Only zenhub and quip are under 3 screens at
  1440, and none is at 375. The header is never effectively sticky. The CTA is below the first
  screen for many pricings at 1440 and for almost all at 1024. Plan cards are always 320 px wide,
  so grids end in orphans (3+1, 2+1, Webflow 2x7+1). "Unlimited" is split across lines in 5 cases.
  Truncation, page overflow and contrast: 0 problems.
- Page height does not track row count: ClickUp (174 rows) is 4.54 screens, because each group is
  capped at 30 rows and only the first group is expanded. The height seen is the collapsed state.
- Highest impact: (1) make the plan header really sticky (confirmed) and move the total near the
  plans; (2) shorten the collapsed page and keep hidden rows useful (differences-only, search,
  show more, measured expanded in phase 2); (3) fix the plan grid (fixed 320 px tracks, orphans,
  CTA below the first screen); (4) fix the "Unlimited" split; (5) fix raw texts (plural units,
  names for dependencies, "Add-on" marker, Okta without plans).
- Eleven proposals in section 4; six need an owner decision (CRP) because they change the default
  look or the public API.

## 2. Evidence

### 2.1 Sizes

| Measure                                                  | Value                                                                       |
| -------------------------------------------------------- | --------------------------------------------------------------------------- |
| Pricings                                                 | 37                                                                          |
| Rows per pricing (min / Q1 / median / Q3 / max)          | 15 / 49 / 65 / 98 / 174                                                     |
| Total rows                                               | 2743 (sum of the per-pricing table in `metrics.md`)                         |
| Pricings strictly over 100 rows                          | 8 (9 with 100 or more, adding Deskera)                                      |
| Pricings with 1 or 2 comparison groups                   | 34 of 37 (4 with 1, 30 with 2); the others are Shopify 6, Zenhub 7, Zoom 10 |
| Orphan card (last grid row has one card), 3 / 4 columns  | 17 / 5 pricings, 22 on either                                               |
| Longest row name / description / string cell / plan name | 65 (Okta) / 398 (Zoom `waitingRoom`) / 76 (Wrike) / 29 (Webflow) characters |
| Longest add-on name                                      | 53 characters (OpenPhone `carrierReviewAndSetupFeesForUsCanadaMessaging`)   |

### 2.2 The owner's numbers

Reproduced exactly by `metrics.md`: ClickUp 174, Zoom 151, Okta 141, Salesforce 124, Webflow 118
(15 plans), Postman 112, Canva 106, Dropbox 103, Deskera 100. They are the nine largest pricings.

Corrections:

- The median is 65, not about 60 (the 19th value, Notion).
- 34 of 37 pricings have 1 or 2 comparison groups. ClickUp has General (136 rows) and Usage limits
  (38 rows). Collapsing groups therefore does not shorten the page: the single big group is the
  problem.

### 2.3 Derived from the per-pricing table of `metrics.md`

Sums of its columns; check them against `metrics.json` before quoting them elsewhere.

| Measure                                          | Value                                          |
| ------------------------------------------------ | ---------------------------------------------- |
| Rows identical in all plans (without Okta)       | 1216 of 2602 = 46.7%                           |
| Rows identical in all plans (with Okta, vacuous) | 1357 of 2743 = 49.5%, not meaningful           |
| Add-on only rows (without Okta)                  | 166 (167 in the brief; the column sums to 166) |
| Unit-plural candidate rows                       | 255                                            |
| Rows without description                         | 1839 of 2743 = 67%                             |
| Rows with a filler description (equal to name)   | 24 (Canva 14, Buffer 10)                       |

## 3. Measurable targets

All thresholds are proposals for the owner. "Spec metric" is a field of `collectMetrics` in
`tests/browser/spectra-review.spec.ts`.

| Target                                                        | How it is measured                                                                                                              | Proposed threshold                                                                 | Measured in CI (section 6)                                                                                                                                    | Status                       |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| First viewport shows plans, price and CTA (1440x900, 375x812) | `firstViewport.planCardsVisible`, `firstPriceVisible`, `firstCtaVisible`                                                        | At least 1 plan card, price and CTA true in all 37 pricings, except Okta (0 plans) | Cards and price true. CTA false for 8 pricings at 1440 (shopify, tableau, trello, trustmary, userguiding, webflow, wrike, zoom); at 375 false for 7 (see 6.3) | Fail (plans, price pass)     |
| Default page is short with 140 features                       | `rendererHeightInViewports` (renderer height / viewport height)                                                                 | At most 3 for any pricing at 1440 and at 375, with default options                 | 1440: 2.4 to 8.82, median 4.85, 2 of 29 at most 3. 375: 3.95 to 44.63, 0 of 29 at most 3                                                                      | Fail                         |
| Plan header and first column stay in view                     | `stickyHeader`, `stickyFirstColumn` (computed `position`), `stickyHeaderEffective`, `stickyFirstColumnEffective` (scroll-based) | Header cell top stays within 1px of the viewport top after scrolling 2 screens     | Computed position true, header effective 0 in every table layout. First column effective 1 where the table overflows horizontally                             | Header fail; column pass     |
| 15 plans without narrow cards or page scroll                  | `planCardWidths.min`, `horizontalOverflow`, `rendererOverflowX`                                                                 | Card width at least 220px (the CSS minimum), `horizontalOverflow` false            | Card width 320 px (321 at 375), never fluid; no page overflow                                                                                                 | Pass                         |
| Balanced grid                                                 | `planCardsPerRow` (no last row with one card when more than one row) and orphan counts in `metrics.json` (22 pricings)          | 0 pricings with a lone last card                                                   | 1440: 4 plans 3+1 (5 pricings); 1024: every 3-plan pricing 2+1, 5 plans 2+2+1, Webflow 2x7+1                                                                  | Fail                         |
| Long texts without ugly breaks or truncation                  | `awkwardBreaks.count`, `truncatedTexts.count`                                                                                   | 0 truncated texts; awkward breaks at most the current CI baseline, then 0          | Truncated 0 everywhere. Awkward breaks: "Unlimited" in 5 pricings, "PROFESSIONAL" in GitHub, 1-2 more per extreme in `es`                                     | Truncated pass; breaks not 0 |
| Contrast AA                                                   | `contrastViolations` (axe `color-contrast`, extremes only, light and dark)                                                      | 0                                                                                  | 0 violations on the 8 extremes, light, dark and `es`                                                                                                          | Pass                         |
| Selection targets stay at least 44px                          | Existing unit and browser tests of `.pr-selection-control` (`min-block-size: 44px`, `base.css:295`)                             | No change; any new control also at least 44px                                      | Not measured by this spec                                                                                                                                     | Not measured                 |

The "at most 3 screens" threshold looks too strict for the collapsed state: the best pricing
(zenhub) is 2.4 at 1440 and 3.95 at 375, and a 15-plan pricing cannot meet it with fixed cards. The
owner should decide whether the target stays or becomes "at most 5 at 1440" (16 of 29 measured
pass). The CTA target is also strict at 1024, where it holds for 2 pricings measured. Contrast is
already met, so it stays as a regression guard and not as an improvement.

## 4. Prioritized improvements

Impact = affected pricings x severity. Effort in changed lines (about 300 maximum each). "Public API"
means a new attribute, property, event field or CSS part. Items marked CRP change the default look
a lot or the public API, so they need the owner's approval first.

### 4.0 Ranking

The first column is the item id (used in the headings below); the row order is the ranking, revised
with the CI numbers.

| #   | Improvement                                                    | Impact                                                      | Effort | Risk   | CRP |
| --- | -------------------------------------------------------------- | ----------------------------------------------------------- | ------ | ------ | --- |
| 1   | Sticky plan header that really sticks, total near the plans    | High (all table layouts; effective check 0 everywhere)      | ~150   | Medium | Yes |
| 2   | Shorter collapsed page; refine differences-only, search, more  | High (4 to 9 screens at 1440 for 27 of 29; 14 to 45 at 375) | ~200   | Medium | Yes |
| 8   | Plan grid: fixed 320 px tracks, orphans, CTA in the first view | High (CTA hidden at 1440 for 8, at 1024 for most; orphans)  | ~80    | Medium | Yes |
| 10  | Long text handling, including the "Unlimited" split            | Medium (5 pricings split, a real defect)                    | ~80    | Low    | No  |
| 3   | Plural units                                                   | Medium (255 rows)                                           | ~120   | Low    | No  |
| 4   | Names instead of ids for dependencies and the dialog           | Medium (every add-on pricing)                               | ~60    | Low    | No  |
| 5   | Okta without plans                                             | Medium (1 pricing; 5.03 / 6.86 / 10.59 screens, no plans)   | ~80    | Low    | Yes |
| 6   | "Add-on" marker instead of the em dash                         | Medium (166 rows)                                           | ~100   | Low    | Yes |
| 7   | Add-on grid: equal heights, fewer details, filter for 14+      | Medium (8 with 8+ add-ons)                                  | ~250   | Medium | Yes |
| 11  | Empty or filler descriptions                                   | Medium (1839 rows)                                          | ~40    | Low    | No  |
| 9   | Group by tags                                                  | Low (most have 1 or 2 groups)                               | ~100   | Low    | No  |

What the numbers changed: page length is driven by the collapsed-table behaviour (30 rows per
group, first group only) and by the fixed 320 px cards, not by row count (ClickUp 4.54 screens,
Webflow 8.82). Grid balancing (item 8) moved up because its CTA and orphan effects are measured at
1024 and 1440. Long text moved up because the "Unlimited" split is observed. Contrast is not on the
list: it is already 0 and stays as a regression guard. The CRP column counts items 1, 2, 5, 6, 7
and 8.

### 4.1 Sticky plan header and the total (item 1)

Problem:

- The `thead th` cells are `position: sticky; inset-block-start: 0` (`base.css:732-737`), but the
  scroll container `.pr-table-scroll` has `overflow: auto` and no height limit (`base.css:698-705`).
  It never scrolls vertically, so the sticky offset is relative to a box that always shows
  everything and the header scrolls away with the page. Confirmed in CI: `stickyHeader` (computed
  position) is true on every table layout at 1440 and 1024, while `stickyHeaderEffective` is 0
  everywhere (section 6.4).
- The spec metric `stickyHeader` reads only `getComputedStyle(...).position`, so it reads `true`
  while the header does not stay in view; use `stickyHeaderEffective` (scroll-based, 2 px
  tolerance) as the acceptance metric.
- The first column is sticky horizontally (`base.css:722-730`); that part works where the table
  overflows horizontally (effective 1 at 1024 for 10 pricings, and at 1440 for webflow and figma);
  elsewhere there is no horizontal scroll and nothing to measure.
- The total is `renderSummary`, rendered after the add-ons (`pricing-renderer-element.ts:926`), or
  after the comparison when there are no add-ons (`viewModel.addOns.length === 0`). With 140 rows
  it is a page below the plans.

Proposal:

- Give `.pr-table-scroll` a `max-block-size: 80dvh` (or `100dvh` minus a header allowance) so it
  scrolls vertically and the sticky header works inside it. Alternative with no new scroll area:
  `overflow: clip` on the wrapper so the header sticks to the page; this needs a spike in a real
  browser.
- Make the page-level summary compact and sticky once a plan is selected (the mobile layout already
  sticks it to the bottom, `base.css:895-898`). No new API; optional later attribute
  `summary-position` if the owner wants control.
- Default on. The look of the table changes (it becomes a scroll box), hence CRP.

Acceptance: a scroll-based browser check: scroll the page (or the container) by two screens and
assert the header cell's `getBoundingClientRect().top` is within 1px of its pinned position, at 1440
and 375 (375 uses the card layout, where the plan names are in each `dl`; the check applies to the
table layout only). Test type: layout metric test.

### 4.2 Differences-only, search and show more already exist (item 2)

What exists:

- Search: `renderComparisonToolbar` (`renderers.ts:543-581`) with `filterGroups` matching name and
  description (`renderers.ts:523-537`).
- Differences-only checkbox (`renderers.ts:561-569`), state `_onlyDifferences` default `false`
  (`pricing-renderer-element.ts:120`).
- A 30-row cap per group with "Show N more" (`renderers.ts:539-541`, `:637-647`, `:716-731`).
- Expand all and collapse all; only the first group is expanded at load
  (`pricing-renderer-element.ts:372-374`).

What the CI numbers add: the page height seen is the collapsed state. ClickUp (174 rows, the
largest) is only 4.54 screens at 1440 because each group shows at most 30 rows and only the first
group is expanded, so height does not track row count (Zoom 151 rows 6.25, Okta 141 rows 5.03,
Webflow 118 rows 8.82 with 15 plans). The rows behind "Show N more" are not in these numbers, and
a user who expands them gets a far taller page. Phase 2 must measure the expanded state (all
groups expanded, no cap) before judging any default; the "at most 3 screens" acceptance below is
unlikely to hold without a different design, see section 3.

What is missing:

- Defaults: differences-only is off, so ClickUp starts with 174 rows (107 after the filter, 38%
  fewer). For the nine pricings of 100+ rows the filter removes from 3 rows (Webflow) to 87 (Salesforce and
  Deskera), Okta aside (`metrics.md` Ident column). Webflow gains almost nothing because its 15 plans differ everywhere:
  it needs a different tool (item 8, and grouping).
- Threshold: the toolbar only shows when the pricing has more than 40 rows in total
  (`renderers.ts:547`). Pricings of 15 to 40 rows (Quip, Overleaf, Crowdcast) get no search; a
  pricing with 41 rows gets all four controls. The threshold is on total rows, not on rendered
  rows, and not configurable.
- Discoverability: the toolbar sits below the plans and the comparison heading; once the user
  scrolls into the table, the controls are gone (they are not sticky). "Only differences" has no
  explanation of how many rows it hides.
- Counter: `pricing.rowsShown` (`i18n.ts:62`) shows `totalRows`, computed from the filtered groups
  before the 30-row cap (`renderers.ts:744`). With 136 rows in ClickUp's General group it says
  "136 items shown" while 30 are visible. The counter text and the real number differ.
- A collapsed group (the second group at load) counts its rows in the counter although none is
  rendered.
- The cap and the expansion are per group, so a pricing with one group of 100 rows (Deskera) still
  shows 30 rows and a button, which is fine, while 34 of 37 pricings have 1 or 2 groups, so the
  page stays long after expanding.

Proposal:

- New attribute `only-differences` (boolean) as the initial state, and an auto default: on when the
  pricing has more than 100 rows and at least 2 plans. Public API addition; default look changes
  for 9 pricings, hence CRP.
- Counter: `{shown} of {total}` with a new i18n key `pricing.rowsShownOf` (es: "{shown} de {total}
  elementos"), counting rendered rows only.
- Toolbar threshold as a property `toolbar-threshold`, default unchanged (40).
- Make the toolbar `position: sticky` below the plan header (depends on item 1).
- Show an empty state when search leaves 0 rows (`pricing.noMatches`, es "Sin resultados"). Today
  `filterGroups` returns no groups and the table has an empty body (not verified in the browser).

Acceptance: `rendererHeightInViewports` at most 3 for ClickUp, Zoom, Okta (with item 5), Salesforce
and Webflow at default options; unit test that the counter equals the number of rendered
`comparison-row` elements. Test type: layout metric test plus a unit test.

### 4.3 Plural units (item 3)

Problem: `renderValue` appends the unit verbatim: `${formatted}${unit ? ` ${unit}` : ''}`
(`renderers.ts:129-132`). A limit of 3 with unit `unit` reads "3 unit"; 15 with unit `execution`
reads "15 execution". 255 rows are candidates (`metrics.md`, Unit column; units are
in `metrics.json`, up to five examples per pricing).

Proposal:

- Pluralize with `Intl.PluralRules(locale)`, in a helper `formatUnit(unit, count, locale)` in
  `src/core/` next to `formatCurrency`.
- English: if the unit is a single ASCII word and the plural category is `other`, append `s`
  (`execution` to `executions`, `box` to `boxes`, ends in `s`/`x`/`z`/`ch`/`sh` take `es`, consonant
  - `y` becomes `ies`). Spanish: vowel adds `s`, consonant adds `es`, final `z` becomes `ces`.
- Fallback: any unit with more than one word, with a slash, with digits or in uppercase is left
  as written, as is a unit that already ends in `s`. A value of exactly 1 uses the singular.
- Allow an override through the pricing: a map `presentation.unitLabels` (`{ unit: { one, other } }`
  per locale) so exotic units can be fixed without code. This is a public API addition, but the
  default behaviour change is only text, so no CRP is needed beyond a changelog note.

Acceptance: unit tests on a table of units (`unit`, `execution`, `GB`, `user/month`, `credit`) for
en and es; a SPECTRA test that no rendered cell matches `/\b1 \w+s\b/` and that the 255 candidate
rows render without throwing. Test type: unit tests.

### 4.4 Names instead of ids (item 4)

Problem: `dependsOn` and `excludes` print raw ids: `addOn.dependsOn.join(', ')`
(`renderers.ts:914`) and `addOn.excludes.join(', ')` (`renderers.ts:923`). The confirm dialog
prints `pending.addIds.join(', ')` and `pending.removeIds.join(', ')` (`renderers.ts:1183`,
`:1189`). `availableFor` already maps ids to plan names (`renderers.ts:900-905`), which is the model
to follow.

Proposal: map each id to the add-on name through `viewModel.addOns` (fall back to
`humanizeIdentifier(id)`, already imported at `renderers.ts:10`, then to the id). Same in the
dialog. No API change.

Acceptance: unit test with an add-on that depends on another: the text contains the name and not the
id. Test type: unit.

### 4.5 Okta with 0 plans (item 5)

Problem: Okta renders 141 comparison rows with no value columns (`renderTableComparison` maps over
`viewModel.plans`, which is empty, `renderers.ts:677`, `:707`), and 'only differences' hides all of
them (`resolvedValuesDiffer` on an empty `values` is false, `renderers.ts:142-145`). CI: 0 plan
cards and `fv` 0/0/0 at every viewport (nothing to choose), 5.03 / 6.86 / 10.59 screens at
1440 / 1024 / 375, driven by 141 comparison rows and 18 add-ons. The page shows
"No plans are available." (`i18n.ts:76`) and a long list of features that mean nothing, plus the
18 add-ons. In `metrics.md` the Ident and AddOn columns for Okta are vacuous.

Proposal: when `viewModel.plans.length === 0`, skip the comparison section and show only the
add-on catalogue; a sentence under "No plans" says "Add-ons are listed below" if there are any. As
an option, a catalog-only row list with names and descriptions (no value cells). Default behaviour
change for pricings without plans: CRP.

Acceptance: Okta at 1440 and 375: `comparisonRows.rendered` 0 (or the names-only list), height at
most 3 screens, `PR_PLANS_EMPTY` still emitted. Test type: layout metric test.

### 4.6 "Add-on" marker instead of the em dash (item 6)

Problem: a row no plan includes but an add-on does reads as "—" in every plan (`renderers.ts:115-120`),
which says "not available", while it can be bought. 166 rows (without Okta): GitHub 32, Salesforce
44, Mailchimp 16, Postman 14, Zoom 13, Tableau 10 (Zoom's 13 and the others from `metrics.md`).

Proposal: in `renderValue`'s empty branch, when the row is add-on only (computed in the view model
as `row.addOnIds`, a new field), render a small pill "Add-on" (es "Complemento") with the
screen-reader text "Available as add-on"; keep the em dash for everything else. New i18n keys
`pricing.addOnOnly` and `pricing.addOnOnlySr`. New public field on `PricingComparisonRow`, and a
visible look change in 22 pricings (those with add-on only rows): CRP.

Acceptance: unit test of `createPricingViewModel` for `addOnIds`; for SPECTRA the number of rows with
the marker equals the add-on-only count of `metrics.json` (166 without Okta). Test type: unit plus
visual snapshot of GitHub.

### 4.7 Add-on cards, many add-ons and the total (item 7)

Problem:

- Add-on cards are in a 3-column grid at 1200px and above (`base.css:1203-1205`) and 2 columns
  from 600px (`base.css:1153-1156`). The card content varies a lot: description (up to 53-character
  names), availability, dependency, excludes, constraints and a `details` of effects
  (`renderers.ts:849-940`), so cards in one row have different heights. `addOnCardHeights` in the
  spec reports min and max.
- 14 to 18 add-ons (Okta 18, Zoom 16, Salesforce 14, GitHub 14, Postman 12, UserGuiding 11) are an
  unfiltered wall of cards.
- The total sits in the right column of `.pr-addon-layout` at 840px+ and is sticky there
  (`base.css:1179-1190`), so with many add-ons it stays visible, but it is lost among the cards on
  mobile (bottom sticky bar, `base.css:895-898`) and is not visible while the user compares.

Proposal:

- Same-height cards in a row (`align-items: stretch` is already the grid default; make
  `.pr-addon-card__details` push the controls to the bottom with `margin-block-start: auto`).
- With more than 8 add-ons: an add-on filter (search box reusing the `pricing.search` pattern, key
  `pricing.searchAddOns`) and a "Show N more" cap of 8 using the existing `pricing.showRemaining`.
  Selected add-ons are never hidden.
- Group add-ons by a `tags`-like field only if the pricing provides one (see item 9).
- Default on above the threshold; look changes for the 8 pricings with 8+ add-ons: CRP.

Acceptance: `addOnCardHeights.max - min` per row at most 24px or equal within a row (needs a
per-row metric added to the spec); first viewport of the add-on section shows at most 8 cards.
Test type: layout metric test.

### 4.8 Grid balancing for 4, 5 and 15 plans (item 8)

Problem: the plan grid is `repeat(auto-fit, minmax(220px, 320px))` from 840px up
(`base.css:1174-1177`, `:1198-1201`) and `repeat(2, minmax(0, 320px))` from 600px
(`base.css:1147-1150`). With 5 plans the last row has one card; 22 pricings have an orphan on a 3 or
4 column grid (`metrics.md`). With 15 plans (Webflow) the number of columns follows the width and
the plan cards each carry price, highlights and a CTA, so the first viewport shows only a part.

Measured (section 6.2): the 220 px minimum is not the issue, since no card is narrow. Every card is
320 px wide (321 at 375), min = max, so the track is fixed and never fluid. Rows: 1440 gives 3 per row (4 plans
3+1, 5 plans 3+2, 15 plans five rows of 3); 1024 gives 2 per row (every 3-plan pricing 2+1, 5
plans 2+2+1, Webflow 2x7+1, 8 rows); 375 is one column (Webflow 15 rows, 44.63 screens). The
orphan count is therefore wider than the 22 pricings of `metrics.md`: at 1024 every 3-plan
pricing has one. The CTA is not visible in the first viewport for 8 pricings at 1440 and for
almost all at 1024, because the cards are tall and stacked in rows.

Proposal:

- For 4 plans use 2x2 below 1200px and 4 in a row above; for 5 and 6 plans 3 columns (3+2 or 3+3
  with `justify-content: center`); for 15 plans a horizontal scroller of cards with snap or a
  compact card (name, price, CTA, no highlights) selected by plan count above 8. The compact mode is
  a new look and a public attribute `plan-density` (`comfortable`, `compact`, `auto`): CRP.
- Use `grid-template-columns` computed from a `--pr-plan-count` custom property set by the
  element, so CSS can balance without JS layout.

Acceptance: `planCardsPerRow` has no row of 1 when there is more than one row, in 37 pricings at
1440 and 1024 (375 is one column by design); `planCardWidths.min` at least 220 for Webflow (already
320); `firstCtaVisible` true at 1440 for the 8 pricings that fail today. Test type: layout metric
test.

### 4.9 Group by tags (item 9)

Problem: groups come from the tag of each feature or limit (`category: feature.tag`,
`view-model.ts:286`; fallback `'General'`, `view-model.ts:324`). The SPECTRA files mostly have no
tags (34 of 37 have 1 or 2 groups), so ClickUp is General 136 and Usage limits 38. Collapsing does
not help there.

Proposal: no code needed when a pricing has tags (Shopify 6, Zenhub 7 and Zoom 10 already group).
For untagged big groups, an optional "section by name prefix" heuristic is fragile; recommend
instead showing the group count and the 30-row cap (item 2) and reporting to the pricing authors
that tags would help. Not a renderer change; drop unless the owner asks for it.

### 4.10 Long text handling (item 10)

Problem: the first column is limited to 230-260px (`base.css:726-727`), so a row name of 65
characters and a description of 398 characters (Zoom) become tall cells; a 76-character string cell
(Wrike) and a 29-character plan name in a 190px column (`base.css:714-716`) can break inside words.
A generic `overflow-wrap: anywhere` is already set (`base.css:51`), which breaks words anywhere
instead of at spaces first.

Proposal: `overflow-wrap: break-word` plus `hyphens: auto` for descriptions; clamp descriptions of
rows to 3 lines in the table with a "more" toggle (`<details>` or a button) above 160 characters.
Uses `-webkit-line-clamp`, which the spec counts as truncation when it clips, so the toggle must
reveal the full text and the spec should treat a clamped text with a toggle as not truncated.

Measured (section 6.5): `truncatedTexts` is 0 everywhere, so truncation is not a current problem
(the clamp above would introduce it). The observed awkward breaks are narrower than guessed: the
word "Unlimited" inside `span.pr-value` in mailchimp, microsoft365Business, salesforce, zoom and
figma (375), and "PROFESSIONAL" in a `dt` (github). They come from narrow value cells and cards,
not from long descriptions. The "Unlimited" split is a real defect and the first thing to fix:
give value cells `overflow-wrap: normal` (or `break-word` with a minimum width) and `hyphens:
manual` so that short words are never cut. The long description clamp (above) is low priority.

Acceptance: `awkwardBreaks.count` 0 for the pricings listed above (the CI baseline of section 6.5 is
at least 1 for each), `truncatedTexts` 0 with the toggle. Test type: layout metric test.

### 4.11 Empty or filler descriptions (item 11)

Problem: 1839 rows have no description and 24 have a description equal to the name (Canva 14, Buffer
10). The table row then has only the name, which is correct, but the compact card renders the
filler twice (`renderers.ts:611-612`).

Proposal: in the view model, drop a description equal to the name ignoring case. Do not invent
text. No API change.

Acceptance: unit test on a row with `description === name`; Canva has 0 filler descriptions
rendered. Test type: unit.

### 4.12 Other findings from the review (marked as extra)

- The comparison section appears before the add-ons and the total
  (`pricing-renderer-element.ts:924-926`), so the page order is hero, billing, variables, plans,
  comparison, add-ons, total. Moving the add-ons above a collapsed comparison would shorten the path
  to the total but changes the layout order: CRP, left to the owner.
- The compact layout is used below 840px of container width (`pricing-renderer-element.ts:484`).
  In it each row is a card with every plan's value, 174 cards for ClickUp. The 30-row cap applies,
  but a 15-plan pricing has 15 lines per card. The heights confirm the cost: Webflow is 44.63
  screens (36237 px) at 375, ClickUp 14.71, Github 20.19; the clamp and the expanded state were
  not measured.
- `filterGroups` runs on each render over all rows; for 174 rows this is fine. No action.

## 5. Proposed order of phase 2 changes

| Step | Change                                                                           | Depends on           | CRP |
| ---- | -------------------------------------------------------------------------------- | -------------------- | --- |
| 1    | Expanded-state height check (spec); the scroll-based sticky check already exists | none                 | No  |
| 2    | Names instead of ids (4.4)                                                       | none                 | No  |
| 3    | Plural units (4.3)                                                               | none                 | No  |
| 4    | Filler descriptions (4.11)                                                       | none                 | No  |
| 5    | Long text, "Unlimited" first (4.10)                                              | section 6.5 baseline | No  |
| 6    | Sticky header and total (4.1)                                                    | step 1               | Yes |
| 7    | Differences-only defaults (4.2)                                                  | step 6 for sticky    | Yes |
| 8    | "Add-on" marker (4.6)                                                            | none                 | Yes |
| 9    | Okta without plans (4.5)                                                         | step 7               | Yes |
| 10   | Grid balancing (4.8)                                                             | section 6.2 baseline | Yes |
| 11   | Add-on cards and filter (4.7)                                                    | step 7 (pattern)     | Yes |

Steps 1 to 5 are safe to start without a CRP. Steps 6 to 11 each need the owner's decision first;
send one CRP per step with the proposed default.

## 6. Measured in CI

Source: the `browsers` job of this pull request ran `tests/browser/spectra-review.spec.ts`
(chromium only) for the latest fixture of each SaaS at 1440x900, 1024x768 and 375x812, light theme,
`en`. Each test prints one `SPECTRA_METRICS {...}` line.

### 6.1 Coverage and method

- The CI log tool returns only the tail of the job log. The numbers below cover 29 of 37 pricings
  for page height (light, `en`) and a subset for the other metrics. Missing: box, buffer, canva,
  circleci, clockify, crowdcast, databox and deskera. Their data is in the `playwright-report`
  artifact (job `browsers`, 14-day retention), which the author of this report could not read.
- Screenshots exist only in that artifact. No screenshot was seen for this report.
- "Screens" = `<pricing-renderer>` height / viewport height. The demo page (`examples/vanilla`)
  puts its own content above the renderer (field `top=`): 1611 px at 1440, 1366-1383 px at 1024 and
  2273-2290 px at 375. The first-viewport figures (`fv`) below are for a pricing that starts at the
  top of the viewport, as in the section 3 definition.
- Dark theme gives identical heights. `es` adds 0.0-0.2 screens (zoom 1440 6.25 to 6.37, okta 5.03
  to 5.14, webflow 375 44.63 to 44.71).

### 6.2 Renderer height (screens) and plan grid

| Pricing              | 1440 | 1024  | 375   |
| -------------------- | ---- | ----- | ----- |
| dropbox              | 4.73 | 6.29  | 17.79 |
| evernote             | 4.61 | 5.57  | 14.2  |
| figma                | 4.04 | 5.25  | 19.39 |
| github               | 7.44 | 11.33 | 20.19 |
| hypercontext         | 4.09 | 4.83  | 13.82 |
| jira                 | 4.29 | 5.04  | 14.01 |
| mailchimp            | 4.85 | 6.16  | 15.94 |
| microsoft365Business | 5.6  | 7.26  | 15.5  |
| notion               | 4.31 | 5.16  | 14.46 |
| okta                 | 5.03 | 6.86  | 10.59 |
| openphone            | 4.12 | 5.74  | 13.59 |
| overleaf             | 4.24 | 5.62  | 9.84  |
| planable             | 5.38 | 7.03  | 16.71 |
| postman              | 6.39 | 8.88  | 19.33 |
| pumble               | 5.31 | 6.86  | 15.27 |
| quip                 | 2.46 | 3.64  | 6.89  |
| salesforce           | 6.05 | 8.72  | 17.41 |
| shopify              | 4.21 | 5.85  | 9.8   |
| slack                | 7.67 | 10.45 | 18.8  |
| tableau              | 5.04 | 7.18  | 14.63 |
| trello               | 6.02 | 7.71  | 15.92 |
| trustmary            | 4.46 | 5.15  | 14.37 |
| userguiding          | 5.19 | 7.66  | 16.35 |
| webflow              | 8.82 | 12.62 | 44.63 |
| wrike                | 7.59 | 10.43 | 22.62 |
| zapier               | 4.69 | 5.44  | 15.28 |
| zenhub               | 2.4  | 2.67  | 3.95  |
| zoom                 | 6.25 | 8.63  | 19.17 |
| clickup              | 4.54 | 5.34  | 14.71 |

Webflow at 375 is 36237 px tall. Lowest at 1440: zenhub 2.4, quip 2.46. Highest: webflow 8.82,
slack 7.67, wrike 7.59, github 7.44. Median at 1440 over the 29: 4.85 (mailchimp).

Page height does not track row count. ClickUp has the most rows (174) and is 4.54 screens at 1440,
less than Slack (51 rows, 7.67) or Wrike (86 rows, 7.59). The renderer caps each group at 30 rows
and expands only the first group, so what was measured is the collapsed state. The rows behind
"Show N more" and the second group are not in these numbers; the height after expanding is unknown
and must be measured in phase 2. The tallest pages (Webflow with 15 plans, Slack, Wrike,
GitHub) are not the biggest tables. The likely drivers are the number of plan cards at a fixed 320
px width and the add-on section; this was not isolated by the available data.

Plan cards (all pricings): every card is 320 px wide at 1440 and 1024 and 321 px at 375, min =
max, so the track is fixed and never fluid. Cards per grid row:

| Plans | 1440                      | 1024           | 375      |
| ----- | ------------------------- | -------------- | -------- |
| 2     | 2                         | 2              | 1 column |
| 3     | 3                         | 2+1            | 1 column |
| 4     | 3+1 (slack, trello, ...)  | 2+2            | 1 column |
| 5     | 3+2 (dropbox, wrike, ...) | 2+2+1          | 1 column |
| 6     | 3+3                       | 2+2+2          | 1 column |
| 15    | 3+3+3+3+3                 | 2x7+1 (8 rows) | 15 rows  |

The 4-plan pricings that are 3+1 at 1440 are slack, trello, trustmary, zapier and clickup. Orphans:
every 3-plan pricing at 1024 (2+1), every 4-plan pricing at 1440 (3+1), and Webflow at 1024 (ends
with a single card).

### 6.3 First screen (pricing at the top of the viewport)

Field `fv` = plan cards fully visible / first price visible / first CTA visible.

- 1440: most pricings show 3 plan cards and a price. CTA visible: salesforce, slack, zapier, github,
  dropbox, figma, clickup. CTA not visible: shopify, tableau, trello, trustmary, userguiding,
  webflow, wrike, zoom.
- 1024: 2 plan cards and the price are visible. CTA visible only for salesforce and figma among
  those measured; not visible for quip, shopify, slack, tableau, trello, trustmary, userguiding,
  webflow, wrike, zapier, zenhub, zoom, clickup, github and dropbox.
- 375: 1 or 2 cards and the price are visible. CTA visible: quip, salesforce, slack, tableau,
  clickup, zapier, trustmary, dropbox, figma, github (some `es` variants). Not visible: shopify,
  trello, userguiding, webflow, wrike, zenhub, zoom.
- Okta: 0 plan cards, `fv` 0/0/0 at every viewport (no plans: nothing to choose); 5.03 / 6.86 /
  10.59 screens driven by 141 comparison rows and 18 add-ons.

The CTA is the weak point: it is below the first screen for 8 of the pricings with a result at 1440,
for nearly every pricing at 1024, and the measure is strict (the card must end inside the
viewport), so tall cards fail. The target of section 3 does not hold.

### 6.4 Sticky

- Computed `position: sticky` is true for the comparison header and the first column on every table
  layout (1440, 1024).
- The effective check is 0 for the header everywhere: the header does not stay at the viewport top
  while the table scrolls. This confirms the hypothesis of 4.1 about `.pr-table-scroll` never
  scrolling vertically.
- The first column is effective (1) at 1024 for the pricings whose table overflows horizontally
  (slack, trello, trustmary, zapier, wrike, zoom, webflow, figma, dropbox, clickup). At 1440 it is
  n/a (no horizontal scroll) except webflow and figma (1). At 375 the comparison renders as cards,
  so sticky is n/a.

### 6.5 Text, overflow and contrast

- Truncated texts: 0 in every record.
- Awkward breaks (a word of 4 or more letters split across lines by the renderer): "Unlimited" inside
  `span.pr-value` in mailchimp, microsoft365Business, salesforce, zoom and figma (375);
  "PROFESSIONAL" in a `dt` (github). The `es` locale adds 1 or 2 more on okta, github and dropbox.
  They come from narrow value cells and cards. The "Unlimited" split is a real defect.
- Page-level horizontal overflow (document height vs inner width): never. Renderer-internal
  `overflow-x` elements exist (scroll containers such as `div.pr-table-scroll`, and plan grid
  buttons at 375).
- Contrast (axe `color-contrast` on okta, zoom, clickup, webflow, salesforce, github, dropbox,
  figma; light, dark, `es`): 0 violations everywhere. The AA target is already met on these; keep it
  as a regression guard, not as an improvement.
- Add-on card heights are not covered by the numbers available to this report.

### 6.6 Column sources

Height is `rendererHeightInViewports`; first screen `firstViewport.planCardsVisible`,
`firstPriceVisible`, `firstCtaVisible`; sticky `stickyHeader`, `stickyFirstColumn`,
`stickyHeaderEffective`, `stickyFirstColumnEffective`; cards per row `planCardsPerRow`; truncated
`truncatedTexts.count`; awkward breaks `awkwardBreaks.count`; contrast `contrastViolations`.

## 7. Limits of this phase

- Workers have no Chromium. The author saw no screenshot; section 4 is read from code and CSS, and
  section 6 numbers come from the CI log only.
- Coverage: 29 of 37 pricings (light, `en`) for height and a subset for the other metrics; eight
  pricings and all captures are only in the `playwright-report` artifact. Add-on card heights, the
  expanded comparison and the `es` first-screen metrics are not covered.
- The heights are the collapsed state (30 rows per group, first group expanded); the expanded state
  is a phase 2 measurement.
- The spec's heuristics are unverified: the `awkwardBreaks` word walker skips words with hyphens or
  slashes and stops at 6000 words; `truncatedTexts` counts any clipped element; the first-viewport
  tests use `bottom <= viewport height`, which is strict for tall cards (it makes the CTA failures
  of 6.3 look worse for tall cards).
- The "header never sticks" finding (4.1) is now confirmed by `stickyHeaderEffective` in CI (6.4).
- The figures in 2.3 are sums of the `metrics.md` table; `metrics.json` holds the same data per
  pricing but was only checked for the summary block, the group list of ClickUp and the totals.
- Effort figures are estimates and thresholds are proposals for the owner.
