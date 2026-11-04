---
'pricing-renderer': patch
---

The element now uses the core selection functions (`planSelectionChange`, `applySelectionChange`,
`selectionWithVariable`, `selectionWithAddOnQuantity`, `selectionInEffect` and
`createPriceStabilizer`). Add-ons with two-level `dependsOn` chains now add the whole chain when
selected, and the confirmation also removes the selected add-ons that any dependency of the chain
excludes; no other behaviour change.
