---
'pricing-renderer': minor
---

Three fixes to the change review, all found by driving it on a real page.

Confirm and Back stay reachable. The action row was sticky only inside a container narrower than 600px, so on a wider one the buttons scrolled out of a long comparison and the reader had to hunt for them. It is sticky at every width now, with a top border and a fully opaque background: at the previous 95% the rows behind it showed through and the bar read as broken.

A pricing that declares no billing periods no longer prints the one invented for it. `normalizePricing` has always synthesized `{ id: 'base', label: 'Base' }` so there is something to compute against, and the review printed that name beside every amount — "$3.99 Base" — as if the author had chosen it. The period now carries `synthesized: true` and the review shows a period name only when the pricing really offers a choice, which is the condition the period selector already used.

The review's own words say what is being confirmed: "Review your change of subscription", with "Cancel" and "Confirm your new subscription" in place of "Back" and "Confirm change". Spanish follows.

Known gap: the review still shows no unit, so a monthly price reads "$3.99" rather than "$3.99 per user/month". The unit lives on the plan and `PriceBreakdown` does not carry it, so closing that needs the comparison to pass it through.
