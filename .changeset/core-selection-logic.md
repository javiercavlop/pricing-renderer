---
'pricing-renderer': minor
---

Export the selection logic of the element from the core, free of the DOM: `planSelectionChange`, `applySelectionChange`, `selectionWithVariable`, `selectionWithAddOnQuantity`, `selectionInEffect` and `createPriceStabilizer`, with the types `SelectionChangeIntent`, `SelectionChangeResult`, `PriceStabilizer` and `PendingAddOnChange`. `applySelectionInput` and its result type `ApplySelectionInputResult` are now public. Nothing existing changes: `PendingAddOnChange` is still exported from `pricing-renderer/element`, and the element behaves as before. `planSelectionChange` adds the whole transitive dependency chain of an add-on (the element's own collector is direct-only until a later change), and variable paths that would pollute a prototype are refused.
