# Handoff: prop-20261031-3

- Status: waiting for the coordinator. Updated: 2026-11-01.
- Branch / head: `task/7f44e976adbd4210` / `a82cd88`. PR: none.

## Goal

Archive the four merged OpenSpec changes into living specs under `openspec/specs/`, with the
requirement text unchanged, so that new deltas and spec-drift audits have a baseline (O3,
`INTENT.md:62`).

## State (with evidence)

- Intake written: `docs/agent-work/prop-20261031-3/intake.md`. No code, spec or test changed.
- The proposal's box counts reproduce: 0/11, 0/4, 1/5 and 30/30 (intake E4).
- The merged code and tests exist for every change, so ticking is justified (intake E5).
  - PR 65, `e68e0bc`: `ROADMAP.md:158`.
  - PR 63, `2b79e45`: `ROADMAP.md:162`.
  - #70, `85bb102`: `plan.md:4`.
  - The number #69 is not in any repository file.
- `openspec/specs/` is absent. All deltas are ADDED only, and the 13 target capability names are
  disjoint (intake E1, F1 and F2).
- `add-react-headless` is already in the worktree (#73) and is in progress. It is out of scope.

## Decisions

- Slices: C0 (CLI precondition), then A1 (phase1a), then A2, A3 and A4 in parallel, one per change.
  Reason: archive is atomic per change, and the paths are disjoint (intake F2).
- Each slice writes a non-normative `## Purpose` per new living spec after the archive. Reason: the
  CLI writes a placeholder that `validate --strict` rejects (intake F3; lookup sources: OpenSpec
  `src/core/specs-apply.ts` and `src/core/validation/validator.ts`, branch `main`).
- A4 owns `.prettierignore:13-14`. Reason: its comment asks for the entry to be removed at the
  archive, and the moved paths would otherwise reach `prettier --check .` (intake F5).
- The size limit counts authored lines only. The copied spec text is checked by an equivalence diff.
  Reason: the CLI copies it, and the text is already accepted.
- No feature flag and no CRP, unless the CLI is missing (Q1 b).

## Ruled out

- Splitting A4 by capability: `openspec archive` works per change.
- Archiving `add-react-headless`: 2 of 21 boxes are ticked (`openspec/changes/add-react-headless/tasks.md:65,69`).
- Editing ADR 0001, the test comments or the ROADMAP for the moved paths in these slices: they are
  outside the archive's scope. They are followups.

## Open questions and risks

- Q1, CLI availability and version (N-spec, `plan.md:586`): waiting on the coordinator. It becomes
  an owner CRP only if the CLI is missing and a devDependency is proposed.
- Q2, keep the capability name `docs`: recommendation keep. Coordinator.
- Q3, A2-A4 in parallel: recommended. Coordinator.
- R1: the installed CLI may behave differently from the `main` branch the lookup read. Mitigation:
  `archive --help` in C0, and A1 goes first.
- R2: the archive output may fail `format:check`. Mitigation: `prettier --write` on the owned
  living specs (A1-A3), and the ignore entry (A4).

## Next three steps

1. Coordinator: register and run `["pnpm","exec","openspec","--version"]` and
   `["pnpm","exec","openspec","archive","--help"]`. Record the version. If the CLI is missing, raise
   Q1 (b) as a CRP.
2. Coordinator: create the archive task A1 (doc-steward, operation archive) with the owned paths and
   checks of intake section A1. It ticks the boxes, validates, archives, writes the Purposes, then
   validates the specs and checks the format.
3. After A1 merges, run A2, A3 and A4 as separate archive tasks, from intake sections A2-A4.

## Evidence

- Intake: `docs/agent-work/prop-20261031-3/intake.md` (E1-E7, F1-F9).
- Lookup: OpenSpec archive and validate behaviour, confidence medium, from
  `raw.githubusercontent.com/Fission-AI/OpenSpec/main/src/core/{archive,specs-apply}.ts` and
  `validation/{validator,constants}.ts`.
- No checks were registered for this task; none was run.
