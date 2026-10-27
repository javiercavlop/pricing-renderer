---
'pricing-renderer': minor
---

Subscription change flow. The new element `<pricing-change-review>` (class `PricingChangeReviewElement`, React component `PricingChangeReview`) takes a `SelectionComparison` from `compareSelections` and emits the cancelable events `pricing-change-confirm` and `pricing-change-back`. It is registered by the new subpath `pricing-renderer/define-change-review` (or by `definePricingChangeReview()`, or when the React component renders); `pricing-renderer/define` and the React entry still register only `pricing-renderer`. The new guide `docs/change-subscription-flow.md` describes the host routes, the pricing version that the editor shows and the error and race handling. Behavior change for all hosts: in the `href` of a plan CTA, every `{planId}` is now replaced with the encoded plan id before the link is checked, so an `href` that contains that literal text changes.

Feedback from the Delivera integration (ISA group, Sept 2026).
