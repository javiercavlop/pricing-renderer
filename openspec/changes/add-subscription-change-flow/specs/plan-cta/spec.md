## ADDED Requirements

### Requirement: Pending action property
`req~cta-pending-property~1`
The `<pricing-renderer>` element SHALL accept a `pendingActionId` property of type `string | undefined`, also set by the attribute `pending-action-id`.

Needs: impl, utest

#### Scenario: Attribute and property
- **GIVEN** the demo page
- **WHEN** the host calls `element.setAttribute('pending-action-id', 'start-growth')`
- **THEN** `element.pendingActionId` is `'start-growth'`

### Requirement: Pending CTA state
`req~cta-pending-state~1`
WHILE `pendingActionId` equals the action id of a rendered plan CTA or of the summary action, the element SHALL render that control with `aria-busy="true"`, `data-pending="true"`, `aria-disabled="true"` and one child `[data-pr-part="cta-pending"]` with the text of `pricing.pending`.

Needs: impl, utest

#### Scenario: Growth trial pending
- **GIVEN** the demo page
- **WHEN** the host sets `pendingActionId` to `'start-growth'` and the next update completes
- **THEN** the Growth CTA has `aria-busy="true"`, `data-pending="true"` and `aria-disabled="true"`, and its `[data-pr-part="cta-pending"]` has the text `Processing…`

#### Scenario: Summary action pending
- **GIVEN** the demo page where the host called `applySelection(C)`, set `currentSelection` to C and the user checked the Enterprise radio
- **WHEN** the host sets `pendingActionId` to `'review-change'` and the next update completes
- **THEN** `[data-pr-part="summary-action"]` has `aria-busy="true"`, `data-pending="true"` and `aria-disabled="true"`, and its `[data-pr-part="cta-pending"]` has the text `Processing…`
- **AND** no plan CTA has `aria-busy`

#### Scenario: Cleared
- **GIVEN** the demo page with `pendingActionId` `'start-growth'`
- **WHEN** the host sets `pendingActionId` to `undefined` and the next update completes
- **THEN** no CTA has `aria-busy`, `data-pending` or `aria-disabled`, and no `[data-pr-part="cta-pending"]` exists

### Requirement: Other CTAs are disabled while pending
`req~cta-pending-others~1`
WHILE `pendingActionId` is set, the element SHALL render every plan CTA and the summary action with `aria-disabled="true"`.

Needs: impl, utest

#### Scenario: Starter and Enterprise
- **GIVEN** the demo page with `currentSelection` C and `pendingActionId` `'review-change'`
- **WHEN** the next update completes
- **THEN** the Starter CTA, the Enterprise CTA and `[data-pr-part="summary-action"]` have `aria-disabled="true"`

### Requirement: No action while pending
`req~cta-pending-no-event~1`
IF the user activates a plan CTA or the summary action while `pendingActionId` is set, THEN the element SHALL ignore the activation, dispatching no `pricing-action` and preventing the navigation of a link CTA.

Needs: impl, utest

#### Scenario: Clicks during a pending action
- **GIVEN** the demo page with `pendingActionId` `'start-growth'` and a `pricing-action` listener that counts events
- **WHEN** the test clicks the Starter CTA and the Growth CTA link with `click({ force: true })`, because `aria-disabled` controls fail Playwright's actionability check
- **THEN** the listener counted 0 events and the page URL is unchanged

#### Scenario: Enabled again
- **GIVEN** the same page after the host set `pendingActionId` to `undefined`
- **WHEN** the user clicks the Starter CTA
- **THEN** the listener counts 1 event with `actionId` `'start-starter'`

### Requirement: Focus stays on the pending CTA
`req~cta-pending-focus~1`
WHEN `pendingActionId` is set while a CTA has focus, the element SHALL keep focus on that CTA.

Needs: impl, utest

#### Scenario: Keyboard activation
- **GIVEN** the demo page with a `pricing-action` listener that calls `event.preventDefault()` and sets `element.pendingActionId = event.detail.actionId`
- **WHEN** the user focuses the Growth CTA, presses Enter and the next update completes
- **THEN** `document.activeElement` is the Growth CTA and it has `aria-busy="true"`

### Requirement: Configured relation labels
`req~cta-relation-labels-config~1`
WHERE a CTA of `presentation.ctas` has `labels`, the element SHALL keep its `upgrade`, `downgrade`, `current` and `contactSales` entries that are strings and use them in place of the default label of that relation.

Needs: impl, utest

#### Scenario: Custom labels on the demo page
- **GIVEN** the demo page where the host set `presentation.ctas` to `[{ id: 'start-starter', label: 'Start with Starter', planId: 'starter', labels: { downgrade: 'Move to Starter' } }, { id: 'start-growth', label: 'Start free trial', planId: 'growth', labels: { current: 'Your current plan' } }, { id: 'contact-enterprise', label: 'Contact sales', planId: 'enterprise', href: 'https://example.com/contact', labels: { upgrade: 'Talk to us about Enterprise' } }]`
- **WHEN** the host sets `currentSelection` to C and the next update completes
- **THEN** the CTA texts are `Move to Starter`, `Your current plan` and `Talk to us about Enterprise`

#### Scenario: Label that is not a string
- **GIVEN** the demo page where the host set `presentation.ctas` to `[{ id: 'start-starter', label: 'Start with Starter', planId: 'starter', labels: { downgrade: 42 } }]`
- **WHEN** the host sets `currentSelection` to C and the next update completes
- **THEN** the Starter CTA text is `Downgrade to Starter`

### Requirement: Contact sales for quote plans
`req~cta-contact-sales~1`
WHILE `currentSelection.planId` is a plan id of the loaded pricing, the element SHALL label the CTA of any other plan whose resolved price is a label or an error with `labels.contactSales` of its configured CTA, or else the text of `pricing.contactSales`.

Needs: impl, utest

#### Scenario: Enterprise without a price
- **GIVEN** a new element with `pricing` PQ and `currentSelection` `{ planId: 'basic' }`
- **WHEN** it is ready and the next update completes
- **THEN** the Basic CTA text is `Current plan`, the Pro CTA text is `Upgrade to Pro` and the Enterprise CTA text is `Contact sales` with `data-relation="upgrade"`

### Requirement: Summary action
`req~cta-summary-action~1`
WHILE `ctaEnabled` is true and `currentSelection.planId` is a plan id of the loaded pricing, the element SHALL render in `.pr-summary`, outside every live region, one `button[data-pr-part="summary-action"]` with the action id `review-change` and the text of `pricing.reviewChangeCta` with `{total}` set to the formatted subtotal.

Needs: impl, utest

#### Scenario: Contract applied, then Enterprise picked
- **GIVEN** the demo page where the host called `applySelection(C)` and set `currentSelection` to C
- **WHEN** the user checks the Enterprise radio and the next update completes
- **THEN** `[data-pr-part="summary-action"]` has the text `Review change (€75)`, no `disabled` attribute, and `closest('[aria-live]:not([aria-live="off"])')` on it is `null`

### Requirement: Summary action requires a quote
`req~cta-summary-action-quote~1`
WHILE the summary action is rendered and the resolved pricing of the selection in effect requires a quote, the element SHALL give it the action id `contact-sales` and the text of `pricing.contactSales`.

Needs: impl, utest

#### Scenario: Enterprise on PQ
- **GIVEN** a new element with `pricing` PQ and `currentSelection` `{ planId: 'basic' }`
- **WHEN** the user checks the Enterprise radio and the next update completes
- **THEN** `[data-pr-part="summary-action"]` has the text `Contact sales` and no `disabled` attribute

### Requirement: Summary action without a change
`req~cta-summary-action-current~1`
WHILE the summary action is rendered and the relation between the current side and the selection in effect is `'current'`, the element SHALL render it with the `disabled` attribute.

Needs: impl, utest

#### Scenario: Contract unchanged
- **GIVEN** the demo page where the host called `applySelection(C)` and set `currentSelection` to C
- **WHEN** the next update completes
- **THEN** `[data-pr-part="summary-action"]` has the `disabled` attribute and the text `Review change (€80)`

### Requirement: Summary action event
`req~cta-summary-action-event~1`
WHEN the user activates an enabled summary action, the element SHALL dispatch a cancelable `pricing-action` with its action id, `source: 'summary'`, the relation, the `planId` of the selection in effect and the existing `selection` and `resolved` fields.

Needs: impl, utest

#### Scenario: Review an upgrade
- **GIVEN** the page of the scenario "Contract applied, then Enterprise picked" with a `pricing-action` listener that records details
- **WHEN** the user clicks `[data-pr-part="summary-action"]`
- **THEN** one detail is recorded with `actionId` `'review-change'`, `source` `'summary'`, `relation` `'upgrade'`, `planId` `'enterprise'` and `resolved.subtotal` 75, and the event had `cancelable` `true`

#### Scenario: Contact sales
- **GIVEN** the element of the scenario "Enterprise on PQ" with the same listener
- **WHEN** the user clicks `[data-pr-part="summary-action"]`
- **THEN** one detail is recorded with `actionId` `'contact-sales'`, `source` `'summary'`, `relation` `'upgrade'` and `planId` `'enterprise'`

### Requirement: No summary action otherwise
`req~cta-summary-action-absent~1`
IF `ctaEnabled` is false or `currentSelection.planId` is not a plan id of the loaded pricing, THEN the element SHALL NOT render a summary action.

Needs: impl, utest

#### Scenario: Three pages without the action
- **GIVEN** the demo page without `currentSelection`, the demo page with `currentSelection` C and `ctaEnabled` `false`, and the demo page with `currentSelection` `{ planId: 'legacy' }`
- **WHEN** each next update completes
- **THEN** none has a `[data-pr-part="summary-action"]`

### Requirement: Plan id in CTA links
`req~cta-href-template~1`
The element SHALL replace every `{planId}` in the `href` of a plan CTA with `encodeURIComponent` of that plan's id before it applies `isSafeLink` and before it puts the `href` in the `pricing-action` detail.

Needs: impl, utest

#### Scenario: Growth signup link
- **GIVEN** the demo page where the host set `presentation.ctas` to `[{ id: 'start-growth', label: 'Start free trial', planId: 'growth', href: 'https://example.com/signup?plan={planId}' }]` and a `pricing-action` listener that calls `preventDefault()` and records details
- **WHEN** the user clicks the Growth CTA
- **THEN** the CTA's `href` attribute is `https://example.com/signup?plan=growth` and the recorded `detail.href` is the same

#### Scenario: Reserved characters
- **GIVEN** a new element with `pricing` PS and `presentation.ctas` `[{ id: 'go', label: 'Go', planId: 'pro plus/x', href: '/checkout/{planId}?again={planId}' }]`
- **WHEN** it is ready
- **THEN** the CTA of plan `pro plus/x` is a link with `href` `/checkout/pro%20plus%2Fx?again=pro%20plus%2Fx`

### Requirement: Unsafe expanded links
`req~cta-href-template-unsafe~1`
IF the expanded `href` of a plan CTA fails `isSafeLink`, THEN the element SHALL render that CTA as a `button` without `href`.

Needs: impl, utest

#### Scenario: Plan id that looks like a script URL
- **GIVEN** a new element with `pricing` PS and `presentation.ctas` `[{ id: 'bad', label: 'Bad', planId: 'javascript:alert(1)', href: '{planId}' }]`
- **WHEN** it is ready
- **THEN** the CTA of plan `javascript:alert(1)` is a `BUTTON` with the text `Bad` and no `href` attribute

### Requirement: Relation in plan CTA events
`req~cta-event-relation~1`
WHILE `currentSelection.planId` is a plan id of the loaded pricing, the element SHALL set `relation` to the plan's relation and `source` to `'plan'` in the `pricing-action` detail of a plan CTA.

Needs: impl, utest

#### Scenario: Upgrade and downgrade clicks
- **GIVEN** the demo page with `currentSelection` C and a `pricing-action` listener that calls `preventDefault()` and records details
- **WHEN** the user clicks the Enterprise CTA, then the Starter CTA
- **THEN** the first detail has `actionId` `'contact-enterprise'`, `planId` `'enterprise'`, `href` `'https://example.com/contact'`, `relation` `'upgrade'` and `source` `'plan'`
- **AND** the second has `actionId` `'start-starter'`, `relation` `'downgrade'` and `source` `'plan'`

### Requirement: Event detail without a current plan
`req~cta-event-unchanged~1`
WHILE `currentSelection.planId` is not a plan id of the loaded pricing, the element SHALL dispatch plan CTA `pricing-action` details without `relation` and `source` keys.

Needs: impl, utest

#### Scenario: Default demo page
- **GIVEN** the demo page with a `pricing-action` listener that records details
- **WHEN** the user clicks the Starter CTA
- **THEN** `Object.keys(detail).sort()` equals `['actionId', 'planId', 'resolved', 'selection']`

### Requirement: CTA label types
`req~cta-types~1`
The core entry point SHALL export the types `SelectionRelation` and `PricingCtaLabels`, with `PricingCta` declaring the optional field `labels?: PricingCtaLabels` and `PricingCtaLabels` declaring the optional string fields `upgrade`, `downgrade`, `current` and `contactSales`.

Needs: impl, utest

#### Scenario: Types through the compiler API
- **GIVEN** a snippet that imports `PricingCta` from `src/core/index.ts` and builds one with `labels: { upgrade: 'Up', contactSales: 'Talk to us' }`
- **AND** a second snippet that builds one with `labels: { sidegrade: 'Across' }`
- **WHEN** a unit test type-checks both snippets with the TypeScript compiler API
- **THEN** the first reports no error and the second reports an error

### Requirement: Action event detail types
`req~cta-event-types~1`
The type `PricingActionDetail` SHALL declare the optional fields `relation?: SelectionRelation` and `source?: 'plan' | 'summary'`, with `SelectionRelation` re-exported next to it by `src/element/index.ts` and `src/react/index.ts`.

Needs: impl, utest

#### Scenario: Types through the compiler API
- **GIVEN** a snippet that imports `PricingActionDetail` and `SelectionRelation` from `src/react/index.ts` and assigns `detail.relation` to a `SelectionRelation | undefined` and `detail.source` to a `'plan' | 'summary' | undefined`
- **AND** a second snippet that builds a `PricingActionDetail` with `source: 'header'`
- **WHEN** a unit test type-checks both snippets with the TypeScript compiler API
- **THEN** the first reports no error and the second reports error TS2322

### Requirement: CTA messages
`req~cta-i18n~1`
The catalogs `enUS` and `esES` SHALL define `pricing.reviewChangeCta` and `pricing.pending` with the texts of design.md, "i18n keys".

Needs: impl, utest

#### Scenario: English and Spanish texts
- **GIVEN** `enUS` and `esES` imported from `src/core/index.ts`
- **WHEN** the test reads the two keys
- **THEN** `enUS` has `'Review change ({total})'` and `'Processing…'`, and `esES` has `'Revisar cambio ({total})'` and `'Procesando…'`

### Requirement: React prop and manifest for the pending action
`req~cta-pending-react-manifest~1`
The package SHALL expose `pendingActionId` as an optional `string` prop of `PricingRendererSharedProps` and as a field with the attribute `pending-action-id` in the `PricingRendererElement` declaration of `custom-elements.json`.

Needs: impl, utest

#### Scenario: Prop type and manifest entry
- **GIVEN** a snippet with `<PricingRenderer yaml={source} pendingActionId="start-growth" />` and `custom-elements.json` parsed as JSON
- **WHEN** a unit test type-checks the snippet and reads the `PricingRendererElement` declaration
- **THEN** the snippet has no error, a member has `kind: 'field'`, `name: 'pendingActionId'` and type text `string | undefined`, and an attribute has `name: 'pending-action-id'` and `fieldName: 'pendingActionId'`
