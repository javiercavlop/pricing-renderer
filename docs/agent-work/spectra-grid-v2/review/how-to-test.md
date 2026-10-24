# How to test: balanced plan grid and text wrapping (PR #46)

Status of this guide: written from the specs
(`docs/agent-work/spectra-item8-grid/spec.md` and
`docs/agent-work/spectra-item10-text/spec.md`), `tests/unit/plan-grid-columns.test.ts`,
`tests/browser/spectra-grid.spec.ts` and `tests/browser/spectra-text.spec.ts`. The
author could not start a browser, so **no step below was run by the author**:
every step is `not verified by the author`. Each step names the tests that cover
it. Those tests ran in CI on heads `30928a5` and `6d3fefa`, both green: quality
22/24, audit, and the browser jobs. No images are included.

## Setup

```sh
pnpm install --frozen-lockfile
pnpm demo        # builds, then serves the vanilla demo at the printed address
```

Open the address that `pnpm demo` prints. The demo loads the acme fixture
(`tests/fixtures/acme-pricing.yml`), which has 3 plans. The renderer is the
`<pricing-renderer>` element in the section "Configure it like a customer
would".

Open the browser console and define the handle once per page load:

```js
const r = document.querySelector('pricing-renderer');
```

To load another pricing, set its YAML text and wait for the render. The demo
has no file picker, so paste the content of a fixture file from
`tests/fixtures/spectra/<name>/2024.yml` (the same call the tests make):

```js
r.yaml = `<paste the whole file here>`;
```

The demo's dev server may also serve repository files, in which case
`r.yaml = await (await fetch('/@fs/<absolute repo path>/tests/fixtures/spectra/trello/2024.yml')).text();`
saves the pasting. The author did not check that this URL works; use the paste
if it does not. `r.reload()` renders again from the current `yaml`.

For the width checks use the browser's responsive mode, or resize the window.
The bands follow the width of the renderer element, which in the demo is about
990 px at a 1024 px window and about 1378 px at 1440 px. The window widths below
are the ones the tests use.

## UI steps

### 1. Columns of the 3-plan demo pricing at six widths

With the acme pricing loaded, set the window width to 600, 839, 840, 1024, 1200
and 1440 px, one after the other, and look at the plan cards. Expect:

| Window width | Columns of the 3 plan cards                            |
| ------------ | ------------------------------------------------------ |
| 600, 839     | 2 columns, 2 + 1 (the lone card is exempt by the spec) |
| 840          | 3 columns                                              |
| 1024         | 3 columns                                              |
| 1200         | 3 columns                                              |
| 1440         | 3 columns                                              |

Cards fill the row (no fixed 320 px width) and are never narrower than 220 px.
Below 600 px there is one column. At 1440x900, scroll so the renderer is at the
top of the window: the first plan button ("Choose ..." or the call to action)
is fully visible without scrolling further.

Status: not verified by the author. Covered by (CI green on `30928a5` and
`6d3fefa`): `tests/browser/spectra-grid.spec.ts` (cards per row at 1440x900,
1200x800 and 1024x768 for every fixture with plans, card width at least 220 px,
first call to action visible at 1440x900, no element outside the renderer, 44 px
targets), and `tests/unit/plan-grid-columns.test.ts` (the 600, 840, 1040 and
1280 px bands and the column table in the stylesheet). The 600 and 839 px
widths are covered by the unit test only, not by a browser run.

### 2. Pricings with 4 and with 5 to 7 plans

Load `trello` (4 plans), then `wrike` or `zoom` (5 plans), then `figma` (6
plans), then `webflow` (15 plans), as described in Setup. At each width of
step 1 expect the columns of the table below and no row that ends with a single
card, except the exempt cases of the spec:

| Plans | 600-839 | 840-1039 | 1040-1279 | 1280 and up |
| ----- | ------- | -------- | --------- | ----------- |
| 4     | 2 + 2   | 2 + 2    | 4         | 4           |
| 5     | 2+2+1   | 3 + 2    | 3 + 2     | 3 + 2       |
| 6     | 2x3     | 3 + 3    | 3 + 3     | 3 + 3       |
| 15    | 2x7+1   | 3x5      | 4x3+3     | 4x3+3       |

The 600-839 px band is exempt from the lone card rule. 7 plans at 840-1039 px
and 13 plans from 840 px are exempt too. With 1 or 2 plans the cards are
centered and at most 320 px wide, as before. At 1440x900, after scrolling the
renderer to the top of the window, the first call to action is visible for each
of these pricings.

Status: not verified by the author. Covered by: the per-fixture tests of
`tests/browser/spectra-grid.spec.ts` (trello, trustmary, wrike, zoom, figma,
webflow and the other fixtures with plans; okta has no plans and is skipped),
and `tests/unit/plan-grid-columns.test.ts` for the column table of 3 to 16
plans.

### 3. Text: whole words and long strings

a) Load `figma` and set the window to 375 px wide. Look at the plan cards, the
feature list and the comparison. The word "Unlimited" (and "Professional" in
capitals) is never split across two lines inside the word.

b) Paste a 64-character string without spaces as the hero title. In the
console:

```js
const h2 = r.querySelector('[data-pr-part="hero"] h2');
h2.firstChild.data = 'Unbroken'.repeat(8);
```

(If the title is not the first child text node, use the first text node found
with `h2.childNodes`.) At 375 px expect the string to wrap on more than one
line, inside the renderer, and no horizontal scroll bar on the renderer or the
page.

Status: not verified by the author. Covered by:
`tests/browser/spectra-text.spec.ts`, one test per fixture at 1440x900,
1024x768 and 375x812. It asserts no split of short words for mailchimp,
microsoft365Business, salesforce, zoom, figma and github, no clipped text, no
element outside the renderer, the 64-character string wrapped inside cards for
values and labels, and, at 375 px, the hero title and the add-on or breakdown
text wrapped inside the renderer.

### 4. Themes and spacing tokens

With the acme pricing loaded and the window at 1200 px wide, measure the space
above the plans (distance from the top of the renderer to the plans heading,
or the `padding-top` and `row-gap` of `.pr-content` in the inspector).

- Default look: from 840 px the content padding at the top is 16 px and the gap
  between the hero, the billing switch and the plans is 24 px.
- Set smaller tokens on the renderer, then compare:

```js
r.style.setProperty('--pr-shell-padding', '8px');
r.style.setProperty('--pr-space-section', '12px');
```

Expect the padding at the top to be 8 px and the gap 12 px: the values follow
the tokens when they are smaller (the stylesheet takes `min()` of the token and
16 px / 24 px). Larger tokens, for example `48px` and `72px`, still give 16 px
and 24 px. The space after the plans section remains `--pr-space-section`.
Remove the properties with `r.style.removeProperty('--pr-shell-padding')` and
`r.style.removeProperty('--pr-space-section')` to return to the default.

Status: not verified by the author. The default 16 px and 24 px are covered by
`tests/browser/pricing-renderer.spec.ts` (the responsive snapshots at 840, 1024,
1200 and 1440 px are unchanged in pixels, by the spec) and by the first-call-to-
action gate of `spectra-grid.spec.ts`. The `min()` caps are covered by the
stylesheet check of `tests/unit/plan-grid-columns.test.ts` only for the plan
grid rules; there is **no test of the token caps** (see Findings).

### 5. Automated tests

```sh
pnpm test
pnpm exec playwright test tests/browser/spectra-grid.spec.ts tests/browser/spectra-text.spec.ts --project=chromium
pnpm exec playwright test tests/browser/pricing-renderer.spec.ts
```

Expect all of them to pass. The five `-linux` baselines under
`tests/browser/pricing-renderer.spec.ts-snapshots/` were regenerated on purpose
(plan grids from 600 px and tighter cards from 840 px). The macOS baselines in
the same folder are stale: on macOS the snapshot tests of
`pricing-renderer.spec.ts` fail until they are regenerated there.

Status: not verified by the author (not run locally). CI on heads `30928a5` and
`6d3fefa`: green (quality 22/24, audit, browsers).

## API examples

None. The change adds no attribute, property, event or CSS part (non-goal of
the specs).

## Findings

- None known, besides what follows. Nothing was executed by the author; the
  evidence is the CI runs on `30928a5` and `6d3fefa`.
- A lone last card appears in the 2-column band (600-839 px) for 3, 5, 7, 9,
  11, 13 and 15 plans. This is the exemption written in the spec.
- The macOS snapshot baselines are stale; only the `-linux` ones were
  regenerated.
- Reviewers' minor findings, left open: tags and badges that contain a long
  word can spill out of their box, and there is no test of the `min()` caps on
  `--pr-shell-padding` and `--pr-space-section`.
- The registered check formats this file with prettier; it is not a run of the
  demo.
