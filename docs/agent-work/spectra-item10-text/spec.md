# Item 10: short words are never split, long strings still wrap

Change: crp-spectra-phase2-improvements (default look change approved by the owner). Source:
`docs/agent-work/visual-review-spectra/report.md` sections 3, 4.10 and 6.5.

## Problem

`.pr-shell` declares `overflow-wrap: anywhere`, which every text of the renderer inherits. With
`anywhere` the min-content width of a text is one character, so table columns, grid tracks sized
`auto` and flex items shrink below the width of a word and the word is cut:

- "Unlimited" inside `span.pr-value` in mailchimp, microsoft365Business, salesforce, zoom and figma
  (figma at 375);
- "PROFESSIONAL" inside a `dt` of the compact comparison (github);
- 1 or 2 more in the `es` locale on okta, github and dropbox.

Truncated texts are 0 everywhere today and must stay 0.

## Non-goals

- No `hyphens: auto` (no automatic hyphenation in any language).
- No line clamp of descriptions, no "more" toggle.
- No change of colors, font sizes or of the comparison table structure.

## Approach

- `.pr-shell` declares `overflow-wrap: break-word`: a word is broken only when it does not fit on a
  line of its own, and the min-content width of a text keeps its longest word, so tracks and cells no
  longer shrink below a word.
- Containers whose items relied on `anywhere` to shrink get an explicit minimum instead:
  - single-column grids holding pricing text (`.pr-content`, `.pr-compact-comparison`,
    `.pr-feature-card` below 600px, `.pr-feature-card dl`, `.pr-highlight-list`, `.pr-hero`,
    `.pr-field`, `.pr-addon-layout` below 840px, `.pr-addon-card__details`, `.pr-addon-effects dl`,
    `.pr-breakdown`, `.pr-breakdown__lines`, `.pr-breakdown__totals`, `.pr-metadata dl`) use
    `grid-template-columns: minmax(0, 1fr)`, so a long string cannot widen them and the
    `min-inline-size: 0` of their flex rows' items lets it wrap; grids with explicit columns keep
    them;
  - the hero is centered with `margin-inline: auto`, so it is sized to its content: it gets
    `max-inline-size: min(760px, 100%)` and its items `max-inline-size: 100%` (the subtitle
    `min(62ch, 100%)`), so a title with a word longer than the line wraps inside the renderer at
    320 and 375 instead of widening the hero;
  - the label and value rows of the compact comparison (`dt` plan name, `dd` value) and of the plan
    highlights are wrapping flex rows: they share a line when both fit, else the value moves to the
    next line. The label has `flex: 1 1 0` and `max-inline-size: 100%`, so its automatic minimum is
    its longest word, capped at the row width; the value has `min-inline-size: 0`. A short word is
    split only if it is wider than the whole row, and a longer string wraps inside the row;
  - add-on effect rows and price breakdown totals wrap too, and the flex items holding values or
    names (add-on effects, price breakdown, price line) get `min-inline-size: 0`.
- Table cells keep `min-inline-size: 190px` (230-260px in the first column); a cell is never
  narrower than its longest word, and the table scrolls inside `.pr-table-scroll` when it gets wider.
  Accepted deviation: a 40+ character string without spaces inside a comparison table cell does not
  wrap; it widens its column inside the scroll box (no page overflow). Capping it would need a
  wrapper element in the cell, which is outside this CSS-only change.

## Selector contract (unit tested)

- `overflow-wrap: anywhere` (or `word-wrap: anywhere`) is not declared on `.pr-shell`, nor on any
  selector whose last compound names a value cell (`.pr-value`, `.pr-value--*`), `dt`, `dd`, `th`,
  `td` (also inside `:where()`, `:is()`, `:not()` or `:has()`), `.pr-comparison-table`,
  `.pr-feature-card`, `.pr-plan-card`, `.pr-content`, `.pr-flow`, the root element or `*`.
- The stylesheet still declares `overflow-wrap: break-word` or `anywhere` somewhere.
- No `hyphens: auto` and no `-webkit-hyphens: auto`.

## Acceptance criteria

- AC1: `awkwardBreaks.count` is 0 at 1440x900, 1024x768 and 375x812 for mailchimp,
  microsoft365Business, salesforce, zoom, figma and github, and for them `inspectedWords` is above 0
  (the measurement saw words; `cappedAtWordLimit` is printed only). For the other fixtures it is
  printed only.
- AC2: `truncatedTexts.count` is 0 for every fixture at the three viewports.
- AC3: a 64-character string without spaces placed in a value cell outside `.pr-table-scroll`
  (preferably in a plan card) and in a plan name outside it (the compact comparison `dt`, else the
  plan card heading) wraps on more than one line and stays inside its card and inside the renderer.
  The probes must find both for every fixture with plans; for a fixture without plans (okta,
  `plans: null`) a probe may find nothing, and a target it finds must wrap and stay inside too.
  Table cells are excluded (see the accepted deviation above).
- AC4: the selector contract above holds for every file of `src/styles/`.
- AC5: no rendered element of the renderer ends outside the renderer box by more than 1px, except
  inside `.pr-table-scroll` and other scroll containers, at the three viewports.
- AC6: contrast is unchanged (no color is changed by this item).
- AC7: at 375x812, with the text of the hero title (`h2` inside `[data-pr-part=hero]`) replaced by
  a 64-character string without spaces, the title wraps on more than one line and no rendered
  element of the renderer ends outside the renderer box by more than 1px (as in AC5).
- AC8: at 375x812, when an add-on effect value (`.pr-addon-effects dd`) or a price breakdown name
  (`.pr-breakdown__name`) is rendered in the default state of the fixture, the first one with its
  text replaced by a 64-character string without spaces wraps on more than one line and stays
  inside its add-on card or summary and inside the renderer. When none is rendered the check is
  skipped; the test opens no dialog, disclosure or toggle. With the current template both start
  hidden (the add-on effects are a closed `details`, the breakdown is closed until its toggle is
  pressed), so in CI this probe is skipped for every fixture today: AC8 is a guard for a future
  default-open state, not coverage of the `minmax(0, 1fr)` columns, which rest on the CSS reasoning
  above.

The AC7 and AC8 probes replace text in the rendered DOM, so they run last in the test, after the
AC3 probes.

## Tests

| Test                                   | Criteria     | Notes                                                        |
| -------------------------------------- | ------------ | ------------------------------------------------------------ |
| `tests/unit/plan-grid-columns.test.ts` | AC4          | Reads every file of `src/styles/` as text                    |
| `tests/browser/spectra-text.spec.ts`   | AC1-AC3, AC5 | Chromium, every fixture, prints one `SPECTRA_TEXT` JSON line |
| `tests/browser/spectra-text.spec.ts`   | AC7, AC8     | 375x812 only, last in the test; printed as `hero`, `detail`  |

## Before and after

Awkward breaks. Before: `docs/agent-work/visual-review-spectra/report.md` sections 4.10 and 6.5,
which name the split word but give the viewport only for figma (375). After: `awkwardBreaks.count`
from the `SPECTRA_TEXT` gate (AC1) in CI, where every awkward-break gate passed on head 0041212
and every spectra gate passes on head 2094942.

| Fixture              | Before (report)                  | 1440 after | 1024 after | 375 after |
| -------------------- | -------------------------------- | ---------- | ---------- | --------- |
| mailchimp            | split ("Unlimited")              | 0          | 0          | 0         |
| microsoft365Business | split ("Unlimited")              | 0          | 0          | 0         |
| salesforce           | split ("Unlimited")              | 0          | 0          | 0         |
| zoom                 | split ("Unlimited")              | 0          | 0          | 0         |
| figma                | split ("Unlimited") at 375       | 0          | 0          | 0         |
| github               | split ("PROFESSIONAL" in a `dt`) | 0          | 0          | 0         |

## Snapshots

The baselines in `tests/browser/pricing-renderer.spec.ts-snapshots/` were regenerated in a
separate registered step from the stylesheet of head 2094942 (no PNG is edited here). The hero cap
and the `minmax(0, 1fr)` columns added in review round 1 change nothing in the demo page: a single
`minmax(0, 1fr)` track has the size of the single `auto` track it replaces when the content fits,
and the hero caps only bind when the hero would be wider than the content box, which the demo
title never is.
