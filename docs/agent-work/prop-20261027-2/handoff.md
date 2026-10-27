# Handoff: prop-20261027-2

- Status: waiting-review (intake done, needs owner CRP QA before S2) · Updated: 2026-10-27
- Branch / head: task/70ea4da45bdd4b79 / base `595ad24` · PR: none

## Goal

Make the SPECTRA O1 signals readable for all 111 light `en` pairs from one on-demand CI run, and
record them in `docs/agent-work/visual-review-spectra/o1-remeasure.md` (INTENT O1, `INTENT.md:26-44`).

## State (with evidence)

- Intake written: `docs/agent-work/prop-20261027-2/intake.md` (slices S1-S4, gates, open questions).
- No code changed. No check registered or run for this task.
- Verified: each SPECTRA `report()` prints a summary line and a JSON line and attaches the JSON
  (`tests/browser/spectra-review.spec.ts:413-420`). The summary holds every O1 field (`:398-407`).
- Verified: the on-demand job runs only two specs on chromium (`.github/workflows/ci.yml:299-302`),
  167 `report()` calls in all (111 + 56, `spectra-review.spec.ts:501-529,617-655`). That is 334
  SPECTRA lines today and 167 after S1.

## Decisions

- Keep S1 (env-gated JSON line), although the on-demand tail may already be enough. Reason: the
  owner approved it, and it halves the lines, which leaves room for retries and the failure output
  of the dot reporter.
- The variable is named `SPECTRA_METRICS_LOG`, not `SPECTRA_METRICS_OUT`. Reason: `_OUT` is the unit
  test's output variable (`tests/unit/spectra-layout-metrics.test.ts:246`).
- No feature flag. Reason: nothing is user-visible, and S1 is complete alone.
- No `.github/` edit in the planned slices. `--max-failures=0` is optional S4, owner only (risk
  medium, CI config +3).

## Ruled out

- Reading the `browsers` job log again: SPECTRA no longer runs there (`playwright.config.ts:15-18`),
  and its tail held only 14 of 111 pairs (`o1-remeasure.md:6-8`).
- Agent download of the `on-demand-specs-report` artifact: there is no agent tool for it (proposal
  alternative).

## Open questions and risks

- QA, default branch and dispatch availability (R2-REV-004, `ci.yml:277-278`). Waiting on the owner
  via CRP. It blocks S2.
- QB, run S4 before the first dispatch or only on need. Waiting on the owner via CRP.
- QC, dispatch once before S1 to test the estimate. Coordinator decision.
- Risk: after 20 failed tests the run stops (`playwright.config.ts:35,38`). Mitigation: S3 records
  the exact coverage, and S4 if needed.
- Risk: the 1500-line fit is an estimate, not a measurement. Mitigation: S3 counts the lines found
  and never extrapolates.
- Fact from lookup (confidence medium): with only the html and github reporters, Playwright 1.55
  adds `dot` on CI, which prints test stdout (playwright v1.55.0 `src/runner/reporters.ts`).

## Next three steps

1. The coordinator turns S1 into a task contract and an OpenSpec change (requirement id optional),
   and sends CRP QA (and QB) to the owner.
2. The implementer does S1: owns `tests/browser/spectra-review.spec.ts` and
   `docs/agent-work/ci-speed/on-demand-specs.md`, with the checks listed in the intake.
3. After the S1 merge and the CRP answer, the owner dispatches `ci.yml` on develop. Then the
   doc-steward does S3: `ci_log` of `on-demand-specs`, then `o1-remeasure.md`.

## Evidence

- Tasks: this intake task (`70ea4da45bdd4b79`) · Heads: `595ad24` · CI: no run used.
