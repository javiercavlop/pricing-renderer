## ADDED Requirements

### Requirement: Headless entry loads no element code

`req~react-headless-entry~1`
The entry `pricing-renderer/react/headless` SHALL import, directly or transitively, no module of `lit` or `@lit/react`, so that importing it loads no Lit code and defines no custom element.

Needs: impl, utest

#### Scenario: Import in node with a registry spy

- **GIVEN** a node test with a global `customElements` stub whose `define` is a spy
- **WHEN** `src/react/headless.ts` is imported
- **THEN** `define` was not called
- **AND** the runtime import graph of `src/react/headless.ts` contains no `lit`, `@lit/react` or `src/element/define.ts` module, where the graph follows every import and re-export declaration except `import type` and `export type` declarations (a declaration whose specifiers are all inline `type` specifiers is followed)

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
The modules under `src/react` SHALL use as runtime values only these APIs, which React 18.2 and 19 both provide: from `react` `createContext`, `useContext`, `useState`, `useRef`, `useMemo`, `useCallback`, `useEffect`, `useLayoutEffect`, `useSyncExternalStore`, `useId`, `forwardRef`, `createElement` and `Fragment`, and from `react-dom` `createPortal`; this excludes `use` and `ref` read as a prop.

Needs: impl, utest

#### Scenario: Static scan of runtime value uses

- **GIVEN** the sources of `src/react/**/*.ts`
- **WHEN** their named value imports from `react` and `react-dom` and the `React.<name>` and `ReactDOM.<name>` property accesses of namespace imports in value positions are listed, leaving out type-only imports and names in type positions such as `React.CSSProperties` in `src/react/index.ts`
- **THEN** none is `use`, and every listed name is in the list of the requirement

### Requirement: No new peer dependency

`req~react-headless-no-new-peer~1`
The package SHALL keep `peerDependencies` equal to `react` and `react-dom` at `^18.2.0 || ^19.0.0`, both optional, with the headless entry and the portals of this change in place.
This requirement is a regression guard: `package.json` meets it before this change, and its test keeps the slices of this change from adding a peer.

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

#### Scenario: Request passed as given

- **GIVEN** a `loadPricing` spy that resolves the acme YAML text
- **WHEN** `loadPricingSource({ src: 'https://example.com/acme.yml' }, { loadPricing, request: { maxBytes: -1 } })` settles
- **THEN** the spy's `request.maxBytes` is -1
- **AND** the result has no `value` and its diagnostics hold `PR_SOURCE_TOO_LARGE`

### Requirement: Source hook, request bounds

`req~load-source-request-bounds~1`
IF the `request` that `usePricingSource` or its store `createSourceStore()` holds after the provider and origin rules has a `maxBytes` that is not a positive finite number, or a `timeoutMs` that is not a positive finite number at most 2147483647, THEN the hook and the store SHALL pass `loadPricingSource` that field set to its default, 2097152 bytes or 15000 ms.
`loadPricingSource` and the element's `reload()` pass `request` as given.

Needs: impl, utest

#### Scenario: Invalid bounds fall back to the defaults

- **GIVEN** a `loadPricing` spy that resolves the acme YAML and `store = createSourceStore()` given `setInput({ src: 'https://example.com/acme.yml' }, { loadPricing, request: { maxBytes: -1, timeoutMs: Number.NaN } })`
- **WHEN** `store.start()` is called and the load settles
- **THEN** the spy's `request.maxBytes` is 2097152 and its `request.timeoutMs` is 15000
- **AND** `getSnapshot().pricing.saasName` is `Acme Cloud`

#### Scenario: Timeout above the timer limit

- **GIVEN** the same spy and a `createSourceStore()` given the same `src` with `request` `{ maxBytes: 0, timeoutMs: 2147483648 }`
- **WHEN** `start()` is called and the load settles
- **THEN** the spy's `request.maxBytes` is 2097152 and its `request.timeoutMs` is 15000
- **AND** on a new store given `request` `{ maxBytes: 4096, timeoutMs: 2147483647 }`, the spy's `request.maxBytes` is 4096 and its `request.timeoutMs` is 2147483647

#### Scenario: Provider bounds through the hook

- **GIVEN** the hook harness of design.md D7, with `useContext` returning a provider value whose `request` is `{ maxBytes: 0, timeoutMs: Number.POSITIVE_INFINITY }` and whose `loadPricing` is a spy that resolves the acme YAML
- **WHEN** `usePricingSource({ src: 'https://example.com/acme.yml' })` is called and its recorded effects run
- **THEN** the spy's `request.maxBytes` is 2097152 and its `request.timeoutMs` is 15000

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
WHILE `pricing`, `request` and `normalizeOptions` are structurally equal and `yaml`, `src` and `loadPricing` are identical to the previous render, `usePricingSource` and its store `createSourceStore()` SHALL return the same `pricing` object and start no new load.

Needs: impl, utest

#### Scenario: Inline objects on each render

- **GIVEN** `store = createSourceStore()` given `store.setInput({ pricing: p1 }, {})` and then `store.setInput({ pricing: p2 }, {})`, `p2` a fresh object structurally equal to `p1`
- **AND** a second `createSourceStore()` given `setInput({ src: 'https://example.com/acme.yml' }, { request: r1, loadPricing })` and `start()`, then `setInput` with a fresh `request` `r2` equal to `r1` and `start()` again
- **WHEN** the `getSnapshot().pricing` reads of the first store after each `setInput` are compared
- **THEN** both reads are `Object.is` equal and `loadPricing` was called once

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
WHEN the effect of a `src` load is cleaned up (a new source, an unmount or the StrictMode re-run), `usePricingSource` and its store `createSourceStore()` SHALL abort that load's `signal` and ignore its result.

Needs: impl, utest

#### Scenario: StrictMode mount, cleanup, mount

- **GIVEN** `store = createSourceStore()` given `setInput({ src: 'https://example.com/acme.yml' }, { loadPricing })`, a `loadPricing` that records each `signal` and resolves the acme YAML after a tick, and a listener added with `store.subscribe`
- **WHEN** `store.start()`, `store.stop()` and `store.start()` are called and both loads settle
- **THEN** the first `signal` is aborted and the second is not
- **AND** the listener saw `getSnapshot().status` `ready` exactly once

### Requirement: Reload loads the current source again

`req~use-pricing-source-reload~1`
WHEN `reload()` is called, `usePricingSource` and its store `createSourceStore()` SHALL abort the load in flight and load the current source again, so only the last load's result is applied.

Needs: impl, utest

#### Scenario: Out-of-order results

- **GIVEN** `store = createSourceStore()` given `setInput({ src: 'https://example.com/acme.yml' }, { loadPricing })` and `start()`, where the first `loadPricing` call resolves the acme YAML with `saasName` `First` after the second call resolves it with `saasName` `Second`
- **WHEN** `store.reload()` is called while the first load is pending and both loads settle
- **THEN** `getSnapshot().pricing.saasName` is `Second`

### Requirement: A changed source makes the load in flight stale

`req~use-pricing-source-stale-load~1`
WHEN `usePricingSource` or its store `createSourceStore()` gets a source input that differs from the held one while a `src` load is in flight, the hook and the store SHALL ignore that load's result when it settles, also when it settles before the effect cleanup aborts it.

Needs: impl, utest

#### Scenario: URL result after a switch to YAML

- **GIVEN** `store = createSourceStore()` given `setInput({ src: 'https://example.com/acme.yml' }, { loadPricing })` and `start()`, with a `loadPricing` whose promise the test resolves by hand with YAML whose `saasName` is `Remote`
- **WHEN** `store.setInput({ yaml: acmeYaml }, {})` is called and the `loadPricing` promise resolves before `store.stop()` is called
- **THEN** `getSnapshot().pricing.saasName` is `Acme Cloud` and `status` is `ready`

### Requirement: A successful load

`req~use-pricing-source-success~1`
WHEN a load of `usePricingSource` or its store `createSourceStore()` gives a result with a value, the hook SHALL return `status` `ready`, that value as `pricing` and the result's `diagnostics`.

Needs: impl, utest

#### Scenario: URL load settles

- **GIVEN** `store = createSourceStore()` given `setInput({ src: 'https://example.com/acme.yml' }, { loadPricing })` with a `loadPricing` that resolves the acme YAML
- **WHEN** `store.start()` is called and the load settles
- **THEN** `getSnapshot().status` is `ready` and `getSnapshot().pricing.saasName` is `Acme Cloud`

### Requirement: A failed load keeps the last pricing

`req~use-pricing-source-failure-keeps-pricing~1`
IF a load of `usePricingSource` or its store `createSourceStore()` gives a result without a value, THEN the hook and the store SHALL return its `diagnostics` with the `pricing` of the last successful load and `status` `ready`, or with `pricing` undefined and `status` `error` when no load succeeded.

Needs: impl, utest

#### Scenario: Network error on reload

- **GIVEN** a `createSourceStore()` that loaded the acme pricing from `src` after `start()`, and a `loadPricing` that now rejects
- **WHEN** `reload()` settles
- **THEN** `getSnapshot().status` is `ready`, `pricing.saasName` is `Acme Cloud`, and `diagnostics` holds `PR_SOURCE_LOAD_FAILED`

#### Scenario: Invalid YAML after a valid one

- **GIVEN** `store = createSourceStore()` given `setInput({ yaml: acmeYaml }, {})` and then `setInput({ yaml: 'plans: [' }, {})`
- **WHEN** `getSnapshot()` is read after the second `setInput`
- **THEN** `status` is `ready` and `pricing.saasName` is `Acme Cloud`
- **AND** a new `createSourceStore()` given only `setInput({ yaml: 'plans: [' }, {})` has `status` `error` and `pricing` undefined

### Requirement: Selection state of the hook

`req~use-pricing-selection-state~1`
The hook `usePricingSelection(pricing, options)` SHALL return as `selection` the reconciled `selectionInEffect` of the held selection (`options.selection`, else its own), or undefined while `pricing` is undefined.

Needs: impl, utest

#### Scenario: Server render with defaults

- **GIVEN** a component that renders `selection.planId` of `usePricingSelection(acme, {})`
- **WHEN** it is rendered with `renderToString`
- **THEN** the output contains `starter`

#### Scenario: No pricing, no selection

- **GIVEN** `store = createSelectionStore()` given `setInput(undefined, { defaultSelection: { planId: 'growth' } })`
- **WHEN** `getSnapshot()` is read
- **THEN** its `selection` is undefined
- **AND** a component that renders `String(usePricingSelection(undefined, {}).selection)` with `renderToString` outputs `undefined`

#### Scenario: Controlled selection in effect

- **GIVEN** `s` equal to `createDefaultSelection(acme)` except plan `growth` and `variables.seats` 40, and `store = createSelectionStore()` given `setInput(acme, { selection: s, defaultSelection: { planId: 'enterprise' }, variablesEnabled: false })`
- **WHEN** `getSnapshot()` is read
- **THEN** `selection.planId` is `growth`, from `options.selection` and not from `defaultSelection`
- **AND** `selection.variables.seats` is 5, the pricing's value, as `selectionInEffect` gives with `variablesEnabled` false

### Requirement: View model of the hook

`req~use-pricing-selection-view-model~2`
The hook `usePricingSelection` SHALL return as `viewModel` the `createPricingViewModel` result of `selection` with the options `locale`, `mode`, `visibility`, `messages`, `presentation` and `expressionOptions`, stabilized by the price stabilizer that its own store `createSelectionStore()` created for that hook instance alone and reset when `pricing` changed by identity, and as `resolved` its `resolved` field.

Needs: impl, utest

#### Scenario: Options reach the view model

- **GIVEN** `usePricingSelection(acme, { locale: 'es-ES', mode: 'catalog', visibility: 'all' })`
- **WHEN** it is rendered with `renderToString`
- **THEN** `resolved.subtotal` is 20 and the view model has `locale` `es-ES`, `mode` `catalog` and `visibility` `all`

#### Scenario: No price kept across server renders

- **GIVEN** one normalized pricing object `P`, the acme pricing with the `starter` price `rate() * #seats`, and a component that renders `viewModel.resolved.planPrices.starter.kind` of `usePricingSelection(P, { expressionOptions })`
- **WHEN** it is rendered with `renderToString` with `expressionOptions` `{ functions: { rate: () => 30 } }`, and then with a second `renderToString` call on the same `P` with `expressionOptions` `{}`
- **THEN** the first output contains `amount`
- **AND** the second output contains `error`, not `amount`

### Requirement: No shared state at module scope

`req~react-no-module-state~1`
The modules under `src/react` SHALL hold at module top level only the statement kinds that the scan below lists: import and export declarations of bindings, type, interface and function declarations, `const` declarations of a function, an arrow function or a call of `createContext`, `forwardRef` or `createComponent`, and one `displayName` and one client-check form, so that no state is shared between hook instances or server requests.

Needs: impl, utest

#### Scenario: Static scan of module scope

- **GIVEN** the sources of `src/react/**/*.ts`, parsed as text with the TypeScript compiler API, the test importing no module under `src/react` or calling `vi.resetModules()` before it does
- **WHEN** each top-level statement is classified
- **THEN** each is one of: the `'use client'` directive of the prologue; an `import` declaration, side-effect imports included; an `export` declaration that lists or re-exports bindings or types (`export { a }`, `export ... from`, `export type`), not `export default` or `export =`; a type alias or interface declaration; a function declaration that is not `export default`
- **AND** otherwise a `const` statement (with or without `export`) each of whose declarators is initialized with a function expression, an arrow function, or a call, type arguments allowed, of `createContext` or `forwardRef` imported from `react` (named import, or `React.<name>` of its namespace import) or of `createComponent` imported from `@lit/react`, a `createContext` argument containing no call or `new` expression
- **AND** otherwise `<X>.displayName = '<string literal>'`, `<X>` a top-level `const` of the same module, or `const useClientLayoutEffect = typeof document !== 'undefined' ? useLayoutEffect : useEffect`, both hooks imported from `react`
- **AND** `src/react/index.ts` as it is at the base of this change passes the scan

#### Scenario: Statements outside the allow-list

- **GIVEN** the scan of the scenario above, the test importing no module under `src/react` or calling `vi.resetModules()` before it does
- **WHEN** it classifies each of the module texts `export default {}`, `class A {}`, `enum E { A }`, `namespace N {}`, `let x = 1`, `var y = 1`, `const m = new Map()`, `const n = 1`, `const c = createContext(new Map())`, `const s = createSelectionStore()`, `PricingRenderer.cache = {}` and `register()`
- **THEN** each text fails the scan

### Requirement: Changes go through the core

`req~use-pricing-selection-changes~1`
WHEN a change member is called, `usePricingSelection` and `createSelectionStore()` SHALL reconcile its core step's result on the unreconciled `selectionInEffect` of the held selection: `selectPlan`, `toggleAddOn`: `planSelectionChange`; `setVariable`: `selectionWithVariable`; `setAddOnQuantity`: `selectionWithAddOnQuantity`; `setBillingPeriod`, `resetVariables`: a copy with a new `billingPeriod` or `pricing.variables`.

Needs: impl, utest

#### Scenario: Quantity above the maximum

- **GIVEN** `store = createSelectionStore()` given `setInput(acme, { defaultSelection: { planId: 'growth' } })`
- **WHEN** `store.setAddOnQuantity('extraStorage', 40)` is called
- **THEN** `getSnapshot().selection.addOns.extraStorage` deeply equals `{ selected: true, quantity: 10 }`

#### Scenario: Unreconciled controlled selection

- **GIVEN** `store = createSelectionStore()` given `setInput(acme, { selection })`, where `selection` has plan `starter` and `extraStorage` and `prioritySuccess` selected
- **WHEN** `store.toggleAddOn('extraStorage', false)` is called
- **THEN** `getSnapshot().pending.removeIds` is `['prioritySuccess']`, as the element gives for the same selection

#### Scenario: Variable through the core

- **GIVEN** `store = createSelectionStore()` given `setInput(acme, {})`
- **WHEN** `store.setVariable('seats', 12)` and then `store.setBillingPeriod('yearly')` are called
- **THEN** `getSnapshot().selection.variables.seats` is 12 and `selection.billingPeriod` is `yearly`

### Requirement: Selection changes are reported

`req~use-pricing-selection-notify~1`
WHEN a member of `usePricingSelection` or its store `createSelectionStore()` produces a next selection, the hook and the store SHALL call `options.onSelectionChange` once with `{ selection, resolved }` of that next selection, `resolved` stabilized.

Needs: impl, utest

#### Scenario: Plan change at once

- **GIVEN** `store = createSelectionStore()` given `setInput(acme, { onSelectionChange })` with an `onSelectionChange` spy
- **WHEN** `store.selectPlan('growth')` is called
- **THEN** the spy was called once and its `selection.planId` is `growth`

#### Scenario: Variable change

- **GIVEN** the same store and a reset spy
- **WHEN** `store.setVariable('seats', 12)` is called
- **THEN** the spy was called once and its `selection.variables.seats` is 12

#### Scenario: Equal selection reported, snapshot kept

- **GIVEN** `store = createSelectionStore()` given `setInput(acme, { onSelectionChange })` with an `onSelectionChange` spy, plan `starter` selected, a listener added with `store.subscribe`, and `before = store.getSnapshot()`
- **WHEN** `store.selectPlan('starter')` is called
- **THEN** the spy was called once with `selection.planId` `starter`, as the element dispatches for an equal selection
- **AND** `getSnapshot()` is `Object.is` equal to `before` and the listener was not called

#### Scenario: Confirm reports once, the pending step none

- **GIVEN** `store = createSelectionStore()` given `setInput(acme, { defaultSelection: { planId: 'growth' }, onSelectionChange })` with an `onSelectionChange` spy
- **WHEN** `store.toggleAddOn('prioritySuccess', true)` is called
- **THEN** the spy was not called
- **WHEN** `store.confirm()` is called
- **THEN** the spy was called once and its selection has `extraStorage` and `prioritySuccess` selected

#### Scenario: Apply reports

- **GIVEN** `store = createSelectionStore()` given `setInput(acme, { onSelectionChange })` with an `onSelectionChange` spy
- **WHEN** `store.apply({ planId: 'enterprise' })` is called
- **THEN** the spy was called once and its `selection.planId` is `enterprise`

### Requirement: Controlled selection is never stored

`req~use-pricing-selection-controlled~1`
WHILE `options.selection` is defined, `usePricingSelection` and its store `createSelectionStore()` SHALL derive its state from `options.selection` only, keeping no next selection of its own.

Needs: impl, utest

#### Scenario: Host ignores the change

- **GIVEN** `store = createSelectionStore()` given `setInput(acme, { selection, onSelectionChange })`, where `selection` is `createDefaultSelection(acme)` (plan `starter`) and `onSelectionChange` is a spy that does nothing
- **WHEN** `store.selectPlan('growth')` is called
- **THEN** the spy got plan `growth` and `getSnapshot().selection.planId` stays `starter`

#### Scenario: Controlled apply

- **GIVEN** the same store and a reset spy
- **WHEN** `store.apply({ planId: 'growth' })` is called
- **THEN** the returned result's `selection.planId` is `growth` and the spy got plan `growth`
- **AND** `getSnapshot().selection.planId` stays `starter`

### Requirement: Uncontrolled selection is held

`req~use-pricing-selection-uncontrolled~1`
WHILE `options.selection` is undefined, `usePricingSelection` and its store `createSelectionStore()` SHALL hold each next selection as its own selection.

Needs: impl, utest

#### Scenario: Plan change kept

- **GIVEN** `store = createSelectionStore()` given `setInput(acme, {})`
- **WHEN** `store.selectPlan('growth')` is called
- **THEN** `getSnapshot().selection.planId` is `growth`

### Requirement: A new pricing restarts the selection

`req~use-pricing-selection-pricing-change~1`
WHEN `usePricingSelection` or its store `createSelectionStore()` gets a `pricing` object that differs by identity (`Object.is` is false) from the previous one, the hook and the store SHALL set its own selection to the reconciled `mergeSelection(pricing, options.defaultSelection)`, reset its price stabilizer and drop `pending`.

Needs: impl, utest

#### Scenario: A new pricing

- **GIVEN** `store = createSelectionStore()` given `setInput(acme, { defaultSelection: { planId: 'growth' } })`, after `selectPlan('enterprise')` and `toggleAddOn('prioritySuccess', true)` left a pending change
- **WHEN** `store.setInput(acme2, { defaultSelection: { planId: 'growth' } })` is called, `acme2` a new normalized acme pricing object
- **THEN** `getSnapshot().selection.planId` is `growth` and `getSnapshot().pending` is undefined

#### Scenario: A new pricing resets the stabilizer

- **GIVEN** two normalized acme pricing objects `P1` and `P2` whose `starter` price is `rate() * #seats`, and `store = createSelectionStore()` given `setInput(P1, { expressionOptions: { functions: { rate: () => 30 } } })`, whose `viewModel.resolved.planPrices.starter.kind` is `amount`
- **WHEN** `store.setInput(P2, { expressionOptions: {} })` is called
- **THEN** `getSnapshot().viewModel.resolved.planPrices.starter.kind` is `error`
- **AND** on a second store given the same first input and then `setInput(P1, { expressionOptions: {} })`, the same pricing object, the kind stays `amount`

### Requirement: Pending change, confirm and cancel

`req~use-pricing-selection-pending~1`
WHEN `selectPlan` or `toggleAddOn` yields `{ kind: 'confirm', pending }`, `usePricingSelection` and its store `createSelectionStore()` SHALL return that change as `pending` and keep the selection until `confirm()` applies it with `applySelectionChange` or `cancel()` drops it.

Needs: impl, utest

#### Scenario: Confirm a dependency

- **GIVEN** `store = createSelectionStore()` given `setInput(acme, { defaultSelection: { planId: 'growth' } })`
- **WHEN** `store.toggleAddOn('prioritySuccess', true)` is called
- **THEN** `getSnapshot().pending.addIds` is `['extraStorage']` and no add-on is selected
- **WHEN** `store.confirm()` is called
- **THEN** `pending` is undefined and `extraStorage` and `prioritySuccess` are selected
- **AND** after the same toggle and `store.cancel()`, no add-on is selected

### Requirement: Confirm reads the selection at confirm time

`req~use-pricing-selection-confirm-input~1`
WHEN `confirm()` is called while `pending` is defined, `usePricingSelection` and its store `createSelectionStore()` SHALL pass `applySelectionChange` the not reconciled `selectionInEffect` of the held selection at the time of the call, as the element's confirm does.

Needs: impl, utest

#### Scenario: Controlled selection changed while pending

- **GIVEN** `store = createSelectionStore()` given `setInput(acme, { selection: s1, onSelectionChange })`, `s1` with plan `growth`, billing period `monthly` and no add-on, `onSelectionChange` a spy, and `store.toggleAddOn('prioritySuccess', true)` left a pending change
- **WHEN** `store.setInput(acme, { selection: s2, onSelectionChange })` is called with `s2` equal to `s1` except billing period `yearly`, and then `store.confirm()`
- **THEN** the spy's selection has billing period `yearly` and `extraStorage` and `prioritySuccess` selected

### Requirement: Apply a partial selection

`req~use-pricing-selection-apply~1`
WHEN `apply(input)` is called, `usePricingSelection` and its store `createSelectionStore()` SHALL drop `pending`, treat the selection of `applySelectionInput(pricing, selection, input)` as the next selection, and return that result.

Needs: impl, utest

#### Scenario: Unknown plan

- **GIVEN** `store = createSelectionStore()` given `setInput(acme, { defaultSelection: { planId: 'growth' } })`
- **WHEN** `store.apply({ planId: 'legacy' })` is called
- **THEN** the result's only diagnostic code is `PR_SELECTION_UNKNOWN_PLAN` and `getSnapshot().selection.planId` stays `growth`

#### Scenario: Apply drops a pending change

- **GIVEN** `store = createSelectionStore()` given `setInput(acme, { defaultSelection: { planId: 'growth' } })`, after `store.toggleAddOn('prioritySuccess', true)` left a pending change
- **WHEN** `store.apply({ billingPeriod: 'yearly' })` is called
- **THEN** `getSnapshot().pending` is undefined and `getSnapshot().selection.billingPeriod` is `yearly`
- **AND** no add-on is selected, and a later `store.confirm()` changes nothing

### Requirement: Current plan and relations

`req~use-pricing-selection-current~1`
WHERE `options.currentSelection` is given, `usePricingSelection` and its store `createSelectionStore()` SHALL return as `current` the current context the element derives from it (plan id and current add-on ids) and a `relationOf(planId)` that returns `planRelation(pricing, current.planId, planId)`, both giving undefined while there is no current context.

Needs: impl, utest

#### Scenario: Customer on growth

- **GIVEN** `store = createSelectionStore()` given `setInput(acme, { currentSelection: { planId: 'growth' } })`
- **WHEN** `store.relationOf` is called with `enterprise`, `starter` and `growth`
- **THEN** it returns `upgrade`, `downgrade` and `current`, and `getSnapshot().current.planId` is `growth`

### Requirement: Review from the hooks

`req~use-pricing-selection-compare~1`
WHEN `compareWithCurrent()` is called while `current` is defined, `usePricingSelection` and its store `createSelectionStore()` SHALL return `compareSelections({ before: { pricing, selection: currentSelection }, after: { pricing, selection }, expression })`, and undefined otherwise.

Needs: impl, utest

#### Scenario: Upgrade review

- **GIVEN** `store = createSelectionStore()` given `setInput(acme, { currentSelection: { planId: 'growth' }, defaultSelection: { planId: 'enterprise' } })`
- **WHEN** `store.compareWithCurrent()` is called
- **THEN** the result's `relation` is `upgrade`
- **AND** a type-check snippet that imports `SelectionComparison` from `../../src/core/index.js` and `PricingChangeReview` from `../../src/react/index.js` (relative `src` entries, as `tests/unit/react-style-prop.test.ts` does) and declares `const result: SelectionComparison` compiles `<PricingChangeReview comparison={result} />` without diagnostics

### Requirement: Renderer state follows the element events

`req~renderer-state-events~1`
WHEN the element of `ref.current` dispatches `pricing-ready`, or `pricing-selection-change` after a `pricing-ready` seen since the last attach, `usePricingRendererState(ref)` and its store `createRendererStateStore()` SHALL replace the snapshot by a new object with the event's `selection` and `resolved`, and the `pricing` of the last `pricing-ready`.

Needs: impl, utest

#### Scenario: Ready, then a selection change

- **GIVEN** `store = createRendererStateStore()` after `store.attach(target)`, `target` a Node `EventTarget`
- **WHEN** `pricing-ready` with the acme pricing and then `pricing-selection-change` with plan `growth` are dispatched on `target`
- **THEN** `getSnapshot().pricing.saasName` is `Acme Cloud` and `getSnapshot().selection.planId` is `growth`
- **AND** on a new store attached to a new target, a `pricing-selection-change` before any `pricing-ready` leaves `getSnapshot()` `undefined`

### Requirement: Renderer state snapshot is cached

`req~renderer-state-cached-snapshot~1`
The hook `usePricingRendererState` and its store `createRendererStateStore()` SHALL return the identical snapshot object from every `getSnapshot` call between two updates of the snapshot.

Needs: impl, utest

#### Scenario: Repeated reads

- **GIVEN** `store = createRendererStateStore()` attached to a target after one `pricing-ready` event
- **WHEN** `store.getSnapshot()` is called 100 times
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
WHEN `ref.current` points to another element than at the last subscription, `usePricingRendererState` and its store `createRendererStateStore()` SHALL remove its listeners from the old element, add them to the new one and start again from an `undefined` snapshot.

Needs: impl, utest

#### Scenario: Element replaced

- **GIVEN** `store = createRendererStateStore()` after `store.attach(a)` and then `store.attach(b)`, `a` and `b` Node `EventTarget` objects
- **WHEN** `pricing-selection-change` is dispatched on `a` and then `pricing-ready` on `b`
- **THEN** the event on `a` does not change `getSnapshot()` and the event on `b` does

### Requirement: Listeners attached in the commit

`req~renderer-state-early-listen~1`
WHEN the hook and the element of `ref.current` are committed in the same render, `usePricingRendererState` SHALL attach the listeners of its store `createRendererStateStore()` synchronously during that commit, so that the element's first `pricing-ready`, dispatched from its first update after the commit, reaches the snapshot.
The end-to-end race with a real element and a real commit is checked in CI only, by a browser spec.

Needs: impl, utest

#### Scenario: Ready right after the commit

- **GIVEN** `store = createRendererStateStore()` and a Node `EventTarget` that queues a `pricing-ready` with the acme pricing as a microtask
- **WHEN** `store.attach(target)` is called in the same synchronous call and the microtask runs
- **THEN** `getSnapshot().pricing.saasName` is `Acme Cloud`

#### Scenario: Attach from the layout effect

- **GIVEN** `globalThis.document` stubbed and the module cache reset before `src/react/use-renderer-state.ts` is imported, `react` replaced by a `vi.mock('react')` stand-in whose `useState(init)` returns `[init(), () => {}]`, `useRef(v)` returns `{ current: v }`, `useMemo(f)` returns `f()`, `useCallback(f)` returns `f`, `useSyncExternalStore(subscribe, getSnapshot)` records `subscribe` and returns `getSnapshot()`, and `useLayoutEffect` and `useEffect` record their callbacks in two separate lists, the hook being called as a plain function, and a ref whose target has an `addEventListener` spy
- **WHEN** `usePricingRendererState(ref)` is called and only the recorded layout callbacks run
- **THEN** the spy was called for `pricing-ready` and `pricing-selection-change`

### Requirement: Apply through the renderer state

`req~renderer-state-apply~1`
WHEN `applySelection(input)` of the returned state is called, `usePricingRendererState` and its store `createRendererStateStore()` SHALL call `applySelection(input)` of the element, replace the snapshot with the result's `selection` and `resolved` when `applied` is true, and return that result, or return `undefined` while no element is attached.

Needs: impl, utest

#### Scenario: Silent apply seen by the hook

- **GIVEN** `store = createRendererStateStore()` attached to an element stand-in after its `pricing-ready`, whose `applySelection` returns `applied: true` with plan `enterprise` and dispatches no event, and a listener added with `store.subscribe`
- **WHEN** `store.getSnapshot().applySelection({ planId: 'enterprise' })` is called
- **THEN** `getSnapshot().selection.planId` is `enterprise` and the listener was called once

#### Scenario: Refused apply keeps the snapshot

- **GIVEN** the attached store of the scenario above, whose stand-in `applySelection` now returns a result `r` with `applied: false`, a listener added with `store.subscribe`, and `before = store.getSnapshot()`
- **WHEN** `store.applySelection({ planId: 'growth' })` is called
- **THEN** it returns `r`, `getSnapshot()` is `Object.is` equal to `before` and the listener was not called

#### Scenario: Apply without an element

- **GIVEN** `store = createRendererStateStore()` never attached, and a second store after `attach(target)` and `detach()`
- **WHEN** `applySelection({ planId: 'growth' })` is called on each
- **THEN** both calls return `undefined`
