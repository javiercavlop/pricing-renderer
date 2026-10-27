# Proposal: subscription change flow

Change `add-subscription-change-flow`. Status: owner decisions D1 to D9 approved
(`crp-phase2-api-decisions`, answer id `own-27876d8d5ef5459e9bc6067536e2e5d4`; design.md, "Owner
decisions"). The review screen mock was approved (`crp-phase2-review-screen-mock`, answer id
`own-a7693b57b0b64826ba4b8b3c2a83fe2e`). UX-4, 5, 6, 7, 8 and 11 are not approved and not
implemented.

## Why

Owner request (binding):

> a signed-in customer sees the pricing version of their contract with their current plan marked,
> picks a new configuration, reviews a screen with what changes (plan, add-ons, features, usage
> limits, price) and confirms; the host backend applies it in SPACE. Additive only: 0.1.0
> behaviour must not change.

This continues the Delivera feedback (ISA group, Sept 2026). Changes 1 to 3 added
`reconcileSelection`, `applySelection`/`resolvedState` and `ResolvedPricing.breakdown`. Change 3
(`docs/agent-work/delivera-3-price-breakdown/proposal.md`, "Evaluation: compareSelections") left
`compareSelections` as a follow-up. It said that a built-in comparison first needs semantic
decisions: reconciliation removals, quantity changes, quote lines, currencies and pricing versions.
design.md makes those decisions. Objective O3 (stable public API across the integrations) applies:
every addition is additive, optional and gated, so a host that uses none of it sees 0.1.0
behaviour.

Today a host that builds this flow must:

- re-implement the effective feature and usage-limit values of a subscription (plan values,
  add-on `features`, `usageLimits` and `usageLimitsExtensions` multiplied by the quantity);
- diff two `breakdown` objects itself and decide upgrade or downgrade;
- hand-write CTA labels and disabled states for the plan the customer already has;
- write its own review screen;
- copy `examples/space-contract/map-contract.ts` and hand-write the SPACE novation body.

## What changes

- **selection-comparison** (core): `compareSelections(input)` from the package root returns a
  JSON-safe, detached, deterministic diff of two selections. Each side has its own pricing, so
  the two sides can use different pricing versions. The diff holds the relation
  (current/upgrade/downgrade/change), the plan, the add-ons (added, removed by the user, removed by
  reconciliation with a reason, quantity changed), the features (gained/lost/changed), the usage
  limits (before, after, delta, unlimited handling, current-usage flags), the price (both
  breakdowns, the difference or the reason it is left out), the version change and the items
  that exist in only one version.
- **current-selection** (element): a `currentSelection` property and React prop. It marks the
  customer's current plan ("Your plan" badge, `data-current`), disables and relabels that plan's
  CTA, labels the other plans' CTAs "Upgrade to …" or "Downgrade to …" and marks current add-ons.
  It never changes the user's selection.
- **plan-cta** (element): a `pendingActionId` property (pending CTA: `aria-busy`, other CTAs
  disabled); per-plan relation labels in `presentation.ctas[].labels`; "Contact sales" for
  quote plans; a summary-level action ("Review change (€80)" or "Contact sales"); `{planId}` href
  templates checked with `isSafeLink`; optional `relation` and `source` fields in the
  cancelable `pricing-action` detail.
- **change-review** (element + React): `<pricing-change-review>` and `PricingChangeReview`. They
  render a `compareSelections` result in light DOM, with cancelable `pricing-change-confirm` and
  `pricing-change-back` events, `pending` and `error` hooks, plain-text notices, en-US/es-ES
  texts and accessibility. The UI requirements are `[pending CRP]`; the data, property and event
  requirements are separate, so they can be built first.
  - The tag is registered by a new side-effect subpath `pricing-renderer/define-change-review`
    and by the React wrapper when it renders.
  - `pricing-renderer/define` and `pricing-renderer/react` keep registering only
    `pricing-renderer`.
- **space-adapter** (new subpath `pricing-renderer/space`): `selectionFromContract` (promoted from
  the example, same `req~space-map-*` semantics), `subscriptionFromSelection` (SPACE novation body),
  `contractedVersion` and `currentUsageFromContract`. Dependency-free, structural types, no HTTP.
- Docs: a host-flow guide with the three host routes, error and race handling, and API, i18n and
  theming references.

## Why five capabilities

The owner request names the five parts. They are separate capabilities because each one has its
own consumer, entry point and release risk, and each can be built and accepted alone:

1. **selection-comparison** is the data contract. It runs on servers (preview route), in
   headless hosts and in the review component, so it lives in the DOM-free core. The others build
   on it.
2. **current-selection** changes how `<pricing-renderer>` presents plans to an existing customer.
   It only reads the comparison's plan relation and needs no review screen.
3. **plan-cta** changes the CTA behaviour (pending, labels, summary action, href templates). It
   also helps a new-customer page (`pendingActionId`, `{planId}` hrefs) without a current
   selection. Merging it into current-selection would tie those generic CTA features to the
   customer flow.
4. **change-review** is a new custom element with its own events, i18n and accessibility review.
   It also waits for a CRP that the other capabilities do not need.
5. **space-adapter** is a new package entry point tied to SPACE's contract format. Keeping it
   separate means a SPACE format change touches one subpath and none of the renderer's
   specifications. It also reverses the delivera-2 decision "SPACE option A" (no runtime SPACE
   export), which needs its own owner decision.

## Impact

- Capabilities: the five above, all ADDED. No living spec exists yet (`openspec/specs/` is
  empty), so there is nothing to MODIFY. The earlier requirements under `docs/agent-work/delivera-*`
  stay valid. `req~space-map-not-exported~1` is superseded (ADR 0001): it still holds literally
  (its four entry points do not export the function), but its intent is reversed by the new
  `./space` subpath (design.md, D7).
- Code areas:
  - `src/core`: new `compare-sides.ts`, `compare.ts`, `compare-values.ts` and `plan-relation.ts`,
    plus types, index, i18n and view-model;
  - `src/element`: renderer element, renderers, events, new `cta.ts`, new review element,
    renderers, events and define modules, and index;
  - `src/react/index.ts`, new `src/space/index.ts`, `src/styles/base.css`;
  - `package.json`, `tsconfig.json`, new `tsconfig.space.json`, `custom-elements.json`;
  - `examples/space-contract/map-contract.ts`, docs, `.changeset`.
- Public API (all additive, approved):
  - one core function and its types, and `PricingCta.labels`;
  - two element properties and optional `PricingActionDetail` fields;
  - a new custom element with its React wrapper and event types;
  - two new subpaths: `./space` with four functions, and `./define-change-review`;
  - new i18n keys, part hooks and diagnostic codes.
- Behaviour change for existing hosts: one edge case. A CTA `href` that contains the literal text
  `{planId}` is now expanded (design.md, D5). Nothing else changes while `currentSelection` and
  `pendingActionId` are unset.
- Risks: design.md, "Risks".

## Out of scope

- HTTP calls of any kind (the space adapter builds bodies and reads contracts; it never fetches).
- Hooks and providers (`usePricing…`, context providers): Phase 3.
- The UX-4 to UX-11 proposals.
- Proration, taxes, invoices and billing-cycle dates: the difference is the per-period estimate
  difference, not a charge.
- Enforcing `excludes` in `reconcileSelection` (current behaviour is kept; the element's dialog
  still handles exclusions interactively).
- Updating visual baselines: no baseline view sets the new properties.
