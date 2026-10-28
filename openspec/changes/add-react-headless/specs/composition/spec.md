## ADDED Requirements

### Requirement: Slots property

`req~slots-property~1`
The `<pricing-renderer>` element SHALL accept a `slots` property of type `readonly PricingSlotName[] | undefined`, with `PricingSlotName` being `'plan-cta' | 'summary-actions' | 'loading' | 'error'`, and no attribute.

Needs: impl, utest

#### Scenario: Attribute is not read

- **GIVEN** a new element: a `<pricing-renderer>` given `pricing` Acme (`tests/fixtures/acme-pricing.yml` normalized, plans `starter`, `growth`, `enterprise`), `locale: 'en-US'` and the properties of the scenario, appended to `document.body` in a browser test; a unit test instead builds it in node without a document, runs its `reload()` with `requestUpdate` stubbed and `dispatchEvent` replaced by a recorder, and reads markup, child nodes and parts from the flattened `render()` output; every scenario of this capability uses "a new element" in this sense
- **WHEN** the host calls `element.setAttribute('slots', 'plan-cta')` and the next update completes
- **THEN** `element.slots` is `undefined` and no `[data-pr-slot]` exists

### Requirement: Markup without slots

`req~slots-default-markup~1`
WHILE `slots` is `undefined`, empty or holds no known slot name, the element SHALL render the markup it renders without the property.

Needs: impl, utest

#### Scenario: Empty and unknown lists

- **GIVEN** a new element without `slots`, where the test stores `innerHTML` once it is ready
- **WHEN** the host sets `slots` to `[]`, then to `['footer']`, each time after the next update completes
- **THEN** `innerHTML` equals the stored string both times, no `[data-pr-slot]` exists, and each plan card has one `[data-pr-part="cta"]`

#### Scenario: Unknown names next to known ones

- **GIVEN** a new element with `slots` `['footer', 'plan-cta']`
- **WHEN** it is ready
- **THEN** it renders the plan slot nodes of "Plan CTA slot nodes" and no `[data-pr-slot="footer"]`

### Requirement: Slots value that is not an array

`req~slots-not-array~1`
IF `slots` holds a value that is not an array, THEN the element SHALL render as it renders with `slots` `undefined`.

Needs: impl, utest

#### Scenario: Null, string, number and array-like

- **GIVEN** a new element without `slots` and a `pricing-slots-change` listener that records details, where the test stores `innerHTML` once it is ready
- **WHEN** the host sets `slots`, from untyped code, to `null`, then to `'plan-cta'`, then to `3`, then to `{ 0: 'plan-cta', length: 1 }`, each time followed by a completed update
- **THEN** after each update `innerHTML` equals the stored string, no `[data-pr-slot]` exists and each plan card has one `[data-pr-part="cta"]`
- **AND** no detail is recorded and no error is thrown or logged

### Requirement: Plan CTA slot nodes

`req~slot-plan-cta~1`
WHILE `slots` includes `'plan-cta'` and `ctaEnabled` is true, the element SHALL render in each plan card, in place of its CTA, one `div` with `data-pr-slot="plan-cta"`, `data-pr-part="plan-cta-slot"`, `data-plan-id` set to the plan id and no child node rendered by the element.

Needs: impl, utest

#### Scenario: Three plan slots

- **GIVEN** a new element with `slots` `['plan-cta']`
- **WHEN** it is ready
- **THEN** the `data-plan-id` values of `[data-pr-slot="plan-cta"]` in document order are `starter`, `growth`, `enterprise`, each node sits in its plan's card with `childNodes.length` 0, and no `[data-pr-part="cta"]` exists

#### Scenario: CTAs disabled

- **GIVEN** a new element with `slots` `['plan-cta']` and `ctaEnabled` `false`
- **WHEN** it is ready
- **THEN** no `[data-pr-slot="plan-cta"]` and no `[data-pr-part="cta"]` exist

### Requirement: Plan slot nodes belong to one plan

`req~slot-plan-cta-keyed~1`
WHEN the plan shown at a card position changes, the element SHALL render a new plan slot node at that position instead of reusing the node of the previous plan.

Needs: impl, utest

#### Scenario: Pricing without Starter

- **GIVEN** a new element with `slots` `['plan-cta']`, where the test stores the `starter` slot node and appends a `span` with the text `S` to it
- **WHEN** the host sets `pricing` to Acme without the plan `starter` and the next update completes
- **THEN** the stored node has `isConnected` `false`, the slot nodes have `data-plan-id` `growth` and `enterprise`, and no element in the document has the text `S`

### Requirement: Summary actions slot node

`req~slot-summary-actions~1`
WHILE `slots` includes `'summary-actions'`, `ctaEnabled` is true and the summary is rendered, the element SHALL render in `.pr-summary`, outside every live region and in place of the summary action, one `div` with `data-pr-slot="summary-actions"`, `data-pr-part="summary-actions-slot"` and no child node rendered by the element.

Needs: impl, utest

#### Scenario: With and without a current plan

- **GIVEN** two new elements with `slots` `['summary-actions']`, the second with `currentSelection` `{ planId: 'growth' }`
- **WHEN** each is ready
- **THEN** each has one `[data-pr-slot="summary-actions"]` inside `.pr-summary`, whose `closest('[aria-live]:not([aria-live="off"])')` is `null`, and neither has a `[data-pr-part="summary-action"]`

### Requirement: Loading slot node

`req~slot-loading~1`
WHILE `slots` includes `'loading'` and the element renders its loading state (before the first load and while a load runs), the element SHALL render, inside the loading shell and in place of `.pr-skeleton`, one `div` with `data-pr-slot="loading"`, `data-pr-part="loading-slot"` and no child node rendered by the element.

Needs: impl, utest

#### Scenario: Before the first load

- **GIVEN** a `<pricing-renderer>` built without a document, with `slots` `['loading']`, `pricing` Acme and no load started yet
- **WHEN** a unit test flattens the template that `render()` returns
- **THEN** the markup holds one `section.pr-shell.pr-shell--loading` with its `h2.pr-sr-only` heading, one `data-pr-slot="loading"` node with no child markup and no `pr-skeleton`

#### Scenario: Slow source

- **GIVEN** a new element with `slots` `['loading']` and, in place of `pricing`, the `src` `https://pricing.example.test/acme.yml`, whose response the test holds back
- **WHEN** the first update completes
- **THEN** `.pr-shell--loading` keeps its `aria-labelledby` heading, holds one `[data-pr-slot="loading"]` and no `.pr-skeleton`

### Requirement: Error slot node

`req~slot-error~1`
WHILE `slots` includes `'error'` and the element is in the error state, the element SHALL render one `section.pr-shell.pr-error` with `role="alert"` whose only child is a `div` with `data-pr-slot="error"`, `data-pr-part="error-slot"` and no child node rendered by the element.

Needs: impl, utest

#### Scenario: Invalid YAML

- **GIVEN** a new element with `slots` `['error']` and `yaml` `'plans: ['` in place of `pricing`
- **WHEN** the update after the failed load completes
- **THEN** `.pr-error` has one child, `[data-pr-slot="error"]`, and no `h2`, `[data-pr-part="diagnostics"]` or `button`

### Requirement: Error slot node diagnostics

`req~slot-error-diagnostics~1`
WHILE `slots` includes `'error'` and the element is in the error state, the element SHALL set on the error slot node `data-diagnostics` to the `JSON.stringify` text of the failed load's diagnostics, in their order, each as `{ code, severity, message }` plus `path` when it is defined.

Needs: impl, utest

#### Scenario: Diagnostics of invalid YAML

- **GIVEN** a new element with `slots` `['error']`, `yaml` `'plans: ['` in place of `pricing` and a `pricing-diagnostic` listener that records details
- **WHEN** the update after the failed load completes
- **THEN** `JSON.parse(node.getAttribute('data-diagnostics'))` of the error slot node deeply equals the `diagnostics` of the first recorded detail, each mapped to its `code`, `severity`, `message` and `path`
- **AND** its first entry has `code` `PR_YAML_PARSE_ERROR`, `severity` `error` and `path` `'$'`, and no entry has a key other than these four

### Requirement: Slots change event

`req~slots-change-event~3`
WHEN an update completes and the connected slot nodes the element rendered itself differ, by identity or order, from those at the end of the previous update, or the `data-*` values of one of them differ from the last dispatch, the element SHALL dispatch one non-cancelable, bubbling, composed `pricing-slots-change` event whose `detail.nodes` lists these nodes in document order (`req~slots-change-event-own-nodes~1`).

Needs: impl, utest

#### Scenario: Ready, selection, removed

- **GIVEN** a new element with `slots` `['plan-cta']` and a `pricing-slots-change` listener that records details
- **WHEN** it is ready, then the user checks the Enterprise radio, then the host sets `slots` to `[]`
- **THEN** three details are recorded: the first `nodes` holds the three plan slot nodes, the second holds the same three nodes, the third `nodes` is `[]`

#### Scenario: Update without a change

- **GIVEN** a new element with `slots` `['plan-cta']` and the same listener, ready
- **WHEN** the host sets `slots` to a new array `['plan-cta']` and the next update completes
- **THEN** exactly one detail is recorded, the one of the ready update

#### Scenario: No slots, no event

- **GIVEN** a new element without `slots` and the same listener
- **WHEN** it is ready and the host reloads it
- **THEN** no detail is recorded

#### Scenario: Host node added to a slot node

- **GIVEN** a new element with `slots` `['plan-cta']` and the listener of "Ready, selection, removed", ready, after which the host appends to the Growth slot node a `div` with `data-pr-slot="plan-cta"` and `data-plan-id="growth"`
- **WHEN** the host sets `slots` to a new array `['plan-cta']` and the next update completes
- **THEN** exactly one detail is recorded, the one of the ready update

### Requirement: Slots change event lists own nodes only

`req~slots-change-event-own-nodes~1`
The element SHALL list in the `detail.nodes` of its `pricing-slots-change` events only the slot nodes it rendered itself, never a `[data-pr-slot]` node that the host or a nested `<pricing-renderer>` placed inside one of its slot nodes.

Needs: impl, utest

#### Scenario: Nested renderer and host node

- **GIVEN** a new element `outer` with `slots` `['plan-cta']` and a listener that records the `detail.nodes` of the `pricing-slots-change` events whose `target` is `outer`, ready, after which the host appends to `outer`'s Growth slot node a `div` with `data-pr-slot="plan-cta"` and `data-plan-id="growth"` and a nested `<pricing-renderer>` with `pricing` Acme, `locale: 'en-US'` and `slots` `['plan-cta']`, and waits until the nested element is ready
- **WHEN** the user checks the Enterprise radio whose `closest('pricing-renderer')` is `outer`
- **THEN** the last recorded `nodes` are the three plan slot nodes that `outer` rendered, with `data-plan-id` `starter`, `growth` and `enterprise` in that order
- **AND** neither the host `div` nor a slot node of the nested element is among the recorded `nodes` of any event

### Requirement: Summary slot event on selection changes

`req~slots-change-event-summary~1`
WHEN an update completes while a summary slot node is connected and the selection in effect or its resolved prices differ structurally from those of the last dispatch, the element SHALL dispatch the `pricing-slots-change` event.

Needs: impl, utest

#### Scenario: Selection changes

- **GIVEN** a new element with `slots` `['summary-actions']` and a `pricing-slots-change` listener that records details, ready
- **WHEN** the user checks the Enterprise radio
- **THEN** a second detail is recorded whose `nodes` holds the summary slot node

#### Scenario: Nothing changes

- **GIVEN** the same element, after the second detail
- **WHEN** the host sets `slots` to a new equal array and the next update completes
- **THEN** no further detail is recorded

### Requirement: Plan slot node context attributes

`req~slot-plan-cta-context~1`
WHILE `slots` includes `'plan-cta'`, the element SHALL set on each plan slot node, next to `data-plan-id`, the attributes `data-plan-name`, `data-label` and `data-href` (the safe expanded link, absent for a button), `data-relation` (absent without a current plan), `data-selected` (`'true'` or `'false'`), and `data-current` and `data-pending` (`'true'` or absent), with the values of the plan's built-in CTA and card.

Needs: impl, utest

#### Scenario: Values follow the state

- **GIVEN** a new element with `slots` `['plan-cta']`
- **WHEN** it is ready
- **THEN** the Growth slot node has `data-plan-name` `Growth`, `data-label` `Start free trial`, `data-href` `https://example.com/signup?plan=growth`, `data-selected` `false` and no `data-relation`, `data-current` or `data-pending`
- **WHEN** the user checks the Enterprise radio
- **THEN** the Enterprise slot node has `data-selected` `true`

#### Scenario: Current plan and pending action

- **GIVEN** a new element with `slots` `['plan-cta']`, `currentSelection` `{ planId: 'starter' }` and `pendingActionId` `'start-growth'`
- **WHEN** it is ready
- **THEN** the Starter slot node has `data-current` `true`, `data-relation` `current` and `data-label` `Current plan`
- **AND** the Growth slot node has `data-relation` `upgrade`, `data-label` `Upgrade to Growth` and `data-pending` `true`

### Requirement: Summary slot node context attributes

`req~slot-summary-actions-context~1`
WHILE `slots` includes `'summary-actions'`, the element SHALL set on the summary slot node `data-relation` (the relation of the selection in effect to the current plan, absent without one) and `data-pending` (`'true'` while any `pendingActionId` is set, whatever action it names, else absent; like the built-in summary action's `aria-disabled`, not its own-id `data-pending`).

Needs: impl, utest

#### Scenario: Relation and pending

- **GIVEN** a new element with `slots` `['summary-actions']`, `currentSelection` `{ planId: 'starter' }` and `pendingActionId` `'start-growth'`, ready
- **WHEN** the user checks the Growth radio
- **THEN** the summary slot node has `data-relation` `upgrade` and `data-pending` `true`, although `'start-growth'` is a plan action id and not the summary action's id `review-change`

#### Scenario: Neither

- **GIVEN** a new element with `slots` `['summary-actions']`
- **WHEN** it is ready
- **THEN** the summary slot node has neither attribute

### Requirement: Plan slot nodes report any pending action

`req~slot-plan-cta-any-pending~1`
WHILE `slots` includes `'plan-cta'` and `pendingActionId` is set, whatever action it names, the element SHALL set `data-any-pending` to `'true'` on every plan slot node, the state in which every built-in plan CTA has `aria-disabled` `true`; without `pendingActionId` the attribute is absent.

Needs: impl, utest

#### Scenario: Pending plan action

- **GIVEN** a new element with `slots` `['plan-cta']` and `pendingActionId` `'start-growth'`
- **WHEN** it is ready
- **THEN** the Starter, Growth and Enterprise slot nodes each have `data-any-pending` `true`
- **AND** only the Growth slot node has `data-pending` `true`

#### Scenario: Nothing pending

- **GIVEN** a new element with `slots` `['plan-cta']` and no `pendingActionId`
- **WHEN** it is ready
- **THEN** no plan slot node has a `data-any-pending` attribute

### Requirement: Trigger a plan action

`req~trigger-plan-action~1`
WHEN the host calls `triggerPlanAction(planId)` with the id of a plan card the element renders while `ctaEnabled` is true, the element SHALL dispatch the `pricing-action` that activating that plan's built-in CTA dispatches and return the result of `dispatchEvent`.

Needs: impl, utest

#### Scenario: Same detail as a click

- **GIVEN** two new elements with `currentSelection` `{ planId: 'growth' }` and a `pricing-action` listener on each that records details, the first with `slots` `['plan-cta']`, the second's listener calling `event.preventDefault()` so the Enterprise link does not navigate
- **WHEN** the host calls `first.triggerPlanAction('enterprise')` and the user clicks the Enterprise CTA of the second
- **THEN** the call returns `true` and the two recorded details are deeply equal, with `relation` `'upgrade'` and `source` `'plan'`

### Requirement: Ignored plan action triggers

`req~trigger-plan-action-guard~1`
IF `triggerPlanAction(planId)` is called while `pendingActionId` is set, while `ctaEnabled` is false, with an id that is not a rendered plan card's id or for a plan whose built-in CTA is disabled, THEN the element SHALL return `false` without dispatching a `pricing-action`.

Needs: impl, utest

#### Scenario: Four ignored calls

- **GIVEN** four new elements with a `pricing-action` listener that counts events: one with `pendingActionId` `'start-growth'`, one with `ctaEnabled` `false`, one plain, one with `currentSelection` `{ planId: 'growth' }`
- **WHEN** the host calls `triggerPlanAction('growth')` on the first, second and fourth and `triggerPlanAction('legacy')` on the third
- **THEN** each call returns `false` and the listener counted 0 events

### Requirement: React render props request slots

`req~react-render-props-slots~1`
The `PricingRenderer` wrapper SHALL set the element's `slots` to the names of the render props given as functions, in the order `plan-cta` (`renderPlanCta`), `summary-actions` (`renderSummaryActions`), `loading` (`renderLoading`), `error` (`renderError`), or to `undefined` when none is given, as computed by the function `slotNamesOf(props)` that `src/react/slots.ts` exports.

Needs: impl, utest

#### Scenario: Slot names from props

- **GIVEN** the function `slotNamesOf` imported from `src/react/slots.ts` in node
- **WHEN** a unit test calls it with `{ renderError: fn, renderPlanCta: fn }`, with `{ renderLoading: 'x', renderSummaryActions: undefined }` and with `{}`
- **THEN** the results are `['plan-cta', 'error']`, `undefined` and `undefined`

#### Scenario: Two props, then none

- **GIVEN** the `@lit/react` mock of `tests/unit/react-style-prop.test.ts`, which records the props the underlying component receives
- **WHEN** a unit test renders `<PricingRenderer yaml={source} renderError={fn} renderPlanCta={fn} />` with `renderToString`, then `<PricingRenderer yaml={source} />`
- **THEN** the recorded `slots` are `['plan-cta', 'error']`, then `undefined`

### Requirement: React portals into slot nodes

`req~react-slot-portals~1`
WHEN a `pricing-slots-change` event reports slot nodes, the `PricingRenderer` wrapper SHALL render into each reported node the output of its render prop, through a portal keyed by the plan id for plan nodes and by the slot name otherwise, and no portal into a node that is no longer reported.

Needs: impl, utest

#### Scenario: Custom plan CTA

- **GIVEN** `<PricingRenderer pricing={acme} locale="en-US" renderPlanCta={(c) => <a href={'/buy/' + c.planId}>Buy {c.planName}</a>} />` mounted on the client, with `acme` the normalized Acme
- **WHEN** the element is ready
- **THEN** the Growth card's `[data-pr-slot="plan-cta"]` holds one link with `href` `/buy/growth`, and the other cards hold only their own plan's link

### Requirement: React slot nodes read on attach

`req~react-slots-attach-read~1`
The `PricingRenderer` wrapper SHALL listen for `pricing-slots-change` through the `createComponent` events map and, in a layout effect when its element attaches, take `currentSlotNodes(element)` of `src/react/slots.ts` (the `[data-pr-slot]` nodes of `element.querySelectorAll` that `acceptedSlotNodes` keeps, in document order) as its slot nodes and `element.resolvedState` as the summary state.

Needs: impl, utest

#### Scenario: Slot nodes read by the helper

- **GIVEN** in node, a stand-in element `own` whose `querySelectorAll` records its selector and returns `[p, q, r]`, all with `isConnected` `true`: `p` with `dataset` `{ prSlot: 'plan-cta', planId: 'starter' }` and `r` with `dataset` `{ prSlot: 'summary-actions' }`, each with a `parentElement` whose `closest` returns `own`, and `q` with `dataset` `{ prSlot: 'plan-cta', planId: 'growth' }` and a `parentElement` whose `closest` returns a stand-in nested element; this is the state after an event that fired before the listener existed, which a browser test cannot set up because React attaches the listener before the element's first update completes
- **WHEN** a unit test calls `currentSlotNodes(own)`
- **THEN** the result is `[p, r]` and the recorded selector is `'[data-pr-slot]'`

#### Scenario: Render prop given after the first event

- **GIVEN** `<PricingRenderer pricing={acme} locale="en-US" renderSummaryActions={() => <button>Pay</button>} />` mounted on the client, ready, after its first `pricing-slots-change` event
- **WHEN** the host renders it again with `renderPlanCta={(c) => <a href={'/buy/' + c.planId}>Buy {c.planName}</a>}` added and the next update completes
- **THEN** each plan slot node holds one link, whose `href` is `/buy/` followed by that node's `data-plan-id`, and the summary slot node still holds the `Pay` button

#### Scenario: Summary state on attach

- **GIVEN** `<PricingRenderer pricing={acme} locale="en-US" renderSummaryActions={fn} />` mounted on the client, with a `fn` that records contexts
- **WHEN** the element is ready
- **THEN** the last recorded context's `selection` and `resolved` deeply equal the `selection` and `resolved` of the element's `resolvedState` read after ready, with `selection.planId` `starter`, whether the attach read or an event gave the summary node

### Requirement: Slot events of other elements

`req~react-slots-event-target~1`
IF a `pricing-slots-change` event reaches the `PricingRenderer` wrapper with a `target` other than the wrapper's own element, THEN the wrapper SHALL ignore the event, which the function `acceptedSlotNodes(element, event)` exported by `src/react/slots.ts` reports by returning `undefined`.

Needs: impl, utest

#### Scenario: Event of a nested element

- **GIVEN** in node, a stand-in element `own`, a stand-in plan slot node `n` (`isConnected` `true`, `dataset` `{ prSlot: 'plan-cta', planId: 'growth' }` and a `parentElement` whose `closest` returns `own`) and an event `{ target: other, detail: { nodes: [n] } }` with `other` a second stand-in element
- **WHEN** a unit test calls `acceptedSlotNodes(own, event)`
- **THEN** the result is `undefined`

#### Scenario: Own event

- **GIVEN** the stand-ins of "Event of a nested element"
- **WHEN** a unit test calls `acceptedSlotNodes(own, { target: own, detail: { nodes: [n] } })`
- **THEN** the result is `[n]`

### Requirement: Slot node filter

`req~react-slot-node-accept~2`
IF a node of `detail.nodes` is not connected, has a `data-pr-slot` that is not a `PricingSlotName`, is a `plan-cta` node with an empty or missing `data-plan-id`, or has no `parentElement` or one whose `closest('pricing-renderer, [data-pr-slot]')` is not the wrapper's element, THEN the `PricingRenderer` wrapper SHALL render no portal into it; `acceptedSlotNodes(element, event)` leaves it out, the other nodes keeping their order.

Needs: impl, utest

#### Scenario: Foreign, detached and unknown nodes

- **GIVEN** in node, a stand-in element `own`, a second stand-in element `other`, and the stand-in nodes `a` (`dataset` `{ prSlot: 'plan-cta', planId: 'starter' }`), `b` (the same dataset), `c` (the same dataset, `isConnected` `false`), `d` (`dataset` `{ prSlot: 'footer' }`), `e` (`dataset` `{ prSlot: 'plan-cta' }`) and `f` (`dataset` `{ prSlot: 'summary-actions' }`), every node but `c` with `isConnected` `true`, and every node but `b` with a `parentElement` whose `closest` returns `own`, `b` with one whose `closest` returns `other`
- **WHEN** a unit test calls `acceptedSlotNodes(own, { target: own, detail: { nodes: [b, a, c, d, e, f] } })`
- **THEN** the result is `[a, f]`

#### Scenario: Slot node of a nested renderer

- **GIVEN** the stand-ins `own` and `n` of "Event of a nested element", a stand-in element `nested` standing for a `<pricing-renderer>` inside `own`'s Growth slot node, a stand-in plan slot node `g` (`isConnected` `true`, `dataset` `{ prSlot: 'plan-cta', planId: 'growth' }`) with a `parentElement` whose `closest` records its selector and returns `nested`, and a stand-in plan slot node `h` with the dataset of `g`, `isConnected` `true` and `parentElement` `null`
- **WHEN** a unit test calls `acceptedSlotNodes(own, { target: own, detail: { nodes: [g, h, n] } })`
- **THEN** the result is `[n]` and the selector recorded by `g`'s `parentElement` is `'pricing-renderer, [data-pr-slot]'`

### Requirement: Plan context read from the slot node

`req~react-plan-context-reader~1`
The function `planCtaContextOf(element, node)` of `src/react/slots.ts` SHALL read the context from the node: `planId`, `planName`, `label`, `href` from `data-plan-id`, `data-plan-name`, `data-label`, a safe `data-href`; `selected`, `current`, `pending` as whether `data-selected`, `data-current`, `data-pending` are `'true'`; `relation` from a `data-relation` that is a `SelectionRelation`, else `undefined`.

Needs: impl, utest

#### Scenario: Values of a plan node

- **GIVEN** in node, a stand-in plan node with `dataset` `{ prSlot: 'plan-cta', planId: 'growth', planName: 'Growth', label: 'Upgrade to Growth', href: 'https://example.com/signup?plan=growth', relation: 'upgrade', selected: 'false', pending: 'true' }`
- **WHEN** a unit test calls `planCtaContextOf(element, node)` with a stand-in element
- **THEN** the context has `planId` `'growth'`, `planName` `'Growth'`, `label` `'Upgrade to Growth'`, `href` `'https://example.com/signup?plan=growth'`, `relation` `'upgrade'`, `selected` `false`, `current` `false` and `pending` `true`

#### Scenario: Unknown relation

- **GIVEN** the node of "Values of a plan node" with `relation` `'sideways'` and no `pending`
- **WHEN** a unit test calls `planCtaContextOf(element, node)`
- **THEN** the context has `relation` `undefined` and `pending` `false`

### Requirement: Any pending action in the plan context

`req~react-plan-context-any-pending~1`
The function `planCtaContextOf(element, node)` of `src/react/slots.ts` SHALL return the field `anyPending` as whether the node's `data-any-pending` is `'true'`, so that a render-prop CTA can disable itself while any action is pending, as the built-in CTAs do.

Needs: impl, utest

#### Scenario: Another plan's action is pending

- **GIVEN** in node, a stand-in plan node with `dataset` `{ prSlot: 'plan-cta', planId: 'starter', planName: 'Starter', label: 'Get started', selected: 'true', anyPending: 'true' }`
- **WHEN** a unit test calls `planCtaContextOf(element, node)` with a stand-in element
- **THEN** the context has `anyPending` `true` and `pending` `false`

#### Scenario: Nothing pending

- **GIVEN** the node of "Unknown relation", which has neither `pending` nor `anyPending`
- **WHEN** a unit test calls `planCtaContextOf(element, node)`
- **THEN** the context has `anyPending` `false`

### Requirement: Unsafe link in a plan slot node

`req~react-slot-href-safe~1`
IF a plan slot node has no `data-href` or `isSafeLink` of the `pricing-renderer` core returns `false` for its `data-href`, THEN `planCtaContextOf(element, node)` SHALL return the context with `href` `undefined`.

Needs: impl, utest

#### Scenario: Script link

- **GIVEN** in node, the node of "Values of a plan node" with `href` `'javascript:alert(1)'`
- **WHEN** a unit test calls `planCtaContextOf(element, node)`
- **THEN** the context has `href` `undefined` and `label` `'Upgrade to Growth'`

#### Scenario: No link

- **GIVEN** the node of "Values of a plan node" without `href`
- **WHEN** a unit test calls `planCtaContextOf(element, node)`
- **THEN** the context has `href` `undefined`

### Requirement: Plan context trigger

`req~react-plan-context-trigger~1`
WHEN the host calls the `trigger()` of a context that `planCtaContextOf(element, node)` returned, the `trigger()` function SHALL call `element.triggerPlanAction` once with the node's `data-plan-id` and return that call's result.

Needs: impl, utest

#### Scenario: Trigger forwards to the element

- **GIVEN** in node, a stand-in element whose `triggerPlanAction` records its argument and returns `false`, and a plan node with `dataset` `{ prSlot: 'plan-cta', planId: 'enterprise' }`
- **WHEN** a unit test calls `planCtaContextOf(element, node).trigger()`
- **THEN** the call returns `false` and the recorded arguments are `['enterprise']`

### Requirement: Summary context read from the slot node

`req~react-summary-context-reader~1`
The function `summaryActionsContextOf(node, state)` exported by `src/react/slots.ts` SHALL return `{ selection, resolved, relation, pending }`: `selection` and `resolved` of `state` (the `resolvedState` the wrapper read when the event fired), `relation` from `data-relation` as for a plan node, and `pending` as whether `data-pending` is `'true'`, that is whether any `pendingActionId` is set.

Needs: impl, utest

#### Scenario: Summary node values

- **GIVEN** in node, a stand-in summary node with `dataset` `{ prSlot: 'summary-actions', relation: 'upgrade', pending: 'true' }` and `state` `{ selection: s, resolved: r }`
- **WHEN** a unit test calls `summaryActionsContextOf(node, state)`
- **THEN** the context is `{ selection: s, resolved: r, relation: 'upgrade', pending: true }`, with `s` and `r` the same objects

#### Scenario: No current plan

- **GIVEN** a stand-in summary node with `dataset` `{ prSlot: 'summary-actions' }` and the same `state`
- **WHEN** a unit test calls `summaryActionsContextOf(node, state)`
- **THEN** the context has `relation` `undefined` and `pending` `false`

### Requirement: Error context reload

`req~react-error-context-reload~1`
The function `errorContextOf(element, diagnostics)` exported by `src/react/slots.ts` SHALL return `{ diagnostics, reload }`, with `diagnostics` the given array and `reload` a function that calls `element.reload()` once per call.

Needs: impl, utest

#### Scenario: Reload calls the element

- **GIVEN** in node, a stand-in element whose `reload` counts its calls and a diagnostics array `d` with one `PR_SOURCE_HTTP_ERROR` error
- **WHEN** a unit test calls `errorContextOf(element, d)` and then its `reload()` twice
- **THEN** the context's `diagnostics` is `d` and the count is 2

### Requirement: Error diagnostics read from the slot node

`req~react-error-diagnostics-reader~1`
The function `errorDiagnosticsOf(node)` exported by `src/react/slots.ts` SHALL return, each as `{ code, severity, message, path? }`, the entries of the JSON array in the node's `data-diagnostics` that have a string `code` and `message`, a `severity` of `'error'`, `'warning'` or `'info'` and a string or no `path`, and `[]` when the attribute is missing or is not a JSON array.

Needs: impl, utest

#### Scenario: Diagnostics of a failed load

- **GIVEN** in node, a stand-in error node with `dataset` `{ prSlot: 'error', diagnostics: '[{"code":"PR_SOURCE_HTTP_ERROR","severity":"error","message":"Pricing request failed with HTTP 404.","extra":1},{"code":1,"severity":"error","message":"m"},{"code":"PR_YAML_PARSE_ERROR","severity":"fatal","message":"m"},{"code":"PR_YAML_PARSE_ERROR","severity":"error","message":"m","path":"$"}]' }`
- **WHEN** a unit test calls `errorDiagnosticsOf(node)`
- **THEN** the result deeply equals `[{ code: 'PR_SOURCE_HTTP_ERROR', severity: 'error', message: 'Pricing request failed with HTTP 404.' }, { code: 'PR_YAML_PARSE_ERROR', severity: 'error', message: 'm', path: '$' }]`

#### Scenario: Missing or malformed attribute

- **GIVEN** in node, three stand-in error nodes with `dataset` `{ prSlot: 'error' }`, `{ prSlot: 'error', diagnostics: '{' }` and `{ prSlot: 'error', diagnostics: '{"code":"PR_YAML_PARSE_ERROR"}' }`
- **WHEN** a unit test calls `errorDiagnosticsOf` with each
- **THEN** each result is `[]` and no call throws

### Requirement: Error diagnostics come from the slot node only

`req~react-error-diagnostics-source~1`
The `PricingRenderer` wrapper SHALL take the `diagnostics` of the `renderError` context only from `errorDiagnosticsOf` of the reported error slot node, never from `pricing-diagnostic` events, which a refused `applySelection` also fires without changing the failed load's diagnostics.

Needs: impl, utest

#### Scenario: Refused applySelection in the error state

- **GIVEN** `<PricingRenderer ref={ref} yaml="plans: [" renderError={fn} />` mounted on the client, with a `fn` that records contexts and returns `null`, after the failed load
- **WHEN** the host calls `ref.current.applySelection({ planId: 'growth' })`, which returns `applied` `false` and fires a `pricing-diagnostic` event with the code `PR_SELECTION_NOT_READY`, and then renders the wrapper again with a new recording `renderError` function
- **THEN** the `diagnostics` of the last recorded context deeply equal those of the first context recorded after the failed load, with the code `PR_YAML_PARSE_ERROR` first, and no recorded context has an entry with the code `PR_SELECTION_NOT_READY`

### Requirement: Plan CTA render context

`req~react-plan-cta-context~2`
The `PricingRenderer` wrapper SHALL call `renderPlanCta` with the plan context of the element's last completed update: `planId`, `planName`, `selected`, `current`, `relation` (`undefined` without a current plan), `label` and `href` of the built-in CTA, `pending` (`pendingActionId` is its action id), `anyPending` (any `pendingActionId` set) and `trigger()`, calling `triggerPlanAction(planId)` and returning its result.

Needs: impl, utest

#### Scenario: Selected and pending

- **GIVEN** the wrapper of "Custom plan CTA" with a render prop that records contexts
- **WHEN** the user checks the Enterprise radio, then the host renders with `pendingActionId` `'start-growth'`
- **THEN** the last Enterprise context has `selected` `true`, `current` `false` and `relation` `undefined`, and the last Growth context has `pending` `true`, `label` `'Start free trial'` and `href` `'https://example.com/signup?plan=growth'`
- **AND** the last Enterprise context has `pending` `false` and `anyPending` `true`, and the last Growth context has `anyPending` `true`
- **AND** calling the Enterprise context's `trigger()` returns `false` and dispatches no `pricing-action`

#### Scenario: Current plan

- **GIVEN** the wrapper of "Custom plan CTA" with `currentSelection` `{ planId: 'starter' }` and a render prop that records contexts
- **WHEN** the element is ready
- **THEN** the last Starter context has `current` `true`, `relation` `'current'` and `label` `'Current plan'`, and the last Growth context has `relation` `'upgrade'` and `label` `'Upgrade to Growth'`

#### Scenario: Current plan set after ready

- **GIVEN** the wrapper of "Custom plan CTA", ready, with a render prop that records contexts
- **WHEN** the host renders again with `currentSelection` `{ planId: 'starter' }`
- **THEN** the last Starter context has `current` `true`, `relation` `'current'` and `label` `'Current plan'`, and the last Growth context has `relation` `'upgrade'`

### Requirement: Summary, loading and error render props

`req~react-other-slot-contexts~1`
The `PricingRenderer` wrapper SHALL call `renderSummaryActions` with `{ selection, resolved, relation, pending }` (the selection in effect, its resolved prices, its relation to the current plan or `undefined`, and whether any `pendingActionId` is set, whichever action it names), `renderLoading` with no argument and `renderError` with `{ diagnostics, reload }` (the failed load's diagnostics and a function calling the element's `reload()`).

Needs: impl, utest

#### Scenario: Summary after a plan change

- **GIVEN** `<PricingRenderer pricing={acme} locale="en-US" renderSummaryActions={fn} />` mounted on the client with a `fn` that records contexts, ready
- **WHEN** the user checks the Enterprise radio
- **THEN** the last context has the `selection` and `resolved` of the Enterprise selection, read from `resolvedState` when the event fired

#### Scenario: Error with retry

- **GIVEN** `<PricingRenderer src="https://pricing.example.test/missing.yml" renderError={(e) => <button onClick={e.reload}>{e.diagnostics.length} errors</button>} />` mounted on the client, and a test route that answers every request for that absolute URL with status 404 and the header `access-control-allow-origin: *` and counts the requests (a relative `src` fails with `PR_SOURCE_URL_INVALID` before any request, `src/yaml/load.ts:131`)
- **WHEN** the load fails and the user clicks the button
- **THEN** the button text starts with a number of at least 1 and the route has counted 2 requests

### Requirement: Render props wait for the client

`req~react-slots-client-only~1`
The `PricingRenderer` wrapper SHALL call no render prop and render no portal during server rendering and during the first client render.

Needs: impl, utest

#### Scenario: Server output

- **GIVEN** the four render props as functions that count their calls
- **WHEN** a test renders `<PricingRenderer yaml={source} ... />` with `renderToString`
- **THEN** the output holds the `pricing-renderer` tag, no output of a render prop, and every count is 0

#### Scenario: During the first client render

- **GIVEN** the four render props as functions that count their calls and return a `span` with `data-rp`, the `renderToString` markup of `<PricingRenderer yaml={source} ... />` with them in a container of a browser page, and a sibling component rendered after the wrapper that copies the four counts and the container's `[data-rp]` count in a layout effect
- **WHEN** the test hydrates the container with `hydrateRoot`, the same tree and an `onRecoverableError` that records errors
- **THEN** the values the sibling copied after the first client render are all 0, so no portal content exists before the first effect of the wrapper
- **AND** no recoverable error is recorded, the first client render matching the server markup

### Requirement: Composition types and manifest

`req~composition-types-manifest~1`
The package SHALL export the types `PricingSlotName` and `PricingSlotsChangeDetail` from `pricing-renderer/element` and `pricing-renderer/react`, and `PricingPlanCtaContext`, `PricingSummaryActionsContext` and `PricingErrorContext` from `pricing-renderer/react`, map `pricing-slots-change` in `HTMLElementEventMap`, and list `slots`, `triggerPlanAction` and `pricing-slots-change` in the `PricingRendererElement` entry of `custom-elements.json`.

Needs: impl, utest

#### Scenario: Types and manifest entries

- **GIVEN** a snippet that imports the five types from `src/react/index.ts`, imports `PricingSlotName` and `PricingSlotsChangeDetail` from `src/element/index.ts` under the aliases `ElementSlotName` and `ElementSlotsChangeDetail`, declares `const names: readonly ElementSlotName[] = ['plan-cta'] satisfies readonly PricingSlotName[]` and types `element.addEventListener('pricing-slots-change', (e) => { const detail: ElementSlotsChangeDetail = e.detail; return detail.nodes; })`, and `custom-elements.json` parsed as JSON
- **WHEN** a unit test type-checks the snippet and reads the `PricingRendererElement` declaration
- **THEN** the snippet has no error, a field `slots` has no `attribute`, a method `triggerPlanAction` returns `boolean`, and an event `pricing-slots-change` has type `CustomEvent<PricingSlotsChangeDetail>`
