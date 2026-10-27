# Handoff: spectra-item9-tags

- Status: in-progress (planned, waiting for Q1 and slice S0) · Updated: 2026-10-27
- Branch / head: planner task `task/22337559eb93452d`, base `91be006` · PR: none

## Goal

Make the comparison groups follow the declared tags. With no tags, the comparison shows no group
headers. A partly tagged pricing gets its tag groups, then "Other features"
(`pricing.otherFeatures`), then "Usage limits" (`pricing.usageLimits`). A fully tagged pricing is
unchanged. The work covers tests, a changeset, docs and the ROADMAP item 9 update (owner decision
`own-f94ad18958bc482ba68f19a75552d56d`, 2026-10-27, visual change approved).

## State (with evidence)

- Intake written: `docs/agent-work/spectra-item9-tags/intake.md`. It has the facts with
  `file:line` at `91be006`, D1-D11, slices S0-S4 with checks, a gate table, risks R1-R5 and the open
  questions Q1-Q5.
- Fixture classes verified by grep: only shopify, zoom and zenhub declare `tag`. zoom is the only
  fixture with untagged features (`zoom/2024.yml:855-917`). No SPECTRA fixture is fully tagged, so
  `tests/fixtures/acme-pricing.yml` is the fully tagged case.
- No code, spec or test written yet. No check is registered for this task, so none was run.

## Decisions

- Declared tag = `asString(raw.tag) !== undefined`, decided in the view model. The normalized types
  and the `'General'`/`'Usage limits'` defaults stay. Reason: no type change, and the same rule as
  `normalize.ts:168,195` (intake D1).
- Classification counts only rows that are not `render: 'disabled'` (D2).
- A pricing with no tags gets one group `pr-untagged` with no header, always expanded, with the
  30-row cap kept, the wrappers kept, and Expand/Collapse all hidden (D5).
- Partly tagged: tag groups, then `pr-other-features`, then `pr-usage-limits`. Empty special groups
  are omitted, and `row.category` is unchanged (D3, D4).
- The renderer learns that a group has no header from an optional `PricingComparisonGroup.kind`
  (recommended). This is a public type change, so the owner decides (D6, Q1).
- `metrics.json` is regenerated in S2 with a limited diff (D9). There is no feature flag (D8) and no
  ADR (D11).

## Ruled out

- Grouping by name prefix for untagged pricings: fragile, per `report.md:365`.
- Changing `normalize.ts` defaults or the `tag` type: the owner requires backwards compatibility.
- Splitting core and renderer into separate PRs: the core part alone would render a headed
  "Features" group for 34 pricings, an intermediate look nobody approved.

## Open questions and risks

- Q1 (owner CRP): `kind` field (a), empty-name convention (b) or id constant (c). In the same CRP:
  keep D1 from `raw`, or add `tagDeclared?: boolean`.
- Q2-Q5 (coordinator): the spec location while `openspec/` is absent, the INTENT records of Q4
  (`INTENT.md:99,123,134`), the missing inbox body file, and the requirement ids and check indexes.
- R1: the height gates of `tests/browser/spectra-shorter-page.spec.ts` may fail for untagged
  pricings that now show usage-limit rows at load. S2 stops and reports the values. It does not
  edit the thresholds.
- R4: the `metrics.json` regeneration changes a SPECTRA evidence file. The reviewer checks that only
  the group fields changed.

## Next three steps

1. Coordinator: send Q1 to the owner, take Q2-Q5, register the checks of S0-S3 from the intake, and
   start S0 (specifier, owns `docs/agent-work/spectra-item9-tags/spec.md`).
2. After S0: run S1 (test-designer, `tests/unit/tag-groups.test.ts`, red-before G3) and S3
   (doc-steward, `docs/api-reference.md`, `docs/pricing2yaml-compatibility.md`, `ROADMAP.md`) in
   parallel.
3. Freeze the S1 test (G4), then run S2 (implementer, medium risk, owns the files listed in the
   intake). After it is integrated, run S4 (how-to-test guide, G13) and open the PR.

## Evidence

- Tasks: planner `22337559eb93452d` (this intake). Base: `91be006`. CI: none yet.
- Sources: `src/core/view-model.ts:319-378`, `src/core/normalize.ts:161-207`,
  `src/core/types.ts:65-98,327-353`, `src/element/renderers.ts:601-880`,
  `tests/unit/spectra-layout-metrics.test.ts:119-123,284-292`,
  `docs/agent-work/visual-review-spectra/report.md:357-367`, `ROADMAP.md:50-52,118`.
