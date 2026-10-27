# Handoff: prop-20261027-1

- Status: waiting-review (intake done, no code yet) · Updated: 2026-10-27
- Branch / head: task/455b67d082df4b8f / base `595ad24` · PR: none

## Goal

Print the UX-1 measurements in the on-demand UX stress spec and fix the `loneLastCard` artifact,
test-only (P-20261027-1, INTENT O1, `INTENT.md:26`; UX review `report.md:341-371`).

## State (with evidence)

- Intake written: `docs/agent-work/prop-20261027-1/intake.md` (objective, verified facts, scope,
  non-goals, interface contract, slices S1-S5, gates, decisions D1-D6, open questions, risks).
- Artifact confirmed: `tests/browser/ux-stress.spec.ts:223` has no `gridColumns` term.
- `cardWidths`, `firstCtaBottom` and `layoutBreakdown` are already returned by `measurePlanGrid`
  (`tests/browser/helpers/spectra.ts:224-238`) and not printed (`ux-stress.spec.ts:219-224`).
- The browser spec is on demand only (`playwright.config.ts:15-18`, `.github/workflows/ci.yml:282-302`).
  The new unit test will run on every PR (`vitest.config.ts:6`, `ci.yml:47`).
- No code, test or spec has been changed.

## Decisions

- Five sequential slices, all owning `tests/browser/ux-stress.spec.ts` in turn; no feature flag.
  Reason: one shared file; the added fields are read by no gate (`ci.yml:235-237`).
- The pure functions `loneLastCard(gridColumns, cardsPerRow)` and `inViewports(px, vh)` go in
  `tests/fixtures/stress/metrics.ts`. Reason: vitest cannot load `spectra.ts` (`spectra.ts:6-9`).
- G3 N/A for S1. Reason: a new module fails at import on the base, which G3 rejects; the 1-column
  unit case proves the fix.
- G13 N/A with a how_to_review guide. Reason: no UI, API or runtime change (to confirm).
- Section heights per `data-pr-part` hook, never summed. Reason: `summary` is inside `add-ons`
  (`src/element/renderers.ts:1227-1233`).
- 1024 is recorded although Q3 dropped its target (`INTENT.md:132-133`). Reason: it records a value
  only, and UX-11 needs the table width (`report.md:102-103`).
- All slices low risk (score 0, tests only).

## Ruled out

- Putting `loneLastCard` in `tests/browser/helpers/spectra.ts`: vitest cannot import it, and four
  other specs share it.
- Parallel slices: every item edits the same spec file.
- Changing `ci.yml` for the full fixture set inside this change: CI is a risk area (+3, medium); it is
  open question Q-2.
- Asserting any target: that is UX-10, after owner thresholds and a variance estimate.

## Open questions and risks

- Q-1 (owner CRP): how the numbers get produced. Either a `workflow_dispatch` run (needs `ci.yml` on
  the default branch, `docs/agent-work/ci-speed/on-demand-specs.md:45-47`) or the lab chromium check
  (still a spec, `docs/agent-work/ci-speed/lab-chromium.md:3`). Without one, the slices merge with no
  numbers.
- Q-2 (owner CRP): a dispatch input for all 6 shapes in `ci.yml`. The default answer: no.
- Coordinator: `openspec/` does not exist; the requirement ids; confirm how_to_review for a test-only PR.
- Risk: CI time grows (5 variants plus a table pass, a reveal, a text walk, axe). There is no
  recorded `elapsedMs`. The job's global timeout is 40 minutes, shared with the SPECTRA review spec
  (`ci.yml:302`). Mitigation: a per-test budget in S3.
- Risk: `tests/` is not type-checked (`tsconfig.json:3-7`). Mitigation: the review. Followup:
  a tests tsconfig.

## Next three steps

1. The coordinator creates the change from `intake.md` and the S1 contract (owns `metrics.ts`,
   `tests/unit/ux-stress-metrics.test.ts`, `ux-stress.spec.ts`, the stress README; checks listed in
   the intake), and sends the Q-1 CRP to the owner.
2. The implementer does S1 per the interface contract and the unit cases in the intake. One reviewer
   checks the 1-column case against the old expression at `ux-stress.spec.ts:223`.
3. After S1 merges, a dispatch or lab run records the new `SPECTRA_UX_SUMMARY` fields, including
   `elapsedMs`, to size S3. Then S2, S3, S4 and S5 run in order.

## Evidence

- Tasks: this planner intake (task/455b67d082df4b8f). No other task yet.
- Heads: base `595ad24`. CI: none for this change.
