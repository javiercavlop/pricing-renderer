# Changelog

## [0.2.0] - 2026-11-07

### Highlights

- **Subscription changes.** A review screen, `<pricing-change-review>`, shows what
  changes between the current subscription and the new one: plan, price and its
  difference, add-ons, features and usage limits. The core gains
  `compareSelections`, `reconcileSelection` and the DOM-free selection logic
  (`planSelectionChange`, `applySelectionChange` and friends); the element shows
  the customer's current plan through `currentSelection` and loads a known one
  with `applySelection`; `pricing-renderer/space` adds helpers for SPACE
  contracts.
- **Headless React.** `PricingRendererProvider` and the
  `pricing-renderer/react/headless` entry, with the `usePricingSelection`,
  `usePricingSource` and `usePricingRendererState` hooks, render props for the
  CTA, summary actions, loading and error states, a `style` prop and typed DOM
  events.
- **Fitting a host.** `slots`, `hideSections` (whole sections and the pieces of
  the hero), `density`, new design tokens, `theme-minimal.css`,
  `tokens-shadcn.css`, a host `.dark` class, stable state attributes and
  per-locale unit labels.
- **Large pricings.** Compact add-on cards above eight add-ons with a filter,
  "Only differences", comparison groups by tag, fluid plan columns, a sticky
  plan header and an "Add-on" marker in the comparison.
- **Add-ons and totals.** An add-on that cannot be combined with one already
  selected is shown as unavailable, naming what blocks it; quantity relations
  sit on the face of the card; a price breakdown explains the estimated total,
  which no longer hides inside the add-on layout.
- **Loading and robustness.** `loadPricingSource`, timeouts and size limits on
  every step of a load, cancellation of stale loads, a human error sentence and
  instance-prefixed, collision-free ids.
- **Accessibility and security.** Focus stays inside the renderer when content
  collapses, variable controls describe their help and errors, and
  `isSafeLink` rejects more unsafe link forms.

### Publication

Published by hand with npm two-factor authentication while GitHub Actions was
unavailable, so this version carries no npm provenance attestation. The release
workflow publishes later versions with provenance again.

### Behaviour changes to check when upgrading

- An add-on excluded by a selected add-on is no longer selectable; the
  confirmation dialog no longer opens for exclusions.
- Price expressions use strict equality for `==` and `!=`.
- Add-on quantities are always kept on the min/step grid.
- The comparison groups rows by their declared `tag`, and "Only differences"
  starts checked for long comparisons when the attribute is absent.
- The estimated total is no longer rendered inside the add-on layout, which
  drops its sidebar column.

### All changes

#### Minor

- An add-on that cannot be combined with one already selected is now shown as unavailable, the way an add-on the plan does not offer already was: not selectable, its checkbox disabled, and a status on the card that names what blocks it — "Not available with Github Codespaces 2 Core" — instead of letting a click open a dialog to say so.
- Add `applySelection(selection)` to `<pricing-renderer>` to load a known selection, such as the customer's current subscription, once the pricing is ready.
- Review screen for a subscription change.
- Export the selection logic of the element from the core, free of the DOM: `planSelectionChange`, `applySelectionChange`, `selectionWithVariable`, `selectionWithAddOnQuantity`, `selectionInEffect` and `createPriceStabilizer`, with the types `SelectionChangeIntent`, `SelectionChangeResult`, `PriceStabilizer` and `PendingAddOnChange`.
- `<pricing-renderer>` can show the customer's current subscription.
- New opt-in `density` attribute, property and React prop (`'comfortable' | 'compact'`).
- New optional design tokens for fitting the renderer into a host design system.
- Add `reconcileSelection`, which deselects add-ons that are unavailable for the selected plan and the add-ons that depend on them.
- `<pricing-renderer>` accepts a `slots` property (no attribute) with the names `plan-cta`, `summary-actions`, `loading` and `error`.
- `<pricing-renderer>` and the React `PricingRenderer` accept `hideSections` (attribute `hide-sections`), a list of section names (`hero`, `metadata`, `billing`, `variables`, `plans`, `comparison`, `addOns`, `summary`) that are not rendered.
- Darken the renderer and the change review when a host `.dark` class is on an ancestor and the element has `theme="auto"`, with the same tokens as `data-theme='dark'`.
- Add `loadPricingSource` to `pricing-renderer/yaml`.
- Type `addEventListener` for `pricing-ready`, `pricing-selection-change`, `pricing-action` and `pricing-diagnostic` through a global `HTMLElementEventMap` augmentation, so `element.addEventListener('pricing-action', (event) => event.detail.actionId)` needs no cast.
- Add the warning `PR_VALUE_TYPE_MISMATCH` when a `NUMERIC` feature or usage limit has a text value (default value, plan or add-on override, `{ value: ...
- Explain the estimated total with a price breakdown.
- Add `PricingRendererProvider` and the `pricing-renderer/react/headless` entry.
- `PricingRenderer` accepts the render props `renderPlanCta`, `renderSummaryActions`, `renderLoading` and `renderError`.
- `PricingRenderer` in the React adapter now accepts a `style` prop.
- Four changes to what the renderer puts on the page.
- Three fixes to the change review, all found by driving it on a real page.
- `<pricing-change-review>` takes a `hideSections` property (and a `hide-sections` attribute) with three parts: `actions`, for a diff the reader cannot act on; `relation`, the Upgrade/Downgrade badge, which follows the declaration order of `pricing.plans` and reads as a ladder that two configurations compared side by side do not have; and `title`, for a host whose own heading already names the comparison.
- Security hardening: `isSafeLink`, and so plan CTA links, comparison-row documentation links and the metadata URL, now rejects values that start with `//` or `/\` (also with tab or newline characters between them) because browsers read them as links to another host.
- Export `selectionToSearchParams` and `selectionFromSearchParams` from the core, free of the DOM, with the option types `SelectionToSearchParamsOptions` and `SelectionFromSearchParamsOptions`.
- Pricings with more than 8 add-ons now render compact add-on cards of equal height per row, with the availability, dependency, exclusion and quantity details moved into the existing details disclosure (new i18n key `pricing.moreDetails`).
- The React adapter now accepts the new `onlyDifferences`, `toolbarThreshold` and `addOnFilterThreshold` props.
- The comparison groups now follow the declared `tag` of features and usage limits (visual change, approved by the owner).
- New `only-differences` attribute sets the initial state of the comparison's "Only differences" checkbox; when it is absent, the checkbox starts checked for pricings with more than 100 comparison rows and 2 plans or more (visual change by default for those pricings, approved by the owner).
- Add `presentation.unitLabels` to set the singular and plural text of a usage unit per locale and unit, with `*` as the default for every locale.
- Plan and add-on cards and plan calls to action now expose stable state attributes: `data-featured` on plan cards, `data-available` on add-on cards and `data-kind` (`primary` or `secondary`) on plan calls to action.
- Subscription change flow: comparison, SPACE helpers and guide.
- New core function `compareSelections({ before, after, currentUsage?, expression?
- New subpath `pricing-renderer/space` with helpers for SPACE contracts.
- The running total no longer sits inside the add-on layout.
- Add `pricing-renderer/theme-minimal.css`, a flat neutral theme (grayscale, no shadows, borders in the text color) that replaces `theme.css` and serves as a starting point for custom themes.
- Add `pricing-renderer/tokens-shadcn.css`, an overlay that maps the renderer tokens to the shadcn/ui variables (`--primary`, `--card`, `--border`, `--radius`, ...) and follows the host `.dark` class.
- Add the `usePricingSelection` hook to the `pricing-renderer/react/headless` entry, also re-exported from `pricing-renderer/react`.
- Add the `usePricingSource` hook to the `pricing-renderer/react/headless` entry, also re-exported from `pricing-renderer/react`.
- Add the `usePricingRendererState` hook to the `pricing-renderer/react/headless` entry, also re-exported from `pricing-renderer/react`.

#### Patch

- The "Add-on" marker now shows only in plans where a providing add-on can be bought; other cells keep the dash.
- Price expressions now use strict equality for `==`, `===`, `!=` and `!==`, so `-0` equals `0` and `NaN` never equals `NaN`.
- Add-on quantities are now always on the min/step grid: a quantity above the maximum is capped to the largest valid value (min 1, step 5, max 8 bills 6, not 8), and the quantity stepper uses the same limit.
- `maxQuantityOnGrid` never exceeds the maximum because of floating-point error, and the quantity stepper in controlled mode shows and steps from the normalized quantity.
- Add a design systems guide (`docs/design-systems.md`) for Tailwind CSS, CSS Modules and shadcn/ui hosts.
- Document the events, the diagnostic codes and the Vue 3 integration.
- Document which pricing version a page shows (`docs/pricing-versions.md`): signed-out visitors see the version SPACE assigns to new contracts, signed-in customers see their contract's version, and a SPACE-managed service is read through SPACE and not straight from SPHERE.
- Document private pricings.
- The element now uses the core selection functions (`planSelectionChange`, `applySelectionChange`, `selectionWithVariable`, `selectionWithAddOnQuantity`, `selectionInEffect` and `createPriceStabilizer`).
- The focus ring on a comparison row that takes focus after "Show N more" is now drawn inside the row, so the sticky first column and the scroll container no longer hide it.
- Ids derived from data (variable paths, group ids, add-on ids) now escape every character other than letters and digits as `_<hex>_`, so two different values can no longer produce the same id; these ids are not a documented hook.
- Count the response body while `loadPricingFromUrl` reads it.
- Apply `timeoutMs` and the abort signal to every step of `loadPricingFromUrl`: the `headers` function, `loadPricing`, `fetch` and the body read.
- Show add-on names instead of identifiers in the "Requires ..." and "Cannot be combined with ..." lines of an add-on card and in the "Will add" and "Will remove" lines of the confirmation dialog.
- Below 840px the top padding, the spacing between the rows above the plans (metadata, variables and diagnostics included) and the margin under the plans heading are capped exactly as they already are from 840px, so the first plan price fits in the first screen of a phone.
- Show a status message instead of an empty comparison table when a pricing has no plans.
- Show a human sentence in the element's error state instead of raw diagnostic codes.
- Compare the `pricing`, `request` and `normalizeOptions` properties of the element by content (arrays and plain objects; functions, `Headers`, `AbortSignal` and other class instances by identity).
- Give every `id` the element renders an instance prefix (`pr-<n>-plans-title`, `pr-<n>-dialog-title`, `pr-<n>-group-<id>`, and so on), so two renderers on one page no longer share ids and their `aria-labelledby`, `aria-describedby`, `aria-controls` and `for` references stay inside their own renderer.
- Apply `request.maxBytes` (default 2 MiB) to a string returned by a custom `loadPricing`, measured in UTF-8 bytes.
- Localize the loading text of the element: while it is idle or loading, the hidden heading and the status text use `loadingLabel` when set, and otherwise `pricing.loading` from the element's `locale` and `messages`, instead of a fixed English string.
- A short comparison with `only-differences` now shows every row.
- Resume a pricing load when the element is moved to another parent while it is still loading: the element observes its size again, measures its width and reloads, instead of staying on the loading skeleton.
- Cancel the pricing load in flight when `reload()` finds no source or more than one: a slow `src` load that finishes after `src` was removed no longer emits `pricing-ready` or replaces the `PR_SOURCE_MISSING` / `PR_SOURCE_CONFLICT` error.
- Tell the host how to fix a `PR_VERSION_UNSUPPORTED_MAJOR` error: for a major below 3 the message says to upgrade the pricing to 3.x on the server, for example with `retrievePricingFromText` from `pricing4ts/server`; for a major above 3 it says the version is not supported yet.
- Pluralize the usage unit next to a numeric value in the comparison when the UI locale is English, so `3 unit` reads `3 units`.
- Hydrating the React wrapper (`PricingRenderer`, `PricingChangeReview`) after the element has rendered no longer logs a recoverable hydration error and no longer replaces the host node.
- Keyboard focus now stays inside the renderer when "Show N more" disappears in the comparison or in the add-on grid.
- Clear the pending add-on change on direct commits, show loading after a stopped reload, and name the headless re-exports of the React entry.
- The comparison no longer renders a row description that is empty or only repeats the row name.
- Show an "Add-on" marker instead of the em dash in comparison rows that only an add-on provides (Spanish: Complemento).
- Plan cards now fill the width in fluid columns chosen by the number of plans and the renderer width (at most 3 columns from 840px and at most 4 from 1040px, without a single card left alone in the last row where it can be avoided), and from 840px the hero title is smaller (3rem at most) and the plan cards and the space above them are tighter, so the first plan button fits in the first screen at 1440px.
- The comparison table now scrolls vertically inside a box of at most 80% of the viewport height, so the plan header stays visible while reading a long table (the first column stays pinned and the mobile card layout is unchanged).
- Point each variable control's `aria-describedby` at its help text and its error message, which now carry the ids `<control id>-help` and `<control id>-error`, so a screen reader reads both when the control is focused.

## [0.1.0] - 2026-07-29

- Initial public npm release of the DOM-free TypeScript core, light-DOM Web
  Component, and React 18/19 adapter.
- Complete Pricing2Yaml 3.1 normalization, best-effort 3.x compatibility,
  bounded remote loading, and safe AST-based expression evaluation.
- Responsive commercial and catalog experiences with selectable plan/add-on
  cards, billing, editable variables, constrained quantities, dependency and
  exclusion confirmation, partial totals, and quote pricing.
- Typed feature and usage-limit highlights with manual, automatic, and hybrid
  modes; verified “Everything in …, plus” inheritance; and configurable plan
  badges.
- Project, YAML, and per-instance presentation configuration; English and
  Spanish catalogs; accessible light/dark/forced-color themes; RTL; reduced
  motion; CSS tokens; and stable `data-pr-part` hooks.
- Public documentation, Vanilla/React/Next examples, visual baselines, and
  GitHub Release CD with npm provenance.

[0.2.0]: https://github.com/javiercavlop/pricing-renderer/releases/tag/v0.2.0
[0.1.0]: https://github.com/javiercavlop/pricing-renderer/releases/tag/v0.1.0
