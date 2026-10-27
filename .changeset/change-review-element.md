---
'pricing-renderer': minor
---

Review screen for a subscription change. The new element `<pricing-change-review>` (class `PricingChangeReviewElement`) renders a `SelectionComparison` in the light DOM: the plan with its relation, the price before and after, the add-ons, features and usage limits that change, a summary of what stays the same, the notices and the error of the host, and the Confirm and Back buttons. It is registered by the new subpath `pricing-renderer/define-change-review` and rendered in React by `PricingChangeReview`. The text is localized with the `pricing.review*` keys (`en-US` and `es-ES`), and the styles, the `data-pr-part` hooks, the dark theme, forced colors and reduced motion are in `base.css`. Every name, notice and error is rendered as text, never as HTML.
