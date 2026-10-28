# Design: fit the renderer into any design system (phase 1a)

## Context

Facts at `9cf7e21`. The intake (`docs/agent-work/phase1a-design-system/intake.md`) was written at
`465e248`; its `file:line` numbers are stale because `base.css` grew with phase 2, and phase 2
already emits `data-current` on plan and add-on cards.

- `src/styles/base.css` is one block `@layer pricing-renderer { … }` holding the rules of both
  `pricing-renderer[data-pr-root]` and `pricing-change-review`. It declares no `--pr-*` token.
  `src/styles/theme.css` is `@layer pricing-renderer.theme` and declares the tokens for both
  elements: a light rule, a dark rule (`[theme='dark']` and `[data-theme='dark']` ancestors) and
  `theme='auto'` under `@media (prefers-color-scheme: dark)`. Rules placed directly in
  `pricing-renderer` outrank every rule of its sublayers.
- `styles.css` imports `base.css` then `theme.css`. The build copies `src/styles` whole, so a new CSS
  file needs only an export. Exports today: `./base.css`, `./theme.css`, `./styles.css`.
- Both roots use `font: inherit; line-height: 1.5;`. Literal weights in `base.css`: 400, 500, 650,
  700, 750, 780, 790, 800 and 900. Section, card, dialog and review headings take the user-agent
  bold (no `font-weight`).
- Sticky rules: `.pr-comparison-toolbar` (`inset-block-start: 0`); `.pr-summary`, stuck to the
  bottom below 840px and to `var(--pr-space-4)` from the top in the 840px band;
  `.pr-flow > .pr-summary` is `position: relative` (not sticky); `.pr-comparison-table thead th`
  and the first column stick inside `.pr-table-scroll`; the review actions stick to the bottom of
  the review below 600px.
- Table: `max-block-size: 80vh; max-block-size: 80dvh;` on `.pr-table-scroll`, `min-width: 720px`
  on `.pr-comparison-table`. Dialog: `z-index: 1000` on `.pr-dialog-backdrop`.
- Plan grid: ten rules set `grid-template-columns` on `.pr-plan-grid`. Two of them (the base rule
  and the 600px rule) are shared with `.pr-addon-grid` and `.pr-variable-grid`. Container
  breakpoints: 600, 840, 1040, 1200 and 1280px.
- Markup (`src/element/renderers.ts`): plan cards have `data-pr-part="plan-card"`, `data-plan-id`,
  `data-selected`, `data-current` (phase 2) and the classes `is-selected` and `is-featured`
  (a badge with `emphasize`). Add-on cards have `data-selected`, `data-current` and the class
  `is-unavailable` (`addOnAvailability`). Plan CTAs are `a` or `button` with `data-pr-part="cta"`,
  `data-relation` and the class `pr-button--primary` or `pr-button--secondary` from `cta.kind`.
- `theme` is a reflected property with default `'light'`, so `theme="light"` cannot be told apart
  from the default and an ancestor `[data-theme='dark']` wins over it.
- React: `className` is already a prop; `style` is not. `@lit/react` `createComponent` passes
  `style` unchanged to `React.createElement` and renames `className` to `class` (intake, high
  confidence).
- Tailwind v3.4.17 preflight (lookup of `tailwindcss/v3.4.17/src/css/preflight.css` and
  `src/lib/expandTailwindAtRules.js`, medium confidence) is emitted without `@layer`. It contains
  `button, input:where([type='button']), … { background-color: transparent; background-image: none; }`,
  `button, input, optgroup, select, textarea { … font-weight: inherit; line-height: inherit; color: inherit; margin: 0; padding: 0; }`
  and `h1, …, h6 { font-size: inherit; font-weight: inherit; }`. An unlayered rule beats every
  layered rule, so the renderer's `<button>` CTA loses its background, colour, padding and weight,
  and its headings lose their size and weight. Preflight also has an unlayered
  `a { color: inherit; text-decoration: inherit; }`, which beats the layered
  `.pr-button--primary` colour: the `<a>` CTA keeps its accent background but takes the inherited
  text colour (about 3.5:1).
- Tailwind v4 starts with `@layer theme, base, components, utilities;` and puts preflight in `base`
  (intake, medium confidence). shadcn for Tailwind v4 declares full colours (`oklch(…)`) and a
  `--radius` length on `:root`, with dark values in `.dark` on `<html>`; shadcn for Tailwind v3
  declares bare HSL channels read as `hsl(var(--x))`.

## Definitions used by the scenarios

- **Acme**: `tests/fixtures/acme-pricing.yml`, plans `starter`, `growth`, `enterprise`, add-ons
  `extraStorage` (growth and enterprise), `compliance` (enterprise) and `prioritySuccess` (growth
  and enterprise, depends on `extraStorage`).
- **Demo page**: `/` of the Playwright web server (Acme, `locale: 'en-US'`, `styles.css`). Its Vite
  server may read the repository root, so a spec can load `src/styles/*.css` directly.
- **New element**: a `<pricing-renderer>` created on the demo page with
  `document.createElement('pricing-renderer')`, given the properties of the scenario and appended to
  `document.body`.
- **Host rule**: a style element injected by the test without `@layer`, after the renderer's
  style sheets.
- **Rendered** (unit tests): `renderPlans` or `renderAddOns` templates rendered as in
  `tests/unit/shorter-page-fixtures.test.ts`.
- Computed custom properties are read with `getComputedStyle(element).getPropertyValue(name)`
  and trimmed; they keep the declared text (`0.75rem`, `#181820`).

## D2: new tokens are optional, with today's value as fallback

`base.css` uses each new token as `var(--pr-x, <value at 9cf7e21>)` at each site, and no theme
file declares it. `styles.css`, and `base.css` with a custom theme, render exactly as today, which
the committed visual baselines prove.

The twelve tokens, each with its fallback and its sites:

- `--pr-font-family`: unset, inherits (D6); both roots.
- `--pr-font-family-display`: `var(--pr-font-family)`; hero title, section `h3`, plan `h4`, price
  amount.
- `--pr-font-weight-regular`: 400; every 400.
- `--pr-font-weight-medium`: 500 or 650; every 500 and 650.
- `--pr-font-weight-bold`: 700, 750, 780 or 790, and 700 on headings; every 700 to 790 and six
  heading rules.
- `--pr-font-weight-heavy`: 800 or 900; every 800 and 900.
- `--pr-line-height`: 1.5; both roots.
- `--pr-sticky-top`: 0px; toolbar and 840px summary (D3).
- `--pr-table-max-height`: 80dvh; `.pr-table-scroll` (D4).
- `--pr-table-min-width`: 720px; `.pr-comparison-table`.
- `--pr-z-dialog`: 1000; `.pr-dialog-backdrop`.
- `--pr-plan-columns`: the rule's current value; ten plan-grid rules (D5).

Weights are grouped per site, keeping that site's value as fallback: a host that sets one token
unifies its group (for example `--pr-font-weight-bold: 600` makes 700, 750, 780 and 790 all 600).
The six heading rules that rely on the user-agent bold today get
`font-weight: var(--pr-font-weight-bold, 700)` (the user-agent bold is 700, so no change); each
selector is checked on its own: `:where(.pr-section__heading, .pr-configurator, .pr-metadata) h3`,
`.pr-plan-card__top h4`, `.pr-addon-card h4`, `.pr-dialog h3`, `pricing-change-review .pr-cr-header h2`
and `pricing-change-review [data-pr-part='change-review'] > section > h3`. Weight tokens cover the
review rules too, because they live in the same file and layer.

Rejected:

- Declaring four weight values in `theme.css`: nine values collapse into four, a visible change of
  the default look (risk R1).
- One token per literal value (nine tokens): a public API that freezes today's accidental values.

## D3: `--pr-sticky-top` only for sticky elements measured against the page

The owner request names "comparison toolbar, plan header/total and add-on-layout summary". At
`9cf7e21` these are two rules:

- `.pr-comparison-toolbar`: `inset-block-start: var(--pr-sticky-top, 0px)`.
- `.pr-summary` (the plan total; in the add-on layout it is the sticky side summary) in the 840px
  band: `inset-block-start: calc(var(--pr-sticky-top, 0px) + var(--pr-space-4))`. The request said
  sticky offsets are 0 today; this one is `var(--pr-space-4)`, which is kept.

Not changed: the table header (`thead th`) and first column stick inside `.pr-table-scroll`, so a
page offset would push them down inside their own box; the summary below 840px and the review
actions stick to the bottom; `.pr-flow > .pr-summary` is not sticky. Rejected: one offset for every
sticky rule (breaks the table header).

## D4: `--pr-table-max-height` behind `@supports`

```css
pricing-renderer[data-pr-root] .pr-table-scroll {
  max-block-size: 80vh;
  /* … */
}

@supports (max-block-size: 1dvh) {
  pricing-renderer[data-pr-root] .pr-table-scroll {
    max-block-size: var(--pr-table-max-height, 80dvh);
  }
}
```

A declaration with `var()` is valid at parse time, so a browser without `dvh` would drop the `80vh`
declaration and then find `80dvh` invalid at computed-value time (no limit at all). The guard keeps
the fallback chain. The `@supports` block sits inside `@layer pricing-renderer`, after the main rule.
Rejected: `var(--pr-table-max-height, 80dvh)` in the main rule (loses `80vh`).

## D5: `--pr-plan-columns` in every plan-grid rule

Each of the ten rules gets `grid-template-columns: var(--pr-plan-columns, <current value>)`. The
two rules shared with `.pr-addon-grid` and `.pr-variable-grid` are split, so those grids keep
their literal values. The token is single-valued: a host that sets it overrides every band, and
can set it inside its own media or container query. `tests/unit/plan-grid-columns.test.ts` gets a
helper that unwraps `var(--pr-plan-columns, X)` to `X` and fails on any other variable name; its
expected values stay. Rejected: one token per band (five public names for one host intent).

## D6: font family tokens

Root: `font: inherit;` then `font-family: var(--pr-font-family);` (the order matters, the shorthand
resets `font-family`). An unset token makes the declaration invalid at computed-value time, and an
invalid inherited property inherits, which equals `font: inherit` today. Display:
`font-family: var(--pr-font-family-display, var(--pr-font-family))` on `.pr-hero__title`, the
section `h3`, `.pr-plan-card__top h4` and `.pr-price__amount`; with both tokens unset it inherits
too. When the `h4` or price rule is shared (with `.pr-addon-card h4`, `.pr-price__quote`), the
implementation may keep the declaration in the shared rule; the scenarios check only the four
named elements.

The docs never show a token set to `inherit`: a custom property set to `inherit` takes the
parent's value of the custom property, not of `font-family`. Rejected: a `--pr-font` shorthand
token (a shorthand also resets size and line height).

## D7: state attributes

`data-featured="true|false"` on every plan card (same condition as `is-featured`),
`data-available="true|false"` on add-on cards only (plans have no availability), and
`data-kind="primary|secondary"` on both CTA forms (default `primary`). The existing classes stay.
`data-current="true"` (phase 2, current plan and current add-on cards) and `data-selected` are kept
and documented as stable hooks (`req~state-current~1`). Attribute values are strings `"true"` and
`"false"`, like `data-selected`, so `[data-featured='false']` can be selected. Rejected: documenting
the classes (`pr-*` and `is-*` classes are not a public contract, `docs/theming.md`).

## D8: `tokens-shadcn.css` is an overlay

```css
@layer pricing-renderer.theme, pricing-renderer.shadcn;

@layer pricing-renderer.shadcn {
  pricing-renderer[data-pr-root],
  pricing-change-review {
    color-scheme: light;
    --pr-color-accent: var(--primary);
    /* … the mapping of req~tokens-shadcn-mapping~1 … */
  }

  .dark pricing-renderer[data-pr-root][theme='auto'],
  .dark pricing-change-review[theme='auto'] {
    color-scheme: dark;
  }
}
```

Mapping on `pricing-renderer[data-pr-root], pricing-change-review` (with `color-scheme: light`;
`color-scheme: dark` under `.dark` with `theme="auto"`):

- `--pr-color-accent`: `var(--primary)`
- `--pr-color-on-accent`: `var(--primary-foreground)`
- `--pr-color-text`: `var(--foreground)`
- `--pr-color-muted`: `var(--muted-foreground)`
- `--pr-color-surface`: `var(--card)`
- `--pr-color-surface-raised`: `var(--popover)`
- `--pr-color-surface-subtle`: `var(--muted)`
- `--pr-color-border`: `var(--border)`
- `--pr-color-border-strong`: `var(--input)`
- `--pr-color-focus`: `var(--ring)`
- `--pr-color-link`: `var(--primary)`
- `--pr-radius-lg`: `var(--radius)`
- `--pr-radius-md`: `calc(var(--radius) - 2px)`
- `--pr-radius-sm`: `calc(var(--radius) - 4px)`

The order statement comes first (comments may precede it), so `shadcn` follows `theme` whatever
the import order. The overlay wins over `theme.css` in every mode, works with `styles.css`, and
keeps `theme.css` values for the tokens shadcn has no variable for (`success`, `warning`,
`warning-surface`, `overlay`, shadows). Their dark values come from `theme.css` under `.dark`, so
the overlay's dark mode depends on `req~host-dark-class~2`. With the overlay and `theme="auto"`, the
colour mode follows the host's `.dark` class (shadcn's convention; `auto` also follows the system
dark scheme when the class is absent). With `theme="light"` or `theme="dark"` a `.dark` ancestor
changes nothing (`req~tokens-shadcn-overlay~2`).

shadcn values are used as full colours (shadcn for Tailwind v4). shadcn for Tailwind v3 (bare HSL
channels) is out of scope: the guide shows a host rule such as
`pricing-renderer { --pr-color-accent: hsl(var(--primary)); }`. A host that wraps imports in
`layer(x)` must wrap all renderer files the same way (guide).

Rejected: a full replacement theme (duplicates every token and drops the dark values of the
unmapped tokens); a mapping inside `theme.css` (changes every host).

## D9: `theme-minimal.css` replaces `theme.css`

Used with `base.css` instead of `styles.css`. Same layer, same rules in the same order, same
selector lists (including `.dark`, so it merges after `req~host-dark-class~2`) and the same
property set, so the parsing pattern of the contrast test in `tests/unit/addon-marker.test.ts`
applies. Values: neutral grays (R = G = B) for text, surfaces, accent, link, focus and overlay;
`currentColor` borders; every shadow `none`; success and warning keep a hue, because they carry
meaning. Contrast: WCAG AA 4.5:1 for the nine pairs of `req~theme-minimal-contrast~1` in light, dark
and auto. Rejected: an overlay like D8 (a minimal theme must also remove shadows and the accent hue
in every mode, which is a full token set anyway).

## D10: density

`density` attribute and property (`'comfortable' | 'compact'`, default `'comfortable'`), React prop
and manifest entry. The element does not write a default `density` attribute; it reflects the
property when it is set. Any value other than exactly `compact` reads as `comfortable`, and the
rendered output has no `data-density` markup. Compact is one rule
`pricing-renderer[density='compact']` (no `[data-pr-root]`) placed directly in
`@layer pricing-renderer` in `base.css`, so it beats `theme.css`, the overlay and replacement themes
(sublayers), while unlayered host tokens still win. `comfortable` adds no rule, so the default is
unchanged, and an unknown value matches no rule (comfortable).

Compact overrides only spacing tokens, so compact is a spacing-only mode. Font-size tokens are not
changed by compact. Decision: deferred, to keep compact a spacing-only mode; a later change may add
type sizes with its own owner decision.

Compact values (accepted by the owner, CRP-C):

Each line gives the comfortable value of `theme.css`, then the proposed compact value:

- `--pr-space-1`: 0.25rem, compact 0.2rem
- `--pr-space-2`: 0.5rem, compact 0.4rem
- `--pr-space-3`: 0.75rem, compact 0.55rem
- `--pr-space-4`: 1rem, compact 0.75rem
- `--pr-space-5`: 1.5rem, compact 1.1rem
- `--pr-space-section`: `clamp(3rem, 8cqi, 6rem)`, compact `clamp(2rem, 5cqi, 4rem)`
- `--pr-shell-padding`: `clamp(1rem, 4cqi, 3rem)`, compact `clamp(0.75rem, 3cqi, 2rem)`

Rejected: the earlier name `plan-density` (`visual-review-spectra/report.md`), because the attribute
tightens the whole renderer; compact rules in `theme.css` (a replacement theme would lose them).

## D11: theme builder demo

A second page of the existing demo: `examples/vanilla/theme-builder.html`, script
`examples/vanilla/src/theme-builder.ts`, and a build input in `examples/vanilla/vite.config.ts`
(the dev server settings stay). A new workspace package would change `pnpm-lock.yaml`, and the
checks install with `--frozen-lockfile`. Page contract used by the scenarios:

- `select#theme-preset` with the options `default`, `shadcn` (loads the overlay and sets sample
  shadcn v4 variables on `<html>`) and `minimal` (swaps `theme.css` for `theme-minimal.css`);
- one control per editable token group; `data-token` names its main token, and the radius and
  surface controls also write their companion tokens (radius sm and lg, surface raised); an edit
  sets the tokens on the preview element at once (an unlayered rule or the element's inline style);
- `#theme-export`, a read-only `textarea` with one unlayered block
  `pricing-renderer[data-pr-root] { … }` that lists the edited tokens as `<name>: <value>;`.

## D12: tests first

Each code slice is a test-designer task (red before) followed by an implementer task in the same
PR; the implementer touches no test file. Browser specs run in CI only (no browser in the lab).

## Tailwind v3 fix

The guide quotes this unlayered host rule, and `tests/browser/host-reset.spec.ts` injects the same
text:

```css
pricing-renderer[data-pr-root] button[data-pr-part='cta'][data-kind='primary'] {
  background-color: var(--pr-color-accent);
  color: var(--pr-color-on-accent);
}
```

The `<a>` CTA carries `data-pr-part='cta'` and `data-kind` (`src/element/renderers.ts`), so a
second unlayered rule restores its text colour:

```css
pricing-renderer[data-pr-root] a[data-pr-part='cta'][data-kind='primary'] {
  color: var(--pr-color-on-accent);
}
```

The guide also lists the other preflight resets that reach the renderer (button padding and weight,
the `a` colour and decoration, heading size and weight) and the host options: scope or disable preflight
(`corePlugins: { preflight: false }`), or add unlayered rules for the parts the host uses. Each
option the guide recommends beyond the rule above is checked by a lookup or a browser run before it
is published (risk R7).

## Tailwind v4 order

```css
@layer theme, base, pricing-renderer, components, utilities;
@import 'tailwindcss';
@import 'pricing-renderer/styles.css';
```

The order statement comes before the Tailwind import, so preflight (`base`) sits below the
renderer and utilities still win.

## Risks

- R1. Weight or font tokens declared by a theme collapse today's weights. Mitigation: D2, the unit
  test that no theme file declares them, the visual baselines.
- R2. `.dark` is a generic class name: a host with an unrelated `.dark` wrapper and `theme="auto"`
  turns the renderer dark. Mitigated by CRP-B option (b): only `theme="auto"` reacts, so no existing
  host with the default or an explicit theme changes; a host with `auto` and an unrelated `.dark`
  uses `theme="light"` (guide).
- R3. The overlay depends on its order statement. The unit test asserts it is the first
  statement, the browser spec imports the overlay in both orders, and the guide says how to wrap
  imports in `layer(x)`.
- R4. shadcn v3 hosts (HSL channels) get invalid colours from `var(--primary)`: the CTA becomes
  transparent. Out of scope; the guide shows the `hsl(var(--x))` mapping.
- R5. The `plan-grid-columns.test.ts` helper could weaken that guard. The expected values stay and
  the helper rejects other variable names; the reviewer checks it.
- R6. No browser in the lab: visual proof comes from CI artifacts.
- R7. The Tailwind facts rest on medium-confidence lookups; `host-reset.spec.ts` proves the failure
  and the fix before the guide is published.
- R8. The element writes no default `density` attribute, so existing host selectors such as
  `pricing-renderer:not([density])` keep their meaning; a host that sets `density` reads back
  `comfortable` for any value other than `compact`. The visual baselines guard the default look.

## Migration

Additive. No expand or contract steps. One changeset per implementation slice, all `minor`. The
`.dark` changeset says it applies only with `theme="auto"`. No release.

## Owner decisions

The owner rule: a public API addition needs an owner CRP, and a visual default change needs a CRP
with screenshots. Visual defaults do not change otherwise.

- **CRP-A, public API (additive)**: the twelve token names and the D2 weight grouping, the D6
  display-font scope, `data-featured`, `data-available` (add-on cards only) and `data-kind`, the
  React `style` type, the exports `./tokens-shadcn.css` and `./theme-minimal.css`, and the D8
  mapping. Recommendation: accept as specified.
- **CRP-B, `.dark` ancestor**: decided by the owner: option (b), `.dark` only with
  `theme="auto"` (`req~host-dark-class~2`, `req~tokens-shadcn-overlay~2`), with the selectors
  `.dark pricing-renderer[data-pr-root][theme='auto']` and `.dark pricing-change-review[theme='auto']`.
  No existing host changes: with `theme="light"` (default) or an explicit `theme="dark"` a `.dark`
  ancestor changes nothing, and `[data-theme='dark']` ancestors behave as before. Rejected, option
  (a): `.dark` forces dark always, like `[data-theme='dark']`, including over `theme="light"`
  because `theme` reflects a default. It was rejected because it changes every existing host that has
  an unrelated `.dark` ancestor, which the owner rule does not allow without a visual change CRP.
- **CRP-C, density**: accepted unchanged by the owner: the attribute and the compact values of D10
  (spacing tokens only).

## Assumptions

- A1. "Plan header/total" in the request means the plan total in `.pr-summary`; the plan header of
  the table sticks inside its scroll box and is excluded (D3).
- A2. "No bare literal font-weight in pricing-renderer rules" covers every rule of the
  `pricing-renderer` layer in `base.css`, review rules included.
- A3. The root font and line-height tokens apply to both roots (`pricing-renderer` and
  `pricing-change-review`), which share the same declarations today.
