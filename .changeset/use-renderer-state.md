---
'pricing-renderer': minor
---

Add the `usePricingRendererState` hook to the `pricing-renderer/react/headless` entry, also re-exported from `pricing-renderer/react`. Given a ref to the element, it returns the last `pricing`, `selection` and `resolved` state the element announced, plus `applySelection`, or `undefined` until the element is ready and on the server. It follows the element when the ref changes.
