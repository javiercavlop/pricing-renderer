---
'pricing-renderer': minor
---

New subpath `pricing-renderer/space` with helpers for SPACE contracts. It has no runtime imports and makes no HTTP call. `selectionFromContract(contract, serviceKey)` maps a contract to the input of `applySelection` (it moves from `examples/space-contract/map-contract.ts`, which now re-exports it). `subscriptionFromSelection(serviceKey, version, selection)` builds the novation body `{ contractedServices, subscriptionPlans, subscriptionAddOns }` from a reconciled selection. `contractedVersion(contract, serviceKey)` returns the stored version with `_` turned back into `.`. `currentUsageFromContract(contract, serviceKey)` maps the `consumed` value of each usage limit. Service keys are matched exactly, so pass the lowercase key SPACE stores. The preload guide now imports from this subpath instead of asking readers to copy the example file.
