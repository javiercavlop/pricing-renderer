# Comparison groups that follow declared tags (SPECTRA item 9)

Source: owner decision `own-f94ad18958bc482ba68f19a75552d56d` (2026-10-27, add request, visual
change approved), amended by owner decision `own-2f520e3de26e4e74bce09cd5ca321997` (2026-10-27).
Plan: `docs/agent-work/spectra-item9-tags/intake.md` (base `91be006`). Objective: O1 of `INTENT.md`.

The request body `docs/agent-work/inbox/2026-10-27-own-f94ad18958bc482ba68f19a75552d56d-add_request.md`
is still not in the worktree (glob `docs/agent-work/inbox/**`: no match). This spec follows the task
contract, the intake and the amendment (intake Q4 stays open).

Pending owner CRP: `crp-pr-item9-group-marker` (intake Q1). This spec is written with option (a),
the optional field `PricingComparisonGroup.kind`, and keeps intake D1 (declared tag read from
`raw`, no `tagDeclared` field). If the owner picks another option, `req~tag-groups-kind~1` and the
renderer requirements that read `kind` are rewritten before S1 starts.

## Amendment to the intake

The owner amendment `own-2f520e3de26e4e74bce09cd5ca321997` replaces point 2 of the intake's
objective (`intake.md:17-20`). In a partly tagged pricing, every untagged row, features **and**
usage limits, goes into **one** final group named by `pricing.otherFeatures` (en-US
`Other features`, es-ES `Otras características`). There is no separate `Usage limits` group for
untagged usage limits. A pricing with no tags renders one comparison with no group headers,
features then usage limits. A fully tagged pricing is unchanged.

Changes to the intake's decisions (the intake file is not edited; this section is the record):

- D3 (partial order), replaced: the tag groups come first, in order of first appearance (features
  first, then usage limits) and merged by tag text, as today. Then one group `Other features` holds
  every untagged rendered row: the untagged features in declaration order, then the untagged usage
  limits in declaration order. The group is not emitted when it has no rows (fully tagged case).
  `PricingComparisonRow.category` keeps its current value.
- D4 (ids), replaced: tag groups keep `id = tag`. The special ids are `pr-other-features` and
  `pr-untagged`. The id `pr-usage-limits` is dropped. A declared tag that is literally
  `pr-other-features` or `pr-untagged` is a documented limit, not handled. A declared tag whose text
  equals the visible name of the special group (for example `Other features`) stays a separate group.
- D5 (no tags), confirmed and clarified: one group `pr-untagged` with every rendered row, features
  then usage limits, named by `pricing.features` (not rendered), with no header, always expanded,
  with the 30-row cap. Expand all / Collapse all are hidden when it is the only group.
- D6 (marker), narrowed: `kind?: 'tag' | 'other-features' | 'untagged'`. The value `'usage-limits'`
  of the intake is dropped. Pending the CRP above.
- D7 (i18n), narrowed: the only new key is `pricing.otherFeatures`. `pricing.usageLimits` stays in
  both catalogs but no longer names a comparison group built by this rule.
- Slice plan: S1 asserts one `Other features` group for zoom (22 untagged features then its 8 usage
  limits, see the correction below) and for shopify and zenhub (their untagged usage limits only),
  and no `Usage limits` group. S2 adds one special group, not two, and its changeset says that untagged usage limits now
  appear under `Other features`. S3 documents one special group. S4 shows `Other features` with
  usage-limit rows for zoom. The checks and owned files of S1-S4 are unchanged.

Correction of an intake fact (`intake.md:54-56`): zoom has 143 features and 121 `tag:` lines, so
22 features declare no tag, not 12. Ten of them are at `zoom/2024.yml:152-207` (`screenSharing` …
`waitingRoom`, between the `Meetings` features) and twelve at `:855-917`. At base `91be006` the
untagged features therefore form a `General` group placed after `Core Features` and `Meetings` and
before `Team Chat` (first appearance at `:152`). With this spec they move to the last group.

## Terms

- **Rendered row**: a feature or usage limit whose `render` is not `'disabled'`; it becomes a
  `PricingComparisonRow` (`view-model.ts:325,346`).
- **Declared tag**: a rendered row declares a tag if and only if its source object's `tag` field
  (`raw.tag`) is a string that is not empty after trimming. This is the rule normalize uses to keep
  a tag instead of the defaults `'General'` / `'Usage limits'` (`normalize.ts:168,195`). A declared
  tag that is literally `General` or `Usage limits` counts as declared.
- **Untagged pricing**: a pricing with at least one rendered row and no rendered row with a declared
  tag.
- **Partly tagged pricing**: a pricing with at least one rendered row with a declared tag and at
  least one rendered row without one.
- **Fully tagged pricing**: a pricing with at least one rendered row whose rendered rows all declare
  a tag.
- **Headerless group**: a comparison group with `kind === 'untagged'`.

## Requirements

The intake listed six requirement ids. This spec keeps them and splits the rendering of the no-tag
case into three requirements (`headerless`, `headerless-expanded`, `headerless-toolbar`) and the
public marker into `kind`, so that each one holds one obligation.

### Requirement: Classification by declared tags

`req~tag-groups-declared~1`
The view model SHALL classify each pricing as untagged, partly tagged or fully tagged by counting
only rendered rows and by treating a row as tagged if and only if it has a declared tag.

Needs: impl, utest

- A pricing with 0 rendered rows produces no comparison groups (unchanged, `renderers.ts:857`).
- Known limit: a `NormalizedPricing` built by hand whose `raw` objects carry no `tag` is classified
  from `raw`, so its rows count as untagged even when `tag` is set on the normalized object.

#### Scenario: Default tags do not count as declared

- **GIVEN** the fixture `tests/fixtures/spectra/clickup/2024.yml`, which declares no `tag`
- **WHEN** the view model is built with the default options
- **THEN** every row has `category` `General` (feature) or `Usage limits` (usage limit)
- **AND** the pricing is classified untagged, so `comparisonGroups` has exactly one group with id
  `pr-untagged`

#### Scenario: A declared tag named General counts

- **GIVEN** a pricing with two features, `a` with `tag: General` and `b` with no `tag`
- **WHEN** the view model is built
- **THEN** the groups are `General` (rows `a`) then `pr-other-features` (rows `b`)

#### Scenario: Blank tag is not declared

- **GIVEN** a pricing with one feature whose `tag` is `"   "` and one usage limit with no `tag`
- **WHEN** the view model is built
- **THEN** `comparisonGroups` has exactly one group with id `pr-untagged`

### Requirement: One headerless group for an untagged pricing

`req~tag-groups-none~1`
WHEN the pricing is untagged, the view model SHALL produce exactly one comparison group with id
`pr-untagged`, `kind` `untagged`, name from `pricing.features`, holding every rendered feature in
declaration order followed by every rendered usage limit in declaration order.

Needs: impl, utest

#### Scenario: ClickUp gives one group

- **GIVEN** `tests/fixtures/spectra/clickup/2024.yml` (174 rendered rows) and locale `en-US`
- **WHEN** the view model is built
- **THEN** `comparisonGroups.length` is 1
- **AND** the group has id `pr-untagged`, `kind` `untagged` and name `Features`
- **AND** its row ids equal the feature ids in fixture order followed by the usage-limit ids in
  fixture order, 174 rows in total

#### Scenario: Every untagged SPECTRA fixture gives one group

- **GIVEN** each of the 34 fixtures in `tests/fixtures/spectra` that declare no `tag` (all but
  shopify, zoom and zenhub)
- **WHEN** the view model is built
- **THEN** each has exactly one group, `pr-untagged`, whose row count equals its rendered features
  plus its rendered usage limits

### Requirement: No group header for the headerless group

`req~tag-groups-headerless~1`
WHEN the comparison renders a group whose `kind` is `untagged`, the renderer SHALL render the
group's rows without a group header in both layouts while keeping the group wrapper.

Needs: impl, utest

- Table layout: the group's `tbody` is rendered and contains no `tr.pr-category-row`.
- Compact layout: the group's `section.pr-comparison-group` is rendered and contains no `h4` and no
  `button[aria-expanded]`.
- The table's column header (`thead`, `pricing.features`) is unchanged.

#### Scenario: ClickUp table and compact markup

- **GIVEN** the ClickUp fixture, locale `en-US`, "Only differences" off and an empty search
- **WHEN** `renderComparison` renders the table layout
- **THEN** the output has exactly one `tbody`, no `pr-category-row` and at least one
  `data-pr-part="comparison-row"`
- **WHEN** it renders the compact layout
- **THEN** the output has exactly one `section` with class `pr-comparison-group`, no `h4` and at
  least one `pr-feature-card`

### Requirement: The headerless group is always expanded

`req~tag-groups-headerless-expanded~1`
WHILE a group's `kind` is `untagged`, the renderer SHALL treat the group as expanded whatever the
set of expanded groups holds, and SHALL keep the 30-row cap and the "Show N more" button
(`pricing.showRemaining`) for it.

Needs: impl, utest

- The counter of `req~shorter-page-counter~1` counts the headerless group's rows after the cap,
  as for any expanded group.

#### Scenario: Rows are visible without a click

- **GIVEN** the ClickUp fixture, "Only differences" off, an empty search, an empty set of expanded
  groups and an empty set of revealed groups
- **WHEN** the table layout renders
- **THEN** exactly 30 `data-pr-part="comparison-row"` elements are rendered
- **AND** the output contains the text `Show 144 more` from `pricing.showRemaining`

#### Scenario: Revealed group shows every row

- **GIVEN** the same state with `pr-untagged` in the set of revealed groups
- **WHEN** the compact layout renders
- **THEN** exactly 174 `pr-feature-card` articles are rendered and no "Show N more" button

### Requirement: No Expand all / Collapse all for a headerless comparison

`req~tag-groups-headerless-toolbar~1`
WHILE every comparison group of the view model has `kind` `untagged`, the comparison toolbar SHALL
render no "Expand all" (`pricing.expandAll`) and no "Collapse all" (`pricing.collapseAll`) button.

Needs: impl, utest

- The rest of the toolbar (search, "Only differences", counter) and its threshold
  (`req~shorter-page-toolbar-threshold~1`) are unchanged.

#### Scenario: ClickUp toolbar

- **GIVEN** the ClickUp fixture (174 rows, above the default threshold of 40) and locale `en-US`
- **WHEN** the comparison renders in the table layout
- **THEN** `data-pr-part="comparison-toolbar"` is present with the search input and the counter
- **AND** the output contains neither `Expand all` nor `Collapse all`

#### Scenario: Partly tagged toolbar keeps the buttons

- **GIVEN** the zoom fixture `tests/fixtures/spectra/zoom/2024.yml` and locale `en-US`
- **WHEN** the comparison renders in the table layout
- **THEN** the toolbar contains `Expand all` and `Collapse all`

### Requirement: Other features group for a partly tagged pricing

`req~tag-groups-partial~1`
WHEN the pricing is partly tagged, the view model SHALL emit its tag groups first, then one last
group with id `pr-other-features`, `kind` `other-features`, name from `pricing.otherFeatures`,
holding every untagged rendered feature in declaration order followed by every untagged rendered
usage limit in declaration order.

Needs: impl, utest

- Tag groups: one per distinct declared tag text, in order of first appearance over the features
  then the usage limits, `id` and `name` equal to the tag text, `kind` `tag`.
- No group with id `pr-usage-limits`, and no group named by `pricing.usageLimits`, is produced.
- The `Other features` group renders a header and toggles like a tag group.

#### Scenario: Zoom, untagged features and usage limits together

- **GIVEN** the zoom fixture and locale `en-US`
- **WHEN** the view model is built
- **THEN** the groups before the last one are the declared tag groups, in the order of first
  appearance of each tag in the fixture
- **AND** the last group has id `pr-other-features`, `kind` `other-features` and name
  `Other features`
- **AND** its rows are the 22 features without `tag` in fixture order (10 at
  `zoom/2024.yml:152-207`, `screenSharing` … `waitingRoom`, then 12 at `:855-917`,
  `callOutDialIn` … `zoomCompliantManager`), followed by all 8 usage limits (`:922-989`) in
  fixture order, 30 rows
- **AND** no group has id `General`, `Usage limits` or `pr-usage-limits`

#### Scenario: Shopify and Zenhub, only untagged usage limits

- **GIVEN** `tests/fixtures/spectra/shopify/2022.yml` or `tests/fixtures/spectra/zenhub/2024.yml`,
  where every feature declares a tag and no usage limit does
- **WHEN** the view model is built
- **THEN** the last group is `pr-other-features` and holds exactly the usage limits, in fixture
  order
- **AND** the groups before it are the tag groups with the same ids, names, order and rows as at
  base `91be006`

#### Scenario: Declared tag with the special group's name

- **GIVEN** a pricing with feature `a` with `tag: Other features` and feature `b` with no `tag`
- **WHEN** the view model is built in `en-US`
- **THEN** there are two groups: id `Other features` (rows `a`, `kind` `tag`) then id
  `pr-other-features` (rows `b`, `kind` `other-features`)

#### Scenario: Spanish names

- **GIVEN** the zoom fixture and locale `es-ES`
- **WHEN** the view model is built
- **THEN** the last group's name is `Otras características`
- **AND** the tag groups keep their declared tag text as names

### Requirement: Fully tagged pricing unchanged

`req~tag-groups-full-unchanged~1`
WHILE the pricing is fully tagged, the view model and the renderer SHALL produce the same groups
(ids, names, order, rows) and byte-identical comparison markup as at base `91be006`.

Needs: impl, utest

- Every group of a fully tagged pricing has `kind` `tag`; the markup does not render `kind`.
- No Playwright screenshot baseline moves: every baseline uses `tests/fixtures/acme-pricing.yml`.

#### Scenario: Acme groups and markup

- **GIVEN** `tests/fixtures/acme-pricing.yml` (features tagged `Workspace` and `Security`, usage
  limit tagged `Usage`) and default options
- **WHEN** the view model is built
- **THEN** the group names are `Workspace`, `Security`, `Usage` in that order, as asserted by
  `tests/unit/pricing.test.ts:173-177`
- **WHEN** the comparison renders in the table and the compact layouts
- **THEN** each output is identical to the output of the same render at base `91be006`, with
  `pr-category-row` headers in the table and `h4` toggles in compact

### Requirement: Group marker on the public type

`req~tag-groups-kind~1`
The exported type `PricingComparisonGroup` SHALL carry an optional field
`kind?: 'tag' | 'other-features' | 'untagged'`, where an absent value means `'tag'`.

Needs: impl, utest

- Pending owner CRP `crp-pr-item9-group-marker` (option (a)). Additive: view models and groups built
  by hand without `kind` keep rendering with headers, as today.

#### Scenario: Hand-built group without kind

- **GIVEN** a view model whose `comparisonGroups` is
  `[{ id: 'Custom', name: 'Custom', rows: [<one row>] }]` with no `kind`
- **WHEN** the table layout renders
- **THEN** the output has one `pr-category-row` with the text `Custom`

### Requirement: Group names from the message catalog

`req~tag-groups-i18n~1`
The view model SHALL read the names of the `pr-other-features` and `pr-untagged` groups from its
merged message catalog (`getMessages(locale, overrides)`) with the keys `pricing.otherFeatures` and
`pricing.features`.

Needs: impl, utest

- New key `pricing.otherFeatures`: en-US `Other features`, es-ES `Otras características`, in the
  exported catalogs `enUS` and `esES`.
- `src/core/view-model.ts` holds no English literal for a group name.

#### Scenario: Catalog values

- **GIVEN** the exported catalogs
- **WHEN** `enUS['pricing.otherFeatures']` and `esES['pricing.otherFeatures']` are read
- **THEN** they are `Other features` and `Otras características`

#### Scenario: Host override

- **GIVEN** the zoom fixture, locale `en-US` and the message override
  `{ 'pricing.otherFeatures': 'More' }`
- **WHEN** the view model is built
- **THEN** the group `pr-other-features` has name `More`

### Requirement: Normalized data and row category compatible

`req~tag-groups-compat~1`
The change SHALL leave the output of `normalizePricing`, the types and values of
`NormalizedFeature.tag` and `NormalizedUsageLimit.tag`, and the value of
`PricingComparisonRow.category` as they are at base `91be006`.

Needs: impl, utest

#### Scenario: Zoom rows keep their category

- **GIVEN** the zoom fixture
- **WHEN** it is normalized and the view model is built
- **THEN** the feature `callOutDialIn` has `tag` and row `category` `General`
- **AND** the usage limit `maxParticipants` has `tag` and row `category` `Usage limits`

## Relation to item 2

This change narrows `req~shorter-page-no-look-change~1`
(`docs/agent-work/spectra-item2-shorter-page/spec.md:118-131`), by owner decision: an untagged or
partly tagged pricing with 40 comparison rows or fewer no longer renders "exactly as before". Its
groups follow this spec. The acme part of that requirement (byte-identical markup, no baseline
moves) still holds and is restated by `req~tag-groups-full-unchanged~1`.

## Measurable criteria

- (a) Unit, view model: for all 37 SPECTRA fixtures, the classification, group ids, `kind`, names
  and row ids per group follow the requirements above. The untagged ids of zoom, shopify and zenhub
  are read from the fixtures (`raw.tag`), not hard-coded. 34 fixtures have one group `pr-untagged`.
- (b) Unit, markup: clickup in table and compact has no `pr-category-row`, no group `h4`, 30 rows,
  `Show 144 more`, and no `Expand all`/`Collapse all`. Zoom has headers for every group, the last
  one `Other features`.
- (c) Unit, i18n: en-US, es-ES and the override `pricing.otherFeatures` on zoom.
- (d) Unit, acme: group names `Workspace`, `Security`, `Usage`; table and compact markup identical
  to base `91be006`.
- (e) Unit, compatibility: normalize output and `category` values of zoom unchanged; a hand-built
  group without `kind` renders a header.
- (f) Browser, CI: `tests/browser/spectra-shorter-page.spec.ts` keeps passing (clickup, zoom,
  salesforce, webflow within the phase 1 baseline + 0.15 screens, clickup at most 5 screens at
  1440x900). `tests/browser/reveal-focus.spec.ts` and the acme screenshot baselines of
  `tests/browser/pricing-renderer.spec.ts` keep passing without baseline updates.
- (g) `docs/agent-work/visual-review-spectra/metrics.json` is regenerated (intake D9); its diff only
  touches the group fields and the one/two group summary.

## Risks

- R1 (intake): untagged pricings whose first group had fewer than 30 rows now show usage-limit rows
  at load up to the cap, and lose two header rows. The height gates of criterion (f) may move. S2
  stops with the measured values if they fail; thresholds are not edited.
- R2 (new with the amendment): shopify and zenhub show their usage limits under the name
  `Other features` and the group id changes from `Usage limits` to `pr-other-features`. This is the
  owner's choice; hosts that addressed the old group id must update.
- R3 (intake): hand-built pricings without `raw.tag` count as untagged (known limit above).
- R4 (new): zoom's 10 untagged meeting features (`zoom/2024.yml:152-207`) leave the `General`
  group after `Meetings` and join the last group `Other features`, so they are no longer near the
  tagged meeting features. This follows the owner's rule; it is visible in the S4 guide.

## Out of scope

- Ordering tag groups by `metadata.tags` or by any declared order other than first appearance.
- Grouping add-on rows or rows by name prefix (`report.md:365`).
- Changing the normalize defaults `'General'` / `'Usage limits'` or the `tag` types.
- Group ids with spaces in `aria-controls` (intake R5, existing issue).
- Updating `INTENT.md` records of item 9 (intake Q3) and the request body check (intake Q4).
