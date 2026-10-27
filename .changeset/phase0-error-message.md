---
'pricing-renderer': patch
---

Show a human sentence in the element's error state instead of raw diagnostic codes. The sentence is chosen by the first error diagnostic (source, format, version or generic) and comes from the new message keys `pricing.errorSource`, `pricing.errorFormat`, `pricing.errorVersion`, `pricing.errorGeneric` and `pricing.errorDetails` (en-US and es-ES, overridable through `messages`). Every diagnostic code, message and path stays available inside a closed `details` with `data-pr-part="diagnostics"`.
