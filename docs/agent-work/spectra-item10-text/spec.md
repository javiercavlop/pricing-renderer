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
  - single-column grids (`.pr-content`, `.pr-compact-comparison`, `.pr-feature-card` below 600px,
    `.pr-feature-card dl`, `.pr-highlight-list`) use `grid-template-columns: minmax(0, 1fr)`, so a
    long string cannot widen them;
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
  microsoft365Business, salesforce, zoom, figma and github. For the other fixtures it is printed only.
- AC2: `truncatedTexts.count` is 0 for every fixture at the three viewports.
- AC3: a 64-character string without spaces placed in a value cell outside `.pr-table-scroll`
  (preferably in a plan card) and in a plan name outside it (the compact comparison `dt`, else the
  plan card heading) wraps on more than one line and stays inside its card and inside the renderer.
  The probes must find both for every fixture except okta (no plans). Table cells are excluded (see
  the accepted deviation above).
- AC4: the selector contract above holds for every file of `src/styles/`.
- AC5: no rendered element of the renderer ends outside the renderer box by more than 1px, except
  inside `.pr-table-scroll` and other scroll containers, at the three viewports.
- AC6: contrast is unchanged (no color is changed by this item).

## Tests

| Test                                   | Criteria     | Notes                                                        |
| -------------------------------------- | ------------ | ------------------------------------------------------------ |
| `tests/unit/plan-grid-columns.test.ts` | AC4          | Reads every file of `src/styles/` as text                    |
| `tests/browser/spectra-text.spec.ts`   | AC1-AC3, AC5 | Chromium, every fixture, prints one `SPECTRA_TEXT` JSON line |

## Before and after

Awkward breaks. Before: `docs/agent-work/visual-review-spectra/report.md` sections 4.10 and 6.5,
which name the split word but give the viewport only for figma (375). After: `awkwardBreaks.count`
from the `SPECTRA_TEXT` gate (AC1) in CI on head 0041212, where every awkward-break gate passed.

| Fixture              | Before (report)                  | 1440 after | 1024 after | 375 after |
| -------------------- | -------------------------------- | ---------- | ---------- | --------- |
| mailchimp            | split ("Unlimited")              | 0          | 0          | 0         |
| microsoft365Business | split ("Unlimited")              | 0          | 0          | 0         |
| salesforce           | split ("Unlimited")              | 0          | 0          | 0         |
| zoom                 | split ("Unlimited")              | 0          | 0          | 0         |
| figma                | split ("Unlimited") at 375       | 0          | 0          | 0         |
| github               | split ("PROFESSIONAL" in a `dt`) | 0          | 0          | 0         |

## Snapshots expected to change

In `tests/browser/pricing-renderer.spec.ts-snapshots/`, updated only on purpose by a later
registered step (no PNG is edited here). Any capture whose text broke inside a word or whose table
columns were squeezed can move: `table-840-linux.png`, `desktop-1024-linux.png`,
`desktop-1200-linux.png`, `desktop-1440-linux.png` (also changed by item 8) and possibly
`mobile-320-linux.png`, `mobile-375-linux.png`, `mobile-599-linux.png`, `tablet-600-linux.png`,
`tablet-839-linux.png` and the matching files without the `-linux` suffix.
