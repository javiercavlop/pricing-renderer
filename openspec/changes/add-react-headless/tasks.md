# Tasks: add-react-headless

Rules for every slice:

- One PR into `develop` per slice, at most about 300 diff lines with tests. A slice that touches
  `src/` or `package.json` adds one pending changeset (minor for new API, patch otherwise). No
  release (`ROADMAP.md:137-148`).
- Exception: the spec PR is larger. It holds both spec slices, P3-S1 and P3-S2, and their review
  fixes: six delta specs with about 120 requirements (117 `### Requirement` headings by grep before
  the round-2 panel fixes) and about 1,950 lines (sum of line counts of `specs/*/spec.md`, 1,909
  before those fixes), plus `proposal.md`, `design.md` and `tasks.md` (about 1,100 lines), counted
  on 2026-10-28; the final numbers are recounted the same way on the PR head and written in the PR
  text. Each obligation of CRP-P3-A to CRP-P3-C is one requirement with its own scenario.
  The size needs the owner's waiver for the whole PR; it adds no code.
- Additive only: no existing export, property, attribute, event field or part changes meaning.
- Code slices are a test task (test-designer, red before, G3) and an implementer task in the same
  PR that touches no test file (G4). "T/I" marks that pair.
- G3 limit (accepted, R1-TST-013): `red(...)` runs vitest files only. A requirement or scenario
  that needs a browser is verified by the green CI `browser-shards` run of the PR that adds its
  spec, not by a red-before check. "Browser-only requirements" below lists them.
- Slices open at the same time own disjoint files. A file listed in two slices is edited in the
  order of "Order and shared files", after the earlier slice is merged.
- Every requirement is traced: `[impl->req~<name>~<rev>]` in code, `[utest->req~<name>~<rev>]` in
  tests, unit and browser alike (the browser specs carry `utest` tags today, for example
  `tests/browser/plan-cta.spec.ts`).
- No feature flag (design.md, D10). Browser proof comes from the CI `browser-shards` artifacts.

Checks (names used per slice; `docs/agent-work/phase3-react-headless/plan.md at commit 07f10bf515d53e19b2a5fbc5abe5b2dddb74fa26 (git show 07f10bf5:docs/agent-work/phase3-react-headless/plan.md), section 2`):

- `install`: `["pnpm","install","--frozen-lockfile"]`
- `type`: `["pnpm","run","typecheck"]`
- `lint`: `["pnpm","run","lint"]`
- `test`: `["pnpm","run","test"]`
- `fmt`: `["pnpm","run","format:check"]`
- `pkg`: `["pnpm","run","package:check"]`
- `react-demo`: `["pnpm","--filter","pricing-renderer-react-demo","build"]`, after `pkg`
- `next-demo`: `["pnpm","--filter","pricing-renderer-next-demo","build"]`, after `pkg`
- `spec`: `["openspec","validate","add-react-headless","--strict"]`, the array registered in the
  lab for P3-S1; `openspec` is not in `package.json` and the lab provides the binary
  (the plan at commit 07f10bf5, section 2, wrote it with `pnpm exec`)
- `unit(<files>)`: `["pnpm","exec","vitest","run",<files...>]`
- `red(<files>)`:
  `{"argv":["pnpm","exec","vitest","run",<files...>],"type":"red_before","expect_exit":[1],"expect_pattern":"AssertionError|expected","reject_pattern":"Cannot find module|SyntaxError|is not a function","overlay":[<files...>]}`.
  A test of a module that does not exist yet imports the entry that will re-export it and asserts
  `toBeTypeOf('function')` first. A module that no entry re-exports (the stores of P3-6, P3-7a and
  P3-8) is loaded with `const mod = await import('<path>').catch(() => ({}))`, followed by
  `expect(mod.<factory>).toBeTypeOf('function')`, so the base fails on an assertion.
  In both forms the `toBeTypeOf('function')` assertion of each new function runs before its first
  call, in a `beforeAll` of the file or as the first assertion of every test that calls it: a test
  that calls the missing function first fails with "is not a function", which `reject_pattern`
  refuses.
- Module mocks: `vi.mock` is hoisted and applies to every test of its file, so one file cannot hold
  scenarios that need a module real (`react` for `renderToString`) and scenarios that need it
  mocked (`react`, `react-dom` or `@lit/react`). Where a slice needs both (P3-6, P3-8, P3-12) the
  test-designer writes a second file `<name>-mocked.test.ts` and the scenarios that need the module
  mocked go there: `tests/unit/use-pricing-source-mocked.test.ts` (P3-6),
  `tests/unit/renderer-state-store-mocked.test.ts` (P3-8) and `tests/unit/react-slots-mocked.test.ts`
  (P3-12). Both files of each pair are in that slice's `red(...)` check. `vi.doMock` with
  `resetModules` is not used.
- `full` = `install`, `type`, `lint`, `test`, `fmt`. `docs` = `install`, `test`, `fmt`.

## Wave 0: spec

- [x] P3-S1 Spec part 1 (specifier, risk medium).
  - Files: `proposal.md`, `design.md`, `tasks.md`,
    `specs/{selection-logic,search-params,react-hooks,react-provider}/spec.md`.
  - Checks: `install`, `spec`, `fmt`. Gates G1, G2.
- [x] P3-S2 Spec part 2 (specifier, risk medium; in the same spec PR as P3-S1).
  - Files: `specs/{composition,hide-sections}/spec.md` (design.md, D11 and D13).
  - Checks: `install`, `spec`, `fmt`. Gates G1, G2.

## Wave 1: core extraction (item 1)

- [ ] P3-1T Characterization tests (test-designer, risk medium; after P3-S1).
  - Files: `tests/unit/selection-change.test.ts` (new), `tests/unit/price-stabilizer.test.ts` (new),
    `tests/unit/apply-selection.test.ts` (only the block at `:69-73`, flipped, design.md D2).
  - Requirements: every `req~core-*`, every `req~price-stabilizer-*`,
    `req~selection-logic-exported~1`, `req~pending-change-type-shared~1`,
    `req~apply-input-exported~1`.
  - Checks: `install`,
    `red(tests/unit/selection-change.test.ts tests/unit/price-stabilizer.test.ts tests/unit/apply-selection.test.ts)`,
    `lint`, `fmt`.
- [ ] P3-1I Core functions (implementer, risk medium; same PR as P3-1T).
  - Files: `src/core/selection-change.ts` (new), `src/core/price-stabilizer.ts` (new),
    `src/core/types.ts`, `src/core/index.ts`, `src/element/events.ts` (type re-export only),
    `.changeset/core-selection-logic.md`.
  - Change: design.md D1 to D3, copied from the element; the element is not touched.
  - Checks: `full`, `pkg`,
    `unit(tests/unit/selection-change.test.ts tests/unit/price-stabilizer.test.ts tests/unit/apply-selection.test.ts tests/unit/dependency-names.test.ts)`.
  - Split point: if the P3-1T/P3-1I PR grows past 300 lines it becomes two T/I PRs. First the
    selection change: `tests/unit/selection-change.test.ts`, the block of
    `tests/unit/apply-selection.test.ts`, `src/core/selection-change.ts`, `src/core/types.ts`,
    `src/element/events.ts`, its exports in `src/core/index.ts` and the changeset; requirements
    every `req~core-*`, `req~pending-change-type-shared~1` and `req~apply-input-exported~1`. Then
    the price stabilizer: `tests/unit/price-stabilizer.test.ts`, `src/core/price-stabilizer.ts` and
    its export; every `req~price-stabilizer-*` and `req~selection-logic-exported~1`, which reads all
    six function names, `createPriceStabilizer` included. Later slices that wait for "P3-1I merged"
    (P3-2T, P3-2, P3-3, P3-7a) then wait for the second PR.
- [ ] P3-2T Kept-line doc test (test-designer, risk low; after P3-1I merged; same PR as P3-2).
  - Files: `tests/unit/phase0-docs.test.ts` only (the test at `:117-125`).
  - Why: that test reads `src/element/pricing-renderer-element.ts` and slices from
    `const keptLine`; once P3-2 moves `_stabilizeResolvedPrices` into the core, its `indexOf`
    returns -1.
  - Change: read `src/core/price-stabilizer.ts` (merged with P3-1I), slice from its kept-line
    construction, keep the five field assertions and the tag
    `[utest->req~breakdown-kept-price-doc~1]`. The test passes before and after P3-2, so it has no
    red-before check.
  - Checks: `install`, `unit(tests/unit/phase0-docs.test.ts)`, `lint`, `fmt`.
- [ ] P3-2 The element uses the core (refactorer, risk high; after P3-1I merged; same PR as P3-2T).
  - Files: `src/element/pricing-renderer-element.ts`. The refactorer touches no test file.
  - Change: `:578-585`, `:598-649` and `:709-875` become calls to the core; focus, dialog and
    events stay. No changeset unless review asks.
  - Checks: `full`, `pkg`,
    `unit(tests/unit/selection-change.test.ts tests/unit/price-stabilizer.test.ts tests/unit/phase0-docs.test.ts)`; CI
    `browser-shards` green, in particular `tests/browser/pricing-renderer.spec.ts:125-432,1547-1600`.
- [ ] P3-3 Search params (T/I, risk medium; after P3-1I merged, parallel with P3-2).
  - Files: `tests/unit/selection-search-params.test.ts` (new, test task),
    `src/core/search-params.ts` (new), `src/core/index.ts`, `.changeset/selection-search-params.md`.
  - Requirements: every `req~search-params-*`, that is `req~search-params-write~1`,
    `-write-variables~1`, `-read~1`, `-read-addon-quantity-nan~1`, `-read-repeated-addon~1`,
    `-var-text~1`, `-var-type-unchecked~1`, `-var-path-safe~2`, `-var-path-split~1`,
    `-var-proto-keys~1`, `-read-no-throw~1`, `-var-length-limit~1`, `-var-depth-limit~1`,
    `-entry-limit~1`, `-diagnostic-id-length~1`, `-unknown-ids~1`, `-prefix~1`, `-round-trip~2`,
    `-round-trip-variables~1` and `-no-dom~1` (design.md D4).
  - Checks: `full`, `pkg`, `red(tests/unit/selection-search-params.test.ts)`.
  - Split point: if the PR grows past 300 lines it becomes two T/I PRs on the same files. First the
    writer and the reader: every requirement above except the four URL-input limits, so the path,
    prototype-key and no-throw rules ship with the first reader. Then
    `req~search-params-var-length-limit~1`, `-var-depth-limit~1`, `-entry-limit~1` and
    `-diagnostic-id-length~1`.
- [ ] P3-4 Shared source load (T/I, risk medium; after P3-2 merged).
  - Files: `tests/unit/load-source.test.ts` (new, test task), `src/yaml/source.ts` (new),
    `src/yaml/index.ts`, `src/element/pricing-renderer-element.ts` (`reload()` only),
    `.changeset/load-pricing-source.md`.
  - Requirements: `req~load-source-one-source~1` (the one-source rule and its diagnostics) and
    `req~load-source-result~1` (design.md D5). The provider origin rule
    (`req~provider-request-origin~1`) is not part of `loadPricingSource`: the provider-aware callers
    filter the request before the call (P3-5, P3-6).
  - Request bounds (lead decision R2-REV-002): the rule that replaces a `maxBytes` that is not a
    positive finite number, or a `timeoutMs` that is not a positive finite number at most
    2147483647, by its default applies on the hook path only, that is to `loadPricingSource` as
    `usePricingSource` calls it, through the store of P3-6. `req~load-source-request-bounds~1` is
    implemented and tested in P3-6, not here. The element's `reload()` keeps passing `request` to
    `loadPricingFromUrl` as given; how the element skips the bounds is in design.md D5.
  - Element case of the test task, in node with stubs (as `tests/unit/error-state.test.ts` does):
    `reload()` with `src` set, `request` `{ maxBytes: -1, timeoutMs: NaN }` and a `loadPricing`
    spy, whose call gets `maxBytes` -1 and `timeoutMs` `NaN` unchanged. It passes on the base.
  - Checks: `full`, `pkg`, `red(tests/unit/load-source.test.ts)`,
    `unit(tests/unit/load-reload-pending.test.ts tests/unit/element-stale-load.test.ts tests/unit/load.test.ts)`;
    CI `browser-shards` (`element-stale-load.spec.ts`, `element-reconnect.spec.ts`).

## Wave 2: provider and hooks (items 2, 3, 5)

- [ ] P3-5 Headless entry and provider (T/I, risk medium; after P3-S1, parallel with wave 1).
  - Files: `tests/unit/react-provider.test.ts` (new, test task), `tests/unit/ssr.test.ts` (test
    task), `tests/unit/density.test.ts`, `tests/unit/react-style-prop.test.ts` and
    `tests/unit/spectra-followups-react.test.ts` (test task, see the wrapper rule),
    `src/react/headless.ts` (new), `src/react/provider.ts` (new), `src/react/index.ts`,
    `package.json` (export `./react/headless`, `package:check` entry list),
    `.changeset/react-provider.md`.
  - Requirements: `req~react-headless-entry~1`, `req~react-entry-reexports-headless~1`,
    `req~react-hooks-common-api~1`, `req~react-headless-no-new-peer~1`, and the wrapper side of
    every `req~provider-*`: `req~provider-config-precedence~1`,
    `req~provider-presentation-precedence~1`, `req~provider-messages-merge~1`,
    `req~provider-request-loader~1`, `req~provider-request-origin~1` (scenario "Wrapper on a
    foreign origin"), `req~provider-nearest~1`, `req~provider-no-global-write~1` and
    `req~provider-absent-unchanged~2`.
  - Origin rule (design.md D8): the request filter lives in `src/react/provider.ts`; the wrapper
    applies it here to the `request` it passes the element, and `usePricingSource` reuses it in
    P3-6. `loadPricingSource` (P3-4) does not apply it.
  - Wrapper structure (design.md D8): `PricingRenderer` stays a `forwardRef` component whose
    `render` function reads the provider with `useContext`. The three direct-render files above
    call `PricingRenderer.render(props, null)` outside React and then `rendered.type(rendered.props)`
    (`tests/unit/react-style-prop.test.ts:75-91`, `tests/unit/density.test.ts:274-289`,
    `tests/unit/spectra-followups-react.test.ts:71-89`), which a hook in `render` breaks. The test
    task rewrites those calls to `renderToString` from `react-dom/server` with the existing
    `@lit/react` mock and reads the recorded props, keeping each assertion and tag.
  - Checks: `full`, `pkg`,
    `red(tests/unit/react-provider.test.ts tests/unit/ssr.test.ts)`,
    `unit(tests/unit/density.test.ts tests/unit/react-style-prop.test.ts tests/unit/spectra-followups-react.test.ts)`.
- [ ] P3-6 `usePricingSource` (T/I, risk medium; after P3-5 and P3-4).
  - Files: `tests/unit/use-pricing-source.test.ts` and
    `tests/unit/use-pricing-source-mocked.test.ts` (new, test task),
    `src/react/use-pricing-source.ts` (new), `src/react/headless.ts`,
    `.changeset/use-pricing-source.md`.
  - Requirements: every `req~use-pricing-source-*` (`-render~1`, `-stable~1`, `-src-effect~1`,
    `-abort~1`, `-reload~1`, `-stale-load~1`, `-success~1`, `-failure-keeps-pricing~1`),
    `req~load-source-request-bounds~1` (`createSourceStore` applies the bounds before it calls
    `loadPricingSource`; lead decision R2-REV-002, see P3-4), the hook side of
    `req~provider-request-loader~1` and of `req~provider-request-origin~1` (scenarios "Foreign
    origin gets no Authorization" and "Listed origin on a server", with the request filter of P3-5).
  - Checks: `full`, `pkg`,
    `red(tests/unit/use-pricing-source.test.ts tests/unit/use-pricing-source-mocked.test.ts)`.
- [ ] P3-7a Selection store (T/I, risk high; after P3-1I merged).
  - Files: `tests/unit/selection-store.test.ts` (new, test task), `src/react/selection-store.ts`
    (new, framework-free).
  - Requirements: `req~use-pricing-selection-changes~1`, `-notify~1`, `-controlled~1`,
    `-uncontrolled~1`, `-pricing-change~1`, `-pending~1`, `-confirm-input~1`, `-apply~1`,
    `-current~1`, `-compare~1`, and `req~react-no-module-state~1` (the static scan of
    `src/react/**/*.ts` in the test file, which keeps guarding every later `src/react` module
    through `test`; the impl tag on the store's own `createPriceStabilizer()` call, design.md D3).
  - No changeset, an exception to the rule above: the store is a new internal module that no
    package entry exports and nothing imports yet, so the published API and behaviour do not
    change; P3-7b, which exposes it through `usePricingSelection`, adds the changeset.
  - Checks: `full`, `red(tests/unit/selection-store.test.ts)`.
- [ ] P3-7b `usePricingSelection` and the review from hooks (T/I, risk medium).
  - After: P3-7a and P3-6 merged.
  - Files: `tests/unit/use-pricing-selection.test.ts` (new, test task),
    `src/react/use-pricing-selection.ts` (new), `src/react/headless.ts`,
    `.changeset/use-pricing-selection.md`.
  - Requirements: `req~use-pricing-selection-state~1`, `req~use-pricing-selection-view-model~2`,
    the type-check of
    `req~use-pricing-selection-compare~1`, the hook side of `req~provider-config-precedence~1`,
    `req~provider-presentation-precedence~1`, `req~provider-messages-merge~1`,
    `req~provider-nearest~1`, `req~provider-no-global-write~1` and `req~provider-absent-global~1`.
  - Checks: `full`, `pkg`, `red(tests/unit/use-pricing-selection.test.ts)`.
- [ ] P3-8 `usePricingRendererState(ref)` (T/I, risk medium).
  - After: P3-7b merged.
  - Files: `tests/unit/renderer-state-store.test.ts` and
    `tests/unit/renderer-state-store-mocked.test.ts` (new, test task),
    `src/react/use-renderer-state.ts` (new), `src/react/headless.ts`,
    `.changeset/use-renderer-state.md`.
  - Requirements: every `req~renderer-state-*`. Late attach: decision (b), a documented limit in
    this phase (P3-15a), no `normalizedPricing` getter (design.md, "Open questions"); option (a)
    stays a possible later slice.
  - Checks: `full`, `pkg`,
    `red(tests/unit/renderer-state-store.test.ts tests/unit/renderer-state-store-mocked.test.ts)`.

## Wave 3: composition (item 4; after CRP-P3-C and P3-S2)

- [ ] P3-10 `hideSections` (T/I, risk medium; after P3-4 and P3-5).
  - Files: `tests/unit/hide-sections.test.ts` (new, test task),
    `tests/browser/hide-sections.spec.ts` (new, test task),
    `src/element/pricing-renderer-element.ts` (property, attribute and the exported
    `hideSectionsConverter`, next to `onlyDifferencesConverter`), `src/element/index.ts` (type
    `PricingSectionName`), `src/element/renderers.ts` (one optional `RenderState` field that
    makes `renderAddOns` skip its `renderSummary` call, see the note), `custom-elements.json`,
    `src/react/index.ts`, `.changeset/hide-sections.md`.
  - Requirements: those of `specs/hide-sections` (P3-S2): `req~hide-sections-property~1`,
    `req~hide-sections-attribute-converter~1`, `req~hide-sections-render~1`,
    `req~hide-sections-addons-summary~1`, `req~hide-sections-hero-name~1`,
    `req~hide-sections-unknown~1` and `req~hide-sections-react-manifest~1`.
  - Test split: the unit file builds the element in node, runs `reload()` with stubs and checks
    markup presence through `flatten(element.render())` (as `tests/unit/error-state.test.ts:237-244`
    does), and tests
    `hideSectionsConverter` directly. The browser spec holds the scenarios that need a DOM: "Attribute
    to property" (`setAttribute`), "Hero hidden" (`aria-labelledby` lookup and accessible name) and
    "Unknown and differently cased tokens" (`setAttribute`).
  - Note on `req~hide-sections-addons-summary~1`: `renderAddOns` draws the summary inside
    `section[data-pr-part=add-ons]` (`src/element/renderers.ts:1350`), so hiding `addOns` must not
    drop the summary. P3-10 treats hidden add-ons as no add-ons in the element's own summary
    placement (`src/element/pricing-renderer-element.ts:84-89`) and skips `renderAddOns`. The
    other way round, hiding `summary` while add-ons show needs `renderAddOns` to leave out the
    unguarded `renderSummary(state)` (`renderers.ts:1350`), so P3-10 adds an optional
    `RenderState` field for it; existing tests, which do not set it, render as before.
  - Checks: `full`, `pkg`, `red(tests/unit/hide-sections.test.ts)`,
    `unit(tests/unit/custom-elements.test.ts)`; CI `browser-shards` with the baselines unchanged.
- [ ] P3-11 Element slots (T/I, risk high; after P3-10 merged).
  - Files: `tests/unit/element-slots.test.ts` (new, test task),
    `tests/browser/element-slots.spec.ts` (new, test task), `tests/unit/docs-examples.test.ts` and
    `tests/unit/spectra-followups-parts.test.ts` (test task, docs-sync), `src/element/renderers.ts`
    (optional `RenderState` fields, keyed plan slot, summary slot),
    `src/element/pricing-renderer-element.ts`, `src/element/events.ts`, `src/element/index.ts`
    (types `PricingSlotName` and `PricingSlotsChangeDetail`), `custom-elements.json`,
    `docs/events.md`, `docs/vue.md`, the events list of `README.md` (`:378-381`) and
    `docs/theming.md` (implementer, docs-sync), `.changeset/element-slots.md`.
  - Requirements: the element side of `specs/composition` (P3-S2): `req~slots-property~1`,
    `req~slots-default-markup~1`, `req~slot-plan-cta~1`, `req~slot-plan-cta-keyed~1`,
    `req~slot-summary-actions~1`, `req~slot-loading~1`, `req~slot-error~1`,
    `req~slot-error-diagnostics~1`, `req~slots-change-event~2`,
    `req~slots-change-event-own-nodes~1`, `req~slots-change-event-summary~1`,
    `req~slot-plan-cta-context~1`, `req~slot-summary-actions-context~1`,
    `req~slot-plan-cta-any-pending~1`, `req~trigger-plan-action~1`,
    `req~trigger-plan-action-guard~1`, and the element entry, event map and manifest part of
    `req~composition-types-manifest~1`. The browser spec holds the browser-only requirements and
    scenarios listed below; the unit file holds the others through `flatten(element.render())`.
  - Note: the plan slot nodes carry the context attributes (`data-plan-name`, `data-label`,
    `data-href`, `data-relation`, `data-selected`, `data-current`, `data-pending`,
    `data-any-pending`) and the summary slot node `data-relation` and `data-pending` (design.md,
    D13).
  - Flatten note: the local `flatten` helpers of the unit tests
    (`tests/unit/error-state.test.ts:46-56`) return `''` for a lit directive result, so
    `element-slots.test.ts` uses a `flatten` that unwraps a directive result (for
    `keyed(key, value)`, its `values[1]`).
  - Docs-sync: `tests/unit/docs-examples.test.ts:80-93` asserts the exact event-name lists of
    `src/element`, and `:106-112` and `:143-153` require a `docs/events.md` table row per event,
    `@pricing-slots-change` in `docs/vue.md` and a README list item with the code span
    `pricing-slots-change`; the test task adds the new event to the expected lists. The implementer
    adds the row, the Vue listener and the README item, and updates the README sentence under the
    list that says `addEventListener` is typed for "these four names" (`README.md:383`).
    `tests/unit/spectra-followups-parts.test.ts:30-40` compares the `data-pr-part` values of
    `src/element/renderers.ts` with the "Stable values:" paragraph of `docs/theming.md`
    (`:112-118`); the implementer adds the four parts `plan-cta-slot`, `summary-actions-slot`,
    `loading-slot` and `error-slot` there. `docs/vue.md` and `docs/theming.md` are outside the
    change's file scope: the lead asks the coordinator to widen it before P3-11 starts.
  - Checks: `full`, `pkg`, `red(tests/unit/element-slots.test.ts tests/unit/docs-examples.test.ts)`,
    `unit(tests/unit/spectra-followups-parts.test.ts)`; CI `browser-shards` with the new spec green
    and the baselines unchanged. Split the loading and error slots into a follow-up PR if it grows
    past 300 lines.
- [ ] P3-12 React render props through portals (T/I, risk high; after P3-11 merged).
  - Files: `tests/unit/react-slots.test.ts` and `tests/unit/react-slots-mocked.test.ts` (new, test
    task); `tests/unit/density.test.ts`,
    `tests/unit/react-style-prop.test.ts` and `tests/unit/spectra-followups-react.test.ts` (test
    task, only if the render-prop change still breaks them after P3-5's rewrite); `src/react/slots.ts`
    (new: `slotNamesOf`, `acceptedSlotNodes`, `planCtaContextOf`, `summaryActionsContextOf`,
    `errorContextOf`, pure and DOM-free, tested in node with stand-in nodes), `src/react/index.ts`
    (wrapper wiring and the context types), `.changeset/react-render-props.md`.
  - Requirements in the unit file: `req~react-render-props-slots~1`,
    `req~react-slots-event-target~1`, `req~react-slot-node-accept~1`,
    `req~react-plan-context-reader~1`, `req~react-plan-context-any-pending~1`,
    `req~react-slot-href-safe~1`,
    `req~react-plan-context-trigger~1`, `req~react-summary-context-reader~1`,
    `req~react-error-context-reload~1`, `req~react-slots-client-only~1`,
    `req~react-slots-attach-read~1`, `req~react-error-diagnostics-reader~1`,
    `req~react-error-diagnostics-source~1` and the React entry part of
    `req~composition-types-manifest~1`. The impl tags of the three browser-only React requirements
    go in this slice; their tests come with P3-12b.
  - Accepted trace gap: between the merges of P3-12 and P3-12b, `req~react-slot-portals~1`,
    `req~react-plan-cta-context~2` and `req~react-other-slot-contexts~1` have impl tags and no
    utest tag. The P3-12 PR text names them and states that P3-12b adds their tests; the two slices
    stay separate PRs.
  - Wrapper structure of P3-5 kept (design.md D8): the three direct-render files read the
    recorded props through `renderToString`, so the hooks the render props add to `render` do not
    break them.
  - Checks: `full`, `pkg`,
    `red(tests/unit/react-slots.test.ts tests/unit/react-slots-mocked.test.ts)`,
    `unit(tests/unit/density.test.ts tests/unit/react-style-prop.test.ts tests/unit/spectra-followups-react.test.ts)`,
    `react-demo`.
- [ ] P3-12b React harness page and browser specs (T/I, risk medium; after P3-12 and P3-8 merged).
  - Files: `tests/browser/react-slots.spec.ts` (new, test task),
    `tests/browser/react-renderer-state.spec.ts` (new, test task), `examples/vanilla/react-slots.html`
    (new), `examples/vanilla/src/react-slots.ts` (new: mounts `PricingRenderer` from
    `pricing-renderer/react` with `createRoot` and `createElement`, no JSX, render props chosen by
    the query string; one query mode instead renders a component that calls
    `usePricingRendererState(ref)` with `ref` on the `PricingRenderer` of the same render and prints
    the snapshot's `pricing.saasName`), `examples/vanilla/vite.config.ts` (build input),
    `examples/vanilla/package.json` and `pnpm-lock.yaml` (`react` and `react-dom` as dev
    dependencies, the root's ranges; no new package in the lockfile).
  - Requirements: `req~react-slot-portals~1`, `req~react-plan-cta-context~2`,
    `req~react-other-slot-contexts~1` (browser-only), and the end-to-end race of
    `req~renderer-state-early-listen~1` (design.md D7; its own scenarios run in node in P3-8): the
    hook committed with the element shows `Acme Cloud` after the element's first `pricing-ready`,
    with no later event. Playwright already serves the vanilla demo (`playwright.config.ts:45-50`),
    so no new web server is needed.
  - No changeset: only a private demo and tests change.
  - Checks: the lockfile update through a registered update check first, then `full`, `pkg`, then
    `["pnpm","--filter","pricing-renderer-demo","build"]` (after `pkg`, like `react-demo`); CI
    `browser-shards` with the new spec green (G3 limit above).

## Wave 4: examples and docs (item 6; after CRP-P3-D)

- [ ] P3-13 React example (implementer, risk low; after P3-7b, P3-8 and P3-12b merged).
  - Files: `examples/react/src/**`, `examples/react/index.html`, `examples/react/package.json` and
    `pnpm-lock.yaml` (CRP-P3-D (a): `react-router`).
  - Content: the provider instead of the global config; a headless page with the hooks; a router
    `Link` CTA, `currentSelection` and the review flow (`compareWithCurrent`,
    `PricingChangeReview`) against an in-memory mock backend.
  - Link note: the `href` of the plan context is checked by `isSafeLink`
    only and may point to another host (a protocol-relative `//host` value is accepted today,
    `docs/events.md:170`); the example does not present it as a same-site link. The `isSafeLink`
    hardening stays a followup slice after an owner decision.
  - Supply chain (R1-SEC-009): `react-router` is pinned to one exact version (no range) in
    `examples/react/package.json`; before the lockfile is committed the implementer reads the
    output of `pnpm audit` and a licence report of the added packages and records both in the PR;
    no added package runs an install script: pnpm 10 (`package.json:27`) skips dependency build
    scripts unless `onlyBuiltDependencies` allows them, the project sets none, and the slice adds
    no such entry; a package of the update that needs its script to work is reported, not allowed.
  - Checks: the lockfile update through a registered update check first, then `full`, `pkg`,
    `react-demo`.
- [ ] P3-14 Next example (implementer, risk low; parallel with P3-13).
  - Files: `examples/next/app/**`.
  - Content: the provider in a client layout component; `next/link` in `renderPlanCta`; the current
    plan; the review flow with route handlers under `app/api/` holding in-memory state.
  - Link note: as in P3-13, the plan context `href` passes `isSafeLink` only and may point to
    another host; the example does not present it as a same-site link.
  - Checks: `full`, `pkg`, `next-demo`.
- [ ] P3-15a React guide (doc-steward, risk low; after P3-13 and P3-14).
  - Files: `docs/react.md` (new), the "React and Next" section of `README.md` (`:224-263`) and its
    docs list (`:472-492`).
  - Content: the provider, the hooks, SSR rules, and the two limits of `usePricingRendererState`
    (design.md, D7), and the late-attach limit (decision (b)).
  - Link note: as in P3-13, the plan context `href` passes `isSafeLink` only and may point to
    another host; the guide does not present it as a same-site link and says that a host needing
    same-site links checks it itself.
  - Checks: `docs`.
- [ ] P3-15b Reference (doc-steward, risk low; parallel with P3-15a).
  - Files: `docs/api-reference.md` (core functions, `pricing-renderer/react`, the new subpath,
    `hideSections`, slots and the event), `docs/configuration.md` (the provider layer in
    "Presentation precedence", `:279-290`), `docs/events.md` (the full reference of the slot event;
    P3-11 adds its table row).
  - Redirect note: the provider `request` section says that a listed origin or the page
    origin must not redirect to another origin while the provider sends its headers to it, because
    the origin filter checks the requested URL only.
  - Checks: `docs`.

## Order and shared files

- Gates: CRP-P3-A and CRP-P3-B (answered), then wave 0 P3-S1; wave 1 P3-1T/P3-1I with P3-5, then
  P3-2T/P3-2 and P3-3 in parallel, then P3-4, then P3-6; wave 2 P3-7a, P3-7b, P3-8; CRP-P3-C (answered)
  and P3-S2, then P3-10, P3-11, P3-12, P3-12b; CRP-P3-D (answered), then P3-13 and P3-14, then
  P3-15a and P3-15b.
- `src/core/index.ts`: P3-1I → P3-3.
- `src/core/types.ts`: P3-1I only.
- `src/element/events.ts`: P3-1I → P3-11.
- `src/element/index.ts`: P3-10 → P3-11.
- `src/element/pricing-renderer-element.ts`: P3-2 → P3-4 → P3-10 → P3-11.
- `src/element/renderers.ts`: P3-10 → P3-11, placed by the coordinator in the phase 1c chain.
- `custom-elements.json`: P3-10 → P3-11.
- `src/react/index.ts`: P3-5 → P3-10 → P3-12.
- `src/react/headless.ts`: P3-5 → P3-6 → P3-7b → P3-8.
- `tests/unit/density.test.ts`, `tests/unit/react-style-prop.test.ts`,
  `tests/unit/spectra-followups-react.test.ts`: P3-5 → P3-12 (only if needed).
- `src/yaml/index.ts`: P3-4, ordered by the coordinator against the phase 1b B2b and B3b.
- `package.json`: P3-5 only. `pnpm-lock.yaml`: P3-12b → P3-13.
- `examples/vanilla/**`: P3-12b only.
- `tests/unit/phase0-docs.test.ts`: P3-2T only.
- `README.md`: the pending chain B1 → B4, then P3-11 (events list), then P3-15a.
  `docs/api-reference.md`: the pending chain B2b → B3b → U8, then P3-15b.
- `docs/events.md`: P3-11 → P3-15b.
- `docs/vue.md`, `docs/theming.md`, `tests/unit/docs-examples.test.ts`,
  `tests/unit/spectra-followups-parts.test.ts`: P3-11 only.

## Browser-only requirements

Verified by the CI `browser-shards` run, not by `red(...)` (G3 limit above). Every other scenario
runs in the node unit file of its slice, with "a new element" built in node as the two specs define
it (`reload()` with stubs, markup read from the flattened `render()`). A scenario needs a browser
when it reads DOM identity or state across updates (`isConnected`, `closest`, accessible name),
uses `setAttribute`, user input, or events dispatched from `updated()`.

- Every scenario needs a browser:
  - `tests/browser/element-slots.spec.ts` (P3-11): `req~slots-property~1`,
    `req~slot-plan-cta-keyed~1`, `req~slot-summary-actions~1` (`closest`),
    `req~slots-change-event~2`, `req~slots-change-event-summary~1`, `req~trigger-plan-action~1`.
  - `tests/browser/react-slots.spec.ts` (P3-12b): `req~react-slot-portals~1`,
    `req~react-plan-cta-context~2`, `req~react-other-slot-contexts~1`. Their pure parts are unit
    requirements of P3-12.
  - `tests/browser/react-renderer-state.spec.ts` (P3-12b): the end-to-end race of
    `req~renderer-state-early-listen~1`, whose scenarios run in the node unit file of P3-8.
- Some scenarios need a browser (the named ones run in the browser spec, the others in the unit
  file):
  - P3-11: `req~slot-loading~1` ("Slow source"), `req~slot-plan-cta-context~1` ("Values follow the
    state"), `req~slot-summary-actions-context~1` ("Relation and pending").
  - P3-10: `req~hide-sections-property~1` ("Attribute to property"),
    `req~hide-sections-hero-name~1` ("Hero hidden"), `req~hide-sections-unknown~1` ("Unknown and
    differently cased tokens").

## Follow-ups outside the slices

- `isSafeLink` (`src/core/view-model.ts:600-605`) accepts `//host` and `/\host`, which browsers
  read as links to another host, and it does not drop tab, CR and LF before the check, which
  browsers remove from URLs. The React plan context re-checks `data-href` with it
  (`req~react-slot-href-safe~1`), so it inherits the gap. A fix (reject both prefixes after
  removing tab, CR and LF, with a unit test) changes how existing CTA, metadata and doc links
  render, which the additive-only rule does not allow inside this change; it needs an owner
  decision and its own slice.

## Traceability checklist

- `selection-logic`: impl in `src/core/selection-change.ts`, `src/core/price-stabilizer.ts`,
  `src/core/index.ts`; utest in `tests/unit/selection-change.test.ts`,
  `tests/unit/price-stabilizer.test.ts`, `tests/unit/apply-selection.test.ts`.
- `search-params`: impl in `src/core/search-params.ts`; utest in
  `tests/unit/selection-search-params.test.ts`.
- `react-hooks`: impl in `src/yaml/source.ts`, `src/react/headless.ts`,
  `src/react/use-pricing-source.ts`, `src/react/selection-store.ts`,
  `src/react/use-pricing-selection.ts`, `src/react/use-renderer-state.ts`; utest in the test files
  of P3-4 to P3-8, among them `tests/unit/use-pricing-source-mocked.test.ts` and
  `tests/unit/renderer-state-store-mocked.test.ts`, and `tests/unit/ssr.test.ts`.
- `react-provider`: impl in `src/react/provider.ts`, `src/react/index.ts`,
  `src/react/use-pricing-selection.ts`, `src/react/use-pricing-source.ts`; utest in
  `tests/unit/react-provider.test.ts` and the hook tests.
- `hide-sections`: impl in `src/element/pricing-renderer-element.ts`, `src/element/index.ts`,
  `src/react/index.ts`; utest in `tests/unit/hide-sections.test.ts` and
  `tests/browser/hide-sections.spec.ts`.
- `composition`: impl in `src/element/renderers.ts`, `src/element/pricing-renderer-element.ts`,
  `src/element/events.ts`, `src/element/index.ts`, `src/react/slots.ts`, `src/react/index.ts`;
  utest in `tests/unit/element-slots.test.ts`, `tests/unit/react-slots.test.ts`,
  `tests/unit/react-slots-mocked.test.ts`, `tests/browser/element-slots.spec.ts` and
  `tests/browser/react-slots.spec.ts`. The element side includes
  `req~slots-change-event-own-nodes~1` and `req~slot-error-diagnostics~1` (P3-11), the React side
  `req~react-slots-attach-read~1`, `req~react-error-diagnostics-reader~1` and
  `req~react-error-diagnostics-source~1` (P3-12).
- `req~apply-input-internal~1` has no impl tag in `src/` and loses its only utest tag in P3-1T; it
  lives in `docs/agent-work/delivera-2-load-current-contract/spec.md`, not in an OpenSpec spec, so
  no delta removes it (design.md, D2).
