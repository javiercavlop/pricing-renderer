## ADDED Requirements

### Requirement: Plan change without removals applies at once

`req~core-plan-change-immediate~1`
WHEN `planSelectionChange(pricing, selection, { type: 'plan', planId })` finds that `reconcileSelection` of `selection` with `planId` removes no add-on, the core SHALL return `{ kind: 'apply', selection }` with that reconciled selection.

Needs: impl, utest

#### Scenario: Starter to growth on the acme fixture

- **GIVEN** the acme fixture and its default selection (plan `starter`, no add-on)
- **WHEN** `planSelectionChange(acme, selection, { type: 'plan', planId: 'growth' })` is called
- **THEN** the result has `kind: 'apply'` and `selection.planId` is `growth`

### Requirement: Plan change with removals is pending

`req~core-plan-change-pending~1`
WHEN `planSelectionChange` with a plan intent finds that reconciliation removes add-ons, the core SHALL return `{ kind: 'confirm', pending }` with `pending` equal to `{ addOnId: '', select: false, addIds: [], removeIds, planId }`, where `removeIds` lists the removed ids in the order of `pricing.addOns`.

Needs: impl, utest

#### Scenario: Growth with extra storage to starter

- **GIVEN** the acme fixture and a selection with plan `growth`, `extraStorage` `{ selected: true, quantity: 2 }` and `prioritySuccess` `{ selected: true, quantity: 1 }`
- **WHEN** `planSelectionChange(acme, selection, { type: 'plan', planId: 'starter' })` is called
- **THEN** the result deeply equals `{ kind: 'confirm', pending: { addOnId: '', select: false, addIds: [], removeIds: ['extraStorage', 'prioritySuccess'], planId: 'starter' } }`

### Requirement: Selecting an add-on adds dependencies and removes conflicts

`req~core-addon-select-change~1`
WHEN `planSelectionChange` gets `{ type: 'addOn', addOnId, selected: true }` and the add-on needs unselected transitive `dependsOn` add-ons or conflicts with selected add-ons (its own `excludes`, add-ons whose `excludes` name it, and the `excludes` of each added dependency), the core SHALL return `{ kind: 'confirm', pending }` with `pending` equal to `{ addOnId, select: true, addIds, removeIds }`.

Needs: impl, utest

#### Scenario: Priority success needs extra storage

- **GIVEN** the acme fixture and a selection with plan `growth` and no add-on selected
- **WHEN** `planSelectionChange(acme, selection, { type: 'addOn', addOnId: 'prioritySuccess', selected: true })` is called
- **THEN** the result deeply equals `{ kind: 'confirm', pending: { addOnId: 'prioritySuccess', select: true, addIds: ['extraStorage'], removeIds: [] } }`

#### Scenario: Priority success excludes compliance

- **GIVEN** the acme fixture and a selection with plan `enterprise` and `extraStorage` and `compliance` selected
- **WHEN** the same intent is planned
- **THEN** `pending.addIds` is `[]` and `pending.removeIds` is `['compliance']`

#### Scenario: Compliance is excluded by priority success

- **GIVEN** the acme fixture and a selection with plan `enterprise` and `extraStorage` and `prioritySuccess` selected (`compliance` has no `excludes`; `prioritySuccess` excludes `compliance`)
- **WHEN** `planSelectionChange(acme, selection, { type: 'addOn', addOnId: 'compliance', selected: true })` is called
- **THEN** the result deeply equals `{ kind: 'confirm', pending: { addOnId: 'compliance', select: true, addIds: [], removeIds: ['prioritySuccess'] } }`

#### Scenario: Two-level dependency chain

- **GIVEN** the chain pricing `normalizePricing({ syntaxVersion: '3.1', saasName: 'Chain', currency: 'EUR', plans: { basic: { price: 10 } }, addOns: { base: { price: 1 }, middle: { price: 1, dependsOn: ['base'], excludes: ['legacy'] }, top: { price: 1, dependsOn: ['middle'] }, legacy: { price: 1 } } }).value` and a selection with plan `basic` and no add-on selected
- **WHEN** `planSelectionChange(chain, selection, { type: 'addOn', addOnId: 'top', selected: true })` is called
- **THEN** the result has `kind: 'confirm'`, `pending.addOnId` is `top` and `pending.select` is `true`
- **AND** `pending.addIds` holds exactly `middle` and `base`, in any order, and `pending.removeIds` is `[]`

#### Scenario: Exclusion of an added dependency

- **GIVEN** the chain pricing of the scenario "Two-level dependency chain" and a selection with plan `basic` and only `legacy` selected
- **WHEN** `planSelectionChange(chain, selection, { type: 'addOn', addOnId: 'top', selected: true })` is called
- **THEN** `pending.addIds` holds exactly `middle` and `base`, in any order
- **AND** `pending.removeIds` is `['legacy']`, named only by the `excludes` of the dependency `middle`

### Requirement: Deselecting an add-on removes its dependents

`req~core-addon-deselect-change~1`
WHEN `planSelectionChange` gets `{ type: 'addOn', addOnId, selected: false }` and selected add-ons depend on it directly or transitively, the core SHALL return `{ kind: 'confirm', pending }` with `pending` equal to `{ addOnId, select: false, addIds: [], removeIds }`, where `removeIds` lists those selected dependents.

Needs: impl, utest

#### Scenario: Extra storage carries priority success

- **GIVEN** the acme fixture and a selection with plan `growth`, `extraStorage` and `prioritySuccess` selected
- **WHEN** `planSelectionChange(acme, selection, { type: 'addOn', addOnId: 'extraStorage', selected: false })` is called
- **THEN** the result has `kind: 'confirm'` and `pending.removeIds` is `['prioritySuccess']`

#### Scenario: Transitive dependents

- **GIVEN** the chain pricing of the scenario "Two-level dependency chain" and a selection with plan `basic` and `base`, `middle` and `top` selected
- **WHEN** `planSelectionChange(chain, selection, { type: 'addOn', addOnId: 'base', selected: false })` is called
- **THEN** the result has `kind: 'confirm'`, `pending.addOnId` is `base`, `pending.select` is `false` and `pending.addIds` is `[]`
- **AND** `pending.removeIds` holds exactly `middle` and `top`, in any order

### Requirement: Add-on change without side effects applies at once

`req~core-addon-change-direct~1`
WHEN an intent for an add-on of `pricing.addOns` yields no `addIds` and no `removeIds`, `planSelectionChange` SHALL return `{ kind: 'apply', selection }` where `selection` deeply equals `applySelectionChange(pricing, selection, { addOnId, select: selected, addIds: [], removeIds: [] })`.

Needs: impl, utest

#### Scenario: Extra storage alone

- **GIVEN** the acme fixture and a selection with plan `growth` and no add-on selected
- **WHEN** the intent `{ type: 'addOn', addOnId: 'extraStorage', selected: true }` is planned
- **THEN** the result has `kind: 'apply'` and `selection.addOns.extraStorage` deeply equals `{ selected: true, quantity: 1 }`

### Requirement: Unknown add-on in an intent changes nothing

`req~core-addon-change-unknown~1`
IF an add-on intent names an id that is not in `pricing.addOns`, THEN `planSelectionChange` SHALL return `{ kind: 'apply', selection }` with a selection deeply equal to the given one.

Needs: impl, utest

#### Scenario: Ghost add-on

- **GIVEN** the acme fixture and its default selection
- **WHEN** the intent `{ type: 'addOn', addOnId: 'ghost', selected: true }` is planned
- **THEN** the result has `kind: 'apply'` and its selection deeply equals the default selection

### Requirement: Applying a confirmed change

`req~core-apply-selection-change~1`
WHEN `applySelectionChange(pricing, selection, pending)` is called, the core SHALL return the reconciled selection in which the planned add-on (unless `pending.planId` is set), every `addIds` entry and every `removeIds` entry take their planned state with the quantity of the existing entry, else `subscriptionConstraints.minQuantity`, else 1, and `planId` is `pending.planId` when it is set.

Needs: impl, utest

#### Scenario: Confirmed dependency

- **GIVEN** the acme fixture, a selection with plan `growth` and no add-on, and the pending change `{ addOnId: 'prioritySuccess', select: true, addIds: ['extraStorage'], removeIds: [] }`
- **WHEN** `applySelectionChange` is called
- **THEN** `addOns.prioritySuccess` is `{ selected: true, quantity: 1 }` and `addOns.extraStorage` is `{ selected: true, quantity: 1 }`

#### Scenario: Confirmed plan change

- **GIVEN** the pending change of the scenario "Growth with extra storage to starter"
- **WHEN** it is applied to that selection
- **THEN** `planId` is `starter`, `addOns.extraStorage` is `{ selected: false, quantity: 2 }` and `addOns.prioritySuccess` is `{ selected: false, quantity: 1 }`

### Requirement: Variable update helper

`req~core-selection-with-variable~1`
WHEN `selectionWithVariable(selection, path, value)` is called, the core SHALL return a copy of `selection` whose `variables` hold `value` at the dot path `path`, every other variable unchanged.

Needs: impl, utest

#### Scenario: Nested variable

- **GIVEN** the acme fixture and its default selection
- **WHEN** `selectionWithVariable(selection, 'priceByRegion.us-price', 12)` is called
- **THEN** `variables.priceByRegion` deeply equals `{ 'eu-price': 8, 'us-price': 12 }` and `variables.seats` is 5

### Requirement: Add-on quantity helper

`req~core-selection-with-addon-quantity~1`
WHEN `selectionWithAddOnQuantity(pricing, selection, addOnId, quantity)` is called, the core SHALL return a copy of `selection` whose `addOns[addOnId]` is `{ selected: true, quantity: q }`, where `q` is `normalizeAddOnQuantity` of that entry with `quantity`.

Needs: impl, utest

#### Scenario: Quantity above the maximum

- **GIVEN** the acme fixture and its default selection
- **WHEN** `selectionWithAddOnQuantity(acme, selection, 'extraStorage', 40)` is called
- **THEN** `addOns.extraStorage` deeply equals `{ selected: true, quantity: 10 }`

### Requirement: Selection in effect follows variablesEnabled

`req~core-selection-in-effect~1`
WHEN `selectionInEffect(pricing, selection, options)` is called, the core SHALL return a copy of `selection` whose `variables` are a copy of `pricing.variables` if `options.variablesEnabled` is `false`, and a copy of `selection.variables` otherwise.

Needs: impl, utest

#### Scenario: Variables disabled

- **GIVEN** the acme fixture and a selection whose `variables.seats` is 40
- **WHEN** `selectionInEffect(acme, selection, { variablesEnabled: false })` is called
- **THEN** `variables.seats` is 5
- **AND** with `{ variablesEnabled: true }` it is 40

### Requirement: Selection functions do not mutate their inputs

`req~core-selection-no-mutation~1`
The core SHALL leave the `pricing`, `selection`, `intent` and `pending` arguments of `planSelectionChange`, `applySelectionChange`, `selectionWithVariable`, `selectionWithAddOnQuantity` and `selectionInEffect` deeply unchanged.

Needs: impl, utest

#### Scenario: Frozen inputs

- **GIVEN** deep-frozen copies of the acme fixture, a selection and a pending change
- **WHEN** each of the five functions is called with them
- **THEN** no call throws and every argument deeply equals its copy taken before the call

### Requirement: Last valid price replaces an error price

`req~price-stabilizer-last-valid~1`
WHEN `stabilize(viewModel)` of a `createPriceStabilizer()` result meets a plan or add-on price of kind `error` and the stabilizer holds an `amount` price for the same id, the stabilizer SHALL put that held price in `resolved.planPrices` or `resolved.addOnPrices` of the returned view model.

Needs: impl, utest

#### Scenario: Plan price kept

- **GIVEN** a stabilizer that stabilized a view model whose `resolved.planPrices.starter` is `{ kind: 'amount', amount: 20, baseAmount: 20, billingMultiplier: 1, quantity: 1 }`
- **WHEN** it stabilizes a view model whose `resolved.planPrices.starter` has kind `error`
- **THEN** the returned `resolved.planPrices.starter` deeply equals the `amount` price above

### Requirement: Every stabilize call records valid prices

`req~price-stabilizer-records~1`
WHEN `stabilize(viewModel)` is called, the stabilizer SHALL record every plan and add-on price of kind `amount` of that view model by id, also when the caller discards the result.

Needs: impl, utest

#### Scenario: A discarded read still records

- **GIVEN** a new stabilizer
- **WHEN** it stabilizes view model A with `planPrices.growth` of kind `amount` and amount 45, the result is dropped, and then view model B with `planPrices.growth` of kind `error`
- **THEN** the returned `planPrices.growth.amount` of B is 45

### Requirement: Kept price drives its breakdown line

`req~price-stabilizer-breakdown-line~1`
WHEN the stabilizer replaces the price of the plan or an add-on that has a line in `resolved.breakdown`, the stabilizer SHALL set that line's `quantity`, `unitAmount`, `billingMultiplier` and `amount` to the kept price's `quantity`, `baseAmount`, `billingMultiplier` and `amount`, and its `requiresQuote` to `false`.

Needs: impl, utest

#### Scenario: Plan line takes the kept factors

- **GIVEN** the stabilizer of the scenario "Plan price kept" and a view model whose breakdown plan line is `starter` with `amount` undefined
- **WHEN** it is stabilized
- **THEN** the plan line has `quantity: 1`, `unitAmount: 20`, `billingMultiplier: 1`, `amount: 20` and `requiresQuote: false`

### Requirement: Subtotal folded from the stabilized lines

`req~price-stabilizer-subtotal~1`
WHEN `stabilize(viewModel)` returns, the stabilizer SHALL have set `resolved.breakdown.subtotal` and `resolved.subtotal` to the plan line amount plus every defined add-on line amount of the stabilized breakdown, 0 standing for a missing plan line or an undefined plan line amount.

Needs: impl, utest

#### Scenario: Plan kept, add-on resolved

- **GIVEN** a stabilized breakdown with a kept plan line of amount 20 and one add-on line of amount 5
- **WHEN** `stabilize` returns
- **THEN** `resolved.subtotal` and `resolved.breakdown.subtotal` are both 25

### Requirement: Reset forgets the kept prices

`req~price-stabilizer-reset~1`
WHEN `reset()` of a stabilizer is called, the stabilizer SHALL forget every recorded price, so an `error` price stays an `error` price until a new `amount` price for that id is recorded.

Needs: impl, utest

#### Scenario: Reset before the error

- **GIVEN** the stabilizer of the scenario "Plan price kept" before its second call
- **WHEN** `reset()` is called and the view model with the `error` price is stabilized
- **THEN** the returned `planPrices.starter` has kind `error`

### Requirement: Selection logic is exported

`req~selection-logic-exported~1`
The package root `pricing-renderer` SHALL export the functions `planSelectionChange`, `applySelectionChange`, `selectionWithVariable`, `selectionWithAddOnQuantity`, `selectionInEffect` and `createPriceStabilizer`, and the types `PendingAddOnChange`, `SelectionChangeIntent`, `SelectionChangeResult` and `PriceStabilizer`.

Needs: impl, utest

#### Scenario: Root entry exports

- **GIVEN** the module namespace of `src/core/index.ts`
- **WHEN** each of the six function names is read
- **THEN** each one has type `function`
- **AND** a type-check snippet that imports the four types from `../../src/core/index.js` (the source of the package root, resolved relative to `tests/unit/` as in `tests/unit/compare-types.test.ts`) compiles

### Requirement: Pending change type stays on the element entry

`req~pending-change-type-shared~1`
The entry `pricing-renderer/element` SHALL export `PendingAddOnChange` as the same type that the package root exports.

Needs: impl, utest

#### Scenario: Both entries name one type

- **GIVEN** a type-check snippet in `tests/unit/` that assigns a `PendingAddOnChange` imported from `../../src/core/index.js` (the source of `pricing-renderer`) to one imported from `../../src/element/index.js` (the source of `pricing-renderer/element`) and back
- **WHEN** it is compiled
- **THEN** it compiles without errors

### Requirement: Validation function exported

`req~apply-input-exported~1`
The package root `pricing-renderer` SHALL export the function `applySelectionInput` and the type `ApplySelectionInputResult`.
This requirement supersedes `req~apply-input-internal~1` (`docs/agent-work/delivera-2-load-current-contract/spec.md:62-64`); the owner accepted it in CRP-P3-A.

Needs: impl, utest

#### Scenario: Core entry point exports the function

- **GIVEN** the module namespace of `src/core/index.ts`
- **WHEN** its keys are listed
- **THEN** `applySelectionInput` is among them and is the function of `src/core/apply-selection.ts`
