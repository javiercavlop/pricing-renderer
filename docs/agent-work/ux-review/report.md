# UX review of the Pricing Renderer: phase 1, part (c)

Scope: a measured baseline against measurable targets, a prioritised findings list, and each
improvement as a specified change proposal. Code references are to develop head `0896ab4` (this
worktree). Numbers marked "CI" come from the CI `browsers` job, check run 121647693964, line
`SPECTRA_UX_SUMMARY`. Every statement about code is cited as `file:line`; every statement that no
number backs is marked "unmeasured (from code)". All target values are proposals for the owner, not
decisions (section 6). Before and after screenshots are not part of this report.

Paths: `report.md` in `docs/agent-work/visual-review-spectra/` is called "the SPECTRA report";
`o1-remeasure.md` is in the same folder.

## 1. Summary

- Baseline: one CI run, 3 synthetic fixtures (okta, clickup, webflow) at 2 variants (1440 light `en`,
  375 dark `es`). The stress spec records and does not assert (`tests/browser/ux-stress.spec.ts:11-16`).
- At 1440 the layout works: balanced grid (clickup `[3,2]`, webflow `[4,4,4,3]`), effective sticky
  header, no overflow. Renderer height is 2.77, 4.13 and 6.93 viewports; webflow (15 plans) still has
  its first CTA below the fold at renderer top.
- 375 is the weak point: renderer height 5.73, 25.46 and 33.63 viewports; the first CTA is not
  visible for clickup and webflow, and the price is not for clickup. Real pricings agree
  (15.09 to 44.63 at 375, `o1-remeasure.md:57-63`), and the real webflow did not move after items 2 and 8.
- SPECTRA items 1 to 8, 10 and 11 are merged and are not re-proposed (section 3.0).
- Open findings by priority: P1 page length at narrow widths, P2 first-viewport CTA and price,
  P3 15 plans (table width, no selected column), P4 add-on marker ignores `availableFor`,
  P5 14 to 18 add-ons (disabled cards, total not measured), P6 plan and add-on descriptions,
  P7 unit plurals outside English, P8 measurement gaps.
- `loneLastCard` is true at 375 only because the grid has one column: a measurement artifact, fixed
  in the metric (test-only), not in the renderer.
- 11 proposals (UX-1 to UX-11): 3 are test-only (UX-1, UX-2, UX-10), 8 change the product; 6 need an
  owner CRP (UX-4, UX-5, UX-6, UX-7, UX-8, UX-11).
- Not measured by the stress spec: unit plurals, add-on marker, descriptions, add-on card heights,
  the total near add-ons, text breaks, contrast on the stress fixtures (section 2.5).

## 2. Measurable targets and baseline

### 2.1 Source and method

- Fixtures: `tests/fixtures/stress` builds 24 deterministic documents, 6 shapes x 2 currencies x 2
  billing periods (`tests/fixtures/stress/build.ts:136-149`). The spec runs 3 of them
  (`tests/browser/ux-stress.spec.ts:21`): `okta-usd-monthly`, `clickup-usd-monthly`,
  `webflow-eur-monthly`.
- Variants: 1440x900 light `en` and 375x812 dark `es` (`ux-stress.spec.ts:25-28`). Viewport, theme and
  locale change together, so the 1440 and 375 columns differ in three factors. Older data says dark
  gives identical heights and `es` adds 0.0 to 0.2 screens (SPECTRA report 6.1, `report.md:455-456`).
- "Renderer top" is the reading that matters: the page is scrolled so the renderer's top edge sits at the
  viewport top (`ux-stress.spec.ts:91-94`). At page top the demo chrome is above the renderer, so
  `pageTop` shows 0 plan cards in all six variants; that says nothing about the renderer (older data:
  1611 px of chrome above it at 1440 and 2273 to 2290 px at 375, SPECTRA report 6.1, `report.md:451-454`).
  A host page with a different header will differ; the target is a best case.
- Definitions used by the spec: a plan card is visible when it is sized and partly inside the viewport
  (`ux-stress.spec.ts:72-75`); the price and the CTA are the first `.pr-plan-card .pr-price` and the
  first `[data-pr-part="cta"]`, and each must be fully inside the viewport (`top >= 0`,
  `bottom <= viewport height`, `ux-stress.spec.ts:65-69,79-80`). Only the first card is checked.

### 2.2 Baseline numbers (CI browsers job, check run 121647693964, `SPECTRA_UX_SUMMARY`)

- okta-usd-monthly (0 plans, 140 features, 1 usage limit, 18 add-ons)
  - 1440: `documentHeightInViewports` 6.63, `rendererHeightInViewports` 2.77, comparison layout none,
    no plan cards, sticky n/a.
  - 375: document 12.06, renderer 5.73, comparison none.
- clickup-usd-monthly (5 plans, 136 features, 38 limits, 4 add-ons)
  - 1440: document 8.0, renderer 4.13. At renderer top 3 cards visible, price and CTA fully visible.
    Grid 3 columns, `cardsPerRow` `[3,2]`, `loneLastCard` false. Comparison table, sticky header true,
    first column true, header effective true, first column effective null (the table has no horizontal
    scroll).
  - 375: document 31.8, renderer 25.46. At renderer top 1 card visible, price not fully visible, CTA
    not visible. Grid 1 column, comparison rendered as cards, sticky null.
- webflow-eur-monthly (15 plans, 90 features, 12 limits, 8 add-ons)
  - 1440: document 10.79, renderer 6.93. At renderer top 4 cards visible, price visible, CTA not fully
    visible. Grid 4 columns, `cardsPerRow` `[4,4,4,3]`, `loneLastCard` false. Comparison table, sticky
    header and first column pinned and effective (both true).
  - 375: document 39.97, renderer 33.63. 1 card visible at renderer top, price visible, CTA not
    visible. 1 column, comparison as cards.
- All six variants: `pagePx` 0 and `rendererOverflowCount` 0.
- Contrast (real pricings, not the stress fixtures): the same CI log holds 32 `SPECTRA_METRICS` lines
  (webflow, salesforce, github, dropbox, figma and others, at 1440, 1024 and 375, light and dark, `en`
  and `es`), all with `contrastViolations` 0.

Derived from the numbers above (arithmetic, not new measurements):

- Document minus renderer is constant per width: 3.86, 3.87 and 3.86 viewports at 1440; 6.33, 6.34
  and 6.34 at 375. That is the demo page around the renderer, independent of the fixture, so the
  document height is not a usable target. The renderer height is.
- In pixels (viewport height x the rounded value, so each is "about", plus or minus 4.5 px): renderer
  about 2,493 / 3,717 / 6,237 px at 1440 (okta, clickup, webflow, x 900) and about 4,653 / 20,674 /
  27,308 px at 375 (x 812).

### 2.3 What the baseline is, and is not

- It is one CI run. There is no variance estimate: the fixtures are deterministic
  (`build.ts:3-6`) but one run cannot show render-to-render or runner-to-runner spread.
- It records and does not assert. The spec asserts only that the component renders, the height is a
  finite positive number and the plan card count is consistent (`ux-stress.spec.ts:228-241`).
- `loneLastCard` is `rows.length > 1 && last row === 1` (`ux-stress.spec.ts:223`). With one column every
  row has one card, so it is true at 375 for clickup and webflow. It is a measurement artifact, not a
  grid defect; the fix is `gridColumns > 1 &&` in the metric (UX-1).
- Stress texts are long on purpose, 100 to 250 characters for features, plans and add-ons
  (`tests/fixtures/stress/README.md:18-19`), so the heights are a stress case, not a typical pricing.
- A full baseline would still need: the other three shapes (zoom 4 plans and 143 features, salesforce 6
  plans and 14 add-ons, github 4 plans with a long plan name and 14 add-ons), the 12 annual variants,
  the EUR and USD variants of each shape, a 1024 width (the table layout in a container of about 990 px,
  `docs/agent-work/spectra-item8-grid/spec.md:28-29`), and the 1440 and 375 variants crossed with theme
  and locale. Today 3 of 24 fixtures and 2 variants are measured.

### 2.4 Targets

Values in the first column are proposals. "Met" is relative to those values. Details follow the table.

| ID  | Target                                  | Spec field                  | Baseline                    | Status      |
| --- | --------------------------------------- | --------------------------- | --------------------------- | ----------- |
| T1a | Plan, price, CTA at renderer top, 1440  | `firstViewport.rendererTop` | clickup yes; webflow no CTA | Not met     |
| T1b | Plan, price, CTA at renderer top, 375   | `firstViewport.rendererTop` | no CTA; clickup no price    | Not met     |
| T2a | Renderer height at most 3 (or 5), 1440  | `rendererHeightInViewports` | 2.77 / 4.13 / 6.93          | Not met     |
| T2b | Renderer height, 375 (no value decided) | `rendererHeightInViewports` | 5.73 / 25.46 / 33.63        | Not met     |
| T3  | Sticky plan header and first column     | `sticky.*Effective`         | 1440 true, 375 is cards     | Met at 1440 |
| T4  | No page scroll with 15 plans            | `horizontalScroll.*`        | 0 and 0, all six variants   | Met         |
| T5  | No lone last card when avoidable        | `planGrid.loneLastCard`     | 1440 false, 375 true        | Met at 1440 |
| T6  | AA contrast, text 4.5:1                 | `contrastViolations`        | 0 in 32 real-pricing lines  | Met         |
| T7  | AA contrast, UI 3:1                     | none                        | not measured                | Unmeasured  |

- T1a, T1b. Proposal: at renderer top, at least one plan card, the price and the CTA fully visible, at
  1440 and 375 (INTENT Q3 proposes keeping the CTA target at these two widths only,
  `INTENT.md:132-134`). Baseline: at 1440 clickup meets it (3 cards, price and CTA visible), webflow
  does not (4 cards, price visible, CTA not fully visible); okta has no plan card. At 375 clickup shows
  1 card with price and CTA not visible, webflow 1 card with the price visible and the CTA not. At
  page top no variant shows a plan (the chrome caveat, 2.1).
- T2a, T2b. The target is the renderer height, not the document height: the spec reports both
  (`ux-stress.spec.ts:86-87,146-147`) and the document includes the demo page. Candidates: at most 3
  (SPECTRA report 3, `report.md:83`) or at most 5 at 1440 (INTENT Q2 proposed answer,
  `INTENT.md:129-131`). At 1440 okta meets both, clickup meets 5 and not 3, webflow meets neither. At 375
  no fixture is at most 3 and none of the real pricings measured is either (`o1-remeasure.md:73`); no
  value is proposed here until UX-1 splits the height by section. The height is the collapsed default
  state: the stress spec does not open every group (the real-pricing spec does,
  `tests/browser/spectra-review.spec.ts:476-497`).
- T3. At 1440 both stress tables have an effective sticky header; the first column is effective on
  webflow and not measurable on clickup (no horizontal scroll). At 375 the comparison is cards, so
  there is no header to pin. CSS: `base.css:787-796` (scroll box with `80dvh` limit), `:813-828`.
- T4. 0 in all six. `rendererOverflowCount` leaves out everything inside a scroll or clip container,
  so the comparison table scroller is not counted (`tests/browser/helpers/spectra.ts:244-263`); the
  demo page also clips its root, so `pagePx` alone is weak evidence (`spectra.ts:245-246`).
- T5. At 1440 clickup `[3,2]` and webflow `[4,4,4,3]` are balanced. The 375 `true` is the artifact above.
  The column rules are in `src/styles/base.css:1298-1440` (table in
  `docs/agent-work/spectra-item8-grid/spec.md:61-80`); the stress shapes have 0, 4, 5, 6 and 15 plans,
  none of the exempt counts (7 and 13). The whole 600 to 839 px band is exempt from the lone-card rule
  (5 plans give 2+2+1 and 15 plans give 2x7+1, `spectra-item8-grid/spec.md:39,69,79`) and was not
  measured; T5 is "Met at 1440" only.
- T6. Cite as "measured by the SPECTRA contrast scan, real pricings, not the stress fixtures". The scan
  is `contrast()` in `tests/browser/spectra-review.spec.ts:352-365`: axe-core with only the
  `color-contrast` rule, scoped to `pricing-renderer`, run in the "spectra captures" test on the 8
  extreme pricings (`spectra-review.spec.ts:39-48,617-649`) at 1440, 1024 and 375 (light `en`, plus dark
  `en` and light `es` at 1440 and 375). The helper `tests/browser/helpers/spectra.ts` has no contrast code
  (it holds grid, overflow and text probes). It scans the default state only: no hover or focus, no
  open disclosure or dialog, no selected state beyond the default, and not the stress fixtures.
  `tests/browser/pricing-renderer.spec.ts:1969-1999` adds an axe scan of the open price breakdown.
- T7. The 3:1 target for UI components (borders of inputs, the checkmark, the focus ring) has no
  registered measurement: the `color-contrast` rule checks text. Existing evidence is by-rule
  computation for single components (`docs/agent-work/spectra-item6-addon-marker/spec.md:49-53`, the
  breakdown icon at `pricing-renderer.spec.ts:2002`). Unmeasured as a whole.

### 2.5 Not measured by the stress spec

Marked unmeasured (from code); each is closed by UX-1 or UX-2.

- Unit pluralisation: no unit text is read.
- The add-on marker and the em dash: no cell is counted.
- Empty or filler descriptions: not counted (the fixtures all carry long descriptions).
- Add-on card heights and the estimated total for the stress fixtures. Older and real-pricing data: the
  item 7 spec requires equal height per grid row, at most 1 px, asserted on 6 real pricings at 3 widths
  (`tests/browser/spectra-addon-grid.spec.ts:16-18,99`); no value is recorded here. The okta stress
  fixture has no plans and no comparison, so its renderer height holds the hero, the add-on section
  and the summary: about 2,493 px at 1440 and about 4,653 px at 375 is an upper bound for the whole add-on
  section (8 cards, the cap, `renderers.ts:80`).
- Add-on grouping with 14 to 18 add-ons.
- Text breaks and truncation: `measureText` exists (`spectra.ts:287-373`) and the stress spec does not
  call it. Older real-pricing data: 0 in all 111 `SPECTRA_TEXT` lines (`o1-remeasure.md:133-141`).
- The expanded-state height (`revealAllRows`, `spectra.ts:100-121`) and the 1024 width.

## 3. Findings

### 3.0 Already merged: not re-proposed

The SPECTRA report ranked 11 items (`report.md:108-121`). State per `ROADMAP.md:19-58` and the code:

- Item 1, sticky header: the scroll box has `max-block-size: 80dvh` (`base.css:787-796`); effective
  header true in CI (2.2).
- Item 2, shorter page: differences-only automatic above 100 rows with 2 plans or more and a toolbar
  (`renderers.ts:77,104-116`), counter `{shown} of {total}` (`renderers.ts:635-676`), empty state
  (`renderers.ts:876-879`).
- Items 3a and 3b, units: `formatUnit` with English plurals and the `unitLabels` override
  (`src/core/units.ts:56-94`). Spanish is still open (P7).
- Item 4, names for dependencies: `addOnNames` (`renderers.ts:126-130`).
- Item 5, Okta without plans: no comparison rows, `pricing.noComparison` (`renderers.ts:871-872`).
- Item 6, add-on marker: `renderers.ts:178-183`, `view-model.ts:556-569`.
- Item 7, add-on grid: dense cards above 8, filter above 13, cap 8 (`renderers.ts:76-81,1154-1237`).
- Items 8 and 10, grid and text: column table by plan count (`base.css:1298-1440`), `break-word`
  (`base.css:84-87`).
- Item 11, filler row descriptions: `rowDescription` (`renderers.ts:218-223`).
- Item 9, group by tags: not done, drop proposed (`INTENT.md:135-137`, Q4 open).

### 3.1 P1: page length at narrow widths (and webflow at 1440)

- Evidence: renderer height 5.73 / 25.46 / 33.63 viewports at 375, 2.77 / 4.13 / 6.93 at 1440 (2.2).
  Real pricings at 375: 15.09 to 44.63, none at most 3; the real webflow is 44.63 before and after items 2
  and 8 (`o1-remeasure.md:57-63`), so the narrow layout was not touched by the merged items.
- Cause, unmeasured (from code): below 840 px the comparison is the compact card layout
  (`pricing-renderer-element.ts:540-541`). Each row is one card with one definition line per plan
  (`renderers.ts:718-728`, `base.css:741-756`), up to 30 rows per group (`renderers.ts:618`), with the row
  description in full (`renderers.ts:708`). Plans stack one per row (`base.css:262-268`): 5 and 15
  cards. Clickup (136 + 38 = 174 rows) and webflow (90 + 12 = 102 rows) get differences-only
  automatically (`renderers.ts:104-116`). At load only the first comparison group is open
  (`pricing-renderer-element.ts:414,428-430`; `renderers.ts:627-633`), and the webflow stress groups
  are tagged with about 11 to 12 rows each (`tests/fixtures/stress/build.ts:74,214-223,359,385`); clickup
  is a single untagged group. How the height splits between plans, comparison and add-ons is not
  measured (UX-1), so no block is claimed to be the largest at 375.
- Metric it moves: `rendererHeightInViewports` at 375 (T2b), and the expanded-state height.

### 3.2 P2: first viewport, CTA and price

- Evidence: CTA not fully visible at renderer top for webflow at 1440 and for clickup and webflow at
  375; price not visible for clickup at 375 (2.2). Real pricings: the four measured at 1440 show the CTA,
  as in phase 1; webflow 1440 light `en` was not measured and the seven other pricings that failed in
  phase 1 were not re-measured (`o1-remeasure.md:87-103`).
- Cause, unmeasured (from code): the CTA is the last child of the plan card, after the status row (44 px
  minimum, `base.css:318-325`), name, description, price block (`base.css:443-450`), inheritance line
  and the highlight list (`renderers.ts:337-458`), and it is pushed to the card bottom
  (`base.css:530-533`). So its position depends on description and highlight length. The tighter spacing
  that item 8 introduced exists only from 840 px (`base.css:1318-1359`); below that the gap between blocks
  is the `--pr-space-section` value, 3rem or more (`theme.css:14`, `base.css:89-94`), and the hero
  and billing switch (44 px minimum, `base.css:232-241`) come first.
- Free diagnostics: `measurePlanGrid` already returns `firstCtaBottom` and a `layoutBreakdown` of what sits
  above the first card and inside it (`spectra.ts:134-141,212-221,235`); the stress spec calls it and
  prints neither (`ux-stress.spec.ts:190-225`).
- Metric it moves: T1a, T1b.

### 3.3 P3: readability with 15 plans, the grid and long texts

- Grid: resolved at 1440. 15 plans give 4 columns and `[4,4,4,3]`, 5 plans give 3 columns and `[3,2]`,
  no lone card (2.2, item 8 table). At 375 it is one column by design.
- Table: 15 plan columns have 190 px minimum each plus a 230 px first column
  (`base.css:805-821`): at least 3,080 px (computed from the CSS minimums) against a content width of
  about 1,282 px at 1440 (older figure, `spectra-item8-grid/spec.md:50-51`). Consistent with CI: the
  webflow first column is effective, so the table scrolls horizontally. About 5 plan columns are visible
  at once (computed, unmeasured). Nothing marks the selected plan's column: the header cell is
  `<th scope="col">${plan.name}</th>` (`renderers.ts:778`), so after scrolling the user cannot see which
  column is theirs (unmeasured (from code)).
- Cards: webflow at 1440 shows 4 cards at renderer top and the CTA is cut (2.2).
- Long texts: not measured on the stress fixtures (2.5). Older real-pricing data is clean (0 truncated,
  0 awkward breaks in 111 lines, `o1-remeasure.md:133-141`); `break-word` is in place
  (`base.css:84-87`).
- Metric it moves: `visiblePlanColumns` (new, UX-1), T1a.

### 3.4 P4: the "-" for features only an add-on gives

- Done by item 6: an add-on-only row shows a pill "Add-on" with the text "Available as add-on" for
  screen readers; every other empty cell keeps "—" with "Not included" (`renderers.ts:178-187`; i18n
  `i18n.ts:58-59,142-143`). The marker has visible text and a text alternative, so it does not rely on
  colour (`spectra-item6-addon-marker/spec.md:38-39`).
- Remaining, from code: `isAddOnOnlyRow` looks at the row and at all add-ons, not at the plan
  (`view-model.ts:560-569`), and ignores `availableFor` (`types.ts:123`). If every add-on that gives a row
  is available only for some plans, the cells of the other plans still read "Add-on". The fixtures can
  produce this: add-ons at index not divisible by 3 exclude the first plan (`build.ts:459`). The count of such
  cells is unmeasured (UX-2).
- Also by design, not a defect: a row some plans have and others lack, which an add-on gives, keeps "—"
  (`spectra-item6-addon-marker/spec.md:42-44`). Whether to extend the marker to those cells is an owner
  question (section 6).
- Metric it moves: cells that say "Add-on" where no providing add-on is available for the plan (UX-2).

### 3.5 P5: add-on card heights, the total, 14 to 18 add-ons

- Exists: dense cards above 8 add-ons, a search and a cap of 8 above 13, selected add-ons never hidden,
  an empty state, a live counter (`renderers.ts:1154-1237`). The model has no category for an add-on
  (`types.ts:118-133`), so a category or type grouping would have to be derived; not proposed.
- Total: in the right column and sticky from 840 px (`base.css:1361-1369`), a bottom bar below that
  (`base.css:1011-1024`), always inside `.pr-addon-layout` (`renderers.ts:1227-1233`), so by CSS it is in
  view while an add-on card is. Unmeasured for the stress fixtures (UX-1).
- Card height: equal per row is asserted on real pricings (2.5); the stress add-ons have 100 to 250
  character descriptions that stay in the card body (`renderers.ts:1049`). Unmeasured.
- Disabled cards, from code: the default selection is the first public plan
  (`src/core/resolve.ts:19-21`), and the fixtures exclude it for add-ons at index not divisible by 3
  (`build.ts:459`). At load that is 10 of 16 add-ons disabled in zoom, 9 of 14 in salesforce and github,
  5 of 8 in webflow (computed; okta has no plans so all are available). Disabled cards show "not
  available" and are greyed (`renderers.ts:1084-1087`, `base.css:911-914`) and still take cap slots.
  Real pricings differ; unmeasured.
- Metric it moves: add-on cards that are disabled among the cards rendered at load; summary visible
  while an add-on is in view (UX-1).

### 3.6 P6: empty or filler descriptions, long descriptions

- Rows: empty and name-equal descriptions are skipped (`renderers.ts:218-223`).
- Plans and add-ons: the description is rendered whenever it is non-empty
  (`renderers.ts:388,1049`), with no filler check, and the add-on search matches it
  (`renderers.ts:1166-1167`). How many real plan or add-on descriptions equal the name is unmeasured (UX-2).
- No clamp is proposed: the text probe counts a line clamp that clips as truncation
  (`spectra.ts:321-327`), and the item 10 goal is no truncation.

### 3.7 P7: unit plurals ("3 unit", "15 execution")

- Where built: `renderValue` calls `formatUnit(unit, value, locale, unitLabels)` for numeric cells
  (`renderers.ts:197-203`). The plural does not come from the pricing: the pricing supplies the singular
  `unit` string and the renderer pluralises it (`units.ts:65-94`).
- What it does: count 1 keeps the singular; other counts get an English plural only when the locale's base
  language is English and the unit is one lowercase word not ending in `s` (`units.ts:3-8,82,93`). A
  `unitLabels` entry wins (`units.ts:71-80`, documented at `docs/api-reference.md:177`).
- Remaining, from code: (a) any non-English UI locale leaves the unit as written
  (`units.ts:60-64,93`); in the 375 `es` stress variant the English units therefore read singular, for
  example "250 user" for the `user` unit (`build.ts:235`) where the 1440 `en` variant reads
  "250 users" (derived from the code, not printed by the spec); (b1) irregular lowercase nouns not ending
  in `s` get a wrong regular English plural ("person" becomes "persons", `units.ts:3-8,82`);
  (b2) only units ending in `s` (`class`) are left as written; (c) units with a slash, an uppercase letter or a digit are
  intentionally unchanged (`request/month`, `GB`).
- Why not add Spanish rules: units are written in the language of the pricing, not of the UI
  (`units.ts:60-62`). A Spanish rule keyed on the UI locale would corrupt an English unit shown in an
  `es` UI. INTENT Q5 leaves this open (`INTENT.md:137-138`); the supported path today is `unitLabels`.
- Metric it moves: units left singular for a count other than 1 (UX-2).

### 3.8 P8: measurement gaps

- The metric artifact (2.3), the non-asserting spec (2.3), no variance estimate, 3 of 24 fixtures, two
  confounded variants, no contrast on the stress fixtures, no 3:1 UI measurement (T7), no expanded
  height, no per-section heights. Addressed by UX-1, UX-2 and UX-10.

## 4. Change proposals

### 4.0 Conventions

- Each proposal is at most about 300 lines including tests.
- "PUBLIC API" is yes when the change adds or alters an attribute, property, event, `data-pr-part`
  hook, CSS variable, i18n key or exported type. Documented public surface: attributes and properties
  (`docs/api-reference.md:322-347`), part hooks (`docs/theming.md:82-95`), CSS variables
  (`docs/theming.md:26-63`), i18n keys (catalogs, `src/core/i18n.ts`; a missing key falls back to
  English, `i18n.ts:217`). Internal `pr-*` classes and markup nesting are not public
  (`docs/theming.md:95`, `README.md:405-407`).
- "NEEDS OWNER CRP" marks a change to the public API or a large change of the default look, which needs
  a change request to the owner before implementation: public API per `INTENT.md:106-107`, default look
  per the SPECTRA report (`report.md:100-101`).
- Visual baselines: the only `toHaveScreenshot` call is in `tests/browser/pricing-renderer.spec.ts`.
  A baseline moves only on purpose, through the registered update check, and is never accepted blind.
- Target values are proposals (section 6).

### UX-1 Stress spec: browser measurement extension

- Objective: give numbers to the unmeasured rows of 2.5 and to the diagnostics P1 and P2 need, and fix
  the `loneLastCard` artifact. The request listed the fix with the assertion proposal; it moves here
  because every later baseline needs the corrected flag, and UX-10 asserts it.
- Change: in `ux-stress.spec.ts`, (a) print `grid.firstCtaBottom`, `grid.cardWidths` and
  `grid.layoutBreakdown`, already collected (`tests/browser/helpers/spectra.ts:127-141,228-237`); (b) call `measureText`
  (`spectra.ts:287-373`); (c) record the height of the plans, comparison, add-ons and summary sections
  (`[data-pr-part]` hooks, `docs/theming.md:84-89`) in viewports; (d) add the expanded height with
  `revealAllRows` at both widths (`spectra.ts:100-121`); (e) per add-on grid row the height spread
  (the code of `spectra-addon-grid.spec.ts:40-54`), the cards rendered, the cards disabled, and whether
  `[data-pr-part="summary"]` intersects the viewport with the first, middle and last card scrolled in;
  (f) `visiblePlanColumns`: header cells fully inside the table scroller at `scrollLeft` 0; (g) an axe
  `color-contrast` scan as in `spectra-review.spec.ts:352-365` on each variant; (h) at 375 a second
  measurement with `layout="table"` (an existing attribute, `docs/api-reference.md:341`), to see what the
  scrolling table costs against the cards; (i) variants 1440 and 375 crossed with light `en` and dark `es`,
  plus 1024 light `en`; (j) all 6 shapes behind an environment variable, default stays the 3 fixtures;
  (k) `loneLastCard` becomes `gridColumns > 1 && rows.length > 1 && last === 1`, computed by a pure
  function in `tests/fixtures/stress/metrics.ts` so vitest can test it (the Playwright helper cannot be
  loaded by vitest, `spectra.ts:7-9`).
- Files: `tests/browser/ux-stress.spec.ts`, `tests/browser/helpers/spectra.ts` (small additions),
  `tests/fixtures/stress/metrics.ts` (new), `tests/unit/ux-stress-metrics.test.ts` (new),
  `tests/fixtures/stress/README.md`.
- Proof: the unit test of the pure function (1 column with 5 cards is not lone; 4 columns with
  `[4,4,4,1]` is); the browser spec prints the new fields in the `SPECTRA_UX_SUMMARY` line and still
  asserts only what holds today. CI time: the spec has a stated budget (`ux-stress.spec.ts:19-20`); the
  spec already records `elapsedMs`, so keep the default subset small.
- Metric: all rows of 2.5; T1 diagnostics; T3 `visiblePlanColumns`. Target: every new field present in
  the CI log of one run.
- Risk: low (test only). Size: about 250 lines. Depends on: nothing.
- PUBLIC API: no. DEFAULT LOOK: none. NEEDS OWNER CRP: no.

### UX-2 Unit-level counts on the 24 stress fixtures and the 37 real pricings

- Objective: numbers for P4, P6 and P7 without a browser.
- Change: a vitest file that builds each stress fixture (`buildStressPricing`,
  `tests/fixtures/stress/build.ts:477`) and each real fixture, normalises it and calls
  `createPricingViewModel`, then prints one `UX_COUNTS` JSON line per fixture: (a) numeric cells whose
  unit is a lowercase single word not ending in `s`, for `en`, count 0, 1 and 5, and how many come out
  unchanged for a count other than 1 (expected 0); the units left as written, by reason (slash, upper,
  digit, trailing `s`, non-English locale); (b) cells rendered with the add-on marker (as `isAddOnOnlyRow`
  decides) and, of those, how many have no providing add-on available for their plan; rows with a mix of
  empty and filled cells that an add-on provides (kept as "—" today); (c) rows with no description, rows
  filtered as filler, plan and add-on descriptions equal to the name, description length maximum and
  median; (d) add-ons disabled for the default plan.
- Files: `tests/unit/ux-counts.test.ts` (new). Reuses the fixture readers of
  `tests/unit/spectra-layout-metrics.test.ts` and `tests/unit/ux-stress-fixtures.test.ts`.
- Proof: invariants only (the counts of the stress shapes in `build.ts:39-123`, the unit rule for a
  table of units, the same row classification as `isAddOnOnlyRow`); the counts themselves are printed.
- Metric: marker cells that mislead (P4), filler descriptions (P6), singular units (P7). Target: numbers
  exist; they gate UX-7 and UX-9.
- Risk: low. Size: about 200 lines. Depends on: nothing.
- PUBLIC API: no. DEFAULT LOOK: none. NEEDS OWNER CRP: no.

### UX-3 Narrow top compaction

- Objective: take the above-the-plans compaction that item 8 applies from 840 px to narrower containers.
- Change: a new rule for container width below 840 px in `src/styles/base.css` that applies the caps of
  `base.css:1347-1359`: block gap `min(var(--pr-space-section), var(--pr-space-5))`, top padding
  `min(var(--pr-shell-padding), var(--pr-space-4))`, the margin after the plans adding back the
  difference, and the tighter heading margin (`base.css:1343-1345`). Because of `min()`, a host that
  sets smaller tokens still wins. No change inside the card. Expected saving from code: 24 px per gap
  above the plans at 375 (3rem becomes 1.5rem); unmeasured in a browser. Alone it moves the price into view
  only if it sits within about that margin of the fold; UX-1's `layoutBreakdown` says so.
- Files: `src/styles/base.css`; tests in `tests/unit` (a CSS contract test in the style of
  `tests/unit/plan-grid-columns.test.ts`) and `tests/browser/ux-stress.spec.ts`.
- Proof: CSS contract test for the rule and the host override; browser: `rendererTop.priceVisible`
  true for clickup 375 in the stress summary; visual baselines of narrow widths move on purpose.
- Metric: T1b price. Target: clickup 375 price fully visible.
- Risk: low. Size: about 60 lines. Depends on: UX-1 (to confirm it is enough).
- PUBLIC API: no (the documented tokens keep their meaning). DEFAULT LOOK: minor. NEEDS OWNER CRP: no.

### UX-4 CTA directly under the price, from 840 px

- Objective: make the first CTA independent of the description and highlight length.
- Change: for container 840 px and up, order the plan card as top block, price, CTA, inheritance line,
  highlights, with CSS only (the DOM is unchanged, `renderers.ts:337-458`). To keep the CTAs of one row
  aligned, the plan grid rows become subgrid tracks (`grid-template-rows: subgrid` on the card) instead
  of `margin-block-start: auto` (`base.css:530-533`). Where subgrid is unsupported the card falls back
  to the flex column with the CTA under the price (unaligned across a row). Keyboard order is
  unchanged: the CTA and the selection radio are the only focusable items and their DOM order is kept;
  the visual order differs only for non-interactive text.
- Files: `src/styles/base.css`; `tests/unit/plan-grid-columns.test.ts` style CSS contract; stress spec.
- Proof: stress summary `firstViewport.rendererTop.ctaVisible` true for webflow 1440; a browser check
  that the CTA tops of one grid row are within 1 px; visual baselines move on purpose.
- Metric: T1a. Target: webflow 1440 CTA fully visible. Gate: UX-1 `layoutBreakdown` must show the
  highlight list is a large part of the card height.
- Risk: medium (subgrid, hover `translate`, forced colors). Size: about 120 lines. Depends on: UX-1.
- PUBLIC API: no. DEFAULT LOOK: major (every plan card). NEEDS OWNER CRP: yes.

### UX-5 Narrow plan cards with the highlights closed

- Objective: shorten the stacked plan cards at narrow widths when there are many plans.
- Change: when `state.compact` is true and the pricing has 4 plans or more, render the plan card as
  top block, price, CTA, then the inheritance line and the highlight list inside a closed
  `<details class="pr-plan-details">` whose summary is the existing `pricing.moreDetails`
  (`i18n.ts:40,124`). `state.compact` (`renderers.ts:58`) is true below 840 px and also at any width
  when `layout="compact"` is set (`pricing-renderer-element.ts:540`; `docs/api-reference.md:341`), so
  the change applies in both cases. With `compact` false (a container of 840 px or more without
  `layout="compact"`), and below 4 plans, the markup is unchanged, so the demo pricing (3 plans) keeps
  its baselines. Accessibility: native disclosure, keyboard operable, state
  announced by the browser; the highlights are not exposed while closed, which removes information
  from the default reading (an owner decision). A click inside `details` or `summary` does not select
  the plan (`renderers.ts:132-138`).
- Files: `src/element/renderers.ts`, `src/styles/base.css`, `tests/unit` (render test: compact with 4
  plans has the details and the CTA before it; compact with 3 plans, and a non-compact render (840 px
  or more, no `layout="compact"`), match the old markup; a case for `layout="compact"` at a wide
  container; the way `req~addon-grid-no-look-change~1` is tested in `spectra-item7-addon-grid/spec.md:20-36`),
  `tests/browser/ux-stress.spec.ts`.
- Proof: unit render tests; stress summary heights and `ctaVisible` at 375.
- Metric: T2b and T1b. Target: no number decided; compare against UX-1's section heights. Expected
  effect, from code, is one highlight list per card removed from the 5 and 15 stacked cards
  (unmeasured).
- Risk: medium. Size: about 180 lines. Depends on: UX-1.
- PUBLIC API: no (an existing i18n key, a class not a part hook). DEFAULT LOOK: major at narrow widths.
  NEEDS OWNER CRP: yes.

### UX-6 Narrow comparison: smaller initial row cap

- Objective: cut the compact comparison without a new layout. Whether it is the largest block at 375 is
  not known until UX-1 measures the section heights.
- Change: when `state.compact` is true (below 840 px, and at any width with `layout="compact"`,
  `pricing-renderer-element.ts:540`; `docs/api-reference.md:341`) the initial cap per group is 10 rows
  instead of 30 (`renderers.ts:618`, a constant becomes a function of `compact`). "Show N more" reveals the rest as
  today (`renderers.ts:732-749`), the counter keeps counting rendered rows
  (`renderers.ts:627-633`), search and differences-only are unchanged. Before building it, UX-1's
  `layout="table"` measurement at 375 decides between this and showing the scrolling table at narrow
  widths; if the table is much shorter and its sticky header and column work, the owner may prefer it.
- Files: `src/element/renderers.ts`, `tests/unit/shorter-page.test.ts` (extend), stress spec.
- Proof: unit test that a compact render of a 40-row group shows 10 rows and the button reads "Show 30
  more", and that a table render (`compact` false) still shows 30; browser: `comparisonRows` rendered
  at 375.
- Metric: T2b. Target: set after UX-1. Expected effect per fixture, from code and unmeasured: only the
  first group is open at load, so the cap matters for the open group only. Webflow groups carry about 11
  to 12 rows each, so a cap of 10 removes about 0 to 2 rows there. Clickup is one untagged group with
  more than 30 rows, so 30 rows become 10, a third of the rows and about two thirds fewer (linear in
  rows). "A third" holds only for a single untagged group with 30 rows or more.
- Risk: medium (more clicks to see rows; the reveal helper clicks the button, `spectra.ts:100-121`).
  Size: about 90 lines. Depends on: UX-1.
- PUBLIC API: no. DEFAULT LOOK: major at narrow widths. NEEDS OWNER CRP: yes.

### UX-7 Add-on marker aware of `availableFor`

- Objective: a cell says "Add-on" only where an add-on that gives the row can be bought for that plan.
- Change: add `addOnProvidesForPlan(viewModel, row, planId)` in `src/core/view-model.ts` next to
  `isAddOnOnlyRow` (`view-model.ts:560-569`); not exported from `src/core/index.ts`, as item 6 requires
  (`spectra-item6-addon-marker/spec.md:45-47`). The row keeps the add-on-only test; each cell calls the new
  function with its plan, and cells that fail show "—" with "Not included". The availability rule is
  the one of `addOnAvailability` (`renderers.ts:889-893`) without the selection. Both call sites change
  (`renderers.ts:725,816`).
- Files: `src/core/view-model.ts`, `src/element/renderers.ts`, `tests/unit/addon-marker.test.ts`, a delta
  to `docs/agent-work/spectra-item6-addon-marker/spec.md` (R1, R3).
- Proof: unit test, a row given by an add-on available only for plan B in a 2-plan pricing: marker in
  B, "—" in A; the SPECTRA count of `spectra-item6-addon-marker/spec.md:54-60` still holds for the real
  fixtures where every add-on is unrestricted (if UX-2 shows otherwise the spec numbers change).
- Metric: misleading marker cells. Target: 0.
- Risk: low. Size: about 120 lines. Depends on: UX-2 (go if the count is above 0).
- PUBLIC API: no. DEFAULT LOOK: minor. NEEDS OWNER CRP: yes: it amends MUST R3 of the owner-approved
  item 6 (`spectra-item6-addon-marker/spec.md:32-37`; SPECTRA report `report.md:118`), so record the spec
  delta and ask the owner.

### UX-8 Add-on filter: only the selected plan

- Objective: with 14 to 18 add-ons, stop spending cap slots on disabled cards.
- Change: in filter mode (above 13 add-ons, `renderers.ts:1218`) add a checkbox to the add-on toolbar,
  built like the comparison checkbox (`renderers.ts:656-664`, class `pr-check`), labelled by a new key
  `pricing.onlyAvailableAddOns` (en "Only add-ons for the selected plan", es "Solo complementos del plan
  elegido"). Off by default. When on, add-ons for which `addOnAvailability` is false are not rendered;
  selected add-ons are never hidden (as `renderers.ts:1159-1173`); the live counter
  (`renderers.ts:1189`) reports the new count. Hidden when no plan is selected. State lives in the
  element and resets on a new load like `_addOnSearch`; the render-state fields follow the pattern of
  `renderers.ts:51-52,67-69`.
- Accessibility model: a native labelled checkbox in the existing toolbar, focus order search, checkbox,
  cards; the polite live region announces the new count; the empty state `addon-empty` is reused.
- Files: `src/element/renderers.ts`, `src/element/pricing-renderer-element.ts`, `src/core/i18n.ts`
  (en and es), `docs/api-reference.md` (add-on grid section, `:384-407`), tests in
  `tests/unit/addon-grid-filter.test.ts`.
- Proof: unit tests (en and es, selected add-on kept, counter, empty state, reset on reload); stress
  summary: disabled cards among rendered cards 0 with the checkbox on.
- Metric: disabled cards among the cards rendered at load (P5). Target: the option exists and the count
  is 0 when on; no default change.
- Risk: low. Size: about 150 lines. Depends on: UX-1 (to measure).
- PUBLIC API: yes (one i18n key; the render-state types are not exported, `src/element/index.ts:1-13`).
  DEFAULT LOOK: minor (a checkbox only in
  filter mode). NEEDS OWNER CRP: yes (new key; the owner may waive it as additive).

### UX-9 Filler descriptions for plans and add-ons

- Objective: apply the item 11 rule to the other two description sites.
- Change: extract the check of `rowDescription` (`renderers.ts:218-223`) into a helper used for the plan
  description (`renderers.ts:388`) and the add-on description (`renderers.ts:1049`, and the add-on search
  `:1166-1167` keeps matching the raw text). Case-insensitive, trimmed, equal to the name means hidden.
  No clamp.
- Files: `src/element/renderers.ts`; `tests/unit/row-descriptions.test.ts` (extend).
- Proof: unit test of a plan and an add-on whose description equals the name: no paragraph.
- Metric: filler descriptions rendered. Target: 0. Gate: UX-2 finds any.
- Risk: low. Size: about 60 lines. Depends on: UX-2.
- PUBLIC API: no. DEFAULT LOOK: minor. NEEDS OWNER CRP: no.

### UX-10 Stress spec asserts the targets

- Objective: turn the recorded targets into guards once they are met, so they cannot regress.
- Change: after UX-3 to UX-8 land and the owner has fixed the values, assert in `ux-stress.spec.ts`:
  T1a and T1b (`ctaVisible`, `priceVisible`, `planCardsVisible` at renderer top), T2 with a margin (the
  baseline has no variance estimate, so first collect at least 5 CI runs and set the margin from their
  spread), T3 (`headerEffective` not false), T4 (`pagePx` 0 and `rendererOverflowCount` 0), T5 (the
  corrected `loneLastCard` false) and `contrastViolations` 0 on the stress variants. Keep the targets
  that are not yet met as recorded numbers. Remove `subset` filtering for assertions that need all
  shapes only when UX-1's full set runs in CI.
- Files: `tests/browser/ux-stress.spec.ts`; `docs/agent-work/ux-review/` notes for the thresholds.
- Proof: the spec fails when a threshold is broken (mutate a CSS value locally and see it fail, not in CI).
- Metric: T1 to T6 asserted. Target: every asserted value equals the owner-approved threshold.
- Risk: medium (a flaky or tight threshold blocks every PR; the SPECTRA report already warns about the
  CI cost of this kind of spec, `report.md:592-594`). Size: about 150 lines.
  Depends on: UX-1 and the product proposals the owner accepts.
- PUBLIC API: no. DEFAULT LOOK: none. NEEDS OWNER CRP: no (the thresholds are an owner decision).

### UX-11 Mark the selected plan's column in the table

- Objective: with 15 plans the user can find their column after scrolling the table.
- Change: when a plan is selected, its header cell and its cells get a class (`is-selected-plan`) with
  an accent top border on the header and a faint tint on the cells, and the header cell holds a short
  visible label from the existing key `pricing.selected` (`renderers.ts:377`) next to the name. Not
  colour alone: the label is text and the border is a shape. The marker is also a screen reader cue
  because the label is text. No change to the compact layout, where each card lists plans by name.
  Pinning the column is not proposed: the first column width is not fixed (230 to 260 px,
  `base.css:813-821`), so a second sticky offset needs JavaScript.
- Files: `src/element/renderers.ts` (`renderTableComparison`, `renderers.ts:759-852`),
  `src/styles/base.css`, tests in `tests/unit` and the stress spec.
- Proof: unit render test (header of the selected plan has the label, others not; follows a selection
  change); stress `visiblePlanColumns` unchanged; visual baselines of table pricings move on purpose;
  contrast of the tint checked by the SPECTRA scan.
- Metric: a selected column is identifiable (new unit assertion). Target: true for every table render
  with a selected plan.
- Risk: low. Size: about 90 lines. Depends on: UX-1 (its `visiblePlanColumns` proof).
- PUBLIC API: no (class, existing key). DEFAULT LOOK: major (every table gets a marked column, because
  the default selection is the first public plan, `resolve.ts:19-21`, and every table baseline moves).
  NEEDS OWNER CRP: yes.

## 5. Suggested order

Measure first (UX-1, UX-2), then the cheap changes, then the ones that need a CRP, with the assertion
last. UX-3 and UX-9 and the test-only UX-1, UX-2 and UX-10 can start without a CRP; UX-4, UX-5, UX-6,
UX-7, UX-8 and UX-11 wait for the owner.
Send one CRP per proposal with the default it proposes, as the SPECTRA report did.

| Order | Proposal                               | Priority | Size       | Risk   | Owner CRP | Metric                       |
| ----- | -------------------------------------- | -------- | ---------- | ------ | --------- | ---------------------------- |
| 1     | UX-1 Browser measurement extension     | P8       | ~250 lines | Low    | No        | all unmeasured rows          |
| 2     | UX-2 Unit-level counts                 | P8       | ~200 lines | Low    | No        | marker, filler, unit counts  |
| 3     | UX-3 Narrow top compaction             | P2       | ~60 lines  | Low    | No        | T1b price                    |
| 4     | UX-7 Availability-aware marker         | P4       | ~120 lines | Low    | Yes       | misleading marker cells      |
| 5     | UX-9 Filler descriptions               | P6       | ~60 lines  | Low    | No        | filler descriptions          |
| 6     | UX-11 Selected plan column             | P3       | ~90 lines  | Low    | Yes       | selected column identifiable |
| 7     | UX-5 Narrow plan cards, details closed | P1       | ~180 lines | Medium | Yes       | T2b, T1b                     |
| 8     | UX-6 Narrow comparison, smaller cap    | P1       | ~90 lines  | Medium | Yes       | T2b                          |
| 9     | UX-4 CTA under the price from 840 px   | P2       | ~120 lines | Medium | Yes       | T1a                          |
| 10    | UX-8 Add-on filter, selected plan only | P5       | ~150 lines | Low    | Yes       | disabled cards at load       |
| 11    | UX-10 Stress spec asserts the targets  | P8       | ~150 lines | Medium | No        | T1 to T6 asserted            |

Dependencies: UX-3 to UX-6, UX-8 and UX-11 depend on UX-1 for their gate; UX-7 and UX-9 depend on UX-2;
UX-10 depends on UX-1 and on every product proposal the owner accepts.

## 6. Limitations and open questions

Limitations:

- One CI run, 3 of 24 fixtures, 2 variants, no variance (2.3). Nothing here was run by the author: the
  lab has no Playwright browsers; numbers come from the CI log lines given and from files.
- Real-pricing figures (`o1-remeasure.md`) are partial: 14 of 111 pairs and a different commit
  (`o1-remeasure.md:6-8`). They are used only as older context.
- Items marked "unmeasured (from code)" are readings of the CSS and templates, not measurements; the
  px and viewport estimates in 3.3 and 3.5 are arithmetic on CSS minimums and fixture rules.
- The stress add-on availability pattern (`build.ts:459`) is synthetic; real pricings may differ.
- The axe `color-contrast` rule covers text. The 3:1 UI target has no measurement (T7).

Thresholds that are proposals, not decisions (INTENT Q2 and Q3 are undecided, `INTENT.md:127-134`):

- Renderer height at most 3, or at most 5 at 1440 (Q2); no 375 value is proposed.
- First viewport shows plan, price and CTA at 1440 and 375 (Q3 proposes dropping 1024).
- No lone last card; contrast violations 0; the T3 and T4 guards.

Questions for the owner:

- Q-A. Which height target: at most 3 or at most 5 at 1440, and what for 375? The CRP proposals
  (UX-4, UX-5, UX-6) cannot be sized without it.
- Q-B. May narrow plan cards hide the highlights behind a disclosure (UX-5) and may the compact comparison
  show 10 rows first (UX-6)? Both remove information from the default reading.
- Q-C. Would the owner rather show the scrolling table at narrow widths than cards? UX-1 measures that
  option without code.
- Q-D. Should a row some plans lack and an add-on gives also show the "Add-on" marker? Item 6 R6 says no
  (`spectra-item6-addon-marker/spec.md:42-44`); UX-7 keeps that.
- Q-E. Spanish plurals (INTENT Q5): keep `unitLabels` as the only path, as this report recommends, or
  add a rule keyed to the pricing's language, which the model does not carry today? INTENT proposes a
  different answer to Q5, a roadmap goal at low priority (`INTENT.md:137-138`); this report's
  recommendation differs from it.
- Q-F. May the stress spec assert in CI (UX-10), given its cost and flakiness risk, or stay a
  report-only job?
- Q-G. A `plan-density` attribute was proposed in phase 1 (`report.md:345-348`) and excluded from item 8
  (`spectra-item8-grid/spec.md:20`). UX-4 and UX-5 avoid an attribute; does the owner want one?
