---
'pricing-renderer': minor
---

Add `PricingRendererProvider` and the `pricing-renderer/react/headless` entry. The provider shares configuration, messages, presentation, request options and a pricing loader with the `PricingRenderer` components below it, without touching the global configuration. Request headers and credentials only go to the page origin or to the origins listed in `requestOrigins`.
