# Handoff: prop-20261031-1b

- Status: review round 1 fixed, waiting round 2 · Updated: 2026-11-02
- Branch / head: chore/roadmap-intent-refresh-2 / base `f3302b2` · PR: 80

## Goal

Bring the ROADMAP state rows and the changeset count in ROADMAP and INTENT up to date with develop at
`f3302b2`. This redoes closed PR 75: per the owner on 2026-11-02, a new PR from current develop with
only the real changes. The intake and handoff of prop-20261030-1 and prop-20261101-1/-2/-3 are
already in develop and stay as they are.

## State (with evidence)

- Count: 54 `.changeset/*.md` files besides `README.md` at `f3302b2`. Now in `INTENT.md` (Pending
  changesets), ROADMAP Release (appended) and ROADMAP Backlog.
- ROADMAP UX review:
  - Intro: U1a and U2 merged (#72, `07f10bf`); UX-7 done; unit measurements recorded (#78, `112428e`).
  - UX-1 partly done: U1a present (with `sectionHeightsInViewports` and `cardWidths`); U1b absent
    (`measureText` is not in `tests/browser/ux-stress.spec.ts`, grep). Section height values are
    unrecorded (M1).
  - UX-2 partly done. Present: part (d), part of (b) (`addOnOnlyRows`, `addOnOnlyRowsMisleading`,
    `addOnMarkerCellsMisleading`, added with UX-7 in #76), part of (c) (descriptions missing and
    filler). Missing: (a) all unit counts, (b) mixed rows and the total of cells shown with the
    marker, (c) rows with no description, rows filtered as filler, length maximum and median.
    Checked against `ux-report.md:373-393` and `tests/unit/ux-counts.test.ts:21-38` (`UxCounts`) and
    `:186-203` (returned fields).
  - UX-7 done: #76 `9c0551e`, `.changeset/addon-marker-availability.md`, tagged test in
    `tests/unit/ux-counts.test.ts:268`.
  - UX-9 stays not started, with the no-go gate (`measurements.md`, #78).
- ROADMAP Phases: 1a gets the L2 evidence (`docs/design-systems.md:215`, #71 `88f5141`); 1b partly
  done (B1, B5; `docs/nextjs.md` absent; handoff waits on CRP-1 and CRP-2); Phase 3 in progress
  (#73 `09363ed`, #74 `ee91c18`; no later slice: only `core-selection-logic.md` is a Phase 3
  changeset).
- `pending-phases/handoff.md`: dated update line (2026-11-02) for the Phase 3 request and CRP-P3.
- Not verified here: the task had no shell. I could not run `git log` or `git show --stat`. #74, #76
  and #78 come from the session's recent log. #71, #72 and #73 come from repository files that quote
  the merge subjects (`prop-20261031-1/intake.md:7-11`, `phase3-react-headless/intake.md:4`,
  `prop-20261101-3/handoff.md:25`). The reviewer confirms them with git.
- Check results: see the task result block (`format:check`).

## Decisions

- Keep the owner's "45 at `47a7b05`" in Release and append "54 pending at `f3302b2`" — reason: the
  line records the 2026-10-27 decision.
- Count on the own base — reason: the number moves with each merge.
- UX-7 is written as done (#76), not "in progress" as the coordinator's brief said — reason: the tree
  shows the merge. The owner approval via P-20261101-1 is named.
- UX-2 is partly done, with the missing parts named — reason: the test file lacks them.
- No U1b PR number — reason: none exists in the tree.

## Ruled out

- "Phase 3: PR 73 open" — #73 is merged at `09363ed`.
- Rows for #69 and #70, and an edit of INTENT "Current focus" — outside the request.
- Editing the "17 pending changesets" answer in INTENT Q6 — it is a dated answer.

## Open questions and risks

- Drift returns with each merge. Mitigation: each slice updates its own row.
- A sha or PR could be wrong. Mitigation: reviewer G11 with git.
- Conflict with other PRs editing `ROADMAP.md`. Mitigation: rebase on develop.

## Next three steps

1. Reviewer round 1 (G11) found: U1b wrongly listed as "section heights"; UX-2 part (b) lacked the
   total of marker cells and credited `addOnMarkerCellsMisleading` to #72; the Release line altered
   the owner's text; this handoff had wrong PR and line ranges. All fixed. Round 2: re-check.
2. CI was green on `3756c6b` (before these fixes); it must pass again.
3. The owner merges, because `INTENT.md` changes.

## Evidence

- Base `f3302b2`. Files: `ROADMAP.md`, `INTENT.md`, `docs/agent-work/pending-phases/handoff.md`,
  `docs/agent-work/ux-review/measurements.md`, `docs/agent-work/phase3-react-headless/{intake,plan}.md`.
- Check: `pnpm run format:check` (see result block).
