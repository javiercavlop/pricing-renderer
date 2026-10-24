---
'pricing-renderer': minor
---

Explain the estimated total with a price breakdown. `resolvePricing` returns the new field
`ResolvedPricing.breakdown`, a JSON-safe description of the lines behind `subtotal` and
`requiresQuote`: currency, billing period, the plan line and one line per selected add-on in the
declaration order of `pricing.addOns`, each with quantity, unit price, billing multiplier, amount,
quote state and label. The types `PriceBreakdown` and `PriceBreakdownLine` are exported from
`pricing-renderer`. `breakdown` is a required field, so code that builds a `ResolvedPricing` by
hand, such as test doubles, must add it; this is accepted in 0.1.x. It reaches `resolvedState`, the
`applySelection` result and the details of `pricing-ready`, `pricing-selection-change` and
`pricing-action` with no change to those types.

`subtotal` is now summed in a documented order: the plan first, then the add-ons in the
declaration order of `pricing.addOns` (before: the key order of `selection.addOns`). Integer
amounts and selections with at most one priced add-on are unchanged; with two or more decimal
add-on amounts the last binary digit can differ from earlier versions. An add-on with
`minQuantity: 0` selected at quantity 0 has a breakdown line with quantity 0 and amount 0, so it
adds 0 to the subtotal, while `addOnPrices` still prices it at quantity 1.

The summary shows a small "How is this calculated?" (i) button next to the total. It toggles an
inline panel (not a modal) with the formula of each line, the billing period, the currency and the
total. The button has an accessible name, `aria-expanded` and `aria-controls`; Enter, Space and
click toggle it, and Escape closes the panel and returns focus to the button. The button is shown
whatever `selectionEnabled`, `ctaEnabled` and `variablesEnabled`. New stable part hooks:
`breakdown-toggle`, `breakdown` and `breakdown-line`. The `aria-live="polite"` attribute of the
summary moves from the `aside` to an inner region, so the panel is not announced; hosts that select
`[data-pr-part='summary'][aria-live]` must update the selector. New message keys in `en-US` and
`es-ES`: `pricing.breakdownToggle`, `pricing.breakdownTitle` and `pricing.breakdownFormula`.
Controlled quantities above the maximum are now shown and stepped as normalized quantities, and
`maxQuantityOnGrid` never exceeds `maxQuantity`.

`compareSelections` is not included; hosts can diff two breakdowns by line `id`, and a comparison
function is left as a follow-up.

Feedback from the Delivera integration (ISA group, Sept 2026).
