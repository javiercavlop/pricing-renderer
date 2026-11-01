# Intake: P-20261101-1, make the "Add-on" marker follow `availableFor` (UX-7)

- Origin: proposal P-20261101-1 (kind feature, size S, risk low), approved by the owner. Per the
  proposal, that approval is also the owner's answer to CRP-U7
  (`docs/agent-work/pending-phases/plan.md:557-559`). Planner intake, 2026-11-01.
- Base: HEAD `09363ed` of the task branch `task/650b9a6b2da54a4c`. Every `file:line` below is at this base.
- INTENT link: O1, "real-world Pricing2Yaml pricings render legibly" (`INTENT.md`, section "O1").
- No release: the code slice adds one pending changeset. Nobody versions or publishes.

## Verification of the proposal's evidence

Status: R = reproduces, P = partly, N = does not reproduce.

- E1, the row test ignores `availableFor`. **R.** `isAddOnOnlyRow` (`src/core/view-model.ts:611-620`)
  checks every add-on of `viewModel.addOns` and never reads `availableFor`.
- E2, R3 forces the marker in every plan cell. **R.** Spec `docs/agent-work/spectra-item6-addon-marker/spec.md:32-37`.
  The code agrees: both layouts compute one boolean per row (`src/element/renderers.ts:804`, `:907`)
  and pass it to every cell (`:826`, `:922`). `renderValue` then shows the marker in place of the
  em dash (`:211-217`).
- E3, the counts. **R.** PR #72 CI, head `936631a`, job `quality (24)` (id 123038643751). The
  `UX_COUNTS` lines give `addOnOnlyRowsMisleading` per fixture: box 4, circleci 4, clickup 1,
  databox 2, github 17, mailchimp 16, notion 1, planable 4, postman 8, salesforce 10, slack 2,
  tableau 6, wrike 3, zoom 3. That is 81 rows in 14 of the 37 SPECTRA fixtures. The stress fixtures
  add 56 more: github 4×6, zoom 4×4, salesforce 4×3, webflow 4×1. The acme demo counts 0.
- E4, the counting rule. **R, but it counts rows for the selected plan only.**
  `tests/unit/ux-counts.test.ts:94-98` counts a row when `isAddOnOnlyRow` is true and no providing
  add-on is available for `viewModel.resolved.selection.planId`. Two consequences:
  - It does not count cells in the other plan columns. The number of misleading *cells* on the base
    may be higher than 81.
  - It calls `isAddOnOnlyRow`, which this change keeps as it is. So after the fix the metric **stays
    at 81**. The target of 0 can only be shown if the metric changes too (slice T1).
- E5, the gate and the CRP. **R.** UX-7 is at `docs/agent-work/ux-review/report.md:482-500`
  ("Metric: misleading marker cells. Target: 0", `:496`). CRP-U7 is at `plan.md:557-559`. Its
  line references are stale: `view-model.ts:560-569` at `:486` is now `:611-620`,
  `renderers.ts:889-893` at `:489` is now `:992-996`, and `renderers.ts:725,816` at `:490` are now
  `:804,907`.
- E6, "R9's row counts still hold". **P.**
  - What still holds: `isAddOnOnlyRow` does not change, so the *detected* count stays 166 (R9 sum
    and per-fixture, `addon-marker.test.ts:595-605`).
  - What is not guaranteed: R9 also counts the rows *rendered with the marker*
    (`spec.md:56-58`, `addon-marker.test.ts:607-614,628-643`). After the fix, a row keeps a
    marker only if some visible plan can buy a providing add-on. No SPECTRA fixture has a private
    plan (grep `private:\s*true` in `tests/fixtures/spectra`: 0 matches). So a row would lose every
    marker only if its add-ons' `availableFor` names no plan of the fixture. This was not checked
    for all 14 fixtures. T1 measures it (see Q1).
- E7, "the narrow and table baselines should not move, because the demo pricing has no restricted
  add-ons". **The conclusion holds, the reason is wrong.**
  - The demo does restrict its add-ons: `tests/fixtures/acme-pricing.yml:98-100,112-113,121-123`.
  - But it has no add-on-only row (`addon-marker.test.ts:361-368`), so it renders no marker before
    or after the change.
  - `toHaveScreenshot` appears only in `tests/browser/pricing-renderer.spec.ts`, which loads one
    pricing (`:569`).
- E8, not in the proposal: existing tests that assert R3 and will fail after the fix.
  - `tests/unit/addon-marker.test.ts:616-626` expects one marker per plan in every marked SPECTRA
    row. Mailchimp breaks that by design: every add-on is restricted to paid plans
    (`tests/fixtures/spectra/mailchimp/2024.yml:757-816`).
  - `tests/browser/spectra-addon-marker.spec.ts:224-227` expects one marker per plan and no
    `pr-value--excluded` in a marked row. `:236-238` and `:250` expect `32 × plans` markers for
    GitHub, but GitHub has 17 misleading rows at the default plan.
  - The browser spec runs on PR browser shards. `ci.yml:142-161` runs the shards when rendered code
    changes, and `playwright.config.ts:15-17` ignores only `ux-stress` and `spectra-review`.
  - So these tests must change in the same change, or I1's PR goes red.
- E9, availability rule. `availableFor` empty means every plan. The same rule appears in
  `src/core/resolve.ts:116-118`, `src/element/renderers.ts:992-996` (`addOnAvailability`) and
  `tests/unit/ux-counts.test.ts:57-59`.
- E10, public API. **R.** `src/core/index.ts:27-35` re-exports named members of `view-model.ts`
  only, with no `export *`. A new function exported from `view-model.ts` stays internal unless
  someone adds it there. `addon-marker.test.ts:385-394` already guards `isAddOnOnlyRow`.

## Objective

A comparison cell says "Add-on" only when an add-on that provides the row can be bought on that
cell's plan. Every other empty cell shows the em dash with "Not included". Target: 0 misleading
marker cells in the 37 SPECTRA fixtures and the stress fixtures, in both layouts.

## Scope

- A spec delta that amends item 6:
  - R3: the marker appears per cell, and only where a providing add-on is available for that
    cell's plan.
  - R1: an added sentence. The per-cell helper is exported from `view-model.ts` only.
  - R7: the helper is not re-exported from `src/core/index.ts`.
  - R9 and AC2 and AC7: the "one marker per plan" wording goes.
  - R6 stays as it is: no marker in mixed rows (Q-D of CRP-U7).
- `addOnProvidesForPlan(viewModel, row, planId): boolean` in `src/core/view-model.ts`, exported
  from the module only. It is true when some add-on of `viewModel.addOns` provides the row (the same
  rule as `isAddOnOnlyRow`) and its `availableFor` is empty or contains `planId`. Both cell call
  sites in `renderers.ts` use it.
- Tests:
  - the red-first 2-plan case;
  - an amendment of the R3-derived assertions in the unit and browser marker specs;
  - a cell-level UX count that reaches 0.
- One changeset (patch).

## Non-goals

- UX-8: hiding add-ons the selected plan cannot use, with a new i18n key (`report.md:502-514`).
- A new text for "not available on this plan". It needs an i18n key and its own CRP.
- Changing which rows are add-on only. `isAddOnOnlyRow` and the detected count of 166 stay.
- `dependsOn` and `excludes` chains, for example an add-on that is available for plan B but needs
  another add-on that is not. That is a separate rule and stays as today.
- Plan highlight lists, add-on cards, effects, CSS, i18n catalogs and any public attribute, event,
  part or type (R7).
- Moving the availability rule into one shared helper for `resolve.ts`, `renderers.ts` and
  `view-model.ts`. That is a followup refactor.

## Slices

Order: S0, then T1, then I1. T1 is red by design, so it never merges into develop alone. T1 and I1
land together in the change's PR into develop. Owned files are disjoint across slices.

### S0. Spec delta for UX-7 (specifier)

- Owns:
  - `openspec/changes/addon-marker-available-for/**` (proposal.md, design.md, tasks.md,
    `specs/addon-marker/spec.md`);
  - `docs/agent-work/spectra-item6-addon-marker/spec.md`, edited in place at R1, R3, R7, R9, AC2
    and AC7. Each edit names P-20261101-1 and CRP-U7, so the old spec does not contradict the new
    one.
- Read-only: `src/core/view-model.ts:607-620`, `src/element/renderers.ts:199-222,800-830,904-925`,
  this intake.
- Requirements (EARS, proposed ids):
  - `req~addon-marker-per-plan-availability~1`. WHEN a comparison row is add-on only (R1),
    `renderComparison` SHALL render the marker in the cell of plan P only IF some add-on of
    `viewModel.addOns` provides the row and its `availableFor` is empty or contains P. Every other
    cell of that row SHALL render the em dash with `pricing.notIncluded`. This holds in both layouts.
  - `req~addon-marker-helper-internal~1`. `addOnProvidesForPlan` SHALL be exported from
    `src/core/view-model.ts` and SHALL NOT be re-exported from `src/core/index.ts`.
    `PricingComparisonRow` and `src/core/types.ts` SHALL NOT change.
  - R9 rewording: the detected count stays 166. A marked row is a row with at least one marker. The
    per-fixture marked-row numbers stay, unless T1 shows otherwise (Q1).
- Checks: G1 `["pnpm", "exec", "openspec", "validate", "addon-marker-available-for", "--strict"]`.
  `openspec` is not a `package.json` script (`package.json:130-140`), so the coordinator confirms
  that the CLI is available.
- Expected diff: about 60-90 lines of docs.
- Risk low (docs only, score 0). Budget 20 turns.

### T1. Tests for the per-plan marker (test-designer)

- Depends on: S0 (requirement ids).
- Owns:
  - `tests/unit/addon-marker.test.ts`;
  - `tests/unit/ux-counts.test.ts`;
  - `tests/browser/spectra-addon-marker.spec.ts`.
- Read-only: the S0 delta, `src/element/renderers.ts`, `src/core/view-model.ts`,
  `tests/browser/helpers/spectra.ts`, `tests/fixtures/stress/build.ts`.
- Cases, tagged `// [utest->req~addon-marker-per-plan-availability~1]`:
  1. Red-first. A 2-plan inline pricing whose add-on provides one row and has
     `availableFor: [B]`. Plan B shows the marker. Plan A shows `pr-value--excluded` and
     "Not included". Check both layouts and the `es` catalog.
  2. Regression. An add-on with an empty `availableFor` (or both plans) still marks both cells. The
     existing INLINE fixture (`addon-marker.test.ts:201-224`) covers this. Keep `:306-343`.
  3. Two add-ons provide the same row, one for A and one for B: both cells are marked.
  4. Amend `:616-626`. In each marked SPECTRA row, the marker count equals the number of plans for
     which an independent reference finds a providing add-on that is available. That reference
     extends `referenceAddOnOnly` at `:518-527` and does not call the new helper. Also assert 0
     misleading marker cells over the 37 fixtures and the stress fixtures (`stressFixtures`,
     `tests/fixtures/stress/build.ts`) in both layouts.
  5. Record the marked-row counts of `:607-614,628-643` as T1 measures them. If any fixture drops
     below its `addOnOnlyRows`, stop and report it (Q1). Do not change the numbers.
  6. `ux-counts.test.ts`:
     - Add a field `addOnMarkerCellsMisleading`. It counts rendered table-layout marker cells whose
       column plan cannot buy a providing add-on (reuse `availableForPlan` and `providesRow`,
       `:57-68`). Assert that it is 0 for every source.
     - Keep `addOnOnlyRowsMisleading` and change its comment at `:94` to say what it measures: the
       data property "rows the old R3 rule marked wrongly at the selected plan". The UX report
       cites that field.
  7. `spectra-addon-marker.spec.ts`:
     - Replace `markers !== plans` (`:224`) and `excluded === 0` (`:226-227`) with per-row
       expectations computed from the fixture by the same reference (`readFixture`, `planCount`).
     - Replace `32 × plans` (`:236-238`, `:250`) with the reference marker total.
     - Keep `expectedRows = 32` if case 5 confirms it.
     - Retag the tests with the new requirement id next to `spectra-item6:*`.
- Checks:
  - `["pnpm", "exec", "vitest", "run", "tests/unit/addon-marker.test.ts", "tests/unit/ux-counts.test.ts"]`.
  - Red before (G3): the same argv, `type: red_before`, `expect_exit: [1]`,
    `expect_pattern: "AssertionError"`,
    `overlay: ["tests/unit/addon-marker.test.ts", "tests/unit/ux-counts.test.ts"]`. Cases 1, 4 and 6
    must fail on the base.
  - `["pnpm", "exec", "prettier", "--check", "tests/unit/addon-marker.test.ts", "tests/unit/ux-counts.test.ts", "tests/browser/spectra-addon-marker.spec.ts"]`
  - `["pnpm", "run", "lint"]`, `["pnpm", "run", "typecheck"]`.
  - The browser spec is proven on I1's PR CI (browser shards). Optional in the lab:
    `["pnpm", "exec", "playwright", "test", "tests/browser/spectra-addon-marker.spec.ts", "--project=chromium"]`,
    if chromium is installed there.
- Expected diff: about 130-180 lines in tests.
- Risk low (tests only, score 0). Budget 35 turns.

### I1. Per-plan marker in both layouts (implementer)

- Depends on: S0 and T1 frozen (G4). It must also be serialized with any in-flight change that
  owns `src/element/renderers.ts` (plan.md:390 orders U7 after U9).
- Owns: `src/core/view-model.ts`, `src/element/renderers.ts`,
  `.changeset/addon-marker-availability.md` (patch; name from `plan.md:393`).
- Read-only: the three T1 test files, `src/core/index.ts`.
- Change:
  - Extract a private `addOnProvidesRow(addOn, row)` from `isAddOnOnlyRow` (`view-model.ts:613-619`),
    with no change in behaviour.
  - Add `export function addOnProvidesForPlan(viewModel, row, planId)`:
    `viewModel.addOns.some(a => addOnProvidesRow(a, row) && (a.availableFor.length === 0 || a.availableFor.includes(planId)))`.
  - In `renderers.ts:826` and `:922`, pass
    `addOnOnly && addOnProvidesForPlan(viewModel, row, cell.planId)` and keep the per-row
    `addOnOnly` at `:804` and `:907`. `renderValue` (`:199-222`) is unchanged.
  - Add `// [impl->req~addon-marker-per-plan-availability~1]` and do not touch `src/core/index.ts`.
- Expected diff: about 25-40 lines plus the changeset.
- Checks:
  - `["pnpm", "exec", "vitest", "run", "tests/unit/addon-marker.test.ts", "tests/unit/ux-counts.test.ts"]`
  - `["pnpm", "run", "test"]`, `["pnpm", "run", "typecheck"]`, `["pnpm", "run", "lint"]`
  - `["pnpm", "exec", "prettier", "--check", "src/core/view-model.ts", "src/element/renderers.ts", ".changeset/addon-marker-availability.md"]`
  - CI browser shards on the PR, which include `spectra-addon-marker.spec.ts`.
- Risk **low**. Score 1:
  - core plus element, so more than one module: +1;
  - no public API (E10), no external input, no concurrency, under 200 lines.
  - "payments/pricing" is not counted, because no price, total or selection logic changes, only a
    label in the comparison. If the coordinator counts that area, the score is 4 (medium) and the
    medium panel applies.
- Budget 25 turns.

## Gates per slice

| Gate | S0 | T1 | I1 |
|---|---|---|---|
| G1 openspec validate --strict | yes | - | re-run if the delta changes |
| G2 EPIC | yes | - | - |
| G3 red before | - | yes (unit files) | - |
| G4 frozen tests | - | - | T1 |
| G5, G7, G10 | registry | registry | registry |
| G6 trace | ids | utest | impl |
| G8 mutation | - | - | if registered |
| G9 dependencies | N/A | N/A | N/A (no new dependency) |
| G11 review | one reviewer | test-reviewer | low panel (medium if the score is 4) |
| G12 ui-qa | N/A | N/A | yes: GitHub fixture at 1440 and 375, a mixed marker/dash row; no baseline change |
| G13 | how-to-review | - | how-to-test: load `tests/fixtures/spectra/mailchimp/2024.yml`; the FREE column shows dashes and the paid columns show "Add-on" where available |

"Registry": G5, G7 and G10 are not defined in any file this intake read. The coordinator applies
its own registry.

## Feature flags

None. There is one behaviour slice (I1), complete by itself. S0 is docs, and T1 lands with I1. A
flag would add the public attribute that R7 forbids.

## Risks

- R1. Some add-on-only rows may lose every marker, which changes the R9 rendered counts (E6).
  Mitigation: T1 case 5 measures it before I1, and Q1 decides.
- R2. Conflicts in `src/element/renderers.ts` with other UX slices (U9 per `plan.md:390`, and
  others not checked here). Mitigation: the coordinator serializes owners of that file.
- R3. The availability rule now exists in four places (E9). Mitigation: I1 copies the rule exactly
  (empty means all). A followup can unify it.
- R4. The UX report's metric naming can confuse readers. `addOnOnlyRowsMisleading` keeps printing
  81, because it is a data property, while the new `addOnMarkerCellsMisleading` prints 0.
  Mitigation: T1 comments the field, and a followup updates `report.md:496` and its stale line refs.
- R5. A user who selects a restricted plan now sees "Not included" for something the vendor sells on
  other plans. The proposal accepts this (alternatives section), and UX-8 is out of scope.

## Open questions

- Q1 (a CRP only if needed). If T1 finds a SPECTRA row with no plan that can buy any providing
  add-on, its marked-row count in R9 drops below `metrics.json`. Options:
  - (A) Amend R9: the detected count stays 166, and the marked-row counts become the measured ones.
    **Recommended**, because a marker in such a row is exactly the misleading claim the proposal
    removes.
  - (B) Keep the marker in every cell of such rows. Not recommended: it reintroduces misleading
    cells.
  - If T1 finds no such row, R9 stays as written and no CRP is needed.
- Q2 (coordinator, no CRP). Changeset bump: patch, like `.changeset/spectra-addon-marker.md:2`.
  Recommended.
- Already answered by the approval: CRP-U7, including Q-D (keep R6). The cell text for unavailable
  plans is the existing em dash with "Not included" (proposal).
