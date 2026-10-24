---
'pricing-renderer': patch
---

Price expressions now use strict equality for `==`, `===`, `!=` and `!==`, so `-0` equals `0` and `NaN` never equals `NaN`.
