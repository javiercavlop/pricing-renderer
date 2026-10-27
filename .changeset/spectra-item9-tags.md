---
'pricing-renderer': minor
---

The comparison groups now follow the declared `tag` of features and usage limits (visual change, approved by the owner). A pricing that declares no tag renders one comparison with no group headers and no "Expand all" / "Collapse all" buttons, features first and then usage limits, with the first 30 rows shown and a "Show N more" button. A pricing that declares some tags keeps its tag groups and adds a last group named `Other features` (new message key `pricing.otherFeatures`, `Otras características` in Spanish) with every feature and usage limit that has no tag; untagged usage limits now appear there instead of under `Usage limits`. A pricing where every row declares a tag is unchanged. `PricingComparisonGroup` has a new optional `kind` field (`'tag'`, `'other-features'` or `'untagged'`; absent means `'tag'`).
