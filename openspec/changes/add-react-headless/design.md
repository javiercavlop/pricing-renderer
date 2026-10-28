# Design: add-react-headless

Decisions come from the phase plan (`docs/agent-work/phase3-react-headless/phase-plan.md`,
section 3), whose recommendations the owner accepted for CRP-P3-A to CRP-P3-D, and from the intake
facts. Line
numbers are at `88f5141`. D1 to D10 belong to part 1 (P3-S1); D11 and D12 summarise part 2 and the
examples, whose spec files P3-S2 writes; D13 records the slot context encoding.

## Context

- The selection logic is private to the element: selection in effect `:476-494,578-585`, price
  stabilisation `:598-649`, changes `:684-893`. Only browser specs pin it
  (`tests/browser/pricing-renderer.spec.ts:125-432,1547-1600`).
- `applySelectionInput` is internal by `req~apply-input-internal~1`, pinned by
  `tests/unit/apply-selection.test.ts:69-73`.
- `pricing-renderer/react` imports `../element/define.js` (`src/react/index.ts:28`), so every
  import loads Lit and registers the element.
- The element reads the global configuration once, in its constructor (`:224-239`).
- Unit tests run in node without a DOM (`vitest.config.ts:5`); `react-dom` 19 is a dev dependency.

## Decisions

### D1. Core selection functions, copied without behaviour change (CRP-P3-A)

Signatures, all in `src/core/selection-change.ts` and exported from `pricing-renderer`:

- `planSelectionChange(pricing, selection, intent): SelectionChangeResult`, with
  `SelectionChangeIntent = { type: 'plan'; planId: string } | { type: 'addOn'; addOnId: string; selected: boolean }`
  and `SelectionChangeResult = { kind: 'apply'; selection } | { kind: 'confirm'; pending }`.
- `applySelectionChange(pricing, selection, pending): PricingSelection`.
- `selectionWithVariable(selection, path, value)`, `selectionWithAddOnQuantity(pricing, selection, addOnId, quantity)`.
- `selectionInEffect(pricing, selection, options?: { variablesEnabled?: boolean })`.

Rules that keep the element's exact behaviour:

- `selectionInEffect` is the `variablesEnabled` rule of `_effectiveSelection` (`:578-585`) and
  does not reconcile. The element's "selection in effect" (`_selectionInEffect`, `:480-484`) stays
  `reconcileSelection` of it, so existing requirement wording keeps its meaning.
- A plan intent reconciles the given selection with the new plan (`_selectPlan`, `:709-738`). An
  add-on intent works on the given selection as it is, not reconciled (`_toggleAddOn`, `:790-830`).
  The element and the hooks both pass the `selectionInEffect` of the held selection, not
  reconciled, so an unreconciled controlled selection gives the same result in both. The hooks'
  `apply` uses the reconciled `selection`, as `applySelection` does (`:454-458`).
- Dependency closure, the three conflict sources and the transitive dependents are the element's
  (`:760-830`), including the order of `addIds` (traversal order) and `removeIds`.
- `applySelectionChange` returns the reconciled selection. The element's `_setSelection` reconciles
  again, which changes nothing (`reconcileSelection` is idempotent on its output).
- `selectionWithVariable` and `selectionWithAddOnQuantity` do not reconcile; the caller's set step
  does, as `_setSelection` does. A billing change and a variable reset stay plain copies (no core
  function; the owner's list has none).
- An unknown add-on gives `kind: 'apply'` with an equal selection. The element keeps its own early
  return before the call (`:794-795`), so it still dispatches nothing.

`PendingAddOnChange` moves to `src/core/types.ts`; `src/element/events.ts` re-exports it under the
same name, so `pricing-renderer/element` and `tests/unit/dependency-names.test.ts:6` keep working.

### D2. `applySelectionInput` becomes public

`req~apply-input-exported~1` supersedes `req~apply-input-internal~1`
(`docs/agent-work/delivera-2-load-current-contract/spec.md:62-64`). The phase 2 design also called it
internal (`openspec/changes/add-subscription-change-flow/design.md:9`); that note is superseded too.
The test at `tests/unit/apply-selection.test.ts:69-73`, tagged `[utest->req~apply-input-internal~1]`,
is flipped by test-designer in P3-1T: it asserts that `Object.keys(core)` contains
`applySelectionInput` and is tagged `[utest->req~apply-input-exported~1]`. The other tags of that file
are unchanged. The deep import from `src/core/apply-selection.ts` keeps working. The old
requirement lives outside `openspec/specs/`, so this change has no REMOVED delta; the supersession
is stated in the new requirement's text.

### D3. Price stabilizer (CRP-P3-A)

`createPriceStabilizer(): PriceStabilizer` with `stabilize(viewModel)` and `reset()`, in
`src/core/price-stabilizer.ts`. It is `_stabilizeResolvedPrices` (`:598-649`) with the two caches
moved inside:

- `stabilize` changes the given view model in place and returns it, as the element does; callers
  pass a fresh `createPricingViewModel` result.
- Every call records `amount` prices, also a call whose result is dropped. The element keeps
  calling it from `_snapshot`, `_viewModel`, `_setSelection` and `_triggerAction` (`:490,653,691,908`),
  so a `resolvedState` read still records.
- A kept line carries no label (a line of a failed expression has none). The subtotal is always
  folded again.
- The element calls `reset()` where it clears its caches today, on a successful load (`:528-529`).
- Hooks: one stabilizer per hook instance. `createSelectionStore()` creates it inside the store, so
  each `usePricingSelection` call site has its own, and the store calls `reset()` when `pricing`
  changes by identity (`req~use-pricing-selection-pricing-change~1`). No stabilizer, view model or
  pricing-keyed cache (`Map`, `WeakMap`, `Set`, `WeakSet`) lives at module scope in `src/react`
  (`req~react-no-module-state~1`). Reason: a module-level cache keyed by the pricing object is shared
  by every request of a server process, so one request's kept price would hide another request's
  failed expression (`req~use-pricing-selection-view-model~2`).

### D4. Search params (CRP-P3-A)

`src/core/search-params.ts`, exported from `pricing-renderer`. The format:

- Writer order: `plan`, `billing`, then `addon` entries in the key order of `selection.addOns`, then
  `var.<name>` entries in the key order of `selection.variables`. Values whose `JSON.stringify` is
  `undefined` are skipped.
- `addon` is `id` for quantity 1, else `id:quantity`; an id that contains `:` is always written
  with its quantity, so the reader's split at the last `:` gives the id back. Only selected add-ons
  are written.
- The writer has no pricing, so it writes every top-level variable. A host that wants short URLs
  filters the pairs.
- Reader: the first `plan` and `billing` entries win; a repeated `addon` id takes the last entry;
  the quantity is `Number` of the text after the last `:`, so `id:abc` gives `NaN` and
  `normalizeAddOnQuantity` turns it into the minimum. A `var.<path>` value is set with the dot path
  rules of `setAtPath` on a copy of `pricing.variables`; text that is not JSON stays a string, so a
  hand-written `var.region=us` works.
- URL text is untrusted. `setAtPath` walks into an existing `__proto__` (`src/core/utils.ts:110-121`),
  and creates an array for a missing parent of a digit segment (`:110-111`), which `cloneValue`
  then walks index by index (`src/core/apply-selection.ts:22`). So the reader splits the path the
  way `setAtPath` does (`[n]` as `.n`, `:91-94`) and drops the entry before `setAtPath` when a
  segment is `__proto__`, `prototype` or `constructor`, or is a digit run that does not index an
  existing array element of the defaults (`req~search-params-var-path-safe~1`). In the element,
  paths come only from the pricing author.
- A URL-safe selection (`req~search-params-round-trip~1`) is reconciled, its selected quantities
  are `normalizeAddOnQuantity` results, and its variables have the top-level keys of
  `pricing.variables`, JSON values, and no key with `.`, `[` or a segment the reader drops. The
  round trip holds only for such selections: the reader normalizes quantities through
  `applySelectionInput`, fills missing defaults and reads `.` as a path; the writer does neither.
- The read input is relative to the defaults: `applySelectionInput` merges with
  `createDefaultSelection` (`src/core/apply-selection.ts:83-86`); `current` (option, default
  `createDefaultSelection(pricing)`) only replaces an unknown plan or billing period. So one URL
  gives one selection.
- Keys without the prefix and unknown keys are ignored. No new diagnostic code.
- Options: `{ prefix?: string }` for the writer and `{ prefix?: string; current?: PricingSelection }`
  for the reader. `Iterable<[string, string]>` keeps DOM types out of the core
  (`tsconfig.core.json:4-5`).

Once released, this URL format is a public contract (risk R10).

### D5. Shared source load: where it is specified

`loadPricingSource(input, options)` lives in `src/yaml/source.ts` and is exported from
`pricing-renderer/yaml`. Its requirements are the "Shared source load" group of the **react-hooks**
capability (`req~load-source-one-source~1`, `req~load-source-result~1`), next to its second
consumer, `usePricingSource`.

- Input `{ pricing?, yaml?, src? }`; options `{ request?, loadPricing?, normalizeOptions?, signal? }`.
- It returns a `PricingResult<NormalizedPricing>` synchronously for `pricing`, `yaml` and a source
  error, and a promise for `src`. The element keeps applying inline sources in the same call
  (`:405-411`) and the hook resolves them during render.
- The abort of the previous load and the sequence number stay in the callers (`:398-401,420-422`).
- The element's `reload()` calls it in P3-4, after P3-2.
- Bounds (`req~load-source-request-bounds~1`): a `request.maxBytes` or `request.timeoutMs` that is
  not a positive finite number is replaced by its default (2097152 bytes, 15000 ms;
  `src/yaml/load.ts:6-7`) before `loadPricingFromUrl`. Today `loadPricingFromUrl` takes them as
  given (`:139-140`), so `NaN` aborts at once and a negative size refuses every body; the element
  gains the rule through `reload()` in P3-4.
- What is not bounded: a `loadPricing` that returns an object (not a string) is normalized without
  a size check (`:167-168`), and inline `pricing` and `yaml` have no limit. The host bounds them.
- SSRF: `loadPricingSource` on a server with a `src` taken from user input fetches whatever URL it
  gets. The host owns that risk (an allow-list or its own `loadPricing`); the reference docs
  (P3-15b) say so.

### D6. Headless subpath (CRP-P3-B)

`src/react/headless.ts` (`'use client'`) builds to `dist/react/headless.js`. `package.json` gets the
`./react/headless` export and the entry in the `package:check` list (`:143`); it is not added to
`sideEffects`. Type-only imports from `src/element` are allowed; runtime imports from `src/element`
are allowed only for modules that import no Lit (`current-selection.ts` imports only the core).
`src/react/index.ts` re-exports the whole headless entry.

The import-graph check of `req~react-headless-entry~1` follows runtime imports only: an
`import type` or `export type` declaration is skipped; a declaration whose specifiers are all
inline `type` specifiers still counts, because `verbatimModuleSyntax` keeps it as a side-effect
import.

### D7. Hooks are thin layers over framework-free stores (CRP-P3-D (a))

- Stores: three framework-free stores, one per hook instance (created with `useState(factory)`),
  each tested in node; the Store API below names them. Render-time paths are tested with
  `react-dom/server`; the wrapper with `renderToString` and the `@lit/react` mock
  (`tests/unit/react-style-prop.test.ts:7-12`). Hook paths that need an effect are tested on the
  store or with the hook harness below.
- Cached-snapshot rule (risk R4): every `getSnapshot` returns the same object until the store
  changes. `resolvedState` returns a fresh copy per read (`:493`), so the renderer state store never
  reads it in `getSnapshot`.

#### Store API

Every store has `subscribe(listener: () => void): () => void` (the returned function removes that
listener) and `getSnapshot()`, which returns the identical object until the store's state changes;
a change replaces the snapshot object and then calls every listener once. A method called during
render (`setInput`) updates the snapshot without calling listeners, because the rendering
component reads it in the same render through `useSyncExternalStore`.

- `createSourceStore(): SourceStore`, exported from `src/react/use-pricing-source.ts` (not from an
  entry).
  - Snapshot `{ status: 'loading' | 'ready' | 'error'; pricing: NormalizedPricing | undefined; diagnostics: PricingDiagnostic[] }`.
  - `setInput(input: { pricing?, yaml?, src? }, options: { request?, loadPricing?, normalizeOptions? })`:
    render-time. An input equal to the held one by the compare rules below changes nothing.
    Otherwise the store holds it and adds 1 to `inputVersion`; an inline or invalid input is
    applied at once from `loadPricingSource`; a `src` input sets `status` `loading` and keeps the
    last successful `pricing`. A changed input also makes the load in flight stale at once: its
    result is ignored when it settles, also before the effect cleanup runs `stop()` (which still
    aborts it), as the element's sequence check does (`:420`;
    `req~use-pricing-source-stale-load~1`).
  - `inputVersion: number`: read-only; the dependency of the hook's load effect.
  - `start()`: effect body. Starts the `src` load of the held input unless a load of that input is
    in flight or has settled; does nothing for an inline input.
  - `stop()`: effect cleanup. Aborts the load in flight; its result is ignored.
  - `reload()`: aborts the load in flight and loads the held input again (an inline input is
    applied again).
  - The hook: `store.setInput(...)` during render,
    `useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)`, and an effect
    `() => { store.start(); return () => store.stop(); }` with the dependencies
    `[store, store.inputVersion]`; it returns `{ status, pricing, diagnostics, reload }`.
- `createSelectionStore(): SelectionStore`, exported from `src/react/selection-store.ts` (not from
  an entry). It creates its own `createPriceStabilizer()` (D3).
  - `setInput(pricing: NormalizedPricing | undefined, options: SelectionStoreOptions)`:
    render-time. `options` are the resolved options of `usePricingSelection` (instance, then
    provider, then global, already merged by the hook): `selection`, `onSelectionChange`,
    `defaultSelection`, `currentSelection`, `locale`, `mode`, `visibility`, `messages`,
    `presentation`, `expressionOptions`, `variablesEnabled`. A `pricing` that differs by identity
    from the held one, the first one included, restarts the store
    (`req~use-pricing-selection-pricing-change~1`). The snapshot is rebuilt when `pricing`, the held
    selection, `pending` or an option other than `onSelectionChange` differs (structural compare).
  - Snapshot `{ selection, viewModel, resolved, pending, current }`, every field `undefined` while
    `pricing` is undefined.
  - Change actions: `selectPlan(planId)`, `toggleAddOn(addOnId, selected)`,
    `setVariable(path, value)`, `setAddOnQuantity(addOnId, quantity)`,
    `setBillingPeriod(billingPeriodId)`, `resetVariables()`; then `confirm()`, `cancel()`,
    `apply(input): ApplySelectionInputResult | undefined`.
  - Queries: `relationOf(planId)`, `compareWithCurrent()`.
  - The hook returns the snapshot fields and the actions and queries, whose identities stay the
    same for the life of the store.
- `createRendererStateStore(): RendererStateStore`, exported from `src/react/use-renderer-state.ts`
  (not from an entry).
  - `attach(target: EventTarget | null)`: the same target changes nothing; another target removes
    the listeners from the old one, adds them to the new one and sets the snapshot to `undefined`
    (there is no separate move method: moving is `attach` of another target); `null` is `detach()`.
  - `detach()`: removes the listeners and sets the snapshot to `undefined`.
  - `applySelection(input)`: calls `applySelection(input)` of the attached target and returns its
    result, `undefined` without a target (`req~renderer-state-apply~1`).
  - Snapshot `{ pricing, selection, resolved, applySelection } | undefined`, `applySelection` being
    the store's own method; `getServerSnapshot()` returns `undefined`.
  - The hook: `useClientLayoutEffect(() => store.attach(ref.current))` with no dependency list, so
    it runs on every commit, `useClientLayoutEffect(() => () => store.detach(), [store])`, and
    `useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)`.
- Hook harness (for scenarios that need a hook's effect in node): `vi.mock('react')` with
  `useState(init)` returning `[init(), () => {}]` (or `[init, ...]` for a value), `useRef(v)`
  returning `{ current: v }`, `useMemo(f)` returning `f()`, `useCallback(f)` returning `f`,
  `useContext(context)` returning the value the test assigns to that context object (its default
  otherwise), `useSyncExternalStore(subscribe, getSnapshot)` recording `subscribe` and returning
  `getSnapshot()`, and `useEffect` and `useLayoutEffect` recording their callbacks in two lists
  that the test runs. `createContext(v)` returns a plain object holding `v`. The hook is called as
  a plain function. The provider context is the internal export `PricingRendererContext` of
  `src/react/provider.ts` (not re-exported by an entry).

#### Hook rules

- `usePricingSource`: status `'loading' | 'ready' | 'error'`. Structural compare for `pricing`,
  `request` and `normalizeOptions`, identity for `yaml`, `src` and `loadPricing`, as the element
  (`:122-130`). Any failed load, inline or `src`, keeps the last successful pricing with `ready`
  (`:564`); a `src` load in flight keeps it too, with `loading`.
- Change members and their core step (`req~use-pricing-selection-changes~1` holds the same list):
  `selectPlan(planId)` → `planSelectionChange` with a plan intent; `toggleAddOn(addOnId, selected)`
  → `planSelectionChange` with an add-on intent; `setVariable(path, value)` →
  `selectionWithVariable`; `setAddOnQuantity(addOnId, quantity)` → `selectionWithAddOnQuantity`;
  `setBillingPeriod(id)` → a copy with `billingPeriod`; `resetVariables()` → a copy with a copy of
  `pricing.variables`.
- `confirm()` passes `applySelectionChange` the not reconciled `selectionInEffect` of the held
  selection at the time of the call, as the element's `_applyAddOnChange` reads
  `_effectiveSelection()` when the user confirms (`:834`), not the selection held when the change
  became pending (`req~use-pricing-selection-confirm-input~1`). A controlled selection that the
  host changed while the dialog was open is the one confirmed.
- `apply(input)` differs from the element's `applySelection` (`:435-474`) on purpose: it calls
  `onSelectionChange` (`req~use-pricing-selection-notify~1`) and it works in controlled mode, where
  the store does not hold the result (`req~use-pricing-selection-controlled~1`) and the host decides.
  The element's `applySelection` is silent and refused while `selection` is set because its host
  already holds the result and reads it from the return value or `resolvedState`; a hooks host has
  only `onSelectionChange` to learn about a change, and controlled mode is the usual hooks pattern
  (a selection kept in the URL), where a refusing `apply` would be useless. A member that produces
  a next selection calls `onSelectionChange` once, also when that selection equals the previous
  one, as the element's `_setSelection` dispatches (`:684-707`); a change that becomes `pending`
  calls nothing until `confirm()`.
- `usePricingSelection(pricing, options)`: other members `viewModel`, `selection`, `resolved`,
  `pending`, `confirm`, `cancel`, `apply`, `relationOf`, `current`, `compareWithCurrent`; options `selection`,
  `onSelectionChange`, `defaultSelection`, `currentSelection`, `locale`, `mode`, `visibility`,
  `messages`, `presentation`, `expressionOptions`, `variablesEnabled`. While `pricing` is undefined
  the members do nothing and `apply` returns `undefined`. `onSelectionChange` gets a
  `PricingSelectionChangeDetail`. `current` is `{ planId, addOnIds: ReadonlySet<string> }` from
  `deriveCurrentContext` (`src/element/current-selection.ts:27-50`); `relationOf` uses the internal
  `planRelation` (`src/core/plan-relation.ts:9-19`). `getServerSnapshot` returns the client snapshot,
  which is pure.
- `usePricingRendererState(ref)` returns `{ pricing, selection, resolved, applySelection } | undefined`.
  It listens to `pricing-ready` and `pricing-selection-change`. The listeners are attached from a
  layout effect on the client (an effect on the server, where nothing attaches), which checks
  `ref.current` on each commit and moves them when it changes. `useSyncExternalStore` subscribes
  in a passive effect, which can run after the element's first update has already dispatched
  `pricing-ready`; the layout effect runs before it (`req~renderer-state-early-listen~1`).
- Client check: `src/react/use-renderer-state.ts` evaluates `typeof document !== 'undefined'` once,
  at module load, into the module constant
  `useClientLayoutEffect = isClient ? useLayoutEffect : useEffect`. A constant keeps the hook order
  the same on every render of a process. The node test therefore stubs `globalThis.document`
  (`vi.stubGlobal`) and calls `vi.resetModules()` before the dynamic `import()` of the module, and
  removes the stub after it.
- The end-to-end race (a real element's first `pricing-ready` reaching a hook committed in the same
  render) needs a browser and a real React commit; node covers it only through the store and the
  harness. It is checked in CI only, by a browser spec of P3-8 (a followup for tasks.md), not by a
  local check.
- The renderer state cannot see an `applySelection` call made on the element directly (silent by
  `req~apply-selection-silent~1`) or a change of a controlled `selection` prop; `applySelection` of
  the returned state refreshes the snapshot. The React guide (P3-15a) states both limits. This is a
  docs task, not a requirement, because no test reads the guide's prose.
- Late attach (decision (b), see Open questions): a hook attached after `pricing-ready` stays
  `undefined` until the next event. It is a documented limit of this phase, in the same guide.

### D8. Provider (CRP-P3-B)

- `PricingRendererProvider` props: `config` (`Partial<PricingRendererConfig>`), `messages`,
  `presentation`, `request`, `requestOrigins` (`readonly string[]`, default none), `loadPricing`,
  `children`.
- Request and loader (`req~provider-request-loader~1`): each of `request` and `loadPricing` comes
  from the instance when it sets it, else from the provider. An instance `request` replaces the
  provider `request` as a whole, so the provider's `maxBytes`, `timeoutMs`, `headers` and
  `credentials` do not apply to that instance; a host that wants them spreads the provider object
  itself.
- Origin rule (`req~provider-request-origin~1`): a provider sets `request` for every `src` in its
  subtree, and `headers` often hold an `Authorization` value. So the provider `request` keeps its
  `headers` and `credentials` only when `new URL(src).origin` is the page origin
  (`globalThis.location.origin`) or the origin of an entry of `requestOrigins` (each entry read
  with `new URL(entry).origin`; an entry that does not parse is ignored). On a server there is no
  `location`, so only listed origins get them. A `src` that is not an absolute URL gets neither
  (its load fails with `PR_SOURCE_URL_INVALID` anyway). `maxBytes` and `timeoutMs` are kept for
  every origin. The rule applies only while the instance sets no `request`; an instance `request`
  is used as given: the host chose it for that `src`.
- A provider `loadPricing` also runs for every `src` in the subtree. It receives the URL as
  `context.url` (`src/yaml/load.ts:154-163`) and the filtered request; a shared loader that adds
  its own credentials must check `context.url` itself. The same holds for a provider
  `request.fetch` (`src/yaml/types.ts:13`), which the origin rule keeps for every origin and which
  is called with the URL as its first argument (`src/yaml/load.ts:182-188`): a `fetch` wrapper
  that adds `Authorization` must check that URL. The reference docs (P3-15b) say both; no
  requirement, because the loader and the `fetch` wrapper are host code.
- Context value: `PricingRendererContext` (internal export of `src/react/provider.ts`) holds the
  provider's props without `children`, that is
  `{ config, messages, presentation, request, requestOrigins, loadPricing }` as passed, and
  `undefined` outside a provider (its default). The provider memoizes the object on those six
  props, so consumers re-render only when one of them changes.
- Wrapper structure: `PricingRenderer` stays a `forwardRef` component and reads the provider with
  `useContext` in its render function. The three existing tests that call
  `PricingRenderer.render(props, null)` and then `rendered.type(rendered.props)`
  (`tests/unit/react-style-prop.test.ts:75-91`, `tests/unit/density.test.ts:274-289`,
  `tests/unit/spectra-followups-react.test.ts:71-89`) are rewritten by test-designer in P3-5 to
  render `PricingRenderer` with `renderToString` under the same `@lit/react` mock and read the
  recorded props; their assertions stay. A hook-free outer component was considered and is not
  feasible: those tests need `rendered.type` to be the mocked base component, called directly
  outside React, and only a hook (`useContext`) or a `Context.Consumer` element can read the
  provider; a `Context.Consumer` is an object, not a callable `type`, and adds one more element
  level before the base. (A followup asks to add the three files to P3-5 in tasks.md.)
- Precedence: instance prop or option, then the nearest provider, then the global configuration,
  then `custom.pricingRenderer` (presentation only). The wrapper passes a provider value as an
  element prop only when the instance prop is undefined; for presentation it passes
  `mergePresentationOptions` of the provider layers and the instance, and the element merges the
  global layer below it (`:593`), so `docs/configuration.md:279-290` gains one layer.
- Nested providers: the nearest one wins as a whole. Reason: plain context semantics; a merge
  would need a rule per prop. Hosts that want a merge compose the props themselves.
- The provider passes values as they are; the element and the hooks treat them as instance values.
  It writes no global (`configurePricingRenderer`, `registerMessageCatalog`), which removes the
  per-process config of the Next example (risk R5). `configurePricingRenderer` keeps working.
- Outside a provider the hooks read `getPricingRendererConfig()` at render time; the element still
  reads it at construction. The wrapper then adds none of `locale`, `pricingPath`,
  `selectionEnabled`, `ctaEnabled`, `variablesEnabled`, `presentation`, `messages`, `request` and
  `loadPricing` that the host did not pass (`req~provider-absent-unchanged~2`); props it derives
  from render props (`slots`) belong to the composition capability.

### D9. SSR, React 18 and 19

- Allowed React APIs: `createContext`, `useContext`, `useState`, `useRef`, `useMemo`,
  `useCallback`, `useEffect`, `useSyncExternalStore`, `useId`, `forwardRef`, `createElement`,
  `Fragment`, and `useLayoutEffect` only behind a client check that falls back to `useEffect` on
  the server (React 18 warns about it in server rendering); from `react-dom`:
  `createPortal(children, container, key)`. Not allowed: `use`, ref as a prop, `useEffectEvent`,
  `useActionState`, `useOptimistic`. `req~react-hooks-common-api~1` holds the same list in its
  text. Its scan reads runtime value uses only: a `React.<name>` in a type position, such as
  `React.CSSProperties` (`src/react/index.ts:107`), is not an API use, and passing the namespace
  itself (`react: React`, `src/react/index.ts:34`) is not a member access.
- `pricing` and `yaml` resolve during render; `src` loads only in an effect, abortable and
  idempotent for the StrictMode re-run.
- The element is not server-rendered. Portals have no target until the element renders on the
  client, so render props appear after hydration with no mismatch.

### D10. No feature flag

Everything is reached through new functions, a new subpath, a new provider and properties unset by
default. The release hold (`ROADMAP.md:137-148`) keeps every slice unreleased. One minor changeset
per slice that adds API.

### D11. Composition and hide-sections (part 2, CRP-P3-C)

Specified by P3-S2 in `specs/composition` and `specs/hide-sections`:

- `PricingRenderer` props `renderPlanCta(context)`, `renderSummaryActions(context)`,
  `renderLoading()` and `renderError({ diagnostics, reload })`; plan context `planId`, `planName`,
  `selected`, `current`, `relation`, `label`, `href`, `pending`, `trigger()`.
- Element property `slots` (no attribute; `plan-cta`, `summary-actions`, `loading`, `error`) that
  renders empty `data-pr-slot="<name>"` nodes (`data-plan-id` on plan CTAs) instead of the default
  markup; without `slots` the markup is unchanged.
- Event `pricing-slots-change` from `updated()` when the set of slot nodes changes; method
  `triggerPlanAction(planId)` that dispatches the same `pricing-action` as the built-in CTA.
- Plan slot nodes wrapped in `keyed(plan.id, ...)`, so no test helper changes (intake, item 4).
  `keyed(plan.id, ...)` is used only when `slots` requests `plan-cta`; it is the implementation of
  `req~slot-plan-cta-keyed~1`. Without `slots` no directive is added, so the existing test helpers
  that flatten directives stay unchanged. `repeat()` for the whole plan map is not used.
- The wrapper renders each slot with `createPortal(node, container, planId)` from `react-dom`
  (key = plan id for plan nodes, slot name for the others); it is the implementation of
  `req~react-slot-portals~1`.
- `hideSections` property and `hide-sections` attribute: `hero`, `metadata`, `billing`,
  `variables`, `plans`, `comparison`, `addOns`, `summary`; with `hero` hidden a visually hidden
  title keeps the shell's accessible name.

### D12. Examples (CRP-P3-D (a))

`react-router` is added to `examples/react` only (a lockfile change through a registered update
check). The Next example uses `next/link`. Both use an in-memory mock backend for the review flow.

### D13. Render-prop context travels on the slot nodes

- Each plan slot node carries the per-plan context as data attributes, next to `data-plan-id`
  (`req~slot-plan-cta-context~1`):
  - `data-plan-name`, `data-label`;
  - `data-href`: the safe expanded link only; absent for a button;
  - `data-relation`: absent without a current plan;
  - `data-selected`: `'true'` or `'false'`;
  - `data-current` and `data-pending`: `'true'` or absent; `data-pending` means this plan's own
    action is the pending one.
- The summary slot node carries only `data-relation` and `data-pending`
  (`req~slot-summary-actions-context~1`).
- Plan slot encoding follows the built-in markup: `data-selected=${String(selected)}`,
  `data-current` and `data-pending` as `'true'` or `nothing`,
  `data-relation=${cta.relation ?? nothing}` (`src/element/renderers.ts:368-369,384-385,427-429`).
  `data-label`, `data-href`, `data-relation` and `data-pending` come from the same `planCtaView`
  result (`src/element/cta.ts:92`, called at `renderers.ts:351`) that the built-in CTA renders, and
  `data-selected` and `data-current` from the same card state (`renderers.ts:416-417`), so for plan
  slots the context and the built-in markup agree.
- The summary slot does not follow the built-in summary button. There, `data-pending` means the
  summary's own action is pending (`isPendingActionId(pendingActionId, summaryAction.actionId)`,
  `renderers.ts:1451,1459`) and `aria-disabled` means any action is pending (`:1461`). On the
  summary slot node, `data-pending` is `'true'` while any `pendingActionId` is set: a host that
  renders its own summary actions has action ids the element does not know, so "its own action"
  has no meaning there, and "any action pending" is what the host needs to disable them. Only
  `data-relation` (`:1458`) has the built-in meaning.
- Plan CTAs need the same "any action pending" signal: the built-in CTAs set `aria-disabled` on
  every CTA while any action is pending (`ariaDisabled: pendingActionId !== undefined`,
  `cta.ts:110`), and a render-prop CTA must be able to do the same. Proposed for the composition
  capability (its owner adds the requirement; a followup of this change): the plan slot node
  attribute `data-any-pending` (`'true'` while `pendingActionId` is set, otherwise absent) and the
  plan context field `anyPending: boolean`.
- In `updated()` the element dispatches `pricing-slots-change` when the set of slot nodes (identity
  and order) or any slot node's `data-*` values changed since the last dispatch
  (`req~slots-change-event~2`). `detail` stays `{ nodes }`. The wrapper rebuilds each context from
  the reported nodes on each event.
- Reason: an event on the node set alone left the context stale when selection, label, link,
  `currentSelection` or `pendingActionId` changed with the same nodes.
- The compare runs once per update. A React re-render that passes a new but equal `slots` array
  dispatches nothing, so it cannot loop. Portal content lives in the nodes' children, which the
  compare does not read.
- Summary flaw: the summary context holds `selection` and `resolved`, which are objects, not
  attributes, and `resolved` can change with an equal selection (for example a new pricing object).
  So the wrapper reads them from `resolvedState` in the event handler, and the event also fires when
  a summary node is connected and the selection in effect or its resolved prices differ
  structurally from the last dispatch (`req~slots-change-event-summary~1`).

## Risks

- R1. Drift during the extraction. Mitigation: characterization tests first (P3-1T), the element
  refactor after (P3-2), the browser specs above green in CI.
- R2. The export reverses a pinned requirement. Mitigation: D2, the test flip before the
  implementer.
- R3. Portal content in the wrong card with the non-keyed plan map. Mitigation: keyed slot nodes.
- R4. Endless re-render from an uncached snapshot. Mitigation: the cached-snapshot rule.
- R5. Global config shared across server requests. Mitigation: the provider and the docs.
- R6. Hidden hero removes the shell's name. Mitigation: the hidden title (part 2).
- R7. React 18 not exercised in CI. Mitigation: D9, and a followup for a React 18 check.
- R8. File contention with the phase 1b and 1c chains. Mitigation: the order in tasks.md.
- R9. A renderer state attached after `pricing-ready` (a hook mounted later than the element) has
  no pricing to show until the next event. Mitigation: listeners attached in the commit cover the
  usual case; the rest is a documented limit (decision (b), React guide P3-15a).
- R10. The URL format becomes public. Mitigation: D4 fixed here; any later change is a new revision.

## Migration

None. No stored data, option, default or event detail changes.

## Open questions

- Late attach (risk R9): the element has no public getter of its normalized pricing, so a hook
  attached after `pricing-ready` cannot fill `pricing` and its snapshot stays `undefined` until the
  next event. Owner-facing answer: decision (b). It stays a documented limit in this phase (React
  guide, P3-15a), with no `normalizedPricing` getter. Option (a), a read-only element getter
  `normalizedPricing` (new element API, also in `custom-elements.json`) that seeds the snapshot
  together with `resolvedState`, stays a possible later slice after P3-8.
