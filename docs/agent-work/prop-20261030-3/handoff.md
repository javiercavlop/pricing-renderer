# Handoff: prop-20261030-3

- Status: waiting for the coordinator. Updated: 2026-11-01.
- Branch / head: `task/a32de69adf3947ac` / `019a4b8`. PR: none.

## Goal

Add Chromium screenshot baselines for dark mode and `dir="rtl"` at 375 and 1440 px, then record the
measured count in the O2 "Visual baselines" signal (`INTENT.md:56-57`).

## State (with evidence)

- Intake written: `docs/agent-work/prop-20261030-3/intake.md`. No code, test, spec or baseline
  changed.
- These parts of the proposal reproduce:
  - one `toHaveScreenshot` call, at `tests/browser/pricing-renderer.spec.ts:1344`;
  - 9 viewports (`:1323-1333`), Chromium only (`:1335`);
  - 18 baseline files, 9 of them `-linux`.
- Dark is guarded by assertions only (`theme-files.spec.ts:110-165`, `change-review-ui.spec.ts:630-643`).
- RTL has no test at all: a grep of `tests/` for `rtl`, `dir` and `direction` finds no RTL check.
  The proposal said RTL was covered by assertions; it is not (intake E5).
- Lab pixels are not proven to match CI. The lab checks use `--ignore-snapshots`, and the
  baselines come from GitHub runners (`docs/agent-work/ci-speed/lab-chromium.md:104-107`).

## Decisions

- Slices: C0 (lab calibration, coordinator), then V1 (new spec file and 4 baselines), then D1
  (INTENT signal). Reasons:
  - C0: F1;
  - V1 in a new spec file: the owned files are disjoint from the 1300+-line `pricing-renderer.spec.ts`;
  - D1 last: it records the final count and does not go stale.
- Dark is switched through the demo's `#theme` select, not through `renderer.theme`. Reason: the
  select also darkens the page (`examples/vanilla/src/main.ts:64-66`).
- RTL is set with `document.documentElement.dir`. Reason: the demo has no direction switch, and
  `docs/i18n.md:113` names this as the host contract.
- Tolerance: 0.025 at 375 and 0.015 at 1440. Reason: the existing loop
  (`pricing-renderer.spec.ts:1347-1353`).
- Risk is low (score 0) for every slice: tests or docs only. No feature flag.

## Ruled out

- Generating the baselines in the lab without calibration: unproven (`lab-chromium.md:106-107`).
- Pushing without baselines and taking the actual images from CI: the lookup could not confirm that
  the images can be retrieved (intake F7).
- Recording the count before V1 (the proposal's order): the value would be stale after V1.
- Adding the 4 cases to the loop in `pricing-renderer.spec.ts`: it shares the file and the snapshot
  folder with unrelated tests.

## Open questions and risks

- Q1, the baseline route: lab if C0 passes 9/9, otherwise an owner CRP for a one-off CI run.
- Q2, the baseline set (4 screenshots): approved in the proposal; owner.
- Q3, the signal threshold: owner, not blocking.
- Q4, requirement ids: coordinator or specifier.
- Q5, overlap of `INTENT.md` with P-20261029-2: coordinator.
- R3: the RTL test may find a real layout bug. If so, report it; never loosen the test.

## Next three steps

1. Coordinator: register and run the C0 check from intake section C0 in the lab, and record the
   9 results. If any fails, open the Q1 CRP with options (a) and (b).
2. Coordinator: create the OpenSpec change (capability `visual-baselines`, Q4). Then create the V1
   contract with the owned files, checks and G12 ui-qa step from intake section V1.
3. After V1 merges and Q5 is resolved: run D1 (doc-steward, `INTENT.md:56-57`, `format:check`).

## Evidence

- Intake: `docs/agent-work/prop-20261030-3/intake.md` (E1-E5, F1-F9).
- Lookup: Playwright `updateSnapshots` default `'default'` (missing snapshots are written, and the
  test fails). Confidence medium. Sources: playwright.dev/docs/api/class-testconfig and
  playwright.dev/docs/test-snapshots.
- No checks were registered for this task; none was run.
