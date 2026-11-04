# Reviewer, PR 83, round 1

Verdict: changes-requested.

## Findings

- R1-REV-001 (major): the CI `format:check` failed on the handoff file. Fixed by a checkpoint commit.
- R1-REV-002 (minor): the changeset of the element said "no other behaviour change" while two edge cases change. Fixed: the changeset names them.
- R1-REV-003 (minor): the spec did not say what happens to a non-digit segment under a scalar parent. Fixed: `req~search-params-var-path-safe` is now revision 3 with the clause, a scenario and a test.
- R1-REV-004 (nit): the search-params changeset said "64 characters". Fixed: it says UTF-16 code units, 63 before a surrogate pair.
