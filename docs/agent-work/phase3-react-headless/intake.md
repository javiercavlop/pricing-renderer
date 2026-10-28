# Intake: Phase 3, React headless and composition

- Planner intake, 2026-10-28. Read-only audit: no code, spec or test was changed.
- Base: `88f5141` (develop, "Docs: private pricings guide, pricing versions guide, theme builder
  section (#71)"). Every `file:line` below is at this base.
- Source: the owner request for Phase 3, as given in full in the task brief. It replaces the
  placeholder P3-0 of `docs/agent-work/pending-phases/plan.md:450-475`, which had no request text.
- Rule of the request: additive only. Code written for 0.1.0 must keep working.
- Phase 3 is listed as not started at `ROADMAP.md:164`. The phase 2 proposal deferred it:
  "Hooks and providers (`usePricing…`, context providers): Phase 3"
  (`openspec/changes/add-subscription-change-flow/proposal.md:120`).

## Owner request, as numbered items

1. Extract the selection logic of the element into core functions (for example
   `planSelectionChange` and `createPriceStabilizer`), used by the element and the hooks so they
   cannot drift. Export `applySelectionInput`. Add `selectionToSearchParams` and
   `selectionFromSearchParams`.
2. React hooks: `usePricingSource`, `usePricingSelection`, `usePricingRendererState(ref)`.
3. `PricingRendererProvider`: per-tree config, messages, presentation, `request` and `loadPricing`,
   replacing the module-global `configurePricingRenderer` for React apps. The global API keeps
   working.
4. Composition: `renderPlanCta`, `renderSummaryActions`, `renderLoading` and `renderError` props,
   built on slots that the element leaves in its markup and on React portals keyed by plan id.
   `hideSections` (for example `hero`), also as an element property.
5. The phase 2 review stays usable from the hooks (headless diff and component).
6. Examples: `examples/react` and `examples/next` show the hooks, the provider, a custom CTA with a
   router `Link`, the current plan and the review flow with a mocked backend.

## Item 1: selection logic in the element

### Where it lives today

The request points at `pricing-renderer-element.ts` "~480-528 and ~574-758". At this base the logic
spans `:476-494` and `:578-893`:

- Selection in effect:
  - `_isReady` `:476-478`.
  - `_selectionInEffect` `:480-484` (reconciles the effective selection).
  - `_effectiveSelection` `:578-585`: the controlled `selection` wins over the internal one, and
    with `variablesEnabled === false` the variables are replaced by the pricing defaults.
  - `_snapshot` `:486-494`, read by the `resolvedState` getter `:429-431`.
- Price stabilisation:
  - State `_lastValidPlanPrices` and `_lastValidAddOnPrices` `:209-210`, reset only on a successful
    load `:528-529`.
  - `_stabilizeResolvedPrices` `:598-649`: an `error` price is replaced by the last `amount` price of
    the same id; the replaced breakdown line takes the kept price's factors; the subtotal is folded
    again from the breakdown lines.
  - It is called by `_snapshot` `:490`, `_viewModel` `:653`, `_setSelection` `:691` and
    `_triggerAction` `:908`. Each call also records new valid prices, so even a getter read
    (`resolvedState`) updates the caches. An extraction must keep that.
- Selection changes:
  - `_setSelection` `:684-707`: reconciles, writes the internal selection only when uncontrolled,
    dispatches `pricing-selection-change` with the stabilized `resolved`.
  - `_selectPlan` `:709-738`: reconciles the plan change; no removed add-ons applies at once,
    otherwise it holds a `PendingAddOnChange` with `addOnId: ''`, `select: false`, `addIds: []`,
    `removeIds` and `planId`.
  - `_selectBilling` `:740-744`, `_updateVariable` `:746-752` (`setAtPath` on a clone),
    `_resetVariables` `:754-758`.
  - `_collectDependencies` `:760-770` (transitive `dependsOn`), `_selectedDependents` `:772-788`
    (transitive selected dependents, fixed-point loop).
  - `_toggleAddOn` `:790-830`: on select, the missing dependencies are added and the conflicts are
    removed (own `excludes`, add-ons that exclude it, and the `excludes` of each added dependency);
    on deselect, the selected dependents are removed. Any add or remove makes the change pending.
    It works on the effective selection, not the reconciled one, unlike `_selectPlan`.
  - `_applyAddOnChange` `:832-856`: a new entry's quantity is the current one, else
    `subscriptionConstraints.minQuantity`, else 1; a plan change sets the plan and the removals in
    one `_setSelection`.
  - `_updateAddOnQuantity` `:858-875` (through `normalizeAddOnQuantity`).
  - `_confirmAddOnChange` `:877-881`, `_cancelAddOnChange` `:884-888`, focus restore `:890-893`.
- What stays in the element: focus handling (`:730-737`, `:819-826`, `:855`, `:887`), the dialog
  keyboard trap `:993-1020` and the dialog markup `renderPendingDialog`
  (`src/element/renderers.ts:1550-1606`).
- The pending type `PendingAddOnChange` is declared in `src/element/events.ts:72-78` and exported
  from `pricing-renderer/element` (`src/element/index.ts:14`). The core cannot import from the
  element, so a core function that returns it needs the type in `src/core/types.ts`, re-exported by
  `events.ts` under the same name.

### `applySelectionInput`

- Defined in `src/core/apply-selection.ts:17-100`, used by `applySelection`
  (`pricing-renderer-element.ts:454-458`).
- It is deliberately not exported: `src/core/index.ts:1-123` has no entry for it, and
  `tests/unit/apply-selection.test.ts:69-73` asserts
  `expect(Object.keys(core)).not.toContain('applySelectionInput')` under
  `[utest->req~apply-input-internal~1]`. The requirement is
  `docs/agent-work/delivera-2-load-current-contract/spec.md:62-64`, with the rationale at `:924`.
- The phase 2 design also calls it internal
  (`openspec/changes/add-subscription-change-flow/design.md:9`).
- Exporting it therefore supersedes a pinned requirement. The spec slice must replace
  `req~apply-input-internal~1` and the test-designer must flip the test; an implementer cannot do it
  alone.

### Search params

- Nothing exists: no `URLSearchParams`, `searchParams` or query helper in `src/`.
- The core compiles with `"lib": ["ES2021"]` and `"types": []` (`tsconfig.core.json:4-5`), so
  `URLSearchParams` is not a known type in `src/core`. A core signature has to use
  `Iterable<[string, string]>` (which `URLSearchParams` satisfies) or plain strings.
- Reading must go through `applySelectionInput`, so unknown ids produce the existing
  `PR_SELECTION_UNKNOWN_*` warnings instead of new codes.

### Other pure helpers the hooks need

- `deriveCurrentContext` and `currentSelectionDiagnostics` live in
  `src/element/current-selection.ts:27-80` and import only the core. `relationOf` with
  `currentSelection` needs them.
- `planRelation` is internal in `src/core/plan-relation.ts:9-19`.
- `planCtaView`, `summaryActionState`, `expandCtaHref` and the action ids are in
  `src/element/cta.ts:13-160` (core imports only).
- None of these is exported from a package entry today.

### Tests that pin the behaviour

- Unit (node, `vitest.config.ts:5-6`, `tests/unit/**/*.test.ts` only):
  - `tests/unit/apply-selection.test.ts` (24 requirement tags), `tests/unit/reconcile.test.ts`,
    `tests/unit/space-contract.test.ts:10,63`.
  - `tests/unit/dependency-names.test.ts:6,117` imports `PendingAddOnChange` from
    `src/element/events.js`.
  - No unit test covers `_toggleAddOn`, `_selectPlan`, `_applyAddOnChange` or
    `_stabilizeResolvedPrices`. A grep for `stabiliz`, `lastValid` or `toggleAddOn` in
    `tests/unit` only finds `toggleAddOn: noop` in render-action stubs.
- Browser only (`tests/browser/pricing-renderer.spec.ts`):
  - last valid price `:125`, add-on dependency confirmation `:162`;
  - plan change: immediate `:242`, confirmation `:259`, pending shape `:276`, apply `:291`, cancel
    `:308`, Escape `:324`, dropped on reload `:386`;
  - reconciled events `:339`, `:362`; invalid controlled selection `:400`; controlled selection
    untouched `:432`;
  - breakdown in `resolvedState` and events `:1547`, `:1560`; stabilized breakdown `:1582`.
- So the extraction needs node characterization tests first (factory refactoring rule); the
  browser specs are the second net and run only in the CI `browser-shards`.

## Item 2: React hooks

### What exists

- `src/react/index.ts` is two `@lit/react` wrappers: `PricingRenderer` (`:31-121`) and
  `PricingChangeReview` (`:123-161`), plus type re-exports (`:163-182`). No hook, no context.
- The module starts with `'use client'` (`:1`) and imports `../element/define.js` for its side
  effect (`:28`); `package.json:76-81` lists `./dist/react/index.js` under `sideEffects`. Importing
  anything from `pricing-renderer/react` registers the element and loads Lit.
- `usePricingSource` would repeat the element's load logic, `reload()` at
  `pricing-renderer-element.ts:367-424`: exactly one source, `PR_SOURCE_MISSING` and
  `PR_SOURCE_CONFLICT` diagnostics, abort of the load in flight, a sequence number against stale
  results, `normalizePricing` / `parsePricingYaml` / `loadPricingFromUrl`
  (`src/yaml/index.ts:1-2`). That is a second drift point, not named in the request.
- `usePricingRendererState(ref)` would read the `resolvedState` getter (`:429-431`). It returns a
  fresh deep copy on every read (`_snapshot` `:493`). `useSyncExternalStore` needs a cached
  snapshot, otherwise React re-renders without end; the store must cache the last event detail.
- Events: `pricing-ready` carries `pricing`, `diagnostics`, `selection` and `resolved`
  (`src/element/events.ts:11-16`); `pricing-selection-change` carries `selection` and `resolved`
  (`:18-21`). `applySelection` is silent by requirement (`req~apply-selection-silent~1`,
  `pricing-renderer-element.ts:459`), and a controlled `selection` change emits nothing. A store fed
  only by the two events misses both cases.

### Test environment

- Unit tests run in `node` with no DOM (`vitest.config.ts:5`) and only `*.test.ts` files (`:6`).
- `react` and `react-dom` 19 are dev dependencies (`package.json:113-114`); no `jsdom`,
  `happy-dom` or testing library is installed.
- Precedent for React tests without a DOM: `tests/unit/react-style-prop.test.ts:7-12` mocks
  `@lit/react` and checks types with an in-memory TSX snippet; `tests/unit/ssr.test.ts:9-13`
  imports the adapter with no `customElements`.
- `react-dom/server` renders without effects, so effect-driven state (a `src` load, subscriptions)
  cannot be observed in node. Either the hooks are thin layers over framework-free stores tested in
  node, or a DOM environment is added as a dev dependency (a lockfile change).
- Playwright serves only the vanilla demo (`playwright.config.ts:45-50`, `pnpm demo`). The React and
  Next examples are only built in CI (`.github/workflows/ci.yml:50-52`), never driven by a browser
  test.

## Item 3: provider and the module-global config

- The global: `let configuredDefaults` (`src/core/config.ts:12`), set by `configurePricingRenderer`
  (`:86-91`), read by `getPricingRendererConfig` (`:93-95`).
- The element reads it once, in its constructor (`pricing-renderer-element.ts:224-239`): `locale`,
  `pricingPath`, `selectionEnabled`, `ctaEnabled`, `variablesEnabled` and the private readonly
  `_projectPresentation`. A later `configurePricingRenderer` call does not reach an element that
  already exists.
- Presentation precedence today (`docs/configuration.md:279-290`): instance `presentation`, then
  project defaults, then `custom.pricingRenderer` in the YAML. A provider adds one layer between
  instance and global; the element merges at `pricing-renderer-element.ts:593` through
  `mergePresentationOptions` (`src/core/view-model.ts:281-300`).
- Message catalogs are a second global: `registeredCatalogs` (`src/core/i18n.ts:278`) and
  `registerMessageCatalog` (`:291`). The element also has a per-instance `messages` property
  (`pricing-renderer-element.ts:146`).
- Risk, SSR: both examples call `configurePricingRenderer` at module level in a client module
  (`examples/react/src/main.tsx:8-14`, `examples/next/app/pricing-client.tsx:6-12`). In Next that
  module is also evaluated on the server, so the config is process-wide and shared by every request.
  The provider removes that for React apps.
- Tests that pin the global: `tests/unit/pricing.test.ts:5,22,44,68-82`. Docs: `README.md:166-168`,
  `README.md:276`, `docs/configuration.md:7-21`, `docs/i18n.md:14-16`, `docs/api-reference.md:11`.
  All of them stay valid.

## Item 4: composition, slots and `hideSections`

### Markup that slots would replace

- Plan CTA: `renderPlanCta` (`src/element/renderers.ts:349-394`), called once per card at `:532`.
- Summary action: `renderSummaryAction` (`:1448-1468`) inside `renderSummary` (`:1473-1506`).
- Loading and error states: `render()` in the element (`pricing-renderer-element.ts:1062-1111`).
- The element renders into the light DOM (`createRenderRoot` returns `this`, `:280-282`), so React
  children passed to `<PricingRenderer>` would collide with Lit's own render. Portals into nodes that
  Lit created, and never fills, are the safe route: Lit does not touch the children of an element it
  rendered without a child binding.

### The non-keyed plan map

- The request points at `renderers.ts` "~319". At this base `:308` is the billing period map and
  `:319` is inside it; the plan map is `viewModel.plans.map(...)` at `:415-535`.
- With a plain `map`, Lit reuses DOM by index. After a reload, a visibility change or any change of
  the plan list, the node of index `i` gets another plan's attributes and keeps the children that a
  portal put there. A CTA portal for plan A would then sit in plan B's card.
- Keyed rendering already exists for add-ons: `repeat()` at `:1257-1266`.
- Cost of switching the whole plan map to `repeat()`: the unit tests flatten Lit templates with
  local helpers, and several return `''` for a directive result, for example
  `tests/unit/variable-field-describedby.test.ts:29` and
  `tests/unit/element-instance-ids.test.ts:81`. Plan-card assertions in tests such as
  `tests/unit/state-attributes.test.ts:30-40` would see no cards. About 20 test files carry such a
  helper (`grep "flatten(values" tests/unit`); only four unwrap `repeat()`
  (`addon-grid.test.ts:78`, `addon-grid-fixtures.test.ts:56`, `addon-grid-filter.test.ts:72`,
  `no-plans.test.ts:55`).
- A cheaper route: keep the `map`, and only when a slot is requested wrap the CTA slot node in
  `keyed(plan.id, ...)` (`lit/directives/keyed.js`), so the slot node is replaced whenever the plan at
  that index changes. Existing tests render without slots and do not change.

### Render-state contract

- Every renderer test builds a full `RenderActions` object (for example
  `tests/unit/state-attributes.test.ts:10-26`, and about 20 other files with `toggleAddOn: noop`).
  A new required member of `RenderActions` (`renderers.ts:38-62`) or `RenderState` (`:64-91`) breaks
  all of them; new members must be optional.

### `hideSections`

- Sections: `renderHeader` (part `hero`, `renderers.ts:278-299`), `renderCatalogMetadata`
  (`metadata`, `:1508-1548`), `renderBilling` (`billing`, `:301-332`), `renderVariables` (`:641`),
  `renderPlans` (`plans`, `:396-540`), `renderComparison` (`:960`), `renderAddOns` (`:1328`),
  `renderSummary` (`summary`, `:1473`), and the composition in the element at
  `pricing-renderer-element.ts:1177-1178`.
- Accessibility risk: the shell section is labelled by the hero title,
  `aria-labelledby=${instanceId(state, 'title')}` (`:1153`), and that id is set only in the hero
  (`renderers.ts:288`). Hiding `hero` leaves the shell without an accessible name unless a hidden
  title or an `aria-label` takes its place.
- A new property and attribute must also go into `custom-elements.json` (checked by
  `tests/unit/custom-elements.test.ts:18-28`), `src/react/index.ts:66-105` and
  `docs/api-reference.md:431-473`.

### How React learns where the slots are

- The loading state has no event: `reload()` sets `loading` and calls `requestUpdate()`
  (`pricing-renderer-element.ts:402-403`). `pricing-ready` comes only on success (`:556-562`), and a
  failed load emits only `pricing-diagnostic` (`:566-573`). The React layer therefore needs a signal
  when slot nodes appear or go: a new element event, or a `MutationObserver` in the React layer.

## Item 5: the phase 2 review from the hooks

- Headless diff: `compareSelections` is public (`src/core/index.ts:7`, `src/core/compare.ts:332`);
  input type `SelectionComparisonInput` (`src/core/types.ts:396`).
- Component: `PricingChangeReview` (`src/react/index.ts:123-161`) takes a `comparison`; it registers
  its tag on render (`:150-159`), a no-op without a registry.
- The element computes the summary action's relation with `compareSelections` against the current
  selection (`pricing-renderer-element.ts:662-672`). A hook that offers the review needs the same
  call: `before` is the current selection, `after` the selection in effect.
- The examples do not use the review today: a grep for `ChangeReview` or `compareSelections` in
  `examples/` only finds the import `examples/vanilla/src/main.ts:14`. The full flow, with three host
  routes, is documented in `docs/change-subscription-flow.md:147-196` and `:197-383`.
- Tests: `tests/unit/change-review.test.ts`, `tests/unit/change-review-renderers.test.ts`,
  `tests/browser/change-review-ui.spec.ts`, `tests/browser/change-review-data.spec.ts`.

## Item 6: examples

- `examples/react`: one file, `src/main.tsx:1-33`, with the global config and `<PricingRenderer yaml>`.
  Dependencies are React 19 and Vite only (`examples/react/package.json:9-20`); no router.
- `examples/next`: `app/pricing/page.tsx:1-85` (server component with an inline YAML) and
  `app/pricing-client.tsx:1-25` (client island with the global config). Next `16.4.3` and React
  `19.2.0` (`examples/next/package.json:8-13`); `next/link` is available.
- A router `Link` in the React example needs a router: a new dependency of the example (a lockfile
  change) or a minimal in-example link. The Next example can use `next/link`.
- CI builds both after `package:check` (`ci.yml:49-52`); the builds resolve
  `pricing-renderer: workspace:*` to `dist/`, so `package:check` (or `build`) must run first.

## Package, SSR and React 18/19 facts

- Exports: `package.json:32-67`. The `package:check` script lists the attw entry points explicitly:
  `. ./yaml ./element ./define ./react ./space ./define-change-review` (`:143`). A new subpath must
  be added in both places and in `tsconfig.react.json` if it lives outside `src/react`.
- Peers: `react` and `react-dom` `^18.2.0 || ^19.0.0`, both optional (`package.json:82-93`).
  `createPortal` comes from `react-dom`, which is already a peer, so no new peer dependency is needed.
  `@lit/react ^1.0.8` is a dependency (`:95`).
- `tsconfig.react.json:6-11`: `rootDir` is `src/react`, `jsx: react-jsx`, references the core and
  element projects. `src/react/headless.ts` would build to `dist/react/headless.js`.
- Types are checked against `@types/react ^19` only (`package.json:106-107`); no CI job builds or
  type-checks against React 18. Hooks must stay within the API common to 18.2 and 19:
  `useSyncExternalStore`, `useId`, `forwardRef`, `createPortal(children, container, key)`; no `use`,
  no ref-as-prop.
- React 18 and 19 StrictMode run effects twice in development: a `src` load must be abortable and
  idempotent, as the element's is (`pricing-renderer-element.ts:398-401,420-422`).
- SSR:
  - The element is not server-rendered: on the server `@lit/react` outputs the bare tag.
    Portals have no target until the element renders on the client, so render props run after
    hydration. Server and first client render both render no portal, so there is no hydration
    mismatch, but the custom CTA appears one paint later.
  - `pricing` and `yaml` sources can resolve during render (pure and SSR-safe, as
    `tests/unit/ssr.test.ts:4-7` shows for the core); `src` loads only in an effect.
  - `useSyncExternalStore` needs a `getServerSnapshot` that returns `undefined` for the element
    state.
  - A headless-only consumer of `pricing-renderer/react` still loads Lit and registers the element
    (`src/react/index.ts:28`). A separate subpath for the hooks and the provider avoids that.
- Docs that describe the React adapter: `README.md:224-263`, `docs/api-reference.md:1053-1119`.
- Release rule: no release until the owner says so (`ROADMAP.md:137-148`); each slice adds a pending
  changeset.

## Risks

- R1, drift during the extraction: the element logic has no unit tests (item 1). Mitigation:
  characterization tests of the new core functions first, then the element refactor, with the browser
  specs listed above green in CI.
- R2, `applySelectionInput` export reverses `req~apply-input-internal~1`. Mitigation: spec slice and
  test flip before the implementer.
- R3, the non-keyed plan map puts portal content in the wrong card. Mitigation: `keyed()` slot nodes,
  or `repeat()` with the test helpers updated in the same slice.
- R4, `useSyncExternalStore` with an uncached `resolvedState`: endless re-render. Mitigation: a store
  that caches the last detail and refreshes on `applySelection` calls made through the hook.
- R5, module-global config shared across server requests. Mitigation: the provider, and docs that
  steer React apps to it.
- R6, hiding `hero` removes the accessible name of the shell. Mitigation: a visually hidden title
  that stays.
- R7, React 18 compatibility is not exercised in CI. Mitigation: hooks limited to the shared API;
  a followup for a React 18 type or build check.
- R8, file contention with the pending phase 1c chain on `src/element/renderers.ts` and with the
  phase 1b chain on `docs/api-reference.md` and `README.md`
  (`docs/agent-work/pending-phases/plan.md:503-517`).
