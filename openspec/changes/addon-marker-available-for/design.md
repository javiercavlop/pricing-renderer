# Design: addon-marker-available-for

Decisions come from the planner intake (`docs/agent-work/prop-20261101-1/intake.md`, "Scope",
"Slices", "Feature flags", "Open questions") and the owner's approval of P-20261101-1, which also
answers CRP-U7 with Q-D "keep R6". Line numbers are at `09363ed`.

## Context

- `isAddOnOnlyRow(viewModel, row)` (`src/core/view-model.ts:611-620`): every plan cell is empty
  (`false`, `null`, `undefined`) and some add-on of `viewModel.addOns` provides the row (a non-empty
  `features[row.id]`, or for a usage-limit row a non-empty `usageLimits[row.id]` or
  `usageLimitsExtensions[row.id]`, after `unwrapValue`).
- `renderComparison` computes `addOnOnly` once per row in the compact layout
  (`src/element/renderers.ts:804`) and in the table layout (`:907`), and passes it to
  `renderValue` for every cell (`:826`, `:922`).
- `renderValue` (`:199-222`) renders the marker for an empty value when `addOnOnly` is true, else
  the em dash with `pricing.notIncluded`.
- The availability rule "`availableFor` empty means every plan" already exists in
  `src/core/resolve.ts:116-118`, `src/element/renderers.ts:992-996` (`addOnAvailability`) and
  `tests/unit/ux-counts.test.ts:57-59`.
- `src/core/index.ts:27-35` re-exports named members of `view-model.ts` only, with no `export *`.

## Decisions

### D1. A per-cell helper beside `isAddOnOnlyRow`

`addOnProvidesForPlan(viewModel, row, planId): boolean` in `src/core/view-model.ts` is true when
some add-on of `viewModel.addOns` provides the row (the same provision rule as `isAddOnOnlyRow`) and
its `availableFor` is empty or contains `planId`. The provision test is extracted into a private
function shared by both, with no change in behaviour of `isAddOnOnlyRow`.

Options considered:

- Change `isAddOnOnlyRow` to take a plan id. Rejected: it changes which rows are add-on only and
  the detected count of 166 (R9), and its callers in tests.
- Compute availability in `renderers.ts` from `addOnAvailability`. Rejected: that helper answers a
  different question (an add-on card for the selected plan) and would mix element and core rules.
- A separate helper in the core module. **Chosen.**

### D2. Cell call sites

Both layouts keep the per-row `addOnOnly` and pass
`addOnOnly && addOnProvidesForPlan(viewModel, row, cell.planId)` to `renderValue`. `renderValue` does
not change. A mixed row is never add-on only, so it never gets a marker (R6 kept, CRP-U7 Q-D).

### D3. No public surface, no flag

The helper is exported from `view-model.ts` for the tests only and is not added to
`src/core/index.ts` (`req~addon-marker-helper-internal~1`, item 6 R7). No feature flag: there is one
behaviour slice, and a flag would be a public attribute, which R7 forbids. No ADR: no new
architecture, dependency or public format.

### D4. R9 counts and intake Q1

- The detected count stays 166, because `isAddOnOnlyRow` does not change.
- A marked row is a row with at least one marker. The per-fixture marked-row numbers of item 6 R9
  (GitHub 32, Salesforce 44, Mailchimp 16, Postman 14, Zoom 13, Tableau 10) stay as long as every
  add-on-only row keeps at least one marker.
- A row loses every marker only when no plan of the fixture is named by the `availableFor` of a
  providing add-on. No SPECTRA fixture has a private plan (intake E6), so the visible plans are all
  plans. This was not checked for all fixtures; T1 measures it.
- If T1 finds such a row, the recommended answer (Q1 option A) is to state the measured marked-row
  counts. Item 6 R9 keeps the per-fixture numbers on one line ("per fixture: ..."), so that
  amendment replaces only that line. The two requirements of this change need no edit for it: they
  name no count.

### D5. Tests first

T1 writes the failing cases and amends the R3-derived assertions (intake E8):

- `tests/unit/addon-marker.test.ts:616-626` ("one marker per plan" in every marked SPECTRA row) and
  `:306-343` stay true only for add-ons with an unrestricted or full `availableFor`.
- `tests/browser/spectra-addon-marker.spec.ts:224-227,236-238,250` expect `markers === plans` and
  `32 × plans` for GitHub; they become per-row expectations from an independent reference.
- `tests/unit/ux-counts.test.ts` gets a cell-level metric `addOnMarkerCellsMisleading`, which must
  be 0. The existing `addOnOnlyRowsMisleading` stays and keeps printing 81, because it calls
  `isAddOnOnlyRow`, which does not change.

T1 is red by design, so T1 and I1 land in the same PR into develop.

## Requirement notes

`req~addon-marker-per-plan-availability~1`:

- "Add-on-only row": item 6 R1, decided by `isAddOnOnlyRow`.
- "The add-on marker": the `pr-value pr-value--addon` span with `pricing.addOnOnly` and
  `pricing.addOnOnlySr` of item 6 R3.
- "The em dash with `pricing.notIncluded`": the `pr-value pr-value--excluded` span of
  `renderValue`.
- "Provides": the provision rule of item 6, "Definitions".
- Availability and provision must hold for the same add-on (scenario "Availability and provision
  come from the same add-on").
- `dependsOn` and `excludes` are not read.

`req~addon-marker-helper-internal~1`:

- The signature is fixed so that tests can call the helper directly.
- "No new hook": the rendered markup of the marker and the em dash is the one of item 6; only the
  choice per cell changes.

## Risks

- R1. Some add-on-only rows may lose every marker, which changes the R9 rendered counts (D4).
  Mitigation: T1 measures before I1; the amendment is one line.
- R2. Conflicts in `src/element/renderers.ts` with other UX slices (U9, `plan.md:390`).
  Mitigation: the coordinator serializes owners of that file.
- R3. The availability rule now exists in four places. Mitigation: I1 copies it exactly (empty
  means every plan); a followup can unify it.
- R4. `addOnOnlyRowsMisleading` keeps printing 81 while `addOnMarkerCellsMisleading` prints 0.
  Mitigation: T1 comments the old field; a followup updates `report.md:496` and its stale line refs.
- R5. A user on a restricted plan sees "Not included" for something the vendor sells on other plans.
  Accepted by the proposal; UX-8 is out of scope.

## Migration

None. No stored data, option, type or i18n key changes.

## Open questions

- Q1 (only if T1 finds a row with no marker left): amend item 6 R9 with the measured marked-row
  counts (recommended, option A), or keep the marker in every cell of such rows (option B, not
  recommended).
- Q2 (coordinator): changeset bump patch, as `.changeset/spectra-addon-marker.md`.
