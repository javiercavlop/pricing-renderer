---
'pricing-renderer': minor
---

Add `pricing-renderer/tokens-shadcn.css`, an overlay that maps the renderer tokens to the shadcn/ui variables (`--primary`, `--card`, `--border`, `--radius`, ...) and follows the host `.dark` class. The mapped colors follow the host variables for every `theme` value. A `.dark` ancestor turns on `color-scheme: dark` and the dark status colors only with `theme="auto"`; `theme="dark"` always has the dark status colors and a light `color-scheme`. Hosts that toggle `.dark` should set `theme="auto"` and add `.dark` whenever the app is dark.
