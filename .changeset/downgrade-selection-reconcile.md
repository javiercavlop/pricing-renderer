---
'pricing-renderer': minor
---

Add `reconcileSelection`, which deselects add-ons that are unavailable for the selected plan and
the add-ons that depend on them. Changing plan in `<pricing-renderer>` now asks for confirmation
when add-ons would be removed, then applies the plan and the removals in one
`pricing-selection-change`; cancelling keeps the previous plan. `resolvePricing` and the rendered
subtotal no longer sum unavailable add-ons, and emitted selections are reconciled. `PendingAddOnChange` has a new optional `planId` field with
the plan the pending change switches to. `requiresQuote` is no longer set by a quote-priced
add-on that is unavailable for the selected plan.

Feedback from the Delivera integration (ISA group, Sept 2026).
