## State

PR 50 is open on feat/spectra-addon-grid. Round 1 review fixes are integrated: element unit test, keyed add-on grid in filter mode, browser tests for the threshold attribute and for the search reset on load, docs part hooks, changeset wording.

## Followups not fixed (minor)

- Focus is lost when show-more disappears and when a card shown only because it is selected is deselected.
- An empty attribute value counts as 0 (documented); toolbar-threshold behaves the same.

## Next

1. Push this head and check CI, including the browsers job (first real run of the browser spec).
2. Run a round 2 panel (reviewer and test-reviewer) on the pushed head, the last round.
3. Mark the PR ready, set the review package and call lead_ready.
