---
'pricing-renderer': minor
---

Add the `usePricingSource` hook to the `pricing-renderer/react/headless` entry. It resolves `pricing` and `yaml` during render, also on the server, and loads `src` from an effect that aborts on cleanup and ignores stale results. It returns `status`, `pricing`, `diagnostics` and `reload`, and keeps the last successful pricing when a later load fails. Request and loader come from the instance first, then from `PricingRendererProvider`; a `maxBytes` or `timeoutMs` that is not usable falls back to its default (2097152 bytes, 15000 ms).
