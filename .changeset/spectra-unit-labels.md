---
'pricing-renderer': minor
---

Add `presentation.unitLabels` to set the singular and plural text of a usage unit per locale and unit, with `*` as the default for every locale. An entry wins over the built-in unit rules, and layers merge per locale and unit: element, then project configuration, then `custom.pricingRenderer.unitLabels` in the pricing. The `PricingUnitLabel` and `PricingUnitLabels` types are exported.
