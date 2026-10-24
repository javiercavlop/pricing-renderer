---
'pricing-renderer': patch
---

`maxQuantityOnGrid` never exceeds the maximum because of floating-point error, and the quantity stepper in controlled mode shows and steps from the normalized quantity.
