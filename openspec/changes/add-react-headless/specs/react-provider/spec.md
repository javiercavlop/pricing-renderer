## ADDED Requirements

### Requirement: Provider settings below instance settings

`req~provider-config-precedence~1`
WHERE a `PricingRendererProvider` is an ancestor, `PricingRenderer` and `usePricingSelection` SHALL take each of `locale`, `pricingPath`, `selectionEnabled`, `ctaEnabled` and `variablesEnabled` that they accept from the instance prop or option when it is defined, else from the provider `config`, else from the global configuration of `configurePricingRenderer`.

Needs: impl, utest

#### Scenario: Every key from the provider, then from the instance

- **GIVEN** `configurePricingRenderer({ locale: 'en-US' })` and a provider with `config` `{ locale: 'es-ES', pricingPath: 'catalog.pricing', selectionEnabled: false, ctaEnabled: false, variablesEnabled: false }`
- **WHEN** `PricingRenderer` with `yaml={acmeYaml}` (with `@lit/react` mocked to record its props) and a component using `usePricingSelection(acme, {})` render inside it with `renderToString`
- **THEN** the wrapper passes `locale` `es-ES`, `pricingPath` `catalog.pricing`, `selectionEnabled` `false`, `ctaEnabled` `false` and `variablesEnabled` `false`
- **AND** `viewModel.locale` is `es-ES`
- **AND** with the instance props `locale="fr-FR"`, `pricingPath="plans"`, `selectionEnabled`, `ctaEnabled` and `variablesEnabled` all `true`, the wrapper passes `fr-FR`, `plans`, `true`, `true` and `true`

### Requirement: Presentation precedence with a provider

`req~provider-presentation-precedence~1`
WHERE a provider is an ancestor, `PricingRenderer` and `usePricingSelection` SHALL merge presentation with `mergePresentationOptions` in this order, the later layer winning: `custom.pricingRenderer` of the pricing, the global configuration, the provider `config.presentation`, the provider `presentation`, the instance `presentation`.

Needs: impl, utest

#### Scenario: Plan badges by layer

- **GIVEN** a provider `presentation` with `planBadges.growth` `[{ id: 'p', label: 'Provider', tone: 'accent' }]`
- **WHEN** `usePricingSelection(acme, { presentation: { planBadges: { starter: [{ id: 'i', label: 'Instance', tone: 'accent' }] } } })` renders inside it with `renderToString`
- **THEN** `viewModel.presentation.planBadges.growth[0].label` is `Provider` and `planBadges.starter[0].label` is `Instance`
- **AND** with the instance entry under `growth` instead, `planBadges.growth[0].label` is `Instance`

#### Scenario: Global, provider config, provider presentation

- **GIVEN** `configurePricingRenderer({ presentation: { planBadges: { starter: [g], growth: [g], enterprise: [g] } } })` with `g` `{ id: 'g', label: 'Global', tone: 'accent' }`
- **AND** a provider with `config.presentation.planBadges` `{ growth: [c], enterprise: [c] }`, `c` with label `Config`, and `presentation.planBadges` `{ enterprise: [p] }`, `p` with label `Provider`
- **WHEN** `usePricingSelection(acme, {})` renders inside it with `renderToString`
- **THEN** `viewModel.presentation.planBadges` has `starter[0].label` `Global`, `growth[0].label` `Config` and `enterprise[0].label` `Provider`

### Requirement: Messages merge per key

`req~provider-messages-merge~1`
WHERE a provider with `messages` is an ancestor, `PricingRenderer` and `usePricingSelection` SHALL use as `messages` the provider catalog with each key of the instance `messages` replacing the same key.

Needs: impl, utest

#### Scenario: One key overridden

- **GIVEN** a provider with `messages` `{ 'summary.title': 'Your plan', 'cta.select': 'Pick' }`
- **WHEN** `PricingRenderer` renders inside it with `messages` `{ 'cta.select': 'Choose' }`, with `renderToString` and `@lit/react` mocked
- **THEN** the wrapper passes `messages` deeply equal to `{ 'summary.title': 'Your plan', 'cta.select': 'Choose' }`

### Requirement: Provider request and loader

`req~provider-request-loader~1`
WHERE a provider sets `request` or `loadPricing`, `PricingRenderer` with `src` and `usePricingSource` with `src` SHALL use the provider value for each of the two that the instance does not set, an instance value replacing the provider value as a whole, so that an instance `request` drops the provider's `maxBytes` and `timeoutMs` too.

Needs: impl, utest

#### Scenario: Shared loader, own request

- **GIVEN** a provider with a `loadPricing` spy and `request` `{ timeoutMs: 5000 }`, and `react` mocked as the hook harness of design.md D7 with `useContext` returning that provider value
- **WHEN** `usePricingSource({ src: 'https://example.com/acme.yml', request: { maxBytes: 4096 } })` is called and its recorded effects run
- **THEN** the spy was called once with `request.maxBytes` 4096 and `request.timeoutMs` 15000, the default, not the provider's 5000

### Requirement: Provider request headers stay on allowed origins

`req~provider-request-origin~1`
IF the instance sets no `request` and its `src` either is not an absolute URL or has an origin `new URL(src).origin` that is neither the page origin `globalThis.location.origin` (none on a server) nor the origin of an entry of the provider's `requestOrigins`, THEN `PricingRenderer` and `usePricingSource` SHALL use the provider `request` without its `headers` and `credentials`.

Needs: impl, utest

#### Scenario: Foreign origin gets no Authorization

- **GIVEN** `globalThis.location` stubbed with origin `https://app.example.com`, a provider with `request` `{ headers: { Authorization: 'Bearer t' }, credentials: 'include', timeoutMs: 5000 }` and a `loadPricing` spy, and `react` mocked as the hook harness of design.md D7 with `useContext` returning that provider value
- **WHEN** `usePricingSource({ src: 'https://cdn.example.net/acme.yml' })` is called and its recorded effects run
- **THEN** the spy's `request` has no `headers`, its `credentials` is `omit` and its `timeoutMs` is 5000
- **AND** with `src` `https://app.example.com/acme.yml` instead, the spy's `request.headers` deeply equals `{ Authorization: 'Bearer t' }` and its `credentials` is `include`

#### Scenario: Listed origin on a server

- **GIVEN** no `globalThis.location`, the provider of the scenario above with `requestOrigins` `['https://cdn.example.net']`, and the same harness
- **WHEN** `usePricingSource({ src: 'https://cdn.example.net/acme.yml' })` is called and its recorded effects run
- **THEN** the spy's `request.headers` deeply equals `{ Authorization: 'Bearer t' }`
- **AND** with `src` `https://app.example.com/acme.yml` instead, the spy's `request` has no `headers` and its `credentials` is `omit`

#### Scenario: Wrapper on a foreign origin

- **GIVEN** `globalThis.location` stubbed with origin `https://app.example.com` and the provider of the first scenario
- **WHEN** `PricingRenderer` with `src="https://cdn.example.net/acme.yml"` renders inside it with `renderToString` and `@lit/react` mocked
- **THEN** the wrapper passes `request` deeply equal to `{ timeoutMs: 5000 }`

### Requirement: Nearest provider wins

`req~provider-nearest~1`
WHERE providers are nested, the hooks and `PricingRenderer` SHALL read only the nearest provider, without merging the props of outer providers.

Needs: impl, utest

#### Scenario: Two providers

- **GIVEN** an outer provider with `config` `{ locale: 'es-ES' }` and an inner one with `messages` only
- **WHEN** `usePricingSelection(acme, {})` renders inside the inner provider with `renderToString`
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

### Requirement: No provider, no added settings

`req~provider-absent-unchanged~2`
WHILE no provider is an ancestor, `PricingRenderer` SHALL pass the element none of `locale`, `pricingPath`, `selectionEnabled`, `ctaEnabled`, `variablesEnabled`, `presentation`, `messages`, `request` and `loadPricing` that the host did not pass, as in 0.1.0.
Props that the wrapper derives from render props are specified by the composition capability.

Needs: impl, utest

#### Scenario: 0.1.0 usage

- **GIVEN** `configurePricingRenderer({ locale: 'es-ES', variablesEnabled: false })` and `<PricingRenderer yaml={acmeYaml} />` without a provider, with `@lit/react` mocked to record its props
- **WHEN** it is rendered with `renderToString`
- **THEN** the recorded props have none of the keys `locale`, `pricingPath`, `selectionEnabled`, `ctaEnabled`, `variablesEnabled`, `presentation`, `messages`, `request` and `loadPricing`
- **AND** with `locale="fr-FR"` the recorded props have `locale` `fr-FR` and none of the other eight keys
