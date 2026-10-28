## ADDED Requirements

### Requirement: Density attribute and property

`req~density-attribute~1`
The `<pricing-renderer>` element SHALL expose a `density` property of type `'comfortable' | 'compact'`, default `'comfortable'`, set by the attribute `density` and reflected to it only when the property is set, any value other than exactly `compact` reading as `comfortable`, with no default attribute, no `data-density` markup and no CSS rule for `comfortable`, so the default look is unchanged.

Needs: impl, utest

#### Scenario: Default and reflection

- **GIVEN** a new `<pricing-renderer>` created with `document.createElement('pricing-renderer')` on the demo page and appended to `document.body`
- **WHEN** its first update completes
- **THEN** `element.density` is `'comfortable'` and `element.hasAttribute('density')` is `false`
- **AND** after `element.density = 'compact'` and the next update, `element.getAttribute('density')` is `'compact'`

#### Scenario: Default stays unchanged

- **GIVEN** the sources in `src/element/` and the files `src/styles/theme.css` and `src/styles/base.css`
- **WHEN** a unit test reads them
- **THEN** no element source contains `data-density` and `theme.css` does not mention density
- **AND** `base.css` declares no spacing token (`--pr-space-*`, `--pr-shell-padding`) outside the compact block

#### Scenario: Attribute sets the property

- **GIVEN** the demo element
- **WHEN** the host calls `element.setAttribute('density', 'compact')`
- **THEN** `element.density` is `'compact'`

#### Scenario: Other values read as comfortable

- **GIVEN** a new element whose `density` is `'compact'`
- **WHEN** a unit test assigns `'tight'`, `'Compact'`, `''`, `'compact '`, `0`, `null`, `undefined` or `{}`
- **THEN** `element.density` is `'comfortable'` after each assignment

#### Scenario: Declaration in node

- **GIVEN** `PricingRendererElement` imported in a unit test
- **WHEN** the test reads its static property declaration `density`
- **THEN** it has `type: String` and `reflect: true`

#### Scenario: Unknown value renders as comfortable

- **GIVEN** the demo element with `density="dense"`
- **WHEN** the renderer is ready
- **THEN** its computed `--pr-space-4` is `1rem` and its computed `--pr-font-size-lg` is `1.125rem`

### Requirement: Compact density tokens

`req~density-compact-tokens~1`
WHILE the element has `density="compact"`, the base style sheet SHALL override only the spacing tokens `--pr-space-1` to `--pr-space-5`, `--pr-space-section` and `--pr-shell-padding` with the compact values of design.md, each smaller than its `theme.css` default, in one rule `pricing-renderer[density='compact']` placed directly in `@layer pricing-renderer`, and change no font-size token.

Needs: impl, utest

#### Scenario: Rule in base.css

- **GIVEN** the text of `src/styles/base.css`
- **WHEN** a unit test finds the rules whose selector has `[density='compact']`
- **THEN** there is exactly one, with the selector `pricing-renderer[density='compact']` and no `[data-pr-root]`, and it is inside `@layer pricing-renderer` and not inside a nested `@layer`, `@media`, `@container` or `@supports`
- **AND** it declares exactly `--pr-space-1: 0.2rem`, `--pr-space-2: 0.4rem`, `--pr-space-3: 0.55rem`, `--pr-space-4: 0.75rem`, `--pr-space-5: 1.1rem`, `--pr-space-section: clamp(2rem, 5cqi, 4rem)` and `--pr-shell-padding: clamp(0.75rem, 3cqi, 2rem)`
- **AND** it declares no font-size, color, shadow or radius token
- **AND** no selector of `src/styles/*.css` contains `density='comfortable'` or `density="comfortable"`

#### Scenario: Compact beats the theme files

- **GIVEN** the demo page at a 1440 × 900 viewport with `density="compact"`, once with `styles.css` and once with `base.css` and `theme-minimal.css`
- **WHEN** the renderer is ready
- **THEN** in both runs the element's computed `--pr-space-4` is `0.75rem` and the first `.pr-plan-card` has computed `padding-top` `12px`
- **AND** `--pr-font-size-lg` is `1.125rem`, as without `density`

#### Scenario: Unlayered host tokens still win

- **GIVEN** the demo page with `density="compact"` and a host rule `pricing-renderer { --pr-space-4: 2rem; }`
- **WHEN** the renderer is ready
- **THEN** the element's computed `--pr-space-4` is `2rem`

### Requirement: React density prop

`req~density-react~1`
The React component `PricingRenderer` SHALL accept an optional `density` prop of type `'comfortable' | 'compact'`.

Needs: impl, utest

#### Scenario: Prop type

- **GIVEN** a snippet that renders `<PricingRenderer yaml={source} density="compact" />` and a second snippet that renders `<PricingRenderer yaml={source} density="dense" />`
- **WHEN** a unit test type-checks both with the TypeScript compiler API
- **THEN** the first reports no error and the second reports error TS2322

### Requirement: Density in the manifest

`req~density-manifest~1`
The manifest `custom-elements.json` SHALL declare on `PricingRendererElement` a field `density` with type text `"comfortable" | "compact"` and attribute `density`, and an attribute `density` with `fieldName` `density`.

Needs: utest

#### Scenario: Manifest entries

- **GIVEN** `custom-elements.json` parsed as JSON
- **WHEN** a unit test reads the `PricingRendererElement` declaration
- **THEN** a member has `kind: 'field'`, `name: 'density'`, type text `"comfortable" | "compact"` and `attribute: 'density'`
- **AND** an attribute has `name: 'density'`, `fieldName: 'density'` and type text `"comfortable" | "compact"`
