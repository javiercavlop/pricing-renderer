---
'pricing-renderer': patch
---

The focus ring on a comparison row that takes focus after "Show N more" is now drawn inside the row, so the sticky first column and the scroll container no longer hide it. The temporary `tabindex="-1"` that the reveal adds is removed when the row loses focus.
