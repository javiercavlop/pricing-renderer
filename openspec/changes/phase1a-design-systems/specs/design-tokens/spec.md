## ADDED Requirements

### Requirement: New tokens are optional

`req~token-fallbacks~1`
The package style sheets SHALL leave the twelve tokens of design.md, D2, undeclared in `theme.css`, `tokens-shadcn.css` and `theme-minimal.css`, and use each of them in `base.css` with the value of that site at `9cf7e21` as its `var()` fallback, except the font-family uses of `req~font-family-tokens~1`.

Needs: impl, utest

#### Scenario: No theme file declares a new token

- **GIVEN** the text of `src/styles/theme.css`, and of `src/styles/tokens-shadcn.css` and `src/styles/theme-minimal.css` when they exist
- **WHEN** a unit test searches each text for `/--pr-(font-family|font-family-display|font-weight-(regular|medium|bold|heavy)|line-height|sticky-top|table-max-height|table-min-width|z-dialog|plan-columns)\s*:/`
- **THEN** there is no match

#### Scenario: Default rendering unchanged

- **GIVEN** the demo page with `pricing-renderer/styles.css` and no host token
- **WHEN** the responsive visual tests of `tests/browser/pricing-renderer.spec.ts` run without `--update-snapshots`
- **THEN** every screenshot matches its committed baseline and no baseline file is changed
- **AND** `.pr-hero__title` has computed `font-weight` `780`, `.pr-comparison-table` has computed `min-width` `720px` and the `pricing-renderer` root has computed `line-height` `24px` with a host `font-size` of `16px`

### Requirement: Font family tokens

`req~font-family-tokens~1`
The base style sheet SHALL set `font-family: var(--pr-font-family)` after `font: inherit` on the `pricing-renderer[data-pr-root]` and `pricing-change-review` roots, and `font-family: var(--pr-font-family-display, var(--pr-font-family))` on `.pr-hero__title`, the section `h3` of `:where(.pr-section__heading, .pr-configurator, .pr-metadata) h3`, `.pr-plan-card__top h4` and `.pr-price__amount`.

Needs: impl, utest

#### Scenario: Unset tokens inherit the host font

- **GIVEN** the demo page with a host rule `body { font-family: Verdana, sans-serif; }` and no `--pr-font-*` token
- **WHEN** the renderer is ready
- **THEN** the computed `font-family` of the `pricing-renderer` element, of `.pr-hero__title` and of the first `.pr-plan-card__top h4` is `Verdana, sans-serif`

#### Scenario: Body and display fonts

- **GIVEN** the demo page with a host rule `pricing-renderer { --pr-font-family: Georgia, serif; --pr-font-family-display: 'Courier New', monospace; }`
- **WHEN** the renderer is ready
- **THEN** the computed `font-family` of the first `.pr-plan-card` is `Georgia, serif`
- **AND** the computed `font-family` of `.pr-hero__title`, `[data-pr-part='plans'] .pr-section__heading h3`, the first `.pr-plan-card__top h4` and the first `.pr-price__amount` is `"Courier New", monospace`

#### Scenario: Display font falls back to the body font

- **GIVEN** the demo page with a host rule `pricing-renderer { --pr-font-family: Georgia, serif; }`
- **WHEN** the renderer is ready
- **THEN** the computed `font-family` of `.pr-hero__title` is `Georgia, serif`

#### Scenario: The keyword inherit is never documented as a token value

- **GIVEN** the texts of `docs/design-systems.md` and `docs/theming.md`
- **WHEN** a unit test searches them for `/--pr-font-family(-display)?\s*:\s*inherit/`
- **THEN** there is no match

### Requirement: Font weight tokens

`req~font-weight-tokens~1`
Every `font-weight` declaration of `src/styles/base.css` SHALL be `var(--pr-font-weight-<group>, <value at 9cf7e21>)` with the group of design.md, D2 (`regular` 400; `medium` 500 and 650; `bold` 700 to 790; `heavy` 800 and 900), including a new `var(--pr-font-weight-bold, 700)` on the six heading selectors of D2 (section `h3`, plan `h4`, add-on `h4`, dialog `h3`, review `h2` and review section `h3`) that rely on the user-agent bold today.

Needs: impl, utest

#### Scenario: No bare weight is left

- **GIVEN** the text of `src/styles/base.css`
- **WHEN** a unit test collects every `font-weight` declaration
- **THEN** none matches `/font-weight:\s*\d/`
- **AND** each matches `/font-weight:\s*var\(--pr-font-weight-(regular|medium|bold|heavy), (\d+)\)/` with the pair (group, number) one of (regular, 400), (medium, 500), (medium, 650), (bold, 700), (bold, 750), (bold, 780), (bold, 790), (heavy, 800), (heavy, 900)

#### Scenario: Headings that relied on the user-agent bold

- **GIVEN** the text of `src/styles/base.css`
- **WHEN** a unit test reads the rules for the six heading selectors `:where(.pr-section__heading, .pr-configurator, .pr-metadata) h3`, `.pr-plan-card__top h4`, `.pr-addon-card h4`, `.pr-dialog h3`, `pricing-change-review .pr-cr-header h2` and `pricing-change-review [data-pr-part='change-review'] > section > h3`, checking each selector on its own
- **THEN** each has the declaration `font-weight: var(--pr-font-weight-bold, 700)`

#### Scenario: A host token unifies its group

- **GIVEN** the demo page without its unlayered button font reset, and a host rule `pricing-renderer { --pr-font-weight-bold: 600; }`
- **WHEN** the renderer is ready
- **THEN** the computed `font-weight` of `.pr-hero__title`, of the first `.pr-price__amount`, of the first `.pr-plan-card__top h4` and of the first `button[data-pr-part='cta']` is `600`
- **AND** without the host rule they are `780`, `790`, `700` and `750`

### Requirement: Line height token

`req~line-height-token~1`
The base style sheet SHALL set `line-height: var(--pr-line-height, 1.5)` on the `pricing-renderer[data-pr-root]` and `pricing-change-review` roots, after their `font: inherit` declaration.

Needs: impl, utest

#### Scenario: Root rules

- **GIVEN** the text of `src/styles/base.css`
- **WHEN** a unit test reads the rules `pricing-renderer[data-pr-root]` and `pricing-change-review` that declare `font: inherit`
- **THEN** each has `line-height: var(--pr-line-height, 1.5)` after `font: inherit`
- **AND** `.pr-hero__title` still has `line-height: 1.02` and `.pr-button` still has `line-height: 1.2`

#### Scenario: Host line height

- **GIVEN** the demo page with a host rule `pricing-renderer { font-size: 16px; --pr-line-height: 1.7; }`
- **WHEN** the renderer is ready
- **THEN** the computed `line-height` of the `pricing-renderer` element is `27.2px`

### Requirement: Sticky top token

`req~sticky-top-token~1`
The base style sheet SHALL add `var(--pr-sticky-top, 0px)` to the top inset of every sticky element measured against the page (the comparison toolbar and the 840px summary of design.md, D3), and to no sticky element that sticks inside its own scroll box.

Needs: impl, utest

#### Scenario: Rules in base.css

- **GIVEN** the text of `src/styles/base.css`
- **WHEN** a unit test reads the `.pr-comparison-toolbar` rule, the `.pr-summary` rule inside `@container pricing-renderer (min-width: 840px)` and the `.pr-comparison-table thead th` rule
- **THEN** they declare `inset-block-start: var(--pr-sticky-top, 0px)`, `inset-block-start: calc(var(--pr-sticky-top, 0px) + var(--pr-space-4))` and `inset-block-start: 0`

#### Scenario: Host header offset

- **GIVEN** the demo page at a 1440 × 900 viewport with a host rule `pricing-renderer { --pr-sticky-top: 64px; }`
- **WHEN** the page scrolls until `.pr-comparison-toolbar` is stuck
- **THEN** `getBoundingClientRect().top` of `.pr-comparison-toolbar` is `64`

### Requirement: Table size tokens

`req~table-size-tokens~1`
The base style sheet SHALL size the comparison table with `max-block-size: var(--pr-table-max-height, 80dvh)` on `.pr-table-scroll` in a rule inside `@supports (max-block-size: 1dvh)` that follows a `.pr-table-scroll` rule keeping `max-block-size: 80vh`, and with `min-width: var(--pr-table-min-width, 720px)` on `.pr-comparison-table`.

Needs: impl, utest

#### Scenario: Rules in base.css

- **GIVEN** the text of `src/styles/base.css`
- **WHEN** a unit test reads the `.pr-table-scroll` and `.pr-comparison-table` rules
- **THEN** the main `.pr-table-scroll` rule has `max-block-size: 80vh` and no `var(--pr-table-max-height`
- **AND** a later `.pr-table-scroll` rule inside `@supports (max-block-size: 1dvh)` has `max-block-size: var(--pr-table-max-height, 80dvh)`
- **AND** the `.pr-comparison-table` rule has `min-width: var(--pr-table-min-width, 720px)`

#### Scenario: Host table size

- **GIVEN** the demo page at a 1440 × 900 viewport with a host rule `pricing-renderer { --pr-table-max-height: 300px; --pr-table-min-width: 900px; }` and the comparison table shown
- **WHEN** the renderer is ready
- **THEN** `.pr-table-scroll` has computed `max-height` `300px` and `.pr-comparison-table` has computed `min-width` `900px`

### Requirement: Dialog stacking token

`req~dialog-z-token~1`
The base style sheet SHALL set `z-index: var(--pr-z-dialog, 1000)` on `.pr-dialog-backdrop`.

Needs: impl, utest

#### Scenario: Rule in base.css

- **GIVEN** the text of `src/styles/base.css`
- **WHEN** a unit test reads the `.pr-dialog-backdrop` rule
- **THEN** it has `z-index: var(--pr-z-dialog, 1000)` and no other `z-index`

### Requirement: Plan columns token

`req~plan-columns-token~1`
Every rule of `src/styles/base.css` that sets `grid-template-columns` on `.pr-plan-grid` SHALL have the value `var(--pr-plan-columns, <value at 9cf7e21>)` in a selector list that selects neither `.pr-addon-grid` nor `.pr-variable-grid`, so the two rules shared with those grids at `9cf7e21` are split.

Needs: impl, utest

#### Scenario: Ten plan-grid rules

- **GIVEN** the text of `src/styles/base.css`
- **WHEN** a unit test collects the rules whose selector contains `.pr-plan-grid` and that declare `grid-template-columns`
- **THEN** there are ten, and their values are, in source order: `var(--pr-plan-columns, minmax(0, 1fr))`; in the 600px band `var(--pr-plan-columns, repeat(2, minmax(0, 1fr)))` and `var(--pr-plan-columns, repeat(2, minmax(0, 320px)))`; in the 840px band `var(--pr-plan-columns, repeat(3, minmax(0, 1fr)))`, `var(--pr-plan-columns, repeat(2, minmax(0, 1fr)))` and `var(--pr-plan-columns, repeat(auto-fit, minmax(220px, 320px)))`; in the 1040px and 1280px bands each `var(--pr-plan-columns, repeat(4, minmax(0, 1fr)))` then `var(--pr-plan-columns, repeat(3, minmax(0, 1fr)))`
- **AND** no rule whose selector contains `.pr-addon-grid` or `.pr-variable-grid` contains `--pr-plan-columns`

#### Scenario: Grid columns guard unchanged

- **GIVEN** `tests/unit/plan-grid-columns.test.ts`, whose evaluator unwraps `var(--pr-plan-columns, X)` to `X` and fails on any other variable name
- **WHEN** it runs
- **THEN** it passes with the expected columns per width and plan count it had at `9cf7e21`

#### Scenario: Host plan columns

- **GIVEN** the demo page at a 1440 × 900 viewport with a host rule `pricing-renderer { --pr-plan-columns: repeat(2, minmax(0, 1fr)); }`
- **WHEN** the renderer is ready
- **THEN** the computed `grid-template-columns` of `.pr-plan-grid` has two tracks
- **AND** the computed `grid-template-columns` of `.pr-addon-grid` equals its value without the host rule
