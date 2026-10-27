# Phase 0: hygiene and bug fixes from the React/CSS audit

Source: owner request `own-5958ee948b474676b37f6dadb6ab1a38` (13 items, audit of develop `22994d1`).
Plan: `docs/agent-work/phase0-hygiene/intake.md` (base `465e248`). Objectives: O3, O2 and O1 of
`INTENT.md`, as mapped in the intake. Slice S0 of the intake.

`openspec/` does not exist, so the requirements live in this file (D14). Every `file:line` below was
checked again at `2b79e45`; where the intake's lines moved, this file gives the current ones.

## Owner decisions applied

The lead decided the intake questions Q1-Q5 at owner level (2026-10-27). They bind this spec:

- Q1, item 11: yes. Global `HTMLElementEventMap` entries for `pricing-ready`,
  `pricing-selection-change`, `pricing-action` (stays cancelable) and `pricing-diagnostic`.
- Q2, item 5: docs only. `pricingPath`, `pricing-path` and the config key are marked as deprecated
  metadata in the docs. The property stays. No behaviour change and no JSDoc `@deprecated`.
- Q3, item 6: option (a). A human sentence from the catalog, chosen by the category of the first
  error code. Codes and raw messages go in a collapsed `details` with `data-pr-part="diagnostics"`
  and a new label key. X1: the loading label uses `pricing.loading`, and `loadingLabel` still wins.
- Q4, item 9: option B. Without a visible toolbar, the forced `onlyDifferences` value is ignored.
- Q5, item 10: doc precision only. The code does not change.

## Decision log

- D1 (item 1). On a reconnect after the first update, the element observes its size again and
  measures its width once. It calls `reload()` only while `_status` is `loading`. Reason: disconnect
  aborts the load and the observer (`pricing-renderer-element.ts:241-246`), and only `firstUpdated`
  creates them (`:248-261`), so a moved element stays a skeleton. A ready element has nothing to
  resume.
- D2 (item 2). Instance id prefix `pr-<n>`, where `<n>` is the counter that already makes
  `pr-breakdown-<n>` (`:95,197`). The breakdown id does not change. Renderer output without a prefix
  keeps the `pr` prefix of today. Data parts of ids are sanitized with the rule of `renderers.ts:525`
  (`[^\w-]+` to `-`). Reason: ids are global in light DOM. Renderer-only tests such as
  `tests/unit/addon-grid.test.ts:405-407` keep passing. Ids are not a documented hook, so this is not
  a public API change.
- D3 (item 3). The source-check branch (`:309-325`) cancels the load in flight before it applies the
  error. Reason: today it returns before the abort and the sequence bump (`:327-330`), so a stale
  `src` load passes the check at `:349` and emits `pricing-ready` after the error.
- D4 (item 4). `pricing`, `request` and `normalizeOptions` compare structurally. `loadPricing`,
  functions, `Headers`, `AbortSignal` and other class instances compare by identity. Reason: the
  React adapter assigns every prop on each render (`src/react/index.ts:105-108`), and an inline
  `request` object reloads every time (`:267-277`). The exported `deepEqual` sees two `Headers` as
  equal (`src/core/utils.ts:3-5,125-143`), so a new internal helper is needed.
- D5 (item 5). Docs only (Q2). Reason: no code reads `pricingPath` after the constructor
  (`:124,152,203`). The docs already call it metadata (`README.md:180`, `docs/configuration.md:30,36-40`,
  `docs/architecture.md:36`). The owner chose to deprecate it in the docs and keep it.
- D6 (item 6, Q3 option a). One sentence by category, with the codes in a closed `details`. Reason:
  the error state lists English developer `code: message` text (`:1025-1029`). Warnings already use
  the same collapsed pattern (`:1089-1102`).
- D6-X1. The loading heading and status use `pricing.loading` (`src/core/i18n.ts:70,203`). Reason:
  they are hard-coded English (`:995,998`), while `docs/api-reference.md:433` promises "localized".
- D7 (item 7). Fix the layer name in `docs/theming.md:4-6`, and document the summary end padding
  (`src/styles/base.css:1075-1077`). The hooks already listed at `docs/theming.md:88-90` are not
  repeated.
- D8 (item 8). New warning `PR_VALUE_TYPE_MISMATCH`. No coercion. Reason: the YAML 1.2 core schema
  reads `10_000` as a string, and normalize copies values unchanged
  (`normalize.ts:171-172,199-200,209-211`). BOOLEAN-as-text is out of scope.
- D9 (item 9, Q4 option B). Without a toolbar, the forced value is ignored. This is the rule the
  element already applies to the override and the search (`:1047-1059`). Reason: no checkbox exists
  to undo the filter. The exported `resolveOnlyDifferences` (`renderers.ts:119-131`) is not changed.
  The element applies the rule, so `req~shorter-page-auto-default~1` keeps its meaning.
- D10 (item 10, Q5). Doc precision in `docs/api-reference.md:222-224`. Reason: `keptLine`
  (`:532-543`) uses the kept price's quantity and amount. That is the owner-accepted stabilization
  (`delivera-3-price-breakdown/handoff.md:2`). Changing it would change a price computation.
- D11 (item 11, Q1). The augmentation lives in `src/element/events.ts`, next to the event types
  (`:56-59`). Reason: `define.ts:26` re-exports it, so `/define` and `/element` see it.
- D12 (item 12). Only the message changes, by major version. The code, severity and path stay the
  same. Reason: `normalize.ts:65` gives no remedy. Fact (intake, by lookup):
  `pricing4ts/server` exports `retrievePricingFromText`, which upgrades 1.0-3.0 to 3.1 since
  v0.10.3.
- D13 (item 13). A string loader result is measured in UTF-8 bytes against `maxBytes`. An object
  result is not measured. Reason: today only the built-in fetch path checks size
  (`src/yaml/load.ts:61-77` and `:95-102`).
- D14. The spec lives in this file. No feature flag, no ADR.

Decisions taken in this spec:

- S1. Item 8 also checks add-on `usageLimitsExtensions` (`normalize.ts:280`). Reason: they are
  add-on overrides of usage-limit values.
- S2. New catalog keys for item 6, with exact en-US and es-ES text (see the requirement). Reason:
  the catalogs are exported, so the values must be fixed before tests freeze.
- S3. Docs-only items 5, 7 and 10 get `Needs: utest` only, in one doc-content test,
  `tests/unit/phase0-docs.test.ts`. Markdown docs carry no OFT tags in this repository. The intake
  has no test task for these slices. See followups.

## Requirements

### Requirement: Reconnected element resumes

`req~element-reconnect-resumes~1`
WHEN a renderer element whose first update has run is connected to a document again, the element
SHALL resume what the disconnect stopped: it observes its own size with a new `ResizeObserver`,
measures its width once and, while its status is `loading`, calls `reload()`.

Needs: impl, utest

Test: `tests/unit/element-reconnect.test.ts` (browser: `tests/browser/element-reconnect.spec.ts`)

- An element in status `ready` or `error` does not reload on reconnect.
- The first connection is unchanged: `firstUpdated` starts the first load.

#### Scenario: Moved during a load

- **GIVEN** an element with `src` set, whose `loadPricing` has not resolved, and a stub
  `globalThis.ResizeObserver`
- **WHEN** the element is disconnected and then connected again
- **THEN** a new observer's `observe` is called with the element
- **AND** `reload` is called once, and after its loader resolves, one `pricing-ready` is dispatched

#### Scenario: Ready element is moved

- **GIVEN** an element in status `ready`
- **WHEN** it is disconnected and connected again
- **THEN** `observe` is called again, `reload` is not called and no `pricing-ready` is dispatched

### Requirement: Instance-scoped ids

`req~element-instance-ids~1`
The renderer element SHALL give every `id` it renders, except the breakdown id, the prefix
`pr-<n>`, where `<n>` is the number of its instance (for example `pr-2-plans-title`).

Needs: impl, utest

Test: `tests/unit/element-instance-ids.test.ts` (browser: `tests/browser/element-instance-ids.spec.ts`)

- This covers `pr-loading-title`, `pr-title`, `pr-plans-title`, `pr-variables-title`,
  `pr-comparison-title`, `pr-addons-title`, `pr-metadata-title`, `pr-dialog-title`,
  `pr-dialog-description`, and the data ids `pr-variable-<path>`, `pr-group-<group id>` and
  `pr-addon-help-<add-on id>`
  (`renderers.ts:269,382,525,613,620,757,767,938,1145,1163,1305,1478,1523-1530`; element
  `:993-994,1081`).
- Every `aria-labelledby`, `aria-describedby`, `aria-controls` and `for` value points to an id
  with the same prefix.
- The data part of an id is sanitized (`[^\w-]+` becomes `-`), so no id contains a space.
- Renderer output without an instance prefix uses `pr` and keeps today's ids, apart from the
  sanitizing.
- The breakdown keeps `pr-breakdown-<n>` (`req~summary-breakdown-unique-ids~1`).

#### Scenario: Two renderers of one pricing

- **GIVEN** two elements loaded with the same `tests/fixtures/acme-pricing.yml`
- **WHEN** both render
- **THEN** no `id` value appears twice in the combined output
- **AND** every ARIA reference and `for` value resolves to an id inside the same element's output

#### Scenario: Group id with spaces

- **GIVEN** a comparison group with id `Core Features` rendered with prefix `pr-3`
- **WHEN** the group toggle renders
- **THEN** its `aria-controls` is `pr-3-group-Core-Features`, and an element with that id exists

#### Scenario: No prefix keeps the ids

- **GIVEN** the add-on grid render of `tests/unit/addon-grid.test.ts:405-407` with no prefix
- **WHEN** it renders
- **THEN** the output still has `aria-describedby="pr-addon-help-a02"`

### Requirement: Source error cancels the load in flight

`req~reload-source-error-cancels-load~1`
IF `reload()` finds zero or more than one pricing source, THEN the renderer element SHALL cancel the
load in flight, so that the load emits no `pricing-ready` and is not applied after the
`PR_SOURCE_MISSING` or `PR_SOURCE_CONFLICT` error.

Needs: impl, utest

Test: `tests/unit/element-stale-load.test.ts` (browser: `tests/browser/element-stale-load.spec.ts`)

- The `AbortSignal` given to the pending load is aborted.

#### Scenario: src removed during a load

- **GIVEN** an element with `src` set and a `loadPricing` that has not resolved
- **WHEN** `src` is set to `undefined`, `reload()` runs, and then the loader resolves with a valid
  pricing
- **THEN** the element is in the error state with `PR_SOURCE_MISSING`
- **AND** `dispatchEvent` received no `pricing-ready` after the error
- **AND** the loader's `signal.aborted` is `true`

### Requirement: Structural compare of element inputs

`req~element-input-structural-compare~1`
WHEN `pricing`, `request` or `normalizeOptions` is assigned, the renderer element SHALL treat the
assignment as a change only if the new value differs structurally from the previous one.

Needs: impl, utest

Test: `tests/unit/element-input-compare.test.ts`

- Arrays and plain objects (prototype `Object.prototype` or `null`) are compared by content.
  Primitives, functions, `Headers`, `AbortSignal` and other class instances use `Object.is`.
- `loadPricing`, `yaml` and `src` keep the identity compare.
- `reload()` still loads with equal input.
- Documented behaviour change: assigning a structurally equal `pricing` no longer reloads. The
  README React section and `docs/api-reference.md` say to keep `loadPricing` and a `headers`
  function stable (`useCallback`/`useMemo`) and to call `reload()` to force a load.

#### Scenario: Equal inline request

- **GIVEN** a ready element with `src` and `request = { credentials: 'omit', headers: { a: '1' } }`
- **WHEN** `request` is assigned a new object with the same content
- **THEN** the `hasChanged` of `request` returns `false`, and the loader is not called again

#### Scenario: Real changes reload

- **GIVEN** the same ready element
- **WHEN** `request` is assigned, one at a time: `{ headers: new Headers({ a: '1' }) }` after
  `{ headers: new Headers({ a: '1' }) }`, a new `headers` function, a changed nested value
  `{ headers: { a: '2' } }`; or `loadPricing` is a new function
- **THEN** each assignment counts as a change, and the element loads again

### Requirement: pricingPath documented as deprecated metadata

`req~pricing-path-deprecated~1`
The documentation SHALL describe the property `pricingPath`, the attribute `pricing-path` and the
configuration key `pricingPath` as deprecated metadata. The docs say it is kept for compatibility,
has no runtime effect, and leaves the route to the host router.

Needs: utest

Test: `tests/unit/phase0-docs.test.ts`

- Pages: `README.md:168-204`, `docs/configuration.md:11-80`, `docs/architecture.md:36`,
  `docs/vue.md:70`, `docs/i18n.md:18-35`, `docs/api-reference.md:424`, `docs/events.md:190`.
- No code changes. There is no JSDoc `@deprecated`. The config validation, attribute reflection and
  React prop stay as they are.

#### Scenario: Docs say deprecated, code unchanged

- **GIVEN** the docs and `src/`
- **WHEN** the doc test reads `README.md`, `docs/configuration.md` and `docs/api-reference.md`
- **THEN** each one mentions `pricingPath` together with the word `deprecated`
- **AND** no file under `src/` contains `@deprecated`
- **AND** `createPricingRendererConfig({ locale: 'es-es', pricingPath: '/precios/' })` still gives
  `pricingPath` `/precios` (`docs/configuration.md:324-328`)

### Requirement: Human error message

`req~error-state-human-message~1`
WHILE the renderer element is in the error state, the element SHALL render, outside a closed
`details`, only the `pricing.error` heading, one sentence chosen by the category of the first error
diagnostic's code, and, when `src` is set, the retry button.

Needs: impl, utest

Test: `tests/unit/error-state.test.ts`

- Categories, by the code of the first diagnostic with severity `error`:
  - source: codes that start with `PR_SOURCE_`, and `PR_FETCH_UNAVAILABLE`; key
    `pricing.errorSource`;
  - format: codes that start with `PR_YAML_`, and `PR_INPUT_INVALID`; key `pricing.errorFormat`;
  - version: codes that start with `PR_VERSION_`; key `pricing.errorVersion`;
  - generic: any other code, or no error diagnostic; key `pricing.errorGeneric`.
- New catalog keys:
  - `pricing.errorSource`: en-US `The pricing source could not be loaded.`; es-ES
    `No se pudo cargar el origen del pricing.`
  - `pricing.errorFormat`: en-US `The pricing file is not a valid Pricing2Yaml document.`; es-ES
    `El archivo de pricing no es un documento Pricing2Yaml válido.`
  - `pricing.errorVersion`: en-US `This Pricing2Yaml version is not supported.`; es-ES
    `Esta versión de Pricing2Yaml no es compatible.`
  - `pricing.errorGeneric`: en-US `The pricing data has errors.`; es-ES
    `Los datos del pricing tienen errores.`
  - `pricing.errorDetails`: en-US `Technical details`; es-ES `Detalles técnicos`.
- Each diagnostic (`code`, message and path, if any) is listed inside
  `<details class="pr-diagnostics" data-pr-part="diagnostics">` with no `open` attribute. The
  summary is `pricing.errorDetails`.
- Host `messages` overrides apply to the new keys.

#### Scenario: Source error in English

- **GIVEN** an element with locale `en-US` in the error state with `PR_SOURCE_HTTP_ERROR`
- **WHEN** it renders
- **THEN** the text outside `details` contains `The pricing source could not be loaded.` and no
  `PR_` substring
- **AND** a closed `details` with `data-pr-part="diagnostics"` contains `PR_SOURCE_HTTP_ERROR`

#### Scenario: Version error in Spanish

- **GIVEN** locale `es-ES` and a first error `PR_VERSION_UNSUPPORTED_MAJOR`
- **WHEN** the element renders
- **THEN** the visible sentence is `Esta versión de Pricing2Yaml no es compatible.` and the
  summary is `Detalles técnicos`

#### Scenario: Unknown code

- **GIVEN** a first error `PR_PLAN_PRICE_INVALID`
- **WHEN** the element renders
- **THEN** the visible sentence is the value of `pricing.errorGeneric`

### Requirement: Localized loading label

`req~loading-label-localized~1`
WHILE the renderer element is idle or loading, the element SHALL use `loadingLabel` when it is set,
and otherwise `pricing.loading` from its locale and `messages`, for both the hidden heading and the
status text.

Needs: impl, utest

Test: `tests/unit/error-state.test.ts`

#### Scenario: Locale, override and loadingLabel

- **GIVEN** an element in status `loading`
- **WHEN** it renders with locale `es-ES`
- **THEN** the heading and the status both read `Cargando precios…`
- **WHEN** `messages` is `{ 'pricing.loading': 'Un momento' }`
- **THEN** both read `Un momento`
- **WHEN** `loadingLabel` is `Wait`
- **THEN** both read `Wait`

### Requirement: Theming guide matches the stylesheets

`req~theming-layer-docs~1`
The theming guide `docs/theming.md` SHALL describe the cascade layers and the summary end padding
exactly as the shipped stylesheets declare them.

Needs: utest

Test: `tests/unit/phase0-docs.test.ts`

- Layers: structural styles in `pricing-renderer` (`base.css:1`), and token defaults in its
  sublayer `pricing-renderer.theme` (`theme.css:1`).
- The summary `padding-inline-end` (`base.css:1075-1077`) leaves room for the breakdown toggle.
  The guide shows how to override it and keep that room.

#### Scenario: Layer names and padding note

- **GIVEN** `docs/theming.md`
- **WHEN** the doc test reads it
- **THEN** it does not contain `pricing-renderer.base`
- **AND** it names `pricing-renderer` and `pricing-renderer.theme`, and it mentions
  `padding-inline-end` for `.pr-summary`

### Requirement: NUMERIC value given as text

`req~value-type-mismatch-diagnostic~1`
WHEN a feature or usage limit declares `valueType: NUMERIC` and a value for it is a string after
`unwrapValue`, the normalizer SHALL emit one warning `PR_VALUE_TYPE_MISMATCH` for that value, with
the path of that value.

Needs: impl, utest

Test: `tests/unit/value-type-mismatch.test.ts`

- Values checked: `defaultValue`, the plan `features` and `usageLimits`, and the add-on `features`,
  `usageLimits` and `usageLimitsExtensions` (S1).
- Paths: `usageLimits.<id>.defaultValue`, `features.<id>.defaultValue`, `plans.<plan>.<map>.<id>`
  and `addOns.<add-on>.<map>.<id>`.
- A string that matches `^-?\d{1,3}(_\d{3})+(\.\d+)?$` gets a message that mentions YAML 1.1 digit
  separators. It also suggests a plain number or `.inf`.
- The documented unlimited strings `.inf`, `Infinity` and `unlimited` (the set `compare-values`
  uses, matched exactly) are not mismatches and give no warning. JSON hosts cannot write Infinity,
  so they use these strings. This does not apply to `usageLimitsExtensions`, where only a finite
  number counts, so a text there still warns.
- Nothing is coerced. The value stays the same string. `docs/events.md` lists the code.

#### Scenario: Default and plan override

- **GIVEN** inline YAML with usage limit `powerUpsLimit` (`valueType: NUMERIC`,
  `defaultValue: 10_000`) and plan `FREE` with `usageLimits: { powerUpsLimit: '10_000' }`
- **WHEN** it is normalized
- **THEN** there are two `PR_VALUE_TYPE_MISMATCH` warnings, with paths
  `usageLimits.powerUpsLimit.defaultValue` and `plans.FREE.usageLimits.powerUpsLimit`
- **AND** each message mentions digit separators
- **AND** the normalized `defaultValue` is the string `'10_000'`

#### Scenario: Wrapped value and no false positives

- **GIVEN** a NUMERIC override `{ value: 'many' }`, a TEXT feature with `defaultValue: 'abc'`, and a
  NUMERIC limit with `defaultValue: 10000`
- **WHEN** they are normalized
- **THEN** only the wrapped `'many'` gives a warning, and its message has no digit-separator hint

#### Scenario: Documented unlimited strings

- **GIVEN** NUMERIC usage limits with plan overrides `'unlimited'`, `{ value: 'Infinity' }` and
  `'.inf'`, and another override `'many'`
- **WHEN** they are normalized
- **THEN** only `'many'` gives a `PR_VALUE_TYPE_MISMATCH` warning

### Requirement: Forced only-differences needs a visible toolbar

`req~shorter-page-only-differences~2`
The renderer element SHALL expose a tri-state property `onlyDifferences?: boolean`, reflected from
the attribute `only-differences`. While the comparison toolbar is shown, its value is the initial
state of the "Only differences" checkbox. While the toolbar is hidden, the filter is off whatever
the value is.

Needs: impl, utest

Test: `tests/unit/only-differences-forced.test.ts` (re-tag: `tests/unit/shorter-page.test.ts:251`,
`tests/browser/spectra-shorter-page.spec.ts:138,148,180,220`)

- Everything else of revision 1 holds. The conversion is `onlyDifferencesConverter`. A user click
  overrides the state until a reload or a change of the property.
- The exported `resolveOnlyDifferences` is unchanged (D9).

#### Scenario: Forced on, under the threshold

- **GIVEN** a pricing with 2 plans and 20 comparison rows in one group, 5 of them equal for both
  plans, the default threshold 40, and `only-differences=""`
- **WHEN** the element renders
- **THEN** no `data-pr-part="comparison-toolbar"` is rendered, and all 20 comparison rows are
  rendered

#### Scenario: Forced on, over the threshold

- **GIVEN** the ClickUp fixture (174 rows) and `only-differences=""`
- **WHEN** the element renders
- **THEN** the toolbar is shown with the checkbox checked, and no rendered row has the same value
  for every plan (as in revision 1)

### Requirement: Kept-price breakdown documented

`req~breakdown-kept-price-doc~1`
The API reference SHALL state that, in the renderer element, a breakdown line that uses a kept last
valid price takes that price's quantity and amount, so it can add more than 0 to the subtotal.

Needs: utest

Test: `tests/unit/phase0-docs.test.ts`

- The text goes next to the `minQuantity: 0` note (`docs/api-reference.md:222-224`). The code does
  not change, and the tests of `req~breakdown-element-stabilized~1` keep passing.

#### Scenario: Note present

- **GIVEN** `docs/api-reference.md`
- **WHEN** the doc test reads the breakdown section
- **THEN** it contains the phrase `last valid price` in the same list item as `minQuantity: 0`

### Requirement: Typed event map

`req~typed-event-map~1`
The element entry points SHALL declare global `HTMLElementEventMap` entries that map
`pricing-ready`, `pricing-selection-change`, `pricing-action` and `pricing-diagnostic` to
`PricingReadyEvent`, `PricingSelectionChangeEvent`, `PricingActionEvent` and
`PricingDiagnosticEvent`.

Needs: impl, utest

Test: `tests/unit/event-map-types.test.ts`

- Runtime is unchanged. `pricing-action` stays cancelable (`pricing-renderer-element.ts:850`).
- The examples in `docs/events.md` (`:176,200`) drop the `as PricingActionEvent` casts.

#### Scenario: Listener without a cast

- **GIVEN** a snippet that imports `pricing-renderer/define` (and, separately,
  `pricing-renderer/element`) and calls
  `document.createElement('pricing-renderer').addEventListener('pricing-action', (e) => e.detail.actionId)`
- **WHEN** it is type-checked
- **THEN** there are 0 diagnostics
- **AND** the same snippet that reads `e.detail.notAField` has at least 1 diagnostic

### Requirement: Remedy in the unsupported-major message

`req~version-major-upgrade-hint~1`
WHEN the normalizer reports `PR_VERSION_UNSUPPORTED_MAJOR`, it SHALL use a message that names the
way forward for that major version.

Needs: impl, utest

Test: `tests/unit/version-major-message.test.ts`

- Major below 3:
  `Pricing2Yaml major version <N> is not supported. Upgrade the pricing to 3.x on the server, for example with retrievePricingFromText from pricing4ts/server.`
- Major above 3: `Pricing2Yaml major version <N> is not supported yet.`
- Code, severity `error` and path `syntaxVersion` are unchanged. The `docs/events.md:325` row says
  the same.

#### Scenario: 2.1, 1.0 and 4.0

- **GIVEN** pricings with `syntaxVersion` `'2.1'`, `'1.0'` and `'4.0'`
- **WHEN** they are normalized
- **THEN** each gives one error `PR_VERSION_UNSUPPORTED_MAJOR` at `syntaxVersion`
- **AND** the messages for 2 and 1 contain `retrievePricingFromText` and `pricing4ts/server`
- **AND** the message for 4 ends with `is not supported yet.` and does not name pricing4ts

### Requirement: maxBytes for a custom loader

`req~custom-loader-max-bytes~1`
IF a custom `loadPricing` returns a string whose UTF-8 encoding is longer than the effective
`maxBytes`, THEN `loadPricingFromUrl` SHALL return a failed result with the error
`PR_SOURCE_TOO_LARGE` at path `$`, without parsing the string.

Needs: impl, utest

Test: `tests/unit/load-max-bytes.test.ts`

- The effective `maxBytes` is `request.maxBytes` or the default 2 MiB (2,097,152 bytes,
  `load.ts:7`). A string of exactly `maxBytes` bytes is accepted, as in the fetch path (`>`).
- An object result is not measured. `docs/api-reference.md:395` says so.
- The message is the same as the built-in loader's (`load.ts:97`).

#### Scenario: Multi-byte text

- **GIVEN** `maxBytes: 10` and a loader that returns `'ééééé'` followed by `'a'` (6 characters,
  11 bytes)
- **WHEN** `loadPricingFromUrl` runs
- **THEN** the result has `ok: false` and the single diagnostic `PR_SOURCE_TOO_LARGE`
- **WHEN** the loader returns `'ééééé'` (10 bytes)
- **THEN** no diagnostic has code `PR_SOURCE_TOO_LARGE`

#### Scenario: Default limit and object result

- **GIVEN** no `maxBytes`
- **WHEN** the loader returns 2,097,153 ASCII characters
- **THEN** the result fails with `PR_SOURCE_TOO_LARGE`
- **WHEN** the loader returns a pricing object instead
- **THEN** it is normalized with no `PR_SOURCE_TOO_LARGE`

## Revision note: `req~shorter-page-only-differences`

Revision 1 is in `docs/agent-work/spectra-item2-shorter-page/spec.md:18-36`. Revision 2 (above) adds
one condition. While the comparison toolbar is hidden (total rows not above `toolbarThreshold`),
the "Only differences" filter is off, even when `onlyDifferences` is `true`. The meaning changes, so
the revision is bumped. Every `[impl->...~1]` and `[utest->...~1]` tag is outdated until it is
checked and re-tagged (`pricing-renderer-element.ts:97`, `tests/unit/shorter-page.test.ts:251`,
`tests/browser/spectra-shorter-page.spec.ts:138,148,180,220`).

Documented behaviour change (changeset and `docs/api-reference.md:448-452`): a host that set
`only-differences` on a short comparison used to get a filtered table with no way to undo it. It
now gets every row. Over the threshold, nothing changes.

## Risks

- R1. The element chain (items 1-4, 6, 9) waits for spectra-item9-tags S2. Waves A to C run
  meanwhile.
- R2. Lifecycle and DOM behaviour (items 1-3) are fully proven only by Playwright in CI. Node tests
  cover what they can. For item 1, G3 may need the coordinator's exception.
- R3. Item 4: hosts that reassign an equal object to force a fetch must call `reload()`. Comparing a
  large `pricing` object costs time; the perf reviewer checks the largest fixture. A cyclic plain
  object is not supported by the compare.
- R4. Item 13: a custom loader that returns more than 2 MiB of text now fails. The changeset and
  docs name `request.maxBytes`.
- R5. Item 8 can add warnings to existing fixtures, so the diagnostics `details` shows on pages that
  had none. Snapshots and baselines are not edited without review.
- R6. Item 11: a global augmentation can clash with another library's events of the same names. The
  `pricing-` prefix lowers that risk; the owner accepted it (Q1).
- R7. Item 9: the re-tags are in files that intake slice P0-09 does not own (see the revision note).
- R8. Item 5: `docs/api-reference.md:424` and `docs/events.md:190` are owned by other slices, not
  P0-05. Item 11: the casts in `docs/configuration.md:224` and `docs/change-subscription-flow.md:351`
  stay valid but are outside P0-11's files.
- R9. Item 6 changes the visible error text and adds five keys to the exported catalogs. Hosts that
  read the old `code: message` list in the page lose it from the visible text (it stays in `details`
  and in `pricing-diagnostic`).

## Out of scope

- BOOLEAN or other value types given as text (item 8).
- A JSDoc `@deprecated` or any runtime change for `pricingPath` (item 5).
- Changing the stabilized breakdown amount (item 10).
- Adding pricing4ts as a dependency (item 12).
- Measuring object results of a custom loader (item 13).
