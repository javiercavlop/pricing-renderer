# Tasks: add-subscription-change-flow

Rules for every slice:

- At most 300 diff lines (hard limit). A slice that grows beyond it is split before review, by
  requirement group.
- Slices that may run at the same time own disjoint files. A file listed in two slices is touched
  only in the stated order, after the earlier slice is merged.
- Tests are written first by test-designer and fail before the implementation (red before).
- Every requirement id is traced: `[impl->req~…~1]` in code, `[utest->req~…~1]` in tests.
- No phase starts before the owner decision named in its heading (design.md, "Decisions pending").
  Only phase F also waits for the CRP with a mock.
- No feature flag is needed: all new behaviour is reached only through new functions, new
  subpaths, a new element or properties that are unset by default.

Checks (the planner registers them; names are the commands):

- `typecheck`: `["pnpm", "typecheck"]`
- `lint`: `["pnpm", "lint"]`
- `format`: `["pnpm", "format:check"]`
- `unit`: `["pnpm", "test"]`
- `browser`: `["pnpm", "test:browser"]`, including the responsive visual tests run against the
  committed baselines without `--update-snapshots`
- `package`: `["pnpm", "package:check"]`
- `spec`: `["openspec", "validate", "add-subscription-change-flow", "--strict"]`

## Phase A: selection-comparison (after D1, D2, D3)

Tests (test-designer). Shared inline fixtures go in A0a and the later files import them.

- [x] A0a Plan, relation and add-on tests.
  - Files: `tests/unit/helpers/compare-fixtures.ts` (V1, V2, V2U, F, the `Side` and `cmp` helpers) and
    `tests/unit/compare-addons.test.ts`. Requirements: `req~compare-plan~1`,
    `req~compare-relation-*`, `req~compare-addons-*` and `req~compare-selections-output~1`.
  - Checks: `unit` red before, `lint`.
- [x] A0b Effective values and usage tests.
  - Files: `tests/unit/compare-values.test.ts`. Requirements: `req~compare-effective-*`,
    `req~compare-features~1`, `req~compare-limit-*`, `req~compare-limits~1` and
    `req~compare-current-usage*`.
  - Checks: `unit` red before, `lint`. After A0a.
- [x] A0c Price, version, diagnostics and contract tests.
  - Files: `tests/unit/compare-contract.test.ts` and `tests/unit/compare-types.test.ts`
    (compiler API, as in `tests/unit/breakdown-types.test.ts`). Requirements:
    `req~compare-price-*`, `req~compare-version*`, `req~compare-item-presence~1`,
    `req~compare-unknown-*`, `req~compare-diagnostics-order~1`, `req~compare-addon-dropped~1`,
    `req~compare-usage-diagnostics~1`, `req~compare-order~1`, `req~compare-json~1`,
    `req~compare-detached~1`, `req~compare-no-mutation~1`, `req~compare-headless~1` and
    `req~compare-selections-export~1`.
  - Checks: `unit` red before, `lint`. After A0a.

Implementation:

- [x] A1 Types and the plan relation.
  - Files: `src/core/types.ts` (the Decision 1 types, `JsonValue` and `SelectionRelation`) and
    the new `src/core/plan-relation.ts` (internal `planRelation`).
  - Checks: `typecheck`, `lint`, `unit` (the existing tests stay green).
- [x] A2 Effective values.
  - Files: the new `src/core/compare-values.ts` (internal: `toComparedValue`, effective feature
    and limit values, capability, limit order, current-usage flag).
  - Checks: `typecheck`, `lint`, `unit`. Depends on A1.
- [x] A3 Sides and diagnostics.
  - Files: the new `src/core/compare-sides.ts` (internal: Decision 2 steps 1 to 5, unknown-id
    diagnostics, removal reasons).
  - Checks: `typecheck`, `lint`, `unit`. Depends on A1.
- [ ] A4 `compareSelections`.
  - Files: the new `src/core/compare.ts` (classification, version, price, relation, ordering,
    current usage, detaching) and `src/core/index.ts` (the function and the D1 type exports).
  - Checks: `typecheck`, `lint`, `unit` green for all `req~compare-*` ids, `spec`.
  - Depends on A2 and A3.

## Phase B: space-adapter (after D7; the tests use `compareSelections`, so after A4)

- [ ] B0 (test-designer) Acceptance tests for `specs/space-adapter`.
  - Files: `tests/unit/space-adapter.test.ts`. `tests/unit/space-contract.test.ts` stays
    unchanged.
  - Checks: `unit` red before.
- [ ] B1 The subpath.
  - Files: the new `src/space/index.ts` (with the moved `req~space-map-*` tags), the new
    `tsconfig.space.json`, `tsconfig.json`, `package.json` (`exports["./space"]`, the
    `package:check` entrypoints) and `examples/space-contract/map-contract.ts` (re-export only).
  - Checks: `typecheck`, `lint`, `unit`, `package`.

## Phase C: current-selection and plan-cta (after D4, D5, D8; after A4)

Tests (test-designer):

- [ ] C0a Current-selection browser tests.
  - Files: `tests/browser/current-selection.spec.ts` (with the helper
    `tests/browser/helpers/change-flow.ts`). Requirements: `req~current-selection-*`, except the
    type, i18n and manifest ones.
  - Checks: `browser` red before.
  - Status: written, not run. The lab has no browser, so the red-before and green runs are left to
    the `browser` check in CI.
- [ ] C0b Plan-CTA browser tests.
  - Files: `tests/browser/plan-cta.spec.ts` (demo page, PQ, PS). Requirements: `req~cta-*`,
    except the type, i18n and manifest ones.
  - Checks: `browser` red before.
  - Status: written, not run (same reason as C0a).
- [x] C0c Unit tests for types, i18n and the manifest.
  - Files: `tests/unit/change-flow-element.test.ts`: property declarations, types through the
    compiler API, i18n and manifest, for both capabilities. It also covers the pure helpers of
    `src/element/cta.ts` and `src/element/current-selection.ts`.
  - Checks: `unit` red before.
  - Note: the tests were written together with the implementation, so there is no red-before
    run. The compiler reports `element.currentSelection = 42` as TS2559 (a weak type has no
    properties in common with a number), not TS2322 as the spec scenario says; the test asserts
    TS2559 for `42` and TS2322 for `{ planId: 42 }`.

Implementation:

- [x] C1 Messages and CTA labels.
  - Files:
    - `src/core/types.ts`: `PricingCtaLabels` and `PricingCta.labels` (D5). This is after A1.
    - `src/core/index.ts`: the `PricingCtaLabels` type export. This is after A4.
    - `src/core/i18n.ts`: the 7 element keys in `enUS` and `esES`.
    - `src/core/view-model.ts`: `normalizeCtas` keeps string `labels`.
  - Checks: `typecheck`, `lint`, `unit`.
- [x] C2 CTA helpers.
  - Files: the new `src/element/cta.ts`:
    - CTA label by relation and quote state;
    - `{planId}` expansion with `isSafeLink`;
    - pending and disabled attributes;
    - the summary-action template.
  - Checks: `typecheck`, `lint`, `unit`. Depends on C1.
- [ ] C3 Renderers.
  - Files: `src/element/renderers.ts`:
    - optional `RenderState` fields (current plan id, current add-on ids, plan relations,
      pending action id, summary action);
    - current badges, `data-current` and `data-relation`;
    - the CTA wiring through `cta.ts`;
    - the summary action in `renderSummary`.
  - Checks: `typecheck`, `lint`, `unit`, `browser` (no baseline change). Depends on C2.
  - Status: implemented. `typecheck`, `lint` and `unit` pass; `browser` is not run (no browser in
    the lab), so the baselines are not confirmed unchanged.
- [ ] C4 Element.
  - Files:
    - `src/element/pricing-renderer-element.ts`: the properties `currentSelection` and
      `pendingActionId`, the current side, the diagnostics dispatch, the `pricing-action` detail
      fields, the summary-action handler and the pending guards;
    - `src/element/events.ts`: `relation?` and `source?`;
    - `src/element/index.ts`: the `SelectionRelation` re-export.
  - Checks: `typecheck`, `lint`, `unit`, `browser`. Depends on C3.
  - Status: implemented. `typecheck`, `lint` and `unit` pass; `browser` is not run.
- [ ] C5 React, manifest and styles.
  - Files:
    - `src/react/index.ts`: the props `currentSelection` and `pendingActionId` and the
      `SelectionRelation` re-export;
    - `custom-elements.json`;
    - `src/styles/base.css`: the current badges, the pending CTA and the summary action, in
      light and dark themes, with forced colors and reduced motion.
  - Checks: `typecheck`, `lint`, `unit`, `browser`, `package`. Depends on C4.
  - Status: implemented. `typecheck`, `lint` and `unit` pass; `browser` and `package` are not run
    (no browser in the lab, and `package` is not a registered check of this task).

## Phase D: documentation for phases A to C (after A4, B1 and C5)

- [ ] D1a Host-flow guide.
  - Files: the new `docs/change-subscription-flow.md`: the three host routes, D9 and the error and
    race guidance of design.md.
  - Checks: `unit` (`tests/unit/docs-examples.test.ts`), `format`.
- [ ] D1b API reference.
  - Files: `docs/api-reference.md`: `compareSelections`, its types and diagnostics, the element
    properties, `PricingCta.labels`, the event fields and `pricing-renderer/space`.
  - Checks: `unit`, `format`.
- [ ] D1c Configuration and preload guides.
  - Files:
    - `docs/configuration.md`: `currentSelection` versus `selection` and `applySelection`, and
      `pendingActionId`;
    - `docs/preload-current-subscription.md`: import from `pricing-renderer/space` and drop
      "copy the file".
  - Checks: `unit`, `format`.
- [ ] D1d i18n and theming references, and the changeset.
  - Files:
    - `docs/i18n.md`: the element keys;
    - `docs/theming.md`: the part hooks, `data-current` and `data-relation`;
    - `.changeset/subscription-change-flow.md`: minor. It states the `{planId}` expansion and
      ends with "Feedback from the Delivera integration (ISA group, Sept 2026)."
  - Checks: `unit`, `format`.

## Phase E: change-review data contract (after D6; not gated by the CRP)

Requirements: the 16 `req~review-*` ids that are not marked `[pending CRP]`.

- [ ] E0 (test-designer) Tests for those 16 requirements.
  - Files: `tests/unit/change-review.test.ts` (definition in node with the stub registry, React
    SSR and registration, types, manifest, package entries) and
    `tests/browser/change-review-data.spec.ts` (review page: events, the Confirm default action,
    guards, base parts, text-only rendering, light DOM).
  - Checks: `unit` and `browser` red before.
  - Status: written. `tests/unit/change-review.test.ts` ran red before E1 (16 of 17 tests failed;
    the 17th, `req~review-define-separate~1`, guards what already holds) and is green after it.
    `tests/browser/change-review-data.spec.ts` (with `tests/browser/helpers/change-review.ts`) is
    written, not run: the lab has no browser, so its red-before and green runs are left to the
    `browser` check in CI. Unticked until then.
  - Note: in node, the first import of lit sets `globalThis.customElements` to its own registry
    shim, so the unit tests import lit first and stub the registry they need (none, or a recording
    stub). `tests/unit/docs-examples.test.ts` now scans only the renderer's events; the review
    events are documented with phase F5.
- [ ] E1 Element, events and registration.
  - Files:
    - the new `src/element/change-review-element.ts`: properties, events, the Confirm default
      action, guards and the base parts only;
    - the new `src/element/change-review-events.ts`;
    - the new `src/element/change-review-define.ts`;
    - the new `src/element/define-change-review.ts`;
    - `src/element/index.ts`: the exports. This is after C4.
    - `src/core/i18n.ts`: `pricing.reviewConfirm` and `pricing.reviewBack` with the design.md
      texts, so the base buttons have labels; the CRP may change the texts in F1. This is after
      C1.
    - `package.json`: `exports["./define-change-review"]`, `sideEffects` and the attw entrypoint.
      This is after B1.
    - `examples/vanilla/src/main.ts`: import `pricing-renderer/define-change-review` for the
      review page.
  - Checks: `typecheck`, `lint`, `unit`, `browser`, `package`.
  - Status: implemented. `typecheck`, `lint`, `unit` and `package` pass; `browser` is not run (no
    browser in the lab), so the base-part scenarios are not confirmed in a real browser. Unticked
    until the `browser` check passes in CI.
  - Note: the `package:check` entrypoint `./define-change-review` is appended after `./space`, so
    the string pinned by `tests/unit/space-adapter.test.ts` still matches.
- [x] E2 React wrapper and manifest.
  - Files:
    - `src/react/index.ts`: `PricingChangeReview` with registration on render, and the event type
      re-exports. This is after C5.
    - `custom-elements.json`. This is after C5.
  - Checks: `typecheck`, `lint`, `unit`, `package`. Depends on E1.

## Phase F: change-review UI (after D6, the CRP with a mock and phase E)

Requirements: the 14 `req~review-*` ids marked `[pending CRP]`.

- [ ] F0 (test-designer) UI tests.
  - Files: `tests/browser/change-review-ui.spec.ts` (R_ENT, R_START, R_CUR, R_QUOTE, R_V12,
    axe, forced colors, focus, Spanish) and `tests/unit/change-review-i18n.test.ts` (the
    "Review" table).
  - Checks: `unit` and `browser` red before.
- [ ] F1 Review messages.
  - Files: `src/core/i18n.ts`: the other 34 keys of the "Review" table, plus any text changes the
    CRP approved for all 36. This is after E1.
  - Checks: `typecheck`, `lint`, `unit`.
- [ ] F2 Review templates.
  - Files: the new `src/element/change-review-renderers.ts`: sections, value formatting, the
    signed difference, status and alert regions.
  - Checks: `typecheck`, `lint`, `unit`. Depends on F1.
- [ ] F3 Wiring and focus.
  - Files: `src/element/change-review-element.ts`, which renders through
    `change-review-renderers.ts` and moves focus on `comparison` and `error`. This is after E1.
  - Checks: `typecheck`, `lint`, `unit`, `browser`. Depends on F2.
- [ ] F4 Review styles.
  - Files: `src/styles/base.css`: review layout, dark theme, forced colors and reduced motion.
    This is after C5.
  - Checks: `browser`, `lint`. Depends on F3.
- [ ] F5 Review documentation.
  - Files:
    - `docs/change-subscription-flow.md`: the review section;
    - `docs/api-reference.md`, `docs/i18n.md` and `docs/theming.md`: the element, the keys and
      the part hooks;
    - `.changeset/change-review-element.md`.
  - Order: after D1a, D1b and D1d. If the diff exceeds 300 lines, split it per document.
  - Checks: `unit`, `format`.

## Traceability checklist

- selection-comparison: 36 requirements (`req~compare-*`), unit tests.
- current-selection: 14 requirements (`req~current-selection-*`). Browser tests, plus unit tests
  for types, i18n and the manifest.
- plan-cta: 20 requirements (`req~cta-*`). Browser tests, plus unit tests for types, i18n and
  the manifest.
- change-review: 30 requirements (`req~review-*`):
  - 16 data, property, event and packaging requirements (phase E);
  - 14 `[pending CRP]` UI requirements (phase F).
- space-adapter: 13 requirements (`req~space-*`). Unit tests, plus `package` for
  `req~space-build~1`.
