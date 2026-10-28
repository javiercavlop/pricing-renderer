---
'pricing-renderer': patch
---

Point each variable control's `aria-describedby` at its help text and its error message, which now carry the ids `<control id>-help` and `<control id>-error`, so a screen reader reads both when the control is focused.
