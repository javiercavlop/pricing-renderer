---
'pricing-renderer': minor
---

Add `applySelection(selection)` to `<pricing-renderer>` to load a known selection, such as the
customer's current subscription, once the pricing is ready. It merges the input over the schema
defaults, validates it against the loaded pricing, reconciles it and replaces the internal
selection without emitting `pricing-selection-change`. It never throws for an expected state:
before the pricing is ready, or when the `selection` property is set, it returns
`applied: false` with the error `PR_SELECTION_NOT_READY` or `PR_SELECTION_CONTROLLED`. The new
type `ApplySelectionResult` is exported from `pricing-renderer/element` and re-exported from
`pricing-renderer/react`. Add the read-only getter `resolvedState`, a detached snapshot of the
selection in effect and its resolved pricing, or `undefined` while the element is not ready.
`PricingReadyDetail` has the new required fields `selection` and `resolved`, so code that builds
a `PricingReadyDetail` by hand must add both. New diagnostic codes: `PR_SELECTION_UNKNOWN_PLAN`,
`PR_SELECTION_UNKNOWN_BILLING_PERIOD`, `PR_SELECTION_UNKNOWN_ADDON`,
`PR_SELECTION_ADDON_REMOVED`, `PR_SELECTION_NOT_READY` and `PR_SELECTION_CONTROLLED`.
`pricing-diagnostic` now also fires after `applySelection` calls, including the two refusals, so
hosts that treat any error in `pricing-diagnostic` as a load failure must check the code.
`defaultSelection` is unchanged: a later load restarts from it. A new guide, "Preload the current
subscription", shows how to map a SPACE contract with the example in `examples/space-contract/`.

Feedback from the Delivera integration (ISA group, Sept 2026).
