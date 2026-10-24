# Spec: explain the estimated total with a price breakdown

Change `delivera-3-price-breakdown`, written before the implementation: the requirements below are
the contract for the tests of `pricing-renderer`. The public API they describe is NOT approved yet:
every requirement listed under "Decisions pending" in `proposal.md` is pending approval and must
not be implemented before the owner decides. The audit follow-ups (the last requirement group) do
not depend on it.

## Definitions

- Acme fixture: `tests/fixtures/acme-pricing.yml` parsed and normalized. Currency `EUR`. Schema
  defaults: `{ planId: 'starter', billingPeriod: 'monthly', variables, addOns: {} }` with
  `variables` equal to
  `{ seats: 5, prioritySupport: false, region: 'eu', priceByRegion: { 'eu-price': 8, 'us-price': 10 } }`.
  Billing periods, in this order: `monthly` (normalized label `Monthly`, multiplier 1) and
  `yearly` (label `Yearly`, multiplier 0.8); the presentation labels of the billing control are
  also `Monthly` and `Yearly`. Add-ons in declaration order: `extraStorage` (name
  `Extra Storage`, 5 per pack, available for `growth` and `enterprise`, quantity 1 to 10, step 1),
  `compliance`
  (name `Compliance`, label price `Contact sales`, `enterprise` only, no quantity constraints),
  `prioritySuccess` (name `Priority Success`, 25 with 5 seats, available for `growth` and
  `enterprise`, depends on `extraStorage`, excludes `compliance`, no quantity constraints).
- Acme prices with the default variables, monthly and yearly (multiplier 0.8): Starter 20 and 16,
  Growth 45 and 36, Enterprise 40 and 32, `extraStorage` 5 and 4 per pack, `prioritySuccess` 25
  and 20. The yearly values are exact in IEEE 754 double precision for these operands (checked by
  hand: for example `45 * 0.8` is 36.0000000000000019984 before rounding, within half a unit in
  the last place of 36, so it rounds to 36); tests may use `toBe` for them. A test that finds
  otherwise reports a defect of this spec instead of loosening the assertion.
- Zoom fixture: `tests/fixtures/spectra/zoom/2024.yml` parsed and normalized. Currency `USD`.
  Billing: `monthly` (label `Monthly`, 1) and `annual` (label `Annual`, 0.83). Plans: `BASIC` 0,
  `PRO` 15.99, `BUSINESS` 19.99, `BUSINESS_PLUS` 29.99, `ENTERPRISE` label `Contact us`. Add-ons
  in declaration order: `largeMeetings` 50, `zoomScheduler` 5.49 (`BASIC`, `PRO`, `ENTERPRISE`),
  `zoomClipsPlus` 6.59, `extraCloudRecordingStorage` 40 (`PRO`, `BUSINESS`, `BUSINESS_PLUS`;
  minimum 1, no maximum (`.inf`), step 1), `zoomWhiteboard` 2.49 (`BASIC`, `PRO`),
  `zoomTranslatedCaptions` 5, `audioConferencing` 100 (`PRO`, `BUSINESS`, `ENTERPRISE`),
  `premierSupport` label `Contact us` (excludes `premierPlusSupport`), then nine more add-ons. No
  plan or add-on of the fixture has a `name`, so names are `humanizeIdentifier(id)`.
- Slack fixture: `tests/fixtures/spectra/slack/2024.yml` parsed and normalized. Currency `USD`. It
  has no `billing` block, so its only billing period is `{ id: 'base', label: 'Base', multiplier: 1 }`.
  Plans: `FREE` 0, `PRO` 8.75, `BUSINESS_PLUS` 15, `ENTERPRISE_GRID` label `Contact Sales`. Add-ons
  in declaration order: `slackAI` (label `Contact Sales`; `PRO`, `BUSINESS_PLUS`,
  `ENTERPRISE_GRID`), `slackAtlas`, `slackEnterpriseKeys`, `premiumWorkflowOverageCost` (0.05 per
  execution; `PRO`, `BUSINESS_PLUS`, `ENTERPRISE_GRID`; minimum 1, no maximum, step 1).
- Selections below are inputs of `resolvePricing` and `applySelection`; omitted fields take the
  schema defaults.
- Selection `C`: `{ planId: 'growth', addOns: { extraStorage: { selected: true, quantity: 2 }, prioritySuccess: { selected: true, quantity: 1 } } }`.
  Subtotal 80 monthly.
- Selection `CY`: `C` with `billingPeriod: 'yearly'`. Subtotal 64 (36 + 2 x 4 + 20).
- Selection `E`: `{ planId: 'enterprise', addOns: { extraStorage: { selected: true, quantity: 3 }, compliance: { selected: true, quantity: 1 } } }`.
  Subtotal 55 (40 + 3 x 5), quote required for `compliance`.
- Selection `X`: `{ planId: 'growth', variables: { seats: 'not-a-number' }, addOns: { extraStorage: { selected: true, quantity: 1 }, prioritySuccess: { selected: true, quantity: 1 } } }`.
  The Growth and `prioritySuccess` expressions yield `NaN` and cannot be resolved; subtotal 5.
- Selection `ZA` (Zoom): `{ planId: 'PRO', billingPeriod: 'annual', addOns: { extraCloudRecordingStorage: { selected: true, quantity: 3 }, audioConferencing: { selected: true, quantity: 1 }, premierSupport: { selected: true, quantity: 1 } } }`.
  Decimal values: PRO 15.99 x 0.83 = 13.2717, storage 40 x 0.83 x 3 = 99.6,
  audio 100 x 0.83 = 83, subtotal 195.8717, quote required for `premierSupport`.
- Selection `ZM` (Zoom), keys deliberately in reverse declaration order:
  `{ planId: 'PRO', addOns: { zoomWhiteboard: { selected: true, quantity: 1 }, zoomClipsPlus: { selected: true, quantity: 1 }, zoomScheduler: { selected: true, quantity: 1 } } }`.
  Decimal subtotal 15.99 + 5.49 + 6.59 + 2.49 = 30.56.
- Selection `S1` (Slack): `{ planId: 'PRO', addOns: { slackAI: { selected: true, quantity: 1 }, premiumWorkflowOverageCost: { selected: true, quantity: 1000 } } }`.
  Subtotal 58.75 (8.75 + 0.05 x 1 x 1000), exact; quote required for `slackAI`.
- Selection `S2` (Slack): `{ planId: 'ENTERPRISE_GRID', addOns: { premiumWorkflowOverageCost: { selected: true, quantity: 10 } } }`.
  Subtotal 0.5, exact; quote required for the plan.
- Number checks: values marked exact above and integers use `toBe`; the decimal values of `ZA`
  and `ZM` use `toBeCloseTo(value, 9)`. Equalities between two computed numbers (a breakdown field
  and a `resolved` field, or a line amount and a price amount) always use `toBe` (`Object.is`).
- Breakdown: `resolved.breakdown` of type `PriceBreakdown`; a line is a `PriceBreakdownLine` (both
  in `proposal.md`, "Minimal API"). `B(s)` is `resolvePricing(fixture, s).breakdown`.
- Priced line: a line whose price resolved to an amount. Quote line: a line with
  `requiresQuote: true`. Line amount fold: the plan line `amount` (0 when the plan line is absent
  or has no `amount`), then `+` the `amount` of each add-on line that has one, in line order, as
  successive binary additions.
- Grid pricing `G(constraints)`: the inline pricing of `tests/unit/quantity-grid.test.ts`:
  `{ syntaxVersion: '3.1', saasName: 'Grid', version: '1', createdAt: '2026-01-01', currency: 'EUR', plans: { base: { price: 10 } }, addOns: { seats: { price: 2, subscriptionConstraints: constraints } } }`.
  The add-on's name is `Seats`.
- Plain pricing `P`: `{ syntaxVersion: '3.1', saasName: 'Plain', version: '1', createdAt: '2026-01-01', currency: 'EUR', plans: { base: { price: 10 } } }`
  (one plan, no add-ons, no `billing` block). Quote pricing `Q`: `P` with
  `variables: { rate: 'n/a' }` and plan price `'#rate * 2'`, which never resolves.
- The element: `<pricing-renderer>`. Demo page: `/` of the Playwright web server; it loads the
  acme fixture through `yaml`, with `locale: 'en-US'` and `variablesEnabled: true`, and shows
  Starter selected and `€20` in `.pr-summary`. A new element is created in the demo page with
  `document.createElement('pricing-renderer')`, given a source and appended to `document.body`.
- Toggle: the button `[data-pr-part="breakdown-toggle"]` in `.pr-summary`. Panel: the element
  `[data-pr-part="breakdown"]` whose id is the toggle's `aria-controls`. Row: an element
  `[data-pr-part="breakdown-line"]` in the panel with the attributes `data-line-kind` (`plan` or
  `addOn`) and `data-line-id` (the line id). Open: the toggle has `aria-expanded="true"` and the
  panel has no `hidden` attribute. Closed: `aria-expanded="false"`, the panel has the `hidden`
  attribute and no child nodes.
- Formula text of a priced line: `translate(messages, 'pricing.breakdownFormula', { unitPrice, quantity, multiplier, amount })`
  with `unitPrice` and `amount` formatted by `formatCurrency(value, currency, locale)` and
  `quantity` and `multiplier` by `new Intl.NumberFormat(locale).format(value)`. In `en-US` with
  EUR, the Growth line of `CY` reads `€45 × 1 × 0.8 = €36`.
- Live region: an element whose `aria-live` attribute is present and not `off`.
- Axe check: `new AxeBuilder({ page }).exclude('#action-output').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])`
  with no violation of impact `serious` or `critical`, as the existing accessibility test does.

## Requirements: breakdown (core)

### Requirement: Breakdown field

`req~breakdown-field~1`
The `resolvePricing` function SHALL return a `breakdown` property of type `PriceBreakdown` in every result.
Needs: impl, utest

#### Scenario: Acme defaults

- **GIVEN** the acme fixture
- **WHEN** `resolvePricing(acme)` is called
- **THEN** `breakdown` strictly equals (`toStrictEqual`)
  `{ currency: 'EUR', billingPeriod: { id: 'monthly', label: 'Monthly', multiplier: 1 }, plan: { kind: 'plan', id: 'starter', name: 'Starter', quantity: 1, unitAmount: 20, billingMultiplier: 1, amount: 20, requiresQuote: false }, addOns: [], subtotal: 20, requiresQuote: false }`

#### Scenario: Contract billed yearly

- **GIVEN** the acme fixture
- **WHEN** `resolvePricing(acme, CY)` is called
- **THEN** `breakdown` strictly equals
  `{ currency: 'EUR', billingPeriod: { id: 'yearly', label: 'Yearly', multiplier: 0.8 }, plan: { kind: 'plan', id: 'growth', name: 'Growth', quantity: 1, unitAmount: 45, billingMultiplier: 0.8, amount: 36, requiresQuote: false }, addOns: [{ kind: 'addOn', id: 'extraStorage', name: 'Extra Storage', quantity: 2, unitAmount: 5, billingMultiplier: 0.8, amount: 8, requiresQuote: false }, { kind: 'addOn', id: 'prioritySuccess', name: 'Priority Success', quantity: 1, unitAmount: 25, billingMultiplier: 0.8, amount: 20, requiresQuote: false }], subtotal: 64, requiresQuote: false }`

### Requirement: Breakdown types are exported

`req~breakdown-types-exported~1`
The core entry point `src/core/index.ts` SHALL export the types `PriceBreakdown` and `PriceBreakdownLine` with the fields and types of `proposal.md`, "Minimal API".
Needs: impl, utest

#### Scenario: Every field with its type

- **GIVEN** a snippet that imports `PriceBreakdown`, `PriceBreakdownLine` and `ResolvedPricing`
  from `src/core/index.ts` and assigns each field of a `PriceBreakdown` and of a
  `PriceBreakdownLine` to a variable of the declared type (for example
  `const kind: 'plan' | 'addOn' = line.kind`, `const unit: number | undefined = line.unitAmount`,
  `const period: NormalizedBillingPeriod | undefined = breakdown.billingPeriod`)
- **AND** a second snippet with `const kind: PriceBreakdownLine['kind'] = 'tier'`
- **WHEN** a unit test type-checks both snippets with the TypeScript compiler API
- **THEN** the first reports no error and the second reports error TS2322

### Requirement: Breakdown is a required field

`req~breakdown-required-field~1`
The type `ResolvedPricing` SHALL declare `breakdown: PriceBreakdown` as a required property.
Needs: impl, utest

#### Scenario: Hand-built result without the field

- **GIVEN** a snippet that assigns an object with `selection`, `planPrices`, `addOnPrices`,
  `subtotal`, `requiresQuote` and `diagnostics` to a `ResolvedPricing`, and one that also sets
  `breakdown`
- **WHEN** a unit test type-checks both snippets with the TypeScript compiler API
- **THEN** the first reports a missing-property error that names `breakdown` and the second
  reports no error

### Requirement: Currency

`req~breakdown-currency~1`
The `resolvePricing` function SHALL set `breakdown.currency` to `pricing.metadata.currency`.
Needs: impl, utest

#### Scenario: EUR and USD

- **GIVEN** the acme fixture and the Zoom fixture
- **WHEN** `resolvePricing` is called with `CY` on acme and with `ZA` on Zoom
- **THEN** `breakdown.currency` is `'EUR'` and `'USD'` respectively

### Requirement: Billing period

`req~breakdown-billing-period~1`
WHEN the billing period of the merged selection is the id of a period in `pricing.billing`, the `resolvePricing` function SHALL set `breakdown.billingPeriod` to a copy of that period with its `id`, `label` and `multiplier`.
Needs: impl, utest

#### Scenario: Yearly, annual and the synthetic base period

- **GIVEN** the acme, Zoom and Slack fixtures
- **WHEN** `resolvePricing` is called with `CY`, `ZA` and `S1` respectively
- **THEN** `breakdown.billingPeriod` strictly equals
  `{ id: 'yearly', label: 'Yearly', multiplier: 0.8 }`,
  `{ id: 'annual', label: 'Annual', multiplier: 0.83 }` and
  `{ id: 'base', label: 'Base', multiplier: 1 }` respectively

### Requirement: Unknown billing period

`req~breakdown-unknown-billing-period~1`
IF the billing period of the merged selection is not the id of a period in `pricing.billing`, THEN the `resolvePricing` function SHALL return a breakdown without a `billingPeriod` key whose lines all have `billingMultiplier` 1.
Needs: impl, utest

#### Scenario: Quarterly on the acme fixture

- **GIVEN** the acme fixture
- **WHEN** `resolvePricing(acme, { planId: 'growth', billingPeriod: 'quarterly' })` is called
- **THEN** `'billingPeriod' in breakdown` is `false`
- **AND** `breakdown.plan.billingMultiplier` is 1, `breakdown.plan.amount` is 45 and
  `breakdown.subtotal` is 45

### Requirement: Plan line

`req~breakdown-plan-line~1`
WHEN `selection.planId` is the id of a plan in `pricing.plans`, the `resolvePricing` function SHALL set `breakdown.plan` to a line with `kind: 'plan'`, the plan's `id` and `name`, `quantity` 1 and the `billingMultiplier` of the billing period.
Needs: impl, utest

#### Scenario: Growth billed yearly

- **GIVEN** the acme fixture
- **WHEN** `resolvePricing(acme, CY)` is called
- **THEN** `breakdown.plan` strictly equals
  `{ kind: 'plan', id: 'growth', name: 'Growth', quantity: 1, unitAmount: 45, billingMultiplier: 0.8, amount: 36, requiresQuote: false }`
- **AND** `breakdown.plan.amount` is `resolved.planPrices.growth.amount` (`toBe`)

#### Scenario: Zoom PRO billed annually

- **GIVEN** the Zoom fixture
- **WHEN** `resolvePricing(zoom, ZA)` is called
- **THEN** `breakdown.plan.id` is `'PRO'`, `name` is `'PRO'`, `quantity` 1, `unitAmount` 15.99 and
  `billingMultiplier` 0.83 (`toBe`)
- **AND** `breakdown.plan.amount` is `resolved.planPrices.PRO.amount` (`toBe`) and close
  to 13.2717

### Requirement: No plan line without a known plan

`req~breakdown-no-plan-line~1`
IF `selection.planId` is `undefined` or is not the id of a plan in `pricing.plans`, THEN the `resolvePricing` function SHALL return a breakdown without a `plan` key.
Needs: impl, utest

#### Scenario: Legacy plan and undefined plan

- **GIVEN** the acme fixture
- **WHEN** `resolvePricing` is called with `{ planId: 'legacy' }` and with `{ planId: undefined }`
- **THEN** in both results `'plan' in breakdown` is `false`, `breakdown.addOns` equals `[]`,
  `breakdown.subtotal` is 0 and `breakdown.requiresQuote` is `true`

### Requirement: Add-on lines

`req~breakdown-addon-lines~1`
The `resolvePricing` function SHALL put in `breakdown.addOns` exactly one line for each add-on of `pricing.addOns` that is selected in `reconcileSelection(pricing, merged selection).selection`, and no other line.
Needs: impl, utest

#### Scenario: Contract on Growth

- **GIVEN** the acme fixture
- **WHEN** `resolvePricing(acme, C)` is called
- **THEN** the line ids are `['extraStorage', 'prioritySuccess']` and every line has
  `kind: 'addOn'`

#### Scenario: Add-on removed by reconciliation

- **GIVEN** the acme fixture
- **WHEN** `resolvePricing(acme, { planId: 'starter', addOns: { extraStorage: { selected: true, quantity: 2 } } })`
  is called
- **THEN** `breakdown.addOns` equals `[]`, `breakdown.subtotal` is 20 and
  `breakdown.requiresQuote` is `false`

#### Scenario: Unselected entry and unknown id

- **GIVEN** the acme fixture
- **WHEN** `resolvePricing` is called with
  `{ planId: 'growth', addOns: { extraStorage: { selected: false, quantity: 3 } } }` and with
  `{ planId: 'growth', addOns: { ghost: { selected: true, quantity: 1 } } }`
- **THEN** in both results `breakdown.addOns` equals `[]` and `breakdown.subtotal` is 45

### Requirement: Add-on line order

`req~breakdown-addon-order~1`
The `resolvePricing` function SHALL order `breakdown.addOns` as the add-ons are ordered in `pricing.addOns`, whatever the key order of `selection.addOns`.
Needs: impl, utest

#### Scenario: Dependent selected first

- **GIVEN** the acme fixture
- **WHEN** `resolvePricing` is called with
  `{ planId: 'growth', addOns: { prioritySuccess: { selected: true, quantity: 1 }, extraStorage: { selected: true, quantity: 2 } } }`
- **THEN** the line ids are `['extraStorage', 'prioritySuccess']`

#### Scenario: Reverse key order on Zoom

- **GIVEN** the Zoom fixture
- **WHEN** `resolvePricing(zoom, ZM)` is called
- **THEN** the line ids are `['zoomScheduler', 'zoomClipsPlus', 'zoomWhiteboard']`

### Requirement: Add-on line quantity

`req~breakdown-addon-quantity~1`
The `resolvePricing` function SHALL set the `quantity` of each add-on line to `normalizeAddOnQuantity(pricing, id, selection.addOns[id])`.
Needs: impl, utest

#### Scenario: Above the maximum and zero

- **GIVEN** the acme fixture
- **WHEN** `resolvePricing` is called with plan `growth` and `extraStorage` selected with
  quantity 25, then with quantity 0
- **THEN** the `extraStorage` line has `quantity` 10 and `amount` 50, then `quantity` 1 and
  `amount` 5

#### Scenario: No constraints and no maximum

- **GIVEN** the acme fixture with `E` and the Slack fixture with `S1`
- **WHEN** `resolvePricing` is called with each
- **THEN** the `compliance` line has `quantity` 1 and the `premiumWorkflowOverageCost` line has
  `quantity` 1000

### Requirement: Priced line

`req~breakdown-priced-line~1`
WHEN the price of a line resolves to an amount, the `resolvePricing` function SHALL set `unitAmount` to the price before the billing multiplier, `amount` to `unitAmount * billingMultiplier * quantity` evaluated from left to right, `requiresQuote` to `false` and no `label` key.
Needs: impl, utest

#### Scenario: Zoom billed annually

- **GIVEN** the Zoom fixture
- **WHEN** `resolvePricing(zoom, ZA)` is called
- **THEN** the `extraCloudRecordingStorage` line has `unitAmount` 40, `quantity` 3,
  `billingMultiplier` 0.83, `requiresQuote` `false`, no `label` key and `amount` equal
  (`toBe`) to `40 * 0.83 * 3` and close to 99.6
- **AND** the `audioConferencing` line has `unitAmount` 100, `quantity` 1 and `amount` equal
  (`toBe`) to `resolved.addOnPrices.audioConferencing.amount` and close to 83

#### Scenario: Slack overage

- **GIVEN** the Slack fixture
- **WHEN** `resolvePricing(slack, S1)` is called
- **THEN** the `premiumWorkflowOverageCost` line has `unitAmount` 0.05, `quantity` 1000,
  `billingMultiplier` 1 and `amount` 50

### Requirement: Label line

`req~breakdown-label-line~1`
WHEN the price of a line is a label, the `resolvePricing` function SHALL set `requiresQuote` to `true` and `label` to the label text, without `unitAmount` and `amount` keys.
Needs: impl, utest

#### Scenario: Compliance on Enterprise

- **GIVEN** the acme fixture
- **WHEN** `resolvePricing(acme, E)` is called
- **THEN** the line ids are `['extraStorage', 'compliance']` and the `compliance` line strictly
  equals
  `{ kind: 'addOn', id: 'compliance', name: 'Compliance', quantity: 1, billingMultiplier: 1, requiresQuote: true, label: 'Contact sales' }`
- **AND** `breakdown.subtotal` is 55 and `breakdown.requiresQuote` is `true`

#### Scenario: Slack add-on and plan labels

- **GIVEN** the Slack fixture
- **WHEN** `resolvePricing` is called with `S1` and with `S2`
- **THEN** with `S1` the `slackAI` line has `requiresQuote: true`, `label: 'Contact Sales'`,
  `quantity` 1 and no `unitAmount` or `amount` key, `breakdown.subtotal` is 58.75 and
  `breakdown.requiresQuote` is `true`
- **AND** with `S2` the plan line has `id: 'ENTERPRISE_GRID'`, `requiresQuote: true`,
  `label: 'Contact Sales'` and no `unitAmount` or `amount` key, and `breakdown.subtotal` is 0.5

#### Scenario: Zoom support add-on

- **GIVEN** the Zoom fixture
- **WHEN** `resolvePricing(zoom, ZA)` is called
- **THEN** the line ids are `['extraCloudRecordingStorage', 'audioConferencing', 'premierSupport']`
  and the `premierSupport` line has `requiresQuote: true` and `label: 'Contact us'`

### Requirement: Expression error line

`req~breakdown-error-line~1`
IF the price expression of a line cannot be resolved, THEN the `resolvePricing` function SHALL set `requiresQuote` to `true` without `unitAmount`, `amount` and `label` keys.
Needs: impl, utest

#### Scenario: Seats that are not a number

- **GIVEN** the acme fixture
- **WHEN** `resolvePricing(acme, X)` is called
- **THEN** `breakdown.plan` strictly equals
  `{ kind: 'plan', id: 'growth', name: 'Growth', quantity: 1, billingMultiplier: 1, requiresQuote: true }`
- **AND** the `prioritySuccess` line strictly equals
  `{ kind: 'addOn', id: 'prioritySuccess', name: 'Priority Success', quantity: 1, billingMultiplier: 1, requiresQuote: true }`
- **AND** the `extraStorage` line has `amount` 5, `breakdown.subtotal` is 5 and
  `breakdown.requiresQuote` is `true`
- **AND** `resolved.diagnostics` still has four `PR_EXPRESSION_RESOLUTION_FAILED` entries, one per
  price that fails, with paths `plans.starter.price`, `plans.growth.price`,
  `plans.enterprise.price` and `addOns.prioritySuccess.price`

### Requirement: Summation order

`req~breakdown-subtotal-order~1`
The `resolvePricing` function SHALL compute `subtotal` as the line amount fold of its breakdown: the plan line amount, then the amount of each priced add-on line added in line order.
Needs: impl, utest

#### Scenario: Reverse key order on Zoom

- **GIVEN** the Zoom fixture and `r = resolvePricing(zoom, ZM)` with lines `l0`, `l1`, `l2`
- **WHEN** the test computes `((r.breakdown.plan.amount + l0.amount) + l1.amount) + l2.amount`
- **THEN** `r.subtotal` is that value (`toBe`) and close to 30.56

#### Scenario: Quote lines are skipped

- **GIVEN** the Zoom fixture and `r = resolvePricing(zoom, ZA)` with lines `l0`, `l1`, `l2`
- **WHEN** the test computes `(r.breakdown.plan.amount + l0.amount) + l1.amount`
- **THEN** `r.subtotal` is that value (`toBe`) and close to 195.8717

#### Scenario: Exact sums

- **GIVEN** the acme fixture and the Slack fixture
- **WHEN** `resolvePricing` is called with `CY` and `E` on acme and with `S1` on Slack
- **THEN** `subtotal` is 64, 55 and 58.75 respectively

### Requirement: Breakdown subtotal equals the subtotal

`req~breakdown-subtotal-equals~1`
The `resolvePricing` function SHALL set `breakdown.subtotal` to the same number as `subtotal`.
Needs: impl, utest

#### Scenario: Every SPECTRA fixture

- **GIVEN** every fixture under `tests/fixtures/spectra` that normalizes with `ok: true`, and the
  acme fixture
- **WHEN** `resolvePricing` is called for every plan id and every billing period id of the
  fixture, with every add-on selected with quantity `subscriptionConstraints.minQuantity` (1 when
  it has no constraints)
- **THEN** in every result `Object.is(breakdown.subtotal, subtotal)` is `true`
- **AND** the line amount fold of `breakdown` is `subtotal` (`toBe`)

### Requirement: Quote state

`req~breakdown-requires-quote~1`
The `resolvePricing` function SHALL set `requiresQuote` and `breakdown.requiresQuote` to `true` exactly when the plan line is absent or is a quote line, an add-on line is a quote line, or the reconciled selection has a selected entry whose id is not the id of an add-on in `pricing.addOns`.
Needs: impl, utest

#### Scenario: Values on the acme fixture

- **GIVEN** the acme fixture
- **WHEN** `resolvePricing` is called with the defaults, `C`, `E`, `X`, `{ planId: 'legacy' }` and
  `{ planId: 'growth', addOns: { ghost: { selected: true, quantity: 1 } } }`
- **THEN** `breakdown.requiresQuote` is `false`, `false`, `true`, `true`, `true` and `true`
  respectively
- **AND** in every result `breakdown.requiresQuote` equals `requiresQuote`

#### Scenario: Every SPECTRA fixture

- **GIVEN** the results of the scenario "Every SPECTRA fixture" of
  `req~breakdown-subtotal-equals~1`
- **WHEN** the test compares the quote states
- **THEN** in every result `breakdown.requiresQuote` equals `requiresQuote`

### Requirement: JSON-safe breakdown

`req~breakdown-json~1`
The `resolvePricing` function SHALL return a breakdown that `JSON.stringify` and `JSON.parse` reproduce exactly, with every optional key either absent or holding a defined value.
Needs: impl, utest

#### Scenario: Round trip

- **GIVEN** the breakdowns of `CY`, `E` and `X` on the acme fixture, of
  `{ planId: 'growth', billingPeriod: 'quarterly' }` on the acme fixture and of `S2` on the Slack
  fixture
- **WHEN** each is passed through `JSON.parse(JSON.stringify(breakdown))`
- **THEN** each result strictly equals (`toStrictEqual`) its breakdown

### Requirement: Detached breakdown

`req~breakdown-detached~1`
The `resolvePricing` function SHALL return a breakdown that shares no object with its `pricing` or `selection` arguments or with the breakdown of another call.
Needs: impl, utest

#### Scenario: Mutating a result

- **GIVEN** the acme fixture, a deep copy of `CY`, and `first = resolvePricing(acme, CY)`
- **WHEN** the test sets `first.breakdown.billingPeriod.label = 'Changed'`,
  `first.breakdown.addOns[0].quantity = 99` and pushes a line onto `first.breakdown.addOns`
- **THEN** `first.breakdown.billingPeriod !== acme.billing[1]`, `acme.billing[1].label` is still
  `'Yearly'` and `CY` still deeply equals its copy
- **AND** `resolvePricing(acme, CY).breakdown` still equals the breakdown of the scenario
  "Contract billed yearly"

### Requirement: Message keys

`req~breakdown-i18n-keys~1`
The catalogs `enUS` and `esES` SHALL define the keys `pricing.breakdownToggle`, `pricing.breakdownTitle` and `pricing.breakdownFormula`.
Needs: impl, utest

#### Scenario: English and Spanish texts

- **GIVEN** `enUS` and `esES` imported from `src/core/index.ts`
- **WHEN** the test reads the three keys
- **THEN** `enUS` has `'How is this calculated?'`, `'Price breakdown'` and
  `'{unitPrice} × {quantity} × {multiplier} = {amount}'`
- **AND** `esES` has `'¿Cómo se calcula?'`, `'Desglose del precio'` and
  `'{unitPrice} × {quantity} × {multiplier} = {amount}'`

## Requirements: breakdown in the element

### Requirement: Breakdown in element state and events

`req~breakdown-in-element~1`
WHEN the element provides a resolved pricing in `resolvedState`, in the `applySelection` result or in the detail of `pricing-ready`, `pricing-selection-change` or `pricing-action`, it SHALL include a `breakdown` whose `subtotal` is the same number as that resolved pricing's `subtotal` and whose `requiresQuote` equals its `requiresQuote`.
Needs: impl, utest

#### Scenario: Contract applied and billed yearly

- **GIVEN** the demo page, ready on Starter
- **WHEN** the host calls `applySelection(CY)` and reads `resolvedState`
- **THEN** `result.resolved.breakdown` and `resolvedState.resolved.breakdown` strictly equal the
  breakdown of the scenario "Contract billed yearly" (subtotal 64)
- **AND** `.pr-summary` contains `€64`

#### Scenario: Events

- **GIVEN** the demo page with listeners that record `pricing-ready`, `pricing-selection-change`
  and `pricing-action` details
- **WHEN** the host calls `reload()`, then the user checks the Growth radio, then clicks the CTA
  `Start free trial`
- **THEN** the `pricing-ready` detail has `resolved.breakdown.plan.id` `'starter'` and
  `resolved.breakdown.subtotal` 20
- **AND** the `pricing-selection-change` and `pricing-action` details have
  `resolved.breakdown.plan.id` `'growth'`, `resolved.breakdown.subtotal` 45 and
  `resolved.subtotal` 45

### Requirement: Breakdown with kept prices

`req~breakdown-element-stabilized~1`
WHILE the element shows the last valid price of a plan or add-on whose expression cannot be resolved, it SHALL give that line the `unitAmount`, `billingMultiplier`, `quantity` and `amount` of the shown price with `requiresQuote: false`.
Needs: impl, utest

#### Scenario: Seats that are not a number after six seats

- **GIVEN** the demo page where the user set the seats to 6 (Starter shows `€24`) and the host then
  set `selection` to the last selection with `variables.seats` `'not-a-number'`, as the existing
  test "keeps the last valid price when a variable makes an expression fail" does
- **WHEN** the host reads `resolvedState`
- **THEN** `resolved.breakdown.plan` strictly equals
  `{ kind: 'plan', id: 'starter', name: 'Starter', quantity: 1, unitAmount: 24, billingMultiplier: 1, amount: 24, requiresQuote: false }`
- **AND** `resolved.breakdown.subtotal` and `resolved.subtotal` are 24, and
  `resolved.breakdown.requiresQuote` and `resolved.requiresQuote` are `true`
- **AND** `.pr-summary` contains `€24` and `Requires quote`

## Requirements: breakdown disclosure (element UI)

### Requirement: Toggle

`req~summary-breakdown-toggle~1`
The element SHALL render in `.pr-summary` one toggle, a `button` of type `button` with the accessible name of the message `pricing.breakdownToggle`, an `aria-expanded` attribute and an `aria-controls` attribute equal to the id of the panel.
Needs: impl, utest

#### Scenario: Initial state in English

- **GIVEN** the demo page
- **WHEN** the test queries `.pr-summary` with `getByRole('button', { name: 'How is this calculated?' })`
- **THEN** it finds one button with `data-pr-part="breakdown-toggle"`, `type="button"` and
  `aria-expanded="false"`
- **AND** `document.getElementById` of its `aria-controls` value is the panel, which has the
  `hidden` attribute and no child nodes

#### Scenario: Spanish

- **GIVEN** the demo page
- **WHEN** the user selects `es-ES` in `#locale`
- **THEN** the toggle's accessible name is `¿Cómo se calcula?`

#### Scenario: Read-only even when the flags are off

- **GIVEN** the demo page where the host set `selectionEnabled`, `ctaEnabled` and
  `variablesEnabled` to `false`
- **WHEN** the next update completes
- **THEN** the toggle is visible in `.pr-summary`

#### Scenario: Pricing without add-ons

- **GIVEN** a new element with `pricing` set to `P`
- **WHEN** it is ready
- **THEN** its `.pr-summary` contains `€10` and one toggle

### Requirement: One panel id per element

`req~summary-breakdown-unique-ids~1`
The element SHALL give its panel an id that no other element in the document has.
Needs: impl, utest

#### Scenario: Two renderers

- **GIVEN** the demo page and a new element with `pricing` set to `P`, both ready
- **WHEN** the test reads the `aria-controls` value of each toggle
- **THEN** the two values differ, `document.querySelectorAll` of each id as an id selector finds
  one element, and that element is inside the same `<pricing-renderer>` as the toggle

### Requirement: Toggle activation

`req~summary-breakdown-activate~1`
WHEN the user activates the toggle with a pointer, Enter or Space, the element SHALL switch the panel between closed and open without moving focus away from the toggle.
Needs: impl, utest

#### Scenario: Pointer

- **GIVEN** the demo page with the panel closed
- **WHEN** the user clicks the toggle, then clicks it again
- **THEN** after the first click the panel is open, `aria-expanded` is `"true"` and
  `getByRole('group', { name: 'Price breakdown' })` is visible
- **AND** after the second click the panel is closed

#### Scenario: Keyboard

- **GIVEN** the demo page with the toggle focused and the panel closed
- **WHEN** the user presses Enter, then Space
- **THEN** after Enter the panel is open, after Space it is closed, and the toggle is focused after
  each key

### Requirement: Breakdown rows

`req~summary-breakdown-lines~1`
WHILE the panel is open, the element SHALL render one row per breakdown line, the plan line first and then the add-on lines in breakdown order, each with the line name and either the formula text of a priced line or, for a quote line, its `label` or else the text of `pricing.requiresQuote`.
Needs: impl, utest

#### Scenario: Contract billed yearly

- **GIVEN** the demo page where the host called `applySelection(CY)`
- **WHEN** the user opens the panel
- **THEN** the rows, as `[data-line-kind, data-line-id]`, are `['plan', 'growth']`,
  `['addOn', 'extraStorage']` and `['addOn', 'prioritySuccess']`
- **AND** they contain `Growth` and `€45 × 1 × 0.8 = €36`, `Extra Storage` and
  `€5 × 2 × 0.8 = €8`, and `Priority Success` and `€25 × 1 × 0.8 = €20` respectively

#### Scenario: Enterprise with compliance

- **GIVEN** the demo page where the host called `applySelection(E)`
- **WHEN** the user opens the panel
- **THEN** the rows contain `Enterprise` and `€40 × 1 × 1 = €40`, `Extra Storage` and
  `€5 × 3 × 1 = €15`, and `Compliance` and `Contact sales`, in that order

#### Scenario: Expression that never resolves

- **GIVEN** a new element with `pricing` set to `Q`
- **WHEN** the user opens its panel
- **THEN** it has one row, `['plan', 'base']`, that contains `Base` and `Requires quote`

### Requirement: Totals in the panel

`req~summary-breakdown-totals~1`
WHILE the panel is open, the element SHALL render after the rows the currency code, the billing period label shown by the billing control when the pricing has more than one billing period, and the total formatted as in the summary with the summary label, followed by the text of `pricing.requiresQuote` when the breakdown requires a quote.
Needs: impl, utest

#### Scenario: Contract billed yearly

- **GIVEN** the demo page where the host called `applySelection(CY)`
- **WHEN** the user opens the panel
- **THEN** the panel contains `Billing period` and `Yearly`, `Currency` and `EUR`, and
  `Estimated total` and `€64`

#### Scenario: Quote required

- **GIVEN** the demo page where the host called `applySelection(E)`
- **WHEN** the user opens the panel
- **THEN** the panel contains `Known subtotal`, `€55` and `Requires quote`

#### Scenario: One billing period

- **GIVEN** a new element with `pricing` set to `P`
- **WHEN** the user opens its panel
- **THEN** the panel contains `Currency`, `EUR`, `Estimated total` and `€10`, and does not
  contain `Billing period`

### Requirement: Escape closes the panel

`req~summary-breakdown-escape~1`
WHILE the panel is open, WHEN the user presses Escape with focus on the toggle or inside the panel, the element SHALL close the panel with focus on the toggle.
Needs: impl, utest

#### Scenario: Escape on the toggle

- **GIVEN** the demo page where the user opened the panel with Enter
- **WHEN** the user presses Escape
- **THEN** the panel is closed, `aria-expanded` is `"false"` and the toggle is focused

### Requirement: Escape elsewhere

`req~summary-breakdown-escape-scope~1`
IF the user presses Escape while the panel is open and focus is neither on the toggle nor inside the panel, THEN the element SHALL leave the panel open.
Needs: impl, utest

#### Scenario: Focus on a plan radio

- **GIVEN** the demo page with the panel open
- **WHEN** the user focuses the `Choose Growth` radio and presses Escape
- **THEN** the panel is still open

#### Scenario: Pending-change dialog

- **GIVEN** the demo page where the user selected Growth and `extraStorage`, opened the panel and
  then picked Starter, so the dialog "Will remove: extraStorage" is open
- **WHEN** the user presses Escape
- **THEN** no `.pr-dialog` is shown, the Growth radio is checked and the panel is still open

### Requirement: Panel follows selection changes

`req~summary-breakdown-stays-open~1`
WHILE the panel is open, WHEN the selection in effect changes, the element SHALL keep the panel open, showing the breakdown of the new selection.
Needs: impl, utest

#### Scenario: User picks Growth

- **GIVEN** the demo page on Starter with the panel open
- **WHEN** the user checks the Growth radio
- **THEN** the panel is open, its only row is `['plan', 'growth']` with `€45 × 1 × 1 = €45`, and it
  contains `€45` as the total

#### Scenario: Host applies a selection

- **GIVEN** the demo page on Starter with the panel open
- **WHEN** the host calls `applySelection(CY)` and the next update completes
- **THEN** the panel is open and its rows are those of the scenario "Contract billed yearly" of
  `req~summary-breakdown-lines~1`

### Requirement: Panel closes on load

`req~summary-breakdown-closes-on-load~1`
WHEN a load succeeds, the element SHALL render the panel closed.
Needs: impl, utest

#### Scenario: Reload

- **GIVEN** the demo page with the panel open
- **WHEN** the host calls `reload()` and the update after `pricing-ready` completes
- **THEN** the panel is closed and the toggle has `aria-expanded="false"`

### Requirement: Disclosure outside the live region

`req~summary-breakdown-not-live~1`
The element SHALL render the toggle and the panel outside every live region.
Needs: impl, utest

#### Scenario: Closed and open

- **GIVEN** the demo page where the host called `applySelection(E)`
- **WHEN** the test evaluates `closest('[aria-live]:not([aria-live="off"])')` on the toggle and on
  the panel, with the panel closed and then open
- **THEN** the four results are `null`

### Requirement: Summary live region

`req~summary-live-region~1`
The element SHALL render the summary label, the total and the quote note inside one element of `.pr-summary` with `aria-live="polite"`.
Needs: impl, utest

#### Scenario: Default and quote states

- **GIVEN** the demo page
- **WHEN** the test reads `.pr-summary [aria-live="polite"]` on Starter and after
  `applySelection(E)`
- **THEN** it finds one element each time, which contains `Estimated total` and `€20`, then
  `Known subtotal`, `€55` and `Requires quote`

#### Scenario: Opening the panel does not change the live text

- **GIVEN** the demo page where the host called `applySelection(E)` and the `textContent` of the
  live region
- **WHEN** the user opens the panel
- **THEN** the `textContent` of the live region is unchanged

### Requirement: Closed toggle keeps the layout

`req~summary-breakdown-closed-layout~1`
WHILE the panel is closed, the toggle SHALL NOT change the block size of `.pr-summary` or of the element.
Needs: impl, utest

#### Scenario: Narrow and wide viewports

- **GIVEN** the demo page at 320 x 900 and at 1440 x 1000 CSS px, with the heights of
  `.pr-summary` and of `pricing-renderer` measured with `getBoundingClientRect()`
- **WHEN** the test adds the style
  `pricing-renderer [data-pr-part='breakdown-toggle'] { display: none !important; }` and measures
  again
- **THEN** each height differs from its first measure by less than 0.5 CSS px

### Requirement: Target size

`req~summary-breakdown-target-size~1`
The element SHALL render the toggle with a box of at least 24 x 24 CSS px and a pointer target of at least 44 x 44 CSS px centered on the toggle.
Needs: impl, utest

#### Scenario: Box and hit points

- **GIVEN** the demo page at 375 x 900 and at 1440 x 1000 CSS px, with `.pr-summary` scrolled into
  view and the toggle's bounding box centered at `(cx, cy)`
- **WHEN** the test reads `document.elementFromPoint` at `(cx - 21, cy)`, `(cx + 21, cy)`,
  `(cx, cy - 21)` and `(cx, cy + 21)`
- **THEN** the box is at least 24 px wide and 24 px high, and `closest('[data-pr-part="breakdown-toggle"]')`
  of each of the four elements is the toggle
- **AND** a mouse click at `(cx + 21, cy)` opens the panel

### Requirement: Accessibility with the panel open

`req~summary-breakdown-axe~1`
WHILE the panel is open, the element SHALL pass the axe check in the light and the dark theme.
Needs: impl, utest

#### Scenario: Light and dark

- **GIVEN** the demo page where the host called `applySelection(E)` and the user opened the panel
- **WHEN** the test runs the axe check, then sets the element's `theme` to `'dark'` and runs it
  again
- **THEN** both runs report no `serious` or `critical` violation

### Requirement: Icon contrast

`req~summary-breakdown-icon-contrast~1`
The element SHALL render the toggle icon in a color whose contrast ratio against the element's `--pr-color-surface` is at least 3:1 in the light and the dark theme.
Needs: impl, utest

#### Scenario: Light and dark

- **GIVEN** the demo page, then the same page with the element's `theme` set to `'dark'`
- **WHEN** the test computes the WCAG 2 contrast ratio between the computed `color` of the toggle
  (the icon is drawn in `currentColor`) and the computed value of `--pr-color-surface` on the
  element
- **THEN** the ratio is at least 3 in both themes

### Requirement: Reduced motion

`req~summary-breakdown-reduced-motion~1`
WHERE the user prefers reduced motion, the element SHALL render the toggle and the open panel with computed transition and animation durations of at most 0.01 ms.
Needs: impl, utest

#### Scenario: Emulated preference

- **GIVEN** the demo page with `page.emulateMedia({ reducedMotion: 'reduce' })`
- **WHEN** the user opens the panel and the test reads `transitionDuration` and
  `animationDuration` of the computed style of the toggle and the panel
- **THEN** every comma-separated value, parsed in seconds, is at most 0.00001

## Requirements: audit follow-ups (no public API change)

### Requirement: Stepper maximum on the grid

`req~stepper-max-on-grid~1`
WHEN the element renders the quantity input of a selected add-on whose constraints have a `maxQuantity`, it SHALL set the input's `max` attribute to `maxQuantityOnGrid(constraints)`.
Needs: impl, utest

#### Scenario: Minimum 1, step 5, maximum 8

- **GIVEN** a new element with `pricing` set to `G({ minQuantity: 1, quantityStep: 5, maxQuantity: 8 })`
  and `defaultSelection` `{ planId: 'base', addOns: { seats: { selected: true, quantity: 1 } } }`
- **WHEN** it is ready
- **THEN** the spinbutton `Quantity for Seats` has `max="6"`, `min="1"` and `step="5"`

#### Scenario: Acme storage packs

- **GIVEN** the demo page where the user selected Growth and `extraStorage`
- **WHEN** the test reads the spinbutton `Quantity for Extra Storage`
- **THEN** it has `max="10"`

### Requirement: Grid maximum never exceeds the maximum

`req~quantity-grid-max-cap~1`
The `maxQuantityOnGrid` function SHALL return a value that is not greater than `constraints.maxQuantity`.
Needs: impl, utest

#### Scenario: Decimal steps

- **GIVEN** the constraints `{ minQuantity: 0, quantityStep: 0.1, maxQuantity: 0.3 }` and
  `{ minQuantity: 0, quantityStep: 0.1, maxQuantity: 0.7 }`
- **WHEN** `maxQuantityOnGrid` is called with each
- **THEN** the results are `toBe(0.3)` and `toBe(0.7)`
- **AND** today the results are 0.30000000000000004 (`3 * 0.1`) and 0.7000000000000001
  (`7 * 0.1`), so both assertions fail before the fix

#### Scenario: Integer steps unchanged

- **GIVEN** the constraints `{ minQuantity: 1, quantityStep: 5, maxQuantity: 8 }` and
  `{ minQuantity: 1, quantityStep: 5, maxQuantity: 11 }`
- **WHEN** `maxQuantityOnGrid` is called with each
- **THEN** the results are 6 and 11

### Requirement: Billed quantity never exceeds the maximum

`req~quantity-normalized-max-cap~1`
The `normalizeAddOnQuantity` function SHALL return a quantity that is not greater than `constraints.maxQuantity`.
Needs: impl, utest

#### Scenario: Decimal maximum

- **GIVEN** `pricing = G({ minQuantity: 0, quantityStep: 0.1, maxQuantity: 0.3 })`
- **WHEN** `resolvePricing(pricing, { planId: 'base', addOns: { seats: { selected: true, quantity: q } } })`
  is called with `q` 0.3 and with `q` 5
- **THEN** in both results `normalizeAddOnQuantity(pricing, 'seats', { selected: true, quantity: q })`
  and `addOnPrices.seats.quantity` are `toBe(0.3)` and `addOnPrices.seats.amount` is `toBe(0.6)`
- **AND** `diagnostics` has no `PR_ADDON_CONSTRAINTS_INVALID` entry

### Requirement: Stepper shows the billed quantity

`req~stepper-normalized-quantity~1`
The element SHALL show in the quantity input of each selected add-on with quantity constraints the quantity `normalizeAddOnQuantity(pricing, id, entry)` of that add-on's entry in the selection in effect.
Needs: impl, utest

#### Scenario: Controlled quantity above the maximum

- **GIVEN** the demo page with `selection`
  `{ planId: 'growth', billingPeriod: 'monthly', variables, addOns: { extraStorage: { selected: true, quantity: 25 } } }`
  and the default `variables`
- **WHEN** the next update completes
- **THEN** the spinbutton `Quantity for Extra Storage` has the value `10`, the Extra Storage card
  shows `€50` and `.pr-summary` contains `€95`
- **AND** `element.selection.addOns.extraStorage.quantity` is still 25

#### Scenario: Default selection above the maximum

- **GIVEN** the demo page where the host set `defaultSelection` to
  `{ planId: 'growth', addOns: { extraStorage: { selected: true, quantity: 25 } } }`
- **WHEN** the host calls `reload()` and the update after `pricing-ready` completes
- **THEN** the spinbutton `Quantity for Extra Storage` has the value `10`

### Requirement: Stepper buttons start from the billed quantity

`req~stepper-steps-from-normalized~1`
WHEN the user activates the decrease or the increase button of a selected add-on, the element SHALL request the normalized quantity of the add-on minus or plus `quantityStep`, normalized again.
Needs: impl, utest

#### Scenario: Controlled quantity above the maximum

- **GIVEN** the controlled demo page of the scenario "Controlled quantity above the maximum" and a
  `pricing-selection-change` listener that records details; the host does not echo the changes
- **WHEN** the user clicks `Decrease Extra Storage`, then `Increase Extra Storage`
- **THEN** the first detail has `selection.addOns.extraStorage.quantity` 9 (today 10, from the
  normalized 25 - 1) and the second has 10

#### Scenario: Uncontrolled

- **GIVEN** the demo page of the scenario "Default selection above the maximum"
- **WHEN** the user clicks `Decrease Extra Storage`
- **THEN** the spinbutton has the value `9` and `.pr-summary` contains `€90`

### Requirement: Equality without type coercion

`req~expression-equality-no-coercion~1`
The expression evaluator SHALL evaluate `==` and `!=` as `===` and `!==`, without converting the types of the operands.
Needs: impl, utest

#### Scenario: Mixed types

- **GIVEN** the variables `{ obj: {} }` (so `#obj.absent` is `undefined`)
- **WHEN** `evaluatePriceExpression(source, variables)` is called with `source` set to
  `<condition> ? 1 : 0.0` for each condition below
- **THEN** the results are `{ value: 0 }` for `1 == '1'`, `0 == false`, `'' == 0`, `true == 1` and
  `null == #obj.absent`
- **AND** `{ value: 1 }` for `'1' != 1`, `null != #obj.absent` and `'1' == '1'`

## Design notes (non-normative)

- Breakdown builder: an internal function, for example `createPriceBreakdown` in a new
  `src/core/breakdown.ts` that `src/core/index.ts` does not export, builds the breakdown from the
  pricing, the merged selection, its reconciled add-ons and the resolved prices. `resolvePricing`
  then sets `subtotal` and `requiresQuote` from it, so there is one computation. Build order: the
  plan line from `planPrices[selection.planId]`; then `pricing.addOns` in order, keeping those
  selected in the reconciled selection, with `quantity = normalizeAddOnQuantity(...)`; then the
  fold. Set optional keys only when defined (`exactOptionalPropertyTypes` is off in
  `tsconfig.base.json`, so the compiler does not catch `undefined` values).
- Amounts: plan line `amount` is `planPrices[id].amount` (the same three factors in the same
  order). Add-on line `amount` is computed from the line quantity; it equals
  `addOnPrices[id].amount` whenever the normalized quantity is not 0. `addOnPrices` keeps pricing
  a quantity of 0 as 1 (`quantity || 1`), as today; only an add-on with `minQuantity: 0` selected
  at 0 shows the difference.
- `requiresQuote` keeps today's rule, including a selected id that is not in the pricing (no line,
  but a quote; delivera-1 decided to keep it). `resolved.selection` stays the merged,
  unreconciled input, as today.
- Element: `_stabilizeResolvedPrices` rebuilds the breakdown with the same builder from the
  stabilized `planPrices` and `addOnPrices`, takes `unitAmount` (`baseAmount`),
  `billingMultiplier`, `quantity` and `amount` of a kept price from that price, keeps
  `resolved.requiresQuote` from the core and sets `resolved.subtotal` to `breakdown.subtotal`. So
  the element's subtotal uses the same order as the core, and it no longer adds a price for an
  add-on with `minQuantity: 0` selected at 0 (today it adds `addOnPrices[id].amount`, priced
  at 1). `render`, `resolvedState`, `applySelection`, `pricing-ready`, `pricing-selection-change` and
  `pricing-action` all go through `_stabilizeResolvedPrices`, and `resolvedState` already
  deep-copies `resolved`.
- Summary markup, a suggestion that satisfies the layout and live-region requirements:
  `aside.pr-summary[data-pr-part="summary"]` without `aria-live`, a two-column grid
  (`minmax(0, 1fr) auto`); first child a `div` with `aria-live="polite"` that takes over today's
  grid rules for `p`, `strong` and the quote `span`; second child the toggle in the `auto` column,
  aligned with the total; third child the panel spanning `1 / -1`, with the `hidden` attribute and
  no content while closed. Scope today's `.pr-summary span` rule to the quote note so it does not
  style the panel. Keep the summary's padding and gaps so its block size does not change; the
  responsive screenshots depend on it (see `proposal.md`, "Risks").
- Toggle: `button type="button"`, 24 x 24 px, round (`--pr-radius-pill`), no border and no
  background, an inline SVG "i" in a circle with `aria-hidden="true"` and `focusable="false"`
  drawn in `currentColor`, and no text node (the name comes from `aria-label`, so the text of
  `.pr-summary` does not change). `position: relative` with a `::before` at `inset: -10px` gives
  the 44 x 44 px target without changing the layout. The summary has no other interactive element
  that the extended target could cover.
- Panel: a `div` with `role="group"`, `aria-label` from `pricing.breakdownTitle` and a `dl` of
  rows; the formula uses `translate` with `pricing.breakdownFormula`. No `max-block-size` with
  overflow: a scroll container without focusable content fails the axe rule
  `scrollable-region-focusable`. The billing period row uses
  `presentation.billingLabels[id] ?? period.label`, as `renderBilling` does.
- Tokens (no new token in `src/styles/theme.css`): icon `--pr-color-muted`, and `--pr-color-text`
  on hover and while expanded; focus ring by the existing `:focus-visible` rule
  (`--pr-color-focus`); panel text `--pr-color-text`, secondary text `--pr-color-muted`,
  separator `--pr-color-border`, quote text `--pr-color-warning` as the summary note does; sizes
  `--pr-font-size-sm`, spacing `--pr-space-2` and `--pr-space-3`; any transition uses
  `--pr-motion-fast`, which the existing `prefers-reduced-motion` rule shortens. Contrast,
  computed by hand from the relative luminance of the token values: `--pr-color-muted` on
  `--pr-color-surface` is about 5.96:1 in the light theme (`#626275` on `#ffffff`) and
  about 7.58:1 in the dark theme (`#aaa8ba` on `#181820`); `--pr-color-warning` on the light surface is
  about 5.67:1. In forced-colors mode the icon follows `currentColor` (ButtonText).
- Panel state: a private field such as `_breakdownOpen`, set to `false` in the success path of
  `_applyLoadResult`; the panel id comes from a module-level counter, for example
  `pr-breakdown-${n}`. Escape is handled by a `keydown` listener on the toggle and on the panel;
  the host-level dialog listener only acts while a pending change exists, and while the dialog is
  open `.pr-content` (which holds the summary) is `inert`, so one Escape never does both.
- Current stepper defect (`req~stepper-normalized-quantity~1`,
  `req~stepper-steps-from-normalized~1`): `renderAddOns` in `src/element/renderers.ts` takes
  `quantity` from `selection.addOns[addOn.id]?.quantity`, where `selection` is
  `viewModel.resolved.selection`, the selection in effect before normalization. The element never
  rewrites a controlled selection (`req~controlled-selection-untouched~1`) and does not validate
  `defaultSelection`, so a quantity of 25 with a maximum of 10 is shown as `25` while the card and
  the total bill 10 (`€50`, `€95`). The decrease button sends `25 - 1 = 24`, which
  `_updateAddOnQuantity` normalizes to 10, so the first press moves from the shown 25 to 10
  instead of from 10 to 9; if a controlled host does not echo the change, every press emits 10.
  Fix: compute the shown and stepped quantity with `normalizeAddOnQuantity(viewModel.pricing, addOn.id, selection.addOns[addOn.id])`
  for selected add-ons.
- `maxQuantityOnGrid`: return `Math.min(maxQuantity, minQuantity + steps * quantityStep)`. The
  epsilon in the step count stays. `normalizeAddOnQuantity` then caps at `maxQuantity` too.
- Already satisfied today, so only the trace tags are added: `req~stepper-max-on-grid~1` (the
  input already uses `maxQuantityOnGrid`) and `req~expression-equality-no-coercion~1`
  (`src/core/expression.ts` maps `==` and `!=` to `===` and `!==`). Their tests pass before the
  implementation; the red-before evidence for them is not applicable and the test-designer says
  so.
- Type requirements (`req~breakdown-types-exported~1`, `req~breakdown-required-field~1`): checked
  with the TypeScript compiler API on snippets, as `tests/unit/custom-elements.test.ts` does,
  because `vitest run` does not type-check.
- `custom-elements.json`: no member, attribute or event is added, so the manifest is not edited;
  `tests/unit/custom-elements.test.ts` must pass unchanged.
- Visual baselines: the PNG files in `tests/browser/pricing-renderer.spec.ts-snapshots/` are not
  part of this change. The nine responsive tests run against them without `--update-snapshots` and
  must pass; a failure stops the change and goes to the owner with the diff images.

## Acceptance checklist

Unit tests (vitest, `tests/unit`, node environment, no DOM; fixtures parsed from YAML):

- [ ] `[utest->req~breakdown-field~1]` unit, acme
- [ ] `[utest->req~breakdown-types-exported~1]` unit, TypeScript compiler API
- [ ] `[utest->req~breakdown-required-field~1]` unit, TypeScript compiler API
- [ ] `[utest->req~breakdown-currency~1]` unit, acme and Zoom
- [ ] `[utest->req~breakdown-billing-period~1]` unit, acme, Zoom and Slack
- [ ] `[utest->req~breakdown-unknown-billing-period~1]` unit, acme
- [ ] `[utest->req~breakdown-plan-line~1]` unit, acme and Zoom
- [ ] `[utest->req~breakdown-no-plan-line~1]` unit, acme
- [ ] `[utest->req~breakdown-addon-lines~1]` unit, acme
- [ ] `[utest->req~breakdown-addon-order~1]` unit, acme and Zoom
- [ ] `[utest->req~breakdown-addon-quantity~1]` unit, acme and Slack
- [ ] `[utest->req~breakdown-priced-line~1]` unit, Zoom and Slack
- [ ] `[utest->req~breakdown-label-line~1]` unit, acme, Slack and Zoom
- [ ] `[utest->req~breakdown-error-line~1]` unit, acme
- [ ] `[utest->req~breakdown-subtotal-order~1]` unit, Zoom, acme and Slack
- [ ] `[utest->req~breakdown-subtotal-equals~1]` unit, every SPECTRA fixture and acme
- [ ] `[utest->req~breakdown-requires-quote~1]` unit, acme and every SPECTRA fixture
- [ ] `[utest->req~breakdown-json~1]` unit
- [ ] `[utest->req~breakdown-detached~1]` unit
- [ ] `[utest->req~breakdown-i18n-keys~1]` unit
- [ ] `[utest->req~quantity-grid-max-cap~1]` unit, `tests/unit/quantity-grid.test.ts`
- [ ] `[utest->req~quantity-normalized-max-cap~1]` unit, `tests/unit/quantity-grid.test.ts`
- [ ] `[utest->req~expression-equality-no-coercion~1]` unit, `tests/unit/expression.test.ts`

Playwright tests (`tests/browser/pricing-renderer.spec.ts`, demo page with the acme fixture;
vitest runs without a DOM):

- [ ] `[utest->req~breakdown-in-element~1]` Playwright
- [ ] `[utest->req~breakdown-element-stabilized~1]` Playwright
- [ ] `[utest->req~summary-breakdown-toggle~1]` Playwright, English, Spanish, flags off, no add-ons
- [ ] `[utest->req~summary-breakdown-unique-ids~1]` Playwright
- [ ] `[utest->req~summary-breakdown-activate~1]` Playwright, pointer and keyboard
- [ ] `[utest->req~summary-breakdown-lines~1]` Playwright
- [ ] `[utest->req~summary-breakdown-totals~1]` Playwright
- [ ] `[utest->req~summary-breakdown-escape~1]` Playwright, includes focus
- [ ] `[utest->req~summary-breakdown-escape-scope~1]` Playwright, includes the pending dialog
- [ ] `[utest->req~summary-breakdown-stays-open~1]` Playwright
- [ ] `[utest->req~summary-breakdown-closes-on-load~1]` Playwright
- [ ] `[utest->req~summary-breakdown-not-live~1]` Playwright
- [ ] `[utest->req~summary-live-region~1]` Playwright
- [ ] `[utest->req~summary-breakdown-closed-layout~1]` Playwright, 320 and 1440 px
- [ ] `[utest->req~summary-breakdown-target-size~1]` Playwright, 375 and 1440 px
- [ ] `[utest->req~summary-breakdown-axe~1]` Playwright, light and dark
- [ ] `[utest->req~summary-breakdown-icon-contrast~1]` Playwright, light and dark
- [ ] `[utest->req~summary-breakdown-reduced-motion~1]` Playwright
- [ ] `[utest->req~stepper-max-on-grid~1]` Playwright
- [ ] `[utest->req~stepper-normalized-quantity~1]` Playwright, controlled and `defaultSelection`
- [ ] `[utest->req~stepper-steps-from-normalized~1]` Playwright, controlled and uncontrolled

Existing tests and release (reviewed, no trace tag):

- [ ] The existing unit and Playwright tests pass unchanged, including
      `tests/unit/custom-elements.test.ts` and the accessibility test.
- [ ] The nine responsive screenshot tests pass against the committed baselines without
      `--update-snapshots`; no PNG file under `tests/browser/pricing-renderer.spec.ts-snapshots/`
      changes.
- [ ] `custom-elements.json` has no diff.
- [ ] `docs/api-reference.md`: `PriceBreakdown`, `PriceBreakdownLine`, `ResolvedPricing.breakdown`,
      the summation order and the disclosure.
- [ ] `docs/i18n.md`: the three keys in English and Spanish.
- [ ] `docs/theming.md`: the part hooks `breakdown-toggle`, `breakdown` and `breakdown-line`, and
      how to hide the toggle.
- [ ] `docs/configuration.md`: the toggle whatever the three flags; normalized quantities in the
      stepper for controlled and default selections.
- [ ] `.changeset`: minor changeset for `pricing-renderer` ending with "Feedback from the
      Delivera integration (ISA group, Sept 2026)."
- [ ] PR text: states "Feedback from the Delivera integration (ISA group, Sept 2026)", names no
      person and has no e-mail address.
