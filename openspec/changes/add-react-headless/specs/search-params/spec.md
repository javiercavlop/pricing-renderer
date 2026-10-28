## ADDED Requirements

### Requirement: Selection written as search parameter entries

`req~search-params-write~1`
WHEN `selectionToSearchParams(selection, options?)` is called, the core SHALL return `[key, value]` string pairs in this order: `plan` with `planId` and `billing` with `billingPeriod` when defined, one `addon` per selected add-on in key order (`id`, or `id:quantity` when the quantity is not 1 or the id contains `:`), then the variable pairs of `req~search-params-write-variables~1`.

Needs: impl, utest

#### Scenario: Growth, yearly, two add-ons

- **GIVEN** the selection `{ planId: 'growth', billingPeriod: 'yearly', variables: { seats: 12, region: 'eu' }, addOns: { extraStorage: { selected: true, quantity: 3 }, compliance: { selected: false, quantity: 1 }, prioritySuccess: { selected: true, quantity: 1 } } }`
- **WHEN** `selectionToSearchParams(selection)` is called
- **THEN** the result deeply equals `[['plan', 'growth'], ['billing', 'yearly'], ['addon', 'extraStorage:3'], ['addon', 'prioritySuccess'], ['var.seats', '12'], ['var.region', '"eu"']]`

### Requirement: Variables written as JSON text

`req~search-params-write-variables~1`
WHEN `selectionToSearchParams` writes the variables of a selection, the core SHALL add one `var.<name>` pair per top-level variable in key order with the `JSON.stringify` text of its value, skipping a value whose text is undefined.

Needs: impl, utest

#### Scenario: Nested and undefined values

- **GIVEN** a selection whose `variables` are `{ seats: 5, note: undefined, priceByRegion: { 'eu-price': 8 } }`
- **WHEN** `selectionToSearchParams(selection)` is called
- **THEN** its variable pairs are `[['var.seats', '5'], ['var.priceByRegion', '{"eu-price":8}']]`

### Requirement: Selection read from search parameter entries

`req~search-params-read~1`
WHEN `selectionFromSearchParams(pricing, params, options?)` is called, the core SHALL return `applySelectionInput(pricing, options.current ?? createDefaultSelection(pricing), input)`, where `input` takes `planId` and `billingPeriod` from the first `plan` and `billing` entries, a selected entry per `addon` entry (text after the last `:` as `Number` quantity, else 1), and the default variables with each `var.<path>` value set at `<path>`.

Needs: impl, utest

#### Scenario: Entries of a shared link

- **GIVEN** the acme fixture and the entries `[['plan', 'growth'], ['addon', 'extraStorage:3'], ['addon', 'prioritySuccess'], ['var.seats', '12'], ['var.priceByRegion.us-price', '12'], ['utm_source', 'mail']]`
- **WHEN** `selectionFromSearchParams(acme, entries)` is called
- **THEN** `selection.planId` is `growth` and `selection.billingPeriod` is `monthly`
- **AND** `selection.addOns` deeply equals `{ extraStorage: { selected: true, quantity: 3 }, prioritySuccess: { selected: true, quantity: 1 } }`
- **AND** `selection.variables.seats` is 12 and `selection.variables.priceByRegion` deeply equals `{ 'eu-price': 8, 'us-price': 12 }`
- **AND** `diagnostics` is `[]`

### Requirement: Variable text that is not JSON

`req~search-params-var-text~1`
IF the value of a `var.<path>` entry is not valid JSON, THEN `selectionFromSearchParams` SHALL use the raw text as the variable value.

Needs: impl, utest

#### Scenario: Hand-written region

- **GIVEN** the acme fixture and the entries `[['var.region', 'us'], ['var.prioritySupport', 'true']]`
- **WHEN** `selectionFromSearchParams(acme, entries)` is called
- **THEN** `selection.variables.region` is the string `us` and `selection.variables.prioritySupport` is the boolean `true`

### Requirement: Unsafe variable paths are ignored

`req~search-params-var-path-safe~1`
IF a segment of the `<path>` of a `var.<path>` entry, split as `setAtPath` splits it (`[n]` read as `.n`), is `__proto__`, `prototype` or `constructor`, or is a run of digits whose parent in the copy of `pricing.variables` is missing or is not an array longer than that number, THEN `selectionFromSearchParams` SHALL ignore that entry.

Needs: impl, utest

#### Scenario: Prototype pollution attempt

- **GIVEN** the acme fixture and the entries `[['var.__proto__.isAdmin', 'true'], ['var.constructor.prototype.isAdmin', 'true'], ['var.__proto__[0]', '1'], ['var.seats', '7']]`
- **WHEN** `selectionFromSearchParams(acme, entries)` is called
- **THEN** `Object.prototype` has no own key `isAdmin` and no own key `0`
- **AND** `selection.variables.seats` is 7 and `selection.variables` has no own key `__proto__` or `constructor`

#### Scenario: Huge array index

- **GIVEN** the acme fixture and the entries `[['var.x.4294967294', '1'], ['var.seats[9]', '1']]`
- **WHEN** `selectionFromSearchParams(acme, entries)` is called
- **THEN** it returns at once and `selection.variables` has no own key `x`
- **AND** `selection.variables.seats` is 5

### Requirement: Unknown ids in search parameters

`req~search-params-unknown-ids~1`
IF the entries name a plan, billing period or add-on that the pricing does not define, THEN `selectionFromSearchParams` SHALL report it only through the `PR_SELECTION_UNKNOWN_PLAN`, `PR_SELECTION_UNKNOWN_BILLING_PERIOD` or `PR_SELECTION_UNKNOWN_ADDON` warnings of `applySelectionInput`.

Needs: impl, utest

#### Scenario: Legacy plan and ghost add-on

- **GIVEN** the acme fixture and the entries `[['plan', 'legacy'], ['billing', 'weekly'], ['addon', 'ghost']]`
- **WHEN** `selectionFromSearchParams(acme, entries)` is called
- **THEN** the diagnostic codes are `PR_SELECTION_UNKNOWN_PLAN`, `PR_SELECTION_UNKNOWN_BILLING_PERIOD` and `PR_SELECTION_UNKNOWN_ADDON`, in that order, all with severity `warning`
- **AND** `selection.planId` is `starter` and `selection.billingPeriod` is `monthly`

### Requirement: Search parameter prefix

`req~search-params-prefix~1`
WHERE `options.prefix` is given, `selectionToSearchParams` and `selectionFromSearchParams` SHALL use `<prefix><key>` for every key they write or read, so that the reader ignores the entries without the prefix.

Needs: impl, utest

#### Scenario: Two renderers on one page

- **GIVEN** the acme fixture and `{ prefix: 'pr-' }`
- **WHEN** a selection with plan `growth` is written
- **THEN** the first entry is `['pr-plan', 'growth']`
- **WHEN** the entries `[['plan', 'enterprise'], ['pr-plan', 'growth']]` are read with the same prefix
- **THEN** `selection.planId` is `growth`

### Requirement: Search parameters round trip

`req~search-params-round-trip~1`
WHEN a URL-safe selection of a pricing (design.md, D4) is written with `selectionToSearchParams` and read back with `selectionFromSearchParams` on the same pricing and options, the core SHALL return a selection with the same `planId`, `billingPeriod`, `variables` and selected add-ons with their quantities, and no diagnostic.

Needs: impl, utest

#### Scenario: Acme selection

- **GIVEN** the acme fixture and the reconciled selection with plan `enterprise`, billing `yearly`, `seats` 30, `region` `us`, `extraStorage` quantity 4 and `prioritySuccess` quantity 1
- **WHEN** it is written and read back, without and with `{ prefix: 'pr-' }`
- **THEN** both results meet the requirement

### Requirement: Search parameter functions stay DOM-free

`req~search-params-no-dom~1`
The core SHALL type the `params` argument of `selectionFromSearchParams` as `Iterable<[string, string]>` and the result of `selectionToSearchParams` as `[string, string][]`, with no DOM type in either signature.

Needs: impl, utest

#### Scenario: URLSearchParams in and out

- **GIVEN** the core compiled with `tsconfig.core.json` (`"lib": ["ES2021"]`, `"types": []`)
- **WHEN** the core type-checks and a node test passes `new URLSearchParams('plan=growth')` as `params`
- **THEN** the type-check has no error and `selection.planId` is `growth`
- **AND** `new URLSearchParams(selectionToSearchParams(selection)).get('plan')` is `growth`
