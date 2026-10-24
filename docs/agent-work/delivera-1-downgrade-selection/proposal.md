# Proposal: reconcile the add-on selection when the plan changes

Feedback from the Delivera integration (ISA group, Sept 2026)

The requirements live in `spec.md` in this folder. This proposal covers change 1 of that feedback.

## Motivation

`_selectPlan` in `src/element/pricing-renderer-element.ts` only replaces `planId`. Add-ons that
the new plan does not offer (`availableFor` excludes it) stay selected. The card for the add-on is
disabled, but the subtotal still includes it, and `pricing-selection-change` reports a selection
that downstream contract creation rejects.

Reproduction on `tests/fixtures/acme-pricing.yml` (defaults: `seats: 5`, monthly billing):

- Select the Growth plan (`9 * #seats` = 45 EUR).
- Select the `extraStorage` add-on (5 EUR, quantity 1, `availableFor: [growth, enterprise]`):
  subtotal 50 EUR.
- Select the Starter plan (`4 * #seats` = 20 EUR).
- Observed: `extraStorage` is still selected, the subtotal is 25 EUR and the event detail has
  `{ planId: 'starter', addOns: { extraStorage: { selected: true, quantity: 1 } } }`.
- Expected: after confirmation the subtotal is 20 EUR and `extraStorage` is not selected.

The same gap exists in `resolvePricing` (`src/core/resolve.ts`): it adds every selected add-on with
an amount price to the subtotal without checking availability, and the element repeats that sum in
`_stabilizeResolvedPrices`.

## What changes

- Core: a pure function `reconcileSelection(pricing, selection)` returns
  `{ selection, removedAddOnIds }`. It deselects every add-on not available for
  `selection.planId` (same rule as `addOnAvailability` in `src/element/renderers.ts`: an empty
  `availableFor` means available for every plan) and every selected add-on that depends on a removed
  one, transitively. It does not mutate its input. It is exported from `src/core/index.ts`.
- Element, plan change: `_selectPlan` reconciles the selection for the new plan. When nothing is
  removed, the plan change applies at once as today. When add-ons would be removed, the element
  opens the confirmation dialog already used for dependencies and exclusions (`renderPendingDialog`)
  and lists the removed ids.
- Confirm applies the new plan and the removals and emits exactly one `pricing-selection-change`.
- Cancel (the cancel button or Escape) keeps the previous plan and selection, emits no event and
  returns focus to the control that triggered the change.
- `resolvePricing`: `subtotal` and `requiresQuote` ignore selected add-ons that are unavailable for
  the selected plan and their selected dependents. The element's subtotal recomputation in
  `_stabilizeResolvedPrices` follows the same rule. `resolved.selection` is not rewritten.
- `defaultSelection`: on load, the merged default selection is reconciled silently (no dialog, no
  `pricing-selection-change`).
- Controlled `selection` prop: the element never writes to it. A confirmed plan change emits the
  reconciled selection in the event, and the host decides whether to apply it.
- React: `src/react` wraps the element through `@lit/react`, so it gets the behaviour without logic
  of its own.

## Scope

- `src/core` (new `reconcileSelection`, availability in `resolvePricing`, export).
- `src/element` (plan change flow, pending change type, subtotal recomputation).
- `src/react` (no logic change; covered by the element behaviour).
- `tests/unit`, `tests/browser/pricing-renderer.spec.ts`.
- `docs/api-reference.md`, `.changeset`.

## Out of scope

- Changes 2 to 4 of the same feedback; they arrive as separate changes later.
- Visual snapshots are not updated. Expected snapshot impact: none, because the fixture is not
  edited and the baselines capture the initial render, where no add-on is selected.
- Billing period and variable changes: they do not affect availability and keep their behaviour.

## Public API impact

Owner-approved by CRP. Minor changeset for `pricing-renderer`:

- New export `reconcileSelection(pricing, selection): { selection, removedAddOnIds }` from the core
  entry point.
- New optional field `planId?: string` on `PendingAddOnChange`. A pending plan change is
  `{ addOnId: '', select: false, addIds: [], removeIds, planId }`.
- `resolvePricing` keeps its signature; only its `subtotal` and `requiresQuote` values change for
  selections with unavailable add-ons.

No other public API change. Any other change found during design or implementation must be
escalated again before it is made.

## Risks

- Open question: should `pricing-action` details carry the reconciled selection when a host passes
  an invalid controlled `selection`? Recommendation: yes. `detail.resolved.subtotal` already
  excludes the unavailable add-ons, so `detail.selection` must match it; sending the raw selection
  would reproduce the downstream rejection this change fixes. The prop itself stays untouched and no
  `pricing-selection-change` is emitted. Until `spec.md` states the answer, this stays open.
- `resolvePricing` sets `requiresQuote` when a selected add-on id is unknown to the pricing (no
  resolved price). That behaviour is unchanged here; `reconcileSelection` only removes known add-ons
  that are unavailable.
- Hosts that relied on the old subtotal for invalid selections will see a lower value. This is the
  fix, and the changeset states it.
- Reusing the add-on dialog for plans: the dialog text must still read correctly when `addIds` is
  empty and only removals are listed. The existing `pricing.willRemove` message covers it.

## Test plan

Tests are written first and fail before the implementation.

- `tests/unit`: `reconcileSelection` on the acme fixture (Starter with `extraStorage` and
  `prioritySuccess` selected removes both; Growth keeps `extraStorage`; transitive dependents; empty
  `availableFor`; input not mutated; nothing removed returns an empty `removedAddOnIds`).
- `tests/unit`: `resolvePricing` subtotal and `requiresQuote` for Starter with `extraStorage`
  selected (20 EUR, no quote) and for dependents of an unavailable add-on.
- `tests/unit`: `defaultSelection` with an unavailable add-on is reconciled on load.
- `tests/browser/pricing-renderer.spec.ts` (vitest has no DOM, so the element flow runs in
  Playwright): Growth + `extraStorage` then Starter opens the dialog; confirm emits one event with
  subtotal 20 EUR; cancel and Escape keep Growth and emit nothing; focus returns; a plan change with
  nothing to remove opens no dialog; a controlled `selection` is not rewritten.

## Rollout

- Minor changeset for `pricing-renderer` describing the new export, the new field and the subtotal
  correction.
- `docs/api-reference.md`: a section for `reconcileSelection` and the `planId` field of
  `PendingAddOnChange`, plus a note on the plan change confirmation.
