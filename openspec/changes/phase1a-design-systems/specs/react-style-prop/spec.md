## ADDED Requirements

### Requirement: React style prop

`req~react-style-prop~1`
The React component `PricingRenderer` SHALL accept an optional `style` prop typed as `React.CSSProperties` extended with custom property keys of the form `` `--${string}` `` whose values are `string` or `number`, and pass that object unchanged to the rendered `pricing-renderer` element.

Needs: impl, utest

#### Scenario: Valid style objects type-check

- **GIVEN** a snippet that imports `PricingRenderer` from `src/react/index.ts` and renders `<PricingRenderer yaml={source} style={{ '--pr-color-accent': '#f00', '--pr-plan-columns': 2, color: 'red' }} />`
- **WHEN** a unit test type-checks it with the TypeScript compiler API
- **THEN** it reports no error

#### Scenario: A string style is rejected

- **GIVEN** a snippet that renders `<PricingRenderer yaml={source} style="color: red" />`
- **WHEN** a unit test type-checks it with the TypeScript compiler API
- **THEN** it reports error TS2322

#### Scenario: The object reaches the element unchanged

- **GIVEN** `@lit/react` mocked so that `createComponent` returns a component that records the props it receives, as in `tests/unit/spectra-followups-react.test.ts`
- **AND** the object `s = { '--pr-color-accent': '#f00', color: 'red' }`
- **WHEN** a unit test renders `<PricingRenderer yaml={source} style={s} />` with `react-dom/server`
- **THEN** the recorded `style` prop is `s` (the same reference)

### Requirement: React class name

`req~react-classname~1`
The React component `PricingRenderer` SHALL pass its optional `className` prop to the rendered `pricing-renderer` element.

Needs: impl, utest

#### Scenario: Class name recorded

- **GIVEN** `@lit/react` mocked as in the scenario "The object reaches the element unchanged"
- **WHEN** a unit test renders `<PricingRenderer yaml={source} className="pricing pricing--wide" />` with `react-dom/server`
- **THEN** the recorded `className` prop is `'pricing pricing--wide'`
