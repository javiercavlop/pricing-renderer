Goal: Phase 3 PR2 (PR 74), core selection logic P3-1T/P3-1I.

State: pushed head 1df7d3ce failed CI only on format:check of this handoff.md (the double-underscore proto id was read as bold markup; it is now written in backticks). Panel round 3 (head 1df7d3ce): reviewer found R3-REV-001 major (applySelectionInput turns selected into a boolean and sets the quantity of an unselected entry to 0; the pre-change inline element code kept both as they were), test-reviewer found untested leading-zero and index-cap paths, security-auditor and arch-reviewer found no blocker.

Tasks 2e789e62 (apply-selection.test.ts) and 395912ef (selection-change.test.ts) were blocked only by that format failure on a file outside their scope; their diffs are right, but blocked tasks cannot be integrated, so they are replaced by new tasks with the same tests.

Baseline: applySelectionInput known entry was entry.selected ? {...entry, quantity: normalizeAddOnQuantity(pricing, id, entry)} : entry. getAtPath on arrays read Number(segment).

Decisions: no comparison tasks by workers without Bash. Write handoff text so that prettier accepts it (no bare double underscores).

Next: integrate both replacement test tasks; submit the source task on src/core/apply-selection.ts only (selected truthy keeps the entry with a normalized quantity, unselected stays as is, keep isRecord guards, drop Boolean coercion and the quantity-0 fallback); push; update PR body; round 4 panel (reviewer, test-reviewer, short security and arch re-check); set_review_package; lead_ready. A failing round 4 means escalate.

Open owner decisions (CRP crp-pr-phase3-g4-size; not waived): G4 T/I separation, size.

Note: prop-20261101-1 waits for this merge.
