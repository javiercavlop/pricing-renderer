Goal: close release.yml audit findings 3 and 4 now; finding 1 after owner decision (not started); finding 2 accepted.
State: S0 (05ece5d7), T1 (fae95516), I1 (729eeb07) integrated; branch head includes release.yml DIST_TAG env + latest|next guard, prepublishOnly = pnpm package:check, audit-report items 3 and 4 resolved, static test 5/5 green, check-release-ready passes.
Decisions: Q2 = pnpm package:check. G4 not usable (test is not under acceptance/). Spec has 3 reqs; req~release-npm-cli-verified~1 added with finding 1.
Open: push may be refused for Workflows: write (report exact message to coordinator); OFT trace of impl tags in .github unverified; INTENT/ROADMAP/docs/releasing.md updates are followups (out of scope).
Next: push, pr_open, review panel (reviewer, test-reviewer, security-auditor) on pushed head, set_review_package, lead_ready. Finding 1 only after coordinator note.
