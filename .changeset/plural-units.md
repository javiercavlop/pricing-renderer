---
'pricing-renderer': patch
---

Pluralize the usage unit next to a numeric value in the comparison when the UI locale is
English, so `3 unit` reads `3 units`. A value of 1 keeps the singular, and compound units such
as `user/month`, and units under any other locale, are shown as written.
