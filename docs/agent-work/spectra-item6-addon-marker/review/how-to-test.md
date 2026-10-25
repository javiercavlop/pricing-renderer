# How to test: "Add-on" marker for add-on-only rows (PR #47)

Status of this guide: written from the spec
(`docs/agent-work/spectra-item6-addon-marker/spec.md`), `tests/unit/addon-marker.test.ts`
and `tests/browser/spectra-addon-marker.spec.ts`. The author could not start a
browser and could not capture the UI, so **steps 1 to 5 are manual and were not
run by the author**: every one is `not verified: manual, no browser available to
the author`. Step 6 names the automated tests. The browser spec has never run
before CI. No images or baselines are included or changed.

## Setup

```sh
pnpm install --frozen-lockfile
pnpm demo        # builds, then serves the vanilla demo at the printed address
```

Open the address that `pnpm demo` prints. The renderer is the
`<pricing-renderer>` element in the section "Configure it like a customer
would". The demo loads the acme fixture (`tests/fixtures/acme-pricing.yml`).

In the browser console define the handle once per page load:

```js
const r = document.querySelector('pricing-renderer');
```

To load the GitHub SPECTRA fixture (the only, and so the latest, year is
`tests/fixtures/spectra/github/2024.yml`), paste the whole file as text:

```js
r.yaml = `<paste the whole content of tests/fixtures/spectra/github/2024.yml here>`;
```

The dev server may serve repository files, so
`r.yaml = await (await fetch('/@fs/<absolute repo path>/tests/fixtures/spectra/github/2024.yml')).text();`
may save the pasting. The author did not check that this URL works; use the
paste if it does not. Wait for the render (`r.reload()` renders again from the
current `yaml`).

Set locale and theme from the console:

```js
r.locale = 'en'; // or 'es'
r.theme = 'light'; // or 'dark'
```

Widths: use the responsive mode of the browser or resize the window. The table
layout is used at 1440 px wide, the compact layout at 375 px wide (the tests use
1440x900 and 375x812; the switch is at 768 px).

## UI steps

All UI steps are manual.

### 1. Table layout, English, light theme

With the GitHub pricing loaded, locale `en`, theme `light`, window 1440 px wide,
open the comparison section. Open every comparison group (and any "show more"
button). Expect **32 rows** where every plan cell shows an "Add-on" pill (an
accent-coloured badge) instead of an em dash. In the console:

```js
r.querySelectorAll('[data-pr-part="comparison-row"]:has(.pr-value--addon)').length; // 32
r.querySelectorAll('.pr-value--addon').length; // 32 x number of plans
```

Each of those rows has exactly one pill per plan cell. The pill is on one line
and does not make the cell overflow.

Planned capture: `01-addon-table-en-light-desktop.png`.

Status: not verified: manual, no browser available to the author. Covered by
`tests/browser/spectra-addon-marker.spec.ts` (row count 32, one marker per plan,
no `.pr-value--excluded` in those rows, single line).

### 2. Screen reader text and the other empty cells

In the same state, inspect one pill in the inspector. Expect a visible element
with `aria-hidden="true"` whose text is `Add-on`, and a sibling `.pr-sr-only`
element whose text is `Available as add-on`. Then look at cells of other rows
that are empty and that no add-on provides: they keep the em dash and have no
pill.

Status: not verified: manual, no browser available to the author. Covered by
`tests/unit/addon-marker.test.ts` (39 tests) and the `marker text and single
line` browser test.

### 3. Spanish

Set `r.locale = 'es'`. Expect the same 32 rows, now with the pill text
`Complemento` and screen reader text `Disponible como complemento`. The pill
still fits on one line at 1440 px.

Planned capture: `02-addon-table-es-light-desktop.png`.

Status: not verified: manual, no browser available to the author. Covered by the
`es` browser test and the i18n cases of `tests/unit/addon-marker.test.ts`.

### 4. Dark theme

Set `r.theme = 'dark'` (then also in Spanish if you wish). Expect the pill to
stay legible: text contrast at least 4.5:1 against its background (about 5.9:1
in light and 6.6:1 in dark, by the author of the stylesheet). Check with the
contrast tool of the browser inspector on a few pills.

Planned capture: `03-addon-table-en-dark-desktop.png`.

Status: not verified: manual, no browser available to the author. Covered by the
`marker contrast` browser tests for both themes.

### 5. Compact layout (narrow window)

Set the window to 375 px wide, locale `en`, theme `light`. The comparison now
uses the compact layout (a list per plan instead of a table). Open each group
and use "show more" until nothing remains (groups reveal their remaining rows
in steps of 30). Expect the same 32 rows with one "Add-on" pill per plan, on
one line, no horizontal scroll bar in the cells, and no em dash in these rows.
Repeat in `es` and in dark theme.

Planned capture: `04-addon-compact-en-light-mobile.png`.

Status: not verified: manual, no browser available to the author. Covered by the
compact-layout cases of `tests/browser/spectra-addon-marker.spec.ts`. Risk: the
reveal of the remaining rows in the compact layout is the part most likely to
differ from the unit expectations.

### 6. Default demo pricing is unchanged, and the automated tests

Reload the demo so that the acme pricing is loaded (no `r.yaml` set) and look at
the comparison: the acme fixture has no add-on-only rows, so there is no pill
and the em dashes are where they were. The existing snapshots do not change.

Then run the tests:

```sh
pnpm exec vitest run tests/unit/addon-marker.test.ts
pnpm exec playwright test tests/browser/spectra-addon-marker.spec.ts
```

Expect all of them to pass. The browser spec runs in chromium only (it skips
other browsers) and has a 60 s timeout per test.

Status: not verified: manual for the acme check; the two commands were not run
by the author (no browser, and the browser spec has never run before CI).

## API examples

None. The change adds no attribute, property, event or CSS part, and
`PricingComparisonRow` is unchanged (non-goal of the spec). Negative case: the
other empty cells keeping the em dash (step 2) and the unchanged acme pricing
(step 6).

## Findings

- None known. Nothing was executed by the author; the registered checks of
  this task only install dependencies and format this file with prettier.
- The browser spec `tests/browser/spectra-addon-marker.spec.ts` has not run
  before this PR; its first run is the CI.
- The compact-layout reveal of the remaining rows (30 per group) is a risk to
  watch in that first run.
