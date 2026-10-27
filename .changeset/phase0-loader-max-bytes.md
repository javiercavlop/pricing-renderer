---
'pricing-renderer': patch
---

Apply `request.maxBytes` (default 2 MiB) to a string returned by a custom `loadPricing`, measured in UTF-8 bytes. A larger string fails with `PR_SOURCE_TOO_LARGE`; an object result is not measured. Hosts whose loader returns more than 2 MiB of text must raise `request.maxBytes`.
