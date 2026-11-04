## State

- PR 83 (PR A): P3-2 (element uses core selection) and P3-3 (core search params). Round-1 panel fixes are integrated (tests, spec revision var-path-safe~3, changesets, review notes, design and tasks references). Head 4fb4c88, pushing next.
- Round 1: reviewer changes-requested (CI format of the handoff, now fixed); test-reviewer approve.

## Next

1. Push, wait for CI green on quality and all browser shards.
2. Panel round 2: reviewer and test-reviewer on the new head, then set_review_package and lead_ready.
3. PR B: P3-4 and P3-5.

## Risks

- Element refactor: the selection in effect is a deep copy when variablesEnabled is true.
- Edge-case differences from 0.1.0 (self dependsOn, prototype-named ids) are named in the changeset.
