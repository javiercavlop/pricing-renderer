# Design: add-react-headless

Decisions come from the plan (`docs/agent-work/phase3-react-headless/plan.md`, section 3), whose
recommendations the owner accepted for CRP-P3-A to CRP-P3-D, and from the intake facts. Line
numbers are at `88f5141`. D1 to D10 belong to part 1 (P3-S1); D11 and D12 summarise part 2 and the
examples, whose spec files P3-S2 writes.

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
  The selection store keeps one stabilizer per pricing object.

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

### D6. Headless subpath (CRP-P3-B)

`src/react/headless.ts` (`'use client'`) builds to `dist/react/headless.js`. `package.json` gets the
`./react/headless` export and the entry in the `package:check` list (`:143`); it is not added to
`sideEffects`. Type-only imports from `src/element` are allowed; runtime imports from `src/element`
are allowed only for modules that import no Lit (`current-selection.ts` imports only the core).
`src/react/index.ts` re-exports the whole headless entry.

### D7. Hooks are thin layers over framework-free stores (CRP-P3-D (a))

- Stores: a source store (`use-pricing-source.ts`), `selection-store.ts` and a renderer state store
  (`use-renderer-state.ts`). Each has `subscribe`, `getSnapshot` and actions, and is tested in node.
  Render-time paths are tested with `react-dom/server`; the wrapper with the `@lit/react` mock
  (`tests/unit/react-style-prop.test.ts:7-12`). Hook scenarios that need effects are tested on the
  store.
- Cached-snapshot rule (risk R4): every `getSnapshot` returns the same object until the store
  changes. `resolvedState` returns a fresh copy per read (`:493`), so the renderer state store never
  reads it in `getSnapshot`.
- `usePricingSource`: status `'loading' | 'ready' | 'error'`. Structural compare for `pricing`,
  `request` and `normalizeOptions`, identity for `yaml`, `src` and `loadPricing`, as the element
  (`:122-130`). Any failed load, inline or `src`, keeps the last successful pricing with `ready`
  (`:564`); a `src` load in flight keeps it too, with `loading`.
- Change members and their core step (`req~use-pricing-selection-changes~1`): `selectPlan(planId)`
  → `planSelectionChange` with a plan intent; `toggleAddOn(addOnId, selected)` →
  `planSelectionChange` with an add-on intent; `setVariable(path, value)` →
  `selectionWithVariable`; `setAddOnQuantity(addOnId, quantity)` → `selectionWithAddOnQuantity`;
  `setBillingPeriod(id)` → a copy with `billingPeriod`; `resetVariables()` → a copy with a copy of
  `pricing.variables`.
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
- The renderer state cannot see an `applySelection` call made on the element directly (silent by
  `req~apply-selection-silent~1`) or a change of a controlled `selection` prop; `applySelection` of
  the returned state refreshes the snapshot. The React guide (P3-15a) states both limits. This is a
  docs task, not a requirement, because no test reads the guide's prose.

### D8. Provider (CRP-P3-B)

- `PricingRendererProvider` props: `config` (`Partial<PricingRendererConfig>`), `messages`,
  `presentation`, `request`, `loadPricing`, `children`.
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
  reads it at construction.

### D9. SSR, React 18 and 19

- Allowed React APIs: `createContext`, `useContext`, `useState`, `useRef`, `useMemo`,
  `useCallback`, `useEffect`, `useSyncExternalStore`, `useId`, `forwardRef`, `createElement`,
  `Fragment`, and `useLayoutEffect` only behind a client check that falls back to `useEffect` on
  the server (React 18 warns about it in server rendering); from `react-dom`:
  `createPortal(children, container, key)`. Not allowed: `use`, ref as a prop, `useEffectEvent`,
  `useActionState`, `useOptimistic`.
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
- `hideSections` property and `hide-sections` attribute: `hero`, `metadata`, `billing`,
  `variables`, `plans`, `comparison`, `addOns`, `summary`; with `hero` hidden a visually hidden
  title keeps the shell's accessible name.

### D12. Examples (CRP-P3-D (a))

`react-router` is added to `examples/react` only (a lockfile change through a registered update
check). The Next example uses `next/link`. Both use an in-memory mock backend for the review flow.

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
  usual case; the open question below covers the rest.
- R10. The URL format becomes public. Mitigation: D4 fixed here; any later change is a new revision.

## Migration

None. No stored data, option, default or event detail changes.

## Open questions

- Late attach (risk R9): the element has no public getter of its normalized pricing, so a hook
  attached after `pricing-ready` cannot fill `pricing` and its snapshot stays `undefined` until the
  next event. This change specifies only the accepted CRP-P3-B shape. Options for the owner: (a) a
  read-only element getter `normalizedPricing` (new element API, also in `custom-elements.json`),
  then a new requirement that seeds the snapshot from it and `resolvedState`, in a slice after
  P3-8; (b) keep the documented limit. Recommended: (a).
