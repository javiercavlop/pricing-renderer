---
'pricing-renderer': minor
---

`<pricing-change-review>` takes a `hideSections` property (and a `hide-sections` attribute) with three parts: `actions`, for a diff the reader cannot act on; `relation`, the Upgrade/Downgrade badge, which follows the declaration order of `pricing.plans` and reads as a ladder that two configurations compared side by side do not have; and `title`, for a host whose own heading already names the comparison. Hiding the title drops its `aria-labelledby` with it, so the region never claims a name it has not. The content sections are deliberately not hideable.
