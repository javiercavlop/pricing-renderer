# Handoff: prop-20261025-1

- Status: waiting-review (intake done, waiting for the coordinator and the owner) · Updated: 2026-10-25
- Branch / head: task/08028d6e811d49d9 / base bea3f5c · PR: none

## Goal

Draft `INTENT.md` and `ROADMAP.md` for the owner to approve (objective O0, "INTENT.md missing").

## State (with evidence)

- Intake written: `docs/agent-work/prop-20261025-1/intake.md` (scope, non-goals, slices S1/S2,
  gates, questions).
- Checked: no `INTENT.md`, `ROADMAP.md`, `constitution.md`, `.agentic/` or `openspec/` at `bea3f5c`
  (glob, no match).
- Proposal evidence checked: `README.md:9-35`, `report.md:75-95`, `report.md:108-121` and
  `docs/audit-report.md:38-41,72-75` match what the proposal says.
- Proposal corrected: items 2 (#48, `5b00315`), 3b (#49, `c75bbeb`) and 7 (#50, `bea3f5c`) are
  merged, and #47 (`144b5ef`) is merged, not open. Only item 9 and the expanded-state height check
  are not started. 3a shipped for English only (`.changeset/plural-units.md:5-7`).

## Decisions

- Two slices with disjoint files: S1 `INTENT.md`, S2 `ROADMAP.md`. Reason: one artifact per slice,
  each under 300 lines.
- Objective ids O1-O4 are fixed in the intake. Reason: S2 can be written in parallel. Merge S1
  first so ROADMAP never cites a missing id.
- No feature flag. Reason: docs only, nothing user-visible.
- Risk is low for both slices (score 0: docs only). Reason: the mrp-builder risk table.
- Thresholds go in as owner questions, not targets. Reason: `report.md:77,91-95` calls them
  proposals for the owner.

## Ruled out

- Using the proposal's item states as given: they are out of date (see State).
- Reading PR titles #41-#45 through the repo tool: the planner role is refused
  ("this role cannot use repository operations"). `ci_status` gives no titles.

## Open questions and risks

- Q1-Q6 in `intake.md` ("Open questions that need a CRP"): waiting on the owner through a CRP.
- PR numbers #41-#45 are not verified: S2 checks them in `git log` or writes "PR not verified".
- No `openspec/` directory: the coordinator must init it or track this change without G1.
- G5 and G7 are not defined in the factory skills I could read: the coordinator maps them.
- Risk: the backlog followups come from earlier task reports and were not re-verified. S2 labels
  them that way.

## Next three steps

1. Coordinator: create the OpenSpec change (or decide on no G1), plus the S1 and S2 contracts from
   `intake.md` with the listed check arrays.
2. Coordinator: send the owner one CRP with Q1-Q6 and attach the drafts once S1 and S2 are written.
3. S2 author: confirm #41-#45 from `git log --oneline` before writing their rows.

## Evidence

- Task: planner intake 08028d6e811d49d9 (no registered checks; nothing run through qa_run).
- CI: `ci_status` PR #41 head `c2519e03`: success (audit, quality 22/24, browsers).
