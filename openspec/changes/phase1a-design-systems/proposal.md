# Proposal: fit the renderer into any design system (phase 1a)

Change `phase1a-design-systems`. Status: draft. Owner decisions (design.md, "Owner decisions"):
CRP-A for the public API additions, CRP-B for the host `.dark` class (decided: option (b), `.dark`
only with `theme="auto"`) and CRP-C for density (accepted unchanged). Base: `develop` at `9cf7e21`
(phase 0 and phase 2 merged).

## Why

Owner request `own-bae08f30d9784ccc837fdb6594a70581`, items 1 to 9, summarized in
`docs/agent-work/phase1a-design-system/intake.md`. The items: a guide `docs/design-systems.md` for
Tailwind v3, Tailwind v4, CSS Modules, mapping `--pr-*` to host variables, fonts, dark mode, density
and container breakpoints (item 1); a shadcn token file (2); new optional tokens (3); a host `.dark`
class on an ancestor (4); a `density` attribute (5); state attributes (6); a minimal theme (7); a
React `style` prop (8); a theme builder demo (9).

INTENT link: the Purpose promise "CSS variables and stable `data-pr-part` hooks, so the renderer
belongs to the host product" (`INTENT.md`, `README.md`), dark mode as a stated promise, and **O3,
"a stable public API and package across the integrations"**. No release: changesets stay pending.

Today a host product that uses Tailwind, CSS Modules or shadcn must:

- find out by trial that Tailwind v3 preflight is unlayered and wins over the renderer's layered
  styles, so the `<button>` form of the primary CTA loses its background;
- map each `--pr-*` token to its own variables by hand, and duplicate the dark values because the
  renderer ignores the `.dark` class that shadcn and Tailwind put on `<html>`;
- override internal `pr-*` classes (not a public contract) to change fonts, weights, the sticky
  offset under its own header, the table size, the dialog stacking or the plan columns;
- read classes such as `is-featured` or `is-unavailable` to style states;
- cast to set custom properties through the React `style` prop.

## What changes

- **design-tokens**: twelve optional tokens (fonts, four weights, line height, sticky top, table
  height and width, dialog z-index, plan columns). `base.css` uses each one with today's value as
  fallback and no theme file declares them, so the default look is unchanged.
- **state-attributes**: `data-featured` on plan cards, `data-available` on add-on cards and
  `data-kind` on plan CTAs, next to the existing `data-current` and `data-selected` hooks.
- **react-style-prop**: `style` (with `--*` custom properties) and `className` on `PricingRenderer`.
- **theme-files**: `.dark` on an ancestor darkens an element with `theme="auto"`; new exports
  `pricing-renderer/tokens-shadcn.css` (an overlay that maps shadcn variables) and
  `pricing-renderer/theme-minimal.css` (a flat, neutral replacement for `theme.css`).
- **density**: `density="comfortable|compact"` attribute, property and React prop; compact tightens
  spacing through tokens (spacing only; type sizes are deferred).
- **docs**: `docs/design-systems.md`, accurate layer docs in `docs/theming.md`, a browser spec that
  proves the Tailwind v3 preflight failure and its fix, and a theme builder demo page.

## Why six capabilities

Each part has its own consumer, file set and owner decision, and each can merge alone:

1. **design-tokens** changes only `src/styles/base.css` and must keep every visual baseline.
2. **state-attributes** changes only the rendered markup (`src/element/renderers.ts`).
3. **react-style-prop** changes only the React adapter types.
4. **theme-files** adds or changes theme style sheets and package exports; the `.dark` part applies
   only with `theme="auto"` (CRP-B, option (b)), so no existing host changes.
5. **density** is a new attribute across element, React, manifest and CSS (CRP-C accepted).
6. **docs** describes the others and holds the proofs that are not tied to one code file (the
   Tailwind v3 host reset spec, the demo page).

## Impact

- Capabilities: the six above, all ADDED. `openspec/specs/` holds no living spec, so nothing is
  MODIFIED. The phase 2 requirements on `data-current` (`req~current-selection-plan-mark~1`,
  `req~current-selection-addons~1`) stay valid; `req~state-current~1` declares the same attribute a
  stable styling hook.
- Code areas: `src/styles/base.css`, `src/styles/theme.css`, new `src/styles/tokens-shadcn.css` and
  `src/styles/theme-minimal.css`, `src/element/renderers.ts`,
  `src/element/pricing-renderer-element.ts`, `src/react/index.ts`, `custom-elements.json`,
  `package.json` (two exports), `examples/vanilla` (a second page), docs and `.changeset`.
- Public API (additive, CRP-A): twelve tokens, three data attributes, the `density` attribute,
  property and React prop, the React `style` prop type, two CSS subpath exports.
- Visual defaults: unchanged for every existing host with `styles.css`. The responsive visual tests
  run against the committed baselines.
- Risks: design.md, "Risks".

## Out of scope

- `src/yaml`, `src/core`, `docs/private-pricings.md` and `docs/nextjs.md` (a parallel change owns
  them).
- Tailwind v3 shadcn variables in bare HSL channels: the guide shows an `hsl(var(--x))` snippet only.
- Configurable container breakpoints: they stay fixed at 600, 840, 1040, 1200 and 1280px.
- Changing a default token value, or the visual baselines.
- A release: changesets only.
