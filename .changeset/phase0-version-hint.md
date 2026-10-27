---
'pricing-renderer': patch
---

Tell the host how to fix a `PR_VERSION_UNSUPPORTED_MAJOR` error: for a major below 3 the message says to upgrade the pricing to 3.x on the server, for example with `retrievePricingFromText` from `pricing4ts/server`; for a major above 3 it says the version is not supported yet. The code and severity are unchanged.
