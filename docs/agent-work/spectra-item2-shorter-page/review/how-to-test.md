# How to test: shorter page, "Only differences" by default and a configurable toolbar (PR #48)

Status of this guide: written from the spec
(`docs/agent-work/spectra-item2-shorter-page/spec.md`),
`tests/browser/spectra-shorter-page.spec.ts` and `tests/unit/shorter-page*.test.ts`. The
author could not start a browser and could not capture the UI, so **steps 1 to 5 are
manual and were not run by the author**: every one is `not verified: manual, no browser
available to the author`. The browser spec did run in CI on head
`2d2d3bf28e4c6dfbea79a84039ecf997118564aa` and the whole spec passed; step 6 names the
automated tests and the numbers CI logged. No images or baselines are included or
changed.

Be aware of what this change does and does not do. For ClickUp, Zoom, Salesforce and
Webflow the page height with the new default and with "Only differences" forced off is
**equal** (see the CI numbers in step 6), so turning on "Only differences" does not
shorten the page for these four pricings: the 30-row cap per group and the plan cards
dominate the height. The value of this change is the new counter, the empty state, the
two attributes and the automatic default. The "at most 3 screens" target of the report is
not met and is not claimed.

## Setup

```sh
pnpm install --frozen-lockfile
pnpm demo        # builds, then serves the vanilla demo at the printed address
```

Open the address that `pnpm demo` prints. The renderer is the `<pricing-renderer>`
element in the section "Configure it like a customer would". The demo loads the acme
fixture (`tests/fixtures/acme-pricing.yml`).

In the browser console define the handle once per page load:

```js
const r = document.querySelector('pricing-renderer');
```

To load a SPECTRA pricing, paste the whole file as text. The fixtures used here are
`tests/fixtures/spectra/clickup/2024.yml` and `tests/fixtures/spectra/notion/2024.yml`:

```js
r.yaml = `<paste the whole content of the fixture here>`;
```

The dev server may serve repository files, so
`r.yaml = await (await fetch('/@fs/<absolute repo path>/tests/fixtures/spectra/clickup/2024.yml')).text();`
may save the pasting. The author did not check that this URL works; use the paste if it
does not. Wait for the render (`r.reload()` renders again from the current `yaml`).

Set locale and theme from the console:

```js
r.locale = 'en'; // or 'es'
r.theme = 'light'; // or 'dark'
```

Widths: use the responsive mode of the browser or resize the window. The table layout is
used at 1440 px wide (the tests use 1440x900; the switch to the compact layout happens at
a renderer width below 840 px, measured on the renderer element, not the window).

## UI steps

All UI steps are manual.

### 1. ClickUp: checked by default, counter equals the rows

Load the ClickUp pricing (174 comparison rows), locale `en`, window 1440 px wide, table
layout. Do not set any attribute. Open the comparison section. Expect the toolbar above
the comparison with the "Only differences" checkbox **checked** and the counter text
`30 of 174 items`. In the console, the number of rendered rows must equal the first number
of the counter:

```js
r.querySelectorAll('[data-pr-part="comparison-row"]').length; // 30, same as the counter
```

Uncheck the checkbox: the counter stays at `30 of 174 items` and the rows are the same,
because only the first group is expanded, each group is capped at 30 rows and its first 30
rows differ anyway. To see the counter change, press "Expand all" (or open a second group)
and then toggle the checkbox: the counter and the rows change, and the number of rows still
equals the first number of the counter. Collapsed groups are not counted.

Planned capture: none (no images in this guide).

Status: not verified: manual, no browser available to the author. Covered in CI by
`clickup starts with only differences and is shorter` (checked by default, counter equals
the row count, counter text `30 of 174 items`) and by `the checkbox overrides the property
until the next change`.

### 2. Empty state

Same state as step 1. Type `zzzz-no-such-row` in the search field. Expect, below the
toolbar, one line `No matching items` (element `data-pr-part="comparison-empty"`, role
`status`), no table and no rows, the toolbar still visible so the search can be cleared,
and the counter `0 of 174 items`. Clear the search: the rows come back. Then set
`r.locale = 'es'` with the same search: expect `Sin resultados` and the counter
`0 de 174 elementos`.

```js
r.querySelector('[data-pr-part="comparison-empty"]')?.textContent; // 'No matching items'
r.querySelectorAll('[data-pr-part="comparison-row"]').length; // 0
```

Status: not verified: manual, no browser available to the author. The English table
case is covered in CI by `clickup shows an empty state when the search matches nothing`.
The Spanish text, the compact layout and the "only differences leaves 0 rows" case are
covered by the unit tests only.

### 3. Attributes from the console

On ClickUp, run each line and look at the checkbox after it:

```js
r.setAttribute('only-differences', 'false'); // checkbox unchecked
r.setAttribute('only-differences', ''); // checkbox checked
r.removeAttribute('only-differences'); // automatic default again: checked on ClickUp
r.setAttribute('toolbar-threshold', '200'); // the toolbar disappears (174 rows is not over 200)
r.setAttribute('toolbar-threshold', '10'); // the toolbar is back
```

A change to the `only-differences` attribute or property (and a reload) drops any choice
you made by clicking the checkbox, and the new value applies. Changing `toolbar-threshold`
does not drop it: while the toolbar is hidden, the stored search text and checkbox choice
are ignored, and they apply again when the toolbar comes back. Then reload the demo (acme pricing, 5 rows, no toolbar) and run:

```js
r.setAttribute('toolbar-threshold', '-5'); // still no toolbar: falls back to 40
r.setAttribute('toolbar-threshold', 'abc'); // still no toolbar
r.setAttribute('toolbar-threshold', '4'); // the toolbar appears (5 rows is over 4)
```

Status: not verified: manual, no browser available to the author. Covered in CI by
`only-differences="false" unchecks it on clickup`, `toolbar-threshold="200" removes the
toolbar on clickup`, `an invalid toolbar-threshold falls back to 40 on the demo page` and
`the checkbox overrides the property until the next change`.

### 4. Notion: toolbar shown, unchecked by default

Load the Notion pricing (65 rows, so more than the threshold of 40 and not more than 100).
Expect the toolbar, with the "Only differences" checkbox **unchecked** (the automatic
default is on only above 100 rows). Run
`r.setAttribute('only-differences', '')`: the checkbox becomes checked.

Status: not verified: manual, no browser available to the author. Covered in CI by
`notion starts unchecked and the empty attribute checks it`.

### 5. Demo pricing is unchanged

Reload the demo so that the acme pricing is loaded (no `r.yaml` set). Expect no toolbar
and the comparison as before: nothing changed in markup or look, so the screenshot
baselines of the repository do not change (`src/styles/base.css` is not touched).

```js
r.querySelector('.pr-comparison-toolbar'); // null
```

Status: not verified: manual, no browser available to the author. Covered in CI by
`the demo pricing has no toolbar`; the unchanged markup is covered by the unit tests.

### 6. Automated commands

```sh
pnpm exec vitest run tests/unit/shorter-page.test.ts tests/unit/shorter-page-fixtures.test.ts tests/unit/shorter-page-threshold.test.ts
pnpm exec playwright test tests/browser/spectra-shorter-page.spec.ts
```

Expect all of them to pass. The browser spec runs in chromium only and most tests set a
60 s timeout. In CI (head `2d2d3bf28e4c6dfbea79a84039ecf997118564aa`) the whole browser spec
passed and logged these lines (screens = renderer height / 900 at 1440x900):

| Pricing    | Default screens | Forced off screens | Counter           |
| ---------- | --------------- | ------------------ | ----------------- |
| clickup    | 2.48            | 2.48               | `30 of 174 items` |
| zoom       | 5               | 5                  | `11 of 151 items` |
| salesforce | 3.86            | 3.86               | `30 of 124 items` |
| webflow    | 4.17            | 4.17               | `30 of 118 items` |

Default and forced-off heights are equal for these four pricings, so only differences
does not shorten the page there.

Status: the browser spec is verified by the CI run on that head (not by the author). The
unit command was not run by the author; the author's registered checks only install
dependencies and format this file.

## API examples

Two attributes, both on `<pricing-renderer>`. Nothing was run by the author:
`not verified: manual, no browser available to the author` for every example below.

### `only-differences` (property `onlyDifferences?: boolean`)

Initial state of the "Only differences" checkbox.

```html
<pricing-renderer only-differences></pricing-renderer>
<!-- checked -->
<pricing-renderer only-differences="false"></pricing-renderer>
<!-- unchecked -->
<pricing-renderer></pricing-renderer>
<!-- automatic: checked only if the pricing has more than 100 comparison rows,
     at least 2 plans and a visible toolbar -->
```

Any value other than `false` (including the empty value) means `true`. A click on the
checkbox overrides the value until the pricing is reloaded or the attribute or property
changes.

Negative case: `only-differences="false"` on ClickUp hides no row through
the differences filter (the 30-row cap and collapsed groups still apply), and `only-differences="x"` is read as `true`, not as an error.

### `toolbar-threshold` (property `toolbarThreshold: number`, default 40)

The toolbar is rendered only if the total number of comparison rows is greater than the
threshold.

```html
<pricing-renderer toolbar-threshold="10"></pricing-renderer>
<!-- 20 rows: toolbar shown -->
<pricing-renderer toolbar-threshold="200"></pricing-renderer>
<!-- ClickUp (174 rows): no toolbar -->
```

Negative case: `toolbar-threshold="-5"`, `"abc"` and `"Infinity"` are ignored and the
default 40 applies (on the demo pricing, 5 rows, the toolbar stays absent).

## Findings

- The default and forced-off page heights are equal for ClickUp, Zoom, Salesforce and
  Webflow, so "Only differences" does not shorten the page there. The "at most 3
  screens" target is not met.
- The React props are not updated in this PR, and `docs/theming.md` is not updated
  either.
- The search text that is left in the field after a reload is stale; this behaviour
  existed before this change.
- The automatic default is recomputed on every render.
- Nothing was executed by the author; the registered checks of this task only install
  dependencies and format this file with prettier.
