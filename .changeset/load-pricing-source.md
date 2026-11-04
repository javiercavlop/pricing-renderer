---
'pricing-renderer': minor
---

Add `loadPricingSource` to `pricing-renderer/yaml`. It takes one of `pricing`, `yaml` or `src` and returns a pricing result: a failed result at once when no source or more than one is given, a result at once for `pricing` and `yaml`, and a promise for `src`.
