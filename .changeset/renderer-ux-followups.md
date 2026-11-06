---
'pricing-renderer': minor
---

Four changes to what the renderer puts on the page.

`diagnostics` is a new property (`"auto" | "verbose" | "off"`, default `"auto"`). A warning means the pricing rendered anyway, so it is the page author's business and not the visitor's: `"auto"` now shows errors only, `"verbose"` shows warnings too, and `"off"` shows none. Every diagnostic still reaches the `pricing-diagnostic` event in all three modes, so nothing is lost to a host that listens.

`hideSections` accepts three finer names, `saasName`, `description` and `tags`, for a page that already has its own title or lead paragraph. Hiding `saasName` keeps the title for screen readers, because it carries the id that labels the shell.

`humanizeIdentifier` gives the same label whatever style an id is written in. `max_pomodoro_timers` and `export-as-json` used to read as "Max pomodoro timers" and "Export as json" while `maxPomodoroTimers` read as "Max Pomodoro Timers"; every style now capitalizes each word. Acronyms stay whole (`SAML_SSO` is "SAML SSO"), letter and digit boundaries split (`api2Key` is "Api 2 Key"), and dots separate like dashes. One rule now gives the label of a feature, usage limit, plan or add-on, and it covers three cases instead of two: a `name` that is missing, one that is blank, and one that is just the id again. That last case is not hypothetical — a Pricing2Yaml upgraded by SPACE carries `name: basic` for a plan keyed `basic`, so a page read "basic" and "premium" while its features read "Pomodoro Timer". A name an author actually wrote is never rewritten: it has to equal the id exactly.

The plans and add-ons headings no longer repeat themselves. Both printed the section name twice, as "Plans / Plans" and "Add-ons / Add-ons"; the eyebrow still names the section and the heading now reads "Choose a plan" and "Extend your plan", matching the pricing details section. Inside a plan card, a feature that is simply included no longer renders a second tick next to the bullet that already means it; its screen-reader text is unchanged.

The card of the plan a visitor is already on no longer says so three times. It carried a "your plan" badge, a visibly checked radio and a "Selected" label; the label is dropped there, and it comes back the moment a different plan is selected, where it is the only thing that marks the choice. The radio keeps its own `aria-label`, so nothing changes for a screen reader.

The change review leads with the number it exists for. Its three price values — current, new and the difference — all shared one size and one weight, so the difference, the only one a visitor opens the screen to read, had no more weight than the two it is derived from. It now takes `--pr-font-size-2xl` and carries `data-pr-part="price-difference"` with a `data-direction` of `increase`, `decrease` or `same`: a decrease takes the success tone, an increase the accent. An increase is not an error, since the visitor asked for it, so no warning colour is used.

The price typography is three new tokens, `--pr-price-size`, `--pr-price-weight` and `--pr-price-tracking`, with this component's current values as their defaults, so nothing moves unless a host moves it. The size and weight were literals before: a survey of 49 live pricing pages found the price running from 16px, where a usage-based product deliberately refuses to shout, to 64px, and from weight 300 to 700 with 400 the most common. The shipped default sits at the loud end of that range, which is a choice a host can now make differently without redefining `--pr-font-weight-bold` and dragging every other bold thing with it.
