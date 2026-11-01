# Handoff: prop-20261101-2 (record the UX-2 counts, close the UX-7 and UX-9 gates)

- Status: waiting on the coordinator (plan ready, no CRP needed). Updated: 2026-11-01.
- Branch / head: planner task `task/b1ba4020706841e9`, base `a82cd88`. PR: none.

## Goal

Keep the unit-level UX-2 counts in `docs/agent-work/ux-review/measurements.md`, and record UX-7 go
and UX-9 no-go there, so U9 leaves the `renderers.ts` chain. This serves INTENT O1.

## State (with evidence)

- The proposal is approved by the owner. Its evidence reproduces (intake E1-E7).
- TOTAL line confirmed with `ci_log`: job 123038640831 = PR #72 `quality (22)`, merge ref
  `a5d378c` (PR head `936631a`). `addOnOnlyRowsMisleading` 137 (81 real in 14 fixtures, 56 stress),
  `planDescriptionsFiller` 0, `addOnDescriptionsFiller` 0, `addOnsNotAvailableForSelectedPlan` 231,
  `rowsAboveRendererCapInGroups` 3032, 62 fixtures.
- The same TOTAL appears on PR #74, job 124964849166, merge ref `738d087`.
- The filler rule matches: `ux-counts.test.ts:53-55`, `renderers.ts:253-257`, `report.md:532`.
- The intake is written: `docs/agent-work/prop-20261101-2/intake.md`, with slices D1 and D2.
- No code, test, spec or acceptance file was changed.

## Decisions

- D1 copies the 63 `UX_COUNTS` lines verbatim. Reason: no transcription errors, and the CI logs
  expire.
- D1 runs `vitest run tests/unit/ux-counts.test.ts` as a check. Reason: it records the same numbers
  in the lab on the base, independent of the CI logs.
- UX-7 is recorded as go, "already approved as P-20261101-1", not as newly unblocked. Reason:
  `prop-20261101-1/intake.md:3-5`.
- `addOnOnlyRowsMisleading` is defined as rows at the default selected plan. Reason:
  `ux-counts.test.ts:94-98`; P-20261101-1 adds the cell metric.
- No feature flag and no CRP. Reason: docs only. The gates follow the planned rules
  (`plan.md:370-371,380`) and the approved proposal.

## Ruled out

- Citing "the head SHA" alone. The job ran on the merge ref `a5d378c`, not on `936631a`.
- Writing the missing UX-2 parts now. They are test code in `ux-counts.test.ts`, which
  P-20261101-1 T1 owns.

## Open questions and risks

- Q1: include D2 (`ROADMAP.md` and `plan.md` status lines)? Recommended: yes, in the same PR. This
  is the coordinator's call.
- Q2: register the vitest check for D1. Recommended: yes.
- Risk: UX-9 no-go rests on 62 fixtures. A new fixture with fillers reopens it.
- Risk: `ROADMAP.md` or `plan.md` may be owned by another task in flight. Check before D2.
- G5, G7 and G10 are not defined in the files read. The coordinator applies its registry.

## Next three steps

1. The coordinator creates the D1 contract (doc-steward, owns
   `docs/agent-work/ux-review/measurements.md`). Its checks are the vitest and prettier argv in the
   intake. It decides Q1 and Q2.
2. The doc-steward reads `ci_log` 123038640831, runs the vitest check, confirms the TOTAL line, and
   writes the six content items of D1.
3. If Q1 is yes, D2 updates `ROADMAP.md:93-94,107-115` and `plan.md:364-380,505`, and both slices go
   in one PR with a how-to-review (G13 N/A).

## Evidence

- Files read: `docs/agent-work/pending-phases/plan.md:340-529`,
  `docs/agent-work/ux-review/report.md:360-559`, `tests/unit/ux-counts.test.ts`,
  `src/element/renderers.ts` (grep `rowDescription`, `plan|addOn.description|name`),
  `docs/agent-work/prop-20261101-1/intake.md`, `docs/agent-work/prop-20261101-1/handoff.md`,
  `ROADMAP.md:14,80-129`, `.prettierignore`, `package.json:133-139`.
- CI: `ci_log` 123038640831 (PR #72), `ci_status` PR #74 (all success), `ci_log` 124964849166.
- Checks: none registered for this task, and none run.
