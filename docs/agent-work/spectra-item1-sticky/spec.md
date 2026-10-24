# Sticky plan header and compact total (SPECTRA item 1)

Source: `docs/agent-work/visual-review-spectra/report.md` section 4.1. Approved by the owner
(CRP `crp-spectra-phase2-improvements`, all recommended). No new attribute and no public API.

## Problem

`thead th` is `position: sticky` but `.pr-table-scroll` had `overflow: auto` and no height limit, so
it never scrolled vertically and the header left the viewport with the page
(`stickyHeaderEffective` was 0 in every table layout in CI). The total came after the whole
comparison.

## Requirements

### `req~sticky-table-scroll~1`

The comparison table box (`.pr-table-scroll`) SHALL have `max-block-size: 80dvh`, with `80vh` as the
fallback declared first, so a table taller than that scrolls vertically inside the box and its
header cells (`thead th`, `inset-block-start: 0`) stay at the top of the box.

- The first column stays `position: sticky` at `inset-inline-start: 0` (unchanged).
- The card layout (container width under 840px, 375px viewport) renders no table and is unchanged.
- Horizontal scrolling of the box is unchanged (`overflow: auto`).

Scenario: Given a table layout with 20 or more rows, When the box is scrolled to the middle and
brought into view, Then the top of the first header cell is within 2px of the box top plus its
border and `inset-block-start`.

### `req~sticky-summary-position~1`

WHEN the pricing has no add-ons AND a plan is selected AND the layout is the table layout (container
at least 840px), the renderer SHALL render the summary (`data-pr-part="summary"`) before the
comparison section, as the first child of a `.pr-flow` column that holds the summary, the comparison
and the add-ons. In every other case the summary keeps its place: with add-ons inside the add-on
layout (rendered by `renderAddOns`); otherwise (no plan selected, or the compact layout) last, as a
direct child of the content after `.pr-flow`, so the mobile bottom bar still sticks to the viewport.

- The container must really be at least 840px wide: with `layout="table"` in a narrower container
  the summary stays last (bottom bar). `renderAfterPlans(state, wide)` takes the width flag from the
  element (`_wide`, set in `_updateCompactLayout`), because `RenderState` lives in `renderers.ts`
  and is not changed here; a field there would be the cleaner home.
- The summary is rendered exactly once in all cases (one live region, one breakdown id).
- An empty `.pr-flow` is hidden (`.pr-flow:empty { display: none }`).
- `.pr-flow` is a flex column (not a grid), so the sticky summary has the whole column as its
  containing block.

### `req~sticky-summary-compact~1`

WHEN the container is at least 840px wide, the summary directly inside `.pr-flow` SHALL be compact
(label and total on one line, reduced block padding) and sticky at the top
(`inset-block-start: var(--pr-space-4)`, existing rule). Below 840px the existing bottom sticky bar
(`inset-block-end`) is unchanged, also in `layout="table"` below 840px. The breakdown toggle keeps
its 44px target.

While the summary is docked, `.pr-flow` sets `--pr-docked-summary-offset` (space-4 + 4.5rem +
space-2) and the sticky comparison toolbar (`.pr-comparison-toolbar`) uses it as its
`inset-block-start`, so it sticks right below the summary instead of under it; the toolbar and the
table box get a matching `scroll-margin-block-start` so a focused control is not hidden. Without a
docked summary the offset is `0px`. The 4.5rem is an estimate of the one-line summary height.

## Measurable criteria

- `stickyHeaderEffective` is never `false` in a table layout: `tests/browser/spectra-review.spec.ts`,
  every fixture and viewport.
- `stickyHeaderEffective` is `true` when 20 or more rows are rendered: same test, 2px tolerance,
  scroll-based on the box.
- Summary before the comparison without add-ons and with a plan: `tests/unit/summary-position.test.ts`
  (rendered template order).
- Summary once, after the comparison, with add-ons, without a plan or in the compact layout: same
  test.
- The header is not covered: `stickyHeaderEffective` also requires the topmost element at the header
  center to be the header (the box is brought in below the docked summary).
- Narrow container with `layout="table"`: unit test (summary last) and browser test at 600px.
- Docked summary sticky at `--pr-space-4` on one line at 1440, bottom bar at 600 (table) and 375:
  `tests/browser/spectra-review.spec.ts`, `[utest->req~sticky-summary-compact~1]`.
- The toolbar search input is the topmost element at its centre (`toolbarInputReachable`).
- Page horizontal overflow stays absent: existing `horizontalOverflow` metric.

## Out of scope and known limit

`renderAddOns` (in `src/element/renderers.ts`, owned by another task) renders the summary inside the
add-on layout. With add-ons the total therefore stays there (sticky in the add-on column from 840px,
bottom bar below). Moving it near the plans for pricings with add-ons needs `renderAddOns` to stop
rendering it; that is a followup. Also, the docked summary is sticky over the page: if the page is
scrolled so the top of the table box passes under it, it covers the top of the box (the header is
visible again once the box top is below the summary). A design follow-up, not measured here. The browser check cannot run in the worker environment; CI
verifies it.
