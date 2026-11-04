# Handoff: prop-20261104-1 (render tests for unsafe `docUrl` and `metadata.url`)

- Status: waiting on the coordinator (plan ready; Q1 and Q2 are coordinator decisions, no CRP). Updated: 2026-11-04.
- Branch / head: planner task `task/603f2ede60954461`, base `fe7bfe9`. PR: none.

## Goal

Render tests show that comparison-row doc links and the catalog metadata URL starting with `//` or `/\` are
not rendered as links, as `.changeset/safe-link-other-host-paths.md:5` promises (INTENT O3).

## State (with evidence)

- The intake is written: `docs/agent-work/prop-20261104-1/intake.md`, with one slice, T1.
- Guards confirmed: `src/element/renderers.ts:812` (`docUrl`) and `:1548` (`metadata.url`), both via
  `isSafeLink` (`src/core/view-model.ts:600-607`).
- Coverage gap confirmed: no test renders either path with an unsafe value. In `tests/`, `docUrl` is only in
  `https` fixtures (`acme-pricing.yml:26`, `spectra/wrike/2024.yml:19,423`) and in a key list
  (`addon-marker.test.ts:654`). No test calls `renderCatalogMetadata`.
- Two conditions that a test must set, or it passes without the guard:
  - the doc link is only in the compact layout (`renderers.ts:773,997-999`; the table layout at `:868` has no
    `docUrl`);
  - the metadata block is only in catalog mode (`renderers.ts:1524`; default mode `'commercial'`,
    `view-model.ts:459`).
- No requirement id covers these call sites (`req~cta-href-template-unsafe~1` covers plan CTAs only,
  `add-subscription-change-flow/specs/plan-cta/spec.md:177-186`).
- No code, test, spec or acceptance file was changed.

## Decisions

- One slice (T1, test-designer, one new file `tests/unit/unsafe-render-links.test.ts`). Reason: one
  capability, about 80-130 lines, no shared file.
- Node template test, copying `tests/unit/row-descriptions.test.ts:1-69`. Reason: Vitest runs in `node`
  (`vitest.config.ts:5`), and that file already renders `renderComparison` this way.
- Input through `normalizePricing`. Reason: covers `normalize.ts:183,559` like real input.
- Risk low (score 0). No feature flag. G13 as how-to-review. Reason: tests only, no runtime change.

## Ruled out

- Tagging the tests with `req~cta-href-template-unsafe~1`. It would trace to the wrong requirement.
- A Playwright test. It costs more and adds no coverage of the two template call sites.
- The usual `red_before` check. The guards already exist, so the test is green on the base.

## Open questions and risks

- Q1: add a requirement (spec-only S0) so the tests can be tagged, or keep them untagged. Recommended:
  untagged (proposal says tests only; `row-descriptions.test.ts` is untagged too). Coordinator decides.
- Q2: prove that the negative cases can fail through a guard-removal or mutation check, or rely on the
  positive controls and the test-reviewer. Coordinator decides, based on what its runner supports (not verified).
- Risk: false green from the wrong layout or mode. Mitigation: `compact: true`, `mode: 'catalog'` and
  positive `https` controls (intake R1).
- G5, G7 and G10 are not defined in the files read. The coordinator applies its registry.

## Next three steps

1. The coordinator decides Q1 and Q2 and creates the T1 task contract from `intake.md` (owned file, read-only
   context, checks `install`, `unit`, `test`, `lint`, `fmt`).
2. A test-designer writes `tests/unit/unsafe-render-links.test.ts` and runs the checks through `qa_run`.
3. A test-reviewer confirms that each negative case has a positive control in the same layout and mode; the
   pr-steward opens the PR into `develop` with a how-to-review.

## Evidence

- Files read: `src/element/renderers.ts:773-866,974-1004,1515-1562`, `src/core/view-model.ts:440-462,590-614`,
  `src/core/normalize.ts:170-189,545-569`, `src/core/utils.ts:11-13`, `src/core/types.ts:344`,
  `tests/unit/row-descriptions.test.ts:1-110`, `tests/unit/cta-href.test.ts:1-105`, `vitest.config.ts`,
  `.changeset/safe-link-other-host-paths.md`, `openspec/changes/add-subscription-change-flow/specs/plan-cta/spec.md:155-194`,
  `docs/agent-work/prop-20261101-3/handoff.md`, `docs/agent-work/prop-20261103-3/intake.md`.
- Checks: none registered for this task, and none run.
