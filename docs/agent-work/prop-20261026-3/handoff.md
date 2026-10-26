# Handoff: prop-20261026-3

- Status: waiting-review (intake done, no code yet) · Updated: 2026-10-26
- Branch / head: task/6a5b999848c4407d / base `3841e7c` · PR: none

## Goal

Keep keyboard focus inside the renderer when "Show N more" disappears in the comparison or in the
add-on grid (P-20261026-3, INTENT O2, `INTENT.md:44`).

## State (with evidence)

- Intake written: `docs/agent-work/prop-20261026-3/intake.md` (objective, scope, non-goals,
  requirement drafts, slices S1 and S2, gates, decisions D1-D6).
- Bug confirmed in code: `_revealGroup` at `src/element/pricing-renderer-element.ts:804-807` and
  `revealAddOns` at `:881-884` move no focus. The buttons exist only while rows or cards are hidden
  (`src/element/renderers.ts:732-744,819-835,1188-1198`).
- No test covers focus after "show more" (focus assertions only at
  `tests/browser/pricing-renderer.spec.ts:317,329,740,1703-1718,1797`).
- No code, test or spec has been changed.

## Decisions

- One PR, two tasks: S1 test-designer (`tests/browser/reveal-focus.spec.ts`), then S2 implementer
  (`src/element/pricing-renderer-element.ts`, `src/element/renderers.ts`, `src/styles/base.css`,
  `.changeset/reveal-focus.md`). Reason: a failing test must not merge alone, and the ownership is
  disjoint.
- Focus the row or card itself, with `tabindex="-1"` set only on the target by the handler. Reason:
  rows have no control, and cards have one only with selection enabled (`renderers.ts:798-814,
  1041-1066`). Rendered markup stays the same for the unit regex tests.
- Pass the clicked button to the internal `revealGroup` as an optional second argument. Reason: the
  table `<tbody>` has no id (`renderers.ts:780`). `RenderActions` is not exported, so this is not
  public API.
- First newly shown add-on is computed from the visible ids before the reveal, not as index 8.
  Reason: selected add-ons beyond the cap are already shown (`renderers.ts:1162`).
- No feature flag and no CRP. Reason: one capability, no attribute, property, event or part change
  (`INTENT.md:106-107`).
- Risk low for both slices (S1 score 0, S2 score 0-1). See the intake for the medium case.

## Ruled out

- Keeping the button in the DOM as a disabled status: changes markup and host styling (proposal
  alternative).
- Announcing through a live region only: focus is still lost, and counters are already
  `aria-live="polite"` (`renderers.ts:673,1179`).
- Adding `tabindex="-1"` to every row and card at render time: changes the rendered HTML that unit
  tests match (`tests/unit/addon-grid-filter.test.ts:232`) and that hosts may style.
- Focusing only after keyboard activation: WebKit does not focus a clicked button, so the check
  would be unreliable.

## Open questions and risks

- No owner CRP needed. The owner may veto D4 (focus also on mouse click) and the new focus ring in
  review.
- `openspec/` does not exist at `3841e7c`. Waiting on the coordinator: run `openspec init` or use a
  `docs/agent-work/<id>/spec.md` spec as in earlier SPECTRA changes.
- The Playwright browsers (chromium, firefox, webkit) in the lab are not verified. Waiting on the
  coordinator. The S1 red-before and the S2 browser checks need them.
- Risk: `focus()` scrolls the page. Mitigation: the target renders where the button was. The only
  screenshot tests (`pricing-renderer.spec.ts:1330-1350`) do not press "show more". S2 reruns the
  two SPECTRA specs that click these buttons.
- Risk: a reveal that clicks several groups in one tick (`spectra-addon-marker.spec.ts:48`) leaves
  focus on the last target. That is harmless, and the S2 regression check covers it.

## Next three steps

1. The coordinator creates the change from `intake.md`: final requirement ids for the three drafts,
   then the S1 contract with its red-before check.
2. The test-designer writes `tests/browser/reveal-focus.spec.ts` (Okta add-ons at 1440; ClickUp
   table at 1440 and compact at 375; keyboard activation; all three browsers). The coordinator then
   freezes it (G4).
3. The implementer does S2 per D1-D5 and runs the S2 checks listed in the intake, then one reviewer
   and ui-qa review, and the how-to-test guide is written for G13.

## Evidence

- Tasks: this planner intake (task/6a5b999848c4407d). No other task yet.
- Heads: base `3841e7c`. CI: none for this change.
