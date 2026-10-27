---
'pricing-renderer': patch
---

Cancel the pricing load in flight when `reload()` finds no source or more than one: a slow `src` load that finishes after `src` was removed no longer emits `pricing-ready` or replaces the `PR_SOURCE_MISSING` / `PR_SOURCE_CONFLICT` error.
