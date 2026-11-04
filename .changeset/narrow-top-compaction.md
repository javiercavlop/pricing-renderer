---
'pricing-renderer': patch
---

Below 840px the top padding, the spacing between the rows above the plans (including metadata, variables and diagnostics) and the margin under the plans heading are capped as they already are from 840px, so the first plan price fits in the first screen of a phone. The row spacing is at most `--pr-space-5`, the top padding at most `--pr-space-4` and the heading margin is `--pr-space-3`, while smaller `--pr-shell-padding` and `--pr-space-section` values still apply. The space after the plans is unchanged; no new API. Minor visual change by default.
