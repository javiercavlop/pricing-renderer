# Intake: phase 1a, fit into any project's design system (CSS and docs)

- Owner request: own-bae08f30d9784ccc837fdb6594a70581 (items 1-9 below). Planner intake, 2026-10-27.
- Base: `465e248` (task branch `task/52ed3e72c76e40fd`). All `file:line` citations are at this base.
- INTENT link: the Purpose promise "CSS variables and stable `data-pr-part` hooks, so the renderer
  belongs to the host product" (`INTENT.md:19`, `README.md:31`) and **O3, "a stable public API and
  package across the integrations"** (`INTENT.md:62`). Dark mode is a stated promise too
  (`README.md:29`). No release: changesets stay pending (`INTENT.md:68-71`, Q6).
- Owner rule from the request: visual default changes need a CRP with screenshots, and public API
  needs an owner CRP. No Playwright in the lab, so browser gates and screenshots come from CI.

## Objective

Let a host product theme the renderer with its own design system: a guide for Tailwind v3/v4, CSS
Modules and shadcn; a shadcn token file; tokens for fonts, weights, line height, sticky offset, table
size, dialog z-index and plan columns; `.dark` on an ancestor; a density attribute; stable state
attributes; a minimal theme; a React `style` prop; and a theme builder demo.

## Verified facts (file:line at `465e248`)

Layers and files

- `base.css` is one block `@layer pricing-renderer { ... }` (`src/styles/base.css:1`, ends `:1517`).
  `theme.css` is `@layer pricing-renderer.theme` (`src/styles/theme.css:1`). Rules placed directly in
  `pricing-renderer` outrank its sublayer `pricing-renderer.theme`. `base.css` declares no `--pr-*`
  token.
- `styles.css` imports base then theme (`src/styles/styles.css:1-2`). The build copies the whole
  `src/styles` directory (`scripts/copy-styles.mjs:6-10`), so a new CSS file only needs an export.
  Exports: `./base.css`, `./theme.css`, `./styles.css` (`package.json:53-55`). `sideEffects` already
  lists `**/*.css` (`package.json:69`).
- **Docs drift:** `docs/theming.md:4-6` names the layer `pricing-renderer.base`. The real layer is
  `pricing-renderer` (`base.css:1`). The example at `docs/theming.md:113-114` imports `styles.css`
  into `layer(pricing-renderer)`, which nests the file's own layers as
  `pricing-renderer.pricing-renderer(.theme)`. That works, but it misleads. S6 fixes both.
- The guide's claim "unlayered host styles outrank layered library styles" already appears in
  `docs/theming.md:99`.

Tailwind and shadcn (external facts from lookup; confidence noted)

- Tailwind v3.4.0 preflight is unlayered (it has no `@layer`; medium confidence). It contains
  `button, [type='button'], [type='reset'], [type='submit'] { background-color: transparent;
  background-image: none; }` (source: raw `tailwindcss/v3.4.0/src/css/preflight.css`). The renderer's
  primary CTA sets `background: var(--pr-color-accent)` inside the layer (`base.css:535-539`), and the
  `<button>` form of the CTA is used when there is no safe `href` (`src/element/renderers.ts:445-457`).
  So in a Tailwind v3 host, the unlayered preflight wins: the button CTA becomes transparent, and its
  `--pr-color-on-accent` text sits on the card. The `<a>` CTA (`renderers.ts:426-444`) is not hit.
  This matches the owner's "may wipe the primary CTA background". It must be proven in a browser
  (S6 check).
- Tailwind v4 `index.css` starts with `@layer theme, base, components, utilities;`, and preflight is
  in `base` (medium confidence; source: `tailwindcss/main/packages/tailwindcss/index.css`,
  `preflight.css`). So the order the owner asks for, `@layer theme, base, pricing-renderer, components,
  utilities;` declared before `@import "tailwindcss"`, puts preflight below the renderer.
- shadcn (Tailwind v4) variables: `--background`, `--foreground`, `--card`, `--card-foreground`,
  `--popover(-foreground)`, `--primary(-foreground)`, `--secondary(-foreground)`,
  `--muted(-foreground)`, `--accent(-foreground)`, `--destructive`, `--border`, `--input`, `--ring`,
  and `--radius`. Their values are full colors (`oklch(...)`), dark values sit in `.dark` on an
  ancestor (html), and `--radius` is a length. The older Tailwind v3 shadcn uses bare HSL channels
  consumed as `hsl(var(--primary))` (high confidence; sources: ui.shadcn.com/docs/theming,
  ui.shadcn.com/docs/tailwind-v4). A direct `var(--primary)` mapping is therefore valid only for
  the v4 format (Q4).

Tokens asked for in item 3 (current values)

- Font: the root uses `font: inherit` (`base.css:7`), and form controls use `font: inherit`
  (`base.css:19-22`). No font token exists (`theme.css:2-41`). `docs/theming.md:65-66` says the host
  font is inherited.
- Line height: `line-height: 1.5` on the root (`base.css:8`).
- Weights: nine literal values. 400 (`:838`), 500 (`:846`), 650 (`:582,1127,1157`), 700
  (`:165,218,879,1076`), 750 (`:117,259,353,484,522,567,697,950,1107,1162,1201`), 780 (`:125`), 790
  (`:455`), 800 (`:504,863`), 900 (`:390`). Section and card headings take the UA bold (no weight at
  `:200-204`). Four tokens cannot hold nine values without a visible change (D2).
- Sticky: the comparison toolbar uses `inset-block-start: 0` (`base.css:652-655`). **Correction to the
  request ("sticky offsets are 0 today"):** from 840px the add-on-layout summary sticks at
  `inset-block-start: var(--pr-space-4)` (`base.css:1366-1369`). The mobile summary sticks to the
  bottom (`base.css:1011-1014`). The table header sticks inside its own scroll box
  (`base.css:787-791,823-826`), so it must not get the page offset (D3).
- Table: `max-block-size: 80vh; max-block-size: 80dvh;` (`base.css:789-790`), `min-width: 720px`
  (`base.css:800`). Dialog: `z-index: 1000` (`base.css:1210-1213`).
- Plan grid rules: `base.css:262-268` (shared with `.pr-addon-grid` and `.pr-variable-grid`),
  `:1269-1273` (shared too), `:1277-1280`, `:1304-1306`, `:1308-1312`, `:1314-1316`, `:1401-1403`,
  `:1405-1410`, `:1430-1432`, and `:1434-1439`. The two shared rules must be split so that the token
  does not reach the add-on and variable grids.
- `tests/unit/plan-grid-columns.test.ts` evaluates the winning `grid-template-columns` string per
  width and plan count (`:270-295`) and rejects rules it does not understand (`:233-268`). A
  `var(--pr-plan-columns, X)` value needs a helper there that unwraps to `X` (S1, D5).
- "OpenBinding overrides the internal `.pr-plan-grid` today": no file in the repository mentions
  OpenBinding (grep). `pr-*` classes are not a public contract (`docs/theming.md:95`). This is owner
  context, not verified.
- The container breakpoints are fixed at 600/840/1040/1200/1280px (`base.css:1268,1298,1400,1413,1429`).

Dark mode (item 4)

- Dark applies to `pricing-renderer[data-pr-root][theme='dark']` and
  `[data-theme='dark'] pricing-renderer[data-pr-root]` (`theme.css:43-44`), and to `[theme='auto']`
  under `prefers-color-scheme: dark` (`theme.css:64-65`). There is no `.dark` selector.
- `theme` is reflected with the default `'light'` (`src/element/pricing-renderer-element.ts:121,194`).
  So an explicit `theme="light"` cannot be told apart from the default, and an ancestor
  `[data-theme='dark']` wins over it today. `.dark` would behave the same way (Q2).
- `tests/unit/addon-marker.test.ts:479-502` slices `theme.css` at the first `[theme='dark']` and at
  `@media (prefers-color-scheme: dark)`. The new selector must be appended to the existing dark
  selector list, after `[theme='dark']`.

State attributes (item 6)

- Plan card: `data-pr-part="plan-card"`, `data-plan-id`, `data-selected`, and classes `is-selected` and
  `is-featured`. Featured means "a badge with `emphasize`" (`renderers.ts:318-331`).
- Add-on card: `data-selected`, plus the class `is-unavailable` from `addOnAvailability`
  (`renderers.ts:1031-1040`). Plans have no availability concept.
- CTA: `data-pr-part="cta"`. Its kind is `cta.kind` (`'primary' | 'secondary'`, `src/core/types.ts:240`),
  and the default is primary (`renderers.ts:427-431,446-450`).
- "data-current (current plan, see phase 2)": `src/` has no current-plan concept (grep
  `currentPlan|isCurrent`: only a local in `view-model.ts:469`). `applySelection` preloads a selection
  (`docs/preload-current-subscription.md:3-6`), but that is not a "current" flag. It is reserved here,
  and phase 2 implements it (D7).

React (item 8)

- `className` is already in the props (`src/react/index.ts:84`). `style` is not
  (`src/react/index.ts:61-91`).
- `@lit/react` `createComponent` treats `style` and `className` as reserved React props. It passes
  `style` unchanged to `React.createElement` and renames `className` to `class` (high confidence;
  source: `lit/lit` `packages/react/src/create-component.ts` at `@lit/react@1.0.7`). So `style`
  probably already works at runtime, and item 8 is mostly the prop type and a test.
  `PricingRenderer` spreads all props (`src/react/index.ts:95-101`).

Tests, CI and docs

- Unit tests run in Node (`vitest.config.ts:5-6`). They inspect CSS text (`spectra-followups-css.test.ts:4-21`),
  type-check snippets (`custom-elements.test.ts:30-55`, `spectra-followups-react.test.ts:14-42`), and
  read the hand-kept manifest (`custom-elements.json:90-92`; no generator in `package.json:119-137`).
- Visual baselines: `tests/browser/pricing-renderer.spec.ts:1319-1351` (9 viewports, Chromium). They
  guard "no default change" for S1, S2 and S3. The demo is the Playwright web server
  (`playwright.config.ts:45-50`). Its Vite dev server may read the repository root
  (`examples/vanilla/vite.config.ts:10-12`), so specs can load `src/styles/*.css`.
- CI `quality` runs format:check, lint, test, typecheck, package:check and the demo builds
  (`.github/workflows/ci.yml:44-52`). Browsers run when `src/`, `examples/` or root files change
  (`ci.yml:121-140`).
- `docs/api-reference.md:342-343` (attribute table, `theme` row), `:642-677` (React), `:679-687` (CSS
  entry points). `README.md:153-155` (CSS table), `:400-406` (hooks). The docs-examples test checks
  event names and codes in docs (`tests/unit/docs-examples.test.ts:1-20`).
- There is no `openspec/` and no `acceptance/`. Specs live in `docs/agent-work/<id>/spec.md`
  (`docs/agent-work/spectra-item9-tags/intake.md:86-87`).

## Decisions taken in this intake

- D1. One change per capability (S1-S5, S7-S9). Each gets its own PR into develop, carries its own
  changeset, and needs no flag (every capability is additive or opt-in on its own). Docs are
  collected in S6 and S10, so parallel slices never share a docs file.
- D2. New tokens are **optional with fallbacks**. `base.css` uses `var(--pr-x, <today's value>)` at
  each site, and `theme.css` does not declare the token. So `styles.css`, and `base.css` plus a custom
  theme, render exactly as today. Weight tokens are grouped per site with that site's current value
  as the fallback: regular (400), medium (500, 650), bold (700, 750, 780, 790, and the headings that
  rely on UA bold today, set as `var(--pr-font-weight-bold, 700)`), heavy (800, 900). A host that sets
  one token unifies its group. The grouping goes to CRP-A. Rejected: declaring four values in
  `theme.css`, which would change the look (nine values collapsed into four).
- D3. `--pr-sticky-top` applies to sticky elements measured against the page: the toolbar
  (`inset-block-start: var(--pr-sticky-top, 0px)`) and the 840px summary
  (`calc(var(--pr-sticky-top, 0px) + var(--pr-space-4))`). It does not apply to the table header
  inside its scroll box.
- D4. `--pr-table-max-height`: keep `max-block-size: 80vh`, and put the token declaration with its
  `80dvh` fallback inside `@supports (max-block-size: 1dvh)`. A `var()` declaration is valid when
  parsed, so without the guard a browser without `dvh` would lose the `80vh` fallback.
- D5. `--pr-plan-columns` wraps every plan-grid `grid-template-columns` value in the request's form,
  and the two shared rules are split. The token is single-valued: a host that sets it overrides
  every band, and can set it inside its own media or container query. The breakpoints stay fixed
  (documented in S6).
- D6. `--pr-font-family` / `--pr-font-family-display`: `font-family: var(--pr-font-family)` on the
  root, and `var(--pr-font-family-display, var(--pr-font-family))` on the hero title, the section
  `h3`, the plan `h4` and the price amount. An unset token is invalid at computed-value time, so the
  inherited property inherits: the same result as `font: inherit` today. Never set a token to the
  keyword `inherit` (a custom property would take it as its own inheritance).
- D7. `data-current` is not emitted in phase 1a. The name is reserved in the docs as a phase 2 hook.
  `data-featured="true|false"` and `data-kind="primary|secondary"` (every CTA) are added.
  `data-available="true|false"` goes on add-on cards only (plans have no availability). The existing
  classes stay.
- D8. `tokens-shadcn.css` is an **overlay**. Its first line is the order statement
  `@layer pricing-renderer.theme, pricing-renderer.shadcn;`, and its rules sit in
  `pricing-renderer.shadcn`. That statement fixes the order whatever the import order, so the overlay
  wins over `theme.css` in every mode, works with `styles.css`, and keeps the defaults for tokens
  that shadcn has no variable for (success, warning, overlay). Proposed mapping for CRP-A:
  accent → `--primary`, on-accent → `--primary-foreground`, text → `--foreground`, muted →
  `--muted-foreground`, surface → `--card`, surface-raised → `--popover`, surface-subtle → `--muted`,
  border → `--border`, border-strong → `--input`, focus → `--ring`, link → `--primary`, and radius
  lg/md/sm → `var(--radius)` / `calc(var(--radius) - 2px)` / `calc(var(--radius) - 4px)`.
  `color-scheme` follows `.dark`. Rejected: a full replacement theme, which would duplicate every
  token and drop the dark values of the unmapped tokens.
- D9. `theme-minimal.css` is a full replacement for `theme.css` (used with `base.css`). It keeps the
  same selectors and sections, including `.dark` once S5 is merged, so the contrast test pattern of
  `addon-marker.test.ts:479-502` can be reused.
- D10. Density: the `density` attribute and property (`comfortable` default, reflected like
  `theme`), plus the React prop. `[density='compact']` token overrides sit directly in the
  `pricing-renderer` layer of `base.css`, so they beat `theme.css` and the replacement themes, while
  unlayered host tokens still win. Compact values go to CRP-C.
- D11. The theme builder is a second page of the existing demo (`examples/vanilla/theme-builder.html`,
  with a build input in `examples/vanilla/vite.config.ts`). A new workspace package would change
  `pnpm-lock.yaml`, and the checks use `--frozen-lockfile`.
- D12. Tests first, as in `spectra-item9-tags`: each code slice is a test-designer task (red-before,
  G3), then an implementer task in the same PR. The implementer touches no test file.

## Slices

Defaults for every slice: role default model and effort, at most 300 lines without tests. The lab
check set for implementer tasks is `["pnpm", "install", "--frozen-lockfile"]`, `["pnpm",
"typecheck"]`, `["pnpm", "lint"]`, `["pnpm", "test"]` and `["pnpm", "format:check"]` (the "full set"
below). A test-designer task ("T") runs `["pnpm", "install", "--frozen-lockfile"]`, the red-before
check, `["pnpm", "exec", "eslint", <files>]` and `["pnpm", "exec", "prettier", "--check", <files>]`.
Every red-before uses `"expect_exit": [1]` and `"expect_pattern": "AssertionError|expected"`, with the
new unit files as overlay. A test of a file that does not exist yet must first assert
`existsSync(...)` to be true. A bare `readFileSync` fails with ENOENT, which G3 rejects.
Browser specs are written by T and run in CI only (`browsers` shards).

### S0: spec (specifier, turn budget 30)

- Owns `docs/agent-work/phase1a-design-system/spec.md` (new). Content: EARS requirements, one per
  capability, with these proposed ids: `req~optional-design-tokens~1`, `req~sticky-top-token~1`,
  `req~plan-columns-token~1`, `req~state-attributes~1`, `req~react-style-prop~1`,
  `req~tokens-shadcn~1`, `req~host-dark-class~1`, `req~theme-minimal~1`, `req~density-attribute~1`,
  plus D2-D10 as scenarios. Density values stay "per CRP-C".
- Checks: install, `["pnpm", "exec", "prettier", "--check", "docs/agent-work/phase1a-design-system/spec.md"]`.
  Risk **low** (score 0, docs). Depends on nothing.

### S1: optional design tokens (item 3): T1 then I1

- T1 owns `tests/unit/design-tokens.test.ts` (new), `tests/unit/plan-grid-columns.test.ts` (only a
  `var(--pr-plan-columns, X)` unwrap that also asserts the variable name; the expected values stay as
  they are) and `tests/browser/design-tokens.spec.ts` (new: a host `--pr-sticky-top` moves the
  toolbar, and `--pr-plan-columns` sets the columns). The unit test checks every D2-D6 site and
  fallback, the `@supports` guard, the split shared rules, and that `theme.css` declares none of the
  new tokens. Red-before argv: `["pnpm", "exec", "vitest", "run", "tests/unit/design-tokens.test.ts",
  "tests/unit/plan-grid-columns.test.ts"]`.
- I1 owns `src/styles/base.css` and `.changeset/design-tokens.md` (minor, "no visual change").
- Risk **medium** (score 3: public API +3, because the tokens are a public contract per
  `docs/theming.md:26-63`). CI proof: the visual baselines are unchanged and no snapshot file is
  touched. Depends on S0.

### S2: state attributes (item 6): T2 then I2

- T2 owns `tests/unit/state-attributes.test.ts` (new). It renders `renderPlans`/`renderAddOns`
  templates as in `tests/unit/shorter-page-fixtures.test.ts`: `data-featured` on every plan card,
  `data-available` on add-on cards, `data-kind` on both CTA forms (default primary), and no
  `data-current`.
- I2 owns `src/element/renderers.ts` and `.changeset/state-attributes.md` (minor).
- Risk **medium** (score 3: public API +3). Depends on S0.

### S3: React `style` prop (item 8): T3 then I3

- T3 owns `tests/unit/react-style-prop.test.ts` (new). It type-checks `style={{ '--pr-color-accent':
  '#f00', color: 'red' }}` and `className` as valid and a non-object `style` as rejected, and
  asserts with the `@lit/react` mock of `spectra-followups-react.test.ts:5-12` that `style` reaches
  `createComponent` unchanged.
- I3 owns `src/react/index.ts` (a `style` prop typed as `React.CSSProperties` plus custom property
  keys of the form `--${string}` with string or number values) and `.changeset/react-style-prop.md`
  (minor).
- Risk **medium** (score 3: public API +3). Depends on S0.

### S4: `tokens-shadcn.css` (item 2): T4 then I4

- T4 owns `tests/unit/tokens-shadcn.test.ts` (new: the first statement is the D8 order, the
  mapping, the `package.json` export, and `color-scheme` under `.dark`) and
  `tests/browser/tokens-shadcn.spec.ts` (new). The browser spec sets host `:root`/`.dark` shadcn
  variables and checks that the CTA background and card surface follow them when `.dark` is
  toggled, with the overlay imported before and after `styles.css`.
- I4 owns `src/styles/tokens-shadcn.css` (new), `package.json` (export `./tokens-shadcn.css` only) and
  `.changeset/tokens-shadcn.md` (minor).
- Extra lab check if the coordinator registers it: `["pnpm", "package:check"]` (CI runs it at
  `ci.yml:49`). Risk **medium** (score 3: new public export +3). Depends on S0.

### S5: host `.dark` class (item 4, CRP-B): T5 then I5

- T5 owns `tests/unit/host-dark-class.test.ts` (new: `.dark pricing-renderer[data-pr-root]` is in the
  dark selector list after `[theme='dark']`) and `tests/browser/host-dark-class.spec.ts` (new:
  computed dark tokens under `html.dark`, plus screenshot attachments at 1440 and 375 for CRP-B).
- I5 owns `src/styles/theme.css` and `.changeset/host-dark-class.md` (minor, "visual change for
  hosts with `.dark`").
- Risk **medium**. The score is 0, raised because the default look changes for existing hosts with
  a `.dark` ancestor. Merge only after CRP-B. Depends on S0.

### S6: design-systems guide (item 1, doc-steward, turn budget 45)

- Owns `docs/design-systems.md` (new), `docs/theming.md` (fix the drift at `:4-6` and `:110-121`, add
  the new tokens, hooks and a link), `docs/api-reference.md` (CSS entry rows `:679-687`, the React
  `style` prop), `README.md` (CSS table `:153-155`), and `tests/browser/host-reset.spec.ts` (new). The
  spec injects an unlayered `button { background-color: transparent; background-image: none; }`
  (the preflight shape) and proves both the failure and the recommended fix on the button CTA. The
  fix is an unlayered `pricing-renderer [data-pr-part='cta'][data-kind='primary']` rule (after S2),
  or `preflight: false` (to verify).
- Content: Tailwind v3 (verify by lookup: preflight's heading reset `h1-h6 { font-size: inherit;
  font-weight: inherit }`, and whether `@import 'tailwindcss/base' layer(...)` is honoured), Tailwind
  v4 order, CSS Modules (`:global(pricing-renderer)` plus `[data-pr-part]`/state attributes), mapping
  `--pr-*` to host variables, fonts (D6), dark mode (whatever is merged at its base), and fixed
  container breakpoints.
- Checks: install, `["pnpm", "test"]`, `["pnpm", "format:check"]`. Risk **low** (score 0: docs and a
  test; G13 not applicable, uses how_to_review). Depends on I1, I2 and I4 merged (I3 optional).

### S7: `theme-minimal.css` (item 7): T7 then I7

- T7 owns `tests/unit/theme-minimal.test.ts` (new: the same token set as `theme.css`, no shadow
  values, `currentColor` borders, AA text contrast per section) and `tests/browser/theme-minimal.spec.ts`
  (new: `base.css` plus minimal, computed `box-shadow: none`, and axe on the demo).
- I7 owns `src/styles/theme-minimal.css` (new), `package.json` (export only), and
  `.changeset/theme-minimal.md` (minor).
- Risk **medium** (score 3: new export +3). Depends on I4 (`package.json`) and I5 (dark selectors) merged.

### S8: density (item 5, CRP-C, Q-G): T8 then I8

- T8 owns `tests/unit/density.test.ts` (new: the attribute and property default and reflection, the
  manifest entry, the React prop type, and the compact rules in the root layer) and
  `tests/browser/density.spec.ts` (new: compact padding and font size smaller, plus screenshot
  attachments for CRP-C).
- I8 owns `src/element/pricing-renderer-element.ts`, `src/react/index.ts`, `src/styles/base.css`,
  `custom-elements.json`, and `.changeset/density.md` (minor).
- Risk **medium** (score 4: public API +3, more than one module +1). Starts after CRP-C, with I1 and
  I3 merged.

### S9: theme builder demo (item 9, implementer, lowest priority)

- Owns `examples/vanilla/theme-builder.html`, `examples/vanilla/src/theme-builder.ts` (new) and
  `examples/vanilla/vite.config.ts` (the build input only; the dev server settings stay as they are).
  It edits tokens live, can start from the shadcn or minimal preset, and exports the CSS block.
- Checks: the full set plus `["pnpm", "--filter", "pricing-renderer-demo", "build"]`. Risk **low**
  (score 1: diff over 200 lines). CI browsers must stay green, because the page shares the web
  server. Depends on I1, I4 and I7.

### S10: docs closeout (doc-steward)

- Owns `docs/theming.md`, `docs/design-systems.md`, `docs/api-reference.md` (the `density` row near
  `:343`), `README.md` and `docs/demo.md`. It documents what merged after S6 (S5, S7, S8, S9) and
  lists the stable hooks, including `data-current` reserved for phase 2.
- Checks: install, test, format:check. Risk **low**. Last.

Order: S0. Then T1-T5 in parallel, and each I after its T (owned files are disjoint: base.css /
renderers.ts / react/index.ts / tokens-shadcn.css and package.json / theme.css). I1-I4 merge after
CRP-A; I5 merges after CRP-B. Then S6 and S7 in parallel (disjoint). Then S8 and S9. Then S10.
`package.json` is serialized I4 → I7; `src/react/index.ts` I3 → I8; `src/styles/base.css` I1 → I8.

## Gates per slice

G1: the spec at `docs/agent-work/phase1a-design-system/spec.md`, validated by the coordinator's
convention (no `openspec/`). G2: the EPIC review of S0. G3: every T task. G4: T files frozen
before I. G6: `[impl->req~...]`/`[utest->req~...]` tags in I/T files. G8: coordinator decides
(CSS-heavy). G9: N/A (no dependency). G10: if registered. G11: one reviewer for low, the panel by
risk for medium. G12: ui-qa for S4, S5, S7 and S8 (CI captures). G13: how-to-test for S1-S5 and S7-S9;
how_to_review for S0, S6 and S10.

## Risks

- R1. Weight or font tokens declared in a theme collapse today's nine weights (look change).
  Mitigation: D2, the T1 test that `theme.css` declares none of them, and the visual baselines.
- R2. `.dark` is a generic class name. A host with an unrelated `.dark` wrapper flips the renderer.
  This goes to CRP-B with screenshots.
- R3. Overlay order depends on the order statement (D8). T4 asserts that it is the first statement,
  and the browser spec imports the overlay in both orders. A host that wraps the imports in
  `layer(x)` must wrap all of them the same way (S6 documents it).
- R4. shadcn v3 hosts (HSL channels) get invalid colors from `var(--primary)`, so the CTA would be
  transparent. Q4.
- R5. The `plan-grid-columns.test.ts` change could weaken the guard. T1 keeps the expected values
  and asserts the variable name. The reviewer checks it.
- R6. No browsers in the lab. Every visual proof and every CRP screenshot comes from CI artifacts.
- R7. The guide's Tailwind claims rest on medium-confidence lookups. S6 proves them with
  `host-reset.spec.ts` before publishing.

## Open questions

Needs a CRP (owner):

- CRP-A (public API, additive, one answer). (1) The token names of item 3 and the D2 weight
  grouping. (2) The D6 display-font scope. (3) `data-featured`, `data-kind` and `data-available` (add-on
  cards only), with `data-current` reserved for phase 2. (4) The React `style` type. (5) The exports
  `./tokens-shadcn.css` and `./theme-minimal.css`, and the D8 mapping. (6) `density` versus the
  earlier `plan-density` (`visual-review-spectra/report.md:348`). Recommendation: accept as planned.
- CRP-B (visual default), Q2: should `.dark` on an ancestor force dark (a) always, like
  `[data-theme='dark']` today (`theme.css:44`), or (b) only with `theme="auto"`? Option (b) changes no
  existing host but ignores `.dark` on the default element. Screenshots from T5. Recommendation: (a),
  for consistency and the shadcn convention.
- CRP-C (Q-G, `ux-review/report.md:639-640`): does the owner want a density attribute? If yes, which
  compact values for `--pr-space-1..5`, `--pr-space-section`, `--pr-shell-padding` and
  `--pr-font-size-*`? Screenshots from T8 at 1440 and 375.

For the coordinator:

- Q4. Is shadcn v3 (HSL channel) support out of scope, with an `hsl(var(--x))` snippet in the guide
  only? Recommendation: yes. A second file can follow if hosts ask.
- Q5. Register `["pnpm", "package:check"]` for I4 and I7, if the lab allows a build and `attw --pack`?
- Q6. Owner context "OpenBinding overrides `.pr-plan-grid`" cannot be verified. S6 should name no
  host product.
