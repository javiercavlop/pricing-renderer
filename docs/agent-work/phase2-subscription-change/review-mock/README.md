# Mock: `<pricing-change-review>`

A static, dependency-free mock of the future change review screen, for the owner to judge before
the UI is built. It is plain HTML and CSS with no network access. A few lines of inline JavaScript
only drive the Auto/Light/Dark toggle.

All prices, limits, versions and dates in the mock are illustrative. They follow the acme scenario
(EUR, `tests/fixtures/acme-pricing.yml`) but are not computed from it.

## Scenario

The customer changes Growth + 2 Extra Storage + Priority Success (monthly, 80 EUR) to Enterprise +
3 Extra Storage + Compliance (Contact sales) and shifts to yearly. The default state shows:

- one add-on removed by reconciliation, with a reason (Priority Success)
- one usage limit below current usage, with a warning (Projects)
- one unlimited limit (API requests)
- a pricing version banner (v1 to v2, "New pricing version")
- a quote line ("Contact sales"), so the total is not computable
- host-supplied notices

The page stacks five states, each under its own heading: default, pending, error, no changes and
price requires a quote.

## How to open

Open `index.html` in any browser (double-click, or `file://` URL). No server or build is needed.
Use the Auto/Light/Dark toggle at the top. Each dashed frame is the size container of the
component: drag its bottom-right corner to try 320, 375, 768 and 1200 px.

- Below 600 px: limits become one block per limit and the footer actions are sticky.
- From 600 px: the price shows three columns and limits are a table.

## Parts

The mock uses the future `data-pr-part` names: `change-review` (the root, rendered as a
`<section>`; the host element will be `<pricing-change-review>`), `change-section`, `change-row`,
`change-badge` and `change-actions`. Tokens and the visual language (cards, spacing, badges,
buttons, focus ring) are copied from `src/styles/theme.css` and `src/styles/base.css`.

## What each section reads from `compareSelections`

`compareSelections` does not exist in `src/` yet. The field names below are a proposal, not a
contract.

- Header: relation (`upgrade`, `downgrade` or `change`) for the chip.
- Version banner: `pricingVersion.before`, `pricingVersion.after` (shown when they differ).
- Plan: `plan.before`, `plan.after`.
- Price: `price.before`, `price.after`, `price.difference` with `period` and `currency`;
  `price.requiresQuote` drives the quote note and the "Not computable" difference.
- Add-ons: `addOns.added`, `addOns.removed`, `addOns.removedAutomatically` (each item with a
  `reason`), `addOns.quantityChanged` (`before`, `after`).
- Features: `features.gained`, `features.lost`, `features.changed` (`before`, `after`).
- Usage limits: `usageLimits[]` with `before`, `after`, `delta`, `unlimited` and `currentUsage`;
  the warning shows when `after` is below `currentUsage`.
- Unchanged summary: `unchanged` list and its count.
- Notices: host-supplied `notices[]`, plus the host error message (`role="alert"`) and the pending
  flag (`aria-busy`, "Applying change...").
- Footer actions: Confirm is disabled when pending or when nothing changes.

## Open design questions for the owner

1. Sticky mobile footer: keep the actions sticky when the component is narrower than 600 px (as in
   the mock), or leave them at the end of the content?
2. Unchanged summary: closed by default (as in the mock) or open?
3. Usage limits on mobile: one block per limit (as in the mock), or keep a table with horizontal
   scroll, or a plain list?
4. Heading levels: the mock uses h3 for the title and h4 for sections, under a page h1/h2. The
   final levels depend on the host page; should the component expose a configurable level?
5. Version banner: it sits under the header (as in the mock). Alternatives are above the header
   or inside the Price section.
6. Quote: should Confirm stay enabled when the total is not computable?
7. The "Removed" group (explicit removals) is hidden when empty. Show it with "None" instead?

## Screenshots

Screenshots at 375 px and 1200 px, in light and dark, are not included: the lab has no browser.
Someone with a browser must produce them from `index.html`.
