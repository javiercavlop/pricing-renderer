# Handoff: prop-20261026-2

- Status: waiting-review (intake done; waiting for the coordinator, QA and QB for the owner) ·
  Updated: 2026-10-26
- Branch / head: task/f8030dcf19924627 / base 3841e7c · PR: none

## Goal

Report the expanded-state renderer height (`rendererHeightInViewportsExpanded`) next to the
collapsed one in the SPECTRA browser metrics at 1440 and 375, report-only. Objective O2
(`INTENT.md:56-57`), input to Q2.

## State (with evidence)

- Intake written: `docs/agent-work/prop-20261026-2/intake.md` (scope, non-goals, slice S1 plus the
  optional S2, gates, questions).
- Proposal evidence checked and correct: `spectra-review.spec.ts:6`, `report.md:182-183,422,581-583`,
  `ROADMAP.md:62-65,91-92`, `INTENT.md:139-141`, `spectra-addon-marker.spec.ts:32`,
  `ci.yml:63-77`.
- Not started in code: no expanded field in `spectra-review.spec.ts:313-346`.

## Decisions

- One slice (S1) for the code, owning three test files. Reason: one capability of about 60-100
  lines. A helper-only slice would only add a sequential dependency.
- Move `revealAllRows` to `tests/browser/helpers/spectra.ts` and make it return a boolean. Reason:
  spec files are never imported (`helpers/spectra.ts:6-8`), and the metric must report, not fail.
- Measure after `collectMetrics`, not inside it. Reason: `collectMetrics` runs in the page
  (`spectra-review.spec.ts:474`), while the helper is Playwright-side.
- Measure at 1440 and 375 only, in the "spectra metrics" tests only. Reason: as proposed. The
  captures tests take screenshots, and expanding there would change them.
- No feature flag. Reason: test-only and one slice. An opt-in switch belongs to Q6.
- Risk is low (score 0, tests only). Reason: the mrp-builder risk table. It agrees with the
  proposal.

## Ruled out

- Putting the reveal inside `collectMetrics`: the function is serialized into the page and cannot
  call Playwright helpers.
- Importing the helper from `spectra-addon-marker.spec.ts`: it is against the helpers module rule,
  and importing a spec file would also register its tests.

## Open questions and risks

- QA (owner, CRP): the expanded state with the default differences-only filter, the filter off, or
  both. Default filter since item 2: `renderers.ts:104-116`.
- QB (owner, CRP): gate the extra CI time now, or wait for Q6.
- Risk: the reveal plus the expanded layout of the largest pricings at 375 (Webflow is 44.63
  collapsed screens, `report.md:413-415`) may exceed the 60 s timeout (`spectra-review.spec.ts:468`).
  With 2 CI retries (`playwright.config.ts:19`), a timeout costs three runs. Mitigation: raise the
  timeout for 1440/375 only, if CI shows it is needed.
- Risk: the helper has only run on `github`. A pricing whose buttons never settle would report
  `expandedRevealComplete=false`, which is reported, not failed.
- G5 and G7 are not defined in the skills I could read. The coordinator maps them.
- Workers have no Chromium (`report.md:577-578`). The real proof is the CI browsers job on the PR.

## Next three steps

1. Coordinator: create the OpenSpec change with one requirement (e.g. `req~spectra-expanded-height~1`)
   and the S1 contract from `intake.md`, with its check arrays.
2. Coordinator: send QA and QB in one CRP, or decide QA = (a) under the owner's approval of the
   proposal as written, then start S1.
3. After S1 merges: read the `SPECTRA_SUMMARY` `xscreens=` lines of the develop CI run, and either
   run S2 or attach the numbers to the Q2 CRP.

## Evidence

- Task: planner intake f8030dcf19924627. No registered checks, so nothing was run through qa_run.
