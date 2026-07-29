# Pricing Renderer

`pricing-renderer` turns a Pricing2Yaml 3.x document into a professional,
responsive pricing experience. It ships a DOM-free TypeScript core, a light-DOM
Web Component, and a typed React adapter.

- Fully tested against Pricing2Yaml 3.1.
- Best-effort rendering with diagnostics for other 3.x versions.
- Safe reactive price expressions without `eval` or `Function`.
- Variables, billing periods, configurable add-ons, dependencies, exclusions,
  partial totals, and quote-based prices.
- Container-responsive layout, WCAG 2.2 AA semantics, dark mode, RTL, and
  reduced motion.
- Themeable through CSS custom properties and stable `data-pr-part` hooks.
- English (`en-US`) by default, with an included Spanish (`es-ES`) catalog.

## Install

```bash
npm install pricing-renderer
```

Node.js 22 or newer is required for Node-side parsing and development tooling.
The UI targets modern browsers with Custom Elements, container queries, and
`Intl`.

## Web Component

Import the registration entry and the complete default stylesheet once:

```ts
import 'pricing-renderer/define';
import 'pricing-renderer/styles.css';
```

Render a public remote pricing directly from HTML:

```html
<pricing-renderer
  src="https://cdn.example.com/pricing.yml"
  locale="en-US"
  mode="commercial"
  theme="auto"
></pricing-renderer>
```

Or assign an iPricing-compatible object or YAML string as a JavaScript
property:

```ts
const renderer = document.querySelector('pricing-renderer');
renderer.pricing = iPricing;
// renderer.yaml = pricingYaml;
```

Only one of `pricing`, `yaml`, or `src` may be present. Conflicts produce a
structured diagnostic instead of implicit precedence.

## React

The React adapter supports React 18 and 19 and preserves typed Custom Events:

```tsx
'use client';

import { PricingRenderer } from 'pricing-renderer/react';
import 'pricing-renderer/styles.css';

export function PricingPage({ pricing }: { pricing: Record<string, unknown> }) {
  return (
    <PricingRenderer
      pricing={pricing}
      locale="en-US"
      theme="auto"
      onSelectionChange={(event) => {
        console.info(event.detail.selection, event.detail.resolved);
      }}
      onAction={(event) => {
        event.preventDefault();
        openCheckout(event.detail);
      }}
    />
  );
}
```

The React entry is safe to import during SSR, but the rendered pricing is a
client island. Server output should reserve suitable space or show a skeleton;
deep light-DOM hydration is not part of the v1 contract.

## Private remote sources

Plain `src` uses an anonymous `GET` with `credentials: "omit"`. Authenticated
options must be assigned as JavaScript properties so secrets are never
reflected into HTML:

```ts
renderer.src = 'https://api.example.com/private/pricing.yml';
renderer.request = {
  credentials: 'include',
  headers: async () => ({
    Authorization: `Bearer ${await refreshAccessToken()}`,
  }),
  timeoutMs: 15_000,
  maxBytes: 2 * 1024 * 1024,
};
```

For OAuth exchanges, signed URLs, server proxies, or custom transports, provide
a loader:

```ts
renderer.loadPricing = async ({ url, signal }) => {
  const response = await authenticatedClient.get(url, { signal });
  return response.text(); // A compatible object is also accepted.
};
```

The built-in loader accepts only HTTP/HTTPS and never fetches automatically
during SSR.

## Variables and add-ons

Primitive variables referenced by price expressions become controls
automatically. Arrays and objects remain internal lookup data unless explicitly
configured. Add presentation metadata under the standard `custom` extension:

```yaml
custom:
  pricingRenderer:
    recommendedPlanId: growth
    variableControls:
      - path: seats
        type: slider
        label: Team seats
        min: 1
        max: 250
        step: 1
      - path: region
        type: select
        label: Billing region
        options:
          - value: eu
            label: Europe
          - value: us
            label: United States
```

Component `presentation` props override `custom.pricingRenderer`, which
overrides schema-derived defaults.

Add-ons with `subscriptionConstraints` receive an accessible quantity stepper.
Dependencies and exclusions are presented in a confirmation dialog before the
selection changes.

## CTAs and events

CTAs can be link-based, event-based, or both:

```ts
renderer.presentation = {
  ctas: [
    {
      id: 'start-growth',
      planId: 'growth',
      label: 'Start free trial',
      href: '/checkout/growth',
    },
  ],
};

renderer.addEventListener('pricing-action', (event) => {
  // Prevent link navigation when the host owns checkout.
  event.preventDefault();
  console.info(event.detail.selection, event.detail.resolved);
});
```

All public events bubble and cross the light-DOM boundary:

- `pricing-ready`
- `pricing-selection-change`
- `pricing-action` (cancelable)
- `pricing-diagnostic`

## Styling

Choose one styling level:

```ts
import 'pricing-renderer/styles.css'; // Base + professional theme
import 'pricing-renderer/base.css'; // Structural styles only
import 'pricing-renderer/theme.css'; // Theme tokens only
```

Override tokens at the element boundary:

```css
pricing-renderer {
  --pr-color-accent: #0057ff;
  --pr-radius-lg: 0.75rem;
  --pr-shell-padding: clamp(1rem, 3vw, 2.5rem);
  --pr-space-section: 4rem;
}

pricing-renderer [data-pr-part='plan-card'] {
  font-family: var(--brand-font);
}
```

The `pr-*` classes are internal. CSS variables and `data-pr-part` values are the
stable theming contract. Because the component uses light DOM, host CSS can
affect it; keep broad application selectors appropriately scoped.

## Internationalization

```ts
renderer.locale = 'es-ES';
renderer.messages = {
  'pricing.choosePlan': 'Seleccionar {plan}',
};
```

`en-US` and `es-ES` are exported from the core. Additional languages can merge
their catalog through `messages`. Formatting uses `Intl.NumberFormat`,
`Intl.DateTimeFormat`, and locale-aware labels.

## Headless API

```ts
import { createPricingViewModel, normalizePricing, resolvePricing } from 'pricing-renderer';
import { parsePricingYaml, loadPricingFromUrl } from 'pricing-renderer/yaml';
```

Author errors are returned as `PricingResult<T>` diagnostics with `code`,
`severity`, `message`, and optional YAML `path`. Non-3.x major versions are
blocked; unknown fields in compatible 3.x documents remain available through
the preserved raw object.

## Security notes

- Pricing text is escaped; arbitrary HTML is not rendered.
- Price expressions are parsed into a restricted AST.
- URL-bearing fields accept only safe HTTP, HTTPS, mail, anchor, or relative
  links.
- `private` is a display flag, not a confidentiality boundary. Remove
  confidential plans and add-ons before sending YAML to a browser.
- A public npm package exposes its distributed JavaScript even while the source
  repository is private.

## Development

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm build
pnpm demo
pnpm test:browser
pnpm package:check
```

The Vanilla and React examples are under `examples/`. Releases use Changesets,
SemVer, npm provenance, and the MIT license.
