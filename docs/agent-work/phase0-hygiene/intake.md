# Intake: phase 0, hygiene and bug fixes from the React/CSS audit

- Origin: owner request `own-5958ee948b474676b37f6dadb6ab1a38` (audit of develop `22994d1`). The inbox
  file is not in this worktree; this plan uses the request text of the task contract. Planner intake,
  2026-10-27.
- Base: `465e248` (HEAD of task branch `task/c45e4ae15f014d13`). Every `file:line` below is at this
  base. The line numbers in the request match this base for both element files.
- INTENT links: O3 "a stable public API and package across the integrations" (items 1-6, 9, 11-13),
  O2 "accessibility and visual-regression guards" (items 2, 6), O1 (items 8, 12: real SPHERE and
  SPECTRA pricings).
- No release: every code slice adds a pending changeset; nobody versions or publishes.
- Lab limits: Playwright is not available in the lab. Browser specs are written in the slices and run
  only in CI (the `quality` job and the chromium shards on the PR). Unit tests run in the vitest
  `node` environment (`vitest.config.ts:5`), so there is no DOM. Element tests use the pattern of
  `tests/unit/reveal-focus.test.ts:31-38`: build the element in node and call its methods with
  stand-ins.

## Verification per item

Status: R = reproduces, P = partly reproduces, N = does not reproduce.

- Item 1, reconnect. **R.** `disconnectedCallback` disconnects the observer and aborts the load
  (`src/element/pricing-renderer-element.ts:209-214`). Only `firstUpdated` creates the
  `ResizeObserver` and starts the first `reload()` (`:216-229`), and `firstUpdated` runs once per
  instance. An aborted load returns before `_applyLoadResult` (`:299-301`), so `_status` stays
  `'loading'` (`:281`), and `render()` keeps the skeleton (`:922-935`). `connectedCallback`
  (`:203-207`) neither observes nor reloads again.
- Item 2, global ids. **R, wider than reported.** The element renders in light DOM
  (`:199-201`). These ids are fixed:
  - `pr-loading-title` (`pricing-renderer-element.ts:924-925`) and `pr-title`
    (`renderers.ts:254`, referenced at `pricing-renderer-element.ts:1005`);
  - `pr-plans-title` (`renderers.ts:303,307,316`), `pr-variables-title` (`:561,563`),
    `pr-comparison-title` (`:861,867`), `pr-addons-title` (`:1220,1224`), `pr-metadata-title`
    (`:1369-1370`), `pr-dialog-title` and `pr-dialog-description` (`:1415-1416,1421-1422`);
  - ids built from data, which also collide when the same pricing renders twice:
    `pr-variable-<path>` (`:475,570,584`), `pr-group-<group id>` (`:693,701`; a group id with
    spaces breaks `aria-controls`, item9 intake R5) and `pr-addon-help-<id>` (`:1064,1082`).
  - The breakdown already has an instance id (`pricing-renderer-element.ts:90,180`,
    `req~summary-breakdown-unique-ids~1`).
  - `tests/unit/addon-grid.test.ts:405-407` asserts `pr-addon-help-<id>`. The item 7 spec names it
    (`docs/agent-work/spectra-item7-addon-grid/spec.md:54`).
- Item 3, stale load after a failed source check. **R.** When `sources.length !== 1`, `reload()`
  applies the error and returns at `:259-275`, before the abort and the sequence bump (`:277-280`). A
  `src` load still in flight passes the check at `:299` and emits `pricing-ready` after the
  `PR_SOURCE_MISSING`/`PR_SOURCE_CONFLICT` error. Recorded earlier in
  `docs/agent-work/delivera-2-load-current-contract/handoff.md:1` and
  `docs/agent-work/delivera-4-events-integration-docs/handoff.md:6`.
- Item 4, inline objects reload. **R.** `updated()` reloads when `pricing`, `yaml`, `src`,
  `request`, `loadPricing` or `normalizeOptions` changed (`:235-245`). Lit compares with
  `Object.is` by default, and the static properties declare no `hasChanged` (`:101-126`). The React
  adapter sets every prop on the element on each render (`src/react/index.ts:26-36,95-101`), so
  `request={{ headers }}` makes a new object, a reload and a new fetch on every parent render.
  - Extra finding: the exported `deepEqual` (`src/core/utils.ts:125-143`) treats any non-array
    object as a record (`utils.ts:3-5`). Two different `Headers` instances have no own keys, so
    `deepEqual(new Headers({a: '1'}), new Headers({a: '2'}))` is `true`, and a real change of
    `request.headers` would be missed. The core `deepEqual` cannot be used as it is (decision D4).
- Item 5, `pricingPath`. **P.** No code reads the property after the constructor
  (`pricing-renderer-element.ts:113,139,186`; it is only reflected as an attribute). The only check is
  the config validation (`src/core/config.ts:24-35,64-65`). But the docs do not promise any
  behaviour. They call it metadata the host router can read (`README.md:178-179`,
  `docs/configuration.md:30,36-40`, `docs/architecture.md:36`), and `docs/events.md:128-129` says it
  has no effect on `pricing-action`. Nothing is wrong in the docs; the owner prefers to deprecate the
  property in the docs and keep it.
- Item 6, raw codes in the error UI. **R.** The error state lists `code: message` for every
  diagnostic (`pricing-renderer-element.ts:957-959`). The messages are English developer text from
  `normalize.ts`/`load.ts`, not catalog strings. The warning list is already in a collapsed
  `details` (`:1013-1026`).
  - Extra finding X1: the loading state shows a hard-coded English `'Loading pricing'` /
    `'Loading pricing…'` (`:926,929`), although the catalog has `pricing.loading` (en and es,
    `src/core/i18n.ts:69,153`) and `docs/api-reference.md:344` says the default is "localized".
- Item 7, theming doc. **R (layer name); the part hooks are already done.** `docs/theming.md:5` says
  `pricing-renderer.base`. `src/styles/base.css:1` declares `@layer pricing-renderer` and
  `src/styles/theme.css:1` declares `@layer pricing-renderer.theme`. The breakdown hooks are already
  listed (`docs/theming.md:88-89`). The summary end padding that leaves room for the toggle
  (`base.css:1019-1021`) is not documented
  (`docs/agent-work/delivera-3-price-breakdown/handoff.md:2,4`).
- Item 8, NUMERIC value as text. **R.** The parser uses the YAML 1.2 `core` schema
  (`src/yaml/parser.ts:30-36`), so `10_000` is the string `'10_000'`. Normalize copies `valueType`
  and `defaultValue` as they are (`normalize.ts:171-172,199-200`) and plan/add-on values unchanged
  (`normalizeValueMap`, `normalize.ts:209-211,223-224,278-279`). It emits no diagnostic.
  `PR_VALUE_TYPE_MISMATCH` does not exist (grep: no match). Fixtures: only `trello/2024.yml` and
  `shopify/2022.yml` exist, and the Trello value was already replaced by `.inf`
  (`tests/fixtures/spectra/README.md:38-43`). No Shopify 2025 or Trello 2021-2023 snapshot is in the
  repository, so the tests need inline YAML.
- Item 9, forced only-differences without toolbar. **R.** `resolveOnlyDifferences` returns an
  explicit `initial` first (`renderers.ts:104-116`). The element ignores the user override and the
  search while the toolbar is hidden (`pricing-renderer-element.ts:978-988`), but not the forced
  value. `filterGroups` then filters (`renderers.ts:611`) with no checkbox on the page. The item 2
  spec says an explicit `initial` wins (`docs/agent-work/spectra-item2-shorter-page/spec.md:52-53`),
  so this is a spec gap and needs a new revision.
- Item 10, breakdown "adds 0" note. **R (doc precision).** `docs/api-reference.md:222-224` says a
  `minQuantity: 0` add-on selected at quantity 0 adds 0. In the element, when that add-on's price
  expression fails and a last valid price exists, `keptLine` replaces the line with the kept price's
  own quantity and amount (`pricing-renderer-element.ts:482-526`). That amount is added to the
  subtotal. The kept price was resolved at quantity 1 or more, so the line does not add 0. This is
  `R2-REV-001` of `delivera-3-price-breakdown/handoff.md:4`. It is not the `R2-REV-001` of ci-speed
  (`docs/agent-work/prop-20261027-3/intake.md:54-56`).
- Item 11, typed event map. **R.** Only `HTMLElementTagNameMap` is declared
  (`src/element/index.ts:15-19`). There is no `HTMLElementEventMap` entry. The docs cast:
  `(event as PricingActionEvent)` (`docs/events.md:114,138`). `define.ts:26` re-exports
  `./events.js` types, so a `declare global` in `events.ts` reaches the `/define`, `/element` and
  `/react` entries.
- Item 12, 2.x message. **R.** `normalize.ts:60-69` says only "Pricing2Yaml major version N is not
  supported.". `docs/events.md:257` says "Convert the pricing or pass a syntax adapter". Fact checked
  by lookup (deep, confidence medium): `pricing4ts/server` exports
  `retrievePricingFromText(stringifiedPricing: string, yamlPath?: string): Pricing`. It upgrades
  1.0, 1.1, 2.0, 2.1 and 3.0 documents to 3.1 and was added in pricing4ts v0.10.3. Sources:
  https://github.com/Alex-GF/Pricing4TS/releases/tag/v0.10.3,
  https://raw.githubusercontent.com/Alex-GF/Pricing4TS/main/src/server/server.ts,
  https://raw.githubusercontent.com/Alex-GF/Pricing4TS/main/src/server/utils/version-manager.ts.
  pricing4ts is not a dependency of this package (`package.json`), so the text only points to it.
- Item 13, `maxBytes` for a custom loader. **R.** With `loadPricing`, the result is parsed or
  normalized with no size check (`src/yaml/load.ts:61-77`). Only the built-in fetch path checks
  `content-length` and the body (`:95-102`). The loader receives `maxBytes` in `request`
  (`:65-69`, `src/yaml/types.ts:16-24`). `docs/api-reference.md:308` documents `maxBytes` with no
  exception.

No item fails to reproduce. Item 5 is "P" because the docs are already accurate. Item 7 is half done.

## Decisions taken in this intake

The spec slice (S0) may refine these and records any change with its reason.

- D1 (item 1). On a reconnect (`connectedCallback` when `hasUpdated` is true), the element creates
  and observes a `ResizeObserver` again through a helper shared with `firstUpdated`, and measures its
  width once. If `_status === 'loading'` (the load was aborted on disconnect), it calls `reload()`. A
  ready element does not reload on reconnect. `firstUpdated` keeps the first load.
- D2 (item 2). Every element id gets the instance prefix `pr-<n>-` from the counter that already
  makes `pr-breakdown-<n>`. The breakdown id stays as it is (`req~summary-breakdown-unique-ids~1`).
  `RenderState` (internal, not exported by any package entry, `package.json:32-57`) gets an optional
  `idPrefix?: string`; absent means `'pr'`. Existing renderer-only tests keep their ids, so
  `addon-grid.test.ts:405-407` passes unchanged. Data parts of ids (variable path, group id, add-on
  id) are sanitized with the rule of `renderers.ts:570`, which also fixes the group-id-with-spaces
  issue (item9 R5). The ids are not documented as hooks (`docs/theming.md:95` says markup is not a
  contract), so this is not a public API change.
- D3 (item 3). In the failed source-check branch, abort the controller, clear it and bump
  `_loadSequence` before `_applyLoadResult`. A later `pricing-ready` of the stale load is never
  emitted.
- D4 (item 4). `pricing`, `request` and `normalizeOptions` get a Lit `hasChanged` that compares
  structurally: arrays and plain objects (prototype `Object.prototype` or `null`) by content;
  functions, `Headers`, `AbortSignal`, other class instances and primitives with `Object.is`. The
  helper is new and internal (`src/element/same-input.ts`). The exported `deepEqual` is not used or
  changed (extra finding of item 4). `loadPricing` stays by identity. README's React section and the
  API reference say: wrap `loadPricing` and a `headers` function in `useCallback`/`useMemo`, and call
  `reload()` to force a load with equal input. Documented behaviour change: assigning a structurally
  equal `pricing` no longer reloads.
- D5 (item 5). Docs only, no behaviour change (the owner's preference). The docs mark `pricingPath` /
  `pricing-path` / the config key as deprecated metadata, kept for compatibility, and say the host
  router owns the route. Whether to add a JSDoc `@deprecated` to the typings is Q2 (it shows in
  editors, so it is public API).
- D6 (item 6). Recommended, pending Q3: the error state shows `pricing.error` and one human sentence
  from new catalog keys, picked by the code of the first error: source/network (`PR_SOURCE_*`,
  `PR_FETCH_UNAVAILABLE`), format (`PR_YAML_*`, `PR_INPUT_INVALID`), version (`PR_VERSION_*`), or
  generic. The codes and messages move into a collapsed `details` with the existing hook
  `data-pr-part="diagnostics"` and a new label key. X1 (the localized loading label) goes into the
  same slice because it edits the same `render()` states.
- D7 (item 7). Fix `docs/theming.md:5`: structural styles live directly in the `pricing-renderer`
  layer and the token defaults in its sublayer `pricing-renderer.theme`. Add the summary end-padding
  note with the override, and do not repeat the hooks that are already listed.
- D8 (item 8). New warning `PR_VALUE_TYPE_MISMATCH`, emitted by normalize when a feature or usage
  limit has `valueType: NUMERIC` and a value after `unwrapValue` is a string. This covers
  `defaultValue` and the plan and add-on overrides. The path names the value, for example
  `usageLimits.powerUpsLimit.defaultValue` or `plans.FREE.usageLimits.powerUpsLimit`. When the text
  looks like a number with `_` separators, the message hints at YAML 1.1 digit separators and
  suggests a plain number or `.inf`. Nothing is coerced. BOOLEAN-as-text is out of scope (followup).
- D9 (item 9). Recommended, pending Q4: option B. Without a toolbar the forced value is ignored, the
  same rule the element already applies to the override and the search (`:978-988`). Option A shows
  the toolbar when the filter is forced on. Either way `req~shorter-page-only-differences` gets
  revision 2 in this change's spec.
- D10 (item 10). Docs only: `api-reference.md:222-224` adds that in the element a line that uses a
  kept last valid price takes that price's quantity and amount, so it can add more than 0. The code
  stays: the delivera-3 decision D3 "breakdown follows stabilization" is owner-accepted
  (`delivera-3-price-breakdown/handoff.md:2`). Changing the amount would change a price computation
  (risk area), so that option goes to the owner only if Q5 asks for it.
- D11 (item 11). Add `declare global { interface HTMLElementEventMap { ... } }` for the four events
  in `src/element/events.ts`, with the existing event types. `pricing-action` stays cancelable. The
  docs examples drop the casts.
- D12 (item 12). For major versions below 3, the message says to upgrade the pricing to 3.x on the
  server, for example with `retrievePricingFromText` from `pricing4ts/server`. For majors above 3 it
  says the version is not supported yet. The code and severity do not change; only the message and
  `docs/events.md:257` do.
- D13 (item 13). A string returned by `loadPricing` is measured in UTF-8 bytes
  (`TextEncoder().encode(text).byteLength`) and over `maxBytes` gives `PR_SOURCE_TOO_LARGE`, the
  built-in loader's code. An object result is not measured (no defined byte size), and the docs say
  so. This changes behaviour for hosts whose loader returns more than 2 MiB of text: they must raise
  `request.maxBytes`.
- D14. Spec location: `openspec/` does not exist at this base. As in items 2 to 9, the requirements go
  in `docs/agent-work/phase0-hygiene/spec.md` (S0). There is no feature flag: every slice is one
  small, independently revertable capability. No ADR: no new architecture or dependency.

## Requirements (S0 writes them; final ids from the coordinator)

`req~element-reconnect-resumes~1` (1), `req~element-instance-ids~1` (2),
`req~reload-source-error-cancels-load~1` (3), `req~element-input-structural-compare~1` (4),
`req~pricing-path-deprecated~1` (5), `req~error-state-human-message~1` (6),
`req~loading-label-localized~1` (X1), `req~theming-layer-docs~1` (7),
`req~value-type-mismatch-diagnostic~1` (8), `req~shorter-page-only-differences~2` (9),
`req~breakdown-kept-price-doc~1` (10), `req~typed-event-map~1` (11),
`req~version-major-upgrade-hint~1` (12), `req~custom-loader-max-bytes~1` (13).

## Checks used below

Registered set (indexes from the coordinator): `C-install` `["pnpm", "install", "--frozen-lockfile"]`,
`C-type` `["pnpm", "typecheck"]`, `C-lint` `["pnpm", "lint"]`, `C-test` `["pnpm", "test"]`,
`C-format` `["pnpm", "format:check"]`. A red-before check per test slice has this form (G3, timeout
300; the pattern must match the assertion style the test uses):

`{"argv": ["pnpm", "exec", "vitest", "run", "<test file>"], "type": "red_before", "expect_exit": [1], "expect_pattern": "AssertionError|expected", "overlay": ["<test file>"]}`

Docs-only slices run `C-install`, `C-format` and `C-test` (`tests/unit/docs-examples.test.ts` reads
the docs). Every code slice runs all five. Browser specs added by a slice run in CI only. The PR of
each slice is green only when the CI `quality` job and the chromium shards pass on its head.

## Slices

Each code item is a test-designer task (T, owns only its new test files, red-before) and then an
implementer task (I, runs the frozen test, G4). One item, one PR into develop. T and I of one item
are not merged apart. Every I adds a changeset in the style of `.changeset/spectra-addon-marker.md`:
patch for fixes, minor for new public surface (items 6, 8, 11).

### S0: spec (specifier, turn budget 35)

- Owns `docs/agent-work/phase0-hygiene/spec.md`. Content: the requirements above in EARS form with
  scenarios from the facts above, D1-D14, and the revision note of `req~shorter-page-only-differences`.
  Items 6 and 9 are written after Q3/Q4; S0 can land in two passes.
- Risk low (0, docs). Checks: `C-install`, `["pnpm", "exec", "prettier", "--check",
  "docs/agent-work/phase0-hygiene/spec.md"]`. Depends on nothing.

### Wave A: start now (no file of the in-flight spectra-item9-tags S2)

- P0-07 theming docs. doc-steward, budget 20. Owns `docs/theming.md`. Read-only: `base.css:1,1011-1024`,
  `theme.css:1`. Risk low (0). Depends on S0.
- P0-12 version hint. T owns `tests/unit/version-major-message.test.ts` (normalize with
  `syntaxVersion: '2.1'`, `'1.0'` and `'4.0'`; message content; code and severity unchanged; red
  before). I owns `src/core/normalize.ts`, `docs/events.md`, `docs/pricing2yaml-compatibility.md`,
  `.changeset/phase0-version-hint.md`. Budget 25/30. Risk low (0: message text, no API or
  computation). Depends on S0.
- P0-13 loader cap. T owns `tests/unit/load-max-bytes.test.ts` (string over and under `maxBytes`
  with multi-byte characters, the default 2 MiB, object result not capped, existing
  `tests/unit/load.test.ts` untouched; red before). I owns `src/yaml/load.ts`, `docs/api-reference.md`,
  `.changeset/phase0-loader-max-bytes.md`. Budget 25/30. Risk medium (5: external input +2,
  public behaviour change +3). Depends on S0.
- P0-05 `pricingPath` deprecation. doc-steward, budget 20. Owns `README.md`, `docs/configuration.md`,
  `docs/architecture.md`, `docs/vue.md`, `docs/i18n.md`, and with Q2 = JSDoc also
  `src/react/index.ts`. Risk low (0) as docs only; medium (3) if Q2 adds JSDoc `@deprecated`.
  Depends on S0 and Q2.

### Wave B: after the wave A slice that owns the same file is merged

- P0-11 typed event map (after P0-12, shares `docs/events.md`). T owns
  `tests/unit/event-map-types.test.ts`: type-check snippets with the `typeCheckSnippet` helper
  pattern of `tests/unit/breakdown-types.test.ts:7-30`. `addEventListener('pricing-action', (e) =>
  e.detail.actionId)` on `document.createElement('pricing-renderer')`, imported through `/define` and
  `/element`, has no diagnostics; a wrong detail field has one; red before on the diagnostics count.
  I owns `src/element/events.ts`, `docs/events.md`, `.changeset/phase0-typed-events.md` (minor).
  Budget 30/25. Risk medium (3: public types). Depends on Q1.
- P0-10 kept-price note (after P0-13, shares `docs/api-reference.md`). doc-steward, budget 15. Owns
  `docs/api-reference.md`. Risk low (0). Depends on Q5 only if the owner wants the code option.

### Wave C

- P0-08 value-type diagnostic (after P0-12 for `normalize.ts` and P0-11 for `docs/events.md`). T owns
  `tests/unit/value-type-mismatch.test.ts`: inline YAML with `defaultValue: 10_000` under
  `valueType: NUMERIC`, a plan override `'10_000'`, the `{ value: ... }` form, a TEXT feature with
  text (no warning), a real number (no warning), the value left uncoerced, the path and the hint;
  red before. I owns `src/core/normalize.ts`, `docs/events.md`,
  `docs/pricing2yaml-compatibility.md`, `.changeset/phase0-value-type-mismatch.md` (minor).
  Budget 35/35. Risk medium (5: external input +2, new documented diagnostic code +3). If an
  existing fixture test (`spectra-load.test.ts`, `ux-stress-fixtures.test.ts`) now sees a new
  warning, the implementer reports it and does not edit those tests.

### Element chain: strictly in this order, after spectra-item9-tags S2 is merged

All of these own `src/element/pricing-renderer-element.ts`, and P0-02/P0-09 also own
`src/element/renderers.ts`, so they never run in parallel with each other or with item9 S2.

1. P0-03 stale load. T owns `tests/unit/element-stale-load.test.ts` (node instance: `src` with a
   pending `loadPricing`, then `src = undefined` and `reload()`, then resolve; spy on
   `dispatchEvent`; no `pricing-ready` after the error; red before) and
   `tests/browser/element-stale-load.spec.ts` (CI). I owns the element file and
   `.changeset/phase0-stale-load.md`. Budget 30/25. Risk low (1: concurrency).
2. P0-01 reconnect. T owns `tests/unit/element-reconnect.test.ts` (node instance with a stub
   `globalThis.ResizeObserver`: disconnect during a load, reconnect, `observe` called again and
   `reload` called; ready element not reloaded) and `tests/browser/element-reconnect.spec.ts` (CI:
   move the element to another parent during a slow `src`, it leaves the skeleton; resize after the
   move switches the layout). If the node lifecycle cannot be driven without a DOM, T reports it and
   the browser spec is the acceptance. G3 is then not provable in the lab, and the coordinator
   records that exception. I owns the element file and `.changeset/phase0-reconnect.md`. Budget
   35/30. Risk low (1: concurrency).
3. P0-04 structural input compare (after P0-05 for `README.md`). T owns
   `tests/unit/element-input-compare.test.ts` (the `hasChanged` of each property; equal inline
   objects do not reload; different `Headers`, a new `headers` function, a new `loadPricing` and a
   changed nested value do; red before). I owns the element file, `src/element/same-input.ts`
   (new), `README.md`, `docs/api-reference.md`, `.changeset/phase0-input-compare.md`. Budget 30/35.
   Risk medium (4: public behaviour +3, caching +1). The perf reviewer checks the compare cost on the
   largest fixture.
4. P0-02 instance ids. T owns `tests/unit/element-instance-ids.test.ts` (renderers with two
   prefixes give disjoint ids; each `aria-labelledby`/`aria-describedby`/`aria-controls`/`for` value
   resolves to an id in the same output; no id has a space; without `idPrefix` the ids are as today;
   red before) and `tests/browser/element-instance-ids.spec.ts` (CI: two renderers on a page, no
   duplicate ids, axe `duplicate-id-aria` clean, the dialog and add-on help still announced). I owns
   the element file, `src/element/renderers.ts`, `.changeset/phase0-instance-ids.md`. Budget 35/35.
   Risk low (1: two files of one module, about 60-90 lines). ui-qa: screen reader names of the plan
   radio group, the dialog and the add-on details.
5. P0-09 forced only-differences. Depends on Q4. T owns `tests/unit/only-differences-forced.test.ts`
   (20 rows, `onlyDifferences: true`, default threshold: option B shows all rows and no toolbar;
   option A shows the toolbar with the box checked; 41+ rows unchanged; red before). I owns the
   element file, plus `src/element/renderers.ts` for option A, `docs/api-reference.md` (shorter page
   section `:352-381`), `.changeset/phase0-only-differences.md`. Budget 25/25. Risk medium (3:
   public behaviour of an attribute).
6. P0-06 human error state and X1. Depends on Q3. T owns `tests/unit/error-state.test.ts` (node
   instance with `_status = 'error'` and diagnostics, render flattened as in
   `tests/unit/shorter-page-fixtures.test.ts`: the visible text has no `PR_` code, the sentence
   comes from the catalog in en and es, the codes are inside a closed `details`; the loading state
   uses `pricing.loading` and `loadingLabel` still wins; red before). I owns the element file,
   `src/core/i18n.ts`, `docs/i18n.md`, `docs/api-reference.md` (i18n keys),
   `.changeset/phase0-error-state.md` (minor). Budget 35/35. Risk medium (4: exported catalogs +3,
   two modules +1). ui-qa at 375 and 1440, light, dark, forced colors, RTL.

## Gates

- G1: change-level, with the `docs/agent-work/<id>/spec.md` convention while `openspec/` is absent.
- G2 EPIC: on S0.
- G3 red-before: every T task, with the check form above. The exception is P0-01 if the node
  lifecycle cannot be tested; it then needs the coordinator's record.
- G4: the coordinator freezes each T test before its I.
- G6 trace: `utest` tags in T and `impl` tags in I.
- G9: N/A, no dependency.
- G11 review: one reviewer for low risk; for medium risk, the panel plus a clean-context review.
- G12 ui-qa: P0-02, P0-06, P0-09.
- G13 how-to-test: one guide per PR with a user-visible change (P0-01, P0-02, P0-03, P0-04, P0-06,
  P0-09). Docs-only PRs get a how-to-review.

## Risks

- R1. The element chain waits for item9 S2. Mitigation: waves A to C run meanwhile.
- R2. Element lifecycle and DOM behaviour can only be proven by Playwright in CI. Mitigation: node
  tests where possible, a browser spec per element slice, and a CI run on each PR head before merge.
- R3. D4 changes when the element reloads. Hosts that reassign an equal object to force a fetch must
  call `reload()`. Mitigation: changeset text and docs.
- R4. D13 can turn a working custom loader above 2 MiB into an error. Mitigation: changeset and docs
  name `request.maxBytes`.
- R5. P0-08 may add warnings on existing fixtures, so the diagnostics `details` appears on pages that
  had none. Mitigation: the implementer reports the affected fixtures; no snapshot or baseline is
  edited without review.
- R6. A global `HTMLElementEventMap` augmentation can conflict with another library that declares
  the same event names with other types. Mitigation: the names have the `pricing-` prefix; Q1.

## Open questions

One CRP to the owner (public API or visual defaults):

- Q1 (item 11): confirm the global `HTMLElementEventMap` entries for the four events (the owner asked
  for them; this only confirms the global scope, R6). Recommended: yes.
- Q2 (item 5): docs only (recommended, the owner's stated preference), or docs plus JSDoc
  `@deprecated` on the element property, the React prop and the config key.
- Q3 (item 6): (a) human sentence by category, codes in a collapsed `details` (recommended); (b)
  human sentence only, codes only in `pricing-diagnostic` events; (c) keep the current list.
- Q4 (item 9): (A) show the toolbar when the filter is forced on; (B) ignore the forced value without
  a toolbar (recommended, same rule as the override and the search).
- Q5 (item 10): doc precision (recommended), or change the element so a quantity-0 line always adds
  0 (price computation, higher risk).

For the coordinator:

- Q6. Register the five checks and the red-before checks with indexes; assign the requirement ids.
- Q7. Compare this plan with the inbox file once it is available.
