# Intake: P-20261027-1, UX-1 measurements in the UX stress spec and the `loneLastCard` fix

- Proposal: P-20261027-1 (kind feature, size S, owner-approved). Planner intake, 2026-10-27.
- Base: `595ad24` (task branch `task/455b67d082df4b8f`).
- INTENT link: **O1, "real-world Pricing2Yaml pricings render legibly"** (`INTENT.md:26`). Its
  signals are the renderer height (threshold at most 5 screens at 1440, `INTENT.md:34`), the CTA in
  the first screen at 1440 and 375 (`INTENT.md:38`) and the lone last card (`INTENT.md:39-41`).
- Source of the work: UX-1 of the UX review (`docs/agent-work/ux-review/report.md:341-371`), ranked
  first, and the other proposals depend on it (`report.md:587-602`).

## Objective

The on-demand UX stress spec prints, in its `SPECTRA_UX_SUMMARY` line, the numbers that the UX-3 to
UX-6, UX-8 and UX-11 proposals need, and its `loneLastCard` flag stops reporting true for a grid that
has one column. The work changes tests only. The spec keeps recording values and asserts only what
holds today.

## Verified facts (file:line at `595ad24`)

- The artifact: `loneLastCard: rows.length > 1 && rows[rows.length - 1] === 1`
  (`tests/browser/ux-stress.spec.ts:223`). With one column every row holds one card, so the flag is
  true at 375 for clickup and webflow (`report.md:95-97`).
- The spec calls `measurePlanGrid` (`ux-stress.spec.ts:190-194`) and prints only `planCardCount`,
  `gridColumns` and `cardsPerRow` (`:219-224`). The helper already returns `cardWidths`,
  `firstCtaBottom` and `layoutBreakdown` (`tests/browser/helpers/spectra.ts:123-141,224-238`).
  `spectra-grid.spec.ts:48-56` already prints them for real pricings.
- `measureText` (`spectra.ts:287-373`) and `revealAllRows` (`spectra.ts:100-121`) exist. The stress
  spec calls neither (imports at `ux-stress.spec.ts:3-9`).
- `spectra.ts` imports `@playwright/test`, so vitest cannot load it (`spectra.ts:6-9`). The stress
  folder can be loaded: `tests/unit/ux-stress-fixtures.test.ts:4-9` imports `build.ts`.
- `tests/fixtures/stress/` holds only `build.ts` and `README.md` (glob). `metrics.ts` does not exist.
- Section hooks rendered: `hero` (`src/element/renderers.ts:252`), `billing` (`:271`), `plans`
  (`:303`), `variables` (`:561`), `comparison` (`:862`), `add-ons` (`:1220`), `summary` (`:1338`),
  `metadata` (`:1369`). They are public and stable (`docs/theming.md:84-89`). **`summary` is inside
  the `add-ons` section** (`renderers.ts:1227-1233`), so the section heights overlap and must not be
  added up.
- Table header: the first `th` is the "Features" column and one `th` follows per plan
  (`renderers.ts:777-778`).
- Axe contrast scan to copy: `contrast()` in `tests/browser/spectra-review.spec.ts:352-365`, with
  `@axe-core/playwright` (`spectra-review.spec.ts:1`).
- Variants today: 1440x900 light `en` and 375x812 dark `es` (`ux-stress.spec.ts:25-28`). Three
  fixtures (`:21`). Per-test timeout 60 s (`:169`), with bounded steps (`:30-35`).
- CI: `playwright.config.ts:15-18` ignores `ux-stress.spec.ts` on CI unless `PW_UX_STRESS=1`. Only
  the `on-demand-specs` job sets it, and only on `workflow_dispatch` (`.github/workflows/ci.yml:282-302`).
  `browsers` does not need that job (`ci.yml:235-237,274-275`). So no PR gate depends on the browser
  spec. This part of the proposal's risk claim is confirmed.
- **Correction to the proposal:** the new unit test is a PR gate. Vitest runs `tests/unit/**/*.test.ts`
  (`vitest.config.ts:6`) in the `quality` job (`ci.yml:47`). That is intended, and it stays low risk.
- **Correction to the proposal:** INTENT Q2 and Q3 are already answered (`INTENT.md:131-133`). The
  numbers size the O1 work against thresholds that are already decided. They do not decide them. The
  UX review still calls them undecided (`report.md:617`), because it was written before the answers.
- `tsc -b` covers only `src/**` (`tsconfig.json:3-7`; the `include` of `tsconfig.core.json:10`,
  `tsconfig.element.json:10`, `tsconfig.yaml.json:10`, `tsconfig.react.json:11`). Files under `tests/`
  are not type-checked. ESLint (`eslint.config.js:17-20`, no type info) and transpilation are the only
  static checks they get.
- Path filter: `tests/fixtures/*` and `tests/browser/*` are not on the allowlist (`ci.yml:130-133`).
  Every slice therefore runs the browser shards on its PR. The shards ignore the stress spec, so this
  costs CI time and adds no risk.
- Lab: workers have no Playwright browsers. Lab chromium is a spec only
  (`docs/agent-work/ci-speed/lab-chromium.md:3,15-17`). A dispatch works only when the workflow with
  `workflow_dispatch` is on the default branch (`docs/agent-work/ci-speed/on-demand-specs.md:45-47`).
  I could not verify either one from this role.
- No OpenSpec change exists (glob `openspec/**/*.md`, no match). ROADMAP has no match for "UX" or
  "stress" (grep).

## Scope

All of UX-1 (`report.md:346-360`), items (a) to (k), split into five slices:

- (k) A pure `loneLastCard` in `tests/fixtures/stress/metrics.ts`, with its vitest.
- (a) Print `cardWidths`, `firstCtaBottom` and `layoutBreakdown`.
- (c) Section heights from the `data-pr-part` hooks.
- (d) Expanded height. (f) `visiblePlanColumns`. (b) Text metrics.
- (i) The variant matrix plus 1024 light `en`. (h) `layout="table"` at 375.
- (e) Add-on rows and summary visibility. (g) Axe contrast.
- (j) All 6 shapes behind an environment variable. The default stays the 3 fixtures.

## Non-goals

- No change to `src/**`, to the styles or to any visual baseline. No product proposal (UX-3 to UX-11).
- No new assertion on a target. Recorded numbers never fail the spec. Asserting them is UX-10, after
  owner thresholds.
- No change to `.github/workflows/ci.yml` or `playwright.config.ts`. A CI change is a risk area (+3)
  and would make a slice medium. A dispatch input for the full set is open question Q-2.
- No change to `tests/browser/helpers/spectra.ts` unless a slice says so. The other SPECTRA specs
  share it (`spectra.ts:6-8`).
- UX-2 (unit-level counts) is a separate proposal.
- No variance study (several runs) here. UX-10 needs it (`report.md:544-546`).

## Interface contract (fixed before the slices, so later slices only import it)

`tests/fixtures/stress/metrics.ts` (no Playwright or DOM import, so vitest and Playwright both load it):

```ts
// true when the grid has more than one column, more than one row, and the last row holds one card.
export function loneLastCard(gridColumns: number, cardsPerRow: readonly number[]): boolean;
// px / viewport height, rounded to 2 decimals; null when px is null.
export function inViewports(px: number | null, viewportHeight: number): number | null;
```

New `SPECTRA_UX_SUMMARY` fields are additive. No slice renames or removes an existing field.

## Slices

All slices edit `tests/browser/ux-stress.spec.ts`, so they run **in order, never in parallel**. Each
one merges into develop on its own. It adds fields to a line that no gate reads, so **no feature flag
is needed**. The environment variable of S5 selects which fixtures run. It is not a feature flag.
Default role: implementer (a test-only tooling change, no acceptance/ test). Turn budget 40 each.

Common checks (every slice):

- `["pnpm", "install", "--frozen-lockfile"]`
- `["pnpm", "test"]` (timeout 600)
- `["pnpm", "lint"]`
- `["pnpm", "format:check"]`
- Heavy, only if the lab chromium check is registered (Q-1), timeout 1800:
  `["env", "PW_UX_STRESS=1", "pnpm", "exec", "playwright", "test", "tests/browser/ux-stress.spec.ts", "--project=chromium", "--workers=2", "--reporter=line", "--global-timeout=1500000"]`
  (form from `lab-chromium.md:43-56`). Without it, the proof is a dispatch run of `on-demand-specs`.

### S1: `loneLastCard` fix, plan-grid diagnostics, section heights (the proposal's first slice)

- Owns: `tests/fixtures/stress/metrics.ts` (new), `tests/unit/ux-stress-metrics.test.ts` (new),
  `tests/browser/ux-stress.spec.ts`, `tests/fixtures/stress/README.md`.
- Read-only: this intake, `tests/browser/helpers/spectra.ts`, `tests/unit/ux-stress-fixtures.test.ts`,
  `docs/theming.md:82-95`, `renderers.ts:1220-1236`.
- Content: write `metrics.ts` per the interface contract. Use `loneLastCard(grid.gridColumns, rows)`
  at `ux-stress.spec.ts:223`. Add `cardWidths`, `firstCtaBottom` and `layoutBreakdown` under
  `planGrid`. In `measureUx`, add `sections`: for `hero`, `billing`, `variables`, `plans`,
  `comparison`, `add-ons`, `summary` and `metadata`, the height in px of the first element with that
  hook, or null when it is absent. Convert to viewports with `inViewports` on the node side. Add a
  comment that `summary` is nested in `add-ons`. Add a README line for `metrics.ts`.
- Unit cases: 1 column `[1,1,1,1,1]` gives false; 4 columns `[4,4,4,1]` gives true; 4 columns
  `[4,4,4,3]` gives false; 3 columns `[1]` (a single row) gives false; 0 columns `[]` (okta) gives false;
  2 columns `[2,2,1]` gives true. That last one is recorded as true: the 600-839 band is exempt by
  design (`report.md:145-147`), and the flag records and does not judge. `inViewports(null, 900)` is
  null and `inViewports(1800, 900)` is 2.
- Extra check: `["pnpm", "exec", "vitest", "run", "tests/unit/ux-stress-metrics.test.ts"]`.
- Size: about 110-140 lines. Risk: **low** (score 0: tests only -2, +1 for more than one module,
  floor 0).
- Depends on: nothing.

### S2: expanded height, `visiblePlanColumns`, text metrics

- Owns: `tests/browser/ux-stress.spec.ts`.
- Read-only: `spectra.ts:100-121,287-373`, `spectra-review.spec.ts:7-9,476-497` (how the expanded
  state is measured there), `renderers.ts:771-779`.
- Content: (f) `visiblePlanColumns` counts the `thead th` after the first one that lie fully inside
  the `.pr-table-scroll` box at `scrollLeft` 0. It is null without a table. Measure it in the
  collapsed state before any reveal. (b) Call `measureText` and print its counts and examples.
  (d) Call `revealAllRows` last and print `rendererHeightInViewportsExpanded` and whether the reveal
  completed. It changes the DOM, so it is the last measurement of a variant. Then re-apply the pricing
  before the next variant, which the loop already does (`ux-stress.spec.ts:182-186`).
- Size: about 60-90 lines. Risk: **low** (score 0).
- Depends on: S1 merged.

### S3: variant matrix, 1024, `layout="table"` at 375

- Owns: `tests/browser/ux-stress.spec.ts`.
- Content: (i) The variants are 1440 and 375, each crossed with light `en` and dark `es`, plus 1024x768
  light `en`. That is 5 variants. (h) At 375, one extra pass with `layout="table"` (an existing
  attribute, `docs/api-reference.md:341`), printed with `layout: "table"` in its line. Reset the
  attribute afterwards. Each test must stay under the 60 s budget (`ux-stress.spec.ts:169`). Split
  into one test per fixture and variant, or raise the timeout with the reason in a comment. Pick
  whichever keeps the printed `elapsedMs` within the budget.
- Size: about 50-80 lines. Risk: **low** (score 0). The CI time risk is in "Risks".
- Depends on: S2 merged.

### S4: add-on rows, summary in view, contrast

- Owns: `tests/browser/ux-stress.spec.ts`.
- Read-only: `tests/browser/spectra-addon-grid.spec.ts:40-54`, `spectra-review.spec.ts:352-365`.
- Content: (e) For each add-on grid row: the height spread, the cards rendered and the cards
  disabled. Also whether `[data-pr-part="summary"]` intersects the viewport with the first, the middle
  and the last card scrolled into view. (g) The `contrast()` scan, copied into the spec (a spec file
  is never imported, `spectra.ts:7-8`), with `contrastViolations` and up to 3 examples.
- Size: about 70-100 lines. Risk: **low** (score 0, no new dependency: `@axe-core/playwright` is
  already used).
- Depends on: S3 merged.

### S5: all 6 shapes on request

- Owns: `tests/browser/ux-stress.spec.ts`, `tests/fixtures/stress/README.md`.
- Content: (j) With `PW_UX_STRESS_ALL=1`, run one monthly fixture per shape: the 3 of today
  plus `zoom-usd-monthly`, `salesforce-usd-monthly` and `github-usd-monthly`. Every shape exists in
  both currencies (`build.ts:138-143`). The default is unchanged. Document the
  variable in the README.
- Size: about 20-40 lines. Risk: **low** (score 0). It becomes **medium** (score 3) if
  `ci.yml` is touched. That is excluded here (Q-2).
- Depends on: S4 merged. It may come before S2 to S4 if the coordinator prefers. It touches only the
  `subset` line (`ux-stress.spec.ts:21`) and the README.

Total about 310-450 lines over five PRs, each under 150. The ~250 lines of UX-1 in the report
(`report.md:370`) did not count the variant split or the unit cases.

## Gates per slice

G1-G4, G6 and G8-G13 follow the factory skills I read (`factory:qa-checks` for G3, G4 and G13;
`factory:mrp-builder` for the review package). I found no definition for G5 or G7, as the earlier
intakes did not (`docs/agent-work/prop-20261025-1/intake.md:134-145`).

| Gate | S1 | S2-S5 |
| --- | --- | --- |
| G1 openspec validate --strict | change level, once the change exists | same |
| G2 EPIC spec review | change level, if the change carries requirements | same |
| G3 red-before | N/A, see D3 | N/A (no unit test) |
| G4 acceptance freeze | N/A (no `acceptance/`) | N/A |
| G5 | not defined in the skills I read; coordinator maps | same |
| G6 trace | applies if requirement ids are assigned: `utest` tag in the unit test | N/A unless tagged |
| G7 | not defined in the skills I read; coordinator maps | same |
| G8 mutation | N/A | N/A |
| G9 dependency and licence | N/A (no dependency) | N/A |
| G10 secrets | applies if registered | same |
| G11 review | one reviewer (low risk) | one reviewer |
| G12 ui-qa | N/A (no UI change) | N/A |
| G13 how-to-test | N/A with a how_to_review guide (D4) | same |

## Decisions taken in this intake (the owner can veto them in review)

- D1. Sequential slices, no feature flag. Reason: every item edits `ux-stress.spec.ts`, and the
  added fields are not read by any gate (`ci.yml:235-237`), so each PR is safe alone.
- D2. The pure functions go in `tests/fixtures/stress/metrics.ts`, not in `spectra.ts`. Reason:
  vitest cannot load `spectra.ts` (`spectra.ts:6-9`), and `spectra.ts` is shared with four other specs.
- D3. G3 is N/A for S1. Reason: `metrics.ts` is new. A red-before run with only the test as overlay
  fails at import, and G3 rejects import errors (`factory:qa-checks`). The case `[1,1,1,1,1]` with
  1 column, which the old formula at `ux-stress.spec.ts:223` gets wrong, is the proof. The reviewer
  checks it against the old expression.
- D4. The PRs carry how_to_review, not how_to_test, and G13 is N/A. Reason: no UI, API or runtime
  change. The guide says which files to read and which `SPECTRA_UX_SUMMARY` fields to look for in a
  dispatch log. The coordinator confirms that a test-only PR may use how_to_review.
- D5. The 1024 width is recorded although Q3 removed the 1024 CTA target (`INTENT.md:132-133`).
  Reason: it records a value and sets no target, and it is the table-layout width that UX-11 needs
  (`report.md:102-103`).
- D6. Section heights are reported per hook and never summed. Reason: `summary` is nested in
  `add-ons` (`renderers.ts:1227-1233`).

## Open questions

Need a CRP (owner):

- Q-1. Who produces the numbers? Either the owner dispatches `on-demand-specs` after each slice (only
  possible once `ci.yml` with `workflow_dispatch` is on the default branch,
  `on-demand-specs.md:45-47`), or the lab gets the chromium check of `lab-chromium.md`, which is still
  a spec (`lab-chromium.md:3`). Without one of them the slices merge with no printed numbers, and the
  proposal delivers no value yet.
- Q-2. Should `on-demand-specs` get a dispatch input that sets `PW_UX_STRESS_ALL=1`? It is a CI change,
  so a separate medium-risk slice. The default answer here: no, keep S5 for lab and local runs.

For the coordinator (not owner decisions):

- `openspec/` does not exist. Create the change with `openspec init`, or keep the earlier
  `docs/agent-work/<id>/spec.md` convention.
- Assign requirement ids if the change carries requirements (for example
  `req~ux-stress-lone-card~1` for S1).
- Confirm D4 (how_to_review for a test-only PR).

## Risks

- CI time: S3 multiplies the passes by 3 (5 variants plus the table pass, against 2 today), and S2 to
  S4 add a reveal, a text walk and an axe scan to each one. The job has a 40-minute global timeout,
  shared with the SPECTRA review spec (`ci.yml:285,302`). No `elapsedMs` value is recorded in the
  repository (the UX review gives none), so the cost is unmeasured. Mitigation: per-test budgets
  (S3), and the bounded steps already in the spec (`ux-stress.spec.ts:41-54`).
- No type check on `tests/` (`tsconfig.json:3-7`). A type error in a field shows up only at run time.
  Mitigation: the review. Followup: a `tsconfig.tests.json` with its own check.
- `revealAllRows` changes the DOM (`spectra.ts:97-121`). If it does not run last in a variant, it
  corrupts later readings. S2 states the order.
- The `layoutBreakdown` strings are up to 600 characters each (`spectra.ts:216-220`), so the log line
  gets longer. That is acceptable for a dispatch log.
