# Handoff: prop-20261103-3 (P3-3, selection search params)

- Status: waiting-review (intake done; the coordinator plans the tasks).
- Updated: 2026-11-03.
- Base: `c0c926d`. Task branch: `task/2d40bb5b7017406b`. PR: none.

## Goal

Ship P3-3 of `add-react-headless` (`tasks.md:129-143`) as two PRs:

- PR A adds the core functions `selectionToSearchParams` and `selectionFromSearchParams`, with
  their red-first tests.
- PR B adds the four URL-input limits.

## State (with evidence)

- Intake written: `docs/agent-work/prop-20261103-3/intake.md`.
- The P3-1I prerequisite is merged: `src/core/index.ts:8-19` exports `applySelectionInput`, the
  five selection functions and `createPriceStabilizer`.
- `src/core/search-params.ts` does not exist yet. Spec: `specs/search-params/spec.md`, with 20
  requirements.
- No code has been written. No checks are registered for this intake.

## Decisions

- Keep the existing OpenSpec change `add-react-headless` and open no new one. Reason: the spec is
  merged in #73 (`ROADMAP.md:198`), and tasks.md already defines P3-3.
- Two PRs, each with T, I and G tasks: A-T, A-I, A-G, then B-T, B-I, B-G. Reason: the owner's
  note of 2026-11-03 and `tasks.md:139-143`.
- No feature flag. Reason: design.md D10 (`design.md:447-451`) and the release hold
  (`ROADMAP.md:169-176`).
- The diagnostic id cut is done in `search-params.ts` on the diagnostics that
  `applySelectionInput` returns. Reason: `apply-selection.ts:35,73-74` writes the full id, and the
  change is additive only (`tasks.md:15`).
- Risk is medium for A-I and B-I (score 5: public API +3, external input +2) and low for the T and
  G tasks.

## Ruled out

- Changing `setAtPath` or `cloneValue` for the reader. Reason: `design.md:141-142` says the reader
  keeps its own stricter rules, and existing exports stay unchanged.
- Starting with P3-5 or P3-2. Reason: the owner approved P3-3 (the proposal's alternatives).

## Open questions and risks

- Q1, a CRP only if needed: PR A is estimated at about 330-470 lines. If it stays over about 300
  after table-driven tests, the owner chooses between a waiver (my recommendation) and a further
  split that puts the writer first.
- Q2, no CRP recommended: the interim no-throw gap for very deep values between PR A and PR B (R1:
  `cloneValue` is recursive, `utils.ts:60-70`). It is covered by the release hold.
- In B-T, the entry-limit test must use a generator that stops by itself and counts its pulls.
  Otherwise the red check hangs.

## Next three steps

1. The coordinator creates the A-T, A-I and A-G contracts from intake.md "Slices". It registers
   the `red` check with the overlay `tests/unit/selection-search-params.test.ts`.
2. Run A-T (red-before G3), then freeze it (G4). Run A-I and A-G, measure the PR A diff against
   Q1, and get the review panel with a security-auditor.
3. After PR A is merged, run B-T, B-I and B-G on the same files. PR B must merge before any
   release.

## Evidence

- Proposal P-20261103-3. Owner approval: the note of 2026-11-03.
- Files read: `openspec/changes/add-react-headless/{tasks.md,design.md,specs/search-params/spec.md}`,
  `src/core/{index.ts,apply-selection.ts,utils.ts}`, `ROADMAP.md`, `INTENT.md`.
- Tasks: this intake only. Checks: none.
