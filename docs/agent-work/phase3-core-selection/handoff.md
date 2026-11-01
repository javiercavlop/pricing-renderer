Goal: Phase 3 PR2 (PR 74), core selection logic P3-1T/P3-1I.
State: head a74f31ae plus this checkpoint commit: tests 0370efd1, source fixes cb68d418 (prototype-safe paths, Map stabilizer, null add-on entries, changeset sentence, P3-2 notes), index-cap tests a4bb7a92. All green by task checks; CI of the new head pending after push.
Open owner decisions (CRP crp-pr-phase3-g4-size, no default; not waived by me): G4 T/I separation (implementer-role tests in a separate task, red check before code, test-reviewer review) and size above the 300-line split rule (~950 lines with tests, ~290 source).
Decisions: transitive closure in core, element fixed in P3-2 (patch changeset, mandatory two-level element test, Boolean(variablesEnabled)).
Next: push, pr_update body with the two open points, panel round 2 (reviewer, test-reviewer, security-auditor, arch-reviewer) on the pushed head, then set_review_package and lead_ready (state the open owner points in the summary).
Note: prop-20261101-1 waits for this merge.
