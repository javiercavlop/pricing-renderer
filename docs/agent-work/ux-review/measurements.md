# UX review measurements

Status: unit half recorded on 2026-11-01. Browser half pending a dispatch.

This file keeps the measurements of milestone M1 (`docs/agent-work/pending-phases/plan.md:364-373`).
Today it holds the unit-level half: the UX-2 counts printed by `tests/unit/ux-counts.test.ts` for
every committed fixture, and the two gate decisions that follow from them (UX-7 go, UX-9 no-go). The
browser half (section heights, `layout="table"` comparison) needs a dispatch run and is still a
placeholder at the end of this file. The counts are copied here so they do not depend on the
retention of CI logs.

## Sources

- CI job 123038640831 is the job `quality (22)` of PR #72. It ran on the merge ref `a5d378c`, which
  is the merge of the PR head `936631a` into the base `88f5141`. The counts below come from the merge
  ref, not from the PR head alone.
- Confirmation: PR #74 (head `ee91c18`), job `quality (22)` id 124964849166, merge ref `738d087`,
  prints the same TOTAL line, field for field.
- Producer: the print test of `tests/unit/ux-counts.test.ts` (lines 139-149). It prints one
  `UX_COUNTS` line per fixture and one TOTAL line.
- The same lines are reproduced in the lab with
  `pnpm exec vitest run tests/unit/ux-counts.test.ts`. The block below is that output, with only the
  test runner's own prefix removed.
- 62 fixtures: `tests/fixtures/acme-pricing.yml`, 37 SPECTRA fixtures and 24 stress fixtures.

## Field definitions

Fields are those of `UxCounts` (`tests/unit/ux-counts.test.ts:19-35`), computed in `countFixture`
(`:89-121`). Every count is per fixture; the TOTAL line sums them.

- `fixture`: the file path, or `stress:<id>` for a built stress fixture. `fixtures` (TOTAL only) is
  the number of fixtures.
- `plans`, `addOns`: the number of plans and of add-ons of the view model.
- `rows`: comparison rows over all groups. `groups`: comparison groups.
- `rowsAboveProposedCapInGroups`: per group, the rows above 8, summed. 8 is a proposed threshold for
  the narrow layout (`:11-13`), not a renderer value.
- `groupsAboveProposedCap`: groups with more than 8 rows.
- `rowsAboveRendererCapInGroups`: per group, the rows above 30, summed. 30 is the real cap,
  `group.rows.slice(0, 30)` in `src/element/renderers.ts` (`:14-15`).
- `addOnOnlyRows`: rows for which `isAddOnOnlyRow` is true (`:95`): every plan cell is empty and some
  add-on provides the row.
- `addOnOnlyRowsMisleading`: add-on-only rows whose marker is misleading **at the default selected
  plan** (`:94-98`): no add-on that provides the row can be bought on that plan. It counts **rows**
  at one plan, not cells, so 137 is not a cell count.
- `planDescriptionsMissing`, `addOnDescriptionsMissing`: items whose description is undefined or
  blank after trim (`isBlank`, `:49-51`).
- `planDescriptionsFiller`, `addOnDescriptionsFiller`: items whose description equals the name.
  `isFiller` trims and lowercases both sides (`:53-55`), the same rule as `rowDescription` in
  `src/element/renderers.ts:253-257`.
- The description counts read `plan.description` and `plan.name`, and `addOn.description` and
  `addOn.name` (`:115-118`).
- `addOnsNotAvailableForSelectedPlan`: add-ons with a non-empty `availableFor` that does not include
  the selected plan (`availableForPlan`, `:57-59`; `:119`).

## Counts

```text
UX_COUNTS {"fixture":"tests/fixtures/acme-pricing.yml","plans":3,"addOns":3,"rows":5,"groups":3,"rowsAboveProposedCapInGroups":0,"groupsAboveProposedCap":0,"rowsAboveRendererCapInGroups":0,"addOnOnlyRows":0,"addOnOnlyRowsMisleading":0,"planDescriptionsMissing":0,"planDescriptionsFiller":0,"addOnDescriptionsMissing":0,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":3}
UX_COUNTS {"fixture":"tests/fixtures/spectra/box/2024.yml","plans":5,"addOns":9,"rows":60,"groups":1,"rowsAboveProposedCapInGroups":52,"groupsAboveProposedCap":1,"rowsAboveRendererCapInGroups":30,"addOnOnlyRows":4,"addOnOnlyRowsMisleading":4,"planDescriptionsMissing":5,"planDescriptionsFiller":0,"addOnDescriptionsMissing":5,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":8}
UX_COUNTS {"fixture":"tests/fixtures/spectra/buffer/2024.yml","plans":4,"addOns":3,"rows":92,"groups":1,"rowsAboveProposedCapInGroups":84,"groupsAboveProposedCap":1,"rowsAboveRendererCapInGroups":62,"addOnOnlyRows":0,"addOnOnlyRowsMisleading":0,"planDescriptionsMissing":0,"planDescriptionsFiller":0,"addOnDescriptionsMissing":3,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":3}
UX_COUNTS {"fixture":"tests/fixtures/spectra/canva/2024.yml","plans":4,"addOns":0,"rows":106,"groups":1,"rowsAboveProposedCapInGroups":98,"groupsAboveProposedCap":1,"rowsAboveRendererCapInGroups":76,"addOnOnlyRows":0,"addOnOnlyRowsMisleading":0,"planDescriptionsMissing":0,"planDescriptionsFiller":0,"addOnDescriptionsMissing":0,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":0}
UX_COUNTS {"fixture":"tests/fixtures/spectra/circleci/2024.yml","plans":3,"addOns":7,"rows":58,"groups":1,"rowsAboveProposedCapInGroups":50,"groupsAboveProposedCap":1,"rowsAboveRendererCapInGroups":28,"addOnOnlyRows":4,"addOnOnlyRowsMisleading":4,"planDescriptionsMissing":3,"planDescriptionsFiller":0,"addOnDescriptionsMissing":7,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":7}
UX_COUNTS {"fixture":"tests/fixtures/spectra/clickup/2024.yml","plans":4,"addOns":2,"rows":174,"groups":1,"rowsAboveProposedCapInGroups":166,"groupsAboveProposedCap":1,"rowsAboveRendererCapInGroups":144,"addOnOnlyRows":1,"addOnOnlyRowsMisleading":1,"planDescriptionsMissing":0,"planDescriptionsFiller":0,"addOnDescriptionsMissing":2,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":2}
UX_COUNTS {"fixture":"tests/fixtures/spectra/clockify/2024.yml","plans":6,"addOns":4,"rows":72,"groups":1,"rowsAboveProposedCapInGroups":64,"groupsAboveProposedCap":1,"rowsAboveRendererCapInGroups":42,"addOnOnlyRows":0,"addOnOnlyRowsMisleading":0,"planDescriptionsMissing":0,"planDescriptionsFiller":0,"addOnDescriptionsMissing":4,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":4}
UX_COUNTS {"fixture":"tests/fixtures/spectra/crowdcast/2024.yml","plans":3,"addOns":4,"rows":22,"groups":1,"rowsAboveProposedCapInGroups":14,"groupsAboveProposedCap":1,"rowsAboveRendererCapInGroups":0,"addOnOnlyRows":1,"addOnOnlyRowsMisleading":0,"planDescriptionsMissing":0,"planDescriptionsFiller":0,"addOnDescriptionsMissing":0,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":0}
UX_COUNTS {"fixture":"tests/fixtures/spectra/databox/2024.yml","plans":5,"addOns":8,"rows":72,"groups":1,"rowsAboveProposedCapInGroups":64,"groupsAboveProposedCap":1,"rowsAboveRendererCapInGroups":42,"addOnOnlyRows":3,"addOnOnlyRowsMisleading":2,"planDescriptionsMissing":5,"planDescriptionsFiller":0,"addOnDescriptionsMissing":8,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":7}
UX_COUNTS {"fixture":"tests/fixtures/spectra/deskera/2024.yml","plans":3,"addOns":0,"rows":100,"groups":1,"rowsAboveProposedCapInGroups":92,"groupsAboveProposedCap":1,"rowsAboveRendererCapInGroups":70,"addOnOnlyRows":0,"addOnOnlyRowsMisleading":0,"planDescriptionsMissing":3,"planDescriptionsFiller":0,"addOnDescriptionsMissing":0,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":0}
UX_COUNTS {"fixture":"tests/fixtures/spectra/dropbox/2024.yml","plans":5,"addOns":4,"rows":103,"groups":1,"rowsAboveProposedCapInGroups":95,"groupsAboveProposedCap":1,"rowsAboveRendererCapInGroups":73,"addOnOnlyRows":0,"addOnOnlyRowsMisleading":0,"planDescriptionsMissing":5,"planDescriptionsFiller":0,"addOnDescriptionsMissing":4,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":4}
UX_COUNTS {"fixture":"tests/fixtures/spectra/evernote/2024.yml","plans":4,"addOns":0,"rows":39,"groups":1,"rowsAboveProposedCapInGroups":31,"groupsAboveProposedCap":1,"rowsAboveRendererCapInGroups":9,"addOnOnlyRows":0,"addOnOnlyRowsMisleading":0,"planDescriptionsMissing":0,"planDescriptionsFiller":0,"addOnDescriptionsMissing":0,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":0}
UX_COUNTS {"fixture":"tests/fixtures/spectra/figma/2024.yml","plans":6,"addOns":0,"rows":93,"groups":1,"rowsAboveProposedCapInGroups":85,"groupsAboveProposedCap":1,"rowsAboveRendererCapInGroups":63,"addOnOnlyRows":0,"addOnOnlyRowsMisleading":0,"planDescriptionsMissing":6,"planDescriptionsFiller":0,"addOnDescriptionsMissing":0,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":0}
UX_COUNTS {"fixture":"tests/fixtures/spectra/github/2024.yml","plans":3,"addOns":14,"rows":90,"groups":1,"rowsAboveProposedCapInGroups":82,"groupsAboveProposedCap":1,"rowsAboveRendererCapInGroups":60,"addOnOnlyRows":32,"addOnOnlyRowsMisleading":17,"planDescriptionsMissing":0,"planDescriptionsFiller":0,"addOnDescriptionsMissing":14,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":6}
UX_COUNTS {"fixture":"tests/fixtures/spectra/hypercontext/2024.yml","plans":4,"addOns":0,"rows":63,"groups":1,"rowsAboveProposedCapInGroups":55,"groupsAboveProposedCap":1,"rowsAboveRendererCapInGroups":33,"addOnOnlyRows":0,"addOnOnlyRowsMisleading":0,"planDescriptionsMissing":0,"planDescriptionsFiller":0,"addOnDescriptionsMissing":0,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":0}
UX_COUNTS {"fixture":"tests/fixtures/spectra/jira/2024.yml","plans":4,"addOns":1,"rows":66,"groups":1,"rowsAboveProposedCapInGroups":58,"groupsAboveProposedCap":1,"rowsAboveRendererCapInGroups":36,"addOnOnlyRows":0,"addOnOnlyRowsMisleading":0,"planDescriptionsMissing":4,"planDescriptionsFiller":0,"addOnDescriptionsMissing":1,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":0}
UX_COUNTS {"fixture":"tests/fixtures/spectra/mailchimp/2024.yml","plans":4,"addOns":5,"rows":98,"groups":1,"rowsAboveProposedCapInGroups":90,"groupsAboveProposedCap":1,"rowsAboveRendererCapInGroups":68,"addOnOnlyRows":16,"addOnOnlyRowsMisleading":16,"planDescriptionsMissing":0,"planDescriptionsFiller":0,"addOnDescriptionsMissing":5,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":5}
UX_COUNTS {"fixture":"tests/fixtures/spectra/microsoft365Business/2024.yml","plans":4,"addOns":1,"rows":64,"groups":1,"rowsAboveProposedCapInGroups":56,"groupsAboveProposedCap":1,"rowsAboveRendererCapInGroups":34,"addOnOnlyRows":1,"addOnOnlyRowsMisleading":0,"planDescriptionsMissing":4,"planDescriptionsFiller":0,"addOnDescriptionsMissing":1,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":0}
UX_COUNTS {"fixture":"tests/fixtures/spectra/notion/2024.yml","plans":4,"addOns":2,"rows":65,"groups":1,"rowsAboveProposedCapInGroups":57,"groupsAboveProposedCap":1,"rowsAboveRendererCapInGroups":35,"addOnOnlyRows":1,"addOnOnlyRowsMisleading":1,"planDescriptionsMissing":4,"planDescriptionsFiller":0,"addOnDescriptionsMissing":2,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":2}
UX_COUNTS {"fixture":"tests/fixtures/spectra/okta/2024.yml","plans":0,"addOns":18,"rows":141,"groups":1,"rowsAboveProposedCapInGroups":133,"groupsAboveProposedCap":1,"rowsAboveRendererCapInGroups":111,"addOnOnlyRows":141,"addOnOnlyRowsMisleading":0,"planDescriptionsMissing":0,"planDescriptionsFiller":0,"addOnDescriptionsMissing":18,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":0}
UX_COUNTS {"fixture":"tests/fixtures/spectra/openphone/2024.yml","plans":3,"addOns":6,"rows":52,"groups":1,"rowsAboveProposedCapInGroups":44,"groupsAboveProposedCap":1,"rowsAboveRendererCapInGroups":22,"addOnOnlyRows":6,"addOnOnlyRowsMisleading":0,"planDescriptionsMissing":3,"planDescriptionsFiller":0,"addOnDescriptionsMissing":6,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":0}
UX_COUNTS {"fixture":"tests/fixtures/spectra/overleaf/2024.yml","plans":4,"addOns":0,"rows":18,"groups":1,"rowsAboveProposedCapInGroups":10,"groupsAboveProposedCap":1,"rowsAboveRendererCapInGroups":0,"addOnOnlyRows":0,"addOnOnlyRowsMisleading":0,"planDescriptionsMissing":4,"planDescriptionsFiller":0,"addOnDescriptionsMissing":0,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":0}
UX_COUNTS {"fixture":"tests/fixtures/spectra/planable/2024.yml","plans":4,"addOns":5,"rows":52,"groups":1,"rowsAboveProposedCapInGroups":44,"groupsAboveProposedCap":1,"rowsAboveRendererCapInGroups":22,"addOnOnlyRows":4,"addOnOnlyRowsMisleading":4,"planDescriptionsMissing":0,"planDescriptionsFiller":0,"addOnDescriptionsMissing":0,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":5}
UX_COUNTS {"fixture":"tests/fixtures/spectra/postman/2024.yml","plans":4,"addOns":12,"rows":112,"groups":1,"rowsAboveProposedCapInGroups":104,"groupsAboveProposedCap":1,"rowsAboveRendererCapInGroups":82,"addOnOnlyRows":14,"addOnOnlyRowsMisleading":8,"planDescriptionsMissing":4,"planDescriptionsFiller":0,"addOnDescriptionsMissing":12,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":11}
UX_COUNTS {"fixture":"tests/fixtures/spectra/pumble/2024.yml","plans":4,"addOns":0,"rows":41,"groups":1,"rowsAboveProposedCapInGroups":33,"groupsAboveProposedCap":1,"rowsAboveRendererCapInGroups":11,"addOnOnlyRows":0,"addOnOnlyRowsMisleading":0,"planDescriptionsMissing":0,"planDescriptionsFiller":0,"addOnDescriptionsMissing":0,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":0}
UX_COUNTS {"fixture":"tests/fixtures/spectra/quip/2024.yml","plans":3,"addOns":0,"rows":15,"groups":1,"rowsAboveProposedCapInGroups":7,"groupsAboveProposedCap":1,"rowsAboveRendererCapInGroups":0,"addOnOnlyRows":0,"addOnOnlyRowsMisleading":0,"planDescriptionsMissing":0,"planDescriptionsFiller":0,"addOnDescriptionsMissing":0,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":0}
UX_COUNTS {"fixture":"tests/fixtures/spectra/salesforce/2024.yml","plans":3,"addOns":14,"rows":124,"groups":1,"rowsAboveProposedCapInGroups":116,"groupsAboveProposedCap":1,"rowsAboveRendererCapInGroups":94,"addOnOnlyRows":44,"addOnOnlyRowsMisleading":10,"planDescriptionsMissing":3,"planDescriptionsFiller":0,"addOnDescriptionsMissing":14,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":6}
UX_COUNTS {"fixture":"tests/fixtures/spectra/shopify/2022.yml","plans":3,"addOns":1,"rows":43,"groups":6,"rowsAboveProposedCapInGroups":10,"groupsAboveProposedCap":2,"rowsAboveRendererCapInGroups":0,"addOnOnlyRows":1,"addOnOnlyRowsMisleading":0,"planDescriptionsMissing":0,"planDescriptionsFiller":0,"addOnDescriptionsMissing":0,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":0}
UX_COUNTS {"fixture":"tests/fixtures/spectra/slack/2024.yml","plans":4,"addOns":4,"rows":51,"groups":1,"rowsAboveProposedCapInGroups":43,"groupsAboveProposedCap":1,"rowsAboveRendererCapInGroups":21,"addOnOnlyRows":2,"addOnOnlyRowsMisleading":2,"planDescriptionsMissing":0,"planDescriptionsFiller":0,"addOnDescriptionsMissing":4,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":4}
UX_COUNTS {"fixture":"tests/fixtures/spectra/tableau/2024.yml","plans":3,"addOns":7,"rows":42,"groups":1,"rowsAboveProposedCapInGroups":34,"groupsAboveProposedCap":1,"rowsAboveRendererCapInGroups":12,"addOnOnlyRows":10,"addOnOnlyRowsMisleading":6,"planDescriptionsMissing":0,"planDescriptionsFiller":0,"addOnDescriptionsMissing":7,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":4}
UX_COUNTS {"fixture":"tests/fixtures/spectra/trello/2024.yml","plans":4,"addOns":1,"rows":46,"groups":1,"rowsAboveProposedCapInGroups":38,"groupsAboveProposedCap":1,"rowsAboveRendererCapInGroups":16,"addOnOnlyRows":1,"addOnOnlyRowsMisleading":0,"planDescriptionsMissing":4,"planDescriptionsFiller":0,"addOnDescriptionsMissing":0,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":0}
UX_COUNTS {"fixture":"tests/fixtures/spectra/trustmary/2024.yml","plans":4,"addOns":1,"rows":49,"groups":1,"rowsAboveProposedCapInGroups":41,"groupsAboveProposedCap":1,"rowsAboveRendererCapInGroups":19,"addOnOnlyRows":1,"addOnOnlyRowsMisleading":0,"planDescriptionsMissing":1,"planDescriptionsFiller":0,"addOnDescriptionsMissing":1,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":0}
UX_COUNTS {"fixture":"tests/fixtures/spectra/userguiding/2024.yml","plans":3,"addOns":11,"rows":68,"groups":1,"rowsAboveProposedCapInGroups":60,"groupsAboveProposedCap":1,"rowsAboveRendererCapInGroups":38,"addOnOnlyRows":0,"addOnOnlyRowsMisleading":0,"planDescriptionsMissing":0,"planDescriptionsFiller":0,"addOnDescriptionsMissing":1,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":0}
UX_COUNTS {"fixture":"tests/fixtures/spectra/webflow/2024.yml","plans":15,"addOns":3,"rows":118,"groups":1,"rowsAboveProposedCapInGroups":110,"groupsAboveProposedCap":1,"rowsAboveRendererCapInGroups":88,"addOnOnlyRows":1,"addOnOnlyRowsMisleading":0,"planDescriptionsMissing":15,"planDescriptionsFiller":0,"addOnDescriptionsMissing":3,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":2}
UX_COUNTS {"fixture":"tests/fixtures/spectra/wrike/2024.yml","plans":5,"addOns":5,"rows":86,"groups":1,"rowsAboveProposedCapInGroups":78,"groupsAboveProposedCap":1,"rowsAboveRendererCapInGroups":56,"addOnOnlyRows":3,"addOnOnlyRowsMisleading":3,"planDescriptionsMissing":0,"planDescriptionsFiller":0,"addOnDescriptionsMissing":5,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":5}
UX_COUNTS {"fixture":"tests/fixtures/spectra/zapier/2024.yml","plans":4,"addOns":4,"rows":54,"groups":1,"rowsAboveProposedCapInGroups":46,"groupsAboveProposedCap":1,"rowsAboveRendererCapInGroups":24,"addOnOnlyRows":3,"addOnOnlyRowsMisleading":0,"planDescriptionsMissing":0,"planDescriptionsFiller":0,"addOnDescriptionsMissing":4,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":1}
UX_COUNTS {"fixture":"tests/fixtures/spectra/zenhub/2024.yml","plans":2,"addOns":0,"rows":43,"groups":7,"rowsAboveProposedCapInGroups":12,"groupsAboveProposedCap":1,"rowsAboveRendererCapInGroups":0,"addOnOnlyRows":0,"addOnOnlyRowsMisleading":0,"planDescriptionsMissing":2,"planDescriptionsFiller":0,"addOnDescriptionsMissing":0,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":0}
UX_COUNTS {"fixture":"tests/fixtures/spectra/zoom/2024.yml","plans":5,"addOns":16,"rows":151,"groups":9,"rowsAboveProposedCapInGroups":89,"groupsAboveProposedCap":5,"rowsAboveRendererCapInGroups":15,"addOnOnlyRows":13,"addOnOnlyRowsMisleading":3,"planDescriptionsMissing":1,"planDescriptionsFiller":0,"addOnDescriptionsMissing":16,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":2}
UX_COUNTS {"fixture":"stress:okta-eur-monthly","plans":0,"addOns":18,"rows":141,"groups":1,"rowsAboveProposedCapInGroups":133,"groupsAboveProposedCap":1,"rowsAboveRendererCapInGroups":111,"addOnOnlyRows":37,"addOnOnlyRowsMisleading":0,"planDescriptionsMissing":0,"planDescriptionsFiller":0,"addOnDescriptionsMissing":0,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":0}
UX_COUNTS {"fixture":"stress:okta-eur-annual","plans":0,"addOns":18,"rows":141,"groups":1,"rowsAboveProposedCapInGroups":133,"groupsAboveProposedCap":1,"rowsAboveRendererCapInGroups":111,"addOnOnlyRows":37,"addOnOnlyRowsMisleading":0,"planDescriptionsMissing":0,"planDescriptionsFiller":0,"addOnDescriptionsMissing":0,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":0}
UX_COUNTS {"fixture":"stress:okta-usd-monthly","plans":0,"addOns":18,"rows":141,"groups":1,"rowsAboveProposedCapInGroups":133,"groupsAboveProposedCap":1,"rowsAboveRendererCapInGroups":111,"addOnOnlyRows":37,"addOnOnlyRowsMisleading":0,"planDescriptionsMissing":0,"planDescriptionsFiller":0,"addOnDescriptionsMissing":0,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":0}
UX_COUNTS {"fixture":"stress:okta-usd-annual","plans":0,"addOns":18,"rows":141,"groups":1,"rowsAboveProposedCapInGroups":133,"groupsAboveProposedCap":1,"rowsAboveRendererCapInGroups":111,"addOnOnlyRows":37,"addOnOnlyRowsMisleading":0,"planDescriptionsMissing":0,"planDescriptionsFiller":0,"addOnDescriptionsMissing":0,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":0}
UX_COUNTS {"fixture":"stress:zoom-eur-monthly","plans":4,"addOns":16,"rows":149,"groups":1,"rowsAboveProposedCapInGroups":141,"groupsAboveProposedCap":1,"rowsAboveRendererCapInGroups":119,"addOnOnlyRows":7,"addOnOnlyRowsMisleading":4,"planDescriptionsMissing":0,"planDescriptionsFiller":0,"addOnDescriptionsMissing":0,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":10}
UX_COUNTS {"fixture":"stress:zoom-eur-annual","plans":4,"addOns":16,"rows":149,"groups":1,"rowsAboveProposedCapInGroups":141,"groupsAboveProposedCap":1,"rowsAboveRendererCapInGroups":119,"addOnOnlyRows":7,"addOnOnlyRowsMisleading":4,"planDescriptionsMissing":0,"planDescriptionsFiller":0,"addOnDescriptionsMissing":0,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":10}
UX_COUNTS {"fixture":"stress:zoom-usd-monthly","plans":4,"addOns":16,"rows":149,"groups":1,"rowsAboveProposedCapInGroups":141,"groupsAboveProposedCap":1,"rowsAboveRendererCapInGroups":119,"addOnOnlyRows":7,"addOnOnlyRowsMisleading":4,"planDescriptionsMissing":0,"planDescriptionsFiller":0,"addOnDescriptionsMissing":0,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":10}
UX_COUNTS {"fixture":"stress:zoom-usd-annual","plans":4,"addOns":16,"rows":149,"groups":1,"rowsAboveProposedCapInGroups":141,"groupsAboveProposedCap":1,"rowsAboveRendererCapInGroups":119,"addOnOnlyRows":7,"addOnOnlyRowsMisleading":4,"planDescriptionsMissing":0,"planDescriptionsFiller":0,"addOnDescriptionsMissing":0,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":10}
UX_COUNTS {"fixture":"stress:clickup-eur-monthly","plans":5,"addOns":4,"rows":174,"groups":1,"rowsAboveProposedCapInGroups":166,"groupsAboveProposedCap":1,"rowsAboveRendererCapInGroups":144,"addOnOnlyRows":1,"addOnOnlyRowsMisleading":0,"planDescriptionsMissing":0,"planDescriptionsFiller":0,"addOnDescriptionsMissing":0,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":2}
UX_COUNTS {"fixture":"stress:clickup-eur-annual","plans":5,"addOns":4,"rows":174,"groups":1,"rowsAboveProposedCapInGroups":166,"groupsAboveProposedCap":1,"rowsAboveRendererCapInGroups":144,"addOnOnlyRows":1,"addOnOnlyRowsMisleading":0,"planDescriptionsMissing":0,"planDescriptionsFiller":0,"addOnDescriptionsMissing":0,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":2}
UX_COUNTS {"fixture":"stress:clickup-usd-monthly","plans":5,"addOns":4,"rows":174,"groups":1,"rowsAboveProposedCapInGroups":166,"groupsAboveProposedCap":1,"rowsAboveRendererCapInGroups":144,"addOnOnlyRows":1,"addOnOnlyRowsMisleading":0,"planDescriptionsMissing":0,"planDescriptionsFiller":0,"addOnDescriptionsMissing":0,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":2}
UX_COUNTS {"fixture":"stress:clickup-usd-annual","plans":5,"addOns":4,"rows":174,"groups":1,"rowsAboveProposedCapInGroups":166,"groupsAboveProposedCap":1,"rowsAboveRendererCapInGroups":144,"addOnOnlyRows":1,"addOnOnlyRowsMisleading":0,"planDescriptionsMissing":0,"planDescriptionsFiller":0,"addOnDescriptionsMissing":0,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":2}
UX_COUNTS {"fixture":"stress:webflow-eur-monthly","plans":15,"addOns":8,"rows":102,"groups":9,"rowsAboveProposedCapInGroups":30,"groupsAboveProposedCap":9,"rowsAboveRendererCapInGroups":0,"addOnOnlyRows":1,"addOnOnlyRowsMisleading":1,"planDescriptionsMissing":0,"planDescriptionsFiller":0,"addOnDescriptionsMissing":0,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":5}
UX_COUNTS {"fixture":"stress:webflow-eur-annual","plans":15,"addOns":8,"rows":102,"groups":9,"rowsAboveProposedCapInGroups":30,"groupsAboveProposedCap":9,"rowsAboveRendererCapInGroups":0,"addOnOnlyRows":1,"addOnOnlyRowsMisleading":1,"planDescriptionsMissing":0,"planDescriptionsFiller":0,"addOnDescriptionsMissing":0,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":5}
UX_COUNTS {"fixture":"stress:webflow-usd-monthly","plans":15,"addOns":8,"rows":102,"groups":9,"rowsAboveProposedCapInGroups":30,"groupsAboveProposedCap":9,"rowsAboveRendererCapInGroups":0,"addOnOnlyRows":1,"addOnOnlyRowsMisleading":1,"planDescriptionsMissing":0,"planDescriptionsFiller":0,"addOnDescriptionsMissing":0,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":5}
UX_COUNTS {"fixture":"stress:webflow-usd-annual","plans":15,"addOns":8,"rows":102,"groups":9,"rowsAboveProposedCapInGroups":30,"groupsAboveProposedCap":9,"rowsAboveRendererCapInGroups":0,"addOnOnlyRows":1,"addOnOnlyRowsMisleading":1,"planDescriptionsMissing":0,"planDescriptionsFiller":0,"addOnDescriptionsMissing":0,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":5}
UX_COUNTS {"fixture":"stress:salesforce-eur-monthly","plans":6,"addOns":14,"rows":128,"groups":9,"rowsAboveProposedCapInGroups":56,"groupsAboveProposedCap":8,"rowsAboveRendererCapInGroups":0,"addOnOnlyRows":4,"addOnOnlyRowsMisleading":3,"planDescriptionsMissing":0,"planDescriptionsFiller":0,"addOnDescriptionsMissing":0,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":9}
UX_COUNTS {"fixture":"stress:salesforce-eur-annual","plans":6,"addOns":14,"rows":128,"groups":9,"rowsAboveProposedCapInGroups":56,"groupsAboveProposedCap":8,"rowsAboveRendererCapInGroups":0,"addOnOnlyRows":4,"addOnOnlyRowsMisleading":3,"planDescriptionsMissing":0,"planDescriptionsFiller":0,"addOnDescriptionsMissing":0,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":9}
UX_COUNTS {"fixture":"stress:salesforce-usd-monthly","plans":6,"addOns":14,"rows":128,"groups":9,"rowsAboveProposedCapInGroups":56,"groupsAboveProposedCap":8,"rowsAboveRendererCapInGroups":0,"addOnOnlyRows":4,"addOnOnlyRowsMisleading":3,"planDescriptionsMissing":0,"planDescriptionsFiller":0,"addOnDescriptionsMissing":0,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":9}
UX_COUNTS {"fixture":"stress:salesforce-usd-annual","plans":6,"addOns":14,"rows":128,"groups":9,"rowsAboveProposedCapInGroups":56,"groupsAboveProposedCap":8,"rowsAboveRendererCapInGroups":0,"addOnOnlyRows":4,"addOnOnlyRowsMisleading":3,"planDescriptionsMissing":0,"planDescriptionsFiller":0,"addOnDescriptionsMissing":0,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":9}
UX_COUNTS {"fixture":"stress:github-eur-monthly","plans":4,"addOns":14,"rows":90,"groups":9,"rowsAboveProposedCapInGroups":18,"groupsAboveProposedCap":9,"rowsAboveRendererCapInGroups":0,"addOnOnlyRows":7,"addOnOnlyRowsMisleading":6,"planDescriptionsMissing":0,"planDescriptionsFiller":0,"addOnDescriptionsMissing":0,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":9}
UX_COUNTS {"fixture":"stress:github-eur-annual","plans":4,"addOns":14,"rows":90,"groups":9,"rowsAboveProposedCapInGroups":18,"groupsAboveProposedCap":9,"rowsAboveRendererCapInGroups":0,"addOnOnlyRows":7,"addOnOnlyRowsMisleading":6,"planDescriptionsMissing":0,"planDescriptionsFiller":0,"addOnDescriptionsMissing":0,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":9}
UX_COUNTS {"fixture":"stress:github-usd-monthly","plans":4,"addOns":14,"rows":90,"groups":9,"rowsAboveProposedCapInGroups":18,"groupsAboveProposedCap":9,"rowsAboveRendererCapInGroups":0,"addOnOnlyRows":7,"addOnOnlyRowsMisleading":6,"planDescriptionsMissing":0,"planDescriptionsFiller":0,"addOnDescriptionsMissing":0,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":9}
UX_COUNTS {"fixture":"stress:github-usd-annual","plans":4,"addOns":14,"rows":90,"groups":9,"rowsAboveProposedCapInGroups":18,"groupsAboveProposedCap":9,"rowsAboveRendererCapInGroups":0,"addOnOnlyRows":7,"addOnOnlyRowsMisleading":6,"planDescriptionsMissing":0,"planDescriptionsFiller":0,"addOnDescriptionsMissing":0,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":9}
UX_COUNTS {"fixture":"TOTAL","fixtures":62,"plans":291,"addOns":471,"rows":5884,"groups":179,"rowsAboveProposedCapInGroups":4521,"groupsAboveProposedCap":158,"rowsAboveRendererCapInGroups":3032,"addOnOnlyRows":535,"addOnOnlyRowsMisleading":137,"planDescriptionsMissing":76,"planDescriptionsFiller":0,"addOnDescriptionsMissing":147,"addOnDescriptionsFiller":0,"addOnsNotAvailableForSelectedPlan":231}
```

## Sanity check of the TOTAL line

The TOTAL line was compared with the values recorded from the CI log of job 123038640831. All 15
values are equal:

| Field                               | TOTAL |
| ----------------------------------- | ----: |
| `fixtures`                          |    62 |
| `plans`                             |   291 |
| `addOns`                            |   471 |
| `rows`                              |  5884 |
| `groups`                            |   179 |
| `rowsAboveProposedCapInGroups`      |  4521 |
| `groupsAboveProposedCap`            |   158 |
| `rowsAboveRendererCapInGroups`      |  3032 |
| `addOnOnlyRows`                     |   535 |
| `addOnOnlyRowsMisleading`           |   137 |
| `planDescriptionsMissing`           |    76 |
| `planDescriptionsFiller`            |     0 |
| `addOnDescriptionsMissing`          |   147 |
| `addOnDescriptionsFiller`           |     0 |
| `addOnsNotAvailableForSelectedPlan` |   231 |

## Gate decisions

| Gate | Decision | Basis                       |
| ---- | -------- | --------------------------- |
| UX-7 | GO       | 81 real rows in 14 pricings |
| UX-9 | NO-GO    | 0 fillers in 62 fixtures    |

### UX-7: go

- Gate: "count above 0" (`docs/agent-work/pending-phases/plan.md:370-371`).
- Real pricings, 81 misleading rows in 14 fixtures: box 4, circleci 4, clickup 1, databox 2,
  github 17, mailchimp 16, notion 1, planable 4, postman 8, salesforce 10, slack 2, tableau 6,
  wrike 3, zoom 3. The sum is 81.
- Stress fixtures add 56 rows: github ×4 at 6, zoom ×4 at 4, salesforce ×4 at 3, webflow ×4 at 1.
  81 + 56 = 137.
- The go was already approved by the owner through P-20261101-1
  (`docs/agent-work/prop-20261101-1/intake.md:3-5`). This record states the go; it does not newly
  unblock UX-7.
- Reminder: these are rows at the default selected plan, not cells (see the field definitions).

### UX-9: no-go

- Rule: "Go only if U2 finds fillers" (`plan.md:380`), and the UX-9 gate of
  `docs/agent-work/ux-review/report.md`, "UX-2 finds any".
- Result: 0 filler plan descriptions and 0 filler add-on descriptions across the 62 fixtures (acme,
  37 SPECTRA and 24 stress). The no-go follows.
- Consequence: U9 leaves the `renderers.ts` chain at `plan.md:505`, so the first `renderers.ts`
  slice is U7. This file does not edit `plan.md`.
- Caveat: the no-go rests on the 62 committed fixtures. A new fixture with fillers reopens UX-9.

### Facts without a decision

- `addOnsNotAvailableForSelectedPlan` is 231 across the 62 fixtures.
- `rowsAboveRendererCapInGroups` is 3032 across the 62 fixtures.

## Followup: UX-2 parts not delivered

UX-2 asks for more than `ux-counts.test.ts` prints (`report.md:378-385`). Not delivered:

- (a) a singular-unit field;
- (b) per-cell and mixed-row counts (the add-on-only counts exist at the selected plan only);
- (c) row-description counts, and the maximum and median length.

They are test code in `tests/unit/ux-counts.test.ts`, owned by P-20261101-1 slice T1. They are not
done here.

## Browser half (M1, pending a dispatch)

Not measured yet. M1 adds (`plan.md:368-371`):

- the `SPECTRA_UX_SUMMARY` fields from a browser run;
- section heights;
- the `layout="table"` comparison.

The UX-3 and UX-4 gates stay open until this half is recorded.
