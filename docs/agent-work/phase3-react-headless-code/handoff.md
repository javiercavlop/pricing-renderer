## State
- PR A = P3-2T/P3-2 (element uses core selection, transitive dependsOn fix, patch changeset) + P3-3T/P3-3 (core search params, minor changeset). All four tasks integrated; head 12fbefb. Pushing to feat/react-headless and opening the PR next.
## Next
1. CI green incl. browser-shards (P3-2 risk: tests/browser/pricing-renderer.spec.ts :125-432, :1547-1600).
2. Panel: reviewer + test-reviewer (medium).
3. set_review_package, lead_ready. Then PR B: P3-4 and P3-5.
## Risks
- Element refactor: _effectiveSelection now returns a deep copy when variablesEnabled is true (no caller depends on identity).
