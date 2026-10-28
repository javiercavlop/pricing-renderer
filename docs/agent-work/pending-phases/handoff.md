# Handoff: pending-phases

- Status: waiting-review (audit and plan done; owner CRPs and two facts open) · Updated: 2026-10-28
- Base: `85bb102` (develop) · Branch: task/465e7f396b474e49 · PR: none · Plan: `plan.md` here

## Summary

1. Phase 1a is done: items 1-9 are merged with tests (PR 65). The leftovers are the archive of its
   OpenSpec change, a docs line for the theme builder, and two owner questions (O-1a, O-1b).
2. Phase 1b has not started: no guide, no SPHERE loader, no ETag hook. It waits on CRP-1 and CRP-2.
   The guides B1 and B5 can start now.
3. Phase 1c has not started: UX-1 to UX-11 are untouched. The measurements come first, and they need
   an `on-demand-specs` dispatch (N-CI).
4. Phase 3 cannot be audited: the request text is not in the repository (N-P3). Only an intake slice
   (P3-0) is planned.
5. `plan.md` slices the rest into about 30 slices of at most about 300 lines, in 8 waves. Two
   serialized chains own `renderers.ts` and `base.css`.

## State (with evidence)

- `docs/agent-work/inbox/` is absent. The audit used the 1a and 1b intakes, `ux-review/report.md`,
  `ROADMAP.md` and `INTENT.md`, and checked every item against the code (`plan.md` section 1).
- No code, spec or test changed. The task registered no check, so none was run.

## Decisions

- Every table in `plan.md` was written as a list. Reason: `docs/agent-work/pending-phases/` is not in
  `.prettierignore`, and CI runs `prettier --check .`.
- CRP-U3 asks for screenshots although the UX report says it needs no CRP. Reason: the narrow
  baselines move, and the owner rule says a visual default change needs a CRP with screenshots.
- The baseline PNG sets are owned per slice and serialized. Reason: they are the only committed
  screenshots (`pricing-renderer.spec.ts:1344`).

## Open questions

- Owner: CRP-1, CRP-2, N1 and N2; O-1a, O-1b and O-1c; CRP-U3 to CRP-U11; Q-F; the Phase 3 request
  text and CRP-P3 (`plan.md` section 3).
- Coordinator: whether a dispatch works (N-CI), and whether the `openspec` CLI is available (N-spec).

## Next three steps

1. Send the section 3 CRPs, and ask for N-P3 and the N-CI check.
2. Start wave 1 (A1, A2, B1, B5, U1a, U2), with the owned globs and checks of `plan.md` section 2.
3. After U1b and one dispatch run, write M1, then gate U3 to U11 on its numbers and the CRP answers.
