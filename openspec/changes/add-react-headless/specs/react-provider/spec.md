## ADDED Requirements

### Requirement: Provider settings below instance settings

`req~provider-config-precedence~1`
WHERE a `PricingRendererProvider` is an ancestor, `PricingRenderer` and `usePricingSelection` SHALL take each of `locale`, `pricingPath`, `selectionEnabled`, `ctaEnabled` and `variablesEnabled` that they accept from the instance prop or option when it is defined, else from the provider `config`, else from the global configuration of `configurePricingRenderer`.

Needs: impl, utest

#### Scenario: Locale from the provider, then from the instance

- **GIVEN** `configurePricingRenderer({ locale: 'en-US' })` and a provider with `config` `{ locale: 'es-ES', variablesEnabled: false }`
- **WHEN** `PricingRenderer` (with `@lit/react` mocked) and `usePricingSelection(acme, {})` render inside it
- **THEN** the wrapper passes `locale` `es-ES` and `variablesEnabled` `false`, and `viewModel.locale` is `es-ES`
- **AND** with the instance prop `locale="fr-FR"` the wrapper passes `fr-FR`

### Requirement: Presentation precedence with a provider

`req~provider-presentation-precedence~1`
WHERE a provider is an ancestor, `PricingRenderer` and `usePricingSelection` SHALL merge presentation with `mergePresentationOptions` in this order, the later layer winning: `custom.pricingRenderer` of the pricing, the global configuration, the provider `config.presentation`, the provider `presentation`, the instance `presentation`.

Needs: impl, utest

#### Scenario: Plan badges by layer

- **GIVEN** a provider `presentation` with `planBadges.growth` `[{ id: 'p', label: 'Provider', tone: 'accent' }]`
- **WHEN** `usePricingSelection(acme, { presentation: { planBadges: { starter: [{ id: 'i', label: 'Instance', tone: 'accent' }] } } })` renders inside it
- **THEN** `viewModel.presentation.planBadges.growth[0].label` is `Provider` and `planBadges.starter[0].label` is `Instance`
- **AND** with the instance entry under `growth` instead, `planBadges.growth[0].label` is `Instance`

### Requirement: Messages merge per key

`req~provider-messages-merge~1`
WHERE a provider with `messages` is an ancestor, `PricingRenderer` and `usePricingSelection` SHALL use as `messages` the provider catalog with each key of the instance `messages` replacing the same key.

Needs: impl, utest

#### Scenario: One key overridden

- **GIVEN** a provider with `messages` `{ 'summary.title': 'Your plan', 'cta.select': 'Pick' }`
- **WHEN** `PricingRenderer` renders inside it with `messages` `{ 'cta.select': 'Choose' }`
- **THEN** the wrapper passes `messages` deeply equal to `{ 'summary.title': 'Your plan', 'cta.select': 'Choose' }`

### Requirement: Provider request and loader

`req~provider-request-loader~1`
WHERE a provider sets `request` or `loadPricing`, `PricingRenderer` with `src` and `usePricingSource` with `src` SHALL use the provider value for each of the two that the instance does not set, an instance value replacing the provider value as a whole.

Needs: impl, utest

#### Scenario: Shared loader, own request

- **GIVEN** a provider with a `loadPricing` spy and `request` `{ timeoutMs: 5000 }`
- **WHEN** `usePricingSource({ src: 'https://example.com/acme.yml', request: { maxBytes: 4096 } })` loads inside it
- **THEN** the options given to `loadPricingSource` have `loadPricing` equal to the spy and `request` deeply equal to `{ maxBytes: 4096 }`

### Requirement: Nearest provider wins

`req~provider-nearest~1`
WHERE providers are nested, the hooks and `PricingRenderer` SHALL read only the nearest provider, without merging the props of outer providers.

Needs: impl, utest

#### Scenario: Two providers

- **GIVEN** an outer provider with `config` `{ locale: 'es-ES' }` and an inner one with `messages` only
- **WHEN** `usePricingSelection(acme, {})` renders inside the inner provider
- **THEN** `viewModel.locale` is the global `en-US`

### Requirement: Provider keeps the global configuration

`req~provider-no-global-write~1`
The `PricingRendererProvider` SHALL NOT call `configurePricingRenderer` or `registerMessageCatalog`, so its settings reach only its own tree.

Needs: impl, utest

#### Scenario: Server render of two trees

- **GIVEN** the default global configuration
- **WHEN** a provider with `config` `{ locale: 'es-ES' }` is rendered with `renderToString`
- **THEN** `getPricingRendererConfig().locale` is still `en-US`
- **AND** a second tree without a provider renders `viewModel.locale` `en-US`

### Requirement: Hooks read the global configuration without a provider

`req~provider-absent-global~1`
WHILE no provider is an ancestor, `usePricingSelection` SHALL take the `locale`, `variablesEnabled` and presentation layer that its options do not set from `getPricingRendererConfig()` at render time.

Needs: impl, utest

#### Scenario: Global locale

- **GIVEN** `configurePricingRenderer({ locale: 'es-ES', variablesEnabled: false })` and no provider
- **WHEN** `usePricingSelection(acme, { defaultSelection: { variables: { seats: 40 } } })` renders with `renderToString`
- **THEN** `viewModel.locale` is `es-ES` and `selection.variables.seats` is 5
- **AND** with the option `locale: 'fr-FR'` the view model has `locale` `fr-FR`

### Requirement: No provider, no change

`req~provider-absent-unchanged~1`
WHILE no provider is an ancestor, `PricingRenderer` SHALL pass the element exactly the props that the host passed, as in 0.1.0.

Needs: impl, utest

#### Scenario: 0.1.0 usage

- **GIVEN** `configurePricingRenderer({ locale: 'es-ES' })` and `<PricingRenderer yaml={acmeYaml} />` without a provider, with `@lit/react` mocked
- **WHEN** it renders
- **THEN** the mocked component gets no `locale`, `presentation`, `messages`, `request` or `loadPricing` prop
