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
- First screen levers, from 840px only (below 840px nothing changes): plan card padding 24px to
  16px, highlight list gap 12px to 8px, and the levers L1 to L7 below. The space after the plans
  stays `--pr-space-section`: the blocks after the plans section get
  `margin-block-start: calc(var(--pr-space-section) - var(--pr-space-5))`, which adds back what the
  smaller row gap removes.

### First CTA arithmetic at 1440x900

Measured in CI on head 0041212, before the levers L1 to L7 below, with the renderer scrolled to
the top of the viewport: every fixture with plans passed the CTA gate except three, whose first CTA
bottom was below 900px: shopify 917.52 (miss 17.5), zenhub 955.71 (miss 55.7), zoom 963.71 (miss
63.7). Layout of the three (px from the renderer top): content padding about 46, `header.pr-hero`
189 tall, row gap 40, `fieldset.pr-billing` 83 (zenhub, zoom 92), row gap 40, plans section at 398
(zenhub, zoom 408), its heading (eyebrow, h3 and a 24px bottom margin) about 95, then the first
card: padding 16, top block 120 (zenhub 88), price 72, highlight list 152 plus its 16px margin and
the CTA 47 tall. The CTA bottom is about 493-500px below the section top.

Levers from 840px and what each saves at 1440 above the first CTA:

- L1: `.pr-content` padding-block-start from `--pr-shell-padding` (about 46px) to `--pr-space-4`
  (16px): 30.
- L2: `.pr-content` row gap from `clamp(2rem, 3cqi, 2.5rem)` (40px) to `--pr-space-5` (24px), two
  gaps above the plans (hero to billing, billing to plans): 32.
- L3: `.pr-hero__title` maximum font size from 4rem (64px) to 3rem (48px), line-height 1.02 kept:
  16.3 per title line (65.28 to 48.96).
- L4: margin-block-end of the plans section heading from `--pr-space-5` (24px) to `--pr-space-3`
  (12px): 12.
- L5: plan card `.pr-price` padding-block from `--pr-space-3` (12px) to `--pr-space-2` (8px) and
  min-block-size from 4.5rem (72px) to 4rem (64px): 8.
- L6: `.pr-highlight-list` margin-block-end from `--pr-space-4` (16px) to `--pr-space-3` (12px): 4.
- L7: plan name (`.pr-plan-card__top h4`) margin-block-start from `--pr-space-3` (12px) to
  `--pr-space-2` (8px): 4.
- Total: at least 30 + 32 + 16.3 + 12 + 8 + 4 + 4 = 106.3.

Notes on the levers:

- L5: with `box-sizing: border-box` the 72px minimum already holds a 48px amount line plus 2 x 12px
  padding, so lowering the padding alone would save nothing; the minimum goes down with it to keep
  prices aligned across cards (64px = 48px + 2 x 8px).
- L3 counts one title line; a title on two lines saves 32.6.
- L5 to L7 are inside every card, so the grid row (the tallest card sets it, and the CTA sits at the
  bottom of the card with `margin-block-start: auto`) gets shorter by the same 16px.
- The billing fieldset, the eyebrows, the h3 and the 44px minimum of the CTA and the selection
  controls are unchanged, and no color changes.

Expected first CTA bottom at 1440x900 (measured value minus 106.3): shopify about 811, zenhub about
849, zoom about 857, all at or below the 860px target, which leaves at least 40px for font
differences. The gate itself (AC6) stays at 900px.

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
other rows by plan count. On head 0041212, before the tightening of the "First CTA arithmetic"
levers, the 1440 CTA gate failed for shopify (first CTA bottom 917.52, miss 17.5), zoom (963.71,
miss 63.7) and zenhub (955.71, miss 55.7; not in this table); the other fixtures passed. "visible
(gate)" for shopify and zoom is what the gate requires after these levers, with the expected
bottoms of the arithmetic above; it holds once the browsers job passes on the new head.

## Snapshots expected to change

In `tests/browser/pricing-renderer.spec.ts-snapshots/` (the demo pricing has 3 plans). They are
updated only on purpose by a later registered step; this change does not edit PNG files.

- Plan grids from 840px (3 fluid columns instead of 320px cards, tighter cards and spacing):
  `table-840-linux.png`, `desktop-1024-linux.png`, `desktop-1200-linux.png`,
  `desktop-1440-linux.png` and the matching files without the `-linux` suffix.
- 600-839px (two fluid columns instead of two 320px tracks): `tablet-600-linux.png`,
  `tablet-839-linux.png`, `tablet-600.png`, `tablet-839.png`.
- Below 600px the grid is unchanged; `mobile-*` files change only if item 10 moves a line break.
