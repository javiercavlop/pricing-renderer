---
'pricing-renderer': minor
---

An add-on that cannot be combined with one already selected is now shown as unavailable, the way an add-on the plan does not offer already was: not selectable, its checkbox disabled, and a status on the card that names what blocks it — "Not available with Github Codespaces 2 Core" — instead of letting a click open a dialog to say so. The add-on doing the blocking always stays operable, so it can be removed. When the plan and an exclusion would both rule an add-on out, the card gives the plan as the reason. The quantity relation of an add-on now sits on the face of its card in every layout; a dense grid used to fold it behind "More details" with the rest of the prose. `blockingAddOnIds(pricing, selection, addOnId)` is exported from the core.
