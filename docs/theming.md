# Theming

The component uses light DOM so it can inherit host typography and participate
in an application theme. Structural styles (`base.css`) live directly in the
`pricing-renderer` layer, and default token values (`theme.css`) in its sublayer
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

`hero`, `billing`, `variables`, `plans`, `plan-card`, `plan-badge`,
`plan-inheritance`, `plan-highlight`, `selection-control`, `price`, `cta`,
`comparison`, `comparison-toolbar`, `comparison-table`, `comparison-row`,
`comparison-empty`, `add-ons`, `add-on-card`, `add-on-quantity`,
`addon-toolbar`, `addon-empty`, `summary`, `breakdown`, `breakdown-line`,
`breakdown-toggle`, `metadata`, `diagnostics`, `current-badge`,
`current-add-on-badge`, `summary-action`, and `cta-pending`.

`diagnostics` is the closed `details` element that lists diagnostics: the warnings
above the pricing and, in the error state, the codes behind the error sentence.

`comparison-empty` is the "No matching items" line of the comparison,
`addon-toolbar` is the add-on search toolbar, and `addon-empty` is the add-on
empty line.

## Current plan and pending hooks

These hooks appear only when the host sets `currentSelection` or
`pendingActionId` (see [Configuration](./configuration.md)). Without them the
markup is the same as before.

- `current-badge` is the "Your plan" badge of the current plan card, and
  `current-add-on-badge` is the "Current" badge of a current add-on card.
- `[data-current="true"]` is on the current plan card and on each current add-on
  card. It is absent on every other card.
- `[data-relation]` is on every plan CTA while the current plan is known. Its value
  is `current`, `upgrade` or `downgrade`. The current plan's CTA is a `button` with
  the `disabled` attribute.
- `summary-action` is the button of the price summary that reviews the change. It
  has `data-relation` too, and the `disabled` attribute while the selection equals
  the current one.
- `[aria-busy="true"][data-pending="true"]` is on the CTA or the summary action
  whose action id is `pendingActionId`. It holds one `cta-pending` child with the
  "Processing…" text. Every plan CTA and the summary action get
  `aria-disabled="true"` while an action is pending, so style `[aria-disabled]`
  to show that they do nothing.

```css
pricing-renderer [data-pr-part='plan-card'][data-current='true'] {
  border-width: 2px;
}

pricing-renderer [data-pr-part='cta'][data-relation='upgrade'] {
  font-weight: 800;
}
```

The badges, the current-plan and pending states are in the light and dark themes,
under `forced-colors: active` and `prefers-reduced-motion: reduce`. The text of the
badge names the state, so it is not communicated by color alone.

Internal `pr-*` class names and markup nesting are not public contracts.

## Summary end padding and the breakdown toggle

The `summary` part reserves padding at its inline end (`padding-inline-end` of
`var(--pr-space-4) + 24px + var(--pr-space-2)`) so the text does not run under the
`breakdown-toggle`, which is positioned absolutely at the top inline-end corner and
does not change the block size. No CSS variable controls this padding. The
stylesheet's rule is layered, so an unlayered host rule on the stable part hook
overrides it:

```css
pricing-renderer [data-pr-part='summary'] {
  padding-inline-end: 4rem;
}
```

If you move or resize `breakdown-toggle` (for example with its own
`inset-inline-end`), keep the end padding at least as wide as the toggle plus its
offset, or the summary text overlaps it.

## The review element

`<pricing-change-review>` is its own element, not inside `pricing-renderer`, so it
needs the tokens on itself. `theme.css` (part of `styles.css`) defines the same
`--pr-*` tokens, with the same default values, for both `pricing-renderer` and
`pricing-change-review`; `base.css` has structural rules only and sets no token
values. With the custom-theme strategy (`base.css` plus your own stylesheet), the
review has no tokens until you define them: declare the tokens listed below on
`pricing-change-review` (or an ancestor), as well as on `pricing-renderer`.
Without them the review loses its colors, sizes and spacing.

With `styles.css`, override the defaults on the element or on an ancestor with an
unlayered rule:

```css
pricing-change-review {
  --pr-color-accent: #0066ff;
  --pr-color-on-accent: #fff;
  --pr-radius-lg: 1rem;
}
```

It reads these tokens: `--pr-color-text`, `--pr-color-muted`,
`--pr-color-surface`, `--pr-color-surface-raised`, `--pr-color-surface-subtle`,
`--pr-color-border`, `--pr-color-border-strong`, `--pr-color-accent`,
`--pr-color-on-accent`, `--pr-color-link`, `--pr-color-focus`,
`--pr-color-success`, `--pr-color-warning`, `--pr-color-warning-surface`,
`--pr-font-size-xs` to `--pr-font-size-2xl`, `--pr-space-1` to `--pr-space-5`,
`--pr-radius-sm`, `--pr-radius-md`, `--pr-radius-lg`, `--pr-shadow-sm` and
`--pr-motion-fast`. Tokens that only the pricing grid uses
(`--pr-shell-padding`, `--pr-space-section`, `--pr-color-overlay`) have no effect
here.

Color modes follow the renderer: `theme="light"` (default), `theme="dark"`,
`theme="auto"` (the system color scheme), and an ancestor `[data-theme="dark"]`.

Stable `data-pr-part` values:

| Part                | Element                                                             |
| ------------------- | ------------------------------------------------------------------- |
| `change-review`     | The root section of the review                                      |
| `review-title`      | The `h2` that receives focus when a new comparison arrives          |
| `review-plan`       | The plan section                                                    |
| `review-price`      | The price section                                                   |
| `review-add-ons`    | The add-ons section                                                 |
| `review-features`   | The features section                                                |
| `review-limits`     | The usage limits section                                            |
| `review-unchanged`  | The summary of what stays the same                                  |
| `review-notices`    | The section with the host's `notices`                               |
| `review-no-changes` | The note shown when the relation is `current`                       |
| `review-error`      | The alert region with the host's `error`                            |
| `change-row`        | One row: a plan line, an add-on, a feature or a limit               |
| `change-badge`      | A badge in a row; `[data-tone]` is `success`, `warning` or `accent` |
| `change-actions`    | The bar with the status text and the buttons                        |
| `review-status`     | The `role="status"` text, filled while `pending`                    |
| `review-back`       | The Back button                                                     |
| `review-confirm`    | The Confirm button                                                  |

States you can style:

- `[data-pr-part='review-confirm'][aria-disabled='true']` is Confirm while `pending`
  is true or the relation is `current`. It stays focusable, so style it to show
  that it does nothing.
- `[data-pr-part='review-confirm'][aria-busy='true']` is Confirm while `pending`.
- `[data-tone]` on `change-badge`: `success` for an upgrade, an added add-on and a
  gained feature; `warning` for a downgrade, a removed add-on and a lost feature;
  `accent` for a plain change and a changed feature. The relation `current` has no
  tone. Every badge has text, so the state is not communicated by color alone.

```css
pricing-change-review [data-pr-part='change-badge'][data-tone='warning'] {
  font-weight: 800;
}
```

Layout follows the width of the element (a container query at 600px): the price
is in columns when wide, and the actions bar sticks to the bottom of the container
when narrow. Under `forced-colors: active` the root, each section and each button
keep a visible border of system colors, and a disabled Confirm uses `GrayText`.
Under `prefers-reduced-motion: reduce` transitions, animations and smooth scrolling
are turned off. Focus on the buttons and the title shows an outline of
`--pr-color-focus`.

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

The library declares `@layer pricing-renderer` (structure) and
`@layer pricing-renderer.theme` (tokens). For predictable ordering, declare
layers before imports. Importing with `layer(pricing-renderer)` places the whole
stylesheet, with its own layers, inside that layer, below `product-overrides`:

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
