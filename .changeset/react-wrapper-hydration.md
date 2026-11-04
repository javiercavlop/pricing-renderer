---
'pricing-renderer': patch
---

Hydrating the React wrapper (`PricingRenderer`, `PricingChangeReview`) after the element has rendered no longer logs a recoverable hydration error and no longer replaces the host node.
