---
'pricing-renderer': patch
---

Add-on quantities are now always on the min/step grid: a quantity above the maximum is capped to the largest valid value (min 1, step 5, max 8 bills 6, not 8), and the quantity stepper uses the same limit. Resolving a pricing whose maximum is not reachable from the minimum in whole steps now reports a `PR_ADDON_CONSTRAINTS_INVALID` warning.
