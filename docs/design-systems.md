# Design systems

This guide shows how to fit `pricing-renderer` into a host that already has a
design system: Tailwind CSS, CSS Modules, shadcn/ui or your own tokens. For the
token list and the stable part hooks, see [Theming](./theming.md).

The renderer ships its styles in CSS cascade layers. Host styles that are not in
a layer always outrank them. This is the source of most integration problems: a
global reset in the host can override the renderer. The sections below say how to
avoid that.

## Tailwind CSS v3

Tailwind v3 emits its preflight reset as plain CSS, without a native cascade
layer. The renderer's rules are layered, so the preflight wins. The visible case
is the `<button>` form of the primary plan call to action (used when the plan has
no safe link). The preflight button resets reach it:

- `background-color: transparent` (and `background-image: none`) removes the
  accent background;
- `color: inherit` replaces the text color on the accent, which leaves about 3.5:1
  contrast;
- `padding: 0` removes the button padding;
- `font-weight: inherit` removes the button weight.

Preflight also resets heading sizes and weights (`h1` to `h6` inherit them),
margins and `img` display. The `<a>` form of the call to action is not affected.

Import the renderer styles once, for example in the file that holds your
`@tailwind` directives (`@import` rules must come first):

```css
@import 'pricing-renderer/styles.css';

@tailwind base;
@tailwind components;
@tailwind utilities;
```

Then use one of these fixes:

- Restore the primary button with an unlayered rule. State attributes make it
  short (see [State attributes](#state-attributes)):

  ```css
  pricing-renderer[data-pr-root] button[data-pr-part='cta'][data-kind='primary'] {
    background-color: var(--pr-color-accent);
    color: var(--pr-color-on-accent);
  }
  ```

- Or turn the preflight off in `tailwind.config.js` with
  `corePlugins: { preflight: false }`, if the rest of your application does not
  need it.

Utility classes on your own markup are not affected by either choice.

## Tailwind CSS v4

Tailwind v4 puts its styles in the layers `theme`, `base`, `components` and
`utilities`, and the preflight is in `base`. Declare the order first, with the
renderer between `base` and `components`:

```css
@layer theme, base, pricing-renderer, components, utilities;
@import 'tailwindcss';
@import 'pricing-renderer/styles.css';
```

The layer line must come before any `@import`, so that it fixes the order. With
this order the preflight is below the renderer and utilities stay above it. The
renderer's own sublayers (`pricing-renderer.theme`, `pricing-renderer.shadcn`)
stay inside `pricing-renderer`.

To use your own tokens instead of the default theme, import `base.css` and a
theme file:

```css
@import 'pricing-renderer/base.css';
@import 'pricing-renderer/theme-minimal.css';
```

Do not import `styles.css` together with `base.css`.

## CSS Modules

CSS Modules rename class names, but `pricing-renderer` is an element selector and
its inner markup uses stable `data-pr-part` hooks. Escape the element with
`:global(...)` so the module keeps it:

```css
/* pricing.module.css */
.wrapper :global(pricing-renderer) {
  --pr-color-accent: var(--brand);
  --pr-radius-lg: 1rem;
}

.wrapper :global(pricing-renderer [data-pr-part='cta'][data-kind='primary']) {
  text-transform: none;
}
```

Module rules are not in a layer, so they outrank the renderer styles. Do not
target the internal `pr-*` class names: they are not a public contract.

In React, set tokens without a stylesheet through the `style` prop (custom
properties are allowed) and add a class with `className`:

```tsx
<PricingRenderer
  pricing={pricing}
  className={styles.pricing}
  style={{ '--pr-color-accent': 'var(--brand)', '--pr-radius-lg': '1rem' }}
/>
```

The type of `style` is `PricingRendererStyle`, exported from
`pricing-renderer/react`: `React.CSSProperties` plus any `--*` property.

## Mapping tokens to host variables

The renderer reads `--pr-*` tokens. Map them to the variables of your design
system on `pricing-renderer`, or on an ancestor, with an unlayered rule or one in
a later layer:

```css
pricing-renderer {
  --pr-color-accent: var(--brand-600);
  --pr-color-on-accent: var(--brand-contrast);
  --pr-color-text: var(--text-default);
  --pr-color-muted: var(--text-subtle);
  --pr-color-surface: var(--surface-1);
  --pr-color-border: var(--border-default);
  --pr-radius-lg: var(--radius-large);
}
```

Also map `pricing-change-review` if you use it; it is a separate element and
needs its own tokens (see [Theming](./theming.md)).

### shadcn/ui

`pricing-renderer/tokens-shadcn.css` maps the tokens to the variables of a
shadcn/ui theme (`--primary`, `--primary-foreground`, `--foreground`,
`--muted-foreground`, `--card`, `--popover`, `--muted`, `--border`, `--input`,
`--ring` and `--radius`). It is an overlay: import it after `styles.css`, or after
`base.css` and a theme.

```css
@import 'pricing-renderer/styles.css';
@import 'pricing-renderer/tokens-shadcn.css';
```

The file uses the layer `pricing-renderer.shadcn`, declared after
`pricing-renderer.theme`, so it wins over `theme.css` in either import order.
Tokens that shadcn has no variable for (success, warning, warning surface,
overlay and shadows) keep the values of `theme.css`. Dark mode follows the host
`.dark` class, as in shadcn. If you wrap an import in `layer(x)`, wrap every
renderer file the same way.

The overlay expects the shadcn v4 variables, which hold complete colors such as
`oklch(...)`. If your shadcn setup is v3, its variables are HSL channels, so
`var(--primary)` is not a color. Wrap them in a rule of your own that comes after
the overlay:

```css
pricing-renderer,
pricing-change-review {
  --pr-color-accent: hsl(var(--primary));
  --pr-color-on-accent: hsl(var(--primary-foreground));
  /* repeat for the other mapped tokens */
}
```

### A neutral replacement theme

`pricing-renderer/theme-minimal.css` replaces `theme.css` completely. It has the
same selectors and tokens, a flat grayscale palette, no shadows and no motion. Use
it instead of `theme.css`, or copy it as the start of your own theme.

```css
@import 'pricing-renderer/base.css';
@import 'pricing-renderer/theme-minimal.css';
```

## Fonts

By default the renderer inherits the font of the host. Two optional tokens change
that for the renderer only:

- `--pr-font-family` sets the font of the whole renderer.
- `--pr-font-family-display` sets the font of the hero title, the section and plan
  headings and the price amount. It defaults to `--pr-font-family`.

Four weight tokens set every weight of a group to one value:
`--pr-font-weight-regular`, `--pr-font-weight-medium`, `--pr-font-weight-bold` and
`--pr-font-weight-heavy`. `--pr-line-height` sets the line height.

```css
pricing-renderer {
  --pr-font-family: var(--font-sans);
  --pr-font-family-display: var(--font-heading);
  --pr-font-weight-bold: 600;
  --pr-font-weight-heavy: 700;
  --pr-line-height: 1.6;
}
```

None of these is declared by `theme.css`; the previous values are the fallbacks.

## Dark mode

The renderer can be dark in four ways:

- `theme="dark"` on the element (or the `theme` prop);
- `theme="auto"`, which follows the system color scheme;
- a `[data-theme='dark']` ancestor;
- a `.dark` ancestor.

The `.dark` ancestor uses the same tokens as `[data-theme='dark']`. It follows the
host class, which is the shadcn and Tailwind convention. This is a visual change
for hosts that have an unrelated `.dark` ancestor: the renderer now turns dark
there too. If that is not wanted, restate the light tokens under that ancestor.

With `tokens-shadcn.css`, colors come from the shadcn variables, so they change
with the host theme.

## Density

`density="compact"` on `<pricing-renderer>` reduces the spacing. The default is
`comfortable`, which is unchanged. The element writes no density attribute by
default; the attribute is reflected only when density is set, so you can also
select on it. The compact values are CSS rules under
`pricing-renderer[density='compact']` in `base.css` that override the spacing
tokens. Tokens you set in an unlayered host rule still win.

```html
<pricing-renderer density="compact"></pricing-renderer>
```

```tsx
<PricingRenderer pricing={pricing} density="compact" />
```

## State attributes

Cards and calls to action carry stable attributes, so you can style a state
without the internal class names:

| Attribute        | On                | Values                         |
| ---------------- | ----------------- | ------------------------------ |
| `data-current`   | plan, add-on card | `true` on the current one only |
| `data-selected`  | plan, add-on card | `true` or `false`              |
| `data-featured`  | plan card         | `true` or `false`              |
| `data-available` | add-on card       | `true` or `false`              |
| `data-kind`      | plan CTA          | `primary` or `secondary`       |

```css
pricing-renderer [data-pr-part='plan-card'][data-featured='true'] {
  border-width: 2px;
}

pricing-renderer [data-pr-part='add-on-card'][data-available='false'] {
  opacity: 0.6;
}
```

`data-current` is present only while the host sets `currentSelection`.

## Container breakpoints stay fixed

The layout reacts to the width of the renderer, not to the width of the window.
The renderer is a CSS container, and its breakpoints are container queries at
600px, 840px, 1040px, 1200px and 1280px. They are fixed. Tailwind screen breakpoints (`sm:`,
`md:`, `lg:`) are media queries on the viewport, so they do not apply to the
renderer's layout. A renderer in a narrow sidebar of a wide window gets the
compact layout.

To change the number of plan columns, set `--pr-plan-columns` to a
`grid-template-columns` value. When set, it replaces the columns of the plan grid
in every band:

```css
pricing-renderer {
  --pr-plan-columns: repeat(2, minmax(0, 1fr));
}
```

Other layout tokens: `--pr-sticky-top` offsets the sticky comparison toolbar (and,
from 840px, the add-on summary) under a fixed host header; `--pr-table-max-height`
and `--pr-table-min-width` size the comparison table; `--pr-z-dialog` sets the
z-index of the confirmation dialog backdrop.

```css
pricing-renderer {
  --pr-sticky-top: 64px;
  --pr-z-dialog: 2000;
}
```
