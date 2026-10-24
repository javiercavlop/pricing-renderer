Feedback from the Delivera integration (ISA group, Sept 2026)

# Proposal: explain the estimated total with a price breakdown

The requirements live in `spec.md` in this folder. This proposal covers change 3 of 4 of that
feedback. Changes 1 (`delivera-1-downgrade-selection`) and 2 (`delivera-2-load-current-contract`)
are merged and this change builds on both.

Status: PROPOSED. The public API below is the minimal API this change needs and is NOT approved
yet. No implementation starts before the owner decides the points under "Decisions pending".

## Motivation

Delivera shows `<pricing-renderer>` to customers who change an existing subscription. It needs to
show customers how the estimate in `.pr-summary` is built and to compare that estimate with its own
billing. Today neither is possible without reimplementing the pricing logic:

- The summary (`renderSummary`, `src/element/renderers.ts`) shows only a label, the total and a
  "Requires quote" note. It never says which plan and add-ons are counted, with which quantity, or
  how the billing period changes the prices.
- `ResolvedPricing` has `planPrices` and `addOnPrices` for every plan and every add-on, selected or
  not. To rebuild the total a host must repeat `reconcileSelection` (to drop add-ons that are
  unavailable for the plan), `normalizeAddOnQuantity` (to bill the quantity on the min/step/max
  grid), the label and expression-error rules for `requiresQuote` and the summation itself.
- The order of the summation is the key order of `selection.addOns`, which depends on the order in
  which the user clicked. A host that adds the same amounts in another order can get a different
  last binary digit than `resolved.subtotal` for decimal prices.
- Inside the element, `_stabilizeResolvedPrices` replaces a price whose expression fails with the
  last valid price and recomputes the subtotal. A host that rebuilds the total from the core
  function gets a different number from the one the element shows.

Expected flow on the acme fixture (`tests/fixtures/acme-pricing.yml`, currency EUR, defaults
`seats: 5`): the customer has Growth with 2 `extraStorage` packs and `prioritySuccess`, billed
yearly (multiplier 0.8). The summary shows `€64`. The customer presses the small "How is this
calculated?" button next to the total and reads, without leaving the page:

- Growth: `€45 × 1 × 0.8 = €36`
- Extra Storage: `€5 × 2 × 0.8 = €8`
- Priority Success: `€25 × 1 × 0.8 = €20`
- Billing period: Yearly; Currency: EUR; Estimated total: `€64`

The host reads the same lines from `resolved.breakdown` in `pricing-selection-change` (or from
`resolvedState`) and can store or compare them without repeating the pricing logic.

## What changes

- Core: `resolvePricing` returns a new required field `ResolvedPricing.breakdown`, a JSON-safe
  description of the lines that make up `subtotal` and `requiresQuote`: currency, billing period,
  the selected plan and the selected add-ons that survive reconciliation, each with quantity, unit
  price before the billing multiplier, multiplier, amount, quote state and price label. New
  exported types `PriceBreakdown` and `PriceBreakdownLine`. No new function.
- Core: `subtotal` is summed in a documented order, the plan first and then the add-ons in the
  declaration order of `pricing.addOns`, which is also the order of the breakdown lines. So
  `breakdown.subtotal === subtotal` and adding the line amounts in line order gives exactly the
  same number.
- Element: the breakdown reaches `pricing-ready`, `pricing-selection-change`, `pricing-action`,
  the `applySelection` result and `resolvedState` with no event or type change, because they all
  carry `ResolvedPricing`. The element keeps the breakdown consistent with the prices it shows
  when an expression fails and the last valid price is kept.
- Element UI: a small, discreet icon button next to the estimated total toggles an inline
  disclosure panel (not a modal and outside the `aria-live` region) that lists the plan price, each
  add-on as unit price × quantity × billing multiplier = amount, the billing period, the currency,
  the total and the lines that require a quote. No new element property, attribute or event.
- i18n: three new keys in `enUS` and `esES` (`src/core/i18n.ts`), documented in `docs/i18n.md`.
- Audit follow-ups in the same files, as separate small requirements: a stepper test for the
  grid maximum, a `Math.min` cap in `maxQuantityOnGrid`, the normalized quantity in the stepper,
  and a test that expression equality does not coerce types.

## Minimal API (proposed, pending approval)

Additive in `src/core/types.ts`, exported from `src/core/index.ts` (the package root
`pricing-renderer`):

```ts
export interface PriceBreakdownLine {
  kind: 'plan' | 'addOn';
  id: string;
  name: string;
  quantity: number;
  unitAmount?: number;
  billingMultiplier: number;
  amount?: number;
  requiresQuote: boolean;
  label?: string;
}

export interface PriceBreakdown {
  currency: string;
  billingPeriod?: NormalizedBillingPeriod;
  plan?: PriceBreakdownLine;
  addOns: PriceBreakdownLine[];
  subtotal: number;
  requiresQuote: boolean;
}

export interface ResolvedPricing {
  // selection, planPrices, addOnPrices, subtotal, requiresQuote and diagnostics are unchanged
  breakdown: PriceBreakdown;
}
```

Semantics, specified in `spec.md`:

- `currency`: `pricing.metadata.currency`.
- `billingPeriod`: a copy of the `pricing.billing` entry whose id is the selection's billing
  period; absent when that id is unknown, in which case every multiplier is 1, as today.
- `plan`: the line of the selected plan; absent when `selection.planId` is `undefined` or not a
  plan id (then `requiresQuote` is `true`, as today).
- `addOns`: one line per add-on of `pricing.addOns` that is selected in the reconciled selection,
  in the declaration order of `pricing.addOns`. Unselected entries, add-ons removed by
  `reconcileSelection` and ids that are not in the pricing get no line.
- Line `quantity`: 1 for the plan; `normalizeAddOnQuantity(pricing, id, entry)` for an add-on (the
  quantity that is billed).
- Priced line: `unitAmount` is the price before the billing multiplier, `amount` is
  `unitAmount * billingMultiplier * quantity` evaluated left to right (bit-identical to
  `planPrices[id].amount` and `addOnPrices[id].amount`), `requiresQuote` is `false`, no `label`.
- Label price (such as "Contact sales"): `requiresQuote: true`, `label` is the text, no
  `unitAmount` and no `amount`.
- Price expression that cannot be resolved: `requiresQuote: true`, no `unitAmount`, no `amount`
  and no `label`, so hosts can tell a quote by label from a failed expression.
- `subtotal` and `requiresQuote`: the same values as `resolved.subtotal` and
  `resolved.requiresQuote` (`Object.is` equal), with the summation order above.
- JSON-safe and detached: optional keys are absent, never present with the value `undefined`;
  `JSON.parse(JSON.stringify(breakdown))` deep-equals it, and it shares no object with the pricing
  or the selection input.

Refinements of the shape first drafted for this change, with reasons:

- `billingPeriod` reuses the exported `NormalizedBillingPeriod` type (same three fields) instead of
  a new anonymous type; the value is a copy.
- Optional keys are absent rather than `undefined`, so a `JSON.stringify` round trip and
  `toStrictEqual` comparisons stay exact.
- An expression error has no `label`; only label prices carry one. No extra `reason` field is
  needed to tell them apart.
- The line order is the declaration order of `pricing.addOns`, not the key order of the selection,
  and the subtotal is summed in that order (see "Decisions pending", D2).

Element UI (no new public property, attribute or event):

- New stable part hooks for theming: `breakdown-toggle` (the button), `breakdown` (the panel) and
  `breakdown-line` (one row per breakdown line). They are a public CSS contract under
  `docs/theming.md` ("Stable part hooks"). A host that does not want the button hides it with
  `pricing-renderer [data-pr-part='breakdown-toggle'] { display: none; }`.
- New i18n keys: `pricing.breakdownToggle` (en "How is this calculated?", es "¿Cómo se
  calcula?"), `pricing.breakdownTitle` (en "Price breakdown", es "Desglose del precio") and
  `pricing.breakdownFormula` (en and es `{unitPrice} × {quantity} × {multiplier} = {amount}`).
- `.pr-summary` keeps `data-pr-part="summary"`, but the `aria-live="polite"` attribute moves from
  the `aside` to an inner region holding the label, the total and the quote note, so that the
  button and the panel are outside the live region.

## Alternatives considered and rejected

- A new function such as `getPriceBreakdown(pricing, selection)`: it would duplicate
  `resolvePricing`, need the same options, and could not see the element's last-valid-price
  stabilization, so it could disagree with the total on screen. A field on `ResolvedPricing`
  reaches every event and `resolvedState` with no new API.
- An optional `breakdown?` field: `resolvePricing` always sets it, so an optional type only forces
  hosts to write `?.`. The cost of the required field is that hand-built `ResolvedPricing` objects
  (test doubles) stop compiling, the same trade-off the owner accepted for `PricingReadyDetail` in
  change 2.
- Let hosts derive the breakdown from `planPrices` and `addOnPrices`: those records cover every
  plan and add-on, ignore reconciliation, price unselected add-ons with quantity 1 and say nothing
  about the order of the sum, so every host would repeat that logic and could still miss the total
  by a binary digit.
- Lines in the key order of `selection.addOns`, which keeps today's summation: the order would
  depend on the order of the user's clicks (selecting `prioritySuccess` first adds `extraStorage`
  after it), so the panel would reorder itself for the same selection.
- Lines in declaration order but the subtotal still summed in key order: adding the line amounts
  in the order shown could differ from the total in the last binary digit for decimal prices, and
  hosts that check the sum would see false mismatches.
- An element property (`breakdownEnabled`) or an event for opening the panel: not needed for the
  feedback, and the part hook already lets a host hide the button. Can be added later without a
  break.
- A tooltip: not reachable by touch, disappears on blur and cannot hold a list. A modal dialog:
  too heavy for reading four lines and it hides the summary it explains. The inline disclosure is
  the WAI-ARIA Authoring Practices pattern for showing and hiding a section.
- Rendering the breakdown inside the `aria-live` summary: every selection change would then
  announce the whole breakdown.
- Extra line fields (`unit` such as `pack/month`, the yearly discount percent, a `reason` for the
  quote): all derivable from the pricing by id or from the other fields; left out of the minimal
  API.

## Evaluation: `compareSelections(pricing, before, after)`

Delivera also asked for a function that compares the current contract with the edited selection.
Recommendation: do NOT add it in this change; record it as a follow-up proposal.

- With `breakdown`, a host can already compare two selections: resolve both and diff the two
  `breakdown` objects by line `id` (`resolvedState` before the edit and the `pricing-selection-change`
  detail after it). The lines are in a stable order and JSON-safe, so a generic diff works.
- A useful built-in comparison needs semantic decisions that are a design of their own: whether a
  changed quantity is one "changed" entry or a removal plus an addition; how to report an add-on
  that `reconcileSelection` removed versus one the user deselected; what to do when the billing
  period or the multiplier changes (every line changes); how to compare a priced line with a quote
  line; how to compare totals across currencies or pricing versions; and whether the difference is
  per period or prorated, which Delivera's billing decides, not the renderer.
- Adding it now would freeze those answers in a public function before anyone has used the
  breakdown. This change writes no requirement for it.

## Decisions pending

The owner decides each point. Every requirement listed under D1 to D6 is pending approval and must
not be implemented before the decision. The audit follow-ups (last list) do not depend on the new
API.

- D1, core API: the types `PriceBreakdown` and `PriceBreakdownLine` exported from
  `src/core/index.ts`, and `ResolvedPricing.breakdown` as a required field (hand-built
  `ResolvedPricing` values stop compiling; accepted in a minor release?). Pending approval:
  `req~breakdown-field~1`, `req~breakdown-types-exported~1`, `req~breakdown-required-field~1`,
  `req~breakdown-currency~1`, `req~breakdown-billing-period~1`,
  `req~breakdown-unknown-billing-period~1`, `req~breakdown-plan-line~1`,
  `req~breakdown-no-plan-line~1`, `req~breakdown-addon-lines~1`, `req~breakdown-addon-order~1`,
  `req~breakdown-addon-quantity~1`, `req~breakdown-priced-line~1`, `req~breakdown-label-line~1`,
  `req~breakdown-error-line~1`, `req~breakdown-requires-quote~1`, `req~breakdown-json~1`,
  `req~breakdown-detached~1`.
- D2, summation order: `resolvePricing` and the element sum the plan first and then the add-ons in
  the declaration order of `pricing.addOns` (today: key order of the selection). Integer amounts
  and selections with at most one priced add-on give the same values as today; two or more decimal
  add-on amounts can differ from the old result in the last binary digit. Pending approval:
  `req~breakdown-subtotal-order~1`, `req~breakdown-subtotal-equals~1`.
- D3, element consistency: when the element keeps the last valid price of a failing expression,
  the breakdown line carries that last valid price, `breakdown.subtotal` equals the subtotal the
  element shows, and `breakdown.requiresQuote` keeps the core value (so the summary still says
  "Requires quote" during the error, as today). Pending approval: `req~breakdown-in-element~1`,
  `req~breakdown-element-stabilized~1`.
- D4, UI disclosure: the toggle and the inline panel, the part hooks `breakdown-toggle`,
  `breakdown` and `breakdown-line`, and moving `aria-live` from the summary `aside` to an inner
  region. Pending approval: `req~summary-breakdown-toggle~1`, `req~summary-breakdown-unique-ids~1`,
  `req~summary-breakdown-activate~1`, `req~summary-breakdown-lines~1`,
  `req~summary-breakdown-totals~1`, `req~summary-breakdown-escape~1`,
  `req~summary-breakdown-escape-scope~1`, `req~summary-breakdown-stays-open~1`,
  `req~summary-breakdown-closes-on-load~1`, `req~summary-breakdown-not-live~1`,
  `req~summary-live-region~1`, `req~summary-breakdown-closed-layout~1`,
  `req~summary-breakdown-target-size~1`, `req~summary-breakdown-axe~1`,
  `req~summary-breakdown-icon-contrast~1`, `req~summary-breakdown-reduced-motion~1`.
- D5, i18n: the three keys and their English and Spanish texts. Pending approval:
  `req~breakdown-i18n-keys~1`.
- D6, presentation choices: the panel always shows the three factors (also `× 1`), so each line
  reads the same way and translators get one template; the billing period row appears only when the
  pricing has more than one billing period (the same rule as the billing control; a pricing
  without a `billing` block has only the synthetic period "Base"); the panel stays open when the
  selection changes and closes when a new pricing loads; the button is shown even when
  `selectionEnabled`, `ctaEnabled` or `variablesEnabled` is `false`, because it only reads. These
  are part of the D4 requirements above.
- D7, `compareSelections`: not added (see the evaluation above); a follow-up proposal instead. No
  requirement.

Not pending (audit follow-ups, no public API change): `req~stepper-max-on-grid~1`,
`req~quantity-grid-max-cap~1`, `req~quantity-normalized-max-cap~1`,
`req~stepper-normalized-quantity~1`, `req~stepper-steps-from-normalized~1`,
`req~expression-equality-no-coercion~1`.

## Scope

- `src/core/types.ts`, `src/core/index.ts` (types), `src/core/resolve.ts` (breakdown, summation
  order, `maxQuantityOnGrid` cap); optionally a new internal module for the breakdown builder, not
  exported from `src/core/index.ts`.
- `src/core/i18n.ts` (three keys in `enUS` and `esES`).
- `src/core/expression.ts`: only the trace tag for `req~expression-equality-no-coercion~1`; the
  behaviour already holds.
- `src/element/renderers.ts` (`renderSummary`, the stepper quantity),
  `src/element/pricing-renderer-element.ts` (panel state, Escape, `_stabilizeResolvedPrices`),
  `src/styles/base.css` (toggle and panel; no new token in `src/styles/theme.css`).
- `tests/unit` (new `breakdown.test.ts`, `quantity-grid.test.ts`, `expression.test.ts`, the i18n
  and type checks), `tests/browser/pricing-renderer.spec.ts`.
- `docs/api-reference.md`, `docs/i18n.md`, `docs/theming.md` (part hooks), `docs/configuration.md`
  (the button under "Disabled behavior"; the stepper quantity under "Controlled versus
  uncontrolled"), `.changeset` (minor).
- `custom-elements.json`: no change expected (see "Public API impact").

## Out of scope

- `compareSelections` or any other comparison API (D7).
- Change 4 of the same feedback.
- A new element property, attribute or event; React wrapper changes. `src/react/index.ts` does not
  re-export core types today (it re-exports element and yaml types only; React hosts import core
  types from `pricing-renderer`), so it needs no change and stays that way.
- Changing when the summary says "Requires quote" during an expression error (today's behaviour is
  kept, see D3).
- Proration, taxes, discounts other than the billing multiplier, and currency conversion.
- Updating the visual baselines (`tests/browser/pricing-renderer.spec.ts-snapshots/*.png`). They
  are outside this change's file scope and no worker accepts new baselines; see "Risks".

## Public API impact

Pending the owner's decision (see "Decisions pending"). Minor changeset for `pricing-renderer`:

- New exported types `PriceBreakdown` and `PriceBreakdownLine` from `pricing-renderer`.
- New required field `ResolvedPricing.breakdown`. It appears in `PricingViewModel.resolved`, in
  `PricingReadyDetail.resolved`, `PricingSelectionChangeDetail.resolved`,
  `PricingActionDetail.resolved`, `ApplySelectionResult.resolved` and `resolvedState.resolved`
  with no change to those types. Code that builds a `ResolvedPricing` by hand must add the field.
- `subtotal` summation order (D2): possible last-digit differences for two or more decimal add-on
  amounts. The changeset states it.
- New stable part hooks `breakdown-toggle`, `breakdown` and `breakdown-line`; new i18n keys.
- `.pr-summary`: `aria-live` moves from the `aside` to an inner region. Internal `pr-*` classes and
  nesting are not public contracts (`docs/theming.md`), but hosts that select
  `[data-pr-part='summary'][aria-live]` must update the selector; the changeset states it.
- `custom-elements.json`: no new member, attribute or event, and the event types refer to the
  detail types by name, so the manifest needs no change. The implementer verifies it: the
  manifest has no diff and `tests/unit/custom-elements.test.ts` passes unchanged.
- Existing deep-equality tests: no unit test compares a whole `ResolvedPricing` with `toEqual` and
  the repository has no snapshot files for it. The Playwright tests that compare two `resolved`
  objects (an `applySelection` result with `resolvedState`, a `pricing-ready` detail with
  `resolvedState`) compare two values built by the same snapshot path, so both carry the same
  `breakdown` and stay equal. Unit tests that use `toMatchObject` or read single fields are not
  affected.

## Risks

- Visual baselines. The nine responsive tests compare full-viewport screenshots with
  `maxDiffPixelRatio` 0.015 (0.025 at 320 and 375 px, 0.03 at 1200 px). The summary is outside
  every baseline viewport (checked on the committed PNGs: they show the variables, the plans and
  the comparison table), but the test scrolls the element into view before the screenshot, so a
  change of the element's height can shift the whole screenshot by several pixels and exceed the
  tolerance. Mitigation: `req~summary-breakdown-closed-layout~1` requires the closed button to
  leave the block size of `.pr-summary` and of the element unchanged, and the restructured live
  region must keep the summary's layout. Verification: the responsive tests run against the
  committed baselines without `--update-snapshots` and must pass unchanged. If they fail, the
  change stops and reports the diff images; only the owner can accept new baselines.
- Summation order (D2), see "Public API impact".
- Required field (D1): test doubles of `ResolvedPricing` in host code stop compiling.
- Sticky summary on small screens: below 840 px the summary sticks to the bottom of the viewport,
  so an open panel makes it taller. The panel has no inner scroll area (a scroll container without
  focusable content fails the axe rule `scrollable-region-focusable`); it closes with the button
  or Escape and on a new load.
- Duplicate ids: the element renders in light DOM, so a fixed panel id would repeat when a page has
  two renderers and break `aria-controls`. `req~summary-breakdown-unique-ids~1` requires one id per
  instance.
- Text in the summary: existing Playwright tests assert `.pr-summary` with `toContainText`.
  A closed panel has no content and the button has no text node, so those assertions keep testing
  the total, not the panel.
- Last valid prices (D3): a kept price may come from another billing period or quantity than the
  current selection; the line shows the kept price's own factors so its formula stays consistent
  with the amount that is added.
- Existing CSS: `.pr-summary span` styles every `span` in the summary as the quote note; the
  implementation must scope it so the panel and button are not affected.

## Test plan

Tests are written first and fail before the implementation (red before).

- `tests/unit` (vitest, node, no DOM): the breakdown on the acme fixture (defaults, contract `C`
  monthly and yearly, Enterprise with `compliance`, reconciliation, key order, unknown plan,
  billing period and add-on ids, expression errors, quantities above the maximum), on
  `tests/fixtures/spectra/slack/2024.yml` (no `billing` block, "Contact Sales" labels, a quantity
  of 1000) and on `tests/fixtures/spectra/zoom/2024.yml` (annual multiplier 0.83, "Contact us",
  decimal prices); `breakdown.subtotal` and `requiresQuote` against `resolved` for every SPECTRA
  fixture; JSON round trip; detachment; the exported and required types through the TypeScript
  compiler API (as `tests/unit/custom-elements.test.ts` does); the i18n keys; `maxQuantityOnGrid`
  and `normalizeAddOnQuantity` with `toBe(0.3)`; expression equality without coercion.
- `tests/browser/pricing-renderer.spec.ts` (Playwright, demo page with the acme fixture): the
  breakdown in `resolvedState`, events and the stabilized error case; the toggle (name in English
  and Spanish, `aria-expanded`, `aria-controls`, unique ids), click, Enter and Space, Escape and its
  scope, the panel content for `C` yearly and for Enterprise with `compliance`, staying open on
  selection changes, closing on reload, the live region, the closed layout, the hit area, axe with
  the panel open in light and dark themes, icon contrast, reduced motion; the stepper `max` on the
  grid and the normalized quantity in controlled and uncontrolled mode. The existing responsive
  tests run unchanged against the committed baselines.

## Rollout

- Minor changeset for `pricing-renderer`: the field, the types, the summation order note, the
  button and panel, the part hooks, the `aria-live` move, the i18n keys, and the audit fixes
  (grid cap, stepper quantity). It ends with "Feedback from the Delivera integration (ISA group,
  Sept 2026)."
- `docs/api-reference.md`: `PriceBreakdown`, `PriceBreakdownLine` and `ResolvedPricing.breakdown`
  under "Key data contracts", the summation order next to the `resolvePricing` paragraph, and the
  disclosure in the element section.
- `docs/i18n.md`: the three keys with their English and Spanish texts.
- `docs/theming.md`: the part hooks `breakdown-toggle`, `breakdown` and `breakdown-line`, and how
  to hide the button.
- `docs/configuration.md`: the button is shown whatever the three flags; controlled quantities are
  shown and stepped as normalized quantities.
- `custom-elements.json`: unchanged (verified, see "Public API impact").
- PR text: it states "Feedback from the Delivera integration (ISA group, Sept 2026)". It names no
  person and contains no e-mail address.
