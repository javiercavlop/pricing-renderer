# Pricing Renderer

[![CI](https://github.com/javiercavlop/pricing-renderer/actions/workflows/ci.yml/badge.svg)](https://github.com/javiercavlop/pricing-renderer/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-5e51e8.svg)](./LICENSE)
[![Pricing2Yaml 3.1](https://img.shields.io/badge/Pricing2Yaml-3.1-0c9b6b.svg)](./docs/pricing2yaml-compatibility.md)
[![npm publication pending review](https://img.shields.io/badge/npm-pending%20demo%20approval-686a7c.svg)](./docs/demo.md)

Turn a Pricing2Yaml document into an elegant, responsive, interactive pricing
experience. Use the complete light-DOM Web Component, its React 18/19 adapter,
or the DOM-free TypeScript core to build a product-specific UI.

![Pricing Renderer interactive plans](docs/assets/demo-desktop-light.png)

> **Pre-release status:** the repository is public and the `0.1.0` candidate is
> under visual review. The npm package will not be published until the live demo
> is explicitly approved.

## Why it exists

- Complete Pricing2Yaml 3.1 normalization and best-effort compatibility for
  other 3.x revisions.
- Reactive formulas parsed into a restricted AST—never `eval` or `Function`.
- Variables, billing periods, plan comparison, partial totals, quote prices,
  compatible add-ons, dependency/exclusion confirmation, and constrained
  quantities.
- Commercial and catalog modes with container-responsive layouts from 320 px.
- Accessible semantic HTML, keyboard flows, dark mode, forced colors, RTL, zoom,
  and reduced motion.
- CSS variables and stable `data-pr-part` hooks that let the renderer belong to
  the host product.
- Extensible syntax adapters, locale registry, allow-listed expression
  functions, and preserved custom data.
- SSR-safe imports and a client-island React/Next integration.

## Review the live example

Node.js 22+ and pnpm are required for local development:

```bash
git clone https://github.com/javiercavlop/pricing-renderer.git
cd pricing-renderer
corepack enable
pnpm install
pnpm demo
```

The showcase uses the real built package. Change seats, boolean/select
variables, billing, plans, add-ons, quantities, language, theme, and rendering
mode while watching resolved state and events.

Additional runnable integrations:

```bash
pnpm demo:react
pnpm demo:next
```

The Next example keeps the page server-rendered and isolates only the interactive
renderer behind a client boundary.

![Pricing Renderer mobile add-on quantity](docs/assets/demo-mobile-light.png)

See the full [demo validation guide](./docs/demo.md).

## Installation and package location

> **Not published yet:** the commands and version links below become valid only
> after the `0.1.0` demo is approved and the release workflow succeeds. Until
> then, use the workspace demo above.

Once published, install the public package from npm:

```bash
npm install pricing-renderer@0.1.0
# or
pnpm add pricing-renderer@0.1.0
# or
yarn add pricing-renderer@0.1.0
```

The release will be available from:

- npm package: [`pricing-renderer`](https://www.npmjs.com/package/pricing-renderer)
- GitHub releases:
  [`javiercavlop/pricing-renderer/releases`](https://github.com/javiercavlop/pricing-renderer/releases)
- source tag: `v0.1.0` (created only after approval and successful publication)

The tagged release commit will change this section and the npm badge from
pending to published wording. The links will only be considered verified after
a clean registry installation succeeds. See the
[release guide](./docs/releasing.md) for the required order and checks.

## Package entry points

| Import                        | Purpose                                                         |
| ----------------------------- | --------------------------------------------------------------- |
| `pricing-renderer`            | Types, normalization, resolution, expressions, i18n, view-model |
| `pricing-renderer/yaml`       | YAML parsing and bounded remote loading                         |
| `pricing-renderer/element`    | Web Component class without global registration                 |
| `pricing-renderer/define`     | Register `<pricing-renderer>`                                   |
| `pricing-renderer/react`      | Typed React 18/19 adapter                                       |
| `pricing-renderer/base.css`   | Required structural and accessibility styles                    |
| `pricing-renderer/theme.css`  | Default professional visual tokens                              |
| `pricing-renderer/styles.css` | Base and theme combined                                         |

## Web Component

Initialize project-wide defaults before creating renderer instances:

```ts
import { configurePricingRenderer } from 'pricing-renderer';

configurePricingRenderer({
  locale: 'en-US',
  pricingPath: '/pricing',
  selectionEnabled: true,
  ctaEnabled: true,
  variablesEnabled: true,
});
```

Every option is optional. The deterministic built-in defaults are English
(`en-US`), `/pricing`, selectable plans/add-ons, visible CTAs, and editable
variables. `pricingPath` is the canonical host-application route; the library
exposes it but does not mutate or install routes in the host router. An
individual element or React instance can override any value. With
`variablesEnabled: false`, formulas use the iPricing variable defaults.

Import registration and styles once:

```ts
import 'pricing-renderer/define';
import 'pricing-renderer/styles.css';
```

Render a public remote source:

```html
<pricing-renderer
  src="https://cdn.example.com/pricing.yml"
  locale="en-US"
  pricing-path="/pricing"
  mode="commercial"
  theme="auto"
></pricing-renderer>
```

`locale` and `pricingPath` are initial host configuration. Set them globally,
when the renderer is created, or through the equivalent properties/React props.
The library does not inject a language picker into production UI. The showcase
picker only demonstrates that locale configuration can be changed reactively.

Or assign a YAML string or iPricing-compatible object as a JavaScript property:

```ts
const renderer = document.querySelector('pricing-renderer');
renderer.yaml = pricingYaml;
// renderer.pricing = iPricing;
```

Exactly one of `pricing`, `yaml`, or `src` is accepted. Conflicts produce a
structured diagnostic instead of implicit precedence.

## React and Next

```tsx
'use client';

import { PricingRenderer } from 'pricing-renderer/react';
import 'pricing-renderer/styles.css';

export function PricingPage({ pricing }: { pricing: Record<string, unknown> }) {
  return (
    <PricingRenderer
      pricing={pricing}
      locale="en-US"
      pricingPath="/pricing"
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

The React entry is safe to import during SSR and is marked as a client
component. Full pricing content appears after hydration; deep light-DOM SSR is
not a v1 contract.

## Variables and multicontractable add-ons

Primitive variables referenced by formulas become controls automatically.
Presentation metadata can upgrade them to sliders or selects:

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

Add-ons with `subscriptionConstraints` receive a quantity stepper that respects
`minQuantity`, `maxQuantity`, and `quantityStep`. Dependency and exclusion
changes are listed in an accessible confirmation dialog before mutation.
Usage-limit values expressed as `.inf` render as the localized **Unlimited**
label.

## CTAs and host-owned checkout

```ts
renderer.presentation = {
  ctas: [
    {
      id: 'start-growth',
      planId: 'growth',
      label: 'Start free trial',
      href: '/checkout/growth',
      metadata: { source: 'pricing-page' },
    },
  ],
};

renderer.addEventListener('pricing-action', (event) => {
  event.preventDefault();
  openCheckout(event.detail);
});
```

The cancelable event includes the selected plan, billing period, variables,
add-ons, resolved prices, subtotal, quote state, and metadata. Checkout,
authentication, and contracting remain host responsibilities.

Public events:

- `pricing-ready`
- `pricing-selection-change`
- `pricing-action`
- `pricing-diagnostic`

## Private remote sources

Secrets are property-only and never reflected into markup:

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

Use `loadPricing` for OAuth exchanges, signed URLs, proxies, or SDK clients. The
built-in loader permits HTTP/HTTPS `GET` only, defaults to
`credentials: "omit"`, honors cancellation, and never fetches during SSR.

## Theming

```css
pricing-renderer {
  --pr-color-accent: #0057ff;
  --pr-radius-lg: 0.75rem;
  --pr-shell-padding: clamp(1rem, 3vw, 2.5rem);
}

pricing-renderer [data-pr-part='plan-card'] {
  font-family: var(--brand-font);
}
```

Import `styles.css` for the full theme or only `base.css` and supply your own.
CSS variables and `data-pr-part` values are stable; internal `pr-*` classes are
not. Read the [theming guide](./docs/theming.md) before applying broad host
resets to light-DOM content.

![Pricing Renderer dark theme](docs/assets/demo-desktop-dark.png)

## Headless and extension APIs

```ts
import {
  createPricingViewModel,
  normalizePricing,
  registerMessageCatalog,
  resolvePricing,
} from 'pricing-renderer';
import { loadPricingFromUrl, parsePricingYaml } from 'pricing-renderer/yaml';
```

Extend future/vendor syntax with `PricingSyntaxAdapter`, translations with
`registerMessageCatalog`, and domain calculations through explicitly
allow-listed expression functions. See [Extending](./docs/extending.md).

## Documentation

- [Architecture](./docs/architecture.md)
- [API reference](./docs/api-reference.md)
- [Project and instance configuration](./docs/configuration.md)
- [Demo and release acceptance](./docs/demo.md)
- [Release and npm publication](./docs/releasing.md)
- [Extending the library](./docs/extending.md)
- [Theming](./docs/theming.md)
- [Internationalization](./docs/i18n.md)
- [Pricing2Yaml compatibility](./docs/pricing2yaml-compatibility.md)
- [Contributing](./CONTRIBUTING.md)
- [Security policy](./SECURITY.md)
- [Changelog](./CHANGELOG.md)

## Quality gates

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm test:browser
pnpm package:check
```

Browser coverage includes Chromium, Firefox, WebKit, Axe, keyboard paths, and
visual breakpoints. Releases use Changesets, SemVer, npm provenance, and MIT.

## Security

Pricing text is escaped, links use safe schemes, and expressions cannot reach
globals or prototypes. `private` only controls presentation—remove confidential
data before delivering YAML to a browser. Report vulnerabilities through the
process in [SECURITY.md](./SECURITY.md).
