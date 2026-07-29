# Project and instance configuration

`pricing-renderer` has deterministic project defaults and per-instance
overrides. Configure project defaults before creating any renderer element:

```ts
import { configurePricingRenderer } from 'pricing-renderer';

configurePricingRenderer({
  locale: 'en-US',
  pricingPath: '/pricing',
  selectionEnabled: true,
  ctaEnabled: true,
  variablesEnabled: true,
  presentation: {
    planInheritance: 'auto',
  },
});
```

Every key is optional. Calling `configurePricingRenderer` creates a complete
configuration from the built-in defaults rather than inheriting an earlier
partial call.

## Defaults

| Option             | Default      | Effect                                                       |
| ------------------ | ------------ | ------------------------------------------------------------ |
| `locale`           | `"en-US"`    | Selects library-owned messages and `Intl` formatting         |
| `pricingPath`      | `"/pricing"` | Declares the canonical pricing pathname for the host app     |
| `selectionEnabled` | `true`       | Enables plan/add-on controls and full-card pointer selection |
| `ctaEnabled`       | `true`       | Renders configured plan CTAs                                 |
| `variablesEnabled` | `true`       | Renders variable controls and applies interactive values     |
| `presentation`     | `{}`         | Supplies project-wide highlights, badges, controls, and CTAs |

`pricingPath` must be an absolute application pathname such as `/pricing` or
`/account/plans`. It cannot contain a scheme, query, or fragment. The library
does not install or mutate routes; the integrating router owns the page and can
read this value through `getPricingRendererConfig()` or an element's
`pricingPath` property.

## Per-instance overrides

Global configuration is read when an element is constructed. Properties passed
to one element or React component override those defaults:

```ts
const renderer = document.querySelector('pricing-renderer');
renderer.locale = 'es-ES';
renderer.pricingPath = '/precios';
renderer.selectionEnabled = false;
renderer.ctaEnabled = false;
renderer.variablesEnabled = false;
renderer.presentation = {
  planHighlights: {
    enterprise: {
      mode: 'hybrid',
      items: [{ id: 'storage', kind: 'usage-limit' }],
    },
  },
};
```

```tsx
<PricingRenderer
  pricing={pricing}
  locale="es-ES"
  pricingPath="/precios"
  selectionEnabled={false}
  ctaEnabled={false}
  variablesEnabled={false}
  presentation={{
    planBadges: {
      enterprise: [{ id: 'scale', label: 'Built for scale', tone: 'neutral' }],
    },
  }}
/>
```

`locale` and `pricing-path` also have HTML attributes. The three feature flags
are JavaScript/React properties so `false` remains unambiguous.

## Disabled behavior

- With `selectionEnabled: false`, plan and add-on selection controls, quantity
  steppers, and full-card selection are disabled. Existing/default selection
  data can still determine a resolved summary.
- With `ctaEnabled: false`, plan CTAs are not rendered and therefore cannot emit
  `pricing-action`. It does not disable host-owned controls outside the
  renderer.
- With `variablesEnabled: false`, variable controls are not rendered and price
  resolution uses the normalized defaults from the iPricing. Variable overrides
  from controlled or internal interactive selection are ignored until the
  option is enabled again.

These options only govern supplied UI behavior. Headless consumers decide how
to expose their own interactions.

## Presentation precedence

Presentation can be owned by three layers:

1. Per-instance `presentation` on the Web Component or React adapter.
2. Project defaults passed to `configurePricingRenderer`.
3. Portable YAML metadata under `custom.pricingRenderer`.

Plan-keyed `planHighlights` and `planBadges` maps merge by plan, while an entry
from a higher layer replaces the same plan's entry. This makes shared defaults
easy to extend for one pricing page without mutating the iPricing.

## Reading and validating configuration

```ts
import {
  createPricingRendererConfig,
  DEFAULT_PRICING_RENDERER_CONFIG,
  getPricingRendererConfig,
} from 'pricing-renderer';

const validated = createPricingRendererConfig({
  locale: 'es-es',
  pricingPath: '/precios/',
});
// { locale: 'es-ES', pricingPath: '/precios', ...enabledDefaults }

console.info(DEFAULT_PRICING_RENDERER_CONFIG);
console.info(getPricingRendererConfig());
```

Invalid locales and non-absolute pricing paths throw `TypeError` during
initialization rather than creating a silently inconsistent integration.

## SSR and multiple applications

Project configuration is module-global and intended to run once during client
application bootstrap. Do not mutate it per request in a shared SSR process.
For request-, tenant-, or locale-specific rendering, pass per-instance props.
