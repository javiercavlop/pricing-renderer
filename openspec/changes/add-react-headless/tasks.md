# Tasks: add-react-headless

Rules for every slice:

- One PR into `develop` per slice, at most about 300 diff lines with tests. A slice that touches
  `src/` or `package.json` adds one pending changeset (minor for new API, patch otherwise). No
  release (`ROADMAP.md:137-148`).
- Exception: the spec slice P3-S1 is larger (about 920 spec lines, 66 requirements), because each
  obligation of CRP-P3-A and CRP-P3-B is one requirement with its own scenario. The size needs the
  owner's waiver; it adds no code.
- Additive only: no existing export, property, attribute, event field or part changes meaning.
- Code slices are a test task (test-designer, red before, G3) and an implementer task in the same
  PR that touches no test file (G4). "T/I" marks that pair.
- Slices open at the same time own disjoint files. A file listed in two slices is edited in the
  order of "Order and shared files", after the earlier slice is merged.
- Every requirement is traced: `[impl->req~…~1]` in code, `[utest->req~…~1]` in tests.
- No feature flag (design.md, D10). Browser proof comes from the CI `browser-shards` artifacts.

Checks (names used per slice; plan section 2):

- `install`: `["pnpm","install","--frozen-lockfile"]`
- `type`: `["pnpm","run","typecheck"]`
- `lint`: `["pnpm","run","lint"]`
- `test`: `["pnpm","run","test"]`
- `fmt`: `["pnpm","run","format:check"]`
- `pkg`: `["pnpm","run","package:check"]`
- `react-demo`: `["pnpm","--filter","pricing-renderer-react-demo","build"]`, after `pkg`
- `next-demo`: `["pnpm","--filter","pricing-renderer-next-demo","build"]`, after `pkg`
- `spec`: `["openspec","validate","add-react-headless","--strict"]`, the array registered in the
  lab for P3-S1; `openspec` is not in `package.json` and the lab provides the binary (plan section
  2 wrote it with `pnpm exec`)
- `unit(<files>)`: `["pnpm","exec","vitest","run",<files...>]`
- `red(<files>)`:
  `{"argv":["pnpm","exec","vitest","run",<files...>],"type":"red_before","expect_exit":[1],"expect_pattern":"AssertionError|expected","reject_pattern":"Cannot find module|SyntaxError|is not a function","overlay":[<files...>]}`.
  A test of a module that does not exist yet imports the entry that will re-export it and asserts
  `toBeTypeOf('function')` first. A module that no entry re-exports (the stores of P3-6, P3-7a and
  P3-8) is loaded with `const mod = await import('<path>').catch(() => ({}))`, followed by
  `expect(mod.<factory>).toBeTypeOf('function')`, so the base fails on an assertion.
- `full` = `install`, `type`, `lint`, `test`, `fmt`. `docs` = `install`, `test`, `fmt`.

## Wave 0: spec

- [x] P3-S1 Spec part 1 (specifier, risk medium).
  - Files: `proposal.md`, `design.md`, `tasks.md`,
    `specs/{selection-logic,search-params,react-hooks,react-provider}/spec.md`.
  - Checks: `install`, `spec`, `fmt`. Gates G1, G2.
- [ ] P3-S2 Spec part 2 (specifier, risk medium; after P3-S1 merged).
  - Files: `specs/{composition,hide-sections}/spec.md` (design.md, D11).
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
- [ ] P3-2 The element uses the core (refactorer, risk high; after P3-1I merged).
  - Files: `src/element/pricing-renderer-element.ts`.
  - Change: `:578-585`, `:598-649` and `:709-875` become calls to the core; focus, dialog and
    events stay. No changeset unless review asks.
  - Checks: `full`, `pkg`,
    `unit(tests/unit/selection-change.test.ts tests/unit/price-stabilizer.test.ts)`; CI
    `browser-shards` green, in particular `tests/browser/pricing-renderer.spec.ts:125-432,1547-1600`.
- [ ] P3-3 Search params (T/I, risk medium; after P3-1I merged, parallel with P3-2).
  - Files: `tests/unit/selection-search-params.test.ts` (new, test task),
    `src/core/search-params.ts` (new), `src/core/index.ts`, `.changeset/selection-search-params.md`.
  - Requirements: every `req~search-params-*`.
  - Checks: `full`, `pkg`, `red(tests/unit/selection-search-params.test.ts)`.
- [ ] P3-4 Shared source load (T/I, risk medium; after P3-2 merged).
  - Files: `tests/unit/load-source.test.ts` (new, test task), `src/yaml/source.ts` (new),
    `src/yaml/index.ts`, `src/element/pricing-renderer-element.ts` (`reload()` only),
    `.changeset/load-pricing-source.md`.
  - Requirements: `req~load-source-one-source~1`, `req~load-source-result~1` (design.md D5).
  - Checks: `full`, `pkg`, `red(tests/unit/load-source.test.ts)`,
    `unit(tests/unit/load-reload-pending.test.ts tests/unit/element-stale-load.test.ts tests/unit/load.test.ts)`;
    CI `browser-shards` (`element-stale-load.spec.ts`, `element-reconnect.spec.ts`).

## Wave 2: provider and hooks (items 2, 3, 5)

- [ ] P3-5 Headless entry and provider (T/I, risk medium; after P3-S1, parallel with wave 1).
  - Files: `tests/unit/react-provider.test.ts` (new, test task), `tests/unit/ssr.test.ts` (test
    task), `src/react/headless.ts` (new), `src/react/provider.ts` (new), `src/react/index.ts`,
    `package.json` (export `./react/headless`, `package:check` entry list),
    `.changeset/react-provider.md`.
  - Requirements: `req~react-headless-entry~1`, `req~react-entry-reexports-headless~1`,
    `req~react-hooks-common-api~1`, `req~react-headless-no-new-peer~1`, and the wrapper side of
    every `req~provider-*`.
  - Checks: `full`, `pkg`, `red(tests/unit/react-provider.test.ts tests/unit/ssr.test.ts)`.
- [ ] P3-6 `usePricingSource` (T/I, risk medium; after P3-5 and P3-4).
  - Files: `tests/unit/use-pricing-source.test.ts` (new, test task),
    `src/react/use-pricing-source.ts` (new), `src/react/headless.ts`,
    `.changeset/use-pricing-source.md`.
  - Requirements: every `req~use-pricing-source-*`, the hook side of
    `req~provider-request-loader~1`.
  - Checks: `full`, `pkg`, `red(tests/unit/use-pricing-source.test.ts)`.
- [ ] P3-7a Selection store (T/I, risk high; after P3-1I merged).
  - Files: `tests/unit/selection-store.test.ts` (new, test task), `src/react/selection-store.ts`
    (new, framework-free).
  - Requirements: `req~use-pricing-selection-changes~1`, `-notify~1`, `-controlled~1`,
    `-uncontrolled~1`, `-pricing-change~1`, `-pending~1`, `-apply~1`, `-current~1`, `-compare~1`.
  - Checks: `full`, `red(tests/unit/selection-store.test.ts)`.
- [ ] P3-7b `usePricingSelection` and the review from hooks (T/I, risk medium).
  - After: P3-7a and P3-6 merged.
  - Files: `tests/unit/use-pricing-selection.test.ts` (new, test task),
    `src/react/use-pricing-selection.ts` (new), `src/react/headless.ts`,
    `.changeset/use-pricing-selection.md`.
  - Requirements: `req~use-pricing-selection-state~1`, `req~use-pricing-selection-view-model~1`,
    the type-check of
    `req~use-pricing-selection-compare~1`, the hook side of `req~provider-config-precedence~1`,
    `req~provider-presentation-precedence~1`, `req~provider-messages-merge~1`,
    `req~provider-nearest~1`, `req~provider-no-global-write~1` and `req~provider-absent-global~1`.
  - Checks: `full`, `pkg`, `red(tests/unit/use-pricing-selection.test.ts)`.
- [ ] P3-8 `usePricingRendererState(ref)` (T/I, risk medium).
  - After: P3-7b merged.
  - Files: `tests/unit/renderer-state-store.test.ts` (new, test task),
    `src/react/use-renderer-state.ts` (new), `src/react/headless.ts`,
    `.changeset/use-renderer-state.md`.
  - Requirements: every `req~renderer-state-*`. Late attach: decision (b), a documented limit in
    this phase (P3-15a), no `normalizedPricing` getter (design.md, "Open questions"); option (a)
    stays a possible later slice.
  - Checks: `full`, `pkg`, `red(tests/unit/renderer-state-store.test.ts)`.

## Wave 3: composition (item 4; after CRP-P3-C and P3-S2)

- [ ] P3-10 `hideSections` (T/I, risk medium; after P3-4 and P3-5).
  - Files: `tests/unit/hide-sections.test.ts` (new, test task),
    `src/element/pricing-renderer-element.ts`, `custom-elements.json`, `src/react/index.ts`,
    `.changeset/hide-sections.md`.
  - Requirements: those of `specs/hide-sections` (P3-S2).
  - Note on `req~hide-sections-addons-summary~1`: `renderAddOns` draws the summary inside
    `section[data-pr-part=add-ons]` (`src/element/renderers.ts:1350`), so hiding `addOns` must not
    drop the summary. P3-10 treats hidden add-ons as no add-ons in the element's own summary
    placement (`src/element/pricing-renderer-element.ts:84-89`) and skips `renderAddOns`;
    `renderers.ts` stays P3-11 only.
  - Checks: `full`, `pkg`, `red(tests/unit/hide-sections.test.ts)`,
    `unit(tests/unit/custom-elements.test.ts)`; CI `browser-shards` with the baselines unchanged.
- [ ] P3-11 Element slots (T/I, risk high; after P3-10 merged).
  - Files: `tests/unit/element-slots.test.ts` (new, test task),
    `tests/browser/element-slots.spec.ts` (new, test task), `src/element/renderers.ts` (optional
    `RenderState` fields, keyed plan slot, summary slot), `src/element/pricing-renderer-element.ts`,
    `src/element/events.ts`, `custom-elements.json`, `.changeset/element-slots.md`.
  - Requirements: the element side of `specs/composition` (P3-S2).
  - Note: the slot nodes carry the context attributes (`data-plan-name`, `data-label`, `data-href`,
    `data-relation`, `data-selected`, `data-current`, `data-pending`; design.md, D13).
  - Checks: `full`, `pkg`, `red(tests/unit/element-slots.test.ts)`; CI `browser-shards` with the
    new spec green and the baselines unchanged. Split the loading and error slots into a follow-up
    PR if it grows past 300 lines.
- [ ] P3-12 React render props through portals (T/I, risk high; after P3-11 merged).
  - Files: `tests/unit/react-slots.test.ts` (new, test task), `src/react/slots.ts` (new),
    `src/react/index.ts`, `.changeset/react-render-props.md`.
  - Requirements: the React side of `specs/composition` (P3-S2).
  - Checks: `full`, `pkg`, `red(tests/unit/react-slots.test.ts)`, `react-demo`.

## Wave 4: examples and docs (item 6; after CRP-P3-D)

- [ ] P3-13 React example (implementer, risk low; after P3-7b, P3-8 and P3-12 merged).
  - Files: `examples/react/src/**`, `examples/react/index.html`, `examples/react/package.json` and
    `pnpm-lock.yaml` (CRP-P3-D (a): `react-router`).
  - Content: the provider instead of the global config; a headless page with the hooks; a router
    `Link` CTA, `currentSelection` and the review flow (`compareWithCurrent`,
    `PricingChangeReview`) against an in-memory mock backend.
  - Checks: the lockfile update through a registered update check first, then `full`, `pkg`,
    `react-demo`.
- [ ] P3-14 Next example (implementer, risk low; parallel with P3-13).
  - Files: `examples/next/app/**`.
  - Content: the provider in a client layout component; `next/link` in `renderPlanCta`; the current
    plan; the review flow with route handlers under `app/api/` holding in-memory state.
  - Checks: `full`, `pkg`, `next-demo`.
- [ ] P3-15a React guide (doc-steward, risk low; after P3-13 and P3-14).
  - Files: `docs/react.md` (new), the "React and Next" section of `README.md` (`:224-263`) and its
    docs list (`:472-492`).
  - Content: the provider, the hooks, SSR rules, and the two limits of `usePricingRendererState`
    (design.md, D7), and the late-attach limit (decision (b)).
  - Checks: `docs`.
- [ ] P3-15b Reference (doc-steward, risk low; parallel with P3-15a).
  - Files: `docs/api-reference.md` (core functions, `pricing-renderer/react`, the new subpath,
    `hideSections`, slots and the event), `docs/configuration.md` (the provider layer in
    "Presentation precedence", `:279-290`), `docs/events.md` (the slot event).
  - Checks: `docs`.

## Order and shared files

- Gates: CRP-P3-A and CRP-P3-B (answered), then wave 0 P3-S1; wave 1 P3-1T/P3-1I with P3-5, then
  P3-2 and P3-3 in parallel, then P3-4, then P3-6; wave 2 P3-7a, P3-7b, P3-8; CRP-P3-C (answered)
  and P3-S2, then P3-10, P3-11, P3-12; CRP-P3-D (answered), then P3-13 and P3-14, then P3-15a and
  P3-15b.
- `src/core/index.ts`: P3-1I → P3-3.
- `src/core/types.ts`: P3-1I only.
- `src/element/events.ts`: P3-1I → P3-11.
- `src/element/pricing-renderer-element.ts`: P3-2 → P3-4 → P3-10 → P3-11.
- `src/element/renderers.ts`: P3-11 only, placed by the coordinator in the phase 1c chain.
- `custom-elements.json`: P3-10 → P3-11.
- `src/react/index.ts`: P3-5 → P3-10 → P3-12.
- `src/react/headless.ts`: P3-5 → P3-6 → P3-7b → P3-8.
- `src/yaml/index.ts`: P3-4, ordered by the coordinator against the phase 1b B2b and B3b.
- `package.json`: P3-5 only. `pnpm-lock.yaml`: P3-13 only.
- `README.md`: the pending chain B1 → B4, then P3-15a. `docs/api-reference.md`: the pending chain
  B2b → B3b → U8, then P3-15b.

## Traceability checklist

- `selection-logic`: impl in `src/core/selection-change.ts`, `src/core/price-stabilizer.ts`,
  `src/core/index.ts`; utest in `tests/unit/selection-change.test.ts`,
  `tests/unit/price-stabilizer.test.ts`, `tests/unit/apply-selection.test.ts`.
- `search-params`: impl in `src/core/search-params.ts`; utest in
  `tests/unit/selection-search-params.test.ts`.
- `react-hooks`: impl in `src/yaml/source.ts`, `src/react/headless.ts`,
  `src/react/use-pricing-source.ts`, `src/react/selection-store.ts`,
  `src/react/use-pricing-selection.ts`, `src/react/use-renderer-state.ts`; utest in the test files
  of P3-4 to P3-8 and `tests/unit/ssr.test.ts`.
- `react-provider`: impl in `src/react/provider.ts`, `src/react/index.ts`,
  `src/react/use-pricing-selection.ts`, `src/react/use-pricing-source.ts`; utest in
  `tests/unit/react-provider.test.ts` and the hook tests.
- `req~apply-input-internal~1` has no impl tag in `src/` and loses its only utest tag in P3-1T; it
  lives in `docs/agent-work/delivera-2-load-current-contract/spec.md`, not in an OpenSpec spec, so
  no delta removes it (design.md, D2).
