## ADDED Requirements

### Requirement: Host dark class

`req~host-dark-class~2`
The default theme `src/styles/theme.css` SHALL list `.dark pricing-renderer[data-pr-root][theme='auto']` and `.dark pricing-change-review[theme='auto']` in the selector list of its dark rule, after the `[theme='dark']` selectors, so that a `.dark` ancestor applies the same token values as a `[data-theme='dark']` ancestor only when the element has `theme="auto"`. The selector list SHALL NOT contain the bare `.dark pricing-renderer[data-pr-root]` or `.dark pricing-change-review`, and the `@media (prefers-color-scheme: dark)` rule SHALL NOT contain `.dark`.

Needs: impl, utest

#### Scenario: Selector list

- **GIVEN** the text of `src/styles/theme.css`
- **WHEN** a unit test reads the selector list of the rule that starts with `pricing-renderer[data-pr-root][theme='dark']`
- **THEN** it contains `[data-theme='dark'] pricing-renderer[data-pr-root]`, `.dark pricing-renderer[data-pr-root][theme='auto']`, `[data-theme='dark'] pricing-change-review` and `.dark pricing-change-review[theme='auto']`
- **AND** `.dark pricing-renderer[data-pr-root][theme='auto']` comes after `pricing-renderer[data-pr-root][theme='dark']`
- **AND** it contains neither `.dark pricing-renderer[data-pr-root]` nor `.dark pricing-change-review` without the `[theme='auto']` part
- **AND** the rule is the one sliced by the dark-theme contrast test of `tests/unit/addon-marker.test.ts`, which still passes

#### Scenario: Dark under html.dark with theme=auto

- **GIVEN** the demo page with `styles.css`, a light system color scheme, the element's attribute `theme="auto"` and the class `dark` added to `<html>`
- **WHEN** the renderer is ready
- **THEN** the `pricing-renderer` element has computed `color-scheme` `dark`, computed `--pr-color-surface` `#181820` and computed `--pr-color-accent` `#9b8cff`
- **AND** after the class is removed the computed `--pr-color-surface` is the light value again

#### Scenario: No change with an explicit theme

- **GIVEN** the demo page with `<html class="dark">`
- **WHEN** the element has `theme="light"` (the default)
- **THEN** the computed `--pr-color-surface` is not `#181820` and the computed `color-scheme` is `light`, as without the class
- **AND** with `theme="dark"` the computed `--pr-color-surface` stays `#181820`

### Requirement: shadcn overlay layering

`req~tokens-shadcn-overlay~2`
The style sheet `src/styles/tokens-shadcn.css` SHALL have `@layer pricing-renderer.theme, pricing-renderer.shadcn;` as its first statement and every rule inside `@layer pricing-renderer.shadcn`, declaring no `--pr-color-success`, `--pr-color-warning`, `--pr-color-warning-surface` or `--pr-color-overlay`. The overlay SHALL follow the host `.dark` class only for elements with `theme="auto"`: its `color-scheme: dark` rule SHALL use the selectors `.dark pricing-renderer[data-pr-root][theme='auto']` and `.dark pricing-change-review[theme='auto']`, never the bare `.dark pricing-renderer[data-pr-root]` or `.dark pricing-change-review`.

Needs: impl, utest

#### Scenario: File structure

- **GIVEN** the text of `src/styles/tokens-shadcn.css` (the test first asserts that the file exists)
- **WHEN** a unit test strips comments and reads the top-level statements
- **THEN** the first statement is `@layer pricing-renderer.theme, pricing-renderer.shadcn;`
- **AND** every other top-level statement is an `@layer pricing-renderer.shadcn { … }` block
- **AND** the text does not contain `--pr-color-success:`, `--pr-color-warning:`, `--pr-color-warning-surface:` or `--pr-color-overlay:`

#### Scenario: Import order does not matter

- **GIVEN** a host page that sets on `:root` `--primary: oklch(0.205 0 0)`, `--primary-foreground: oklch(0.985 0 0)`, `--card: oklch(1 0 0)` and `--radius: 0.625rem`
- **WHEN** the page loads `styles.css` then `tokens-shadcn.css`, and in a second run `tokens-shadcn.css` then `styles.css`
- **THEN** in both runs the background color of `button[data-pr-part='cta'][data-kind='primary']` is `oklch(0.205 0 0)`, the background color of the first `.pr-plan-card` is `oklch(1 0 0)` and the computed `--pr-color-success` of the element is `#087f5b`

### Requirement: shadcn token mapping

`req~tokens-shadcn-mapping~1`
The overlay `src/styles/tokens-shadcn.css` SHALL map the shadcn variables to the renderer tokens as in the table of design.md, D8, on `pricing-renderer[data-pr-root]` and `pricing-change-review` with `color-scheme: light`, and set `color-scheme: dark` on both under a `.dark` ancestor when the element has `theme="auto"`.

Needs: impl, utest

#### Scenario: Declarations

- **GIVEN** the text of `src/styles/tokens-shadcn.css`
- **WHEN** a unit test reads the rule for `pricing-renderer[data-pr-root], pricing-change-review` and the rule for `.dark pricing-renderer[data-pr-root][theme='auto'], .dark pricing-change-review[theme='auto']`
- **THEN** the first has exactly `color-scheme: light`, `--pr-color-accent: var(--primary)`, `--pr-color-on-accent: var(--primary-foreground)`, `--pr-color-text: var(--foreground)`, `--pr-color-muted: var(--muted-foreground)`, `--pr-color-surface: var(--card)`, `--pr-color-surface-raised: var(--popover)`, `--pr-color-surface-subtle: var(--muted)`, `--pr-color-border: var(--border)`, `--pr-color-border-strong: var(--input)`, `--pr-color-focus: var(--ring)`, `--pr-color-link: var(--primary)`, `--pr-radius-lg: var(--radius)`, `--pr-radius-md: calc(var(--radius) - 2px)` and `--pr-radius-sm: calc(var(--radius) - 4px)`
- **AND** the second has exactly `color-scheme: dark`

#### Scenario: Host dark mode follows .dark

- **GIVEN** a host page with `styles.css` and `tokens-shadcn.css`, `:root { --primary: oklch(0.205 0 0); }` and `.dark { --primary: oklch(0.922 0 0); }`
- **AND** the element has `theme="auto"` under a light system color scheme
- **WHEN** the class `dark` is added to `<html>`
- **THEN** the background color of `button[data-pr-part='cta'][data-kind='primary']` is `oklch(0.922 0 0)`, the element's computed `color-scheme` is `dark` and its computed `--pr-color-success` is `#66d9ad`

### Requirement: shadcn overlay export

`req~tokens-shadcn-export~1`
The package manifest SHALL export the subpath `./tokens-shadcn.css` as `./dist/styles/tokens-shadcn.css`.

Needs: utest

#### Scenario: Export entry

- **GIVEN** `package.json` parsed as JSON
- **WHEN** a unit test reads `exports['./tokens-shadcn.css']`
- **THEN** it is `'./dist/styles/tokens-shadcn.css'`

### Requirement: Minimal theme token set

`req~theme-minimal-tokens~1`
The style sheet `src/styles/theme-minimal.css` SHALL be a full replacement for `src/styles/theme.css`, in `@layer pricing-renderer.theme`, with the same rules in the same order, each with the same selector list (light, dark with the `.dark …[theme='auto']` selectors, `theme='auto'` under `@media (prefers-color-scheme: dark)`) and the same set of declared properties.

Needs: impl, utest

#### Scenario: Same rules and properties as theme.css

- **GIVEN** the texts of `src/styles/theme.css` and `src/styles/theme-minimal.css` (the test first asserts that the second exists)
- **WHEN** a unit test parses both into rules (layer, enclosing media query, selector list, set of property names)
- **THEN** the two lists are equal

#### Scenario: Used with base.css

- **GIVEN** a page that loads `base.css` and `theme-minimal.css` and renders the Acme pricing
- **WHEN** the renderer is ready
- **THEN** the element's computed `--pr-space-4` is `1rem` and its computed `--pr-color-text` is the value declared by `theme-minimal.css`

### Requirement: Minimal theme is flat and neutral

`req~theme-minimal-flat~1`
The style sheet `src/styles/theme-minimal.css` SHALL declare every `--pr-shadow-*` token as `none`, `--pr-color-border` and `--pr-color-border-strong` as `currentColor`, and every other `--pr-color-*` token except `--pr-color-success`, `--pr-color-warning` and `--pr-color-warning-surface` as a six-digit hex gray whose red, green and blue are equal.

Needs: impl, utest

#### Scenario: Declared values

- **GIVEN** the text of `src/styles/theme-minimal.css`
- **WHEN** a unit test reads every declaration
- **THEN** each `--pr-shadow-*` value is `none`, each `--pr-color-border` and `--pr-color-border-strong` value is `currentColor`
- **AND** each value of `--pr-color-text`, `--pr-color-muted`, `--pr-color-surface`, `--pr-color-surface-raised`, `--pr-color-surface-subtle`, `--pr-color-accent`, `--pr-color-on-accent`, `--pr-color-link`, `--pr-color-focus` and `--pr-color-overlay` matches `/^#([0-9a-f]{2})\1\1$/i`

#### Scenario: Flat cards in the browser

- **GIVEN** a page that loads `base.css` and `theme-minimal.css` and renders the Acme pricing
- **WHEN** the renderer is ready
- **THEN** the first `.pr-plan-card` has computed `box-shadow` `none` and a computed `border-top-color` equal to its computed `color`

### Requirement: Minimal theme contrast

`req~theme-minimal-contrast~1`
The style sheet `src/styles/theme-minimal.css` SHALL give, in each of its light, dark and `theme='auto'` dark rules, a WCAG 2 contrast ratio of at least 4.5:1 to `--pr-color-text` and `--pr-color-muted` against `--pr-color-surface`, `--pr-color-surface-raised` and `--pr-color-surface-subtle`, to `--pr-color-on-accent` against `--pr-color-accent`, and to `--pr-color-link` against `--pr-color-surface` and `--pr-color-surface-raised`.

Needs: impl, utest

#### Scenario: Ratios per rule

- **GIVEN** the values of the light rule, the dark rule and the `theme='auto'` rule of `src/styles/theme-minimal.css`, with a token missing from a dark rule taken from the light rule
- **WHEN** a unit test computes the WCAG 2 relative-luminance contrast ratio of the nine pairs of the requirement in each rule
- **THEN** every ratio is at least 4.5

#### Scenario: Automated accessibility check

- **GIVEN** a page that loads `base.css` and `theme-minimal.css` and renders the Acme pricing, once with `theme="light"` and once with `theme="dark"`
- **WHEN** axe runs with the tags `wcag2a`, `wcag2aa`, `wcag21aa` and `wcag22aa`
- **THEN** it reports no `color-contrast` violation

### Requirement: Minimal theme export

`req~theme-minimal-export~1`
The package manifest SHALL export the subpath `./theme-minimal.css` as `./dist/styles/theme-minimal.css`.

Needs: utest

#### Scenario: Export entry

- **GIVEN** `package.json` parsed as JSON
- **WHEN** a unit test reads `exports['./theme-minimal.css']`
- **THEN** it is `'./dist/styles/theme-minimal.css'`
