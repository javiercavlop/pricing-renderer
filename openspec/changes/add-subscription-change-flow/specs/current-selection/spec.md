## ADDED Requirements

### Requirement: Current selection property
`req~current-selection-property~1`
The `<pricing-renderer>` element SHALL accept a `currentSelection` property of type `Partial<PricingSelection> | undefined` that is not bound to an attribute.

Needs: impl, utest

#### Scenario: Property declaration
- **GIVEN** the `PricingRendererElement` class
- **WHEN** the test reads `PricingRendererElement.properties.currentSelection`
- **THEN** it deeply equals `{ attribute: false }`

#### Scenario: Type through the compiler API
- **GIVEN** a snippet that assigns `{ planId: 'growth' }` to `element.currentSelection` and one that assigns `42`
- **WHEN** a unit test type-checks both snippets with the TypeScript compiler API
- **THEN** the first reports no error and the second reports error TS2322

### Requirement: Current plan is marked
`req~current-selection-plan-mark~1`
WHILE `currentSelection.planId` is a plan id of the loaded pricing, the element SHALL render that plan's card with `data-current="true"` and one badge `[data-pr-part="current-badge"]` with the text of `pricing.currentPlanBadge`.

Needs: impl, utest

#### Scenario: Growth contract on the demo page
- **GIVEN** the demo page
- **WHEN** the host sets `currentSelection` to C and the next update completes
- **THEN** exactly one `[data-pr-part="plan-card"][data-current]` exists, it has `data-plan-id="growth"` and `data-current="true"`, and its `[data-pr-part="current-badge"]` has the text `Your plan`

#### Scenario: Spanish
- **GIVEN** the demo page with `currentSelection` C
- **WHEN** the user selects `es-ES` in `#locale`
- **THEN** the badge text is `Tu plan`

### Requirement: Current plan CTA
`req~current-selection-plan-cta~1`
WHILE `currentSelection.planId` is a plan id of the loaded pricing and `ctaEnabled` is true, the element SHALL render that plan's CTA as a `button` with the `disabled` attribute, `data-relation="current"` and the label `labels.current` of its configured CTA, or else the text of `pricing.currentPlanCta`.

Needs: impl, utest

#### Scenario: Growth CTA becomes Current plan
- **GIVEN** the demo page, where the Growth CTA is the link `Start free trial`, and a `pricing-action` listener that counts events
- **WHEN** the host sets `currentSelection` to C and the test clicks the Growth CTA with `click({ force: true })`, because a disabled control fails Playwright's actionability check
- **THEN** the Growth `[data-pr-part="cta"]` is a `BUTTON` with the `disabled` attribute, no `href`, `data-relation="current"` and the text `Current plan`
- **AND** the listener counted 0 events

### Requirement: Other plans are labelled by relation
`req~current-selection-relation-labels~1`
WHILE `currentSelection.planId` is a plan id of the loaded pricing, the element SHALL set `data-relation` on the CTA of every other plan to the relation of design.md, Decision 4, and label it `labels.upgrade` or `labels.downgrade` of its configured CTA, or else the text of `pricing.upgradeTo` or `pricing.downgradeTo` with `{plan}` set to the plan name.

Needs: impl, utest

#### Scenario: Starter and Enterprise around Growth
- **GIVEN** the demo page
- **WHEN** the host sets `currentSelection` to C and the next update completes
- **THEN** the Starter CTA has `data-relation="downgrade"` and the text `Downgrade to Starter`
- **AND** the Enterprise CTA has `data-relation="upgrade"`, the text `Upgrade to Enterprise` and still the `href` `https://example.com/contact`

#### Scenario: Spanish
- **GIVEN** the demo page with `currentSelection` C
- **WHEN** the user selects `es-ES` in `#locale`
- **THEN** the Starter CTA text is `Bajar a Starter` and the Enterprise CTA text is `Mejorar a Enterprise`

### Requirement: Current add-ons are marked
`req~current-selection-addons~1`
WHILE `currentSelection.planId` is a plan id of the loaded pricing, the element SHALL render each add-on card whose id is selected in the reconciled current side of design.md, Decision 2, with `data-current="true"` and one badge `[data-pr-part="current-add-on-badge"]` with the text of `pricing.currentAddOn`.

Needs: impl, utest

#### Scenario: Growth contract
- **GIVEN** the demo page
- **WHEN** the host sets `currentSelection` to C and the next update completes
- **THEN** the cards `[data-add-on-id="extraStorage"]` and `[data-add-on-id="prioritySuccess"]` have `data-current="true"` and a badge with the text `Current`
- **AND** the card `[data-add-on-id="compliance"]` has no `data-current` attribute and no such badge

#### Scenario: Add-on removed by reconciliation is not current
- **GIVEN** the demo page
- **WHEN** the host sets `currentSelection` to `{ planId: 'starter', addOns: { extraStorage: { selected: true, quantity: 2 } } }`
- **THEN** no `[data-pr-part="add-on-card"]` has a `data-current` attribute

#### Scenario: Add-ons without a plan are not marked
- **GIVEN** the demo page
- **WHEN** the host sets `currentSelection` to `{ addOns: { extraStorage: { selected: true, quantity: 3 } } }` and the next update completes
- **THEN** no element has a `data-current` attribute

### Requirement: The user's selection is not changed
`req~current-selection-keeps-selection~1`
WHEN the host sets `currentSelection`, the element SHALL leave the selection in effect unchanged, without dispatching `pricing-selection-change`.

Needs: impl, utest

#### Scenario: Uncontrolled demo page on Starter
- **GIVEN** the demo page on Starter with a `pricing-selection-change` listener that counts events
- **WHEN** the host sets `currentSelection` to C and the next update completes
- **THEN** the Starter radio is checked, `.pr-summary` contains `€20`, `resolvedState.selection.planId` is `'starter'` and the listener counted 0 events

#### Scenario: Controlled element
- **GIVEN** the demo page where the host set `selection` to an object `s` with plan `starter`
- **WHEN** the host sets `currentSelection` to C and the next update completes
- **THEN** `element.selection` is still `s` (same reference) and deeply equals its value before

### Requirement: Current selection is detached
`req~current-selection-detached~1`
WHEN the host sets `currentSelection`, the element SHALL keep a deep copy of the value, leaving the object it received unmutated.

Needs: impl, utest

#### Scenario: Host changes the object afterwards
- **GIVEN** the demo page, `input` a deep copy of C and a second deep copy `copy`
- **WHEN** the host sets `currentSelection` to `input`, then sets `input.planId = 'starter'` and calls `element.requestUpdate()`
- **THEN** after the update the Growth card still has `data-current="true"` and the Starter card has no `data-current` attribute
- **AND** apart from the host's own `planId` change, `input` still deeply equals `copy`

### Requirement: Unknown current plan
`req~current-selection-unknown-plan~1`
IF `currentSelection.planId` is not a plan id of the loaded pricing, THEN the element SHALL render no plan card with `data-current`, no `data-relation` attribute and the CTA labels it renders without `currentSelection`.

Needs: impl, utest

#### Scenario: Legacy plan on the demo page
- **GIVEN** the demo page
- **WHEN** the host sets `currentSelection` to `{ planId: 'legacy' }` and the next update completes
- **THEN** no element matches `[data-current]` or `[data-relation]`
- **AND** the CTA texts are `Start with Starter`, `Start free trial` and `Contact sales`

### Requirement: Current selection diagnostics
`req~current-selection-diagnostics~1`
WHEN an update follows a change of `currentSelection` or of the loaded pricing and the current selection has a plan id or add-on ids that the pricing does not define, the element SHALL dispatch one `pricing-diagnostic` with one `warning` per id, code `PR_CURRENT_SELECTION_UNKNOWN_PLAN` or `PR_CURRENT_SELECTION_UNKNOWN_ADDON` and path `currentSelection.planId` or `currentSelection.addOns.<id>`.

Needs: impl, utest

#### Scenario: Legacy plan and ghost add-on
- **GIVEN** the demo page with a `pricing-diagnostic` listener that records events and the number N of `[data-pr-part="diagnostics"] li` items (0 when the list is absent)
- **WHEN** the host sets `currentSelection` to `{ planId: 'legacy', addOns: { ghost: { selected: true, quantity: 1 } } }` and the next update completes, then calls `element.requestUpdate()` and that update completes
- **THEN** the listener recorded exactly one event, whose `detail.diagnostics` `[code, path]` pairs are `['PR_CURRENT_SELECTION_UNKNOWN_PLAN', 'currentSelection.planId']` and `['PR_CURRENT_SELECTION_UNKNOWN_ADDON', 'currentSelection.addOns.ghost']`, both `warning`
- **AND** the number of `[data-pr-part="diagnostics"] li` items is still N

#### Scenario: Known ids
- **GIVEN** the demo page with the same listener
- **WHEN** the host sets `currentSelection` to C
- **THEN** the listener records no event

### Requirement: Private current plan
`req~current-selection-private-plan~1`
WHILE `currentSelection.planId` is a private plan that the element does not render because `visibility` is `'public-only'`, the element SHALL label the CTAs of the rendered plans by relation, using the order of all plans in the pricing, private plans included.

Needs: impl, utest

#### Scenario: Hidden legacy plan between Basic and Pro
- **GIVEN** a new element with `pricing` PV, `visibility` `'public-only'` and `currentSelection` `{ planId: 'legacy' }`, and a `pricing-diagnostic` listener
- **WHEN** it is ready and the next update completes
- **THEN** no plan card has `data-current`, the Basic CTA text is `Downgrade to Basic` and the Pro CTA text is `Upgrade to Pro`
- **AND** the listener recorded no `PR_CURRENT_SELECTION_UNKNOWN_PLAN` diagnostic

#### Scenario: All plans visible
- **GIVEN** the same element with `visibility` set to `'all'`
- **WHEN** the next update completes
- **THEN** the Legacy card has `data-current="true"` and its CTA text is `Current plan`

### Requirement: Without a current selection nothing changes
`req~current-selection-unset~1`
WHILE `currentSelection` is undefined, the element SHALL render no `data-current` or `data-relation` attribute, no `current-badge` or `current-add-on-badge` part and the 0.1.0 CTA labels.

Needs: impl, utest

#### Scenario: Default demo page
- **GIVEN** the demo page
- **WHEN** the test queries `[data-current], [data-relation], [data-pr-part="current-badge"], [data-pr-part="current-add-on-badge"]`
- **THEN** it finds no element and the CTA texts are `Start with Starter`, `Start free trial` and `Contact sales`

#### Scenario: Set, then cleared
- **GIVEN** the demo page where the host set `currentSelection` to C
- **WHEN** the host sets `currentSelection` to `undefined` and the next update completes
- **THEN** the same query finds no element and the Growth CTA is again the link `Start free trial`

#### Scenario: Visual baselines
- **GIVEN** the committed baselines under `tests/browser/pricing-renderer.spec.ts-snapshots`
- **WHEN** the responsive visual tests run without `--update-snapshots`
- **THEN** they pass unchanged

### Requirement: Current selection messages
`req~current-selection-i18n~1`
The catalogs `enUS` and `esES` SHALL define `pricing.currentPlanBadge`, `pricing.currentPlanCta`, `pricing.upgradeTo`, `pricing.downgradeTo` and `pricing.currentAddOn` with the texts of design.md, "i18n keys".

Needs: impl, utest

#### Scenario: English and Spanish texts
- **GIVEN** `enUS` and `esES` imported from `src/core/index.ts`
- **WHEN** the test reads the five keys
- **THEN** `enUS` has `'Your plan'`, `'Current plan'`, `'Upgrade to {plan}'`, `'Downgrade to {plan}'` and `'Current'`
- **AND** `esES` has `'Tu plan'`, `'Plan actual'`, `'Mejorar a {plan}'`, `'Bajar a {plan}'` and `'Actual'`

### Requirement: React prop for the current selection
`req~current-selection-react~1`
The `PricingRendererSharedProps` type of `src/react/index.ts` SHALL declare an optional `currentSelection` prop of type `Partial<PricingSelection>`.

Needs: impl, utest

#### Scenario: Type through the compiler API
- **GIVEN** a snippet that creates `<PricingRenderer yaml={source} currentSelection={{ planId: 'growth' }} />` and one with `currentSelection={42}`
- **WHEN** a unit test type-checks both snippets with the TypeScript compiler API
- **THEN** the first reports no error and the second reports an error

### Requirement: Manifest lists the current selection
`req~current-selection-manifest~1`
The published `custom-elements.json` SHALL describe in the `PricingRendererElement` declaration a field `currentSelection` with type text `Partial<PricingSelection> | undefined`.

Needs: impl, utest

#### Scenario: Manifest entry
- **GIVEN** `custom-elements.json` parsed as JSON
- **WHEN** the test reads the members of the `PricingRendererElement` declaration
- **THEN** a member has `kind: 'field'`, `name: 'currentSelection'` and that type text
