## State

- PR 83 (PR A) holds P3-2T/P3-2 (element uses core selection, transitive dependsOn fix, patch changeset) and P3-3T/P3-3 (core search params, minor changeset). Head f0d7f74 was pushed.
- Panel round 1: reviewer asks for changes (one major: CI quality red on prettier of this handoff file, now fixed by this checkpoint; minor: element changeset wording, scalar-parent path rule missing in the spec; nit: search-params changeset wording). Test-reviewer approves with two minors (add `false` to the falsy table, add a deselect-chain element test) and four nits.
- One fix task is submitted for the minors, the spec clause (new revision of req~search-params-var-path-safe), the changeset wording and the two review files.

## Next

1. Integrate the fix task, push, wait for CI green on all browser shards.
2. Panel round 2 on the new head (reviewer and test-reviewer), then set_review_package and lead_ready.
3. PR B: P3-4 and P3-5.

## Risks

- Element refactor: the selection in effect is a deep copy when variablesEnabled is true (no caller depends on identity).
- Known edge-case differences from 0.1.0 (prototype-named ids with error prices, self dependsOn) are listed in the changeset after the fix.
