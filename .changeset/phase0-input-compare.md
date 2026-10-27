---
'pricing-renderer': patch
---

Compare the `pricing`, `request` and `normalizeOptions` properties of the element by content (arrays and plain objects; functions, `Headers`, `AbortSignal` and other class instances by identity). Assigning a structurally equal object, such as a literal rebuilt on every render, no longer reloads the pricing. `loadPricing` keeps the identity compare, so hosts should memoize it, and call `reload()` to force a fetch, also after changing an object in place.
