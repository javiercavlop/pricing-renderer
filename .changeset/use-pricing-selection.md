---
'pricing-renderer': minor
---

Add the `usePricingSelection` hook to the `pricing-renderer/react/headless` entry, also re-exported from `pricing-renderer/react`. It takes a normalized pricing and options, keeps the selection in a store owned by the component instance, without the custom element, and returns the current snapshot with stable actions (`selectPlan`, `toggleAddOn`, `setVariable`, `setAddOnQuantity`, `setBillingPeriod`, `resetVariables`, `confirm`, `cancel`, `apply`) and queries (`relationOf`, `compareWithCurrent`). Options come from the instance first, then from `PricingRendererProvider`, then from the global configuration.
