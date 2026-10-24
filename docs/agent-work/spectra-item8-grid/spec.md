# Item 8: balanced plan grid and the first CTA in the first screen

Change: crp-spectra-phase2-improvements (default look change approved by the owner). Source:
`docs/agent-work/visual-review-spectra/report.md` sections 3, 4.8, 6.2 and 6.3.

## Problem

From 840px the plan grid is `repeat(auto-fit, minmax(220px, 320px))`. The number of repetitions of
`auto-fit` uses the 320px maximum, so every card is exactly 320px wide and the column count follows
the width only:

- the last row often holds a single card: every 3-plan pricing at 1024 (2+1), 4 plans at 1440
  (3+1), 5 plans at 1024 (2+2+1), Webflow (15 plans) at 1024 (2x7+1);
- the grid never fills the width (3 cards of 320px in a container of about 1378px at 1440);
- the first plan CTA is below the first screen at 1440x900 for shopify, tableau, trello,
  trustmary, userguiding, webflow, wrike and zoom, because the cards are tall.

## Non-goals

- No compact plan density mode, no new attribute, property, event or CSS part.
- No line clamp of plan descriptions.
- No change below 600px (one column) and no change of the 44px targets or of colors.
- Add-on, variable and comparison layouts are unchanged.

## Definitions

- Container width: the inline size of the `<pricing-renderer>` element, which is the CSS container
  `pricing-renderer`. The shell padding is `clamp(1rem, 4cqi, 3rem)`, so up to 48px per side. In the
  demo page the container is about 990px at a 1024px viewport and about 1378px at 1440px.
- Plan count: the number of `.pr-plan-card` elements, which are the direct children of
  `div.pr-plan-grid`.
- Lone last card: the last grid row holds one card while the grid has more than one row.

## Bands

| Container width | Columns                                   |
| --------------- | ----------------------------------------- |
| below 600px     | 1                                         |
| 600-839px       | 2 fluid, exempt from the lone card rule   |
| 840-1039px      | at most 3, chosen by plan count (table)   |
| 1040-1279px     | at most 4, chosen by plan count (table)   |
| 1280px and up   | at most 4 (lowered from 5, see below)     |
| 1 or 2 plans    | centered cards of at most 320px, as today |

Column choice for 3 to 16 plans and a band maximum M: among 1..min(M, plans) columns, discard the
counts that leave a lone last card; then take the fewest rows, then the fullest last row, then the
most columns. When every count leaves a lone last card the rule is waived and the fewest rows win
(exempt: 7 and 13 plans at 840-1039, 13 plans at 1040-1279 and at 1280 and up).

Why at most 4 from 1280px: at 1440 the demo container gives 1282px of content. Five columns would
make cards about 243px wide (4 columns about 308px, today 320px). Narrower cards wrap their name,
description and highlights on more lines, so the first card of the 5-plan pricings (wrike, zoom) and
of Webflow would be taller than today, which works against the CTA criterion (AC6) for exactly the
pricings that fail it. With 4 columns and the card padding lowered to 16px, the inner width of a card
is about 276px at 1440 (today 272px); 3-plan and 5-plan grids get wider cards (about 416px). At 1024
the 3-column cards are about 293px wide instead of 320px (inner width about 261px, today 272px), so
their text can take a few more lines there; 1024 is measured, not gated. The 1280px block stays, with
the same rules as 1040-1279, so that raising its maximum is a local change once the CTA holds with
narrower cards.

## Column table

Columns (rows) per band; `+1` marks an exempt lone last card.

| Plans | 600-839   | 840-1039  | 1040-1279 | 1280 and up |
| ----- | --------- | --------- | --------- | ----------- |
| 3     | 2 (2+1)   | 3 (3)     | 3 (3)     | 3 (3)       |
| 4     | 2 (2+2)   | 2 (2+2)   | 4 (4)     | 4 (4)       |
| 5     | 2 (2+2+1) | 3 (3+2)   | 3 (3+2)   | 3 (3+2)     |
| 6     | 2 (2+2+2) | 3 (3+3)   | 3 (3+3)   | 3 (3+3)     |
| 7     | 2 (2x3+1) | 3 (3+3+1) | 4 (4+3)   | 4 (4+3)     |
| 8     | 2 (2x4)   | 3 (3+3+2) | 4 (4+4)   | 4 (4+4)     |
| 9     | 2 (2x4+1) | 3 (3x3)   | 3 (3x3)   | 3 (3x3)     |
| 10    | 2 (2x5)   | 2 (2x5)   | 4 (4+4+2) | 4 (4+4+2)   |
| 11    | 2 (2x5+1) | 3 (3x3+2) | 4 (4+4+3) | 4 (4+4+3)   |
| 12    | 2 (2x6)   | 3 (3x4)   | 4 (4x3)   | 4 (4x3)     |
| 13    | 2 (2x6+1) | 3 (3x4+1) | 4 (4x3+1) | 4 (4x3+1)   |
| 14    | 2 (2x7)   | 3 (3x4+2) | 4 (4x3+2) | 4 (4x3+2)   |
| 15    | 2 (2x7+1) | 3 (3x5)   | 4 (4x3+3) | 4 (4x3+3)   |
| 16    | 2 (2x8)   | 2 (2x8)   | 4 (4x4)   | 4 (4x4)     |
| 17+   | 2         | 3         | 4         | 4           |

## CSS approach

- Tracks are fluid: `repeat(C, minmax(0, 1fr))`.
- In each band a generic `.pr-plan-grid` rule sets the band maximum. Plan counts that need fewer
  columns follow it with `.pr-plan-grid:where(:has(> :nth-child(N):last-child))`: a grid whose N-th
  child is also its last child has exactly N children. `:where()` keeps these rules at the
  specificity of the generic rule, so the later rule wins inside a band, and the generic rule of a
  wider band, which comes later in the file, overrides the count rules of narrower bands.
- The 1-2 plan rule, `.pr-plan-grid:not(:has(> :nth-child(3)))` (no third child), is more specific
  than all of them and keeps today's tracks: `repeat(2, minmax(0, 320px))` centered from 600px and
  `repeat(auto-fit, minmax(220px, 320px))` from 840px (`auto-fit` counts its repetitions with the
  320px maximum, so it would give a single column below a content width of 656px).
- First screen levers, from 840px only (below 840px nothing changes): the plan card padding, the
  highlight list gap and the levers L1 to L7 below.
- L1 and L2 cap public tokens instead of replacing them: `.pr-content` gets
  `padding-block-start: min(var(--pr-shell-padding), var(--pr-space-4))` and
  `gap: min(var(--pr-space-section), var(--pr-space-5))`, so a theme with smaller
  `--pr-shell-padding` or `--pr-space-section` values still gets them, and no value is larger than
  16px and 24px. The default theme (`clamp(1rem, 4cqi, 3rem)`, `clamp(3rem, 8cqi, 6rem)`) and the
  demo page (`clamp(1rem, 3.2vw, 3rem)`, `clamp(2.5rem, 5vw, 4.5rem)`) never go below 16px and 40px,
  so both get exactly 16px and 24px from 840px.
- The capped row gap applies to every row of `.pr-content` above the plans, not only to the hero
  and the billing switch: the diagnostics panel, the catalog metadata section and the variables
  configurator, when rendered, are also separated by at most 24px from 840px.
- The space after the plans stays `--pr-space-section`: the blocks after the plans section get
  `margin-block-start: calc(var(--pr-space-section) - min(var(--pr-space-section), var(--pr-space-5)))`,
  which adds back what the capped row gap removes (the gap plus the margin is
  `var(--pr-space-section)` for any token value).

### First CTA arithmetic at 1440x900

The authoritative evidence is the AC6 gate in CI, not this arithmetic. On head 0041212 the gate
failed for three fixtures, with the first CTA bottom (renderer scrolled to the top of the
viewport) at shopify 917.52 (miss 17.5), zenhub 955.71 (miss 55.7) and zoom 963.71 (miss 63.7); on
head 2094942, with the levers below, the gate passes for every fixture with plans.

Values before this change (develop b45d7b5, the base rules of `base.css` that still apply below
840px) and from 840px after it, at 1440 in the demo page (container about 1378px, so `8cqi` is
about 110px and the `clamp()` maximums apply; `--pr-shell-padding` is 46.08px and
`--pr-space-section` 72px there):

- L1: `.pr-content` padding-block-start, `--pr-shell-padding` (46.08px) capped at `--pr-space-4`
  (16px): saves about 30.
- L2: `.pr-content` row gap, `--pr-space-section` (72px) capped at `--pr-space-5` (24px), two gaps
  above the plans (hero to billing, billing to plans): about 2 x 48 = 96.
- L3: `.pr-hero__title` font size (line-height 1.02 kept), `clamp(2rem, 8cqi, 4rem)` (64px) to
  `clamp(2rem, 8cqi, 3rem)` (48px): about 16.3 per title line.
- L4: plans section heading margin-block-end, `--pr-space-5` (24px) to `--pr-space-3` (12px): 12.
- L5: plan card `.pr-price` padding-block `--pr-space-5` (24px) to `--pr-space-2` (8px) and
  min-block-size 4.5rem (72px) to 4rem (64px): the box goes from 96 to 64, about 32.
- L6: `.pr-highlight-list` margin-block-end, `--pr-space-5` (24px) to `--pr-space-3` (12px): 12.
- L7: `.pr-plan-card__top h4` margin-block-start, `--pr-space-3` (12px) to `--pr-space-2` (8px): 4.
- Plan card padding, `--pr-space-5` (24px) to `--pr-space-4` (16px): 8 on the top side.
- Highlight list gap, `--pr-space-3` (12px) to `--pr-space-2` (8px): 4 per pair of highlights.

Against develop the estimate is about 210 px plus 4px per highlight gap for a one-line title. The
price box was 96px tall on develop (a 48px amount line plus 2 x 24px padding, above the 72px
minimum) and is 64px (48px plus 2 x 8px, the new minimum, so prices stay aligned across cards).
L5 to L7, the card padding and the highlight gaps are inside every card, so the grid row (the
tallest card sets it; the CTA sits at the bottom of the card with `margin-block-start: auto`) gets
shorter by the same amount. The billing fieldset, the eyebrows, the h3 and the 44px minimum of the
CTA and of the selection controls are unchanged, and no color changes.

Head 0041212 was an intermediate state of this change, already measured with some levers: its CI
layout breakdown shows a 16px card padding, 40px row gaps and a 72px price box (12px padding) for
the three failing fixtures (content padding about 46, `header.pr-hero` 189 tall,
`fieldset.pr-billing` 83, zenhub and zoom 92, plans section at 398, zenhub and zoom 408). Those
intermediate values come from the breakdown, not from code. From there the remaining levers save
an estimated 30 (L1) + 32 (L2, 40 to 24 twice) + 16.3 (L3) + 12 (L4) + 8 (L5) + 4 (L6, 16 to 12) +
4 (L7) = 106.3, which put the expected CTA bottoms at about 811 (shopify), 849 (zenhub) and 857
(zoom). These are estimates; the gate (AC6) stays at 900px and is what decides.

## Acceptance criteria

- AC1: `base.css` has `@container pricing-renderer (min-width: 840px)`, `(min-width: 1040px)` and
  `(min-width: 1280px)` blocks for the plan grid, besides the 600px block.
- AC2: no plan grid rule that can apply to 3 or more plans uses a fixed 320px track; cards are at
  least 220px wide in containers of 600px and more (`planCardWidths.min >= 220` at 1440 and 1024).
- AC3: below 600px the plan grid has one column; from 600 to 839px it is
  `repeat(2, minmax(0, 1fr))` for every plan count of 3 and more.
- AC4: for 3 to 16 plans each band uses `repeat(C, minmax(0, 1fr))` with C from the column table;
  1 or 2 plans keep `repeat(2, minmax(0, 320px))` from 600px and
  `repeat(auto-fit, minmax(220px, 320px))` from 840px, centered, as before.
- AC5: at 1440x900, 1200x800 and 1024x768 `planCardsPerRow` equals the rows of the column table for
  the band of the measured container width (1280 and up at 1440, 1040-1279 at 1200 with a container
  of about 1166px, 840-1039 at 1024), and no pricing has a lone last card except the exempt counts.
- AC6: at 1440x900, after scrolling the renderer to the top of the viewport,
  `firstViewport.firstCtaVisible` is true for every pricing with plans (every fixture whose `plans`
  has at least one entry; okta has `plans: null`). At 1200x800 and 1024x768 the same flag is
  measured and printed only.
- AC7: at 1440x900, 1200x800 and 1024x768 no rendered element of the renderer ends right of (or
  starts left of) the renderer box by more than 1px, except inside `.pr-table-scroll` and other
  scroll containers.
- AC8: selection controls and CTAs keep a block size of at least 44px; colors are unchanged.

## Tests

| Test                                   | Criteria     | Notes                                                                  |
| -------------------------------------- | ------------ | ---------------------------------------------------------------------- |
| `tests/unit/plan-grid-columns.test.ts` | AC1-AC4      | Reads `base.css` as text, checks the column table of this file         |
| `tests/browser/spectra-grid.spec.ts`   | AC2, AC5-AC8 | Chromium, fixtures with plans, 1440/1200/1024, one `SPECTRA_GRID` line |

The bands, `expectedColumns`, the expected rows and the exempt counts live in
`tests/browser/helpers/plan-columns.ts`, a module without imports that both tests load
(`tests/browser/helpers/spectra.ts` imports `@playwright/test`, which vitest cannot load); the unit
test checks `expectedColumns` against the table above. The unit test evaluates the cascade of the
plan grid rules itself and fails, instead of guessing, when a plan grid rule sits outside the
`@layer pricing-renderer` block and its `@container pricing-renderer (min-width: Npx)` blocks (for
example in `@media`, `@supports`, a second `@layer` or another `@container` prelude) or when a
`grid` or `grid-template` shorthand is declared on a plan grid selector.

## Before and after

Before: `docs/agent-work/visual-review-spectra/report.md` sections 6.2 (cards per row, fixed 320px
tracks) and 6.3 (first CTA with the pricing at the top of the viewport). After: rows are the column
table values for the band of the measured container (1280 and up at 1440, 840-1039 at 1024), which
the AC5 gate checks; the 1440 CTA is the AC6 gate of the `SPECTRA_GRID` test, and the 1024 CTA is
printed in CI only.

| Fixture     | Plans | 1440 rows before | 1440 rows after | 1440 CTA before | 1440 CTA after | 1024 rows before | 1024 rows after | 1024 CTA before | 1024 CTA after           |
| ----------- | ----- | ---------------- | --------------- | --------------- | -------------- | ---------------- | --------------- | --------------- | ------------------------ |
| shopify     | 3     | 3                | 3               | hidden          | visible (gate) | 2+1              | 3               | hidden          | printed in CI, not gated |
| tableau     | 3     | 3                | 3               | hidden          | visible (gate) | 2+1              | 3               | hidden          | printed in CI, not gated |
| userguiding | 3     | 3                | 3               | hidden          | visible (gate) | 2+1              | 3               | hidden          | printed in CI, not gated |
| trello      | 4     | 3+1              | 4               | hidden          | visible (gate) | 2+2              | 2+2             | hidden          | printed in CI, not gated |
| trustmary   | 4     | 3+1              | 4               | hidden          | visible (gate) | 2+2              | 2+2             | hidden          | printed in CI, not gated |
| wrike       | 5     | 3+2              | 3+2             | hidden          | visible (gate) | 2+2+1            | 3+2             | hidden          | printed in CI, not gated |
| zoom        | 5     | 3+2              | 3+2             | hidden          | visible (gate) | 2+2+1            | 3+2             | hidden          | printed in CI, not gated |
| figma       | 6     | 3+3              | 3+3             | visible         | visible (gate) | 2+2+2            | 3+3             | visible         | printed in CI, not gated |
| webflow     | 15    | 3x5              | 4x3+3           | hidden          | visible (gate) | 2x7+1            | 3x5             | hidden          | printed in CI, not gated |

The report gives the 4-plan rows at 1440 as 3+1 for trello and trustmary (seen in the log) and the
other rows by plan count. On head 0041212, before the remaining "First CTA arithmetic" levers, the
1440 CTA gate failed for shopify (first CTA bottom 917.52, miss 17.5), zoom (963.71, miss 63.7) and
zenhub (955.71, miss 55.7; not in this table); the other fixtures passed. On head 2094942 every
spectra gate passes in Chromium, so "visible (gate)" is measured for every row. At 1200x800 the
rows follow the 1040-1279 band and the CTA is printed only.

## Snapshots

In `tests/browser/pricing-renderer.spec.ts-snapshots/` (the demo pricing has 3 plans). The plan
grids from 600px and the tighter cards and spacing from 840px changed the tablet and desktop
captures; the baselines were regenerated in a separate registered step from the stylesheet of head
2094942, and this change edits no PNG file.

The review fixes made after that (the capped padding and row gap, the hero cap and the
`minmax(0, 1fr)` columns of single-column grids) keep the rendered pixels of the demo page at 600,
839, 840, 1024, 1200 and 1440: from 840px `min(var(--pr-shell-padding), 16px)` and
`min(var(--pr-space-section), 24px)` evaluate to 16px and 24px, as the fixed values did, because
the demo minimums are 1rem and 2.5rem; the space after the plans stays `--pr-space-section`; and a
single `minmax(0, 1fr)` track has the same size as the single `auto` track it replaces whenever the
content fits the container, which it does in the demo (no overflow is measured).
