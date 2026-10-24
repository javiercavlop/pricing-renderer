# Spec: load the current contract into the renderer

Change `delivera-2-load-current-contract`, written before the implementation: the requirements
below are the contract for the tests of `pricing-renderer`. The public API they describe is
owner-approved (see `proposal.md`, "Decisions").

## Definitions

- Acme fixture: `tests/fixtures/acme-pricing.yml` parsed and normalized. Schema defaults
  (`createDefaultSelection`): `{ planId: 'starter', billingPeriod: 'monthly', variables, addOns: {} }`
  with `variables` equal to `{ seats: 5, prioritySupport: false, region: 'eu', priceByRegion: { 'eu-price': 8, 'us-price': 10 } }`.
  Billing: `monthly` 1, `yearly` 0.8. Monthly prices with these variables: Starter 20 (`4 * #seats`),
  Growth 45 (`9 * #seats`), Enterprise 40 (8 for region `eu` x 5 seats), `extraStorage` 5 per pack
  (available for `growth` and `enterprise`, quantity 1 to 10, step 1), `prioritySuccess` 25
  (`Math.floor(#seats / 5) < 1 ? 25 : Math.floor(#seats / 5) * 25` with 5 seats; available for
  `growth` and `enterprise`, depends on `extraStorage`, no quantity constraints), `compliance` "Contact sales" (`enterprise` only).
- Slack fixture: `tests/fixtures/spectra/slack/2024.yml` parsed and normalized. It has no `billing`
  block, so its only billing period is `base` with multiplier 1, and `variables` is `{}`. Schema
  defaults: `{ planId: 'FREE', billingPeriod: 'base', variables: {}, addOns: {} }`. Plans: `FREE` 0,
  `PRO` 8.75, `BUSINESS_PLUS` 15, `ENTERPRISE_GRID` "Contact Sales". Add-ons: `slackAI`
  (`PRO`, `BUSINESS_PLUS`, `ENTERPRISE_GRID`; "Contact Sales"), `slackAtlas` (`BUSINESS_PLUS` only;
  "Contact Sales"; no quantity constraints), `slackEnterpriseKeys` (`ENTERPRISE_GRID` only),
  `premiumWorkflowOverageCost` (`PRO`, `BUSINESS_PLUS`, `ENTERPRISE_GRID`; 0.05 per execution;
  minimum 1, no maximum (`.inf`), step 1).
- Contract selection `C`: `{ planId: 'growth', addOns: { extraStorage: { selected: true, quantity: 2 }, prioritySuccess: { selected: true, quantity: 1 } } }`.
  On the acme fixture its subtotal is 80 (45 + 2 x 5 + 25).
- Validation function: `applySelectionInput(pricing, current, input)` in
  `src/core/apply-selection.ts`, a pure function of the normalized pricing, the current selection
  (`PricingSelection`) and the input (`Partial<PricingSelection>`).
- The element: `<pricing-renderer>` (`src/element/pricing-renderer-element.ts`). Controlled mode: the
  host has set its `selection` property; otherwise the element keeps an internal selection
  (uncontrolled).
- Ready: the element has a normalized pricing and no load is in flight. The element is not ready
  before its first load ends, while a load is in flight, and after a failed load with no earlier
  pricing. A failed reload that keeps an earlier pricing leaves the element ready.
- Selection in effect: `reconcileSelection` applied to the controlled `selection` when it is set,
  else to the internal selection, with `variables` replaced by the pricing default variables while
  `variablesEnabled` is `false` (the selection `pricing-action` carries today).
- Demo page: `/` of the Playwright web server. It loads the acme fixture through `yaml`, with
  `locale: 'en-US'` and `variablesEnabled: true`; on load it shows Starter selected and the estimate
  `€20` in `.pr-summary`.
- Diagnostic messages are non-empty strings and their text is not normative; tests check `code`,
  `severity`, `path` and `details`.

## Requirements: validation function (core)

### Requirement: Validation function result

`req~apply-input-result~1`
The module `src/core/apply-selection.ts` SHALL export `applySelectionInput(pricing, current, input)` returning `{ selection, removedAddOnIds, diagnostics }`.
Needs: impl, utest

#### Scenario: Delivera contract on the acme fixture

- **GIVEN** the acme fixture, `current` equal to its schema defaults and `input` equal to `C`
- **WHEN** `applySelectionInput` is imported from `src/core/apply-selection.ts` and called
- **THEN** `selection` deeply equals `{ planId: 'growth', billingPeriod: 'monthly', variables, addOns: { extraStorage: { selected: true, quantity: 2 }, prioritySuccess: { selected: true, quantity: 1 } } }`
  with the default `variables`
- **AND** `removedAddOnIds` equals `[]` and `diagnostics` equals `[]`
- **AND** `resolvePricing(acme, selection).subtotal` is 80

### Requirement: Validation function stays internal

`req~apply-input-internal~1`
The core entry point `src/core/index.ts` SHALL NOT export `applySelectionInput`.
Needs: impl, utest

#### Scenario: Core entry point exports

- **GIVEN** the module namespace of `src/core/index.ts`
- **WHEN** its keys are listed
- **THEN** `applySelectionInput` is not among them

### Requirement: Unknown plan keeps the current plan

`req~apply-input-unknown-plan~1`
IF `input.planId` is defined and is not, with case-sensitive comparison, the id of a plan in `pricing.plans`, THEN `applySelectionInput` SHALL use `current.planId` as the plan of the selection.
Needs: impl, utest

#### Scenario: Legacy plan on Growth

- **GIVEN** the acme fixture, `current` with plan `growth` and `input` `{ planId: 'legacy' }`
- **WHEN** `applySelectionInput` is called
- **THEN** `selection.planId` is `'growth'`

#### Scenario: Wrong case

- **GIVEN** the acme fixture, `current` equal to the schema defaults and `input` `{ planId: 'Growth' }`
- **WHEN** `applySelectionInput` is called
- **THEN** `selection.planId` is `'starter'`

### Requirement: Unknown billing period keeps the current period

`req~apply-input-unknown-billing~1`
IF `input.billingPeriod` is defined and is not the id of a period in `pricing.billing`, THEN `applySelectionInput` SHALL use `current.billingPeriod` as the billing period of the selection.
Needs: impl, utest

#### Scenario: Quarterly on the acme fixture

- **GIVEN** the acme fixture, `current` with billing `yearly` and `input`
  `{ planId: 'growth', billingPeriod: 'quarterly' }`
- **WHEN** `applySelectionInput` is called
- **THEN** `selection.billingPeriod` is `'yearly'` and `selection.planId` is `'growth'`

#### Scenario: Monthly on the Slack fixture

- **GIVEN** the Slack fixture, `current` equal to its schema defaults and `input`
  `{ planId: 'PRO', billingPeriod: 'monthly' }`
- **WHEN** `applySelectionInput` is called
- **THEN** `selection.billingPeriod` is `'base'` and `selection.planId` is `'PRO'`

### Requirement: Unknown add-on ids are dropped

`req~apply-input-unknown-addons~1`
WHEN `input.addOns` has an entry whose id is not the id of an add-on in `pricing.addOns`, `applySelectionInput` SHALL leave that entry out of the selection.
Needs: impl, utest

#### Scenario: Ghost and phantom entries

- **GIVEN** the acme fixture, `current` equal to the schema defaults and `input`
  `{ planId: 'growth', addOns: { ghost: { selected: true, quantity: 1 }, extraStorage: { selected: true, quantity: 2 }, phantom: { selected: false, quantity: 3 } } }`
- **WHEN** `applySelectionInput` is called
- **THEN** `selection.addOns` deeply equals `{ extraStorage: { selected: true, quantity: 2 } }`

### Requirement: Validation warnings

`req~apply-input-warnings~1`
WHEN steps 1 to 3 replace the plan, replace the billing period or drop an add-on id, `applySelectionInput` SHALL add one `warning` diagnostic per replacement or dropped id, with code and path `PR_SELECTION_UNKNOWN_PLAN` / `selection.planId`, `PR_SELECTION_UNKNOWN_BILLING_PERIOD` / `selection.billingPeriod` or `PR_SELECTION_UNKNOWN_ADDON` / `selection.addOns.<id>`, the add-on warnings in the key order of `input.addOns`.
Needs: impl, utest

#### Scenario: Unknown plan

- **GIVEN** the acme fixture, `current` with plan `growth` and `input` `{ planId: 'legacy' }`
- **WHEN** `applySelectionInput` is called
- **THEN** `diagnostics` has one entry with `code: 'PR_SELECTION_UNKNOWN_PLAN'`,
  `severity: 'warning'` and `path: 'selection.planId'`

#### Scenario: Unknown billing period

- **GIVEN** the acme fixture, `current` with billing `yearly` and `input`
  `{ planId: 'growth', billingPeriod: 'quarterly' }`
- **WHEN** `applySelectionInput` is called
- **THEN** `diagnostics` has one entry with `code: 'PR_SELECTION_UNKNOWN_BILLING_PERIOD'`,
  `severity: 'warning'` and `path: 'selection.billingPeriod'`

#### Scenario: Unknown add-ons in input order

- **GIVEN** the input of the scenario "Ghost and phantom entries"
- **WHEN** `applySelectionInput` is called
- **THEN** `diagnostics` has two `warning` entries with `code: 'PR_SELECTION_UNKNOWN_ADDON'`, the
  first with `path: 'selection.addOns.ghost'`, the second with `path: 'selection.addOns.phantom'`

#### Scenario: Valid and omitted fields

- **GIVEN** the acme fixture, `current` equal to the schema defaults and `input` `{}` or `C`
- **WHEN** `applySelectionInput` is called
- **THEN** `diagnostics` equals `[]`

### Requirement: Quantities of selected add-ons are normalized

`req~apply-input-quantities~1`
The `applySelectionInput` function SHALL set the quantity of every selected `input.addOns` entry with a known id to `normalizeAddOnQuantity(pricing, id, entry)` and keep the input quantity of every unselected entry.
Needs: impl, utest

#### Scenario: Above the maximum, zero and not a number

- **GIVEN** the acme fixture, plan `growth` and `extraStorage` selected with quantity 25, then 0,
  then `NaN`
- **WHEN** `applySelectionInput` is called with each input
- **THEN** `selection.addOns.extraStorage.quantity` is 10, then 1, then 1

#### Scenario: Unselected entry keeps its quantity

- **GIVEN** the acme fixture and `input`
  `{ planId: 'growth', addOns: { extraStorage: { selected: false, quantity: 25 } } }`
- **WHEN** `applySelectionInput` is called
- **THEN** `selection.addOns.extraStorage` equals `{ selected: false, quantity: 25 }`

#### Scenario: No maximum on the Slack fixture

- **GIVEN** the Slack fixture and `input`
  `{ planId: 'PRO', addOns: { premiumWorkflowOverageCost: { selected: true, quantity: 1000 } } }`
- **WHEN** `applySelectionInput` is called
- **THEN** `selection.addOns.premiumWorkflowOverageCost` equals `{ selected: true, quantity: 1000 }`

### Requirement: Merge over the schema defaults

`req~apply-input-merge-defaults~1`
The `applySelectionInput` function SHALL merge the validated input, without its fields whose value is `undefined`, over `createDefaultSelection(pricing)` as `mergeSelection` does.
Needs: impl, utest

#### Scenario: Omitted fields take the defaults, not the current selection

- **GIVEN** the acme fixture, `current` with plan `growth`, billing `yearly` and `extraStorage`
  selected, and `input` `{}`
- **WHEN** `applySelectionInput` is called
- **THEN** `selection` deeply equals the acme schema defaults (plan `starter`, billing `monthly`,
  `addOns: {}`)

#### Scenario: Explicit undefined fields are dropped

- **GIVEN** the acme fixture, `current` with plan `growth`, and `input`
  `{ planId: undefined, billingPeriod: 'yearly' }`
- **WHEN** `applySelectionInput` is called
- **THEN** `selection.planId` is `'starter'`, `selection.billingPeriod` is `'yearly'` and
  `diagnostics` equals `[]`

#### Scenario: Variables are merged, not validated

- **GIVEN** the acme fixture and `input` `{ planId: 'starter', variables: { seats: 12, region: 'mars' } }`
- **WHEN** `applySelectionInput` is called
- **THEN** `selection.variables` deeply equals
  `{ seats: 12, prioritySupport: false, region: 'mars', priceByRegion: { 'eu-price': 8, 'us-price': 10 } }`
- **AND** `diagnostics` equals `[]` and `resolvePricing(acme, selection).subtotal` is 48

#### Scenario: Add-ons replace the current add-ons

- **GIVEN** the acme fixture, `current` with plan `growth` and `extraStorage` selected, and `input`
  `{ planId: 'growth' }`
- **WHEN** `applySelectionInput` is called
- **THEN** `selection.addOns` deeply equals `{}`

### Requirement: Merged selection is reconciled

`req~apply-input-reconcile~1`
The `applySelectionInput` function SHALL return as `selection` and `removedAddOnIds` the result of `reconcileSelection(pricing, merged)`, where `merged` is the selection of step 5.
Needs: impl, utest

#### Scenario: Starter with extraStorage

- **GIVEN** the acme fixture and `input`
  `{ planId: 'starter', addOns: { extraStorage: { selected: true, quantity: 2 } } }`
- **WHEN** `applySelectionInput` is called
- **THEN** `selection.addOns.extraStorage` equals `{ selected: false, quantity: 2 }` and
  `removedAddOnIds` equals `['extraStorage']`
- **AND** `resolvePricing(acme, selection).subtotal` is 20

#### Scenario: Slack PRO with an add-on only for Business+

- **GIVEN** the Slack fixture and `input`
  `{ planId: 'PRO', addOns: { premiumWorkflowOverageCost: { selected: true, quantity: 1000 }, slackAtlas: { selected: true, quantity: 1 } } }`
- **WHEN** `applySelectionInput` is called
- **THEN** `removedAddOnIds` equals `['slackAtlas']`, `selection.addOns.slackAtlas` equals
  `{ selected: false, quantity: 1 }` and `selection.addOns.premiumWorkflowOverageCost` equals
  `{ selected: true, quantity: 1000 }`
- **AND** `resolvePricing(slack, selection)` has `subtotal` 58.75 (8.75 + 1000 x 0.05) and
  `requiresQuote` `false`

#### Scenario: Slack FREE drops the overage add-on

- **GIVEN** the Slack fixture and `input`
  `{ planId: 'FREE', addOns: { premiumWorkflowOverageCost: { selected: true, quantity: 1000 } } }`
- **WHEN** `applySelectionInput` is called
- **THEN** `removedAddOnIds` equals `['premiumWorkflowOverageCost']`
- **AND** `resolvePricing(slack, selection).subtotal` is 0

### Requirement: Removed add-ons are reported

`req~apply-input-removed-diagnostics~1`
For each id in `removedAddOnIds`, in that order, `applySelectionInput` SHALL add one `info` diagnostic with code `PR_SELECTION_ADDON_REMOVED`, path `selection.addOns.<id>` and `details.addOnId` equal to the id.
Needs: impl, utest

#### Scenario: Starter with extraStorage and prioritySuccess

- **GIVEN** the acme fixture and `input`
  `{ planId: 'starter', addOns: { prioritySuccess: { selected: true, quantity: 1 }, extraStorage: { selected: true, quantity: 2 } } }`
- **WHEN** `applySelectionInput` is called
- **THEN** `removedAddOnIds` equals `['extraStorage', 'prioritySuccess']`
- **AND** `diagnostics` has two `info` entries with code `PR_SELECTION_ADDON_REMOVED`: first path
  `selection.addOns.extraStorage` with `details.addOnId` `'extraStorage'`, then path
  `selection.addOns.prioritySuccess` with `details.addOnId` `'prioritySuccess'`

### Requirement: Diagnostics order

`req~apply-input-diagnostic-order~1`
The `applySelectionInput` function SHALL return the warnings in step order (plan, billing period, add-ons) followed by the `PR_SELECTION_ADDON_REMOVED` diagnostics.
Needs: impl, utest

#### Scenario: Every step reports

- **GIVEN** the acme fixture, `current` equal to the schema defaults and `input`
  `{ planId: 'legacy', billingPeriod: 'weekly', addOns: { ghost: { selected: true, quantity: 1 }, extraStorage: { selected: true, quantity: 2 } } }`
- **WHEN** `applySelectionInput` is called
- **THEN** the diagnostic codes are, in order, `PR_SELECTION_UNKNOWN_PLAN`,
  `PR_SELECTION_UNKNOWN_BILLING_PERIOD`, `PR_SELECTION_UNKNOWN_ADDON`, `PR_SELECTION_ADDON_REMOVED`
- **AND** `selection.planId` is `'starter'`, `selection.billingPeriod` is `'monthly'` and
  `resolvePricing(acme, selection).subtotal` is 20

### Requirement: Validation function does not mutate its arguments

`req~apply-input-no-mutation~1`
The `applySelectionInput` function SHALL NOT mutate its `pricing`, `current` or `input` arguments.
Needs: impl, utest

#### Scenario: Deep copies compare equal after the call

- **GIVEN** deep copies of the acme fixture, of `current` with plan `growth` and of the input of the
  scenario "Every step reports"
- **WHEN** `applySelectionInput` is called with the originals
- **THEN** the three originals still deeply equal their copies

## Requirements: applySelection (element)

### Requirement: Applied selection replaces the internal selection

`req~apply-selection-replaces~1`
WHILE the element is ready and uncontrolled, WHEN the host calls `applySelection(input)`, the element SHALL replace its internal selection, before the call returns, with the `selection` of `applySelectionInput(pricing, selection in effect, input)` and request a re-render.
Needs: impl, utest

#### Scenario: Delivera contract

- **GIVEN** the demo page, ready on Starter
- **WHEN** the host calls `applySelection(C)` and the next update completes
- **THEN** the Growth radio is checked, the `extraStorage` and `prioritySuccess` add-ons are
  selected and `.pr-summary` contains `€80`

#### Scenario: Replace, not merge

- **GIVEN** the demo page where the user selected Growth and `extraStorage`
- **WHEN** the host calls `applySelection({ planId: 'enterprise' })`
- **THEN** the Enterprise radio is checked, `extraStorage` is not selected and `.pr-summary`
  contains `€40`

### Requirement: Applied result

`req~apply-selection-result~1`
WHEN an `applySelection` call is applied, the element SHALL return `{ applied: true, selection, resolved, removedAddOnIds, diagnostics }` with `selection` and `resolved` deeply equal to `resolvedState` read right after the call.
Needs: impl, utest

#### Scenario: Delivera contract

- **GIVEN** the demo page, ready on Starter
- **WHEN** the host calls `applySelection(C)`
- **THEN** the result has `applied: true`, `resolved.subtotal` 80, `removedAddOnIds` `[]` and
  `diagnostics` `[]`
- **AND** `result.selection` and `result.resolved` deeply equal `resolvedState.selection` and
  `resolvedState.resolved`

#### Scenario: Starter with extraStorage

- **GIVEN** the demo page, ready on Starter
- **WHEN** the host calls
  `applySelection({ planId: 'starter', addOns: { extraStorage: { selected: true, quantity: 2 } } })`
- **THEN** the result has `applied: true`, `removedAddOnIds` `['extraStorage']`,
  `resolved.subtotal` 20 and one `info` diagnostic `PR_SELECTION_ADDON_REMOVED` with path
  `selection.addOns.extraStorage`

### Requirement: Validation starts from the selection in effect

`req~apply-selection-uses-selection-in-effect~1`
WHEN the host calls `applySelection`, the element SHALL pass the selection in effect as `current` to `applySelectionInput`.
Needs: impl, utest

#### Scenario: Legacy plan and quarterly billing

- **GIVEN** the demo page where the user picked Growth and the yearly billing period
- **WHEN** the host calls `applySelection({ planId: 'legacy', billingPeriod: 'quarterly' })`
- **THEN** `result.selection.planId` is `'growth'` and `result.selection.billingPeriod` is
  `'yearly'`
- **AND** `result.diagnostics` has the codes `PR_SELECTION_UNKNOWN_PLAN` and
  `PR_SELECTION_UNKNOWN_BILLING_PERIOD`, in that order

### Requirement: No selection change event

`req~apply-selection-silent~1`
The element SHALL NOT emit `pricing-selection-change` for an `applySelection` call.
Needs: impl, utest

#### Scenario: Applied calls

- **GIVEN** the demo page with a `pricing-selection-change` listener that counts events
- **WHEN** the host calls `applySelection(C)`, then
  `applySelection({ planId: 'starter', addOns: { extraStorage: { selected: true, quantity: 2 } } })`,
  and the next update completes
- **THEN** the listener counted 0 events

### Requirement: No confirmation dialog

`req~apply-selection-no-dialog~1`
WHEN an `applySelection` call removes add-ons, the element SHALL apply the result without opening the pending-change dialog.
Needs: impl, utest

#### Scenario: Growth with extraStorage to Starter

- **GIVEN** the demo page where the user selected Growth and `extraStorage`
- **WHEN** the host calls
  `applySelection({ planId: 'starter', addOns: { extraStorage: { selected: true, quantity: 1 } } })`
- **THEN** no `.pr-dialog` is shown, the Starter radio is checked, `extraStorage` is not selected
  and `.pr-summary` contains `€20`

### Requirement: Applied call discards a pending change

`req~apply-selection-discards-pending~1`
WHILE the pending-change dialog is open, WHEN an `applySelection` call is applied, the element SHALL close the dialog without applying the pending change, as Cancel does, and return focus to the element focused before the dialog opened.
Needs: impl, utest

#### Scenario: Pending downgrade replaced by Enterprise

- **GIVEN** the demo page where the user selected Growth and `extraStorage`, then picked Starter,
  so the dialog "Will remove: extraStorage" is open
- **WHEN** the host calls `applySelection({ planId: 'enterprise' })`
- **THEN** no `.pr-dialog` is shown, the Enterprise radio is checked and no
  `pricing-selection-change` is emitted
- **AND** focus is on the element that was focused before the dialog opened

### Requirement: Input is not mutated

`req~apply-selection-input-unmutated~1`
The element SHALL NOT mutate the object passed to `applySelection`.
Needs: impl, utest

#### Scenario: Input with an unknown add-on and a quantity above the maximum

- **GIVEN** the demo page and the input
  `{ planId: 'growth', addOns: { ghost: { selected: true, quantity: 1 }, extraStorage: { selected: true, quantity: 25 } } }`
  and a deep copy of it
- **WHEN** the host calls `applySelection` with the input
- **THEN** the input still deeply equals the copy

### Requirement: Input is detached from the element

`req~apply-selection-input-detached~1`
WHEN an `applySelection` call returns, the element SHALL hold no reference to the input object or to any object inside it.
Needs: impl, utest

#### Scenario: Host changes the input afterwards

- **GIVEN** the demo page and the host called `applySelection(input)` with `input` a copy of `C`
- **WHEN** the host sets `input.planId = 'starter'` and `input.addOns.extraStorage.quantity = 7`
- **THEN** `resolvedState.selection.planId` is `'growth'`,
  `resolvedState.selection.addOns.extraStorage.quantity` is 2 and `resolvedState.resolved.subtotal`
  is 80

### Requirement: Refusal while not ready

`req~apply-selection-not-ready~1`
IF the host calls `applySelection` while the element is not ready, THEN the element SHALL return `{ applied: false, selection: undefined, resolved: undefined, removedAddOnIds: [], diagnostics }` with `diagnostics` holding one `error` diagnostic with code `PR_SELECTION_NOT_READY`.
Needs: impl, utest

#### Scenario: First load in flight

- **GIVEN** a new `<pricing-renderer>` in the demo page with
  `src: 'https://example.com/pricing.yml'` (`src` must be an absolute HTTP or HTTPS URL) and a
  `loadPricing` whose promise has not resolved
- **WHEN** the host calls `applySelection(C)`
- **THEN** the result is `applied: false` with `selection` and `resolved` `undefined`,
  `removedAddOnIds` `[]` and one `error` diagnostic `PR_SELECTION_NOT_READY`
- **AND** once `loadPricing` resolves with the acme YAML, `resolvedState.selection.planId` is
  `'starter'` and `resolvedState.resolved.subtotal` is 20

#### Scenario: Reload in flight with an earlier pricing

- **GIVEN** the element of "First load in flight" after `loadPricing` resolved with the acme YAML,
  then the host set a new `loadPricing` whose promise has not resolved and called `reload()`
- **WHEN** the host calls `applySelection(C)`
- **THEN** the result is `applied: false` with `selection` and `resolved` `undefined` and one
  `error` diagnostic `PR_SELECTION_NOT_READY`
- **AND** once the new `loadPricing` resolves with the acme YAML, `resolvedState.selection.planId`
  is `'starter'` and `resolvedState.resolved.subtotal` is 20 (setting `loadPricing` also schedules
  a reload after the update, so the test resolves the promise of the last `loadPricing` call)

#### Scenario: Failed first load

- **GIVEN** a new `<pricing-renderer>` in the demo page with no source, so its load failed with
  `PR_SOURCE_MISSING`
- **WHEN** the host calls `applySelection(C)`
- **THEN** the result is `applied: false` with one `error` diagnostic `PR_SELECTION_NOT_READY`

#### Scenario: Failed reload that keeps the earlier pricing

- **GIVEN** the demo page, ready, where the host also set `pricing`, so the reload failed with
  `PR_SOURCE_CONFLICT` and the acme pricing is kept
- **WHEN** the host calls `applySelection(C)`
- **THEN** the result has `applied: true` and `resolved.subtotal` 80

### Requirement: Refusal in controlled mode

`req~apply-selection-controlled~1`
WHILE the element is ready and controlled, WHEN the host calls `applySelection`, the element SHALL return `{ applied: false, selection, resolved, removedAddOnIds: [], diagnostics }` with `selection` and `resolved` deeply equal to `resolvedState` and `diagnostics` holding one `error` diagnostic with code `PR_SELECTION_CONTROLLED`.
Needs: impl, utest

#### Scenario: Controlled Growth with extraStorage

- **GIVEN** the demo page with `selection`
  `{ planId: 'growth', billingPeriod: 'monthly', variables, addOns: { extraStorage: { selected: true, quantity: 1 } } }`
  and the default `variables`
- **WHEN** the host calls `applySelection(C)`
- **THEN** the result is `applied: false`, `selection.planId` `'growth'`, `resolved.subtotal` 50,
  `removedAddOnIds` `[]` and one `error` diagnostic `PR_SELECTION_CONTROLLED`
- **AND** `result.selection` and `result.resolved` deeply equal `resolvedState.selection` and
  `resolvedState.resolved`

### Requirement: Refusals store nothing

`req~apply-selection-refusal-keeps-state~1`
IF an `applySelection` call is refused, THEN the element SHALL NOT change its internal selection or its `selection` property.
Needs: impl, utest

#### Scenario: Controlled refusal

- **GIVEN** the controlled demo page of the scenario "Controlled Growth with extraStorage"
- **WHEN** the host calls `applySelection(C)`, then sets `selection` to `undefined`
- **THEN** before the reset, `element.selection` is the object the host set and deeply equals its
  value before the call
- **AND** after the reset, `resolvedState.selection.planId` is `'starter'`,
  `resolvedState.selection.addOns` equals `{}` and `resolvedState.resolved.subtotal` is 20

#### Scenario: Not-ready refusal

- **GIVEN** the scenario "First load in flight"
- **WHEN** `loadPricing` resolves with the acme YAML
- **THEN** the selection is the default one (plan `starter`, `addOns: {}`), not `C`

### Requirement: Diagnostics are dispatched once

`req~apply-selection-diagnostic-event~1`
WHEN an `applySelection` call returns a non-empty `diagnostics` list, the element SHALL dispatch exactly one `pricing-diagnostic` event before the call returns, with `detail.diagnostics` deeply equal to `result.diagnostics`.
Needs: impl, utest

#### Scenario: Unknown plan

- **GIVEN** the demo page with a `pricing-diagnostic` listener that records events
- **WHEN** the host calls `applySelection({ planId: 'legacy' })`
- **THEN** right after the call the listener has recorded one event, whose `detail.diagnostics`
  deeply equals `result.diagnostics` (one `PR_SELECTION_UNKNOWN_PLAN` warning)

#### Scenario: Refusals

- **GIVEN** a `pricing-diagnostic` listener on the element of "Controlled Growth with
  extraStorage", and one on the element of "First load in flight"
- **WHEN** the host calls `applySelection(C)` on each
- **THEN** each listener has recorded one event, with `PR_SELECTION_CONTROLLED` and
  `PR_SELECTION_NOT_READY` respectively, deeply equal to the returned diagnostics

### Requirement: No event for an empty list

`req~apply-selection-no-empty-diagnostic~1`
IF an `applySelection` call returns an empty `diagnostics` list, THEN the element SHALL NOT dispatch `pricing-diagnostic` for it.
Needs: impl, utest

#### Scenario: Delivera contract

- **GIVEN** the demo page with a `pricing-diagnostic` listener that counts events
- **WHEN** the host calls `applySelection(C)` and the next update completes
- **THEN** the listener counted 0 events

### Requirement: Diagnostics are not rendered

`req~apply-selection-diagnostics-not-rendered~1`
The element SHALL NOT add the diagnostics of an `applySelection` call to the diagnostics list it renders.
Needs: impl, utest

#### Scenario: Unknown plan and add-on

- **GIVEN** the demo page and the number N of `[data-pr-part="diagnostics"] li` items (0 when the
  list is absent)
- **WHEN** the host calls
  `applySelection({ planId: 'legacy', addOns: { ghost: { selected: true, quantity: 1 } } })` and the
  next update completes
- **THEN** the number of `[data-pr-part="diagnostics"] li` items is still N and none contains
  `PR_SELECTION_`

### Requirement: A later load restarts from the default selection

`req~apply-selection-reload-restarts~1`
WHEN a load that starts after an applied `applySelection` call succeeds, the element SHALL set its internal selection to the reconciled merge of `defaultSelection` over the schema defaults, without the applied selection.
Needs: impl, utest

#### Scenario: Reload without defaultSelection

- **GIVEN** the demo page where the host called `applySelection(C)`
- **WHEN** the host calls `reload()` and `pricing-ready` fires
- **THEN** `resolvedState.selection.planId` is `'starter'`, `resolvedState.selection.addOns` equals
  `{}`, `resolvedState.resolved.subtotal` is 20 and `.pr-summary` contains `€20`

#### Scenario: Reload with defaultSelection

- **GIVEN** the demo page where the host set `defaultSelection` to `{ planId: 'growth' }` and then
  called `applySelection(C)`
- **WHEN** the host calls `reload()` and `pricing-ready` fires
- **THEN** `resolvedState.selection.planId` is `'growth'`, `resolvedState.selection.addOns` equals
  `{}` and `resolvedState.resolved.subtotal` is 45

### Requirement: Call from a pricing-ready listener

`req~apply-selection-in-ready-listener~1`
WHEN the host calls `applySelection` from a `pricing-ready` listener, the element SHALL keep the applied selection for that load.
Needs: impl, utest

#### Scenario: Delivera flow

- **GIVEN** the demo page with a one-time `pricing-ready` listener that calls `applySelection(C)`
  and a `pricing-selection-change` listener that counts events
- **WHEN** the host calls `reload()` and the update after `pricing-ready` completes
- **THEN** the listener's call returned `applied: true`, the Growth radio is checked,
  `.pr-summary` contains `€80` and `resolvedState.resolved.subtotal` is 80
- **AND** the `pricing-selection-change` listener counted 0 events

## Requirements: resolvedState (element)

### Requirement: No state before ready

`req~resolved-state-not-ready~1`
WHILE the element is not ready, the `resolvedState` getter SHALL return `undefined`.
Needs: impl, utest

#### Scenario: Loads in flight and failed first load

- **GIVEN** the elements of the scenarios "First load in flight", "Reload in flight with an
  earlier pricing" and "Failed first load"
- **WHEN** the host reads `resolvedState` on each
- **THEN** the three reads return `undefined`

### Requirement: Snapshot of the selection in effect

`req~resolved-state-snapshot~1`
WHILE the element is ready, the `resolvedState` getter SHALL return `{ selection, resolved }` with `selection` equal to the selection in effect and `resolved` equal to the resolved pricing of that selection with the subtotal the element renders.
Needs: impl, utest

#### Scenario: Initial state

- **GIVEN** the demo page, ready
- **WHEN** the host reads `resolvedState`
- **THEN** `selection` deeply equals the acme schema defaults and `resolved.subtotal` is 20, as
  `.pr-summary` shows `€20`

#### Scenario: After user changes

- **GIVEN** the demo page where the user selected Growth and `extraStorage`
- **WHEN** the host reads `resolvedState`
- **THEN** `selection.planId` is `'growth'`, `selection.addOns.extraStorage` equals
  `{ selected: true, quantity: 1 }` and `resolved.subtotal` is 50, as `.pr-summary` shows `€50`

#### Scenario: Variables disabled

- **GIVEN** the demo page where the host called
  `applySelection({ planId: 'starter', variables: { seats: 12 } })` (subtotal 48)
- **WHEN** the host sets `variablesEnabled` to `false` and reads `resolvedState`
- **THEN** `selection.variables.seats` is 5 and `resolved.subtotal` is 20

### Requirement: Snapshot is detached

`req~resolved-state-detached~1`
The `resolvedState` getter SHALL return on each read new objects that share no reference with the element state or with earlier reads.
Needs: impl, utest

#### Scenario: Two reads and a mutation

- **GIVEN** the demo page, ready on Starter, and two reads `a` and `b` of `resolvedState`
- **WHEN** the host compares them and sets `a.selection.planId = 'enterprise'` and
  `a.resolved.subtotal = 0`
- **THEN** `a !== b`, `a.selection !== b.selection`, `a.selection.addOns !== b.selection.addOns`
  and `a.resolved !== b.resolved`
- **AND** a third read has `selection.planId` `'starter'` and `resolved.subtotal` 20, and
  `.pr-summary` still contains `€20`

### Requirement: Snapshot in controlled mode

`req~resolved-state-controlled~1`
WHILE the element is ready and controlled, the `resolvedState` getter SHALL return the reconciled controlled selection and its resolved pricing.
Needs: impl, utest

#### Scenario: Controlled Starter with extraStorage

- **GIVEN** the demo page with `selection`
  `{ planId: 'starter', billingPeriod: 'monthly', variables, addOns: { extraStorage: { selected: true, quantity: 2 } } }`
  and the default `variables`
- **WHEN** the host reads `resolvedState`
- **THEN** `selection.addOns.extraStorage` equals `{ selected: false, quantity: 2 }` and
  `resolved.subtotal` is 20
- **AND** `element.selection.addOns.extraStorage` still equals `{ selected: true, quantity: 2 }`

### Requirement: Snapshot is read-only

`req~resolved-state-read-only~1`
The element class SHALL define `resolvedState` as an accessor with a getter and without a setter.
Needs: impl, utest

#### Scenario: Property descriptor

- **GIVEN** the `PricingRendererElement` class in the demo page
- **WHEN** the test reads the descriptor of `resolvedState` on its prototype
- **THEN** `get` is a function and `set` is `undefined`

## Requirements: events and types

### Requirement: pricing-ready carries the selection

`req~ready-detail-selection~1`
WHEN the element dispatches `pricing-ready`, it SHALL set `detail.selection` and `detail.resolved` deeply equal to `resolvedState` read in the listener before any `applySelection` call.
Needs: impl, utest

#### Scenario: Default load

- **GIVEN** the demo page with a `pricing-ready` listener that records `detail` and `resolvedState`
- **WHEN** the host calls `reload()`
- **THEN** `detail.selection` and `detail.resolved` deeply equal the recorded
  `resolvedState.selection` and `resolvedState.resolved`
- **AND** `detail.selection.planId` is `'starter'` and `detail.resolved.subtotal` is 20

#### Scenario: Reconciled default selection

- **GIVEN** the same listener and `defaultSelection`
  `{ planId: 'starter', addOns: { extraStorage: { selected: true, quantity: 2 } } }`
- **WHEN** the host calls `reload()`
- **THEN** `detail.selection.addOns.extraStorage` equals `{ selected: false, quantity: 2 }` and
  `detail.resolved.subtotal` is 20

### Requirement: pricing-ready detail fields are required

`req~ready-detail-required-fields~1`
The type `PricingReadyDetail` exported from `src/element/index.ts` SHALL declare `selection: PricingSelection` and `resolved: ResolvedPricing` as required properties.
Needs: impl, utest

#### Scenario: Hand-built detail without the new fields

- **GIVEN** a snippet that assigns `{ pricing, diagnostics }` to a `PricingReadyDetail`, and one
  that also sets `selection` and `resolved`
- **WHEN** a unit test type-checks both snippets with the TypeScript compiler API
- **THEN** the first reports a missing-property error for `selection` and `resolved` and the
  second reports no error

### Requirement: Result type

`req~apply-selection-result-type~1`
The element entry point `src/element/index.ts` SHALL export the type `ApplySelectionResult`, a union discriminated by `applied`: `{ applied: true; selection: PricingSelection; resolved: ResolvedPricing; removedAddOnIds: string[]; diagnostics: PricingDiagnostic[] }` or `{ applied: false; selection: PricingSelection | undefined; resolved: ResolvedPricing | undefined; removedAddOnIds: []; diagnostics: PricingDiagnostic[] }`.
Needs: impl, utest

#### Scenario: Narrowing on applied

- **GIVEN** a snippet with a value of type `ApplySelectionResult` imported from
  `src/element/index.ts` that, after `if (result.applied)`, assigns `result.selection` to a
  `PricingSelection` and `result.resolved` to a `ResolvedPricing`, and in the `else` branch
  assigns `result.removedAddOnIds` to a `[]`
- **AND** a second snippet that assigns `result.selection` to a `PricingSelection` without
  narrowing
- **WHEN** a unit test type-checks both snippets with the TypeScript compiler API
- **THEN** the first reports no error and the second reports an error

### Requirement: React re-export of the result type

`req~react-reexports-result-type~1`
The React entry point `src/react/index.ts` SHALL re-export the type `ApplySelectionResult` of `src/element/index.ts`.
Needs: impl, utest

#### Scenario: Same type from both entry points

- **GIVEN** a snippet that imports `ApplySelectionResult` from `src/react/index.ts` and from
  `src/element/index.ts` and assigns a value of each type to a variable of the other
- **WHEN** a unit test type-checks the snippet with the TypeScript compiler API
- **THEN** it reports no error

### Requirement: React ref exposes the load API

`req~react-ref-load-api~1`
The `PricingRendererElement` class exported by `src/react/index.ts` SHALL provide the `applySelection` method and the `resolvedState` getter.
Needs: impl, utest

#### Scenario: Element class from the React entry point

- **GIVEN** `PricingRendererElement` imported from `src/react/index.ts` in node
- **WHEN** the test reads its prototype
- **THEN** `applySelection` is a function and the descriptor of `resolvedState` has a `get`
  function

### Requirement: Custom elements manifest lists the load API

`req~custom-elements-lists-load-api~1`
The published `custom-elements.json` SHALL describe, in the `PricingRendererElement` declaration, the `applySelection` method, the `resolvedState` getter and the `pricing-ready` and `pricing-diagnostic` events with their new behaviour.
Needs: impl, utest

#### Scenario: Manifest entries

- **GIVEN** `custom-elements.json` parsed as JSON
- **WHEN** the test reads the members and events of the `PricingRendererElement` declaration
- **THEN** a member has `kind: 'method'`, `name: 'applySelection'`, one parameter named
  `selection` with type text `Partial<PricingSelection>` and return type text
  `ApplySelectionResult`
- **AND** a member has `kind: 'field'`, `name: 'resolvedState'`, type text
  `PricingSelectionChangeDetail | undefined` and `readonly: true`
- **AND** the `pricing-ready` event has a `description` that contains `selection` and `resolved`,
  and the `pricing-diagnostic` event has a `description` that contains `applySelection`

## Requirements: SPACE contract example

The example `examples/space-contract/map-contract.ts` exports
`selectionFromContract(contract, serviceKey): Partial<PricingSelection>`. Its input type is
structural: `{ subscriptionPlans?: Record<string, string>; subscriptionAddOns?: Record<string, Record<string, number>> }`,
keyed by service, with plan names and add-on quantities. SPACE contracts carry no billing period.

### Requirement: Plan from the contract

`req~space-map-plan~1`
WHEN `contract.subscriptionPlans` has an entry for `serviceKey`, `selectionFromContract` SHALL set `planId` to that entry's plan name.
Needs: impl, utest

#### Scenario: Acme plan

- **GIVEN** the contract `{ subscriptionPlans: { acme: 'growth' } }`
- **WHEN** `selectionFromContract(contract, 'acme')` is called
- **THEN** the result deeply equals `{ planId: 'growth' }`

### Requirement: Add-ons from the contract

`req~space-map-addons~1`
WHEN `contract.subscriptionAddOns[serviceKey]` has an entry with a finite quantity greater than 0, `selectionFromContract` SHALL set `addOns[name]` to `{ selected: true, quantity }`.
Needs: impl, utest

#### Scenario: Delivera contract

- **GIVEN** the contract
  `{ subscriptionPlans: { acme: 'growth' }, subscriptionAddOns: { acme: { extraStorage: 2, prioritySuccess: 1 } } }`
- **WHEN** `selectionFromContract(contract, 'acme')` is called
- **THEN** the result deeply equals `C`
- **AND** `resolvePricing(acme, applySelectionInput(acme, defaults, result).selection).subtotal` is
  80

### Requirement: Only the given service

`req~space-map-service-only~1`
The `selectionFromContract` function SHALL ignore the entries of services other than `serviceKey`.
Needs: impl, utest

#### Scenario: Two services

- **GIVEN** the contract
  `{ subscriptionPlans: { acme: 'growth', mail: 'pro' }, subscriptionAddOns: { acme: { extraStorage: 2 }, mail: { archive: 1 } } }`
- **WHEN** `selectionFromContract(contract, 'acme')` is called
- **THEN** the result deeply equals
  `{ planId: 'growth', addOns: { extraStorage: { selected: true, quantity: 2 } } }`

### Requirement: Missing service

`req~space-map-missing-service~1`
IF neither `contract.subscriptionPlans` nor `contract.subscriptionAddOns` has an entry for `serviceKey`, THEN `selectionFromContract` SHALL return `{}`.
Needs: impl, utest

#### Scenario: Empty contract and other service

- **GIVEN** the contracts `{}` and
  `{ subscriptionPlans: { mail: 'pro' }, subscriptionAddOns: { mail: { archive: 1 } } }`
- **WHEN** `selectionFromContract(contract, 'acme')` is called with each
- **THEN** both results deeply equal `{}`

### Requirement: Invalid quantities are omitted

`req~space-map-invalid-quantity~1`
IF an add-on quantity of the service is not a finite number greater than 0, THEN `selectionFromContract` SHALL leave that add-on out of the result.
Needs: impl, utest

#### Scenario: Zero, negative and non-finite quantities

- **GIVEN** the contract
  `{ subscriptionPlans: { acme: 'growth' }, subscriptionAddOns: { acme: { extraStorage: 0, prioritySuccess: Number.NaN, compliance: Number.POSITIVE_INFINITY, backup: -1 } } }`
- **WHEN** `selectionFromContract(contract, 'acme')` is called
- **THEN** the result deeply equals `{ planId: 'growth' }`

### Requirement: Add-ons-only contract

`req~space-map-addons-only~1`
WHEN `contract.subscriptionAddOns` has an entry for `serviceKey` and `contract.subscriptionPlans` has none, `selectionFromContract` SHALL return the mapped add-ons without a `planId` key.
Needs: impl, utest

#### Scenario: Add-ons without a plan

- **GIVEN** the contract `{ subscriptionAddOns: { acme: { extraStorage: 3 } } }`
- **WHEN** `selectionFromContract(contract, 'acme')` is called
- **THEN** the result deeply equals `{ addOns: { extraStorage: { selected: true, quantity: 3 } } }`
  and has no own `planId` key

### Requirement: Result keys

`req~space-map-result-keys~1`
The `selectionFromContract` function SHALL return an object whose only possible keys are `planId`, present when a plan is mapped, and `addOns`, present when at least one add-on is mapped.
Needs: impl, utest

#### Scenario: No billing period, no variables

- **GIVEN** the contracts of the scenarios "Delivera contract" (of `req~space-map-addons~1`),
  "Zero, negative and non-finite quantities" and "Add-ons without a plan"
- **WHEN** `selectionFromContract(contract, 'acme')` is called with each
- **THEN** the own keys are `['planId', 'addOns']`, `['planId']` and `['addOns']` respectively

### Requirement: Contract is not mutated

`req~space-map-no-mutation~1`
The `selectionFromContract` function SHALL NOT mutate its `contract` argument.
Needs: impl, utest

#### Scenario: Deep copy compares equal

- **GIVEN** a deep copy of the contract of the scenario "Two services"
- **WHEN** `selectionFromContract` is called with the original and the result's `addOns` entries are
  then changed
- **THEN** the original still deeply equals the copy

### Requirement: Mapping stays out of the package

`req~space-map-not-exported~1`
The package entry points `src/core/index.ts`, `src/yaml/index.ts`, `src/element/index.ts` and `src/react/index.ts` SHALL NOT export `selectionFromContract`.
Needs: impl, utest

#### Scenario: Entry point keys

- **GIVEN** the module namespaces of the four entry points, imported in node
- **WHEN** their keys are listed
- **THEN** none contains `selectionFromContract`

## Design notes (non-normative)

- Validation order inside `applySelectionInput`: (1) plan, (2) billing period, (3) unknown add-on
  ids, (4) quantities of selected known add-ons with `normalizeAddOnQuantity`, (5) drop
  `undefined` fields and merge over `createDefaultSelection` with `mergeSelection`, (6)
  `reconcileSelection`, then one `PR_SELECTION_ADDON_REMOVED` per removed id. `normalizeAddOnQuantity`
  returns 1 for an add-on without `subscriptionConstraints`, so a selected `prioritySuccess` or
  `slackAtlas` always gets quantity 1. Step 4 is silent: clamping diagnostics are out of scope.
- An unknown plan or billing period falls back to the selection in effect, while an omitted one
  falls back to the schema default. This is the approved behaviour: a typo keeps what the user sees,
  an omission means "use the default". If the selection in effect itself has an unknown plan (an
  unvalidated `defaultSelection`), that plan id is kept.
- Add-on warnings follow the key order of `input.addOns` (`Object.keys`), so integer-like ids come
  first, as in any JavaScript object.
- The internal function is not exported from `src/core/index.ts` to keep the core API unchanged;
  unit tests import `src/core/apply-selection.ts` directly. It is pure: no element state, no
  events, no clock.
- Element flow of `applySelection(input)`: if not ready, return the not-ready refusal; if
  controlled, return the controlled refusal with a `resolvedState` snapshot; else deep-copy the
  input (`cloneValue`), call `applySelectionInput(pricing, selection in effect, copy)`, store the
  result as `_internalSelection`, clear `_pendingAddOnChange` and restore `_previousFocus` as
  `_cancelAddOnChange` does, request an update, build the result from a `resolvedState` snapshot,
  then dispatch `pricing-diagnostic` when the list is not empty, and return the result. Taking the
  snapshot before the dispatch keeps the result consistent with its own diagnostics even if a
  listener calls `applySelection` again or sets `selection`; dispatching after the state is stored
  lets a listener read the new `resolvedState`. Building the returned `selection` and `resolved`
  from the same snapshot as the getter keeps them detached from the element too.
- A refused call leaves an open pending-change dialog as it is; only an applied call discards it.
- `resolvedState` builds the view model with `createPricingViewModel` for the selection in effect
  and passes it through `_stabilizeResolvedPrices`, as `render` and `_setSelection` do, then
  deep-copies `{ selection, resolved }`. `_stabilizeResolvedPrices` writes the last valid prices
  into `_lastValidPlanPrices` and `_lastValidAddOnPrices`; the getter records the values the next
  render would record, so the output does not change. The getter resolves the pricing on each read:
  read it on events, not in a render loop.
- `pricing-ready`: `_applyLoadResult` already sets `_internalSelection` and `_status = 'ready'`
  before dispatching and assigns neither afterwards; the detail adds `selection` and `resolved`
  from a `resolvedState` snapshot taken just before the dispatch. Keep that order so a listener's
  `applySelection` call stays in effect for the load.
- `ApplySelectionResult` lives in `src/element/events.ts` next to the other detail types, is
  exported from `src/element/index.ts` and re-exported from `src/react/index.ts`. The React wrapper
  needs no code: its ref is the element.
- SPACE example: `examples/space-contract/map-contract.ts` imports only the `PricingSelection` type.
  Quantities that are 0, negative or not finite are omitted, because a SPACE contract with such a
  quantity has no usable add-on; positive non-integer quantities are passed through and normalized
  by step 4. Plan and add-on names are passed as they are: a name that is not a pricing id yields
  the warnings of `applySelectionInput`, which the guide shows.
- Type-level requirements (`req~ready-detail-required-fields~1`,
  `req~apply-selection-result-type~1`, `req~react-reexports-result-type~1`): `vitest run` does not
  type-check (`expectTypeOf` is a no-op at run time) and `pnpm typecheck` (`tsc -b`) builds the
  `src` projects only. So these unit tests run the TypeScript compiler API (`typescript` is a
  devDependency) on small snippets: `ts.createProgram` with the strict options of
  `tsconfig.base.json` and a compiler host that serves the snippet and reads `src/**` from disk,
  then assert on `ts.getPreEmitDiagnostics`. No change to `vitest.config.ts`, `package.json` or CI
  is needed.
- Numbers: Slack PRO 8.75 + 1000 x 0.05 = 58.75 and acme 45 + 2 x 5 + 25 = 80 are exact in binary
  floating point for these operands (`0.05 * 1 * 1000 === 50`); tests may use `toBe`.

## Acceptance checklist

Unit tests (vitest, `tests/unit`, node environment, no DOM; fixtures parsed from YAML):

- [ ] `[utest->req~apply-input-result~1]` unit
- [ ] `[utest->req~apply-input-internal~1]` unit
- [ ] `[utest->req~apply-input-unknown-plan~1]` unit
- [ ] `[utest->req~apply-input-unknown-billing~1]` unit, acme and Slack
- [ ] `[utest->req~apply-input-unknown-addons~1]` unit
- [ ] `[utest->req~apply-input-warnings~1]` unit
- [ ] `[utest->req~apply-input-quantities~1]` unit, acme and Slack
- [ ] `[utest->req~apply-input-merge-defaults~1]` unit
- [ ] `[utest->req~apply-input-reconcile~1]` unit, acme (20) and Slack (58.75, 0)
- [ ] `[utest->req~apply-input-removed-diagnostics~1]` unit
- [ ] `[utest->req~apply-input-diagnostic-order~1]` unit
- [ ] `[utest->req~apply-input-no-mutation~1]` unit
- [ ] `[utest->req~ready-detail-required-fields~1]` unit, TypeScript compiler API
- [ ] `[utest->req~apply-selection-result-type~1]` unit, TypeScript compiler API
- [ ] `[utest->req~react-reexports-result-type~1]` unit, TypeScript compiler API
- [ ] `[utest->req~react-ref-load-api~1]` unit
- [ ] `[utest->req~custom-elements-lists-load-api~1]` unit
- [ ] `[utest->req~space-map-plan~1]` unit, `tests/unit/space-contract.test.ts`
- [ ] `[utest->req~space-map-addons~1]` unit, `tests/unit/space-contract.test.ts`
- [ ] `[utest->req~space-map-service-only~1]` unit, `tests/unit/space-contract.test.ts`
- [ ] `[utest->req~space-map-missing-service~1]` unit, `tests/unit/space-contract.test.ts`
- [ ] `[utest->req~space-map-invalid-quantity~1]` unit, `tests/unit/space-contract.test.ts`
- [ ] `[utest->req~space-map-addons-only~1]` unit, `tests/unit/space-contract.test.ts`
- [ ] `[utest->req~space-map-result-keys~1]` unit, `tests/unit/space-contract.test.ts`
- [ ] `[utest->req~space-map-no-mutation~1]` unit, `tests/unit/space-contract.test.ts`
- [ ] `[utest->req~space-map-not-exported~1]` unit, `tests/unit/space-contract.test.ts`

Playwright tests (`tests/browser/pricing-renderer.spec.ts`, demo page with the acme fixture; vitest
runs without a DOM):

- [ ] `[utest->req~apply-selection-replaces~1]` Playwright
- [ ] `[utest->req~apply-selection-result~1]` Playwright
- [ ] `[utest->req~apply-selection-uses-selection-in-effect~1]` Playwright
- [ ] `[utest->req~apply-selection-silent~1]` Playwright
- [ ] `[utest->req~apply-selection-no-dialog~1]` Playwright
- [ ] `[utest->req~apply-selection-discards-pending~1]` Playwright, includes focus
- [ ] `[utest->req~apply-selection-input-unmutated~1]` Playwright
- [ ] `[utest->req~apply-selection-input-detached~1]` Playwright
- [ ] `[utest->req~apply-selection-not-ready~1]` Playwright, in-flight, failed and kept pricing
- [ ] `[utest->req~apply-selection-controlled~1]` Playwright
- [ ] `[utest->req~apply-selection-refusal-keeps-state~1]` Playwright
- [ ] `[utest->req~apply-selection-diagnostic-event~1]` Playwright, includes both refusals
- [ ] `[utest->req~apply-selection-no-empty-diagnostic~1]` Playwright
- [ ] `[utest->req~apply-selection-diagnostics-not-rendered~1]` Playwright
- [ ] `[utest->req~apply-selection-reload-restarts~1]` Playwright
- [ ] `[utest->req~apply-selection-in-ready-listener~1]` Playwright, the Delivera flow
- [ ] `[utest->req~resolved-state-not-ready~1]` Playwright
- [ ] `[utest->req~resolved-state-snapshot~1]` Playwright
- [ ] `[utest->req~resolved-state-detached~1]` Playwright
- [ ] `[utest->req~resolved-state-controlled~1]` Playwright
- [ ] `[utest->req~resolved-state-read-only~1]` Playwright
- [ ] `[utest->req~ready-detail-selection~1]` Playwright

Documentation and release (reviewed, no trace tag):

- [ ] `docs/api-reference.md`: `applySelection`, `resolvedState`, `ApplySelectionResult`.
- [ ] `docs/api-reference.md`: the six diagnostic codes and the new `pricing-ready` detail.
- [ ] `docs/api-reference.md`: `pricing-diagnostic` also fires after `applySelection` calls.
- [ ] Docs and changeset: hosts that treat any error as a load failure must check the code.
- [ ] `docs/configuration.md`: section "Controlled versus uncontrolled".
- [ ] `docs/preload-current-subscription.md`: the guide, with the SPACE example.
- [ ] `.changeset`: minor changeset for `pricing-renderer`.
- [ ] Visual snapshots unchanged.
