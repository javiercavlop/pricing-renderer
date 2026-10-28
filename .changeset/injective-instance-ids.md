---
'pricing-renderer': patch
---

Ids derived from data (variable paths, group ids, add-on ids) now escape every character other than letters and digits as `_<hex>_`, so two different values can no longer produce the same id; these ids are not a documented hook.
