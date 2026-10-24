# Visual review of pricing-renderer with real SPECTRA pricings: phase 1 report

Scope: 37 real pricings in `tests/fixtures/spectra/`. Sizes come from `metrics.md` and
`metrics.json` (same folder, reproduced by `tests/unit/spectra-layout-metrics.test.ts`). Browser
measurements come from `tests/browser/spectra-review.spec.ts` and only exist in CI, so section 6 is
a skeleton. Code references are to the current head.

## 1. Summary

- Real pricings are far bigger than the demo pricing: median 65 comparison rows, 9 pricings with 100
  or more, maximum 174. Descriptions are missing on 1839 of 2743 rows (67%).
- Differences-only, search and a 30-row "show more" cap already exist but are off, hidden below 41
  rows, or poorly counted. Nothing keeps the plan header in view while scrolling a 150-row table.
- The estimated total sits after the whole comparison, or at the end of the page without add-ons.
- Texts are raw: `3 unit`, raw ids in "Requires ..." and in the confirm dialog, em dashes for rows
  only an add-on gives.
- Okta (0 plans, 141 rows, 18 add-ons) shows a table with no values.
- Highest impact: (1) turn on and improve differences-only, search and show more by default for big
  pricings; (2) make the plan header really sticky and move the total near the plans; (3) fix raw
  texts (plural units, names for dependencies, "Add-on" marker, Okta without plans).
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

| Target                                                        | How it is measured                                                                                                     | Proposed threshold                                                                 |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| First viewport shows plans, price and CTA (1440x900, 375x812) | `firstViewport.planCardsVisible`, `firstPriceVisible`, `firstCtaVisible`                                               | At least 1 plan card, price and CTA true in all 37 pricings, except Okta (0 plans) |
| Default page is short with 140 features                       | `rendererHeightInViewports` (renderer height / viewport height)                                                        | At most 3 for any pricing at 1440 and at 375, with default options                 |
| Plan header and first column stay in view                     | `stickyHeader`, `stickyFirstColumn` (computed `position` only) plus a new scroll-based check (see 4.1)                 | Header cell top stays within 1px of the viewport top after scrolling 2 screens     |
| 15 plans without narrow cards or page scroll                  | `planCardWidths.min`, `horizontalOverflow`, `rendererOverflowX`                                                        | Card width at least 220px (the CSS minimum), `horizontalOverflow` false            |
| Balanced grid                                                 | `planCardsPerRow` (no last row with one card when more than one row) and orphan counts in `metrics.json` (22 pricings) | 0 pricings with a lone last card                                                   |
| Long texts without ugly breaks or truncation                  | `awkwardBreaks.count`, `truncatedTexts.count`                                                                          | 0 truncated texts; awkward breaks at most the current CI baseline, then 0          |
| Contrast AA                                                   | `contrastViolations` (axe `color-contrast`, extremes only, light and dark)                                             | 0                                                                                  |
| Selection targets stay at least 44px                          | Existing unit and browser tests of `.pr-selection-control` (`min-block-size: 44px`, `base.css:295`)                    | No change; any new control also at least 44px                                      |

## 4. Prioritized improvements

Impact = affected pricings x severity. Effort in changed lines (about 300 maximum each). "Public API"
means a new attribute, property, event field or CSS part. Items marked CRP change the default look
a lot or the public API, so they need the owner's approval first.

### 4.0 Ranking

| #   | Improvement                                                 | Impact                        | Effort | Risk   | CRP |
| --- | ----------------------------------------------------------- | ----------------------------- | ------ | ------ | --- |
| 1   | Sticky plan header that really sticks, total near the plans | High (all 37)                 | ~150   | Medium | Yes |
| 2   | Refine differences-only, search and show more               | High (all with 41+ rows)      | ~200   | Medium | Yes |
| 3   | Plural units                                                | Medium (255 rows)             | ~120   | Low    | No  |
| 4   | Names instead of ids for dependencies and the dialog        | Medium (every add-on pricing) | ~60    | Low    | No  |
| 5   | Okta without plans                                          | Medium (1 pricing, worst)     | ~80    | Low    | Yes |
| 6   | "Add-on" marker instead of the em dash                      | Medium (166 rows)             | ~100   | Low    | Yes |
| 7   | Add-on grid: equal heights, fewer details, filter for 14+   | Medium (8 with 8+ add-ons)    | ~250   | Medium | Yes |
| 8   | Grid balancing for 4, 5 and 15 plans                        | Medium (22 orphans)           | ~80    | Medium | Yes |
| 9   | Group by tags                                               | Low (most have 1 or 2 groups) | ~100   | Low    | No  |
| 10  | Long text handling                                          | Low to medium                 | ~80    | Low    | No  |
| 11  | Empty or filler descriptions                                | Medium (1839 rows)            | ~40    | Low    | No  |

Reading order below follows the ranking, not the numbers. The CRP column counts items 1, 2, 5, 6, 7
and 8.

### 4.1 Sticky plan header and the total (item 1)

Problem:

- The `thead th` cells are `position: sticky; inset-block-start: 0` (`base.css:732-737`), but the
  scroll container `.pr-table-scroll` has `overflow: auto` and no height limit (`base.css:698-705`).
  It never scrolls vertically, so the sticky offset is relative to a box that always shows
  everything and the header scrolls away with the page. This is derived from CSS semantics and not
  yet observed in a browser (section 7).
- The spec metric `stickyHeader` reads only `getComputedStyle(...).position`
  (`spectra-review.spec.ts:247`), so it can read `true` while the header does not stay in view.
- The first column is sticky horizontally (`base.css:722-730`); that part works, since the
  container scrolls horizontally.
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
them (`resolvedValuesDiffer` on an empty `values` is false, `renderers.ts:142-145`). The page shows
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

Proposal:

- For 4 plans use 2x2 below 1200px and 4 in a row above; for 5 and 6 plans 3 columns (3+2 or 3+3
  with `justify-content: center`); for 15 plans a horizontal scroller of cards with snap or a
  compact card (name, price, CTA, no highlights) selected by plan count above 8. The compact mode is
  a new look and a public attribute `plan-density` (`comfortable`, `compact`, `auto`): CRP.
- Use `grid-template-columns` computed from a `--pr-plan-count` custom property set by the
  element, so CSS can balance without JS layout.

Acceptance: `planCardsPerRow` has no row of 1 when there is more than one row, in 37 pricings at
1440, 1024 and 375; `planCardWidths.min` at least 220 for Webflow. Test type: layout metric test.

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

Acceptance: `awkwardBreaks.count` lower than the CI baseline of section 6, `truncatedTexts` 0 with
the toggle. Test type: layout metric test.

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
  but a 15-plan pricing has 15 lines per card. Not measured in a browser.
- `filterGroups` runs on each render over all rows; for 174 rows this is fine. No action.

## 5. Proposed order of phase 2 changes

| Step | Change                           | Depends on        | CRP |
| ---- | -------------------------------- | ----------------- | --- |
| 1    | Scroll-based sticky check (spec) | none              | No  |
| 2    | Names instead of ids (4.4)       | none              | No  |
| 3    | Plural units (4.3)               | none              | No  |
| 4    | Filler descriptions (4.11)       | none              | No  |
| 5    | Long text (4.10)                 | CI baseline       | No  |
| 6    | Sticky header and total (4.1)    | step 1            | Yes |
| 7    | Differences-only defaults (4.2)  | step 6 for sticky | Yes |
| 8    | "Add-on" marker (4.6)            | none              | Yes |
| 9    | Okta without plans (4.5)         | step 7            | Yes |
| 10   | Grid balancing (4.8)             | CI baseline       | Yes |
| 11   | Add-on cards and filter (4.7)    | step 7 (pattern)  | Yes |

Steps 1 to 5 are safe to start without a CRP. Steps 6 to 11 each need the owner's decision first;
send one CRP per step with the proposed default.

## 6. Measured in CI

Measured in CI: not available to the author of this report. The `browsers` job runs
`tests/browser/spectra-review.spec.ts` (chromium only) for the latest fixture of each SaaS at
1440x900, 1024x768 and 375x812, light theme, `en`. Fill the cells from the run of this pull
request.

How to read it:

1. Open the pull request checks, job `browsers`, and download the artifact `playwright-report`.
2. Every test attaches `<saas>-<width>-light-en-metrics` as JSON and prints one
   `SPECTRA_METRICS {...}` line in the job log (`report()` in the spec). Search the log for
   `SPECTRA_METRICS`.
3. The extremes (Okta, Zoom, ClickUp, Webflow, Salesforce, GitHub, Dropbox, Figma) also have JPEG
   captures (first viewport and full page, light, dark and `es`) and axe contrast results.

Table skeleton, one row per pricing and viewport (37 x 3 = 111 rows; the first rows are shown):

| Pricing | Viewport | Height (screens) | Plans visible | Price visible | CTA visible | Sticky header | Sticky col | Cards per row | Add-on heights | Truncated | Awkward breaks | Contrast |
| ------- | -------- | ---------------- | ------------- | ------------- | ----------- | ------------- | ---------- | ------------- | -------------- | --------- | -------------- | -------- |
| okta    | 1440     | pending          | pending       | pending       | pending     | pending       | pending    | pending       | pending        | pending   | pending        | pending  |
| okta    | 375      | pending          | pending       | pending       | pending     | pending       | pending    | pending       | pending        | pending   | pending        | pending  |
| zoom    | 1440     | pending          | pending       | pending       | pending     | pending       | pending    | pending       | pending        | pending   | pending        | pending  |
| clickup | 1440     | pending          | pending       | pending       | pending     | pending       | pending    | pending       | pending        | pending   | pending        | pending  |
| webflow | 1440     | pending          | pending       | pending       | pending     | pending       | pending    | pending       | pending        | pending   | pending        | pending  |
| webflow | 375      | pending          | pending       | pending       | pending     | pending       | pending    | pending       | pending        | pending   | pending        | pending  |

Column sources: Height is `rendererHeightInViewports`; Plans visible `firstViewport.planCardsVisible`;
Price and CTA `firstViewport.firstPriceVisible` and `firstCtaVisible`; Sticky `stickyHeader` and
`stickyFirstColumn`; Cards per row `planCardsPerRow`; Add-on heights `addOnCardHeights`; Truncated
`truncatedTexts.count`; Awkward breaks `awkwardBreaks.count`; Contrast `contrastViolations` (extremes
only).

## 7. Limits of this phase

- Workers have no Chromium. No page height, screenshot or contrast result was seen by the author;
  all of section 4 is read from code and CSS, not from a rendering.
- Captures exist only through CI; the heights of section 6 are pending.
- The spec's heuristics are unverified: `stickyHeader` reads computed position only; the
  `awkwardBreaks` word walker skips words with hyphens or slashes and stops at 6000 words;
  `truncatedTexts` counts any clipped element; the first-viewport tests use `bottom <= viewport
height`, which is strict for tall cards.
- The "header never sticks" finding (4.1) follows from the CSS box model and must be confirmed with
  the scroll-based check before work starts.
- The figures in 2.3 are sums of the `metrics.md` table; `metrics.json` holds the same data per
  pricing but was only checked for the summary block, the group list of ClickUp and the totals.
- Effort figures are estimates and thresholds are proposals for the owner.
