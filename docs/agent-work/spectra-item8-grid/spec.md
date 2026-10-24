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
- First screen levers, from 840px only: plan card padding 24px to 16px, price padding-block 24px to
  12px, highlight list gap 12px to 8px and its bottom margin 24px to 16px, and the gap between the
  blocks above the plans (hero, metadata, billing, variables) from `--pr-space-section` (96px at a
  1440px viewport) to `clamp(2rem, 3cqi, 2.5rem)` (40px there); the space after the plans is
  unchanged. Below 840px the cards keep today's spacing.

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
- AC5: at 1440x900 and 1024x768 `planCardsPerRow` equals the rows of the column table for the band of
  the measured container width, and no pricing has a lone last card except the exempt counts.
- AC6: at 1440x900, after scrolling the renderer to the top of the viewport,
  `firstViewport.firstCtaVisible` is true for every pricing with plans (all fixtures except okta).
  At 1024x768 the same flag is measured and printed only.
- AC7: at 1440x900 and 1024x768 no rendered element of the renderer ends right of (or starts left
  of) the renderer box by more than 1px, except inside `.pr-table-scroll` and other scroll
  containers.
- AC8: selection controls and CTAs keep a block size of at least 44px; colors are unchanged.

## Tests

| Test                                   | Criteria     | Notes                                                                    |
| -------------------------------------- | ------------ | ------------------------------------------------------------------------ |
| `tests/unit/plan-grid-columns.test.ts` | AC1-AC4      | Reads `base.css` as text, checks the column table of this file           |
| `tests/browser/spectra-grid.spec.ts`   | AC2, AC5-AC8 | Chromium, every fixture except okta, prints one `SPECTRA_GRID` JSON line |

`expectedColumns` is duplicated in both tests because `tests/browser/helpers/spectra.ts` imports
`@playwright/test` and cannot be loaded by vitest; the unit test checks it against the table above.

## Before and after

Filled from the `SPECTRA_GRID` lines of the CI run before and after this change.

| Fixture     | Plans | 1440 rows before | 1440 rows after | 1440 CTA before | 1440 CTA after | 1024 rows before | 1024 rows after | 1024 CTA before | 1024 CTA after |
| ----------- | ----- | ---------------- | --------------- | --------------- | -------------- | ---------------- | --------------- | --------------- | -------------- |
| shopify     | 3     |                  |                 |                 |                |                  |                 |                 |                |
| tableau     | 3     |                  |                 |                 |                |                  |                 |                 |                |
| userguiding | 3     |                  |                 |                 |                |                  |                 |                 |                |
| trello      | 4     |                  |                 |                 |                |                  |                 |                 |                |
| trustmary   | 4     |                  |                 |                 |                |                  |                 |                 |                |
| wrike       | 5     |                  |                 |                 |                |                  |                 |                 |                |
| zoom        | 5     |                  |                 |                 |                |                  |                 |                 |                |
| figma       | 6     |                  |                 |                 |                |                  |                 |                 |                |
| webflow     | 15    |                  |                 |                 |                |                  |                 |                 |                |

## Snapshots expected to change

In `tests/browser/pricing-renderer.spec.ts-snapshots/` (the demo pricing has 3 plans). They are
updated only on purpose by a later registered step; this change does not edit PNG files.

- Plan grids from 840px (3 fluid columns instead of 320px cards, tighter cards and spacing):
  `table-840-linux.png`, `desktop-1024-linux.png`, `desktop-1200-linux.png`,
  `desktop-1440-linux.png` and the matching files without the `-linux` suffix.
- 600-839px (two fluid columns instead of two 320px tracks): `tablet-600-linux.png`,
  `tablet-839-linux.png`, `tablet-600.png`, `tablet-839.png`.
- Below 600px the grid is unchanged; `mobile-*` files change only if item 10 moves a line break.
