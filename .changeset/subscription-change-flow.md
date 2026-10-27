---
'pricing-renderer': minor
---

Subscription change flow: comparison, SPACE helpers and guide. The new function `compareSelections` (package root) returns a JSON-safe, detached diff of two selections, each with its own pricing: the relation (`current`, `upgrade`, `downgrade`, `change`), the plan, the add-ons (added, removed by the user, removed by reconciliation with a reason, quantity changed), the features, the usage limits against the current usage, the price and the version change. The new subpath `pricing-renderer/space` has four pure functions without runtime dependencies, `selectionFromContract`, `subscriptionFromSelection`, `contractedVersion` and `currentUsageFromContract`; `examples/space-contract/map-contract.ts` now re-exports the first. The new guide `docs/change-subscription-flow.md` describes the host routes, the pricing version that the editor shows and the error and race handling.

Feedback from the Delivera integration (ISA group, Sept 2026).
