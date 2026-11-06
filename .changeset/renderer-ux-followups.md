---
'pricing-renderer': minor
---

Four changes to what the renderer puts on the page.

`diagnostics` is a new property (`"auto" | "verbose" | "off"`, default `"auto"`). A warning means the pricing rendered anyway, so it is the page author's business and not the visitor's: `"auto"` now shows errors only, `"verbose"` shows warnings too, and `"off"` shows none. Every diagnostic still reaches the `pricing-diagnostic` event in all three modes, so nothing is lost to a host that listens.

`hideSections` accepts three finer names, `saasName`, `description` and `tags`, for a page that already has its own title or lead paragraph. Hiding `saasName` keeps the title for screen readers, because it carries the id that labels the shell.

`humanizeIdentifier` gives the same label whatever style an id is written in. `max_pomodoro_timers` and `export-as-json` used to read as "Max pomodoro timers" and "Export as json" while `maxPomodoroTimers` read as "Max Pomodoro Timers"; every style now capitalizes each word. Acronyms stay whole (`SAML_SSO` is "SAML SSO"), letter and digit boundaries split (`api2Key` is "Api 2 Key"), and dots separate like dashes. This is the label used for a feature, usage limit, plan or add-on whose `name` is missing or blank.

The plans and add-ons headings no longer repeat themselves. Both printed the section name twice, as "Plans / Plans" and "Add-ons / Add-ons"; the eyebrow still names the section and the heading now reads "Choose a plan" and "Extend your plan", matching the pricing details section. Inside a plan card, a feature that is simply included no longer renders a second tick next to the bullet that already means it; its screen-reader text is unchanged.
