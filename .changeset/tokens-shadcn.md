---
'pricing-renderer': minor
---

Add `pricing-renderer/tokens-shadcn.css`, an overlay that maps the renderer tokens to the shadcn/ui variables (`--primary`, `--card`, `--border`, `--radius`, ...) and follows the host `.dark` class. The mapped colors follow the host variables for every `theme` value; under `.dark`, `color-scheme: dark` and the dark status colors apply only with `theme="auto"`. Hosts that toggle `.dark` should set `theme="auto"` on the element.
