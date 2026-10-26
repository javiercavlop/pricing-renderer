# Intake: P-20261026-2, expanded-state height in the SPECTRA browser metrics

- Proposal: P-20261026-2 (kind feature, size S, owner-approved). Planner intake, 2026-10-26.
- Base: `3841e7c` (task branch `task/f8030dcf19924627`).
- INTENT link: objective **O2, "accessibility and visual-regression guards stay green"**. The signal
  "Expanded-state height. Current value: not measured" is at `INTENT.md:56-57`. It also feeds the
  O1 page-height question Q2 (`INTENT.md:129-131`).

## Objective

Measure how tall the renderer gets when every comparison group is open and every "Show N more"
button has been clicked. Report the value next to the collapsed one in the SPECTRA browser metrics
at 1440 and 375, so that Q2 (the page-height threshold) can be decided on both numbers. The report
asks for this before any default is judged (`report.md:182-183`). Phase 2 step 1 has no
dependencies and needs no CRP (`report.md:422`, `report.md:435`).

## Scope

- `tests/browser/spectra-review.spec.ts`: after the collapsed metrics of the "spectra metrics"
  tests (`spectra-review.spec.ts:463-487`), at widths 1440 and 375 only: reveal every row, measure
  the renderer height and write it into the `SPECTRA_METRICS` JSON and the `SPECTRA_SUMMARY` line.
  Report only. No threshold assertion.
- `tests/browser/helpers/spectra.ts`: gets the reveal helper so it can be reused. Today the helper
  is private to `spectra-addon-marker.spec.ts:32-55`, and the shared-helpers module says a spec file
  is never imported (`helpers/spectra.ts:6-8`).
- `tests/browser/spectra-addon-marker.spec.ts`: imports the moved helper. Its behaviour does not
  change.

## Non-goals

- No renderer change: nothing under `src/`, `styles`, the demo, the package or the public API.
- No threshold or new pass/fail assertion on page height. Q2 stays the owner's decision.
- No CI workflow change (`.github/workflows/ci.yml`). Making the spec opt-in is Q6
  (`INTENT.md:139-141`), outside this change.
- No change to the "spectra captures" tests (`spectra-review.spec.ts:575-640`), screenshots or
  baselines, and no measurement at 1024.
- No `acceptance/**`, no `openspec/specs/**`. No changeset: no published file changes.

## Verified facts (and corrections to the proposal)

`report.md` means `docs/agent-work/visual-review-spectra/report.md`.

- Collapsed-only today: `spectra-review.spec.ts:6`. Height is `rendererHeight / innerHeight`,
  rounded to 2 decimals: `spectra-review.spec.ts:115,245,317`.
- Summary line builder: `spectra-review.spec.ts:364-405` (`screens=` at `:394`). Nothing else in
  the repository parses `SPECTRA_SUMMARY` or `SPECTRA_METRICS` lines. The grep matches only the spec
  and docs. `tests/unit/spectra-layout-metrics.test.ts` builds its numbers from the view model and
  has its own `SPECTRA_METRICS_OUT` env var (`:246`).
- Fixtures: 37 directories under `tests/fixtures/spectra/`. The metrics describe runs 37 × 3
  viewports (`spectra-review.spec.ts:30-34,464-465`), chromium only (`:49-51`). The change adds no
  test. It adds work to 74 of the 111 existing metrics tests (1440 and 375).
- The proposal says to "add a metric to `collectMetrics`". `collectMetrics` runs inside the page
  (`page.evaluate(collectMetrics, viewport)`, `:474`), and the reveal helper is a Playwright-side
  function (`spectra-addon-marker.spec.ts:33-55`). So the reveal runs after `collectMetrics`
  returns, followed by a second small `page.evaluate`. The result goes into the object passed to
  `report()` (`:475-480`), not into `collectMetrics` itself.
- Reveal helper scope: it clicks `button[aria-expanded="false"]` and `button.pr-button--quiet`
  inside `[data-pr-part="comparison"]` (`spectra-addon-marker.spec.ts:39-43`). Inside that section
  these are the group toggles (`renderers.ts:692` compact, `:785` table) and "Show N more"
  (`renderers.ts:734-742`, `:824-826`). The other quiet buttons, variables reset
  (`renderers.ts:564`) and the add-on "show remaining" (`renderers.ts:1190-1196`), are not
  inside the comparison section (`renderers.ts:849-853`): the section, the variables and the add-ons
  are sibling parts (`pricing-renderer-element.ts:79,999`). The helper asserts completion with
  `expect(...).toBe(true)` (`:54`). It has only run against `github`.
- Default filter: since item 2, long pricings start with differences only
  (`renderers.ts:104-116`). The helper does not touch that checkbox. With the proposal's design, the
  "expanded" number is therefore "all groups open, no 30-row cap, default filter". The report's
  wording ("all groups expanded, no cap", `report.md:182-183`) was written before item 2. See QA.
- The first group is open on load and the rest are closed (`pricing-renderer-element.ts:412,426-428`).
  The 30-row cap is at `renderers.ts:617-619`.
- Cost: the metrics tests have a 60 s timeout (`spectra-review.spec.ts:468`). In CI, Playwright
  uses 2 workers and 2 retries (`playwright.config.ts:17,19`). The browsers job runs
  `pnpm test:browser` on every PR (`ci.yml:63-77`). The collapsed Webflow page at 375 is already
  44.63 screens (`report.md:413-415`), so its expanded run is the slowest case.
- `pnpm typecheck` does not cover `tests/browser` (the `tsconfig*.json` includes are `src/**`
  only). `eslint .` does (`eslint.config.js:5-33`). Workers have no Chromium (`report.md:577-578`).
  The real run is the CI browsers job.
- Proposal evidence checked: `report.md:182-183,422,581-583`, `ROADMAP.md:62-65,91-92`,
  `INTENT.md:139-141`, `spectra-addon-marker.spec.ts:32` all match. "Planner followup lists it as
  not done": `docs/agent-work/prop-20261025-1/handoff.md:19-20`.

## Slices

One capability, about 60-100 diff lines in total. One slice is the plan. A two-slice split (move
the helper, then the metric) is possible. It is not recommended: the second slice would depend on
the first, and the split buys no parallel work.

No feature flag. Nothing is user-visible, and the change is complete in one slice. An env-var
switch for the extra measurement (opt-in CI time) belongs to Q6 and is not part of this plan (see
QB).

### S1: expanded-state height in the SPECTRA metrics

- Role: implementer (default model and effort). Turn budget: 40.
- Owns:
  - `tests/browser/spectra-review.spec.ts`
  - `tests/browser/helpers/spectra.ts`
  - `tests/browser/spectra-addon-marker.spec.ts` (import change and removal of the local copy only)
- Read-only context: `src/element/renderers.ts`, `src/element/pricing-renderer-element.ts`,
  `playwright.config.ts`, `docs/agent-work/visual-review-spectra/report.md` (sections 2 and 6-7),
  `INTENT.md`, this intake.
- Content:
  1. Move `revealAllRows` to `helpers/spectra.ts` as an export that returns `Promise<boolean>`
     (true when nothing is left to reveal, false after 100 rounds). `spectra-addon-marker.spec.ts`
     keeps its assertion and its message (`:54`) at the call site. Update the module comment
     (`helpers/spectra.ts:6-8`) to name the new users.
  2. In the "spectra metrics" test, for widths 1440 and 375 only: after `collectMetrics`, call the
     helper, wait for `updateComplete` and one frame, then measure:
     `rendererHeightExpanded` (px, 2 decimals), `rendererHeightInViewportsExpanded` (same rounding
     as `:317`), `comparisonRowsExpanded` (rendered `[data-pr-part="comparison-row"]`) and
     `expandedRevealComplete` (the helper's boolean). Merge them into the object passed to
     `report()`. At 1024 the fields are absent.
  3. `summaryLine`: add `xscreens=<value>` right after `screens=`, `-` when absent.
  4. Rewrite the comment at `:6`: collapsed default state, except the `*Expanded` fields, which are
     measured with every group open and every row revealed under the default filter.
  5. No new `expect` on the expanded values, and no `expect` on `expandedRevealComplete`. A
     failure to reveal is reported, not failed (report-only, as the proposal says). Existing
     assertions stay as they are, in their current order (`:481-483`).
  6. If CI shows the 60 s timeout is too tight at 375, raise it for the 1440/375 cases only, and
     write the measured duration in the PR.
- Requirement ids: the coordinator assigns one, e.g. `req~spectra-expanded-height~1`. S1 puts
  `[utest->req~spectra-expanded-height~1]` on the metrics describe, as in the existing tags
  (`spectra-review.spec.ts:489`).
- Size: about 60-100 lines. Risk: **low**. Score 0: tests only -2, one module, no risk area, no
  public API, floor 0. It agrees with the proposal.
- Checks (worker, local; browsers are not available to workers):
  - `["pnpm", "install", "--frozen-lockfile"]`
  - `["pnpm", "exec", "eslint", "tests/browser/spectra-review.spec.ts", "tests/browser/spectra-addon-marker.spec.ts", "tests/browser/helpers/spectra.ts"]`
  - `["pnpm", "exec", "prettier", "--check", "tests/browser/spectra-review.spec.ts", "tests/browser/spectra-addon-marker.spec.ts", "tests/browser/helpers/spectra.ts"]`
  - `["pnpm", "exec", "playwright", "test", "--list", "--project=chromium", "tests/browser/spectra-review.spec.ts", "tests/browser/spectra-addon-marker.spec.ts"]`
    (loads and transpiles both specs. Assumption to confirm when registering: `--list` starts
    neither browsers nor the `webServer`.)
- Change-level proof (PR): the CI `browsers` job on the PR head is green. Its log has a
  `SPECTRA_SUMMARY` line with a numeric `xscreens=` for every fixture at 1440 and 375, and
  `xscreens=-` at 1024. Read through `ci_status` / `ci_log`.
- Depends on: nothing. Order: S1, then the optional S2.

### S2 (optional, docs): write down the measured values

- Role: doc-steward. Turn budget: 25. Starts only after S1 is merged and the develop CI run has the
  numbers.
- Owns: `docs/agent-work/prop-20261026-2/expanded-height.md` (new). This slice does not change
  `INTENT.md`/`ROADMAP.md`: that is the owner's draft, and the coordinator decides whether a later
  docs task updates `INTENT.md:56-57` and `ROADMAP.md:62-65,91-92`.
- Content: per fixture, the collapsed and expanded screens at 1440 and 375, from the CI log of the
  named run, with min, median and max. Fixtures with `expandedRevealComplete=false` are listed
  separately.
- Risk: **low** (docs only, score 0). Checks: `["pnpm", "install", "--frozen-lockfile"]`,
  `["pnpm", "exec", "prettier", "--check", "docs/agent-work/prop-20261026-2/expanded-height.md"]`.

Ownership is disjoint: S1 owns the three test files, and S2 owns one new docs file.

## Gates per slice

The factory skills I could read define G1, G2, G3, G4, G6, G8, G9, G10, G11, G12 and G13. I found
no definition for G5 or G7, the same as in `prop-20261025-1/intake.md:134-135`. The coordinator
maps them.

- G1, openspec validate --strict: at change level, once the change exists (S1 and S2).
- G2, EPIC review: S1 if the change carries the requirement; S2 N/A.
- G3, red-before: N/A for both. A report-only metric has no failing-first behaviour.
- G4, acceptance freeze: N/A unless the coordinator asks test-designer for tests.
- G5 and G7: not defined in the skills I read; the coordinator maps them.
- G6, trace: S1 with the `utest` tag above; S2 N/A.
- G8, mutation: N/A (test code, docs).
- G9, dependency and licence: N/A (no dependency).
- G10, secrets: applies if registered (both).
- G11, review: one reviewer per slice (low risk). S1: the helper moved without a behaviour change,
  only 1440/375 measured, no new assertion. S2: the numbers against the named CI log.
- G12, ui-qa: N/A (no UI change).
- G13, how-to-test: N/A for both. Test-only, so the PR uses how_to_review (files, and the CI log
  lines to read).

## Open questions

These need a CRP (owner):

- QA. Which expanded state does Q2 need? (a) The default filter: all groups open, no cap,
  differences-only as the pricing starts (this plan, the proposal's helper as is). (b) Filter off:
  every row, the worst case (`report.md:182-183` wording, written before item 2). (c) Both: S1 also
  unticks the differences-only checkbox when the toolbar exists, and reports
  `rendererHeightInViewportsExpandedAll`, adding about 15 lines and one more reveal per test.
  Recommendation: (c) if the owner wants Q2 settled in one pass, otherwise (a).
- QB. CI time. The extra work runs on every PR until Q6 (opt-in spec, `INTENT.md:139-141`) is
  answered. The owner approved the proposal with this cost stated. If the owner wants it gated now,
  S1 adds an env switch (e.g. `SPECTRA_EXPANDED=1`), and CI then never measures it until a
  workflow change, which is outside this change.

These go to the coordinator and are not owner decisions:

- Requirement id and whether the change carries a delta spec (G1/G2/G6).
- Whether to run S2 or read the numbers from the CI log directly in the CRP for Q2.
- Registering the `--list` check: confirm that it needs no browser download in the lab.
