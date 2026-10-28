# Plan: Phase 3, React headless and composition

- Planner plan, 2026-10-28. Read-only: no code, spec or test was changed.
- Base: `88f5141`. Facts and `file:line` references are in `intake.md` next to this file.
- Replaces the provisional section 2.6 (P3-0 to P3-4) of `docs/agent-work/pending-phases/plan.md`.

## 1. Conventions

- Each slice is one PR into `develop`, at most about 300 diff lines with tests. A slice that touches
  `src/` or `package.json` adds one pending changeset (minor for new API, patch otherwise). No
  release (`ROADMAP.md:137-148`).
- Additive only: no existing export, property, attribute, event field or part changes meaning. Code
  written for 0.1.0 keeps working.
- No runtime feature flag. Nothing is released until the owner says so, so the release hold is the
  guard. Each slice still ships a complete, documented piece and leaves `develop` green.
- Code slices are a test task with a red-before check (G3) followed by an implementer task in the
  same PR that touches no test file. "T/I" marks that pair. The test task belongs to test-designer;
  the implementer owns only the source files listed.
- Owned globs never overlap between slices that are open at the same time. A file listed in two
  slices is edited in the order of section 5, after the earlier slice is merged.
- Browser proof comes from the CI `browser-shards` artifacts; no browser runs in the lab.
- New text in `docs/agent-work/phase3-react-headless/` and in the OpenSpec change is written with
  lists, not tables, so no `.prettierignore` entry is needed.

## 2. Check arrays

Names used per slice:

- `install`: `["pnpm","install","--frozen-lockfile"]`
- `type`: `["pnpm","run","typecheck"]`
- `lint`: `["pnpm","run","lint"]`
- `test`: `["pnpm","run","test"]`
- `fmt`: `["pnpm","run","format:check"]`
- `pkg`: `["pnpm","run","package:check"]` (builds `dist/`, then publint and attw, `package.json:143`)
- `react-demo`: `["pnpm","--filter","pricing-renderer-react-demo","build"]`, registered after `pkg`
  because the example resolves `pricing-renderer` to `dist/` (`ci.yml:49-52`).
- `next-demo`: `["pnpm","--filter","pricing-renderer-next-demo","build"]`, after `pkg`.
- `spec(<id>)`: `["pnpm","exec","openspec","validate","<id>","--strict"]`. `openspec` is not in
  `package.json`; the coordinator confirms the lab provides it before registering (need N-spec of
  the pending-phases plan).
- `unit(<files>)`: `["pnpm","exec","vitest","run",<files...>]`
- `red(<files>)`:
  `{"argv":["pnpm","exec","vitest","run",<files...>],"type":"red_before","expect_exit":[1],"expect_pattern":"AssertionError|expected","reject_pattern":"Cannot find module|SyntaxError|is not a function","overlay":[<files...>]}`.
  A test of a module that does not exist yet first imports the entry that will re-export it and
  asserts `toBeTypeOf('function')`, so the base fails on an assertion and not on a missing module.
- `full` = `install`, `type`, `lint`, `test`, `fmt`.
- `docs` = `install`, `test`, `fmt` (the docs-examples test reads the docs,
  `tests/unit/docs-examples.test.ts`).

## 3. Owner decisions (CRPs) before code

Every item is public API (`INTENT.md:110-111`). None changes a default look, so no screenshots are
required; the composition CRP may attach a capture of a custom CTA from the examples.

- **CRP-P3-A, core API** (blocks P3-1T onwards)
  - Names, recommended:
    - `planSelectionChange(pricing, selection, intent)` with
      `intent = { type: 'plan', planId } | { type: 'addOn', addOnId, selected }`, returning
      `{ kind: 'apply', selection }` or `{ kind: 'confirm', pending }`.
    - `applySelectionChange(pricing, selection, pending)` returning the selection after a confirmed
      change.
    - `selectionWithVariable`, `selectionWithAddOnQuantity` and `selectionInEffect` (the
      `variablesEnabled` rule), so that every element mutation has one core function.
    - `createPriceStabilizer()` returning `{ stabilize(viewModel), reset() }`.
  - `PendingAddOnChange` moves to `src/core/types.ts` and is exported from `pricing-renderer`;
    `pricing-renderer/element` keeps exporting the same type.
  - Export `applySelectionInput` and `ApplySelectionInputResult` from `pricing-renderer`. This
    supersedes `req~apply-input-internal~1`
    (`docs/agent-work/delivera-2-load-current-contract/spec.md:62-64`); the owner request authorises
    it, the CRP records it.
  - Search params, recommended:
    `selectionToSearchParams(selection, options?): [string, string][]` and
    `selectionFromSearchParams(pricing, params: Iterable<[string, string]>, options?)` returning
    the `applySelectionInput` result. Keys `plan`, `billing`, `addon` (repeated, `id` or
    `id:quantity`), `var.<path>` with a JSON literal value; optional `prefix`. Iterables keep the
    core free of DOM types (`tsconfig.core.json:4-5`); `new URLSearchParams(entries)` and
    `url.searchParams` both fit. The URL format becomes a public contract once released.
  - Optional, recommended: `loadPricingSource(input, options)` in `pricing-renderer/yaml`, the
    element's one-source rule and load (`pricing-renderer-element.ts:367-424`) shared with
    `usePricingSource`, so the load cannot drift either.
- **CRP-P3-B, React API and subpath** (blocks P3-5 onwards)
  - New subpath `pricing-renderer/react/headless`, recommended: the provider and the hooks without
    Lit and without registering the element. `pricing-renderer/react` re-exports all of it, so one
    import works for component users. Alternative: everything in `pricing-renderer/react` only, which
    always loads Lit (`src/react/index.ts:28`).
  - `usePricingSource({ pricing | yaml | src, request, loadPricing, normalizeOptions })` returning
    `{ status, pricing, diagnostics, reload }`. `pricing` and `yaml` resolve during render (SSR-safe);
    `src` loads in an effect.
  - `usePricingSelection(pricing, options)` returning `viewModel`, `selection`, `resolved`,
    `selectPlan`, `setBillingPeriod`, `setVariable`, `resetVariables`, `toggleAddOn`,
    `setAddOnQuantity`, `pending`, `confirm`, `cancel`, `apply`, `relationOf(planId)`, `current`
    and `compareWithCurrent()`. Options: controlled `selection` with `onSelectionChange`,
    `defaultSelection`, `currentSelection`, `locale`, `mode`, `visibility`, `messages`,
    `presentation`, `expressionOptions`, `variablesEnabled`.
  - `usePricingRendererState(ref)` returning the cached `{ pricing, selection, resolved }` or
    `undefined`. It cannot see a silent `applySelection` or a controlled `selection` prop
    (intake item 2); recommended: document it, and offer `applySelection` through the returned
    object so the store refreshes.
  - `PricingRendererProvider` props: `config` (`Partial<PricingRendererConfig>`), `messages`,
    `presentation`, `request`, `loadPricing`. Precedence: instance prop, then provider, then the
    global config, then `custom.pricingRenderer`. Messages merge per key, presentation through
    `mergePresentationOptions`.
  - No new peer dependency: `createPortal` comes from `react-dom`, already an optional peer
    (`package.json:82-93`).
- **CRP-P3-C, composition** (blocks P3-10 onwards)
  - `PricingRenderer` props `renderPlanCta(context)`, `renderSummaryActions(context)`,
    `renderLoading()`, `renderError({ diagnostics, reload })`. Plan context: `planId`, `planName`,
    `selected`, `current`, `relation`, `label`, `href`, `pending`, `trigger()`.
  - Element side: a property `slots` (attribute-free, a list of `plan-cta`, `summary-actions`,
    `loading`, `error`) that makes the element render empty slot nodes
    `data-pr-slot="<name>"` (with `data-plan-id` for plan CTAs) instead of its default markup. New
    stable parts. Default without `slots`: unchanged markup.
  - How React learns about slot nodes, recommended: a new event `pricing-slots-change` dispatched in
    `updated()` when the set of slot nodes changes. Alternative: a `MutationObserver` in the React
    layer, no new event.
  - `trigger()` needs a public element method, recommended `triggerPlanAction(planId)` that
    dispatches the same `pricing-action` as the built-in CTA.
  - Plan slots are keyed: recommended `keyed(plan.id, ...)` around the slot node only, which leaves
    every existing test unchanged. Alternative: `repeat()` for the whole plan map, which also keeps
    focus on reorder but updates about 16 test helpers (intake item 4).
  - `hideSections` property and `hide-sections` attribute (space-separated): `hero`, `metadata`,
    `billing`, `variables`, `plans`, `comparison`, `addOns`, `summary`. With `hero` hidden, a
    visually hidden title keeps the shell's accessible name.
- **CRP-P3-D, examples and test tooling** (blocks P3-13; the test part blocks nothing)
  - Router in `examples/react`: (a) add `react-router` to the private example only, a lockfile
    change; or (b) a small in-example link over `history.pushState`. Recommended (a): the request
    asks for a router `Link`, and a hand-made link proves nothing about router integration. The Next
    example uses `next/link` in both cases.
  - DOM test environment: (a) none, hooks are thin layers over framework-free stores tested in node,
    plus `react-dom/server` and the `@lit/react` mock precedent
    (`tests/unit/react-style-prop.test.ts:7-12`); or (b) add `happy-dom` as a dev dependency.
    Recommended (a) for this phase; (b) as a followup if review finds the hook layer under-tested.

## 4. Slices

### Wave 0: spec

- **P3-S1, spec for items 1, 2, 3 and 5** (specifier, risk medium: public API)
  - Owns: `openspec/changes/add-react-headless/{proposal.md,design.md,tasks.md}` and
    `openspec/changes/add-react-headless/specs/{selection-logic,search-params,react-hooks,react-provider}/**`.
  - Content: EARS requirements with ids, including `req~apply-input-exported~1` that replaces
    `req~apply-input-internal~1`, the cached-snapshot rule of `usePricingRendererState`, and the
    SSR rules of intake "Package, SSR and React 18/19 facts".
  - Checks: `install`, `spec(add-react-headless)`, `fmt`.
  - After CRP-P3-A and CRP-P3-B. Size: about 280 lines.
- **P3-S2, spec for item 4** (specifier, risk medium)
  - Owns: `openspec/changes/add-react-headless/specs/{composition,hide-sections}/**`.
  - Checks: `install`, `spec(add-react-headless)`, `fmt`.
  - After CRP-P3-C and P3-S1 merged (same change id). Size: about 200 lines.

### Wave 1: core extraction (item 1)

- **P3-1T, characterization tests** (test-designer, risk medium)
  - Owns: `tests/unit/selection-change.test.ts` (new), `tests/unit/price-stabilizer.test.ts` (new),
    `tests/unit/apply-selection.test.ts` (only the block at `:69-73`, flipped to the export).
  - Content: the element behaviour of intake item 1, case by case: dependency closure, the three
    conflict sources, transitive dependents, plan change with and without removals, the pending
    shape, default quantity on confirm, `variablesEnabled`, stabilisation of prices, breakdown lines
    and subtotal, reset on load.
  - Checks: `install`,
    `red(tests/unit/selection-change.test.ts tests/unit/price-stabilizer.test.ts tests/unit/apply-selection.test.ts)`,
    `lint`, `fmt`.
  - After P3-S1. Size: about 280 lines.
- **P3-1I, core functions** (implementer, risk medium)
  - Owns: `src/core/selection-change.ts` (new), `src/core/price-stabilizer.ts` (new),
    `src/core/types.ts`, `src/core/index.ts`, `src/element/events.ts` (type re-export only),
    `.changeset/core-selection-logic.md`.
  - Content: the functions of CRP-P3-A copied from the element without behaviour change; exports
    including `applySelectionInput`. The element is not touched yet.
  - Checks: `full`, `pkg`,
    `unit(tests/unit/selection-change.test.ts tests/unit/price-stabilizer.test.ts tests/unit/apply-selection.test.ts tests/unit/dependency-names.test.ts)`.
  - Same PR as P3-1T. Size: about 220 lines.
- **P3-2, the element uses the core** (refactorer, risk high: behaviour-preserving change of the
  element's selection paths, guarded mostly by browser specs)
  - Owns: `src/element/pricing-renderer-element.ts`.
  - Content: replace `:578-585`, `:598-649` and `:709-875` by calls to the core; keep focus,
    dialog and event code in the element. No changeset (no visible change) unless review asks.
  - Checks: `full`, `pkg`, `unit(tests/unit/selection-change.test.ts tests/unit/price-stabilizer.test.ts)`;
    CI `browser-shards` green, in particular `tests/browser/pricing-renderer.spec.ts:125-432` and
    `:1547-1600`.
  - After P3-1I merged. Size: about 250 lines (mostly removals).
- **P3-3, search params** (T/I, risk medium: a URL format becomes public)
  - Owns: `tests/unit/selection-search-params.test.ts` (new, test task),
    `src/core/search-params.ts` (new), `src/core/index.ts` (after P3-1I),
    `.changeset/selection-search-params.md`.
  - Checks: `full`, `pkg`, `red(tests/unit/selection-search-params.test.ts)`.
  - After P3-1I merged; parallel with P3-2. Size: about 250 lines.
- **P3-4, shared source loading** (T/I, risk medium; only if CRP-P3-A accepts `loadPricingSource`)
  - Owns: `tests/unit/load-source.test.ts` (new, test task), `src/yaml/source.ts` (new),
    `src/yaml/index.ts`, `src/element/pricing-renderer-element.ts` (`reload()` only, after P3-2),
    `.changeset/load-pricing-source.md`.
  - Checks: `full`, `pkg`, `red(tests/unit/load-source.test.ts)`,
    `unit(tests/unit/load-reload-pending.test.ts tests/unit/element-stale-load.test.ts tests/unit/load.test.ts)`;
    CI `browser-shards` (`element-stale-load.spec.ts`, `element-reconnect.spec.ts`).
  - After P3-2 merged. `src/yaml/index.ts` is also in the phase 1b chain B2b → B3b; the
    coordinator orders them. Size: about 200 lines.

### Wave 2: provider and hooks (items 2, 3, 5)

- **P3-5, headless entry and provider** (T/I, risk medium: new subpath and package wiring)
  - Owns: `tests/unit/react-provider.test.ts` (new, test task), `tests/unit/ssr.test.ts` (test
    task: the headless entry imports without a registry and without defining the element),
    `src/react/headless.ts` (new, `'use client'`), `src/react/provider.ts` (new),
    `src/react/index.ts` (the wrapper reads the provider; re-exports), `package.json` (export
    `./react/headless` and the `package:check` entry list), `.changeset/react-provider.md`.
  - Checks: `full`, `pkg`, `red(tests/unit/react-provider.test.ts tests/unit/ssr.test.ts)`.
  - After CRP-P3-B and P3-S1. Parallel with wave 1. Size: about 260 lines.
- **P3-6, `usePricingSource`** (T/I, risk medium)
  - Owns: `tests/unit/use-pricing-source.test.ts` (new, test task),
    `src/react/use-pricing-source.ts` (new), `src/react/headless.ts` (after P3-5),
    `.changeset/use-pricing-source.md`.
  - Content: sync sources in render; `src` in an effect with abort on cleanup (StrictMode safe);
    `reload`; the provider's `request` and `loadPricing` as defaults. Tests drive the framework-free
    loader in node and the sync path with `react-dom/server`.
  - Checks: `full`, `pkg`, `red(tests/unit/use-pricing-source.test.ts)`.
  - After P3-5 and, if `loadPricingSource` is accepted, P3-4. Size: about 220 lines.
- **P3-7a, selection store** (T/I, risk high: the second consumer of the extracted logic)
  - Owns: `tests/unit/selection-store.test.ts` (new, test task), `src/react/selection-store.ts`
    (new, framework-free).
  - Content: a store over the core functions and one `createPriceStabilizer` per pricing:
    controlled and uncontrolled selection, pending, confirm, cancel, `apply` through
    `applySelectionInput`, a cached snapshot per change.
  - Checks: `full`, `red(tests/unit/selection-store.test.ts)`.
  - After P3-1I merged. Size: about 250 lines.
- **P3-7b, `usePricingSelection` and the review from hooks** (T/I, risk medium)
  - Owns: `tests/unit/use-pricing-selection.test.ts` (new, test task),
    `src/react/use-pricing-selection.ts` (new), `src/react/headless.ts` (after P3-6),
    `.changeset/use-pricing-selection.md`.
  - Content: the hook over the store with `useSyncExternalStore`; `relationOf` and `current` from
    `deriveCurrentContext` and `planRelation` (internal modules, imported as they are);
    `compareWithCurrent()` through `compareSelections`, ready for `<PricingChangeReview comparison>`
    (item 5).
  - Checks: `full`, `pkg`, `red(tests/unit/use-pricing-selection.test.ts)`.
  - After P3-7a merged. Size: about 220 lines.
- **P3-8, `usePricingRendererState(ref)`** (T/I, risk medium)
  - Owns: `tests/unit/renderer-state-store.test.ts` (new, test task),
    `src/react/use-renderer-state.ts` (new), `src/react/headless.ts` (after P3-7b),
    `.changeset/use-renderer-state.md`.
  - Content: subscribe to `pricing-ready` and `pricing-selection-change` on the element; cache the
    detail; `getServerSnapshot` returns `undefined`; resubscribe when the ref target changes. Tests
    use Node's `EventTarget` and `CustomEvent`.
  - Checks: `full`, `pkg`, `red(tests/unit/renderer-state-store.test.ts)`.
  - Size: about 180 lines.

### Wave 3: composition (item 4)

- **P3-10, `hideSections`** (T/I, risk medium: accessibility of the shell name)
  - Owns: `tests/unit/hide-sections.test.ts` (new, test task),
    `src/element/pricing-renderer-element.ts` (after P3-4), `custom-elements.json`,
    `src/react/index.ts` (the prop; after P3-5), `.changeset/hide-sections.md`.
  - Checks: `full`, `pkg`, `red(tests/unit/hide-sections.test.ts)`,
    `unit(tests/unit/custom-elements.test.ts)`; CI `browser-shards` with the baselines unchanged.
  - After CRP-P3-C and P3-S2. Size: about 180 lines.
- **P3-11, element slots** (T/I, risk high: new markup contract, event and method)
  - Owns: `tests/unit/element-slots.test.ts` (new, test task), `tests/browser/element-slots.spec.ts`
    (new, test task, on the vanilla demo page), `src/element/renderers.ts` (optional `RenderState`
    fields only, keyed plan slot, summary slot), `src/element/pricing-renderer-element.ts` (after
    P3-10: `slots`, loading and error slots, the event, `triggerPlanAction`),
    `src/element/events.ts` (after P3-1I), `custom-elements.json` (after P3-10),
    `.changeset/element-slots.md`.
  - Checks: `full`, `pkg`, `red(tests/unit/element-slots.test.ts)`; CI `browser-shards` with the
    new spec green and the baselines unchanged.
  - After P3-10 merged. Size: about 300 lines; split the loading and error slots into a follow-up
    PR if it grows.
- **P3-12, React render props through portals** (T/I, risk high)
  - Owns: `tests/unit/react-slots.test.ts` (new, test task), `src/react/slots.ts` (new),
    `src/react/index.ts` (after P3-10), `.changeset/react-render-props.md`.
  - Content: the wrapper sets `slots` from the props given, listens for the slot event, and renders
    `createPortal(node, container, planId)` per slot. Nothing renders on the server.
  - Checks: `full`, `pkg`, `red(tests/unit/react-slots.test.ts)`, `react-demo`.
  - After P3-11 merged. Size: about 250 lines.

### Wave 4: examples and docs (item 6)

- **P3-13, React example** (implementer, risk low)
  - Owns: `examples/react/src/**`, `examples/react/index.html`, and, only with CRP-P3-D (a),
    `examples/react/package.json` and `pnpm-lock.yaml`.
  - Content: the provider instead of the global config; a headless page with the hooks; the
    component page with a router `Link` CTA, `currentSelection` and the review flow
    (`compareWithCurrent` and `PricingChangeReview`) against an in-memory mock backend module.
  - Checks: `full`, `pkg`, `react-demo`. With a new dependency, the lockfile is updated through a
    registered update check first (factory pnpm-workspace rules), then `install`.
  - After P3-7b, P3-8 and P3-12 merged. Size: about 280 lines.
- **P3-14, Next example** (implementer, risk low)
  - Owns: `examples/next/app/**`.
  - Content: the provider in a client layout component; `next/link` in `renderPlanCta`; the
    current plan; the review flow with route handlers under `app/api/` holding in-memory state.
  - Checks: `full`, `pkg`, `next-demo`.
  - Parallel with P3-13. Size: about 280 lines.
- **P3-15a, React guide** (doc-steward, risk low)
  - Owns: `docs/react.md` (new), the "React and Next" section of `README.md` (`:224-263`) and its
    docs list (`:472-492`).
  - Checks: `docs`. After P3-13 and P3-14. Size: about 250 lines.
- **P3-15b, reference** (doc-steward, risk low)
  - Owns: `docs/api-reference.md` (the core functions, `pricing-renderer/react`, the new subpath,
    `hideSections`, slots and the event), `docs/configuration.md` (the provider layer in
    "Presentation precedence", `:279-290`), `docs/events.md` (the slot event).
  - Checks: `docs`. Parallel with P3-15a. Size: about 250 lines.

## 5. Order, dependencies and shared files

Waves (slices in one wave own disjoint files):

- Gate: CRP-P3-A and CRP-P3-B answered.
- Wave 0: P3-S1.
- Wave 1: P3-1T with P3-1I, and P3-5. Then P3-2 and P3-3 in parallel, then P3-4, then P3-6.
- Wave 2: P3-7a (after P3-1I), then P3-7b, then P3-8.
- Gate: CRP-P3-C answered; P3-S2.
- Wave 3: P3-10 (after P3-4 and P3-5), then P3-11, then P3-12.
- Gate: CRP-P3-D answered.
- Wave 4: P3-13 and P3-14 in parallel, then P3-15a and P3-15b in parallel.

Shared files, edited only in this order:

- `src/core/index.ts`: P3-1I → P3-3.
- `src/core/types.ts`: P3-1I only.
- `src/element/events.ts`: P3-1I → P3-11.
- `src/element/pricing-renderer-element.ts`: P3-2 → P3-4 (if accepted) → P3-10 → P3-11.
- `src/element/renderers.ts`: P3-11 only in this phase; it also sits in the phase 1c chain
  (`pending-phases/plan.md:505`), so the coordinator places P3-11 in that chain.
- `custom-elements.json`: P3-10 → P3-11.
- `src/react/index.ts`: P3-5 → P3-10 → P3-12.
- `src/react/headless.ts`: P3-5 → P3-6 → P3-7b → P3-8.
- `src/yaml/index.ts`: P3-4, ordered by the coordinator against B2b and B3b.
- `package.json`: P3-5 only.
- `pnpm-lock.yaml`: P3-13 only, and only with CRP-P3-D (a).
- `README.md`: the pending chain B1 → B4 (`pending-phases/plan.md:512`), then P3-15a.
- `docs/api-reference.md`: the pending chain B2b → B3b → U8, then P3-15b.

## 6. Risk per slice

- High: P3-2 (refactor guarded mostly by browser specs), P3-7a (second consumer of the logic),
  P3-11 (new markup contract, event and method), P3-12 (portals into Lit-owned nodes). Each gets a
  reviewer and a test-reviewer; P3-11 and P3-12 also an arch-reviewer, and a clean-context review.
- Medium: P3-S1, P3-S2, P3-1T/P3-1I, P3-3, P3-4, P3-5, P3-6, P3-7b, P3-8, P3-10.
- Low: P3-13, P3-14, P3-15a, P3-15b.

## 7. Needs and followups

- Needs: the answers to CRP-P3-A to CRP-P3-D; N-spec (the `openspec` CLI in the lab).
- Followup: a CI check that builds or type-checks the React entry against React 18 types; today
  only `@types/react ^19` is installed (`package.json:106`).
- Followup: a browser harness that serves the React example, so hooks and portals get browser
  proof; Playwright serves only the vanilla demo (`playwright.config.ts:45-50`).
- Followup: update `ROADMAP.md:164` as the waves merge.
