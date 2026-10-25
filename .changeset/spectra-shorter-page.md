---
'pricing-renderer': minor
---

New `only-differences` attribute sets the initial state of the comparison's "Only differences" checkbox; when it is absent, the checkbox starts checked for pricings with more than 100 comparison rows and 2 plans or more (visual change by default for those pricings, approved by the owner). New `toolbar-threshold` property (default 40) sets how many rows the comparison needs before the toolbar is shown. The counter now reads `{shown} of {total}` and counts only the rows actually rendered, and a search or filter that leaves no rows shows an empty state instead of an empty comparison.
