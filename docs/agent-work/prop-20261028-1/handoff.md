# Handoff: prop-20261028-1

- Status: waiting-review (intake done; CRP-1 and coordinator questions Q1-Q4 open) · Updated:
  2026-10-28
- Branch / head: task/f953231a382448f7 / base `9cf7e21` (planner task, uncommitted) · PR: none

## Goal

Make `ROADMAP.md` and `INTENT.md` match what is merged in `develop`. That covers item 9 done,
phases 0 and 2 done, phase 1a in progress, and 37 pending changesets. Proposal P-20261028-1,
objective O1.

## State (with evidence)

- The intake is written: `docs/agent-work/prop-20261028-1/intake.md`. It has the verified facts at
  `9cf7e21`, decisions D1-D8, slices S1 and S2, gates, CRP-1 and Q1-Q4.
- Commits verified in git log: `3072086` (item 9), `2b79e45` (phase 2), `9cf7e21` (phase 0).
- PR 64 and PR 63 are confirmed by files: `docs/agent-work/phase0-hygiene/handoff.md:1` and
  `docs/agent-work/phase2-subscription-change/review/ui-qa-r2.md:1`. #62 and #65 are not
  confirmed: no file names them, and the repo tool is refused to the planner role.
- `.changeset/` holds 37 `.md` changesets besides `README.md` (`config.json` is also there).
- No file other than this intake and handoff was written. No check was run, because the task
  registered none.

## Decisions

- Two slices and two PRs, run in parallel: S1 `ROADMAP.md`, S2 `INTENT.md`. Reason: S2 waits for
  the owner's text approval, and S1 does not need to (D1).
- PR numbers only when confirmed (`ROADMAP.md:14-15`). Otherwise "PR not verified" (D2).
- Counts are snapshots and records are kept. `ROADMAP.md:140` changes the number only.
  `INTENT.md:138` keeps "17" (D3).
- "in progress" is added to the ROADMAP state legend (D4). Phase 1 is split into 1a and 1b (D5).
- The SPECTRA phase 2 versus owner phase 2 clash is handled with one added line, not a heading
  rename (D6).
- No feature flag (D7). S2 cites ROADMAP by row name, not by line (D8).

## Ruled out

- One PR for both files. The INTENT CRP would block the ROADMAP facts.
- Rewording owner answer records (Q4, Q6, Release). They get pointers instead, as
  `ROADMAP.md:126` does.
- Writing #62 and #65 from the proposal or a commit subject alone. That would break the roadmap's
  own rule.

## Open questions and risks

- CRP-1 (owner): the INTENT text. The options are (a) the proposal's fixes, (b) also the other
  verified stale lines (Q5, release threshold, CI time, Q6 pointer), or (c) no INTENT PR.
  Recommended: (b).
- Q1 (coordinator): confirm #62 and #65 with `pr_get` before S1. Q2: does phase 1b have a PR?
  Q3: does this work need an OpenSpec change? Q4: keep S1's ci.yml citation refresh?
- Risk: other merges before S1 runs change the count of 37 and the line numbers. Mitigation: S1
  recounts `.changeset/*.md` and re-checks the citations when its base is not `9cf7e21`.
- Risk: PR 65 or a phase 1b PR merges while S1 is open, which would make the phase rows stale
  again. Mitigation: the reviewer re-checks the phase states on the PR head.

## Next three steps

1. Coordinator: answer Q1-Q4. Use `pr_get` 62 and 65 for Q1. Send CRP-1 to the owner with the
   options and the recommendation from the intake's "Open questions".
2. Run S1 (doc-steward, owns `ROADMAP.md`) and S2 (doc-steward, owns `INTENT.md`) in parallel,
   with the content lists and the prettier checks from the intake's "Slices".
3. Open one docs PR for each slice, with how_to_review. Merge S1 after review. Merge S2 only after
   the CRP-1 answer, with the text adjusted to the chosen option.

## Evidence

- Task: f953231a382448f7 (this planner intake). Base `9cf7e21`. CI: none (no push).
- Sources: `ROADMAP.md:14-15,51-60,68,75,126,137-176`,
  `INTENT.md:68-69,90-91,99,117-123,134,138-141`, `.changeset/spectra-item9-tags.md:1-5`,
  `.github/workflows/ci.yml:45,130-134,320-358`, `package.json:134`, and the phase 0, 1a, 1b, 2 and
  item 9 handoffs.
