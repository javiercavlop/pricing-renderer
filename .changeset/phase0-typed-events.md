---
'pricing-renderer': minor
---

Type `addEventListener` for `pricing-ready`, `pricing-selection-change`, `pricing-action` and `pricing-diagnostic` through a global `HTMLElementEventMap` augmentation, so `element.addEventListener('pricing-action', (event) => event.detail.actionId)` needs no cast.
