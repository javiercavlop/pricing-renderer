# Plan: prop-20261031-1b, ROADMAP and INTENT state refresh

- Branch: `chore/roadmap-intent-refresh-2`. Base: `f3302b2` (develop). Redo of closed PR 75.
- Type: docs only. Risk low. One slice, one PR into `develop`.
- Requirement ids: none. No behaviour and no OpenSpec requirement.

## Slice D1

Owns exactly five files:

- `ROADMAP.md`
- `INTENT.md`
- `docs/agent-work/pending-phases/handoff.md`
- `docs/agent-work/prop-20261031-1/plan.md`
- `docs/agent-work/prop-20261031-1/handoff.md`

Scope:

- Changeset count: 54 at `f3302b2`, in `INTENT.md` (Pending changesets), the ROADMAP Release
  section (appended; the owner's "45 at `47a7b05`" stays) and the Backlog row.
- ROADMAP UX review: intro, UX-1 and UX-2 partly done, UX-7 done, UX-9 gate recorded.
- ROADMAP Phases: 1a evidence, 1b partly done, Phase 3 in progress.
- `pending-phases/handoff.md`: dated update that the Phase 3 request and CRP-P3 are answered.

Out of scope: `intake.md` of this change, `INTENT.md` "Current focus", the "17 pending changesets"
answer to Q6, rows for #69 and #70, any code, test, spec or changeset.

## Checks

- `["pnpm", "install", "--frozen-lockfile"]`
- `["pnpm", "run", "format:check"]` (`prettier --check .`)
- Review check: every sha and PR against `git show --stat`; the count against
  `ls .changeset/*.md` without `README.md`.

## Gates

- G1, G2, G3, G6, G8, G12: not applicable (docs only, no spec, test, requirement or UI).
- G4, G9: not applicable (no frozen tests, no dependency change).
- G11: one reviewer, checking states, shas and the count.
- G13: how-to-review (read the rows named in the handoff).
- The PR is merged by the owner, because `INTENT.md` changes.
