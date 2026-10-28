## ADDED Requirements

### Requirement: Headless entry loads no element code

`req~react-headless-entry~1`
The entry `pricing-renderer/react/headless` SHALL import, directly or transitively, no module of `lit` or `@lit/react`, so that importing it loads no Lit code and defines no custom element.

Needs: impl, utest

#### Scenario: Import in node with a registry spy

- **GIVEN** a node test with a global `customElements` stub whose `define` is a spy
- **WHEN** `src/react/headless.ts` is imported
- **THEN** `define` was not called
- **AND** the static import graph of `src/react/headless.ts` contains no `lit`, `@lit/react` or `src/element/define.ts` module

### Requirement: React entry re-exports the headless entry

`req~react-entry-reexports-headless~1`
The entry `pricing-renderer/react` SHALL export every runtime export of `pricing-renderer/react/headless` under the same name and with the same identity.

Needs: impl, utest

#### Scenario: Same provider and hooks

- **GIVEN** the namespaces of `src/react/index.ts` (with `@lit/react` mocked) and `src/react/headless.ts`
- **WHEN** every key of the headless namespace is read from both
- **THEN** each pair is `Object.is` equal

### Requirement: React API common to 18.2 and 19

`req~react-hooks-common-api~1`
The modules under `src/react` SHALL use only React and React DOM APIs that both 18.2 and 19 provide, which excludes `use` and `ref` read as a prop.

Needs: impl, utest

#### Scenario: Static scan

- **GIVEN** the sources of `src/react/**/*.ts`
- **WHEN** their named imports from `react` and `react-dom` and the `React.<name>` and `ReactDOM.<name>` accesses of namespace imports are listed
- **THEN** none is `use`, and every listed name is in the allowed list of design.md, "D9. SSR, React 18 and 19"

### Requirement: No new peer dependency

`req~react-headless-no-new-peer~1`
The package SHALL keep `peerDependencies` equal to `react` and `react-dom` at `^18.2.0 || ^19.0.0`, both optional, with the headless entry and the portals of this change in place.

Needs: impl, utest

#### Scenario: Package manifest

- **GIVEN** `package.json`
- **WHEN** `peerDependencies` and `peerDependenciesMeta` are read
- **THEN** they list exactly `react` and `react-dom`, both with range `^18.2.0 || ^19.0.0` and `optional: true`

### Requirement: Shared source load, exactly one source

`req~load-source-one-source~1`
IF the input of `loadPricingSource(input, options)` from `pricing-renderer/yaml` has none or more than one of a defined `pricing`, a defined `yaml` and a non-empty `src`, THEN it SHALL return, without a promise and without loading, a failed result whose only diagnostic is `PR_SOURCE_MISSING` (none) or `PR_SOURCE_CONFLICT` (more than one) with severity `error` at path `$`.

Needs: impl, utest

#### Scenario: Missing and conflicting sources

- **GIVEN** a `loadPricing` spy
- **WHEN** `loadPricingSource({ src: '' }, { loadPricing })` and `loadPricingSource({ yaml: 'x', src: 'https://example.com/p.yml' }, { loadPricing })` are called
- **THEN** the results are not promises and their only diagnostic codes are `PR_SOURCE_MISSING` and `PR_SOURCE_CONFLICT`
- **AND** the spy was not called

### Requirement: Shared source load, the one source

`req~load-source-result~1`
WHEN the input of `loadPricingSource` has exactly one source, it SHALL return `normalizePricing(pricing, normalizeOptions)` or `parsePricingYaml(yaml, { normalize })` synchronously, or a promise of `loadPricingFromUrl(src, { ...request, loadPricing, normalize, signal })`, as `reload()` of the element does today.

Needs: impl, utest

#### Scenario: YAML now, URL later

- **GIVEN** the acme YAML text and a `loadPricing` that resolves it
- **WHEN** `loadPricingSource({ yaml })` and `loadPricingSource({ src: 'https://example.com/acme.yml' }, { loadPricing, signal })` are called
- **THEN** the first result is not a promise and its `value.saasName` is `Acme Cloud`
- **AND** the second is a promise whose value has the same `saasName`, and `loadPricing` got the `signal`

### Requirement: Inline sources resolve during render

`req~use-pricing-source-render~1`
WHEN `usePricingSource` gets `pricing`, `yaml` or no valid single source, the hook SHALL apply the `loadPricingSource` result in that same render, on the server too, by the rules of `req~use-pricing-source-success~1` and `req~use-pricing-source-failure-keeps-pricing~1`.

Needs: impl, utest

#### Scenario: Server render of the acme YAML

- **GIVEN** a component that renders `status` and `pricing.saasName` of `usePricingSource({ yaml: acmeYaml })`
- **WHEN** it is rendered with `react-dom/server` `renderToString`
- **THEN** the output contains `ready` and `Acme Cloud`
- **AND** with `usePricingSource({})` it contains `error` and the diagnostics hold `PR_SOURCE_MISSING`

### Requirement: Stable source inputs keep the result

`req~use-pricing-source-stable~1`
WHILE `pricing`, `request` and `normalizeOptions` are structurally equal and `yaml`, `src` and `loadPricing` are identical to the previous render, `usePricingSource` SHALL return the same `pricing` object and start no new load.

Needs: impl, utest

#### Scenario: Inline objects on each render

- **GIVEN** a source store fed twice with a fresh but equal `pricing` object, then twice with `src` and a fresh but equal `request` object
- **WHEN** the results are compared
- **THEN** both `pricing` reads are `Object.is` equal and `loadPricing` was called once

### Requirement: URL source loads in an effect

`req~use-pricing-source-src-effect~1`
WHEN `usePricingSource` gets `src`, the hook SHALL return `status` `loading`, with the pricing of the last successful load or undefined before the first, until the load settles, the load being started only from an effect.

Needs: impl, utest

#### Scenario: Nothing loads on the server

- **GIVEN** a `loadPricing` spy and a component that renders `status` of `usePricingSource({ src: 'https://example.com/acme.yml', loadPricing })`
- **WHEN** it is rendered with `renderToString`
- **THEN** the output contains `loading` and the spy was not called

### Requirement: Cleanup aborts the load

`req~use-pricing-source-abort~1`
WHEN the effect of a `src` load is cleaned up (a new source, an unmount or the StrictMode re-run), `usePricingSource` SHALL abort that load's `signal` and ignore its result.

Needs: impl, utest

#### Scenario: StrictMode mount, cleanup, mount

- **GIVEN** a source store and a `loadPricing` that records each `signal` and resolves the acme YAML after a tick
- **WHEN** the store starts, stops and starts again, and both loads settle
- **THEN** the first `signal` is aborted, the second is not, and the state was set once to `ready`

### Requirement: Reload loads the current source again

`req~use-pricing-source-reload~1`
WHEN `reload()` is called, `usePricingSource` SHALL abort the load in flight and load the current source again, so only the last load's result is applied.

Needs: impl, utest

#### Scenario: Out-of-order results

- **GIVEN** a `src` source whose first load resolves after the second
- **WHEN** `reload()` is called while the first load is pending
- **THEN** the returned pricing is the one of the second load

### Requirement: A successful load

`req~use-pricing-source-success~1`
WHEN a load of `usePricingSource` gives a result with a value, the hook SHALL return `status` `ready`, that value as `pricing` and the result's `diagnostics`.

Needs: impl, utest

#### Scenario: URL load settles

- **GIVEN** a source store with `src: 'https://example.com/acme.yml'` and a `loadPricing` that resolves the acme YAML
- **WHEN** the load settles
- **THEN** `status` is `ready` and `pricing.saasName` is `Acme Cloud`

### Requirement: A failed load keeps the last pricing

`req~use-pricing-source-failure-keeps-pricing~1`
IF a load of `usePricingSource` gives a result without a value, THEN the hook SHALL return its `diagnostics` with the `pricing` of the last successful load and `status` `ready`, or with `pricing` undefined and `status` `error` when no load succeeded.

Needs: impl, utest

#### Scenario: Network error on reload

- **GIVEN** a source that loaded the acme pricing and a `loadPricing` that now rejects
- **WHEN** `reload()` settles
- **THEN** `status` is `ready`, `pricing.saasName` is `Acme Cloud`, and `diagnostics` holds `PR_SOURCE_LOAD_FAILED`

#### Scenario: Invalid YAML after a valid one

- **GIVEN** a source store fed the acme YAML and then the text `plans: [`
- **WHEN** the second result is applied
- **THEN** `status` is `ready` and `pricing.saasName` is `Acme Cloud`
- **AND** a store fed only `plans: [` has `status` `error` and `pricing` undefined

### Requirement: Selection state of the hook

`req~use-pricing-selection-state~1`
The hook `usePricingSelection(pricing, options)` SHALL return as `selection` the reconciled `selectionInEffect` of the held selection (`options.selection`, else its own), or undefined while `pricing` is undefined.

Needs: impl, utest

#### Scenario: Server render with defaults

- **GIVEN** a component that renders `selection.planId` of `usePricingSelection(acme, {})`
- **WHEN** it is rendered with `renderToString`
- **THEN** the output contains `starter`

### Requirement: View model of the hook

`req~use-pricing-selection-view-model~1`
The hook `usePricingSelection` SHALL return as `viewModel` the `createPricingViewModel` result of `selection` with the options `locale`, `mode`, `visibility`, `messages`, `presentation` and `expressionOptions`, after one price stabilizer per pricing, and as `resolved` its `resolved` field.

Needs: impl, utest

#### Scenario: Options reach the view model

- **GIVEN** `usePricingSelection(acme, { locale: 'es-ES', mode: 'catalog', visibility: 'all' })`
- **WHEN** it is rendered with `renderToString`
- **THEN** `resolved.subtotal` is 20 and the view model has `locale` `es-ES`, `mode` `catalog` and `visibility` `all`

### Requirement: Changes go through the core

`req~use-pricing-selection-changes~1`
WHEN a change member is called, `usePricingSelection` SHALL compute the next selection from the not reconciled `selectionInEffect` of the held selection with the member's core step of design.md D7 (`planSelectionChange`, `selectionWithVariable`, `selectionWithAddOnQuantity` or a copy), then reconcile it.

Needs: impl, utest

#### Scenario: Quantity above the maximum

- **GIVEN** a selection store on the acme fixture with plan `growth`
- **WHEN** `setAddOnQuantity('extraStorage', 40)` is called
- **THEN** `selection.addOns.extraStorage` deeply equals `{ selected: true, quantity: 10 }`

#### Scenario: Unreconciled controlled selection

- **GIVEN** a selection store on the acme fixture with the controlled selection plan `starter`, `extraStorage` and `prioritySuccess` selected
- **WHEN** `toggleAddOn('extraStorage', false)` is called
- **THEN** `pending.removeIds` is `['prioritySuccess']`, as the element gives for the same selection

### Requirement: Selection changes are reported

`req~use-pricing-selection-notify~1`
WHEN a member of `usePricingSelection` produces a next selection, the hook SHALL call `options.onSelectionChange` once with `{ selection, resolved }` of that next selection, `resolved` stabilized.

Needs: impl, utest

#### Scenario: Plan change at once

- **GIVEN** a selection store on the acme fixture with an `onSelectionChange` spy
- **WHEN** `selectPlan('growth')` is called
- **THEN** the spy was called once and its `selection.planId` is `growth`

### Requirement: Controlled selection is never stored

`req~use-pricing-selection-controlled~1`
WHILE `options.selection` is defined, `usePricingSelection` SHALL derive its state from `options.selection` only, keeping no next selection of its own.

Needs: impl, utest

#### Scenario: Host ignores the change

- **GIVEN** a selection store with `selection` plan `starter` and an `onSelectionChange` spy that does nothing
- **WHEN** `selectPlan('growth')` is called
- **THEN** the spy got plan `growth` and the store's `selection.planId` stays `starter`

### Requirement: Uncontrolled selection is held

`req~use-pricing-selection-uncontrolled~1`
WHILE `options.selection` is undefined, `usePricingSelection` SHALL hold each next selection as its own selection.

Needs: impl, utest

#### Scenario: Plan change kept

- **GIVEN** a selection store on the acme fixture without `selection`
- **WHEN** `selectPlan('growth')` is called
- **THEN** the store's `selection.planId` is `growth`

### Requirement: A new pricing restarts the selection

`req~use-pricing-selection-pricing-change~1`
WHEN `usePricingSelection` gets a `pricing` object that differs from the previous one, the hook SHALL set its own selection to the reconciled `mergeSelection(pricing, options.defaultSelection)`, reset its price stabilizer and drop `pending`.

Needs: impl, utest

#### Scenario: A new pricing

- **GIVEN** a selection store on the acme fixture with `defaultSelection` `{ planId: 'growth' }`, after `selectPlan('enterprise')` and with a pending change
- **WHEN** a new acme pricing object is set
- **THEN** `selection.planId` is `growth` and `pending` is undefined

### Requirement: Pending change, confirm and cancel

`req~use-pricing-selection-pending~1`
WHEN `selectPlan` or `toggleAddOn` yields `{ kind: 'confirm', pending }`, `usePricingSelection` SHALL return that change as `pending` and keep the selection until `confirm()` applies it with `applySelectionChange` or `cancel()` drops it.

Needs: impl, utest

#### Scenario: Confirm a dependency

- **GIVEN** a selection store on the acme fixture with plan `growth`
- **WHEN** `toggleAddOn('prioritySuccess', true)` is called
- **THEN** `pending.addIds` is `['extraStorage']` and no add-on is selected
- **WHEN** `confirm()` is called
- **THEN** `pending` is undefined and `extraStorage` and `prioritySuccess` are selected
- **AND** after the same toggle and `cancel()`, no add-on is selected

### Requirement: Apply a partial selection

`req~use-pricing-selection-apply~1`
WHEN `apply(input)` is called, `usePricingSelection` SHALL drop `pending`, treat the selection of `applySelectionInput(pricing, selection, input)` as the next selection, and return that result.

Needs: impl, utest

#### Scenario: Unknown plan

- **GIVEN** a selection store on the acme fixture with plan `growth`
- **WHEN** `apply({ planId: 'legacy' })` is called
- **THEN** the result's only diagnostic code is `PR_SELECTION_UNKNOWN_PLAN` and `selection.planId` stays `growth`

### Requirement: Current plan and relations

`req~use-pricing-selection-current~1`
WHERE `options.currentSelection` is given, `usePricingSelection` SHALL return as `current` the current context the element derives from it (plan id and current add-on ids) and a `relationOf(planId)` that returns `planRelation(pricing, current.planId, planId)`, both giving undefined while there is no current context.

Needs: impl, utest

#### Scenario: Customer on growth

- **GIVEN** a selection store on the acme fixture with `currentSelection` `{ planId: 'growth' }`
- **WHEN** `relationOf` is called with `enterprise`, `starter` and `growth`
- **THEN** it returns `upgrade`, `downgrade` and `current`, and `current.planId` is `growth`

### Requirement: Review from the hooks

`req~use-pricing-selection-compare~1`
WHEN `compareWithCurrent()` is called while `current` is defined, `usePricingSelection` SHALL return `compareSelections({ before: { pricing, selection: currentSelection }, after: { pricing, selection }, expression })`, and undefined otherwise.

Needs: impl, utest

#### Scenario: Upgrade review

- **GIVEN** a selection store on the acme fixture with `currentSelection` `{ planId: 'growth' }` and plan `enterprise` selected
- **WHEN** `compareWithCurrent()` is called
- **THEN** the result's `relation` is `upgrade`
- **AND** a type-check snippet `<PricingChangeReview comparison={result} />` compiles

### Requirement: Renderer state follows the element events

`req~renderer-state-events~1`
WHEN the element of `ref.current` dispatches `pricing-ready`, or `pricing-selection-change` after a `pricing-ready` seen since the last attach, `usePricingRendererState(ref)` SHALL replace its snapshot by a new object with the event's `selection` and `resolved`, and the `pricing` of the last `pricing-ready`.

Needs: impl, utest

#### Scenario: Ready, then a selection change

- **GIVEN** a renderer state store subscribed to a Node `EventTarget`
- **WHEN** `pricing-ready` with the acme pricing and then `pricing-selection-change` with plan `growth` are dispatched
- **THEN** the snapshot's `pricing.saasName` is `Acme Cloud` and its `selection.planId` is `growth`
- **AND** on a fresh store, a `pricing-selection-change` before any `pricing-ready` leaves the snapshot `undefined`

### Requirement: Renderer state snapshot is cached

`req~renderer-state-cached-snapshot~1`
The hook `usePricingRendererState` SHALL return the identical snapshot object from every `getSnapshot` call between two updates of the snapshot.

Needs: impl, utest

#### Scenario: Repeated reads

- **GIVEN** a renderer state store after one `pricing-ready` event
- **WHEN** `getSnapshot()` is called 100 times
- **THEN** every result is `Object.is` equal to the first

### Requirement: Renderer state on the server

`req~renderer-state-server-snapshot~1`
The hook `usePricingRendererState` SHALL return `undefined` from `getServerSnapshot` and while `ref.current` is `null`.

Needs: impl, utest

#### Scenario: Server render

- **GIVEN** a component that renders `String(usePricingRendererState(ref))` with an empty ref
- **WHEN** it is rendered with `renderToString`
- **THEN** the output contains `undefined`

### Requirement: Renderer state follows a new ref target

`req~renderer-state-ref-change~1`
WHEN `ref.current` points to another element than at the last subscription, `usePricingRendererState` SHALL remove its listeners from the old element, add them to the new one and start again from an `undefined` snapshot.

Needs: impl, utest

#### Scenario: Element replaced

- **GIVEN** a renderer state store subscribed to target A and then moved to target B
- **WHEN** `pricing-selection-change` is dispatched on A and then `pricing-ready` on B
- **THEN** the event on A does not change the snapshot and the event on B does

### Requirement: Listeners attached in the commit

`req~renderer-state-early-listen~1`
WHEN the hook and the element of `ref.current` are committed in the same render, `usePricingRendererState` SHALL attach its listeners synchronously during that commit, so that the element's first `pricing-ready`, dispatched from its first update after the commit, reaches the snapshot.

Needs: impl, utest

#### Scenario: Ready right after the commit

- **GIVEN** a renderer state store and a Node `EventTarget` that queues a `pricing-ready` with the acme pricing as a microtask
- **WHEN** the store attaches to the target in the same synchronous call and the microtask runs
- **THEN** the snapshot's `pricing.saasName` is `Acme Cloud`

#### Scenario: Attach from the layout effect

- **GIVEN** `react` mocked so that `useLayoutEffect` records its callbacks and `useEffect` and the `subscribe` of `useSyncExternalStore` record theirs apart, and a ref whose target has an `addEventListener` spy
- **WHEN** `usePricingRendererState(ref)` renders on the client and only the recorded layout callbacks run
- **THEN** the spy was called for `pricing-ready` and `pricing-selection-change`

### Requirement: Apply through the renderer state

`req~renderer-state-apply~1`
WHEN `applySelection(input)` of the returned state is called, `usePricingRendererState` SHALL call `applySelection(input)` of the element, replace the snapshot with the result's `selection` and `resolved` when `applied` is true, and return that result.

Needs: impl, utest

#### Scenario: Silent apply seen by the hook

- **GIVEN** a renderer state store on an element stand-in whose `applySelection` returns `applied: true` with plan `enterprise` and dispatches no event
- **WHEN** `state.applySelection({ planId: 'enterprise' })` is called
- **THEN** the snapshot's `selection.planId` is `enterprise` and a subscriber was notified once
