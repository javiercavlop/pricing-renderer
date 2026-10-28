## ADDED Requirements

### Requirement: Hide sections property and attribute

`req~hide-sections-property~1`
The `<pricing-renderer>` element SHALL accept a `hideSections` property of type `readonly PricingSectionName[] | undefined`, with `PricingSectionName` being `'hero' | 'metadata' | 'billing' | 'variables' | 'plans' | 'comparison' | 'addOns' | 'summary'`, also set by the attribute `hide-sections` as a list of tokens separated by ASCII whitespace.

Needs: impl, utest

#### Scenario: Attribute to property

- **GIVEN** a new element: a `<pricing-renderer>` given `pricing` Acme (`tests/fixtures/acme-pricing.yml` normalized, presentation title `Simple pricing that scales with you`, with billing periods, variables, features and add-ons), `locale: 'en-US'`, `mode: 'catalog'` and the properties of the scenario, appended to `document.body` in a browser test; a unit test instead builds it in node without a document, runs its `reload()` with `requestUpdate` and `dispatchEvent` stubbed, and reads parts and text from the flattened `render()` output; every scenario of this capability uses "a new element" in this sense
- **WHEN** the host calls `element.setAttribute('hide-sections', ' hero  addOns ')`
- **THEN** `element.hideSections` is `['hero', 'addOns']`

#### Scenario: Not set

- **GIVEN** a new element without `hideSections`
- **WHEN** it is ready
- **THEN** each of the eight section parts of "Section parts" exists once

### Requirement: Hide sections attribute converter

`req~hide-sections-attribute-converter~1`
The module `src/element/pricing-renderer-element.ts` SHALL export `hideSectionsConverter`, the converter of the `hide-sections` attribute, whose `fromAttribute(value)` returns `undefined` for `null` and otherwise the tokens of `value` separated by ASCII whitespace that are a `PricingSectionName`, in their order.

Needs: impl, utest

#### Scenario: Tokens to names

- **GIVEN** `hideSectionsConverter` imported in node from `src/element/pricing-renderer-element.ts`
- **WHEN** a unit test calls `fromAttribute` with `' hero  addOns '`, `'hero footer Plans addons'`, `'\tsummary\nplans'`, `''` and `null`
- **THEN** the results are `['hero', 'addOns']`, `['hero']`, `['summary', 'plans']`, `[]` and `undefined`

### Requirement: Hidden sections render nothing

`req~hide-sections-render~1`
WHILE `hideSections` includes a section name, the element SHALL render no markup of that section, while every section whose name it does not include renders as it does without `hideSections`, apart from the summary placement of "Summary without the add-ons section".

Needs: impl, utest

#### Scenario: Section parts

- **GIVEN** the section parts `hero` → `[data-pr-part="hero"]`, `metadata` → `[data-pr-part="metadata"]`, `billing` → `[data-pr-part="billing"]`, `variables` → `[data-pr-part="variables"]`, `plans` → `[data-pr-part="plans"]`, `comparison` → `[data-pr-part="comparison"]`, `addOns` → `[data-pr-part="add-ons"]` and `summary` → `[data-pr-part="summary"]`; every scenario of this capability that names "the section parts" uses this list
- **WHEN** a section name is in `hideSections`
- **THEN** the part of that section does not exist

#### Scenario: One section at a time

- **GIVEN** one new element per section name, with `hideSections` set to that name only
- **WHEN** each is ready
- **THEN** each element has no part of its hidden section and one of each of the seven other section parts

### Requirement: Summary without the add-ons section

`req~hide-sections-addons-summary~1`
WHILE `hideSections` includes `'addOns'` and not `'summary'`, the element SHALL render the summary in the place where it renders the summary of a pricing without add-ons.

Needs: impl, utest

#### Scenario: Add-ons hidden, summary kept

- **GIVEN** a new element with `hideSections` `['addOns']`
- **WHEN** it is ready
- **THEN** no `[data-pr-part="add-ons"]` and no `[data-pr-part="add-on-card"]` exist, and one `[data-pr-part="summary"]` outside every add-on layout shows the subtotal of the selection in effect

#### Scenario: All sections hidden

- **GIVEN** a new element with `hideSections` `['hero', 'metadata', 'billing', 'variables', 'plans', 'comparison', 'addOns', 'summary']`
- **WHEN** it is ready
- **THEN** `section.pr-shell` exists and none of the eight section parts exists

#### Scenario: Loading and error are not sections

- **GIVEN** a new element with `hideSections` set to all eight names and `yaml` `'plans: ['` in place of `pricing`
- **WHEN** the update after the failed load completes
- **THEN** `.pr-error` renders its heading, message and `[data-pr-part="diagnostics"]`

### Requirement: Accessible name without the hero

`req~hide-sections-hero-name~1`
WHILE `hideSections` includes `'hero'`, the element SHALL render inside `section.pr-shell` an `h2` with the class `pr-sr-only`, the id that the shell's `aria-labelledby` references and the text the hero title would show.

Needs: impl, utest

#### Scenario: Hidden title markup

- **GIVEN** a `<pricing-renderer>` built in node without a document, with `pricing` Acme, `locale: 'en-US'`, `mode: 'catalog'`, a ready state and `hideSections` `['hero']`
- **WHEN** a unit test flattens the template that `render()` returns
- **THEN** the markup holds no `data-pr-part="hero"`, and one `h2` with the class `pr-sr-only`, the text `Simple pricing that scales with you` and an `id` equal to the `aria-labelledby` value of `section.pr-shell`

#### Scenario: Hero hidden

- **GIVEN** a new element with `hideSections` `['hero']`
- **WHEN** it is ready
- **THEN** `document.getElementById(shell.getAttribute('aria-labelledby'))` is an `h2.pr-sr-only` with the text `Simple pricing that scales with you`, no `[data-pr-part="hero"]` exists, and the accessible name of `section.pr-shell` is `Simple pricing that scales with you`

#### Scenario: Presentation title

- **GIVEN** a new element with `hideSections` `['hero']` and `presentation.title` `'Plans for teams'`
- **WHEN** it is ready
- **THEN** the hidden `h2` has the text `Plans for teams`

### Requirement: Unknown section tokens

`req~hide-sections-unknown~2`
IF the attribute `hide-sections` or the property `hideSections` holds a value that is not a `PricingSectionName`, or the property holds a value that is not an array, THEN the element SHALL ignore that value, a property value that is not an array counting as `undefined` and the attribute converter keeping only the known tokens in their order.

Needs: impl, utest

#### Scenario: Unknown and differently cased tokens

- **GIVEN** a new element
- **WHEN** the host sets the attribute `hide-sections` to `'hero footer Plans addons'` and the next update completes
- **THEN** `element.hideSections` is `['hero']`, no `[data-pr-part="hero"]` exists, the other seven section parts exist, and no error is thrown or logged

#### Scenario: Unknown value set as a property

- **GIVEN** a new element
- **WHEN** the host sets `hideSections` to `['plans', 'footer']` from untyped code and the next update completes
- **THEN** no `[data-pr-part="plans"]` exists and the other seven section parts exist

#### Scenario: Property that is not an array

- **GIVEN** a new element
- **WHEN** the host sets `hideSections`, from untyped code, to `null`, then to `'hero'`, then to `1`, then to `{ 0: 'hero', length: 1 }`, each time followed by a completed update
- **THEN** after each update each of the eight section parts of "Section parts" exists once, and no error is thrown or logged

### Requirement: React prop and manifest for hidden sections

`req~hide-sections-react-manifest~1`
The package SHALL export the type `PricingSectionName` from the entries `pricing-renderer/element` and `pricing-renderer/react` and expose `hideSections` as an optional `readonly PricingSectionName[]` prop of `PricingRendererSharedProps` and as a field with the attribute `hide-sections` in the `PricingRendererElement` declaration of `custom-elements.json`.

Needs: impl, utest

#### Scenario: Prop type and manifest entry

- **GIVEN** a snippet that imports `PricingSectionName` from `src/react/index.ts` and, as `ElementSectionName`, from `src/element/index.ts`, declares `const names: readonly PricingSectionName[] = ['hero'] satisfies readonly ElementSectionName[]` and renders `<PricingRenderer yaml={source} hideSections={['hero', 'comparison']} />`, a second snippet with `hideSections={['footer']}`, and `custom-elements.json` parsed as JSON
- **WHEN** a unit test type-checks both snippets and reads the `PricingRendererElement` declaration
- **THEN** the first snippet has no error and the second has error TS2322
- **AND** a member has `kind: 'field'` and `name: 'hideSections'`, and an attribute has `name: 'hide-sections'` and `fieldName: 'hideSections'`
