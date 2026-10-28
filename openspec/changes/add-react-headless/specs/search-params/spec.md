## ADDED Requirements

### Requirement: Selection written as search parameter entries

`req~search-params-write~1`
WHEN `selectionToSearchParams(selection, options?)` is called, the core SHALL return `[key, value]` string pairs in this order: `plan` with `planId` and `billing` with `billingPeriod` when defined, one `addon` per selected add-on in key order (`id`, or `id:quantity` when the quantity is not 1 or the id contains `:`), then the variable pairs of `req~search-params-write-variables~1`.

Needs: impl, utest

#### Scenario: Growth, yearly, two add-ons

- **GIVEN** the selection `{ planId: 'growth', billingPeriod: 'yearly', variables: { seats: 12, region: 'eu' }, addOns: { extraStorage: { selected: true, quantity: 3 }, compliance: { selected: false, quantity: 1 }, prioritySuccess: { selected: true, quantity: 1 } } }`
- **WHEN** `selectionToSearchParams(selection)` is called
- **THEN** the result deeply equals `[['plan', 'growth'], ['billing', 'yearly'], ['addon', 'extraStorage:3'], ['addon', 'prioritySuccess'], ['var.seats', '12'], ['var.region', '"eu"']]`

#### Scenario: Id with a colon keeps its quantity

- **GIVEN** the selection `{ variables: {}, addOns: { 'a:b': { selected: true, quantity: 1 } } }`
- **WHEN** `selectionToSearchParams(selection)` is called
- **THEN** the result deeply equals `[['addon', 'a:b:1']]`

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

#### Scenario: Repeated plan and billing entries

- **GIVEN** the acme fixture and the entries `[['plan', 'growth'], ['billing', 'yearly'], ['plan', 'enterprise'], ['billing', 'monthly']]`
- **WHEN** `selectionFromSearchParams(acme, entries)` is called
- **THEN** `selection.planId` is `growth` and `selection.billingPeriod` is `yearly`
- **AND** `diagnostics` is `[]`

### Requirement: Add-on quantity that is not a number

`req~search-params-read-addon-quantity-nan~1`
IF `Number` of the text after the last `:` of an `addon` entry is `NaN`, as for `pack:abc`, THEN `selectionFromSearchParams` SHALL select that add-on with its `subscriptionConstraints.minQuantity`, else with quantity 1, the value that `applySelectionInput` gives a `NaN` quantity.

Needs: impl, utest

#### Scenario: Quantity that is not a number

- **GIVEN** the tiers pricing `normalizePricing({ syntaxVersion: '3.1', saasName: 'Tiers', currency: 'EUR', variables: { tiers: [1, 2, 3] }, plans: { basic: { price: 10 } }, addOns: { pack: { price: 1, subscriptionConstraints: { minQuantity: 2, maxQuantity: 8, quantityStep: 2 } } } }).value` and the entries `[['addon', 'pack:abc']]`
- **WHEN** `selectionFromSearchParams(tiers, entries)` is called
- **THEN** `selection.addOns.pack` deeply equals `{ selected: true, quantity: 2 }`
- **AND** `diagnostics` is `[]`

### Requirement: Repeated add-on id in search parameters

`req~search-params-read-repeated-addon~1`
WHEN the entries hold more than one `addon` entry with the same id, `selectionFromSearchParams` SHALL take the quantity of the last of these entries for that add-on.

Needs: impl, utest

#### Scenario: Extra storage named twice

- **GIVEN** the acme fixture and the entries `[['plan', 'growth'], ['addon', 'extraStorage:3'], ['addon', 'extraStorage:5']]`
- **WHEN** `selectionFromSearchParams(acme, entries)` is called
- **THEN** `selection.addOns.extraStorage` deeply equals `{ selected: true, quantity: 5 }`
- **AND** `diagnostics` is `[]`

### Requirement: Variable text that is not JSON

`req~search-params-var-text~1`
IF the value of a `var.<path>` entry is not valid JSON, THEN `selectionFromSearchParams` SHALL use the raw text as the variable value.

Needs: impl, utest

#### Scenario: Hand-written region

- **GIVEN** the acme fixture and the entries `[['var.region', 'us'], ['var.prioritySupport', 'true']]`
- **WHEN** `selectionFromSearchParams(acme, entries)` is called
- **THEN** `selection.variables.region` is the string `us` and `selection.variables.prioritySupport` is the boolean `true`

### Requirement: Variable types are not checked

`req~search-params-var-type-unchecked~1`
WHEN a `var.<path>` value has another type than the default at `<path>` in `pricing.variables`, `selectionFromSearchParams` SHALL set that value unchanged, without a diagnostic.
URL values are untrusted input: a host has to re-price and revalidate the selection on its own server at checkout. Checking a value's type against `pricing.variables` is a non-goal of the reader.

Needs: impl, utest

#### Scenario: Seats given as text

- **GIVEN** the acme fixture and the entries `[['var.seats', '"many"'], ['var.prioritySupport', '3']]`
- **WHEN** `selectionFromSearchParams(acme, entries)` is called
- **THEN** `selection.variables.seats` is the string `many` and `selection.variables.prioritySupport` is the number 3
- **AND** `diagnostics` is `[]`

### Requirement: Unsafe variable paths are ignored

`req~search-params-var-path-safe~2`
IF a segment of the `<path>` of a `var.<path>` entry is `__proto__`, `prototype` or `constructor`, or has an array parent and is not a match of `/^(0|[1-9]\d*)$/` below the parent's `length`, or has any other parent (record, scalar or none) and matches `/^\d+$/`, THEN `selectionFromSearchParams` SHALL ignore that entry.
The parent is the value that the earlier segments reach in the variables built so far.

Needs: impl, utest

#### Scenario: Prototype pollution attempt

- **GIVEN** the acme fixture and the entries `[['var.__proto__.isAdmin', 'true'], ['var.constructor.prototype.isAdmin', 'true'], ['var.__proto__[0]', '1'], ['var.seats', '7']]`
- **WHEN** `selectionFromSearchParams(acme, entries)` is called
- **THEN** `Object.prototype` has no own key `isAdmin` and no own key `0`
- **AND** `selection.variables.seats` is 7 and `selection.variables` has no own key `__proto__` or `constructor`

#### Scenario: Huge array index

- **GIVEN** the acme fixture and the entries `[['var.x.4294967294', '1'], ['var.seats[9]', '1']]`
- **WHEN** `selectionFromSearchParams(acme, entries)` is called
- **THEN** it returns in less than 1000 ms and `selection.variables` has no own key `x`
- **AND** `selection.variables.seats` is 5

#### Scenario: Array index that is not a canonical number

- **GIVEN** the tiers pricing of the scenario "Quantity that is not a number" and the entries `[['var.tiers.1e9', '7'], ['var.tiers.0x7fffffff', '7'], ['var.tiers. 5', '7'], ['var.tiers.01', '7'], ['var.tiers.3', '7'], ['var.tiers.length', '0']]`
- **WHEN** `selectionFromSearchParams(tiers, entries)` is called
- **THEN** it returns in less than 1000 ms
- **AND** `selection.variables.tiers` deeply equals `[1, 2, 3]` and its `length` is 3
- **AND** `selection.variables` has no own key other than `tiers`

#### Scenario: Existing array element

- **GIVEN** the tiers pricing of the scenario "Quantity that is not a number" and the entries `[['var.tiers.2', '9'], ['var.tiers[0]', '4']]`
- **WHEN** `selectionFromSearchParams(tiers, entries)` is called
- **THEN** `selection.variables.tiers` deeply equals `[4, 2, 9]`

### Requirement: One path split for check and write

`req~search-params-var-path-split~1`
WHEN `selectionFromSearchParams` sets a `var.<path>` value, it SHALL write it at the segments of one split of `<path>` (`[<digits>]` read as `.<digits>`, empty segments dropped), the same segments that `req~search-params-var-path-safe~2` checks.

Needs: impl, utest

#### Scenario: Bracket that is not an index

- **GIVEN** the tiers pricing of the scenario "Quantity that is not a number" and the entries `[['var.tiers[2]', '9'], ['var.tiers[ 5]', '7']]`
- **WHEN** `selectionFromSearchParams(tiers, entries)` is called
- **THEN** `selection.variables.tiers` deeply equals `[1, 2, 9]` and its `length` is 3
- **AND** `selection.variables['tiers[ 5]']` is 7, the text `[ 5]` being part of one record key and no array index

### Requirement: Prototype keys left out of variable values

`req~search-params-var-proto-keys~1`
IF the JSON value of a `var.<path>` entry holds a `__proto__` key at any depth, THEN `selectionFromSearchParams` SHALL leave that key and its value out of the variable value it sets.

Needs: impl, utest

#### Scenario: Proto keys in a nested value

- **GIVEN** the acme fixture and the entries `[['var.priceByRegion', '{"eu-price":9,"__proto__":{"isAdmin":true},"nested":{"__proto__":{"x":1},"k":2}}']]`
- **WHEN** `selectionFromSearchParams(acme, entries)` is called
- **THEN** `selection.variables.priceByRegion` deeply equals `{ 'eu-price': 9, nested: { k: 2 } }`
- **AND** neither `selection.variables.priceByRegion` nor `selection.variables.priceByRegion.nested` has an own key `__proto__`
- **AND** `Object.prototype` has no own key `isAdmin` or `x`

### Requirement: Reading search parameters never throws

`req~search-params-read-no-throw~1`
The core SHALL make `selectionFromSearchParams` return a result without throwing for every `params` whose own iteration does not throw, an entry that is not an array of two strings being ignored.

Needs: impl, utest

#### Scenario: Malformed entries

- **GIVEN** the acme fixture and the entries `[null, ['var.seats'], [1, 2], ['var.', '3'], ['var.seats', '{'], ['plan', 'growth']]`, passed as `params` through a cast
- **WHEN** `selectionFromSearchParams(acme, entries)` is called
- **THEN** it does not throw
- **AND** `selection.planId` is `growth` and `selection.variables.seats` is the string `{`

### Requirement: Long variable values are ignored

`req~search-params-var-length-limit~1`
IF the value of a `var.<path>` entry is longer than 2048 UTF-16 code units (`value.length > 2048`), THEN `selectionFromSearchParams` SHALL ignore that entry without parsing it.

Needs: impl, utest

#### Scenario: Twenty thousand nested brackets

- **GIVEN** the acme fixture and the entries `[['var.seats', '['.repeat(20000) + ']'.repeat(20000)], ['var.region', '"' + 'a'.repeat(2046) + '"']]`
- **WHEN** `selectionFromSearchParams(acme, entries)` is called
- **THEN** it returns a selection without throwing and `selection.variables.seats` is 5
- **AND** `selection.variables.region` is `'a'.repeat(2046)`, a value of exactly 2048 code units being read

### Requirement: Deep variable entries are ignored

`req~search-params-var-depth-limit~1`
IF the `<path>` of a `var.<path>` entry has more than 8 segments or its parsed JSON value has a depth above 8, THEN `selectionFromSearchParams` SHALL ignore that entry.
The depth of a value that is not an array or object is 0; the depth of an array or object is 1 plus the largest depth of its members, and 1 when it is empty.

Needs: impl, utest

#### Scenario: Value nested nine levels

- **GIVEN** the acme fixture and the entries `[['var.priceByRegion', '['.repeat(9) + '1' + ']'.repeat(9)], ['var.seats', '['.repeat(8) + '1' + ']'.repeat(8)]]`
- **WHEN** `selectionFromSearchParams(acme, entries)` is called
- **THEN** `selection.variables.priceByRegion` deeply equals `{ 'eu-price': 8, 'us-price': 10 }`
- **AND** `selection.variables.seats` deeply equals `[[[[[[[[1]]]]]]]]`, eight nested arrays

#### Scenario: Path of nine segments

- **GIVEN** the acme fixture and the entries `[['var.a.b.c.d.e.f.g.h.i', '1'], ['var.k.b.c.d.e.f.g.h', '1']]`
- **WHEN** `selectionFromSearchParams(acme, entries)` is called
- **THEN** `selection.variables` has no own key `a`
- **AND** `selection.variables.k.b.c.d.e.f.g.h` is 1

### Requirement: At most 100 entries are read

`req~search-params-entry-limit~1`
WHEN `selectionFromSearchParams` has taken 100 entries from `params`, it SHALL stop the iteration and ignore every later entry.

Needs: impl, utest

#### Scenario: Plan after one hundred entries

- **GIVEN** the acme fixture and 100 entries `['utm_source', 'mail']` followed by `['plan', 'growth']`
- **WHEN** `selectionFromSearchParams(acme, entries)` is called
- **THEN** `selection.planId` is `starter`
- **AND** for a generator that yields `['utm_source', 'mail']` without end, the call returns after taking at most 100 entries from it

### Requirement: Long unknown ids are cut in diagnostics

`req~search-params-diagnostic-id-length~1`
IF an entry names an unknown plan, billing period or add-on id longer than 64 characters, THEN `selectionFromSearchParams` SHALL put only the first 64 characters of that id in the `message` and `path` of its diagnostic.
The whole id is still matched against the pricing; only the diagnostic text is cut, which amends the `applySelectionInput` result of `req~search-params-read~1` and `req~search-params-unknown-ids~1`.

Needs: impl, utest

#### Scenario: Five thousand character ids

- **GIVEN** the acme fixture and the entries `[['plan', 'x'.repeat(5000)], ['addon', 'y'.repeat(5000)]]`
- **WHEN** `selectionFromSearchParams(acme, entries)` is called
- **THEN** the diagnostic codes are `PR_SELECTION_UNKNOWN_PLAN` and `PR_SELECTION_UNKNOWN_ADDON`, in that order
- **AND** the plan diagnostic's `message` contains `'x'.repeat(64)` and does not contain `'x'.repeat(65)`
- **AND** the add-on diagnostic's `path` is `'selection.addOns.' + 'y'.repeat(64)` and its `message` does not contain `'y'.repeat(65)`

### Requirement: Unknown ids in search parameters

`req~search-params-unknown-ids~1`
IF the entries name a plan, billing period or add-on that the pricing does not define, THEN `selectionFromSearchParams` SHALL report it only through the `PR_SELECTION_UNKNOWN_PLAN`, `PR_SELECTION_UNKNOWN_BILLING_PERIOD` or `PR_SELECTION_UNKNOWN_ADDON` warnings of `applySelectionInput`.
This holds also for `__proto__` and the other property names of `Object.prototype`.

Needs: impl, utest

#### Scenario: Legacy plan and ghost add-on

- **GIVEN** the acme fixture and the entries `[['plan', 'legacy'], ['billing', 'weekly'], ['addon', 'ghost']]`
- **WHEN** `selectionFromSearchParams(acme, entries)` is called
- **THEN** the diagnostic codes are `PR_SELECTION_UNKNOWN_PLAN`, `PR_SELECTION_UNKNOWN_BILLING_PERIOD` and `PR_SELECTION_UNKNOWN_ADDON`, in that order, all with severity `warning`
- **AND** `selection.planId` is `starter` and `selection.billingPeriod` is `monthly`

#### Scenario: Add-on ids named like prototype properties

- **GIVEN** the acme fixture and the entries `[['addon', '__proto__'], ['addon', 'constructor']]`
- **WHEN** `selectionFromSearchParams(acme, entries)` is called
- **THEN** the diagnostic codes are `PR_SELECTION_UNKNOWN_ADDON` and `PR_SELECTION_UNKNOWN_ADDON`, with the paths `selection.addOns.__proto__` and `selection.addOns.constructor`
- **AND** `selection.addOns` deeply equals `{}` and `Object.prototype` is unchanged

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

`req~search-params-round-trip~2`
WHEN a URL-safe selection is written by `selectionToSearchParams` and read by `selectionFromSearchParams` with the same pricing and options, the core SHALL return the same `planId`, `billingPeriod`, `variables` and selected add-on quantities, without diagnostics.
URL-safe: a `reconcileSelection` result with defined `planId` and `billingPeriod`, the pricing's ids and `normalizeAddOnQuantity` quantities, at most 100 pairs, URL-safe variables.

Needs: impl, utest

#### Scenario: Acme selection

- **GIVEN** the acme fixture and the reconciled selection with plan `enterprise`, billing `yearly`, `seats` 30, `region` `us`, `extraStorage` quantity 4 and `prioritySuccess` quantity 1
- **WHEN** it is written and read back, without and with `{ prefix: 'pr-' }`
- **THEN** both results meet the requirement

### Requirement: URL-safe variables round trip

`req~search-params-round-trip-variables~1`
WHEN URL-safe variables of a pricing are written by `selectionToSearchParams` and read by `selectionFromSearchParams`, the core SHALL return deeply equal `variables`.
URL-safe variables have exactly the top-level keys of `pricing.variables`, none empty or holding `.` or `[`, values that `JSON.parse(JSON.stringify(value))` returns deeply equal with no `__proto__` key at any depth, and no entry that a rule of this spec ignores.

Needs: impl, utest

#### Scenario: Acme variables

- **GIVEN** the acme fixture and a selection with plan `starter` whose `variables` are `{ seats: 30, prioritySupport: true, region: 'us', priceByRegion: { 'eu-price': 8, 'us-price': 12 } }`
- **WHEN** it is written and read back
- **THEN** `selection.variables` deeply equals those variables

### Requirement: Search parameter functions stay DOM-free

`req~search-params-no-dom~1`
The core SHALL type the `params` argument of `selectionFromSearchParams` as `Iterable<[string, string]>` and the result of `selectionToSearchParams` as `[string, string][]`, with no DOM type in either signature.

Needs: impl, utest

#### Scenario: URLSearchParams in and out

- **GIVEN** the core compiled with `tsconfig.core.json` (`"lib": ["ES2021"]`, `"types": []`)
- **WHEN** the core type-checks and a node test passes `new URLSearchParams('plan=growth')` as `params`
- **THEN** the type-check has no error and `selection.planId` is `growth`
- **AND** `new URLSearchParams(selectionToSearchParams(selection)).get('plan')` is `growth`
