---
'pricing-renderer': patch
---

Apply `timeoutMs` and the abort signal to every step of `loadPricingFromUrl`: the `headers` function, `loadPricing`, `fetch` and the body read. A step that ignores the signal is cut off, its late result is ignored, and the load fails with `PR_SOURCE_ABORTED`. Hosts with slow loaders should raise `request.timeoutMs` (default 15 seconds). A `signal` already aborted when the call starts now fails the load with `PR_SOURCE_ABORTED` instead of completing.
