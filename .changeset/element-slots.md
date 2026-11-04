---
'pricing-renderer': minor
---

`<pricing-renderer>` accepts a `slots` property (no attribute) with the names `plan-cta`, `summary-actions`, `loading` and `error`. For each requested slot the element renders an empty `div[data-pr-slot]` with the state as `data-*` attributes in place of the built-in control, and reports the nodes it rendered in the new `pricing-slots-change` event. The new `triggerPlanAction(planId)` method fires the `pricing-action` of a plan's built-in CTA. The types `PricingSlotName`, `PricingSlotsChangeDetail` and `PricingSlotsChangeEvent` are exported from `pricing-renderer/element` and `pricing-renderer/react`, and the React entry exports `PricingPlanCtaContext`, `PricingSummaryActionsContext` and `PricingErrorContext`. Without `slots` the markup is unchanged.
