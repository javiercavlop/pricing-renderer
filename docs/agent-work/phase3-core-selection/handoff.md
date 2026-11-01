Goal: Phase 3 PR2 (PR 74), core selection logic P3-1T/P3-1I.

State: all round 3 fixes are integrated (tests 91ef17f9 and 54bb9a5c, source add2a5b3: applySelectionInput keeps the baseline entry shape; selected truthy keeps the entry with a normalized quantity, unselected stays as is). The earlier CI failure on 1df7d3ce was only format:check of this handoff file (a bare double-underscore id read as bold markup), now avoided. Next head is pushed after this checkpoint.

Decisions: write handoff text so that prettier accepts it (no bare double underscores). Round 3 reviewer major (R3-REV-001) fixed by add2a5b3. Accepted risks for the PR body: clone depth and cycles from host input throw a catchable RangeError; proto-named ids in plain records in resolve.ts are a followup; open owner points G4 and size.

Next: push; pr_update body; panel round 4 on the pushed head (reviewer, test-reviewer, short security-auditor and arch-reviewer re-check); set_review_package; lead_ready. A failing round 4 means escalate.

Open owner decisions (CRP crp-pr-phase3-g4-size; not waived): G4 T/I separation, size.

Note: prop-20261101-1 waits for this merge.
