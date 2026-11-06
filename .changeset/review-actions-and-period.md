---
'pricing-renderer': minor
---

Three fixes to the change review, all found by driving it on a real page.

Confirm and Back stay reachable. The action row was sticky only inside a container narrower than 600px, so on a wider one the buttons scrolled out of a long comparison and the reader had to hunt for them. It is sticky at every width now, with a top border and a fully opaque background: at the previous 95% the rows behind it showed through and the bar read as broken.

A pricing that declares no billing periods no longer prints the one invented for it. `normalizePricing` has always synthesized `{ id: 'base', label: 'Base' }` so there is something to compute against, and the review printed that name beside every amount — "$3.99 Base" — as if the author had chosen it. The period now carries `synthesized: true` and the review shows a period name only when the pricing really offers a choice, which is the condition the period selector already used.

The review's own words say what is being confirmed: "Review your change of subscription", with "Cancel" and "Confirm your new subscription" in place of "Back" and "Confirm change". Spanish follows.

An amount now says what it is per. `PriceBreakdown` carries the selected plan's `unit`, so the review reads "$3.99 per user/month" like the plan card, instead of naming a billing period the author never chose.

The "Unchanged" line drops its add-on count. What a reader checks there is whether the entitlements they rely on survive the change; an add-on they did not touch is not news, and "0 add-ons, 3 features and 0 usage limits" led with the least useful number.

Add-on quantity limits read as a sentence instead of a specification. "Quantity 1-100000000, in steps of 1" is three facts of which one matters: a minimum of one and a step of one constrain nothing. The line now shows only the parts that do, with the numbers formatted for the locale, so that example reads "Up to 100,000,000" and an add-on with no real limits shows no line at all. A YAML `.inf` maximum already arrives as no maximum, since `normalizePricing` reads it as non-finite.
