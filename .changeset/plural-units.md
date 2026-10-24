---
'pricing-renderer': patch
---

Pluralize the usage unit next to a numeric value in the comparison, so `3 unit` reads `3 units`
and `3 licencia` reads `3 licencias` in the active locale. A value of 1 keeps the singular, and
compound units such as `user/month` are shown as written.
