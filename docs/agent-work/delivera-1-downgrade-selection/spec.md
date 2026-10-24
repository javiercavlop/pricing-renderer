# Spec: reconcile add-on selection on plan change

Change `delivera-1-downgrade-selection`, written before the implementation: the requirements below
are the contract for the tests of `pricing-renderer`.

## Definitions

- Available: add-on A is available for plan id P when `A.availableFor` is empty, or P is defined and
  `A.availableFor` includes P (an undefined or unknown P makes a non-empty `availableFor` fail).
- Removal set: the selected add-ons unavailable for `selection.planId`, plus, transitively, every
  selected add-on whose `dependsOn` contains an add-on of the removal set.
- Reconciled selection: the `selection` returned by `reconcileSelection`.
- The element: `<pricing-renderer>` (`src/element/pricing-renderer-element.ts`). Controlled mode: the
  host has set its `selection` property; otherwise the element keeps an internal selection.
- Fixture: `tests/fixtures/acme-pricing.yml` parsed and normalized, default variables (5 seats,
  region eu), monthly billing. Prices: Starter 20, Growth 45, Enterprise 40, extraStorage 5 per
  pack, prioritySuccess 25, compliance "Contact sales" (a label).

## Requirements: core

### Requirement: Reconcile function and result

`req~reconcile-selection-result~1`
The core module SHALL export `reconcileSelection(pricing, selection)` returning
`{ selection, removedAddOnIds }`, with each removed id once, in the order of `pricing.addOns`.
Needs: impl, utest

#### Scenario: Growth with extraStorage and prioritySuccess moves to Starter

- **GIVEN** the fixture, plan `starter`, `prioritySuccess` and `extraStorage` selected
- **WHEN** `reconcileSelection` is imported from `src/core/index.ts` and called
- **THEN** `removedAddOnIds` equals `['extraStorage', 'prioritySuccess']`

### Requirement: Deselect add-ons unavailable for the plan

`req~reconcile-unavailable-addons~1`
WHEN a selected add-on is unavailable for `selection.planId`, `reconcileSelection` SHALL return its
entry as `{ selected: false, quantity }` with the input quantity.
Needs: impl, utest

#### Scenario: Growth with extraStorage moves to Starter

- **GIVEN** the fixture, plan `starter`, `extraStorage: { selected: true, quantity: 3 }`
- **WHEN** `reconcileSelection` is called
- **THEN** `addOns.extraStorage` equals `{ selected: false, quantity: 3 }`
- **AND** `removedAddOnIds` equals `['extraStorage']`

#### Scenario: Enterprise with compliance moves to Growth

- **GIVEN** the fixture, plan `growth`, `compliance` selected
- **WHEN** `reconcileSelection` is called
- **THEN** `removedAddOnIds` equals `['compliance']`

#### Scenario: Unknown plan id

- **GIVEN** the fixture, plan `legacy`, `extraStorage` selected
- **WHEN** `reconcileSelection` is called
- **THEN** `removedAddOnIds` equals `['extraStorage']`

### Requirement: Deselect dependents of removed add-ons

`req~reconcile-dependents~1`
WHEN a selected add-on depends, directly or transitively, on an add-on of the removal set,
`reconcileSelection` SHALL return its entry as `{ selected: false, quantity }` with the input
quantity.
Needs: impl, utest

#### Scenario: Unrestricted dependent of an unavailable add-on

- **GIVEN** the fixture plus add-on `backupPlus` (empty `availableFor`,
  `dependsOn: ['extraStorage']`), plan `starter`, `extraStorage` and `backupPlus` selected
- **WHEN** `reconcileSelection` is called
- **THEN** `removedAddOnIds` equals `['extraStorage', 'backupPlus']`

### Requirement: Unrestricted add-ons survive plan changes

`req~reconcile-unrestricted-addons~1`
The `reconcileSelection` function SHALL keep selected every add-on with an empty `availableFor`
that does not depend, directly or transitively, on an add-on of the removal set.
Needs: impl, utest

#### Scenario: Empty availableFor on every plan

- **GIVEN** the fixture plus add-on `onboarding` (empty `availableFor`, `dependsOn`, `excludes`),
  selected
- **WHEN** `reconcileSelection` is called with plan `starter`, `growth`, `enterprise`, `legacy`
- **THEN** `onboarding` stays `selected: true` and `removedAddOnIds` is empty each time

### Requirement: Valid selections come back unchanged

`req~reconcile-valid-unchanged~1`
IF the removal set is empty, THEN `reconcileSelection` SHALL return a selection deeply equal to its
input and an empty `removedAddOnIds`.
Needs: impl, utest

#### Scenario: Growth with extraStorage and prioritySuccess

- **GIVEN** the fixture, plan `growth`, `extraStorage` and `prioritySuccess` selected
- **WHEN** `reconcileSelection` is called
- **THEN** the selection deeply equals the input and `removedAddOnIds` equals `[]`

#### Scenario: Idempotence

- **GIVEN** the reconciled selection of plan `starter` with `extraStorage` and `prioritySuccess`
- **WHEN** `reconcileSelection` is called again with it
- **THEN** the result deeply equals its input and `removedAddOnIds` equals `[]`

### Requirement: Inputs are not mutated

`req~reconcile-no-mutation~1`
The `reconcileSelection` function SHALL NOT mutate its `pricing` or `selection` arguments.
Needs: impl, utest

#### Scenario: Deep copies compare equal after the call

- **GIVEN** deep copies of the fixture and of a selection with plan `starter` and `extraStorage`
- **WHEN** `reconcileSelection` is called with the originals
- **THEN** both originals still deeply equal their copies

### Requirement: Other selection fields are preserved

`req~reconcile-preserves-fields~1`
The `reconcileSelection` function SHALL return `planId`, `billingPeriod`, `variables` and every
`addOns` entry whose id is not in `pricing.addOns` unchanged.
Needs: impl, utest

#### Scenario: Billing, variables and unknown ids kept

- **GIVEN** the fixture, plan `starter`, billing `yearly`, variables `{ seats: 12 }`,
  `extraStorage` selected and `ghost: { selected: true, quantity: 1 }`
- **WHEN** `reconcileSelection` is called
- **THEN** `planId`, `billingPeriod`, `variables` and `addOns.ghost` equal the input values

### Requirement: Resolved totals exclude the removal set

`req~resolve-totals-exclude-removed~1`
The `resolvePricing` function SHALL compute `subtotal` and `requiresQuote` from the reconciled
selection of the merged input.
Needs: impl, utest

#### Scenario: Starter with extraStorage

- **GIVEN** the fixture, plan `starter`, `extraStorage: { selected: true, quantity: 2 }`
- **WHEN** `resolvePricing` is called
- **THEN** `subtotal` is 20

#### Scenario: Growth with compliance

- **GIVEN** the fixture, plan `growth`, `compliance` selected
- **WHEN** `resolvePricing` is called
- **THEN** `requiresQuote` is `false` and `subtotal` is 45

### Requirement: Resolved selection stays the merged input

`req~resolve-selection-unreconciled~1`
The `resolvePricing` function SHALL return the merged input selection, without reconciliation, as
`resolved.selection`.
Needs: impl, utest

#### Scenario: Invalid add-on stays in resolved.selection

- **GIVEN** the fixture, plan `starter`, `extraStorage: { selected: true, quantity: 2 }`
- **WHEN** `resolvePricing` is called
- **THEN** `resolved.selection.addOns.extraStorage` equals `{ selected: true, quantity: 2 }`

## Requirements: element

### Requirement: Plan change without removals applies immediately

`req~plan-change-immediate~1`
WHEN the user picks a plan whose removal set is empty, the element SHALL apply it and emit one
`pricing-selection-change` without opening a dialog.
Needs: impl, utest

#### Scenario: Starter to Growth

- **GIVEN** the element, uncontrolled, on plan `starter` with no add-on selected
- **WHEN** the user picks Growth
- **THEN** no `.pr-dialog` is shown and exactly one event with `planId: 'growth'` is emitted

### Requirement: Plan change with removals asks for confirmation

`req~plan-change-confirmation~1`
WHEN the user picks a plan whose removal set is not empty, the element SHALL open the pending-change
dialog listing the removal set with `pricing.willRemove` and emit no event while it is open.
Needs: impl, utest

#### Scenario: Growth with extraStorage and prioritySuccess to Starter

- **GIVEN** the element on plan `growth` with `extraStorage` and `prioritySuccess` selected
- **WHEN** the user picks Starter
- **THEN** the dialog shows "Will remove: extraStorage, prioritySuccess" and no event is emitted

### Requirement: Pending plan change shape

`req~pending-plan-change-shape~1`
WHILE a plan change is pending, the element SHALL hold a `PendingAddOnChange` equal to
`{ addOnId: '', select: false, addIds: [], removeIds, planId }`.
Needs: impl, utest

#### Scenario: Private pending field

- **GIVEN** the element on plan `growth` with `extraStorage` selected
- **WHEN** the user picks Starter
- **THEN** the private `_pendingAddOnChange` field deeply equals
  `{ addOnId: '', select: false, addIds: [], removeIds: ['extraStorage'], planId: 'starter' }`

### Requirement: Apply commits plan and removals together

`req~plan-change-apply~1`
WHEN the user applies a pending plan change, the element SHALL set the plan and deselect the removal
set in one state update that emits exactly one `pricing-selection-change`.
Needs: impl, utest

#### Scenario: Apply Growth with extraStorage to Starter

- **GIVEN** a pending change from `growth` with `extraStorage` selected to `starter`
- **WHEN** the user clicks Apply
- **THEN** exactly one event is emitted, with `planId: 'starter'`,
  `addOns.extraStorage.selected: false` and `resolved.subtotal` 20

### Requirement: Cancel and Escape keep the previous plan

`req~plan-change-cancel~1`
WHEN the user cancels a pending plan change with Cancel or Escape, the element SHALL keep its
previous selection and checked plan radio, emit no event and restore focus.
Needs: impl, utest

#### Scenario: Cancel keeps Growth

- **GIVEN** a pending change from `growth` with `extraStorage` selected to `starter`
- **WHEN** the user clicks Cancel
- **THEN** the Growth radio is checked, the Starter radio is not, `extraStorage` stays selected
- **AND** no event is emitted and focus returns to the element focused before the dialog opened

#### Scenario: Escape

- **GIVEN** the same pending change
- **WHEN** the user presses Escape
- **THEN** the dialog closes, the Growth radio is checked and no event is emitted

### Requirement: Events carry a reconciled selection

`req~events-reconciled-selection~1`
The element SHALL emit `pricing-selection-change` and `pricing-action` only with a
`detail.selection` that is a reconciled selection.
Needs: impl, utest

#### Scenario: Controlled invalid selection

- **GIVEN** the element controlled with plan `starter` and `extraStorage` selected
- **WHEN** the user picks yearly billing, then clicks the Starter call to action
- **THEN** both events have `detail.selection.addOns.extraStorage.selected` equal to `false`

### Requirement: Element subtotal excludes the removal set

`req~element-subtotal-excludes-removed~1`
The element SHALL exclude every add-on of the removal set from the subtotal it renders and emits.
Needs: impl, utest

#### Scenario: Controlled invalid selection

- **GIVEN** the element controlled with plan `starter` and `extraStorage` selected
- **WHEN** it renders
- **THEN** the displayed estimate is the Starter price 20, not 25

### Requirement: Default selection is reconciled silently

`req~default-selection-reconciled~1`
WHEN the element loads pricing with a `defaultSelection`, it SHALL use its reconciled selection
without opening a dialog or emitting `pricing-selection-change`.
Needs: impl, utest

#### Scenario: Starter default with extraStorage

- **GIVEN** `defaultSelection` plan `starter`, `extraStorage: { selected: true, quantity: 2 }`
- **WHEN** the element loads the fixture
- **THEN** no dialog or event appears and the private `_internalSelection.addOns.extraStorage`
  equals `{ selected: false, quantity: 2 }`

### Requirement: Controlled selection is never rewritten

`req~controlled-selection-untouched~1`
WHILE the element is in controlled mode, the element SHALL NOT assign its `selection` property.
Needs: impl, utest

#### Scenario: Confirmed downgrade in controlled mode

- **GIVEN** the element controlled with plan `growth` and `extraStorage` selected
- **WHEN** the user picks Starter and clicks Apply
- **THEN** `element.selection` is the object the host set, unchanged
- **AND** exactly one event carries plan `starter` with `extraStorage.selected: false`

## Design notes (non-normative)

- `reconcileSelection` lives in `src/core/resolve.ts`, is exported from `src/core/index.ts` and
  reuses the dependents loop of `_selectedDependents`; `resolvePricing`, `_stabilizeResolvedPrices`
  and the element's plan change all use it, so the rule has one source.
- React consumers use the element through `@lit/react`: the element is the single integration
  point, with no React-specific change.
- Public API (owner-approved): the `reconcileSelection` export and an optional
  `PendingAddOnChange.planId` (`src/element/events.ts`); readers tell plan changes apart with
  `planId !== undefined`. Minor changeset for `pricing-renderer`; no other public API change.
- No new i18n keys: the dialog reuses `pricing.confirmChanges`, `pricing.confirmChangesDescription`,
  `pricing.willRemove`, `pricing.apply` and `pricing.cancel`.
- Lit's `.checked` binding does not re-commit an unchanged value, so Cancel needs an explicit reset
  of the native radio state (for example `live()`).

## Acceptance checklist

Unit tests (vitest, `tests/unit`, fixture parsed from YAML):

- [ ] `[utest->req~reconcile-selection-result~1]` unit
- [ ] `[utest->req~reconcile-unavailable-addons~1]` unit
- [ ] `[utest->req~reconcile-dependents~1]` unit
- [ ] `[utest->req~reconcile-unrestricted-addons~1]` unit
- [ ] `[utest->req~reconcile-valid-unchanged~1]` unit, includes idempotence
- [ ] `[utest->req~reconcile-no-mutation~1]` unit
- [ ] `[utest->req~reconcile-preserves-fields~1]` unit
- [ ] `[utest->req~resolve-totals-exclude-removed~1]` unit
- [ ] `[utest->req~resolve-selection-unreconciled~1]` unit

Playwright tests (`tests/browser/pricing-renderer.spec.ts`; vitest runs without a DOM):

- [ ] `[utest->req~plan-change-immediate~1]` Playwright
- [ ] `[utest->req~plan-change-confirmation~1]` Playwright
- [ ] `[utest->req~pending-plan-change-shape~1]` Playwright, reads the private pending field
- [ ] `[utest->req~plan-change-apply~1]` Playwright
- [ ] `[utest->req~plan-change-cancel~1]` Playwright, Cancel and Escape
- [ ] `[utest->req~events-reconciled-selection~1]` Playwright
- [ ] `[utest->req~element-subtotal-excludes-removed~1]` Playwright
- [ ] `[utest->req~default-selection-reconciled~1]` Playwright
- [ ] `[utest->req~controlled-selection-untouched~1]` Playwright
