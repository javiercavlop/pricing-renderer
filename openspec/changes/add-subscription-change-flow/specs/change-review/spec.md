## ADDED Requirements

### Requirement: Review element is defined
`req~review-element-defined~1`
WHEN `src/element/define-change-review.ts` is imported where `customElements` exists, the package SHALL register the class `PricingChangeReviewElement`, exported from `src/element/index.ts`, under the tag `pricing-change-review`.

Needs: impl, utest

#### Scenario: Registered in the demo page
- **GIVEN** the demo page after it imported `src/element/define-change-review.ts`
- **WHEN** the test reads `customElements.get('pricing-change-review')`
- **THEN** it is the `PricingChangeReviewElement` class exported by `src/element/index.ts`

#### Scenario: Node without custom elements
- **GIVEN** vitest in the node environment, where `globalThis.customElements` is `undefined`
- **WHEN** the test imports `src/element/define-change-review.ts` and calls `definePricingChangeReview()` from `src/element/index.ts`
- **THEN** neither throws and the call returns `PricingChangeReviewElement`

### Requirement: Existing imports do not register the review element
`req~review-define-separate~1`
The modules `src/element/define.ts`, `src/element/index.ts` and `src/react/index.ts` SHALL NOT register `pricing-change-review` when they are imported.

Needs: impl, utest

#### Scenario: Stubbed registry in node
- **GIVEN** vitest in the node environment with `globalThis.customElements` set to a stub whose `define` records tag names and whose `get` returns the recorded class
- **WHEN** the test imports the three modules
- **THEN** the stub recorded `pricing-renderer` and not `pricing-change-review`

### Requirement: Review subpath export
`req~review-define-subpath~1`
The `package.json` SHALL export `./define-change-review` as `{ "types": "./dist/element/define-change-review.d.ts", "default": "./dist/element/define-change-review.js" }`, list `./dist/element/define-change-review.js` in `sideEffects` and include `./define-change-review` in the attw entrypoints of `package:check`.

Needs: impl, utest

#### Scenario: Package manifest
- **GIVEN** `package.json` parsed as JSON
- **WHEN** the test reads `exports`, `sideEffects` and `scripts['package:check']`
- **THEN** the three entries are as stated, and `pnpm package:check` exits with code 0

### Requirement: Tag taken by another class
`req~review-define-conflict~1`
IF the tag `pricing-change-review` is already registered with another constructor, THEN `definePricingChangeReview()` SHALL throw an error whose message names the tag.

Needs: impl, utest

#### Scenario: Foreign constructor
- **GIVEN** a page that registers `class Other extends HTMLElement {}` as `pricing-change-review` and then imports `src/element/index.ts`, which does not register the tag
- **WHEN** it calls `definePricingChangeReview()`
- **THEN** the call throws an error whose message contains `pricing-change-review`

### Requirement: Review properties
`req~review-properties~1`
The `PricingChangeReviewElement` class SHALL declare the properties `comparison`, `notices`, `pending` (attribute `pending`, reflected), `error` (attribute `error`), `locale` (attribute `locale`), `messages` and `confirmLabel` (attribute `confirm-label`) with the types of design.md, Decision 6.

Needs: impl, utest

#### Scenario: Defaults and reflection
- **GIVEN** a new `<pricing-change-review>` appended to the demo page
- **WHEN** the test reads its properties, then sets `pending` to `true` and waits for the update
- **THEN** before the change `comparison` is `undefined`, `notices` equals `[]`, `pending` is `false` and `locale` is `'en-US'`
- **AND** after the change the element has the attribute `pending`

### Requirement: Light DOM
`req~review-light-dom~1`
The `<pricing-change-review>` element SHALL render into its own light DOM, without a shadow root.

Needs: impl, utest

#### Scenario: Review page
- **GIVEN** the review page with `comparison` R_ENT
- **WHEN** the update completes
- **THEN** `element.shadowRoot` is `null` and `element.querySelector('[data-pr-part="review-confirm"]')` is not `null`

### Requirement: Confirm event
`req~review-confirm-event~1`
WHEN the user activates the Confirm button while `pending` is false and `comparison.relation` is not `'current'`, the element SHALL dispatch one `pricing-change-confirm` event that bubbles, is composed and is cancelable, with `detail.comparison` a deep copy of `comparison`.

Needs: impl, utest

#### Scenario: Confirm an upgrade
- **GIVEN** the review page with `comparison` R_ENT and a `pricing-change-confirm` listener that records events
- **WHEN** the user clicks `[data-pr-part="review-confirm"]`
- **THEN** one event is recorded with `bubbles`, `composed` and `cancelable` `true`
- **AND** `detail.comparison` deeply equals `element.comparison` and is not the same object

### Requirement: Confirm default action
`req~review-confirm-pending~1`
WHEN a `pricing-change-confirm` event is not canceled, the element SHALL set `pending` to `true`.

Needs: impl, utest

#### Scenario: Not canceled
- **GIVEN** the review page with `comparison` R_ENT
- **WHEN** the user clicks Confirm
- **THEN** `element.pending` is `true` and the element has the attribute `pending`

#### Scenario: Canceled by the host
- **GIVEN** the review page with `comparison` R_ENT and a `pricing-change-confirm` listener that calls `preventDefault()`
- **WHEN** the user clicks Confirm
- **THEN** `element.pending` is `false`

### Requirement: Confirm is blocked
`req~review-confirm-blocked~1`
WHILE `pending` is true or `comparison.relation` is `'current'`, the element SHALL ignore activations of the Confirm button, dispatching no `pricing-change-confirm`.

Needs: impl, utest

#### Scenario: Double click
- **GIVEN** the review page with `comparison` R_ENT and a `pricing-change-confirm` listener that counts events
- **WHEN** the user clicks Confirm, then the test clicks it again with `click({ force: true })` (it is `aria-disabled` after the first click)
- **THEN** the listener counted 1 event

#### Scenario: Nothing to confirm
- **GIVEN** the review page with `comparison` R_CUR and the same listener
- **WHEN** the test clicks Confirm with `click({ force: true })`
- **THEN** the listener counted 0 events and Confirm has `aria-disabled="true"`

### Requirement: Back event
`req~review-back-event~1`
WHEN the user activates the Back button, the element SHALL dispatch one `pricing-change-back` event that bubbles, is composed and is cancelable, with `detail.comparison` a deep copy of `comparison`, leaving `pending` unchanged.

Needs: impl, utest

#### Scenario: Back to the editor
- **GIVEN** the review page with `comparison` R_ENT and a `pricing-change-back` listener that records events
- **WHEN** the user clicks `[data-pr-part="review-back"]`
- **THEN** one event is recorded with `bubbles`, `composed` and `cancelable` `true` and `detail.comparison` deeply equal to `element.comparison`
- **AND** `element.pending` is `false`

### Requirement: Notices and errors are text
`req~review-text-only~1`
The element SHALL render each entry of `notices` and the `error` value as text, never parsing it as HTML.

Needs: impl, utest

#### Scenario: Markup in a notice and an error
- **GIVEN** the review page with `comparison` R_ENT, `notices` `['<b>Billing</b> starts on 1 Dec']` and `error` `'<img src=x onerror=alert(1)>'`
- **WHEN** the update completes
- **THEN** the `[data-pr-part="review-notices"] li` has the `textContent` `<b>Billing</b> starts on 1 Dec` and contains no `b` element
- **AND** `[data-pr-part="review-error"]` contains the text `<img src=x onerror=alert(1)>` and no `img` element

### Requirement: React review wrapper
`req~review-react~1`
The React entry point SHALL export the component `PricingChangeReview` for the tag `pricing-change-review` with the props of design.md, Decision 6, where `onConfirm` and `onBack` receive `PricingChangeConfirmEvent` and `PricingChangeBackEvent`.

Needs: impl, utest

#### Scenario: Server render and prop types
- **GIVEN** `PricingChangeReview` imported from `src/react/index.ts` in node
- **WHEN** the test calls `renderToString(createElement(PricingChangeReview, { pending: true }))` and type-checks a snippet that passes `onConfirm={(event) => event.detail.comparison.relation}`
- **THEN** the markup contains `<pricing-change-review` and the snippet has no type error

### Requirement: React wrapper registers the element
`req~review-react-registers~1`
WHEN `PricingChangeReview` renders where `customElements` exists, the React wrapper SHALL call `definePricingChangeReview()`.

Needs: impl, utest

#### Scenario: Stubbed registry in node
- **GIVEN** vitest in the node environment with the stub registry of `req~review-define-separate~1` and `src/react/index.ts` imported
- **WHEN** the test calls `renderToString(createElement(PricingChangeReview, {}))`
- **THEN** the stub recorded `pricing-change-review` once

### Requirement: Base parts
`req~review-base-parts~1`
WHILE `comparison` is set, the element SHALL render the part hooks `review-confirm` and `review-back` (buttons), `review-notices` (a list with one `li` per notice, only when `notices` is not empty) and `review-error` (holding the `error` value, only when it is a non-empty string).

Needs: impl, utest

#### Scenario: Notices and error
- **GIVEN** the review page with `comparison` R_ENT, `notices` `['First', 'Second']` and `error` `'Timeout'`
- **WHEN** the update completes
- **THEN** `[data-pr-part="review-confirm"]` and `[data-pr-part="review-back"]` are buttons, `[data-pr-part="review-notices"] li` has two items with the texts `First` and `Second`, and `[data-pr-part="review-error"]` contains `Timeout`
- **AND** Confirm has the text of `pricing.reviewConfirm` (`Confirm change`) and Back the text of `pricing.reviewBack` (`Back`), or Confirm has the `confirmLabel` value when it is set

#### Scenario: Nothing to show
- **GIVEN** the review page with `comparison` R_ENT, `notices` `[]` and no `error`
- **WHEN** the update completes
- **THEN** no `[data-pr-part="review-notices"]` or `[data-pr-part="review-error"]` exists

### Requirement: Review event types
`req~review-event-types~1`
The element entry point SHALL export the types `PricingChangeConfirmDetail`, `PricingChangeBackDetail`, `PricingChangeConfirmEvent` and `PricingChangeBackEvent`, with each detail declaring `comparison: SelectionComparison`.

Needs: impl, utest

#### Scenario: Types through the compiler API
- **GIVEN** a snippet that imports the four types from `src/element/index.ts` and from `src/react/index.ts` and assigns `event.detail.comparison` to a `SelectionComparison`
- **WHEN** a unit test type-checks the snippet with the TypeScript compiler API
- **THEN** it reports no error

### Requirement: Manifest lists the review element
`req~review-manifest~1`
The published `custom-elements.json` SHALL declare `PricingChangeReviewElement` with the tag name `pricing-change-review`, its seven properties and the events `pricing-change-confirm` and `pricing-change-back`.

Needs: impl, utest

#### Scenario: Manifest entry
- **GIVEN** `custom-elements.json` parsed as JSON
- **WHEN** the test reads the `PricingChangeReviewElement` declaration
- **THEN** it has `tagName: 'pricing-change-review'`, field members `comparison`, `notices`, `pending`, `error`, `locale`, `messages` and `confirmLabel`, and the two events

### Requirement: Review structure [pending CRP]
`req~review-ui-structure~1`
The element SHALL render a `section[data-pr-part="change-review"]` labelled by an `h2` with the text of `pricing.reviewTitle` and `tabindex="-1"`, followed by the sections of design.md, Decision 6, in that order, each with an `h3` and rendered only when it has content.

Needs: impl, utest

#### Scenario: Upgrade to Enterprise
- **GIVEN** the review page with `comparison` R_ENT
- **WHEN** the update completes
- **THEN** the `data-pr-part` values of the sections are, in order, `review-plan`, `review-price`, `review-features`, `review-limits` and `review-unchanged`
- **AND** the `h2` has the text `Review your change`

#### Scenario: Downgrade with notices
- **GIVEN** the review page with `comparison` R_START and `notices` `['Your storage above 10 GB will be read-only.']`
- **WHEN** the update completes
- **THEN** the sections are, in order, `review-plan`, `review-price`, `review-add-ons`, `review-features`, `review-limits`, `review-unchanged` and `review-notices`

### Requirement: Plan section [pending CRP]
`req~review-ui-plan~1`
The element SHALL render in `review-plan` the before and after plan names, the text of the relation key, and the version change when `comparison.version.changed` is true.

Needs: impl, utest

#### Scenario: Upgrade and new version
- **GIVEN** the review page with `comparison` R_ENT, then with R_V12
- **WHEN** each update completes
- **THEN** with R_ENT `review-plan` contains `Growth`, `Enterprise` and `Upgrade`
- **AND** with R_V12 it contains `Basic`, `Change` and `Pricing version 1.0 → 2.0`

### Requirement: Price section [pending CRP]
`req~review-ui-price~1`
The element SHALL render in `review-price` the before and after subtotals formatted in their currency, the signed difference when present, and otherwise the text of `pricing.reviewDifferenceQuote` or `pricing.reviewDifferenceCurrency`.

Needs: impl, utest

#### Scenario: Cheaper upgrade
- **GIVEN** the review page with `comparison` R_ENT
- **WHEN** the update completes
- **THEN** `review-price` contains `€80`, `€75` and `-€5`

#### Scenario: Quote
- **GIVEN** the review page with `comparison` R_QUOTE
- **WHEN** the update completes
- **THEN** `review-price` contains `The difference is not shown because part of the price requires a quote.`

### Requirement: Add-ons section [pending CRP]
`req~review-ui-add-ons~1`
The element SHALL render in `review-add-ons` one item per added, removed or quantity-changed add-on, with its name, the text of its change and, for a reconciliation removal, the text of its reason.

Needs: impl, utest

#### Scenario: Removed by the downgrade
- **GIVEN** the review page with `comparison` R_START
- **WHEN** the update completes
- **THEN** `review-add-ons` has two items, which contain `Extra Storage` and `Priority Success`, each with `Removed` and `Not available with Starter`

### Requirement: Features section [pending CRP]
`req~review-ui-features~1`
The element SHALL render in `review-features` one item per gained, lost or changed feature, with its name, the text of its class and, for a changed feature, the before and after values.

Needs: impl, utest

#### Scenario: Audit log lost
- **GIVEN** the review page with `comparison` R_START
- **WHEN** the update completes
- **THEN** `review-features` has one item, which contains `Audit Log` and `Lost`

### Requirement: Limits section [pending CRP]
`req~review-ui-limits~1`
The element SHALL render in `review-limits` one item per changed usage limit, with its name and the before and after values, and the text of `pricing.reviewLimitExceeded` for each limit in `usageLimits.exceeded`.

Needs: impl, utest

#### Scenario: Storage below the current usage
- **GIVEN** the review page with `comparison` R_START
- **WHEN** the update completes
- **THEN** `review-limits` contains `Storage`, `200`, `10` and `Your current usage (150`

#### Scenario: Unlimited
- **GIVEN** the review page with `comparison` R_ENT
- **WHEN** the update completes
- **THEN** `review-limits` contains `Storage`, `200` and `Unlimited`

### Requirement: Unchanged summary [pending CRP]
`req~review-ui-unchanged~1`
The element SHALL render in `review-unchanged` the text of `pricing.reviewUnchangedSummary` with the numbers of unchanged add-ons, features and usage limits.

Needs: impl, utest

#### Scenario: Upgrade to Enterprise
- **GIVEN** the review page with `comparison` R_ENT
- **WHEN** the update completes
- **THEN** `review-unchanged` contains `2 add-ons, 3 features and 0 usage limits stay the same.`

### Requirement: Pending status [pending CRP]
`req~review-ui-status~1`
WHILE `pending` is true, the element SHALL render the text of `pricing.reviewPending` in its `role="status"` region `review-status` and the Confirm button with `aria-busy="true"` and `aria-disabled="true"`.

Needs: impl, utest

#### Scenario: Pending
- **GIVEN** the review page with `comparison` R_ENT
- **WHEN** the host sets `pending` to `true`
- **THEN** `review-status` has the text `Applying your change…` and Confirm has `aria-busy="true"` and `aria-disabled="true"`

#### Scenario: Not pending
- **GIVEN** the review page with `comparison` R_ENT and `pending` `true`
- **WHEN** the host sets `pending` to `false`
- **THEN** `review-status` is empty and Confirm has neither `aria-busy` nor `aria-disabled`

### Requirement: Error region [pending CRP]
`req~review-ui-error~1`
WHILE `error` is a non-empty string, the element SHALL render the text of `pricing.reviewErrorTitle` and the `error` value in its `role="alert"` region `review-error`.

Needs: impl, utest

#### Scenario: Error
- **GIVEN** the review page with `comparison` R_ENT and `pending` `true`
- **WHEN** the host sets `pending` to `false` and `error` to `'Payment method declined'`
- **THEN** `review-error` contains `The change could not be applied.` and `Payment method declined`

### Requirement: Focus on the review heading [pending CRP]
`req~review-ui-focus~1`
WHEN `comparison` changes to an object and the update completes, the element SHALL move focus to its `h2`.

Needs: impl, utest

#### Scenario: Comparison shown
- **GIVEN** the review page without `comparison`
- **WHEN** the host sets `comparison` to R_ENT and the update completes
- **THEN** `document.activeElement` is the element's `h2`

### Requirement: Focus on Confirm after an error [pending CRP]
`req~review-ui-focus-error~1`
WHEN `error` changes to a non-empty string and the update completes, the element SHALL move focus to the Confirm button.

Needs: impl, utest

#### Scenario: Error shown
- **GIVEN** the review page with `comparison` R_ENT after a Confirm click
- **WHEN** the host sets `pending` to `false` and `error` to `'Timeout'`
- **THEN** `document.activeElement` is `[data-pr-part="review-confirm"]`

### Requirement: Forced colors [pending CRP]
`req~review-ui-forced-colors~1`
WHILE forced colors are active, the element SHALL render every section and button with a visible border of at least 1 CSS px.

Needs: impl, utest

#### Scenario: Emulated forced colors
- **GIVEN** the review page with `comparison` R_START and `page.emulateMedia({ forcedColors: 'active' })`
- **WHEN** the test reads the computed `border-top-style` and `border-top-width` of each `section` in the element and of the two buttons
- **THEN** every style is not `none` and every width is at least 1px

### Requirement: Accessibility check [pending CRP]
`req~review-ui-axe~1`
The element SHALL pass the axe check of the delivera-3 definitions with the comparisons R_ENT and R_START, also while `pending` is true and while `error` is set.

Needs: impl, utest

#### Scenario: Four states
- **GIVEN** the review page
- **WHEN** the test runs the axe check with R_ENT, with R_START, with R_START and `pending` `true`, and with R_START and `error` `'Timeout'`
- **THEN** no run reports a `serious` or `critical` violation

### Requirement: Review messages [pending CRP]
`req~review-i18n~1`
The catalogs `enUS` and `esES` SHALL define the 36 keys of the "Review" table of design.md, "i18n keys", with the texts of that table.

Needs: impl, utest

#### Scenario: Every key in both catalogs
- **GIVEN** `enUS` and `esES` imported from `src/core/index.ts` and the table of design.md as a fixture
- **WHEN** the test reads each key
- **THEN** each catalog has exactly the text of its column

#### Scenario: Spanish review
- **GIVEN** the review page with `comparison` R_ENT and `locale` `'es-ES'`
- **WHEN** the update completes
- **THEN** the `h2` has the text `Revisa tu cambio`, Confirm has the text `Confirmar cambio` and Back has the text `Volver`
