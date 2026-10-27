## ADDED Requirements

### Requirement: Comparison function is exported
`req~compare-selections-export~1`
The core entry point `src/core/index.ts` SHALL export the function `compareSelections` and the types listed under D1 in design.md with the fields and types of design.md, Decision 1.

Needs: impl, utest

#### Scenario: Runtime export
- **GIVEN** the module namespace of `src/core/index.ts` imported in node
- **WHEN** the test reads `compareSelections`
- **THEN** it is a function of length 1

#### Scenario: Types through the compiler API
- **GIVEN** a snippet that imports `SelectionComparison` and `SelectionComparisonInput` from `src/core/index.ts` and assigns `comparison.relation` to a `'current' | 'upgrade' | 'downgrade' | 'change'`, `comparison.price.difference` to a `number | undefined` and `comparison.usageLimits.changed[0].after` to a `ComparedValue`
- **AND** a second snippet with `const relation: SelectionRelation = 'sidegrade'`
- **WHEN** a unit test type-checks both snippets with the TypeScript compiler API
- **THEN** the first reports no error and the second reports error TS2322

### Requirement: Plan before and after
`req~compare-plan~1`
The `compareSelections` function SHALL set `plan.before` and `plan.after` to the `id` of the side's merged selection, the plan `name` when the id is a plan id of the side's pricing, and `known`, and set `plan.changed` to whether the two ids differ.

Needs: impl, utest

#### Scenario: Growth to Enterprise
- **GIVEN** Acme
- **WHEN** `cmp(Side(Acme, C), Side(Acme, ENT))` is called
- **THEN** `plan` strictly equals `{ before: { id: 'growth', name: 'Growth', known: true }, after: { id: 'enterprise', name: 'Enterprise', known: true }, changed: true }`

#### Scenario: Unknown plan has no name
- **GIVEN** Acme
- **WHEN** `cmp(Side(Acme, C), Side(Acme, { planId: 'legacy' }))` is called
- **THEN** `plan.after` strictly equals `{ id: 'legacy', known: false }`

### Requirement: Relation current
`req~compare-relation-current~1`
WHEN both sides have equal version strings or no version, equal plan ids, equal billing period ids, the same selected add-on ids with equal billed quantities and deep-equal variables, the `compareSelections` function SHALL set `relation` to `'current'`.

Needs: impl, utest

#### Scenario: Same contract
- **GIVEN** Acme
- **WHEN** `cmp(Side(Acme, C), Side(Acme, C))` is called
- **THEN** `relation` is `'current'` and `price.difference` is 0
- **AND** `addOns.added`, `addOns.removedByUser`, `addOns.removedByReconciliation`, `addOns.quantityChanged`, `features.gained`, `features.lost`, `features.changed` and `usageLimits.changed` all equal `[]`
- **AND** `addOns.unchanged` equals `['extraStorage', 'prioritySuccess']`, `features.unchanged` equals `['projects', 'collaboration', 'auditLog', 'customRoles']` and `usageLimits.unchanged` equals `['storage']`

#### Scenario: Removed add-on that was not in the contract
- **GIVEN** Acme
- **WHEN** `cmp(Side(Acme, { planId: 'starter' }), Side(Acme, { planId: 'starter', addOns: { extraStorage: { selected: true, quantity: 2 } } }))` is called
- **THEN** `relation` is `'current'` and every add-on list equals `[]`

### Requirement: Relation by plan order
`req~compare-relation-plan-order~1`
WHEN the plan ids of the two sides differ and both are plan ids of the after pricing, the `compareSelections` function SHALL set `relation` to `'upgrade'` if the after plan comes later than the before plan in `after.pricing.plans`, and to `'downgrade'` otherwise.

Needs: impl, utest

#### Scenario: Upgrade that costs less
- **GIVEN** Acme, where Enterprise (40) costs less than Growth (45) with 5 seats
- **WHEN** `cmp(Side(Acme, C), Side(Acme, ENT))` is called
- **THEN** `relation` is `'upgrade'` and `price.difference` is -5 (75 − 80)

#### Scenario: Downgrade
- **GIVEN** Acme
- **WHEN** `cmp(Side(Acme, C), Side(Acme, START))` is called
- **THEN** `relation` is `'downgrade'`

#### Scenario: Across versions
- **GIVEN** V1 and V2
- **WHEN** `cmp(Side(V1, M2), Side(V2, { planId: 'pro', addOns: { dedicatedIp: { selected: true, quantity: 1 } } }))` is called
- **THEN** `relation` is `'upgrade'`

### Requirement: Relation change
`req~compare-relation-change~1`
WHEN the relation is not `'current'` and either the plan ids of the two sides are equal or one of them is not a plan id of the after pricing, the `compareSelections` function SHALL set `relation` to `'change'`.

Needs: impl, utest

#### Scenario: Same plan, other quantity and billing period
- **GIVEN** Acme
- **WHEN** `cmp(Side(Acme, C), Side(Acme, CY3))` and `cmp(Side(Acme, C), Side(Acme, { ...C, variables: { seats: 6 } }))` are called
- **THEN** both have `relation` `'change'`

#### Scenario: Unknown plan
- **GIVEN** Acme
- **WHEN** `cmp(Side(Acme, C), Side(Acme, { planId: 'legacy' }))` is called
- **THEN** `relation` is `'change'`

### Requirement: Added add-ons
`req~compare-addons-added~1`
The `compareSelections` function SHALL list in `addOns.added` each add-on selected in `selections.after` and not in `selections.before`, with `quantity` equal to its billed quantity in `selections.after`.

Needs: impl, utest

#### Scenario: Add-on that exists only in the new version
- **GIVEN** V1 and V2
- **WHEN** `cmp(Side(V1, M2), Side(V2, { planId: 'pro', addOns: { dedicatedIp: { selected: true, quantity: 1 } } }))` is called
- **THEN** `addOns.added` strictly equals `[{ id: 'dedicatedIp', name: 'Dedicated Ip', quantity: 1, presence: 'after-only' }]`

#### Scenario: Compliance on Enterprise
- **GIVEN** Acme
- **WHEN** `cmp(Side(Acme, C), Side(Acme, QUOTE))` is called
- **THEN** `addOns.added` strictly equals `[{ id: 'compliance', name: 'Compliance', quantity: 1, presence: 'both' }]`

### Requirement: Add-ons removed by the user
`req~compare-addons-removed-by-user~1`
The `compareSelections` function SHALL list in `addOns.removedByUser` each add-on selected in `selections.before` that the after input does not select, with `quantity` equal to its billed quantity in `selections.before`.

Needs: impl, utest

#### Scenario: Priority Success dropped for Compliance
- **GIVEN** Acme
- **WHEN** `cmp(Side(Acme, C), Side(Acme, QUOTE))` is called
- **THEN** `addOns.removedByUser` strictly equals `[{ id: 'prioritySuccess', name: 'Priority Success', quantity: 1, presence: 'both' }]`

### Requirement: Add-ons removed by reconciliation
`req~compare-addons-removed-by-reconciliation~1`
The `compareSelections` function SHALL list in `addOns.removedByReconciliation` each add-on selected in `selections.before` that the after input selects and `selections.after` does not, with `reason` `'not-in-version'` when the id is not an add-on of the after pricing, `'unavailable-for-plan'` when its `availableFor` is not empty and does not contain the after plan id, and `'dependency-removed'` otherwise.

Needs: impl, utest

#### Scenario: Downgrade to Starter
- **GIVEN** Acme
- **WHEN** `cmp(Side(Acme, C), Side(Acme, START))` is called
- **THEN** `addOns.removedByReconciliation` strictly equals `[{ id: 'extraStorage', name: 'Extra Storage', quantity: 2, presence: 'both', reason: 'unavailable-for-plan' }, { id: 'prioritySuccess', name: 'Priority Success', quantity: 1, presence: 'both', reason: 'unavailable-for-plan' }]`
- **AND** `addOns.removedByUser` equals `[]`

#### Scenario: Dependent add-on
- **GIVEN** V2
- **WHEN** `cmp(Side(V2, { planId: 'pro', addOns: { dedicatedIp: { selected: true, quantity: 1 }, ipWarmup: { selected: true, quantity: 1 } } }), Side(V2, { planId: 'basic', addOns: { dedicatedIp: { selected: true, quantity: 1 }, ipWarmup: { selected: true, quantity: 1 } } }))` is called
- **THEN** the `id` and `reason` pairs of `addOns.removedByReconciliation` are `['dedicatedIp', 'unavailable-for-plan']` and `['ipWarmup', 'dependency-removed']`, in that order
- **AND** `relation` is `'downgrade'`, `price.before.subtotal` is 53, `price.after.subtotal` is 12 and `price.difference` is -41

#### Scenario: Add-on not offered in the after version
- **GIVEN** V1 and V2
- **WHEN** `cmp(Side(V2, { planId: 'pro', addOns: { dedicatedIp: { selected: true, quantity: 1 } } }), Side(V1, { planId: 'pro', addOns: { dedicatedIp: { selected: true, quantity: 1 } } }))` is called
- **THEN** `addOns.removedByReconciliation` strictly equals `[{ id: 'dedicatedIp', name: 'Dedicated Ip', quantity: 1, presence: 'before-only', reason: 'not-in-version' }]`
- **AND** `price.after.requiresQuote` is `false` and `price.after.subtotal` is 30

### Requirement: Quantity changes
`req~compare-addons-quantity~1`
The `compareSelections` function SHALL list in `addOns.quantityChanged` each add-on selected on both sides with different billed quantities, with `before`, `after` and `delta` equal to `after - before`.

Needs: impl, utest

#### Scenario: Two to three storage packs
- **GIVEN** Acme
- **WHEN** `cmp(Side(Acme, C), Side(Acme, CY3))` is called
- **THEN** `addOns.quantityChanged` strictly equals `[{ id: 'extraStorage', name: 'Extra Storage', before: 2, after: 3, delta: 1 }]`

#### Scenario: Quantity above the maximum is compared as billed
- **GIVEN** Acme
- **WHEN** `cmp(Side(Acme, C), Side(Acme, { planId: 'growth', addOns: { extraStorage: { selected: true, quantity: 25 }, prioritySuccess: { selected: true, quantity: 1 } } }))` is called
- **THEN** the `extraStorage` entry of `addOns.quantityChanged` has `after` 10 and `delta` 8

### Requirement: Unchanged add-ons
`req~compare-addons-unchanged~1`
The `compareSelections` function SHALL list in `addOns.unchanged` the id of each add-on selected on both sides with equal billed quantities.

Needs: impl, utest

#### Scenario: Billing period change only for Priority Success
- **GIVEN** Acme
- **WHEN** `cmp(Side(Acme, C), Side(Acme, CY3))` is called
- **THEN** `addOns.unchanged` equals `['prioritySuccess']`

### Requirement: Effective feature values
`req~compare-effective-features~1`
The `compareSelections` function SHALL compute the value of each feature on each side as the selected plan's unwrapped value, or the feature's `defaultValue` when the plan does not define it or is unknown, replaced by the unwrapped `features` value of each selected add-on that defines it, in the declaration order of the side's add-ons.

Needs: impl, utest

#### Scenario: Add-on grants a feature
- **GIVEN** F
- **WHEN** `cmp(Side(F, { planId: 'base' }), Side(F, { planId: 'base', addOns: { ssoPack: { selected: true, quantity: 1 } } }))` is called
- **THEN** `features.gained` strictly equals `[{ id: 'sso', name: 'Sso', before: { kind: 'boolean', value: false }, after: { kind: 'boolean', value: true }, presence: 'both' }]`

#### Scenario: Plan value replaces the default
- **GIVEN** Acme
- **WHEN** `cmp(Side(Acme, C), Side(Acme, ENT))` is called
- **THEN** `features.gained` strictly equals `[{ id: 'customRoles', name: 'Custom Roles', before: { kind: 'boolean', value: false }, after: { kind: 'boolean', value: true }, presence: 'both' }]`

### Requirement: Feature change classes
`req~compare-features~1`
The `compareSelections` function SHALL put each feature of either pricing in exactly one of `features.gained` (no capability before, capability after), `features.lost` (capability before, none after), `features.changed` (capability on both sides with values that are not deep-equal) or `features.unchanged` (deep-equal values, or no capability on either side), where the kinds none, `false`, number 0 and text `''` have no capability.

Needs: impl, utest

#### Scenario: Audit log lost on Starter
- **GIVEN** Acme
- **WHEN** `cmp(Side(Acme, C), Side(Acme, START))` is called
- **THEN** `features.lost` has one entry, `auditLog`, with `before` `{ kind: 'boolean', value: true }` and `after` `{ kind: 'boolean', value: false }`
- **AND** `features.unchanged` equals `['projects', 'collaboration', 'customRoles']`

#### Scenario: Feature removed in the new version
- **GIVEN** V1 and V2
- **WHEN** `cmp(Side(V1, M2), Side(V2, M2))` is called
- **THEN** `features.lost` strictly equals `[{ id: 'legacyExport', name: 'Legacy Export', before: { kind: 'boolean', value: true }, after: { kind: 'none' }, presence: 'before-only' }]`
- **AND** `features.unchanged` equals `['api']`

#### Scenario: Null and false are both without capability
- **GIVEN** F, where plan `team` has `features.sso` `null`
- **WHEN** `cmp(Side(F, { planId: 'base' }), Side(F, { planId: 'team' }))` is called
- **THEN** `features.unchanged` equals `['sso']`

### Requirement: Effective usage-limit values
`req~compare-effective-limits~1`
The `compareSelections` function SHALL compute the value of each usage limit on each side as the selected plan's unwrapped value, or the limit's `defaultValue` when the plan does not define it or is unknown, replaced by the unwrapped `usageLimits` value of each selected add-on that defines it, in the declaration order of the side's add-ons.

Needs: impl, utest

#### Scenario: Plan values
- **GIVEN** Acme
- **WHEN** `cmp(Side(Acme, { planId: 'starter' }), Side(Acme, { planId: 'growth' }))` is called
- **THEN** the `storage` change has `before` `{ kind: 'number', value: 10 }` and `after` `{ kind: 'number', value: 100 }`

#### Scenario: Add-on override
- **GIVEN** F
- **WHEN** `cmp(Side(F, { planId: 'base' }), Side(F, { planId: 'base', addOns: { unlimitedSeats: { selected: true, quantity: 1 } } }))` is called
- **THEN** the `seats` change has `before` `{ kind: 'number', value: 5 }` and `after` `{ kind: 'unlimited' }`

### Requirement: Usage-limit extensions
`req~compare-limit-extensions~1`
WHEN a selected add-on defines a finite `usageLimitsExtensions` value for a usage limit, the `compareSelections` function SHALL add that value multiplied by the add-on's billed quantity to the limit's numeric value at that add-on's place in the declaration order, keep an unlimited value unlimited and count a missing value as 0.

Needs: impl, utest

#### Scenario: Storage packs extend the plan limit
- **GIVEN** Acme
- **WHEN** `cmp(Side(Acme, C), Side(Acme, CY3))` is called
- **THEN** `usageLimits.changed` strictly equals `[{ id: 'storage', name: 'Storage', unit: 'GB', before: { kind: 'number', value: 200 }, after: { kind: 'number', value: 250 }, delta: 50, direction: 'increased', presence: 'both' }]`

#### Scenario: Extension, then override
- **GIVEN** F
- **WHEN** `cmp(Side(F, { planId: 'base' }), Side(F, { planId: 'base', addOns: { seatPack: { selected: true, quantity: 3 } } }))` and `cmp(Side(F, { planId: 'base', addOns: { seatPack: { selected: true, quantity: 3 } } }), Side(F, { planId: 'base', addOns: { seatPack: { selected: true, quantity: 3 }, unlimitedSeats: { selected: true, quantity: 1 } } }))` are called
- **THEN** the first has the `seats` change `before` `{ kind: 'number', value: 5 }`, `after` `{ kind: 'number', value: 20 }` and `delta` 15
- **AND** the second has the `seats` change `before` `{ kind: 'number', value: 20 }`, `after` `{ kind: 'unlimited' }` and no `delta` key

#### Scenario: Extension of an unlimited plan limit
- **GIVEN** F
- **WHEN** `cmp(Side(F, { planId: 'team' }), Side(F, { planId: 'team', addOns: { seatPack: { selected: true, quantity: 2 } } }))` is called
- **THEN** `usageLimits.unchanged` equals `['seats']`

#### Scenario: Extension of a missing limit
- **GIVEN** F without `usageLimits.seats.defaultValue` and without `plans.base.usageLimits`
- **WHEN** `cmp(Side(F, { planId: 'base' }), Side(F, { planId: 'base', addOns: { seatPack: { selected: true, quantity: 2 } } }))` is called
- **THEN** the `seats` change has `before` `{ kind: 'none' }`, `after` `{ kind: 'number', value: 10 }`, `direction` `'increased'` and no `delta` key

### Requirement: Unlimited values
`req~compare-limit-unlimited~1`
The `compareSelections` function SHALL represent a usage-limit value that is `Infinity`, `null`, `'.inf'`, `'Infinity'` or `'unlimited'` as `{ kind: 'unlimited' }`.

Needs: impl, utest

#### Scenario: Enterprise storage from the YAML `.inf`
- **GIVEN** Acme, where Enterprise `storage` is `.inf`
- **WHEN** `cmp(Side(Acme, C), Side(Acme, ENT))` is called
- **THEN** `usageLimits.changed` strictly equals `[{ id: 'storage', name: 'Storage', unit: 'GB', before: { kind: 'number', value: 200 }, after: { kind: 'unlimited' }, direction: 'increased', presence: 'both' }]`

#### Scenario: Every unlimited spelling
- **GIVEN** F with `plans.team.usageLimits.seats.value` set in turn to `null`, `'.inf'`, `'Infinity'`, `'unlimited'` and `Number.POSITIVE_INFINITY`
- **WHEN** `cmp(Side(F, { planId: 'base' }), Side(F, { planId: 'team' }))` is called for each
- **THEN** every result has one `seats` change with `after` `{ kind: 'unlimited' }`, `direction` `'increased'` and no `delta` key

### Requirement: Usage-limit changes
`req~compare-limits~1`
The `compareSelections` function SHALL put each usage limit of either pricing in `usageLimits.changed` when its values are not deep-equal, with `direction` `'increased'` or `'decreased'` under the order none < number < unlimited, `'changed'` when either value is boolean, text or json, and `delta` = `after.value - before.value` only when both values are numbers, or else its id in `usageLimits.unchanged`.

Needs: impl, utest

#### Scenario: Downgrade to Starter
- **GIVEN** Acme
- **WHEN** `cmp(Side(Acme, C), Side(Acme, START))` is called
- **THEN** the `storage` change has `before` `{ kind: 'number', value: 200 }`, `after` `{ kind: 'number', value: 10 }`, `delta` -190 and `direction` `'decreased'`

#### Scenario: Limit lowered in the new version
- **GIVEN** V1 and V2
- **WHEN** `cmp(Side(V1, M2), Side(V2, M2))` is called
- **THEN** the `emails` change has `before` `{ kind: 'number', value: 2000 }`, `after` `{ kind: 'number', value: 1800 }`, `delta` -200, `direction` `'decreased'`, `unit` `'email'` and `presence` `'both'`

### Requirement: Current usage above the new limit
`req~compare-current-usage~1`
WHEN `input.currentUsage` has a valid entry for a usage limit, the `compareSelections` function SHALL list that limit's id in `usageLimits.exceeded` exactly when the after value is a number below the consumed amount or is none with a consumed amount above 0.

Needs: impl, utest

#### Scenario: Downgrade below consumption
- **GIVEN** Acme and `currentUsage` `{ storage: 150 }`
- **WHEN** `compareSelections({ before: Side(Acme, C), after: Side(Acme, START), currentUsage })` is called
- **THEN** `usageLimits.exceeded` equals `['storage']`

#### Scenario: New version below consumption
- **GIVEN** V1, V2 and `currentUsage` `{ emails: 1900 }`
- **WHEN** `compareSelections({ before: Side(V1, M2), after: Side(V2, M2), currentUsage })` is called
- **THEN** `usageLimits.exceeded` equals `['emails']`

#### Scenario: Unchanged limit already exceeded
- **GIVEN** Acme and `currentUsage` `{ storage: 250 }`
- **WHEN** `compareSelections({ before: Side(Acme, C), after: Side(Acme, C), currentUsage })` is called
- **THEN** `usageLimits.unchanged` equals `['storage']` and `usageLimits.exceeded` equals `['storage']`

#### Scenario: Unlimited and sufficient limits are not flagged
- **GIVEN** Acme and `currentUsage` `{ storage: 150 }`
- **WHEN** `compareSelections` is called with before `Side(Acme, C)` and after `Side(Acme, ENT)`, then after `Side(Acme, CY3)`
- **THEN** both results have `usageLimits.exceeded` equal to `[]`

### Requirement: Current usage on change entries
`req~compare-current-usage-entry~1`
WHEN `input.currentUsage` has a valid entry for a usage limit listed in `usageLimits.changed`, the `compareSelections` function SHALL set `currentUsage` on that change entry to the consumed amount, adding `exceedsCurrentUsage: true` exactly when the id is in `usageLimits.exceeded`.

Needs: impl, utest

#### Scenario: Flagged downgrade
- **GIVEN** Acme and `currentUsage` `{ storage: 150 }`
- **WHEN** `compareSelections({ before: Side(Acme, C), after: Side(Acme, START), currentUsage })` is called
- **THEN** the `storage` change has `currentUsage` 150 and `exceedsCurrentUsage` `true`

#### Scenario: Not flagged
- **GIVEN** Acme and `currentUsage` `{ storage: 150 }`
- **WHEN** `compareSelections` is called with before `Side(Acme, C)` and after `Side(Acme, ENT)`, then after `Side(Acme, CY3)`
- **THEN** in both results the `storage` change has `currentUsage` 150 and no `exceedsCurrentUsage` key

### Requirement: Price sides
`req~compare-price-sides~1`
The `compareSelections` function SHALL set `price.before` and `price.after` to copies of `resolvePricing(pricing, selections.<side>, { expression }).breakdown` of each side, and `price.billingPeriodChanged` to whether their `billingPeriod` ids differ.

Needs: impl, utest

#### Scenario: Monthly contract to yearly edit
- **GIVEN** Acme
- **WHEN** `r = cmp(Side(Acme, C), Side(Acme, CY3))` is called
- **THEN** `r.price.before` strictly equals `resolvePricing(Acme, C).breakdown` (subtotal 80) and `r.price.after` strictly equals `resolvePricing(Acme, r.selections.after).breakdown` (subtotal 68 = 36 + 12 + 20)
- **AND** `r.price.billingPeriodChanged` is `true`

### Requirement: Price difference
`req~compare-price-difference~1`
WHEN neither breakdown requires a quote and both have the same currency, the `compareSelections` function SHALL set `price.difference` to `price.after.subtotal - price.before.subtotal`, without a `price.differenceOmitted` key.

Needs: impl, utest

#### Scenario: Yearly edit and new version
- **GIVEN** Acme, V1 and V2
- **WHEN** `cmp(Side(Acme, C), Side(Acme, CY3))` and `cmp(Side(V1, M2), Side(V2, M2))` are called
- **THEN** `price.difference` is -12 and 2 respectively, and neither result has a `differenceOmitted` key

### Requirement: Difference left out
`req~compare-price-difference-omitted~1`
IF either breakdown requires a quote or the currencies differ, THEN the `compareSelections` function SHALL leave out the `price.difference` key and set `price.differenceOmitted` to `'quote'` when a breakdown requires a quote, else to `'currency'`.

Needs: impl, utest

#### Scenario: Compliance requires a quote
- **GIVEN** Acme
- **WHEN** `r = cmp(Side(Acme, C), Side(Acme, QUOTE))` is called
- **THEN** `'difference' in r.price` is `false`, `r.price.differenceOmitted` is `'quote'`, `r.price.after.requiresQuote` is `true` and `r.price.after.subtotal` is 50

#### Scenario: Currency mismatch
- **GIVEN** V1 and V2U
- **WHEN** `r = cmp(Side(V1, M2), Side(V2U, M2))` is called
- **THEN** `'difference' in r.price` is `false` and `r.price.differenceOmitted` is `'currency'`

### Requirement: Version change
`req~compare-version~1`
The `compareSelections` function SHALL set `version.before` and `version.after` to the `metadata.version` of each pricing, each key absent when that pricing has no version, and `version.changed` to whether the two values differ.

Needs: impl, utest

#### Scenario: Version 1.0 to 2.0
- **GIVEN** V1 and V2
- **WHEN** `cmp(Side(V1, M2), Side(V2, M2))` is called
- **THEN** `version.before` is `'1.0'`, `version.after` is `'2.0'` and `version.changed` is `true`

#### Scenario: Same version
- **GIVEN** Acme
- **WHEN** `cmp(Side(Acme, C), Side(Acme, ENT))` is called
- **THEN** `version.before` and `version.after` are `'2026.07'` and `version.changed` is `false`

### Requirement: Items in only one version
`req~compare-version-items~1`
The `compareSelections` function SHALL set `version.onlyInBefore` and `version.onlyInAfter` to the plan, add-on, feature and usage-limit ids defined in only the before or only the after pricing, each list in that pricing's declaration order.

Needs: impl, utest

#### Scenario: Version 1.0 to 2.0
- **GIVEN** V1 and V2
- **WHEN** `cmp(Side(V1, M2), Side(V2, M2))` is called
- **THEN** `version.onlyInBefore` strictly equals `{ plans: [], addOns: [], features: ['legacyExport'], usageLimits: [] }`
- **AND** `version.onlyInAfter` strictly equals `{ plans: [], addOns: ['dedicatedIp', 'ipWarmup'], features: [], usageLimits: [] }`

### Requirement: Item presence
`req~compare-item-presence~1`
The `compareSelections` function SHALL set `presence` on each add-on, feature and usage-limit entry to `'both'`, `'before-only'` or `'after-only'` according to the pricings that define the id, and take `name` and `unit` from the after pricing when it defines the id, else from the before pricing.

Needs: impl, utest

#### Scenario: Entries across versions
- **GIVEN** V1 and V2
- **WHEN** `cmp(Side(V1, M2), Side(V2, { planId: 'pro', addOns: { dedicatedIp: { selected: true, quantity: 1 } } }))` and `cmp(Side(V1, M2), Side(V2, M2))` are called
- **THEN** the first has the `dedicatedIp` entry in `addOns.added` with `presence` `'after-only'` and the `extraEmails` entry in `addOns.removedByUser` with `presence` `'both'`
- **AND** the second has the `legacyExport` entry in `features.lost` with `presence` `'before-only'`

### Requirement: Reconciled selections in the result
`req~compare-selections-output~1`
The `compareSelections` function SHALL set `selections.before` and `selections.after` to the merged, sanitized, quantity-normalized and reconciled selection of each side as defined in design.md, Decision 2, steps 1 to 4.

Needs: impl, utest

#### Scenario: Downgrade to Starter
- **GIVEN** Acme
- **WHEN** `r = cmp(Side(Acme, C), Side(Acme, START))` is called
- **THEN** `r.selections.after.planId` is `'starter'`, `r.selections.after.billingPeriod` is `'monthly'` and `r.selections.after.addOns` strictly equals `{ extraStorage: { selected: false, quantity: 2 }, prioritySuccess: { selected: false, quantity: 1 } }`

#### Scenario: Billed quantity and dropped unknown add-on
- **GIVEN** Acme
- **WHEN** `r = cmp(Side(Acme, C), Side(Acme, { planId: 'growth', addOns: { ghost: { selected: true, quantity: 1 }, extraStorage: { selected: true, quantity: 25 } } }))` is called
- **THEN** `r.selections.after.addOns` strictly equals `{ extraStorage: { selected: true, quantity: 10 } }`

### Requirement: Unknown plan is reported
`req~compare-unknown-plan~1`
IF a side's merged plan id is defined and is not a plan id of its pricing, THEN the `compareSelections` function SHALL keep that id and add one `warning` diagnostic with code `PR_COMPARE_UNKNOWN_PLAN` and path `<side>.selection.planId`.

Needs: impl, utest

#### Scenario: Before side with a wrongly cased plan
- **GIVEN** Acme
- **WHEN** `r = cmp(Side(Acme, { planId: 'Growth' }), Side(Acme, C))` is called
- **THEN** the call does not throw and `r.diagnostics` has one entry, with code `PR_COMPARE_UNKNOWN_PLAN`, severity `'warning'` and path `'before.selection.planId'`
- **AND** `r.plan.before` strictly equals `{ id: 'Growth', known: false }` and `r.price.before.requiresQuote` is `true`

### Requirement: Unknown billing period is reported
`req~compare-unknown-billing~1`
IF a side's merged billing period id is not a billing period id of its pricing, THEN the `compareSelections` function SHALL keep that id and add one `warning` diagnostic with code `PR_COMPARE_UNKNOWN_BILLING_PERIOD` and path `<side>.selection.billingPeriod`.

Needs: impl, utest

#### Scenario: Quarterly on Acme
- **GIVEN** Acme
- **WHEN** `r = cmp(Side(Acme, C), Side(Acme, { ...C, billingPeriod: 'quarterly' }))` is called
- **THEN** `r.diagnostics` has one entry, with code `PR_COMPARE_UNKNOWN_BILLING_PERIOD`, severity `'warning'` and path `'after.selection.billingPeriod'`
- **AND** `'billingPeriod' in r.price.after` is `false`, `r.price.after.subtotal` is 80 and `r.price.billingPeriodChanged` is `true`

### Requirement: Unknown add-on is dropped and reported
`req~compare-unknown-addon~1`
IF a side's merged selection has an add-on id that its pricing does not define, THEN the `compareSelections` function SHALL drop that entry before resolving the side and add one `warning` diagnostic with code `PR_COMPARE_UNKNOWN_ADDON` and path `<side>.selection.addOns.<id>`.

Needs: impl, utest

#### Scenario: Ghost add-on does not require a quote
- **GIVEN** Acme
- **WHEN** `r = cmp(Side(Acme, C), Side(Acme, { ...C, addOns: { ...C.addOns, ghost: { selected: true, quantity: 1 } } }))` is called
- **THEN** `r.diagnostics` has one entry, with code `PR_COMPARE_UNKNOWN_ADDON`, severity `'warning'` and path `'after.selection.addOns.ghost'`
- **AND** `'ghost' in r.selections.after.addOns` is `false`, `r.price.after.requiresQuote` is `false` and `r.relation` is `'current'`

### Requirement: Diagnostics order
`req~compare-diagnostics-order~1`
The `compareSelections` function SHALL return its diagnostics in this order: the before side, then the after side, each with plan, billing period and then add-ons in key order; then the `PR_COMPARE_ADDON_DROPPED` entries; then the current-usage entries.

Needs: impl, utest

#### Scenario: Legacy plan, quarterly billing and a ghost add-on
- **GIVEN** Acme
- **WHEN** `r = cmp(Side(Acme, { planId: 'Growth' }), Side(Acme, { planId: 'legacy', billingPeriod: 'quarterly', addOns: { ghost: { selected: true, quantity: 1 }, extraStorage: { selected: true, quantity: 2 } } }))` is called
- **THEN** the call does not throw and the `[code, path]` pairs of `r.diagnostics` are `['PR_COMPARE_UNKNOWN_PLAN', 'before.selection.planId']`, `['PR_COMPARE_UNKNOWN_PLAN', 'after.selection.planId']`, `['PR_COMPARE_UNKNOWN_BILLING_PERIOD', 'after.selection.billingPeriod']`, `['PR_COMPARE_UNKNOWN_ADDON', 'after.selection.addOns.ghost']` and `['PR_COMPARE_ADDON_DROPPED', 'after.selection.addOns.extraStorage']`
- **AND** `r.relation` is `'change'` and `r.price.differenceOmitted` is `'quote'`

#### Scenario: Contract C to an unknown plan
- **GIVEN** Acme
- **WHEN** `r = cmp(Side(Acme, C), Side(Acme, { planId: 'legacy', addOns: { extraStorage: { selected: true, quantity: 2 } } }))` is called
- **THEN** `r.addOns.removedByReconciliation` has the single id `extraStorage` with `reason` `'unavailable-for-plan'` and `r.addOns.removedByUser` has the single id `prioritySuccess`

### Requirement: Dropped add-ons are reported
`req~compare-addon-dropped~1`
WHEN the after input selects an add-on that `selections.after` does not select and `selections.before` does not select either, the `compareSelections` function SHALL add one `info` diagnostic with code `PR_COMPARE_ADDON_DROPPED` and path `after.selection.addOns.<id>` after the after-side warnings.

Needs: impl, utest

#### Scenario: Storage on Starter
- **GIVEN** Acme
- **WHEN** `cmp(Side(Acme, { planId: 'starter' }), Side(Acme, { planId: 'starter', addOns: { extraStorage: { selected: true, quantity: 2 } } }))` is called
- **THEN** `diagnostics` has one entry, with code `PR_COMPARE_ADDON_DROPPED`, severity `'info'` and path `'after.selection.addOns.extraStorage'`

### Requirement: Current usage entries are validated
`req~compare-usage-diagnostics~1`
IF an entry of `input.currentUsage` has an id that is not a usage-limit id of either pricing, or a value that is not a finite number of at least 0, THEN the `compareSelections` function SHALL ignore that entry and add, in key order, an `info` diagnostic `PR_COMPARE_UNKNOWN_USAGE_LIMIT` or a `warning` diagnostic `PR_COMPARE_INVALID_USAGE` with path `currentUsage.<id>`.

Needs: impl, utest

#### Scenario: Not a number and an unknown limit
- **GIVEN** Acme and `currentUsage` `{ storage: Number.NaN, bandwidth: 3 }`
- **WHEN** `compareSelections({ before: Side(Acme, C), after: Side(Acme, START), currentUsage })` is called
- **THEN** the `[code, severity, path]` triples of `diagnostics` are `['PR_COMPARE_INVALID_USAGE', 'warning', 'currentUsage.storage']` and `['PR_COMPARE_UNKNOWN_USAGE_LIMIT', 'info', 'currentUsage.bandwidth']`
- **AND** `usageLimits.exceeded` equals `[]` and the `storage` change has no `currentUsage` key

### Requirement: Deterministic order
`req~compare-order~1`
The `compareSelections` function SHALL order every add-on, feature and usage-limit list by the declaration order of the after pricing followed by the ids defined only in the before pricing in its declaration order, whatever the key order of the input selections.

Needs: impl, utest

#### Scenario: Before-only add-ons after the after-pricing ones
- **GIVEN** V1 and V2
- **WHEN** `cmp(Side(V2, { planId: 'pro', addOns: { ipWarmup: { selected: true, quantity: 1 }, dedicatedIp: { selected: true, quantity: 1 }, extraEmails: { selected: true, quantity: 1 } } }), Side(V1, { planId: 'pro' }))` is called
- **THEN** the ids of `addOns.removedByUser` are `['extraEmails', 'dedicatedIp', 'ipWarmup']`

#### Scenario: Same input, same output
- **GIVEN** Acme and the before input C with its `addOns` keys in reverse order
- **WHEN** `cmp(Side(Acme, C), Side(Acme, START))` is called twice, and once with the reversed input
- **THEN** the three results are deeply equal

### Requirement: JSON-safe comparison
`req~compare-json~1`
The `compareSelections` function SHALL return a result that `JSON.parse(JSON.stringify(result))` reproduces exactly, with every optional key either absent or holding a defined value.

Needs: impl, utest

#### Scenario: Unlimited, quote, unknown ids and two versions
- **GIVEN** the results of `cmp(Side(Acme, C), Side(Acme, ENT))`, `cmp(Side(Acme, C), Side(Acme, QUOTE))`, the scenario "Legacy plan, quarterly billing and a ghost add-on" of `req~compare-diagnostics-order~1` and `compareSelections({ before: Side(V1, M2), after: Side(V2, M2), currentUsage: { emails: 1900 } })`
- **WHEN** each is passed through `JSON.parse(JSON.stringify(result))`
- **THEN** each round trip strictly equals (`toStrictEqual`) its result

#### Scenario: Inputs that are not JSON-safe
- **GIVEN** Acme and the after selection `{ planId: 'growth', billingPeriod: undefined, variables: { seats: 5, region: undefined }, addOns: { compliance: { selected: false, quantity: Number.NaN }, extraStorage: { selected: true, quantity: 2 } } }`
- **WHEN** `r = cmp(Side(Acme, C), Side(Acme, after))` is called
- **THEN** `JSON.parse(JSON.stringify(r))` strictly equals `r`
- **AND** `r.selections.after.billingPeriod` is `'monthly'`, `r.selections.after.addOns.compliance` strictly equals `{ selected: false, quantity: 0 }` and `r.selections.after.variables.region` is `'eu'` (the default)

### Requirement: Detached comparison
`req~compare-detached~1`
The `compareSelections` function SHALL return a result that shares no object with its input or with the result of another call.

Needs: impl, utest

#### Scenario: Mutating a result
- **GIVEN** Acme, `r1 = cmp(Side(Acme, C), Side(Acme, ENT))` and `r2` the same call again
- **WHEN** the test sets `r1.selections.after.addOns.extraStorage.quantity = 99`, `r1.price.after.addOns[0].amount = 0` and `r1.price.before.billingPeriod.label = 'Changed'`
- **THEN** `r2` still deeply equals a third call's result, `Acme.billing[0].label` is still `'Monthly'` and C still deeply equals its deep copy taken before the calls

### Requirement: Inputs are not mutated
`req~compare-no-mutation~1`
The `compareSelections` function SHALL NOT mutate its input, its pricings, its selections or its `currentUsage`.

Needs: impl, utest

#### Scenario: Deep copies compare equal
- **GIVEN** deep copies of V1, V2, the input of the scenario "Not a number and an unknown limit" and the input of the scenario "Legacy plan, quarterly billing and a ghost add-on" of `req~compare-diagnostics-order~1`
- **WHEN** `compareSelections` is called with the originals
- **THEN** every original still deeply equals its copy

### Requirement: Headless use
`req~compare-headless~1`
The `compareSelections` function SHALL run in an environment without DOM globals and without custom-element registration.

Needs: impl, utest

#### Scenario: Node without a DOM
- **GIVEN** vitest in the node environment, where `globalThis.document` and `globalThis.customElements` are `undefined`
- **WHEN** the test imports `compareSelections` from `src/core/index.ts` and calls `cmp(Side(Acme, C), Side(Acme, START))`
- **THEN** it returns a result with `relation` `'downgrade'`
