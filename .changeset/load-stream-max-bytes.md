---
'pricing-renderer': patch
---

Count the response body while `loadPricingFromUrl` reads it. A body over `maxBytes` (default 2 MiB), declared by `content-length` or counted, is cancelled and the load fails with `PR_SOURCE_TOO_LARGE`, so an oversized body without `content-length` is no longer buffered in full first.
