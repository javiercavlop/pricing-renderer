# Handoff: prop-20261101-1 (the "Add-on" marker follows `availableFor`, UX-7)

- Status: waiting on the coordinator (plan ready, no CRP to send now). Updated: 2026-11-01.
- Branch / head: planner task `task/650b9a6b2da54a4c`, base `09363ed`. PR: none.

## Goal

A comparison cell says "Add-on" only where a providing add-on can be bought on that cell's plan.
Target: 0 misleading marker cells in the SPECTRA and stress fixtures. This serves INTENT O1.

## State (with evidence)

- The proposal is approved by the owner, and that approval answers CRP-U7 (`plan.md:557-559`).
- The intake is written: `docs/agent-work/prop-20261101-1/intake.md`, with slices S0, T1 and I1.
- Defect confirmed:
  - `src/core/view-model.ts:611-620` ignores `availableFor`.
  - `src/element/renderers.ts:804,826,907,922` pass one per-row boolean to every cell.
- The 81 count is confirmed. PR #72 CI, head `936631a`, job `quality (24)` (id 123038643751),
  `UX_COUNTS` lines: 81 rows in 14 SPECTRA fixtures, plus 56 in the stress fixtures.
- No code, test, spec or acceptance file was changed.

## Decisions

- Three slices: spec (S0), tests (T1) and code (I1). Reason: the change is one capability of about
  40 code lines, but three test files encode the old R3.
- T1 and I1 land in the same PR. Reason: T1 is red by design, so it cannot merge into develop
  alone.
- No feature flag. Reason: there is one behaviour slice, and a flag would be a public attribute,
  which R7 forbids.
- `isAddOnOnlyRow` stays as it is. The new `addOnProvidesForPlan` is exported from
  `view-model.ts` only. Reason: R7, and `src/core/index.ts:27-35` re-exports by name.
- Add a cell-level metric `addOnMarkerCellsMisleading` to `ux-counts.test.ts` and keep
  `addOnOnlyRowsMisleading`. Reason: the old metric uses `isAddOnOnlyRow`
  (`ux-counts.test.ts:94-98`), so it would stay at 81 after the fix.
- I1 risk is low (score 1). It would be medium if the coordinator counts the "pricing" risk area.

## Ruled out

- Only adding a red-first case, as the proposal's first slice implies. These existing assertions
  encode the old R3 and would fail on I1's PR:
  - `addon-marker.test.ts:616-626`;
  - `spectra-addon-marker.spec.ts:224-227,236-238,250`, which runs on the PR browser shards
    (`ci.yml:142-161`, `playwright.config.ts:15-17`).
- Relying on the proposal's baseline reason ("the demo has no restricted add-ons"). It is false
  (`acme-pricing.yml:98-123`). The baselines are safe for another reason: the demo has no
  add-on-only row (`addon-marker.test.ts:361-368`).

## Open questions and risks

- Q1: a SPECTRA row may end up with no plan that can buy a providing add-on. Then R9's marked-row
  counts drop. T1 case 5 measures this. If it happens, send a CRP; option A, amend R9, is
  recommended. If it does not, no CRP is needed.
- Q2: changeset bump. Patch is recommended. The coordinator decides.
- `src/element/renderers.ts` is shared with other UX slices (U9 per `plan.md:390`). Serialize them.
- The UX report's refs at `report.md:486-490` are stale, and `:496` should name the new cell
  metric. This is a followup for a docs task.
- G5, G7 and G10 are not defined in the files read. The coordinator applies its registry.

## Next three steps

1. The coordinator creates task contracts from the intake's slices. It confirms that
   `pnpm exec openspec` is available for G1 and that no in-flight change owns
   `src/element/renderers.ts`.
2. A specifier runs S0: `openspec/changes/addon-marker-available-for` plus in-place edits of item 6
   R1, R3, R7, R9, AC2 and AC7, then G1 and G2.
3. A test-designer runs T1 (three test files, with the red-before check on the unit files) and
   reports the measured marked-row counts (Q1). Then I1 runs, and the PR's browser shards prove
   the browser spec.

## Evidence

- Files read:
  - `src/core/view-model.ts:570-625`, `src/core/index.ts`,
    `src/element/renderers.ts:199-229,770-1030`;
  - `tests/unit/addon-marker.test.ts`, `tests/unit/ux-counts.test.ts`,
    `tests/browser/spectra-addon-marker.spec.ts`;
  - `docs/agent-work/spectra-item6-addon-marker/spec.md`, `docs/agent-work/ux-review/report.md:470-514`,
    `docs/agent-work/pending-phases/plan.md:134-143,385-399,540-574`;
  - `.github/workflows/ci.yml:140-169`, `playwright.config.ts`,
    `tests/fixtures/spectra/mailchimp/2024.yml:757-816`.
- CI: PR #72 check runs all success (ci_status). Job 123038643751 log, `UX_COUNTS` lines.
- Checks: none registered for this task, and none run.
