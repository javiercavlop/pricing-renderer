---
'pricing-renderer': minor
---

Pricings with more than 8 add-ons now render compact add-on cards of equal height per row, with the availability, dependency and exclusion details moved into the existing details disclosure (new i18n key `pricing.moreDetails`). Pricings with 14 or more add-ons also get a search box and show 8 cards first with a "Show more" button; selected add-ons are never hidden (new i18n key `pricing.searchAddOns`). The threshold is configurable with the new `add-on-filter-threshold` attribute or `addOnFilterThreshold` property (default 13). Pricings with 8 or fewer add-ons are unchanged.
