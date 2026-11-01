Goal: UX-7 add-on marker follows availableFor (per plan cell), no flag, no public API change.
State: S0 spec (openspec/changes/addon-marker-available-for), T1 tests, I1 code (addOnProvidesForPlan in view-model.ts, used at both cell call sites in renderers.ts, patch changeset) all integrated. Review round 1 (ff407ab30d3f44c0): 1 major (4 scenario tests missing) fixed by task 7cea90a49b034367 (integrated, head 3a9aa28 before this checkpoint commit); unit 72 tests and lint/typecheck pass. Q1 not triggered.
Decisions: helper exported from view-model.ts only, not from core/index. Round 2 review on the final head; panel is a reviewer (risk low).
Open: PR 76 conflicts with develop only in docs/agent-work/prop-20261101-1/handoff.md; coordinator will sync it once ready (note at wake 12). Do not merge develop.
Next: push, CI on new head, round 2 reviewer, pr_ready, set_review_package, lead_ready.
Evidence: tasks 99e83e18 (I1), bf627621 (T1), 9d954cca (S0), 7cea90a4 (fix), review ff407ab3; CI green on 115c762.
