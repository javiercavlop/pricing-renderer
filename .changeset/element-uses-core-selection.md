---
'pricing-renderer': patch
---

The element now uses the core selection functions (`planSelectionChange`, `applySelectionChange`,
`selectionWithVariable`, `selectionWithAddOnQuantity`, `selectionInEffect` and
`createPriceStabilizer`). Add-ons with two-level `dependsOn` chains now add the whole chain when
selected, and the confirmation also removes the selected add-ons that any dependency of the chain
excludes. Two edge cases change too: add-ons that list themselves in `dependsOn` no longer appear
in the confirmation's added list, and plan or add-on ids named like `Object.prototype` members
(`constructor`, `toString`, `valueOf`) no longer read an inherited value as a kept price.
