# Tasks: addon-marker-available-for

Rules for every slice:

- One capability (`addon-marker`). Order: S0, then T1, then I1. T1 and I1 land in the same PR into
  develop, because T1 is red by design (design.md D5).
- Tests first: the test-designer writes the tests and proves them red before (G3); the implementer
  runs the frozen tests and touches no test file (G4).
- Every requirement is traced: `[impl->req~…~1]` in `src/core/view-model.ts` and
  `src/element/renderers.ts`, `[utest->req~…~1]` in the tests.
- No feature flag, no ADR, no change to `src/core/index.ts` or `src/core/types.ts` (design.md D3).

Checks (the coordinator registers them; names are the commands):

- `spec`: `["pnpm", "exec", "openspec", "validate", "addon-marker-available-for", "--strict"]`
- `unit-marker`: `["pnpm", "exec", "vitest", "run", "tests/unit/addon-marker.test.ts", "tests/unit/ux-counts.test.ts"]`
- `red_before`: `unit-marker`, expected exit 1, pattern `AssertionError`, overlay the two unit files
- `typecheck`: `["pnpm", "run", "typecheck"]`; `lint`: `["pnpm", "run", "lint"]`;
  `unit`: `["pnpm", "run", "test"]`
- `format`: `["pnpm", "exec", "prettier", "--check", <owned files>]`

## S0: OpenSpec change

- [x] S0 Spec (specifier).
  - Files: `openspec/changes/addon-marker-available-for/**`,
    `docs/agent-work/spectra-item6-addon-marker/spec.md` (R1, R3, R7, R9, AC2, AC7).
  - Checks: `spec`. Gates G1, G2.

## T1: tests for the per-plan marker

- [x] T1 Tests (test-designer, after S0).
  - Files: `tests/unit/addon-marker.test.ts`, `tests/unit/ux-counts.test.ts`,
    `tests/browser/spectra-addon-marker.spec.ts`.
  - Read only: `specs/addon-marker/spec.md`, `src/element/renderers.ts`, `src/core/view-model.ts`,
    `tests/browser/helpers/spectra.ts`, `tests/fixtures/stress/build.ts`.
  - Cases: every scenario of both requirements. The SPECTRA and stress scenario uses an independent
    reference that extends `referenceAddOnOnly` (`addon-marker.test.ts:518-527`) and does not call
    `addOnProvidesForPlan`. Amend the "one marker per plan" assertions (design.md D5). Add
    `addOnMarkerCellsMisleading` to `ux-counts.test.ts` and assert 0 for every source.
  - Report the measured marked-row count per fixture; if one is below `addOnOnlyRows` of
    `metrics.json`, stop and report it (design.md D4, Q1). Do not change the R9 numbers.
  - Tags: `// [utest->req~addon-marker-per-plan-availability~1]`,
    `// [utest->req~addon-marker-helper-internal~1]`.
  - Checks: `red_before`, `typecheck`, `lint`, `format`. The browser spec is proven by the PR's
    browser shards.

## I1: per-plan marker in both layouts

- [x] I1 Implementation (implementer, after T1 is frozen; serialized with other owners of `src/element/renderers.ts`).
  - Files: `src/core/view-model.ts`, `src/element/renderers.ts`,
    `.changeset/addon-marker-availability.md` (patch).
  - Change: design.md D1 and D2. Tags: `// [impl->req~addon-marker-per-plan-availability~1]` at the
    two cell call sites and the helper, `// [impl->req~addon-marker-helper-internal~1]` at the
    helper export.
  - Checks: `unit-marker`, `unit`, `typecheck`, `lint`, `format`, and the PR's browser shards.
  - Gates: G4, G6, G11 (low panel), G12 (GitHub fixture at 1440 and 375 px, a row with marker and
    dash cells, no baseline change), G13 (load `tests/fixtures/spectra/mailchimp/2024.yml`: the FREE
    column shows dashes, paid columns show "Add-on" where available).

## Ownership and order

| Order | Task | Owns                                                               | Parallel with |
| ----- | ---- | ------------------------------------------------------------------ | ------------- |
| 1     | S0   | `openspec/changes/addon-marker-available-for/**`, item 6 spec      | none          |
| 2     | T1   | the three test files                                               | none          |
| 3     | I1   | `src/core/view-model.ts`, `src/element/renderers.ts`, I1 changeset | none          |

## Traceability checklist

- `req~addon-marker-per-plan-availability~1`: impl in `src/element/renderers.ts` and
  `src/core/view-model.ts`; utest in `tests/unit/addon-marker.test.ts`,
  `tests/unit/ux-counts.test.ts` and `tests/browser/spectra-addon-marker.spec.ts`.
- `req~addon-marker-helper-internal~1`: impl in `src/core/view-model.ts`; utest in
  `tests/unit/addon-marker.test.ts`.
- The item 6 tags `spectra-item6:*` stay next to the new ones.
