# Handoff: prop-20261027-3

- Status: waiting-review (planner intake done) · Updated: 2026-10-27
- Branch / head: task/f3595faaa10f461f / base `595ad24` · PR: none

## Goal

Bring `ROADMAP.md` up to date: mark the on-demand SPECTRA spec row done, add the UX review
proposals UX-1 to UX-11 with their CRP flags, and point the phase 2 row to where its values will
come from (P-20261027-3, O4 and O1).

## State (with evidence)

- Intake written: `docs/agent-work/prop-20261027-3/intake.md`. Nothing implemented.
- On-demand job verified: `on-demand-specs` at `.github/workflows/ci.yml:282-311`, `if:` at `:283`,
  commit `0dfff01`. Roadmap row still open: `ROADMAP.md:86-87`, plus "the backlog row below
  stays" at `ROADMAP.md:77-80`.
- UX list verified: `docs/agent-work/ux-review/report.md:587-602` (table `:587-599`, dependencies
  `:601-602`). CRP: UX-4, 5, 6, 7, 8, 11. No CRP: UX-1, 2, 3, 9, 10. ROADMAP has no UX row.
- Phase 2 row `ROADMAP.md:62-65` matches `o1-remeasure.md:26` (no expanded values).

## Decisions

- One slice (S1, doc-steward, owns `ROADMAP.md` only, about 50-70 lines, risk low). Reason: one
  file, one capability (intake D1).
- Separate PR, not folded into PR 61. Reason: PR 61 edits INTENT and is waiting for the owner (D1).
- Keep the owner's Q6 record wording and append a pointer only (D2).
- Write "PR #58" only if the doc-steward confirms it with the repo tool. Otherwise write "merged, PR
  not verified". Reason: no file names PR 58 (`ROADMAP.md:14-15`) (D3).
- No feature flag (D4). UX rows use the state "not started", with CRP as a separate field (D5).

## Ruled out

- Editing `INTENT.md` (stale at `:56-60`, `:90-91`, `:137-141`): PR 61 owns INTENT for now.
- Adding the proposal's CI backlog titles (release timeout, persist-credentials, install bound,
  blob-report ignore) as roadmap rows: they are separate proposals.
- Refreshing `spectra-grid-and-text/handoff.md` (`ROADMAP.md:96`): not part of this proposal.

## Open questions and risks

- Q1 (owner, may be answered by merging S1): the UX rows as a full section (recommended), only the
  no-CRP ones, or one pointer line.
- Q2 (coordinator): P-20261027-2 has no file in the repository. Cite it in the phase 2 row only once
  it is approved and has an intake.
- Q3 (coordinator): does PR 61 touch `ROADMAP.md`? If yes, S1 waits or rebases.
- Q4 (coordinator): whether a docs-only change needs an OpenSpec delta (`openspec/` is absent).
- Risk: the UX report's threshold text predates the owner's Q2/Q3 answers (`ux-report.md:617-621`).
  Mitigation: S1 states that, and cites `ROADMAP.md:73-74`.

## Next three steps

1. The coordinator answers Q2-Q4 and writes the S1 task contract from `intake.md` (owns
   `ROADMAP.md`). The checks are `["pnpm","install","--frozen-lockfile"]` and
   `["pnpm","exec","prettier","--check","ROADMAP.md"]`.
2. The doc-steward runs S1: scope items 1-4 of the intake, re-checking every citation at its base.
3. One reviewer (G11), then a PR into develop with how_to_review. The owner merges it, since
   ROADMAP is owner-accepted.

## Evidence

- Tasks: this planner task (no checks registered) · Base: `595ad24` · CI: not run (no code).
