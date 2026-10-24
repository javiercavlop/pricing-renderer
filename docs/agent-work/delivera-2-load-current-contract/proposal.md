Feedback from the Delivera integration (ISA group, Sept 2026)

# Proposal: load the current contract into the renderer

The requirements live in `spec.md` in this folder. This proposal covers change 2 of 4 of that
feedback. Change 1 (`delivera-1-downgrade-selection`, `reconcileSelection`) is merged and this
change builds on it.

Status: APPROVED by the owner, API as proposed below (see "Decisions").

## Motivation

Delivera shows `<pricing-renderer>` to customers who already have a subscription, stored as a SPACE
contract. The page must open on the plan and add-ons the customer has today, so that the customer
starts from the current contract and changes it. The element has no way to do that today:

- `defaultSelection` is read only in `_applyLoadResult` (`src/element/pricing-renderer-element.ts`).
  Setting it after the pricing has loaded changes nothing until the next load, and it is not one of
  the inputs that trigger a reload. Calling `reload()` to apply it reparses the pricing and resets
  the view.
- `defaultSelection` is not validated. On `tests/fixtures/acme-pricing.yml`, the default selection
  `{ planId: 'Growth', addOns: { extraStorage: { selected: true, quantity: 2 } } }` (wrong case of
  `growth`) renders no selected plan and an estimate of 0 EUR: the plan id is unknown, so the plan
  price is missing and `reconcileSelection` removes `extraStorage` (its `availableFor` does not
  include an unknown plan). No diagnostic tells the host why.
- The controlled `selection` property shows the contract, but then the host must store and echo
  every user change from `pricing-selection-change`; Delivera wants the element to keep the
  selection itself after preloading it.
- The host cannot read the selection and the resolved subtotal the element shows without waiting for
  a user event: `pricing-ready` carries only `{ pricing, diagnostics }`.

Expected flow on the acme fixture (defaults: `seats: 5`, monthly billing): the customer's contract
is Growth with 2 `extraStorage` packs and `prioritySuccess`. Once the pricing is ready, the host
applies that selection, and the element shows Growth selected and an estimate of 80 EUR
(45 + 2 x 5 + 25) without emitting `pricing-selection-change`, because the user changed nothing.

## What changes

- Element method `applySelection(selection: Partial<PricingSelection>): ApplySelectionResult`,
  synchronous. It merges the input over the schema defaults (`createDefaultSelection`, as
  `mergeSelection` does; omitted or `undefined` fields take the default, not the current selection),
  validates it against the loaded pricing, reconciles it with `reconcileSelection`, replaces the
  internal (uncontrolled) selection and re-renders. It emits no `pricing-selection-change`, opens no
  confirmation dialog and discards an open pending-change dialog as Cancel does. The input is not
  mutated and the element keeps no reference to it.
- Validation, in a pure internal core function in `src/core/apply-selection.ts` (not exported from
  `src/core/index.ts`): an unknown plan or billing period is replaced by the one of the selection in
  effect, unknown add-on ids are dropped and selected add-on quantities are normalized silently.
  Unknown plans, billing periods and add-on ids yield warnings (`PR_SELECTION_UNKNOWN_PLAN`,
  `PR_SELECTION_UNKNOWN_BILLING_PERIOD`, `PR_SELECTION_UNKNOWN_ADDON`); each add-on removed by
  reconciliation yields an info diagnostic (`PR_SELECTION_ADDON_REMOVED`).
- Refusals by result, not by exception: before the pricing is ready the call returns
  `applied: false` with the error `PR_SELECTION_NOT_READY`; in controlled mode it returns
  `applied: false` with the error `PR_SELECTION_CONTROLLED` and the current state. Nothing is stored.
- Diagnostics are returned and also dispatched in one `pricing-diagnostic` event when the list is
  not empty. They are not added to the diagnostics list the element renders.
- Getter `resolvedState: PricingSelectionChangeDetail | undefined`: a detached snapshot of the
  selection in effect and the resolved pricing with the subtotal the element renders; `undefined`
  while not ready. `PricingReadyDetail` gains the required fields `selection` and `resolved` with the
  same values.
- A SPACE example, `examples/space-contract/map-contract.ts`, maps a contract to a
  `Partial<PricingSelection>` for one service, with a guide in `docs/preload-current-subscription.md`.
  The package gets no SPACE dependency and no new runtime export for it.

## Decisions

Approved by the owner on the proposal of this change. Each point is final for this change; any
deviation found during design or implementation must be escalated again before it is made.

- Approved as proposed: the method, the getter, the new `PricingReadyDetail` fields, the exported
  type, the diagnostics codes and the validation order described in `spec.md`.
- SPACE: option A. The contract mapping is only an example in `examples/space-contract/`, tested
  from `tests/unit/space-contract.test.ts`, with a structural input type. The package does not
  depend on SPACE and exports no mapping function, so its releases do not follow the SPACE
  contract format.
- Refusal by result: `applySelection` never throws for "not ready" or "controlled" and never
  queues the call. It returns `applied: false` with an error diagnostic, also dispatched in
  `pricing-diagnostic`, so hosts calling it from event listeners need no `try`/`catch` for an
  expected state.
- Discriminated union: `ApplySelectionResult` is a union discriminated by `applied`. When
  `applied` is `true`, `selection` and `resolved` are always defined; when it is `false`,
  `removedAddOnIds` is the empty tuple `[]`.
- Required fields: `PricingReadyDetail.selection` and `PricingReadyDetail.resolved` are required,
  not optional. Code that builds a `PricingReadyDetail` by hand stops compiling; this is accepted
  in a minor release because the element is the only producer of the event.
- `defaultSelection` unchanged: it is still merged and reconciled silently on each successful load,
  without validation and without new diagnostics. A later successful load (`reload()` or a new
  source) restarts from `defaultSelection`; an applied selection is not kept across loads.

## Scope

- `src/core`: new internal `src/core/apply-selection.ts` (validation and reconciliation, not exported
  from `src/core/index.ts`).
- `src/element`: `applySelection`, `resolvedState`, the selection in `pricing-ready`, the
  `ApplySelectionResult` type in `src/element/events.ts` and its export from `src/element/index.ts`.
- `src/react`: re-export of `ApplySelectionResult`; no wrapper logic (a ref to `PricingRenderer`
  is the element, so it already gives the method and the getter).
- `tests/unit`, `tests/browser/pricing-renderer.spec.ts`.
- `examples/space-contract/**` (new example).
- `docs/api-reference.md`, `docs/configuration.md` (new section "Controlled versus uncontrolled"),
  `docs/preload-current-subscription.md` (new guide), `.changeset` (minor), `custom-elements.json`.

## Out of scope

- Changes 3 and 4 of the same feedback; they arrive as separate changes.
- Validation of `defaultSelection` and diagnostics for it.
- Diagnostics for clamped or stepped quantities: step 4 normalizes them silently.
- Validation of `variables`: they are merged as `mergeSelection` does and passed through.
- A runtime SPACE export, a SPACE dependency or a billing period from the contract (SPACE contracts
  do not carry one, so the mapping omits `billingPeriod`).
- Visual snapshots are not updated. Expected impact: none, because the initial render of the demo
  does not change.

## Public API impact

Owner-approved (see "Decisions"). Minor changeset for `pricing-renderer`:

- New element method `applySelection(selection: Partial<PricingSelection>): ApplySelectionResult`.
- New read-only element getter `resolvedState: PricingSelectionChangeDetail | undefined`.
- New exported type `ApplySelectionResult` from `pricing-renderer/element`, re-exported from
  `pricing-renderer/react`:

  ```ts
  type ApplySelectionResult =
    | {
        applied: true;
        selection: PricingSelection;
        resolved: ResolvedPricing;
        removedAddOnIds: string[];
        diagnostics: PricingDiagnostic[];
      }
    | {
        applied: false;
        selection: PricingSelection | undefined;
        resolved: ResolvedPricing | undefined;
        removedAddOnIds: [];
        diagnostics: PricingDiagnostic[];
      };
  ```

- `PricingReadyDetail` gains the required fields `selection: PricingSelection` and
  `resolved: ResolvedPricing`. Hand-built `PricingReadyDetail` objects stop compiling until they
  add both fields.
- `pricing-diagnostic` gains a trigger: it now also fires after `applySelection` calls, including
  for the error refusals `PR_SELECTION_NOT_READY` and `PR_SELECTION_CONTROLLED`. Hosts that treat
  any error in `pricing-diagnostic` as a load failure must check the code. The documentation and
  the changeset state this.
- No existing signature changes. No new export from `src/core/index.ts`. `custom-elements.json`
  lists the new method and getter and describes `pricing-ready` and `pricing-diagnostic`.

## Risks

- Race with an in-flight reload: a call made while a load is in flight is refused with
  `PR_SELECTION_NOT_READY` and stores nothing, so the load that ends later cannot be overwritten by
  a stale selection, nor can the call be lost silently. Hosts that preload a contract do it from a
  `pricing-ready` listener.
- Call inside `pricing-ready`: the element sets its ready state and internal selection before it
  dispatches `pricing-ready` and assigns neither after the dispatch, so a selection applied by a
  listener stays for that load. A test covers it.
- Getter cost: `resolvedState` resolves the pricing and deep-copies the result on every read. It is
  meant to be read on events, not in a render loop; the documentation says so.
- View-model cache write: the getter uses the same price stabilization as the render
  (`_stabilizeResolvedPrices`), which records the last valid plan and add-on prices. Reading the
  getter can therefore update that cache; it records the same values the next render would record,
  so the rendered output does not change.
- `pricing-diagnostic` consumers: see "Public API impact"; the demo page shows a toast for any
  error diagnostic and must keep working.
- Hosts that pass a partial selection expecting it to be merged over the current selection get the
  schema defaults for the omitted fields instead. The documentation and the guide state that
  `applySelection` replaces the selection.

## Test plan

Tests are written first and fail before the implementation (red before).

- `tests/unit` (vitest, node, no DOM): the internal core function on the acme fixture and on
  `tests/fixtures/spectra/slack/2024.yml` (unknown plan, billing period and add-ons, quantities,
  merge over defaults, reconciliation, diagnostics order, no mutation), `resolvePricing` on its
  results (80, 58.75, 0 and 20), the SPACE example mapping, the absence of new core and package
  exports, the React re-export of the element API and `custom-elements.json`. The required
  `PricingReadyDetail` fields and the `ApplySelectionResult` union are checked with the TypeScript
  compiler API from the unit tests, because `vitest run` does not type-check.
- `tests/browser/pricing-renderer.spec.ts` (Playwright, the demo page loads the acme fixture): the
  Delivera flow from a `pricing-ready` listener (80 EUR, no `pricing-selection-change`), success
  result and `resolvedState`, no dialog and a discarded pending dialog, refusals while a first load
  or a reload is in flight, after a failed first load and in controlled mode, the single `pricing-diagnostic` event, detached input and snapshots,
  reload back to `defaultSelection` (Starter, 20 EUR) and the `pricing-ready` detail.

## Rollout

- Minor changeset for `pricing-renderer`: the method, the getter, the type, the new required
  `PricingReadyDetail` fields and the new `pricing-diagnostic` trigger.
- `docs/api-reference.md`: `applySelection`, `resolvedState`, `ApplySelectionResult`, the
  diagnostics codes and the updated `pricing-ready` and `pricing-diagnostic` rows.
- `docs/configuration.md`: section "Controlled versus uncontrolled" (what `selection`,
  `defaultSelection` and `applySelection` each do, and that `applySelection` is refused in
  controlled mode).
- `docs/preload-current-subscription.md`: the guide for preloading a SPACE contract with the
  example mapping.
- `custom-elements.json`: the method, the getter and the event descriptions.
