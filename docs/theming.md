# Theming

The component uses light DOM so it can inherit host typography and participate
in an application theme. Structural styles live in the
`pricing-renderer.base` layer and default token values in
`pricing-renderer.theme`.

## Choose a strategy

Complete default theme:

```ts
import 'pricing-renderer/styles.css';
```

Custom theme:

```ts
import 'pricing-renderer/base.css';
import './our-pricing-theme.css';
```

The theme can be loaded globally or from a component-level stylesheet. Do not
import `base.css` and `styles.css` together.

## Public tokens

Override tokens on `pricing-renderer` or an ancestor-specific selector:

```css
pricing-renderer {
  --pr-color-accent: #0066ff;
  --pr-color-on-accent: #fff;
  --pr-color-surface: #fff;
  --pr-color-surface-raised: #fff;
  --pr-color-surface-subtle: #f4f7fb;
  --pr-color-text: #111827;
  --pr-color-muted: #667085;
  --pr-color-border: #e4e7ec;
  --pr-radius-lg: 1rem;
  --pr-shell-padding: clamp(1rem, 4cqi, 3rem);
  --pr-space-section: clamp(3rem, 8cqi, 6rem);
}
```

Token groups:

- Color: `--pr-color-accent`, `--pr-color-on-accent`,
  `--pr-color-text`, `--pr-color-muted`, `--pr-color-link`,
  `--pr-color-focus`, `--pr-color-success`, `--pr-color-warning`,
  `--pr-color-warning-surface`, `--pr-color-overlay`,
  `--pr-color-surface`, `--pr-color-surface-raised`,
  `--pr-color-surface-subtle`, `--pr-color-border`,
  `--pr-color-border-strong`.
- Type sizes: `--pr-font-size-xs`, `--pr-font-size-sm`,
  `--pr-font-size-lg`, `--pr-font-size-xl`, `--pr-font-size-2xl`.
- Space: `--pr-space-1` through `--pr-space-5`,
  `--pr-space-section`, `--pr-shell-padding`.
- Shape: `--pr-radius-sm`, `--pr-radius-md`, `--pr-radius-lg`,
  `--pr-radius-pill`.
- Elevation: `--pr-shadow-sm`, `--pr-shadow-accent`,
  `--pr-shadow-lg`.
- Motion: `--pr-motion-fast`.

The host font is inherited. Set `font-family` on the element when a pricing-only
typeface is required.

## Stable part hooks

Use parts for focused refinements:

```css
pricing-renderer [data-pr-part='plan-card'] {
  border-width: 1.5px;
}

pricing-renderer [data-pr-part='cta'] {
  text-transform: none;
}
```

Stable values:

`hero`, `billing`, `variables`, `plans`, `plan-card`, `price`, `cta`,
`comparison`, `comparison-toolbar`, `comparison-table`, `comparison-row`,
`add-ons`, `add-on-card`, `add-on-quantity`, `summary`, `metadata`, and
`diagnostics`.

Internal `pr-*` class names and markup nesting are not public contracts.

## CSS layers and host resets

Unlayered host styles outrank layered library styles. This is useful for a full
host theme, but very broad rules such as `a { color: ... }` can unintentionally
restyle light-DOM descendants. Scope application resets to the application shell
or exclude renderer parts:

```css
.app-shell a:not([data-pr-part='cta']) {
  color: var(--app-link);
}
```

For predictable ordering, declare layers before imports:

```css
@layer reset, pricing-renderer, product-overrides;
@import 'pricing-renderer/styles.css' layer(pricing-renderer);

@layer product-overrides {
  pricing-renderer {
    --pr-color-accent: var(--brand-accent);
  }
}
```

## Color modes

Set `theme="light"`, `theme="dark"`, or `theme="auto"`. The default theme also
responds to an ancestor `[data-theme="dark"]`. Every custom theme should test:

- WCAG AA contrast for text, controls, borders, and selected states.
- `forced-colors: active`.
- `prefers-reduced-motion: reduce`.
- visible focus indicators.
- RTL and long translated content.
- zoom at 200% and 400%.

Do not communicate plan selection, errors, or add-on availability through color
alone.

## Responsive behavior

The renderer is a CSS container. It adapts to its own inline size:

- compact single-column experience at narrow sizes;
- two/three/four card grids as space becomes available;
- semantic comparison cards at compact sizes and a sticky table when wider;
- horizontal scrolling only inside the comparison table when unavoidable.

Avoid imposing a fixed width or height. If embedding inside a grid, give the
grid item `min-width: 0`.
