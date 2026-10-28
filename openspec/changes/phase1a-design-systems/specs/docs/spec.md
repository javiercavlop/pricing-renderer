## ADDED Requirements

### Requirement: Design systems guide

`req~design-systems-guide~1`
The documentation SHALL include `docs/design-systems.md` with the second-level sections `Tailwind CSS v3`, `Tailwind CSS v4`, `CSS Modules`, `Mapping tokens to host variables`, `Fonts`, `Dark mode`, `Density`, `State attributes` and `Container breakpoints stay fixed`, linked from `README.md`, `docs/theming.md` and `docs/api-reference.md`.

Needs: utest

#### Scenario: Sections and links

- **GIVEN** the texts of `docs/design-systems.md`, `README.md`, `docs/theming.md` and `docs/api-reference.md`
- **WHEN** a unit test lists the `## ` headings of the guide and searches the three other files for a Markdown link whose target ends with `design-systems.md`
- **THEN** the guide has the nine headings of the requirement in that order, and each of the three files has such a link

#### Scenario: Tailwind sections

- **GIVEN** the text of `docs/design-systems.md`
- **WHEN** a unit test reads the sections `Tailwind CSS v3` and `Tailwind CSS v4`
- **THEN** the v3 section contains `background-color: transparent`, names the `<button>` form of the primary CTA and contains the fix rule of design.md, "Tailwind v3 fix"
- **AND** the v4 section contains `@layer theme, base, pricing-renderer, components, utilities;` in a code block before the line of that block that imports `tailwindcss`

#### Scenario: CSS Modules, mapping and state sections

- **GIVEN** the text of `docs/design-systems.md`
- **WHEN** a unit test reads the sections `CSS Modules`, `Mapping tokens to host variables`, `State attributes` and `Container breakpoints stay fixed`
- **THEN** `CSS Modules` contains `:global(pricing-renderer)` and `[data-pr-part=`
- **AND** `Mapping tokens to host variables` contains `pricing-renderer/tokens-shadcn.css` and `hsl(var(--primary))`
- **AND** `State attributes` contains `data-current`, `data-selected`, `data-featured`, `data-available` and `data-kind`
- **AND** `Container breakpoints stay fixed` contains `600px`, `840px`, `1040px`, `1200px` and `1280px` and `--pr-plan-columns`

### Requirement: Accurate theming reference

`req~theming-docs-accuracy~1`
The theming reference `docs/theming.md` SHALL name the structural layer `pricing-renderer` and never `pricing-renderer.base`, list each token of `req~token-fallbacks~1` with its default, and show no import that wraps a renderer style sheet in `layer(...)`.

Needs: utest

#### Scenario: Layer names and import example

- **GIVEN** the text of `docs/theming.md`
- **WHEN** a unit test searches it
- **THEN** it contains `@layer pricing-renderer` and does not contain `pricing-renderer.base`
- **AND** no line matches `/@import\s+['"]pricing-renderer\/[^'"]+['"]\s+layer\(/`

#### Scenario: New tokens documented with defaults

- **GIVEN** the text of `docs/theming.md`
- **WHEN** a unit test looks for each of the twelve token names of `req~token-fallbacks~1`
- **THEN** each appears on a line that also names its default: `--pr-line-height` with `1.5`, `--pr-sticky-top` with `0px`, `--pr-table-max-height` with `80dvh`, `--pr-table-min-width` with `720px`, `--pr-z-dialog` with `1000`, `--pr-font-weight-regular` with `400`, `--pr-font-weight-medium` with `500`, `--pr-font-weight-bold` with `700`, `--pr-font-weight-heavy` with `800`, and `--pr-font-family`, `--pr-font-family-display` and `--pr-plan-columns` with the word `unset`

### Requirement: Host reset proof

`req~host-reset-spec~1`
The browser test `tests/browser/host-reset.spec.ts` SHALL show that an unlayered host rule `button { background-color: transparent; background-image: none; }` removes the background of the primary CTA in its `<button>` form and that the fix rule of design.md, "Tailwind v3 fix", restores it.

Needs: utest

#### Scenario: Preflight shape wipes the button CTA

- **GIVEN** a new element on the demo page with the Acme pricing, `styles.css` and `presentation.ctas` `[{ id: 'start-starter', label: 'Start', planId: 'starter' }]`
- **AND** the host style `button { background-color: transparent; background-image: none; }` injected without a layer
- **WHEN** the renderer is ready
- **THEN** the Starter `button[data-pr-part='cta'][data-kind='primary']` has computed `background-color` `rgba(0, 0, 0, 0)`, while without the host style it is `rgb(101, 88, 232)`

#### Scenario: Documented fix restores it

- **GIVEN** the page of the previous scenario
- **WHEN** the fix rule is injected without a layer after the host style
- **THEN** the Starter CTA has computed `background-color` `rgb(101, 88, 232)` and computed `color` `rgb(255, 255, 255)`

### Requirement: Theme builder demo page

`req~theme-builder-page~1`
The demo SHALL include the page `examples/vanilla/theme-builder.html` that previews a `<pricing-renderer>`, starts from the preset `default`, `shadcn` or `minimal`, applies each token edit to the preview at once and shows the edited tokens as a CSS block.

Needs: impl, utest

#### Scenario: Live edit and export

- **GIVEN** the page `/theme-builder.html` of the Playwright web server with the preset `default`
- **WHEN** the test fills `input[data-token='--pr-color-accent']` with `#ff0000`
- **THEN** the preview's `button[data-pr-part='cta'][data-kind='primary']` has computed `background-color` `rgb(255, 0, 0)`
- **AND** the value of `#theme-export` contains `pricing-renderer[data-pr-root] {` and `--pr-color-accent: #ff0000;`

#### Scenario: Presets

- **GIVEN** the page `/theme-builder.html`
- **WHEN** the test selects `minimal` in `select#theme-preset`
- **THEN** the first `.pr-plan-card` of the preview has computed `box-shadow` `none`
- **AND** after selecting `shadcn`, the preview's primary CTA background color equals the computed `--primary` of the page's `<html>`

#### Scenario: Build output

- **GIVEN** the demo package `pricing-renderer-demo`
- **WHEN** `pnpm --filter pricing-renderer-demo build` runs
- **THEN** it exits 0 and its output directory contains `theme-builder.html`
