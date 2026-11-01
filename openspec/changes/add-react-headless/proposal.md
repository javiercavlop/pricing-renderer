# Proposal: React headless and composition (Phase 3)

Change `add-react-headless`. Status: the owner accepted every recommendation of CRP-P3-A, CRP-P3-B,
CRP-P3-C and CRP-P3-D (`docs/agent-work/phase3-react-headless/plan.md at commit 07f10bf515d53e19b2a5fbc5abe5b2dddb74fa26 (git show 07f10bf5:docs/agent-work/phase3-react-headless/plan.md), section 3`). Planner
intake: `docs/agent-work/phase3-react-headless/intake.md`; handoff: `handoff.md` in the same folder.
Base `88f5141`; every `file:line` below is at that base.

The plan file in the working tree is a short lead note that is rewritten at each checkpoint. The
original plan with the owner's answers is kept in git at that commit, and the owner's acceptance of
every recommendation of CRP-P3-A, -B, -C and -D (work item
own-3f3b38da4a6a49c9a91ffff65873a31d) is the authority.

This change has two spec parts, both written and delivered in one spec PR. Part 1 (slice P3-S1)
writes `selection-logic`, `search-params`, `react-hooks` and `react-provider`. Part 2 (slice P3-S2)
writes `composition` and `hide-sections`. This proposal, design.md and tasks.md cover both parts.

## Why

Owner request for Phase 3 (intake, "Owner request, as numbered items"), with the rule "additive
only: code written for 0.1.0 must keep working":

1. Extract the selection logic of the element into core functions used by the element and the
   hooks, so they cannot drift. Export `applySelectionInput`. Add `selectionToSearchParams` and
   `selectionFromSearchParams`.
2. React hooks: `usePricingSource`, `usePricingSelection`, `usePricingRendererState(ref)`.
3. `PricingRendererProvider`: per-tree config, messages, presentation, `request` and `loadPricing`.
   The global `configurePricingRenderer` keeps working.
4. Composition: `renderPlanCta`, `renderSummaryActions`, `renderLoading` and `renderError` props on
   element slots and React portals keyed by plan id; `hideSections`, also as an element property.
5. The phase 2 review stays usable from the hooks.
6. The React and Next examples show the hooks, the provider, a router `Link` CTA, the current plan
   and the review flow with a mocked backend.

INTENT link: **O3, "a stable public API and package across the integrations"**. Today the
selection logic lives only in private element methods (`pricing-renderer-element.ts:476-494,578-893`),
any import of `pricing-renderer/react` loads Lit and registers the element (`src/react/index.ts:28`),
and the only shared config is module-global (`src/core/config.ts:12`), which a Next server shares
across requests (intake, item 3).

## What changes

- **Core selection logic** (`pricing-renderer`): `planSelectionChange`, `applySelectionChange`,
  `selectionWithVariable`, `selectionWithAddOnQuantity`, `selectionInEffect` and
  `createPriceStabilizer`, with the element's exact behaviour; `PendingAddOnChange` moves to the
  core; `applySelectionInput` and `ApplySelectionInputResult` become public.
- **Search params** (`pricing-renderer`): `selectionToSearchParams` and `selectionFromSearchParams`
  over `[string, string]` pairs; keys `plan`, `billing`, `addon`, `var.<path>`, optional prefix.
- **Shared source load** (`pricing-renderer/yaml`): `loadPricingSource`, the element's one-source
  rule and load, used by the element and `usePricingSource`. The request bounds apply on the hook
  path only; the element's `reload()` keeps passing `request` as given (lead decision R2-REV-002;
  design.md, D5).
- **Headless React** (new subpath `pricing-renderer/react/headless`, re-exported by
  `pricing-renderer/react`): `PricingRendererProvider`, `usePricingSource`, `usePricingSelection`
  (with `compareWithCurrent()` for `<PricingChangeReview>`) and `usePricingRendererState(ref)`.
- **Composition** (part 2): `slots` property, slot nodes, a `pricing-slots-change` event and
  `triggerPlanAction(planId)` on the element; render props through portals; `hideSections`.
- **Examples and docs**: provider, hooks, router `Link` CTA, current plan and review flow in
  `examples/react` and `examples/next`; a React guide and reference updates.

## Why six capabilities

Each one has its own entry point, consumer and risk, and can be built and accepted alone:

1. **selection-logic**: DOM-free core used by the element and the hooks; its first slices are a
   behaviour-preserving extraction.
2. **search-params**: a URL format that becomes a public contract once released; it builds on
   `applySelectionInput` only.
3. **react-hooks**: the new subpath, the three hooks and the shared source load they need.
4. **react-provider**: per-tree settings and their precedence against the global configuration.
5. **composition** (part 2): a new markup contract, event and method of the element, and portals.
6. **hide-sections** (part 2): one element property and attribute with an accessibility rule.

## Impact

- Capabilities, all ADDED (no living spec exists under `openspec/specs/`):
  - part 1, slice P3-S1: `selection-logic`, `search-params`, `react-hooks`, `react-provider`;
  - part 2, slice P3-S2: `composition`, `hide-sections`;
  - both parts are in the same spec PR (size waiver in tasks.md, "Rules for every slice").
- Superseded requirement: `req~apply-input-internal~1`
  (`docs/agent-work/delivera-2-load-current-contract/spec.md:62-64`), replaced by
  `req~apply-input-exported~1`; its test at `tests/unit/apply-selection.test.ts:69-73` is flipped
  (design.md, D2).
- Code areas: `src/core` (new `selection-change.ts`, `price-stabilizer.ts`, `search-params.ts`;
  `types.ts`, `index.ts`), `src/yaml` (new `source.ts`, `index.ts`), `src/element`
  (`pricing-renderer-element.ts`, `events.ts`, `renderers.ts`, `index.ts`), `src/react` (new `headless.ts`,
  `provider.ts`, `use-pricing-source.ts`, `selection-store.ts`, `use-pricing-selection.ts`,
  `use-renderer-state.ts`, `slots.ts`; `index.ts`), `package.json` (export `./react/headless` and
  the `package:check` entry list), `custom-elements.json`, `examples/react`, `examples/next`, a
  React harness page in `examples/vanilla` for the browser tests, docs, one changeset per code slice
  (exceptions in tasks.md).
- Public API, all additive: the functions and types above, one subpath, one provider, three hooks,
  element properties `slots` and `hideSections` with the attribute `hide-sections`, the method
  `triggerPlanAction`, the event `pricing-slots-change`, new parts, new React props.
- Dependencies: no new peer dependency (`createPortal` comes from `react-dom`, already an optional
  peer, `package.json:82-93`). CRP-P3-D (a): `react-router` in the private React example only,
  which changes `pnpm-lock.yaml`. P3-12b adds `react` and `react-dom`, already root dev
  dependencies, as dev dependencies of the private vanilla demo (an importer entry of the lockfile,
  no new package).
- Behaviour for existing hosts: none. Without the provider, the new subpath, `slots` or
  `hideSections`, the element and the wrapper behave as in 0.1.0. The request bounds of
  `loadPricingSource` apply on the hook path only (`usePricingSource`); the element's `reload()`
  keeps passing `request` as given (lead decision R2-REV-002; design.md, D5).
- Migration: none. No existing call changes; the request bounds apply only on the hook path
  (`usePricingSource`).
- Risks: design.md, "Risks".

## Out of scope

- A DOM test environment (CRP-P3-D (b)); a followup if review finds the hooks under-tested.
- A React 18 type or build check in CI (followup, `docs/agent-work/phase3-react-headless/plan.md at commit 07f10bf515d53e19b2a5fbc5abe5b2dddb74fa26 (git show 07f10bf5:docs/agent-work/phase3-react-headless/plan.md), section 7`).
- A browser harness for the React example app (followup, `docs/agent-work/phase3-react-headless/plan.md at commit 07f10bf515d53e19b2a5fbc5abe5b2dddb74fa26 (git show 07f10bf5:docs/agent-work/phase3-react-headless/plan.md), section 7`). The render-prop
  portals get a smaller harness page in the vanilla demo instead (tasks.md, P3-12b).
- Server rendering of the element, and render props on the server: the custom nodes appear after
  hydration (design.md, D9).
- A release: every slice adds a pending changeset only (`ROADMAP.md:137-148`).
- Changing `applySelection` (still silent), `resolvedState` or any existing event detail.
