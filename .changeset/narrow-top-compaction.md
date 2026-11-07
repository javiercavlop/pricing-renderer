---
'pricing-renderer': patch
---

Below 840px the top padding, the spacing between the rows above the plans (metadata, variables and diagnostics included) and the margin under the plans heading are capped exactly as they already are from 840px, so the first plan price fits in the first screen of a phone. The row spacing is at most `--pr-space-5`, the top padding at most `--pr-space-4` and the heading margin is `--pr-space-3`, while smaller `--pr-shell-padding` and `--pr-space-section` values still apply through `min()`. The space after the plans is unchanged and there is no new API. Measured on the clickup fixture at 375x812: the first plan price bottom moves from 820.8px, 8.8px past the fold, to 776.8px, 35.2px inside it. Minor visual change by default.
