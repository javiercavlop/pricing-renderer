---
'pricing-renderer': patch
---

Localize the loading text of the element: while it is idle or loading, the hidden heading and the status text use `loadingLabel` when set, and otherwise `pricing.loading` from the element's `locale` and `messages`, instead of a fixed English string.
