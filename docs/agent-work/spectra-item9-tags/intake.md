# Intake: SPECTRA item 9, comparison groups that follow declared tags

- Origin: owner decision `own-f94ad18958bc482ba68f19a75552d56d` (2026-10-27, add request). The visual
  change is owner-approved. Planner intake, 2026-10-27.
- Base: `91be006` (task branch `task/22337559eb93452d`). Every `file:line` below is at this base.
- INTENT link: **O1, "real-world Pricing2Yaml pricings render legibly"** (`INTENT.md:26`).
- The request body `docs/agent-work/inbox/2026-10-27-own-f94ad18958bc482ba68f19a75552d56d-add_request.md`
  is **not in the worktree** (glob `docs/agent-work/inbox/**`: no match; grep of the decision id: no
  match). This plan uses the summary of the task contract. Q4 below asks for a check against the body.

## Objective

In `createComparisonGroups` (`src/core/view-model.ts:319-378`):

- A pricing where no feature and no usage limit declares a tag renders its comparison with no tag
  group headers.
- A partly tagged pricing keeps its tag groups. Untagged features go into a group named by the new
  i18n key `pricing.otherFeatures` (en-US `Other features`, es-ES `Otras características`), placed
  after the tag groups. Untagged usage limits go into a last group named by the existing key
  `pricing.usageLimits` (en-US `Usage limits`, es-ES `Límites de uso`, `src/core/i18n.ts:55,139`).
- A fully tagged pricing is unchanged.
- Group names come from the message catalog, never from hard-coded English.
  `NormalizedFeature.tag` and `NormalizedUsageLimit.tag` stay backwards compatible.
- Deliverables: tests on the SPECTRA fixtures for the three cases, a changeset, docs, and the
  ROADMAP item 9 update.

## Verified facts (at `91be006`)

- Today's grouping: the rows get `category: feature.tag` / `usageLimit.tag` (`view-model.ts:331,352`).
  Groups use `id = name = row.category || 'General'` in order of first appearance, features before
  usage limits (`view-model.ts:367-377`). `createComparisonGroups` does not receive the messages. They
  are computed only in the return object (`view-model.ts:407`).
- Normalize fills the tag with English defaults: `tag: asString(raw.tag) ?? 'General'`
  (`normalize.ts:168`) and `?? 'Usage limits'` (`normalize.ts:195`). `asString` counts only a
  non-empty string after trimming (`utils.ts:11-13`). `raw` is kept on every feature and usage limit
  (`normalize.ts:182,204`) and on every row (`view-model.ts:342,363`). The view model can therefore
  tell a declared tag from a default without a type change.
- Public types: `NormalizedFeature.tag: string` (`types.ts:69`), `NormalizedUsageLimit.tag: string`
  (`types.ts:88`), `PricingComparisonRow.category: string` (`types.ts:332`),
  `PricingComparisonGroup { id; name; rows }` (`types.ts:349-353`). `PricingComparisonGroup` is
  exported (`src/core/index.ts:63`), and so are `enUS`, `esES` and `getMessages`
  (`src/core/index.ts:9-13`).
- Rendering: the compact layout uses one `section.pr-comparison-group` per group with an `h4` toggle
  button (`renderers.ts:688-698`). The table layout uses one `tbody` per group with a
  `tr.pr-category-row` toggle (`renderers.ts:785-797`). Group headers are toggles. Collapsed groups
  hide their rows (`isGroupExpanded`, `renderers.ts:621-623`). The cap is 30 rows per group
  (`renderers.ts:617-619`). The element expands the first group at load
  (`pricing-renderer-element.ts:428-430`). "Expand all / Collapse all" are in the toolbar
  (`renderers.ts:665-672`, `pricing-renderer-element.ts:798-804`). `_revealGroup` finds its container
  with `closest('tbody, .pr-comparison-group')` (`pricing-renderer-element.ts:808`). The wrappers
  must stay even when the header goes.
- SPECTRA fixtures (`tests/fixtures/spectra/*`, 37 files): only 3 declare any `tag`. Grep `^\s+tag:`
  counts: shopify 38, zoom 121, zenhub 39. The other 34 have none.
  - zoom/2024.yml is the **partly tagged case with both new groups**. The features at `:855-917`
    (`callOutDialIn` … `zoomCompliantManager`, 12 entries) have no `tag`. None of the usage limits
    (`:922-989`) has one.
  - shopify/2022.yml and zenhub/2024.yml tag every feature but no usage limit
    (shopify `:18-305` against `:306-339`, zenhub `:19-276` against `:277-308`). They are partly
    tagged with only the usage-limits group.
  - clickup/2024.yml (174 rows) and the other 33 untagged fixtures are the **no-tag case**.
  - No SPECTRA fixture is fully tagged. The demo `tests/fixtures/acme-pricing.yml` is fully tagged:
    features `Workspace`, `Security` and the usage limit `Usage` (`:23,29,34,39,45`). It is the
    **fully tagged case**. Every Playwright screenshot baseline uses it
    (`tests/browser/pricing-renderer.spec.ts:5,1340`, demo page `/`), and
    `tests/unit/pricing.test.ts:173-177` asserts its group names.
- Tests that the change touches indirectly:
  - `tests/unit/spectra-layout-metrics.test.ts:119-123,284-292` writes the group ids and row counts
    of every fixture into `metrics.json` and compares them with the committed
    `docs/agent-work/visual-review-spectra/metrics.json`. That test fails after the change unless the
    file is regenerated (`SPECTRA_METRICS_OUT`, `:246-255`). `WITH_ONE_OR_TWO_GROUPS = 34` (`:330`)
    stays true: 34 untagged pricings get 1 group each, and the 3 tagged ones keep more than 2.
  - `tests/browser/spectra-shorter-page.spec.ts:10-16` checks the height of clickup, zoom, salesforce
    and webflow against the phase 1 baselines + 0.15 screens, and clickup at most 5 screens. CI runs it
    on every PR in the chromium shards (it is not in the `testIgnore` of `playwright.config.ts:14-16`).
  - `tests/browser/reveal-focus.spec.ts:165-166` describes clickup as "its first group (General, 136
    rows)". The selectors (`.pr-comparison-group`, `:22`) still work if the wrappers stay. The
    comment goes stale.
  - `tests/browser/helpers/spectra.ts:107-110` clicks `button[aria-expanded="false"]`. A group with
    no header has no button, which is fine.
- Docs that describe the comparison: `docs/api-reference.md:352-381` ("Comparison toolbar and the
  shorter page", i18n keys at `:380-381`), `docs/pricing2yaml-compatibility.md:27` (tags are
  supported). The report section is `docs/agent-work/visual-review-spectra/report.md:357-367`.
- Records that say item 9 is dropped: `ROADMAP.md:50-52` (row), `ROADMAP.md:118` (Q4), and
  `INTENT.md:99,123,134`. The owner's new decision replaces Q4.
- `openspec/` does not exist at the base (glob `openspec/**`: no match). Earlier SPECTRA items keep
  their spec in `docs/agent-work/<id>/spec.md` (for example
  `docs/agent-work/spectra-item2-shorter-page/spec.md`).
- Changeset style: `.changeset/spectra-addon-marker.md` (patch) and `.changeset/spectra-shorter-page.md`
  (minor, new public surface).

## Decisions taken in this intake

The spec (S0) may refine D1-D8. A change it makes is recorded in the spec with its reason.

- D1. **How a declared tag is known**: a feature or usage limit declares a tag if and only if
  `asString(raw.tag) !== undefined`, the same rule normalize uses (`normalize.ts:168,195`). The
  view model decides from `raw`, and `NormalizedFeature`/`NormalizedUsageLimit` do not change: `tag`
  keeps its type and its `'General'` / `'Usage limits'` defaults. Reason: zero type change, one rule
  shared with normalize, and a declared tag that is literally `General` still counts as declared.
  Known limit: a hand-built `NormalizedPricing` whose `raw` lacks `tag` counts as untagged. The spec
  states it, and `docs/api-reference.md` documents it. The rejected alternative is an optional
  `tagDeclared?: boolean` on both types (absent = declared). It is more compatible for hand-built
  input but adds two public fields. It stays available if the owner prefers it (Q1).
- D2. **Classification** counts only rendered rows (`render !== 'disabled'`, `view-model.ts:325,346`),
  because disabled rows never show. None: 0 rows declare a tag. Full: every row declares one.
  Partial: anything in between. A pricing with 0 rows produces no groups (unchanged,
  `renderers.ts:857`).
- D3. **Partial order**: tag groups in order of first appearance (features first, then usage limits)
  and merged by tag text, as today. Then `Other features` (the untagged features), then
  `Usage limits` (the untagged usage limits). A special group with no rows is not emitted.
  `PricingComparisonRow.category` keeps the value it has today (`feature.tag`), so it stays
  compatible.
- D4. **Ids**: tag groups keep `id = tag` (unchanged for the fully tagged case). The special groups
  get fixed ids that do not depend on the locale: `pr-other-features`, `pr-usage-limits` and
  `pr-untagged`. A declared tag with exactly one of these strings is a documented limit, not handled.
  A special group whose visible name equals a declared tag stays a separate group (spec states it).
- D5. **No-tag rendering**: one group (`pr-untagged`) that holds every row (features, then usage
  limits). It renders no header: no `h4` in compact, no `tr.pr-category-row` in the table. It is
  always expanded, and the 30-row cap with "Show N more" applies to it. The wrappers
  (`section.pr-comparison-group`, `tbody`) stay. The toolbar hides "Expand all / Collapse all" when
  the only group has no header. The counter and "Only differences" behave as in item 2. The group
  `name` is `pricing.features` from the catalog (it is not rendered).
- D6. **How the renderer knows a group has no header**: an optional field
  `PricingComparisonGroup.kind?: 'tag' | 'other-features' | 'usage-limits' | 'untagged'` (absent
  means `tag`, so view models built by hand keep working). This is an additive public type change, so
  it needs the owner's confirmation (Q1). Alternatives: (b) a group whose `name` is `''` renders no
  header (no type change, but the meaning of an existing field changes); (c) an exported constant for
  the `pr-untagged` id.
- D7. **i18n**: add `pricing.otherFeatures` to `enUS` and `esES` (`i18n.ts:3-85,87-169`). Reuse
  `pricing.usageLimits`. Names are read with `translate(messages, key)` from the view model's merged
  catalog (`getMessages(locale, overrides)`), so host overrides apply. `createComparisonGroups` takes
  the messages as a parameter.
- D8. No feature flag. Reason: one capability, one PR, and reverting the PR reverts the change. The
  owner approved the visual change.
- D9. `metrics.json` is regenerated in S2 with the existing switch, and its diff must touch only
  `groups`, `groupRows`, the longest group fields and the `withOneGroup`/`withTwoGroups` summary.
  Reason: the comparison test (`spectra-layout-metrics.test.ts:284-292`) has to keep passing. The
  report's prose (`report.md:359-364`) stays a historical record and is not edited.
- D10. This change narrows `req~shorter-page-no-look-change~1`
  (`spectra-item2-shorter-page/spec.md:118-131`) for untagged pricings of 40 rows or fewer: their
  markup changes by owner decision. The acme part of that requirement is unchanged. The new spec says
  so explicitly.
- D11. No ADR. Reason: no new architecture, dependency or cross-cutting rule. D1 and D6 are recorded
  in the spec. If the owner picks the `tagDeclared` field (Q1), the arch-reviewer decides whether it
  needs one.

## Requirements to write (S0, ids final from the coordinator)

- `req~tag-groups-declared~1`: D1, D2.
- `req~tag-groups-none~1`: D5 (view model and both layouts).
- `req~tag-groups-partial~1`: D3, D4.
- `req~tag-groups-full-unchanged~1`: the fully tagged case gives the same groups (ids, names, order,
  rows) and byte-identical comparison markup for `tests/fixtures/acme-pricing.yml`, table and compact.
  No screenshot baseline moves.
- `req~tag-groups-i18n~1`: D7. en-US and es-ES values, host override of `pricing.otherFeatures`, and
  no English literal for group names in `view-model.ts`.
- `req~tag-groups-compat~1`: `NormalizedFeature.tag`, `NormalizedUsageLimit.tag` and
  `PricingComparisonRow.category` keep their types and values, and normalize output is unchanged.

Scenarios (Given/When/Then), from the fixtures:

- clickup, en-US, table and compact: exactly one group, `kind` `untagged`. There is no
  `pr-category-row` and no group `h4`. The rows are visible without a click, and "Show N more" shows
  when the visible rows exceed 30.
- zoom, en-US and es-ES: the declared tag groups first in their old order, then
  `Other features`/`Otras características` with the 12 untagged features, then
  `Usage limits`/`Límites de uso` with the usage limits.
- zenhub and shopify: tag groups, then only the usage-limits group, with no `Other features`.
- acme: the groups `Workspace`, `Security`, `Usage` as in `pricing.test.ts:173-177`, and identical
  markup.
- A host catalog override of `pricing.otherFeatures` renames the zoom group.

## Slices

One change, one PR into develop. S1 and S2 are tasks of that PR and are not merged on their own (S1
alone would merge failing tests). Order: S0, then S1 and S3 in parallel, then S2, then S4. Owned globs
are disjoint.

### S0: spec

- Role: specifier (default model and effort). Turn budget: 30.
- Owns: `docs/agent-work/spectra-item9-tags/spec.md` (new).
- Read-only context: this intake, `docs/agent-work/spectra-item2-shorter-page/spec.md` (format),
  `src/core/view-model.ts:319-411`, `src/core/normalize.ts:161-207`, `src/core/types.ts:65-98,327-367`,
  `src/element/renderers.ts:601-880`, `report.md:357-367`.
- Content: the six requirements and scenarios above in EARS form, the measurable criteria, an
  out-of-scope section (no tag ordering by `metadata.tags`, no grouping of add-ons, no change to
  normalize defaults), D10 and the owner's answer to Q1.
- Risk: **low** (score 0, docs only). Check: `["pnpm", "exec", "prettier", "--check",
"docs/agent-work/spectra-item9-tags/spec.md"]` (after `["pnpm", "install", "--frozen-lockfile"]`).
- Depends on: Q1 answered (or the coordinator records that D6 (a) is the default until the owner
  answers).

### S1: failing acceptance tests on the SPECTRA fixtures

- Role: test-designer (default model and effort). Turn budget: 40.
- Owns: `tests/unit/tag-groups.test.ts` (new). Nothing else.
- Read-only context: S0 spec, `tests/unit/shorter-page-fixtures.test.ts:1-60` (fixture loading, the
  `flatten` helper, `RenderActions` noop), `tests/unit/pricing.test.ts:164-185`, the fixtures named in
  the scenarios, `src/core/index.ts`.
- Content: one `describe` per requirement. Cover the view model (group ids, names, `kind`, order, row
  ids per group) and the rendered markup of `renderComparison` for table and compact (no
  `pr-category-row`/`h4` for clickup, headers for zoom and acme, no Expand/Collapse all for clickup
  over 40 rows). Cover en-US, es-ES and a catalog override. Read zoom's untagged ids from the fixture
  (`asString(raw.tag)`) instead of hard-coding them. Tag each test `[utest->req~tag-groups-…~1]`.
- Size: about 180-250 lines. Risk: **low** (score 0: tests only).
- Checks:
  - `["pnpm", "install", "--frozen-lockfile"]`
  - red-before (G3), timeout 300: `{"argv": ["pnpm", "exec", "vitest", "run",
"tests/unit/tag-groups.test.ts"], "type": "red_before", "expect_exit": [1], "expect_pattern":
"AssertionError|expected", "overlay": ["tests/unit/tag-groups.test.ts"]}`. At the base, clickup
    has two groups with headers (`General`, `Usage limits`), so the test fails by assertion. A missing
    `kind` field must fail by assertion too, never by a type error (vitest does not typecheck). The
    pattern must match the assertion style used.
  - `["pnpm", "exec", "eslint", "tests/unit/tag-groups.test.ts"]`
  - `["pnpm", "exec", "prettier", "--check", "tests/unit/tag-groups.test.ts"]`
- Depends on: S0.

### S2: tag-aware grouping and the headless group

- Role: implementer (default model; effort medium). Turn budget: 50.
- Owns: `src/core/view-model.ts`, `src/core/types.ts`, `src/core/i18n.ts`, `src/element/renderers.ts`,
  `src/element/pricing-renderer-element.ts`, `.changeset/spectra-item9-tags.md` (new),
  `docs/agent-work/visual-review-spectra/metrics.json` (regenerated only, D9),
  `tests/browser/reveal-focus.spec.ts` (only the stale comment at `:165-166`).
- Must not touch: `src/core/normalize.ts` (D1), `tests/unit/tag-groups.test.ts` (frozen, G4), any
  screenshot baseline.
- Read-only context: S0 spec, S1 test, this intake (D1-D10).
- Content: D1-D7. Pass `messages` into `createComparisonGroups`. In `renderers.ts`, skip the header
  for `kind === 'untagged'`, treat that group as expanded in `isGroupExpanded`, and hide
  Expand/Collapse all when it is the only group. Add `[impl->req~tag-groups-…~1]` tags. Add a
  **minor** changeset (new i18n key and public field, look change for untagged pricings) in the style
  of `.changeset/spectra-shorter-page.md`, with plain user-facing text.
- Size: about 90-150 lines without tests and the generated `metrics.json`. Risk: **medium** (score 4:
  public API +3, from the new optional field and new keys in the exported catalogs; more than one
  module +1, core and element). It touches no price computation. If Q1 picks option (b) or (c), the
  score stays 4, because the exported catalogs still change.
- Checks:
  - `["pnpm", "install", "--frozen-lockfile"]`
  - `["pnpm", "typecheck"]`
  - `["pnpm", "lint"]`
  - `["bash", "-c", "set -euo pipefail; SPECTRA_METRICS_OUT=docs/agent-work/visual-review-spectra/metrics.json pnpm exec vitest run tests/unit/spectra-layout-metrics.test.ts"]`
    (regenerates `metrics.json`; run it before `pnpm test`)
  - `["pnpm", "test"]` (must pass with S1's test, the acme assertions of `pricing.test.ts:173-177`
    and the regenerated `metrics.json`)
  - `["pnpm", "exec", "playwright", "test", "tests/browser/spectra-shorter-page.spec.ts",
"tests/browser/reveal-focus.spec.ts", "tests/browser/pricing-renderer.spec.ts",
"--project=chromium", "--reporter=line"]` (timeout 1500; height gates, focus after "Show N more" on
    clickup, and the acme screenshot baselines unchanged)
  - `["pnpm", "format:check"]`
- Depends on: S1 integrated and frozen (its test is the acceptance).
- If an existing unit test other than `tag-groups.test.ts` fails because of the spec, the worker does
  not edit it. It reports the test and the line in its result (`needs`), and the coordinator gives
  that file to S2 or to the test-designer.

### S3: docs and roadmap

- Role: doc-steward (default model and effort). Turn budget: 25.
- Owns: `docs/api-reference.md`, `docs/pricing2yaml-compatibility.md`, `ROADMAP.md`.
- Read-only context: S0 spec, this intake, `ROADMAP.md:14-15` (PR number rule).
- Content:
  - `api-reference.md`: a short "Comparison groups and tags" subsection next to `:352-381`. Cover
    the three cases, the `kind` field, the key `pricing.otherFeatures` (en/es) and the reuse of
    `pricing.usageLimits`, and the D1 limit for hand-built pricings.
  - `pricing2yaml-compatibility.md:27`: one sentence on how `tag` drives the groups.
  - `ROADMAP.md:50-52`: item 9 state **not started → in progress**, wording per the roadmap's state
    set, with evidence `docs/agent-work/spectra-item9-tags/`. After merge the steward sets **done** with
    the PR number.
  - `ROADMAP.md:118`: keep the owner's Q4 wording and append one dated clause pointing to the
    owner decision of 2026-10-27, as `docs/agent-work/prop-20261027-3/intake.md` D2 did for Q6.
- Size: about 30-50 lines. Risk: **low** (score 0, docs only).
- Checks: `["pnpm", "install", "--frozen-lockfile"]`, `["pnpm", "exec", "prettier", "--check",
"docs/api-reference.md", "docs/pricing2yaml-compatibility.md", "ROADMAP.md"]`.
- Depends on: S0. Runs in parallel with S1 and S2 (disjoint files). The roadmap state "in progress"
  is not in the state set at `ROADMAP.md:14`. If the steward keeps the set strict, it writes "not
  started (owner reopened 2026-10-27)" and the done update follows the merge.

### S4: how-to-test guide (G13)

- Role: demo-guide (default model and effort). Turn budget: 30.
- Owns: `docs/agent-work/spectra-item9-tags/review/**`.
- Content: the steps on the demo with the clickup (no headers), zoom (Other features and Usage
  limits, also in Spanish) and acme (unchanged) fixtures, at 1440 and 375 px, light and dark.
  Captures go through the review-assets flow.
- Risk: **low**. Checks: the coordinator registers the G13 guide check of the project.
- Depends on: S2 integrated.

Change-level proof on the PR: the CI `quality` job and every browser shard (`pnpm test:browser`
equivalent, `ci.yml:142-160`) pass on the head.

## Gates per slice

As in the earlier intakes (`docs/agent-work/prop-20261026-3/intake.md:199-220`): the skills I read
define no G5 or G7, so the coordinator maps them.

| Gate                 | S0                                                     | S1                                                | S2                                                                                              | S3            | S4            |
| -------------------- | ------------------------------------------------------ | ------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------- | ------------- |
| G1 openspec validate | change level, needs `openspec/` or the docs convention | same                                              | same                                                                                            | same          | same          |
| G2 EPIC review       | applies (six requirements)                             | N/A                                               | N/A                                                                                             | N/A           | N/A           |
| G3 red-before        | N/A                                                    | applies (check above)                             | N/A                                                                                             | N/A           | N/A           |
| G4 acceptance freeze | N/A                                                    | coordinator freezes `tag-groups.test.ts` after S1 | runs it frozen                                                                                  | N/A           | N/A           |
| G6 trace             | ids                                                    | `utest` tags                                      | `impl` tags; trace passes at change level                                                       | N/A           | N/A           |
| G8 mutation          | N/A                                                    | N/A                                               | applies if registered for `src/core`                                                            | N/A           | N/A           |
| G9 deps and licence  | N/A                                                    | N/A                                               | N/A (no dependency)                                                                             | N/A           | N/A           |
| G10 secrets          | if registered                                          | if registered                                     | if registered                                                                                   | if registered | if registered |
| G11 review           | one reviewer                                           | test-reviewer                                     | panel for medium risk plus a clean-context review; checks D1-D7, D9 and the `metrics.json` diff | one reviewer  | N/A           |
| G12 ui-qa            | N/A                                                    | N/A                                               | applies: clickup, zoom, acme at 375 and 1440, light, dark, RTL, forced colors, keyboard         | N/A           | N/A           |
| G13 how-to-test      | N/A                                                    | N/A                                               | N/A                                                                                             | N/A           | applies       |

## Risks

- R1. Height gates of item 2. Untagged pricings whose first group was under 30 rows now also show
  usage-limit rows at load, up to the 30-row cap, and lose two header rows. clickup, salesforce or
  webflow may move by more than the +0.15 screen margin
  (`spectra-shorter-page.spec.ts:10-16`). Mitigation: S2 runs that spec. If it fails, S2 stops with
  the measured values, and the coordinator asks the owner: accept new baselines, or cap the headless
  group lower. S2 does not edit the spec's thresholds.
- R2. The O1 page-height threshold (at most 5 screens at 1440, `INTENT.md` Q2) may move for small
  untagged pricings, for the same reason. Mitigation: the on-demand `spectra-review.spec.ts` run
  after merge re-measures it. That run is not a gate of this change.
- R3. Hand-built `NormalizedPricing` without `raw.tag` (D1). Mitigation: documented, plus the
  alternative in Q1.
- R4. The `metrics.json` regeneration rewrites an evidence file of the SPECTRA review. Mitigation:
  D9 limits the diff, and the reviewer checks it field by field.
- R5. Group ids with spaces (`aria-controls="pr-group-Shopify Shipping"`, `renderers.ts:693`) are an
  existing issue, out of scope. The new special ids have no spaces.

## Open questions

Needs a CRP (owner):

- Q1. The public type change of D6. (a) Optional `PricingComparisonGroup.kind` (recommended: additive
  and explicit, and hosts that render the view model themselves can use it). (b) Empty `name` means
  no header (no type change). (c) Exported id constant. In the same CRP: keep D1 (from `raw`, no type
  change, recommended) or add `tagDeclared?: boolean` to both normalized types.

For the coordinator (not owner decisions):

- Q2. `openspec/` is absent. Keep the `docs/agent-work/<id>/spec.md` convention for G1 as in items 2
  to 7, or run `openspec init` first.
- Q3. INTENT still records item 9 as dropped (`INTENT.md:99,123,134`). INTENT is owner-accepted and
  out of this change's scope. Plan an INTENT update with the owner, or let the owner's merge of S3
  stand for it.
- Q4. Compare this plan with the full request body once the inbox file is available. It was missing
  from the worktree at `91be006`.
- Q5. Assign the final requirement ids and register the checks above with indexes.
