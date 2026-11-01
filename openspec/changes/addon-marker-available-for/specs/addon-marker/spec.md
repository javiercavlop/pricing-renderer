## ADDED Requirements

### Requirement: Add-on marker per plan availability

`req~addon-marker-per-plan-availability~1`
WHEN `renderComparison` renders a plan cell of an add-on-only comparison row in the table or the compact layout, the renderer SHALL render the add-on marker in that cell when at least one add-on of `viewModel.addOns` provides the row and has an empty `availableFor` or an `availableFor` that contains the cell's plan id, and the em dash with `pricing.notIncluded` when no such add-on exists.

Needs: impl, utest

#### Scenario: Add-on restricted to one of two plans

- **GIVEN** a pricing with the plans `BASIC` and `PRO`, a feature `sso` whose value is `false` in both plans, and one add-on `ssoPack` with `features.sso: true` and `availableFor: [PRO]`
- **WHEN** `renderComparison` renders the comparison in the table layout and in the compact layout
- **THEN** in each layout the `sso` row contains exactly one `pr-value pr-value--addon` span, in the `PRO` cell, with the visible text "Add-on" and the screen-reader text "Available as add-on"
- **AND** the `BASIC` cell contains a `pr-value pr-value--excluded` span with the visible text "—" and the screen-reader text "Not included"

#### Scenario: Restricted add-on with the es catalog

- **GIVEN** the pricing of the scenario "Add-on restricted to one of two plans" and the locale `es`
- **WHEN** `renderComparison` renders the comparison in the table layout
- **THEN** the `PRO` cell of the `sso` row reads "Complemento" and "Disponible como complemento"
- **AND** the `BASIC` cell reads "—" and "No incluido"

#### Scenario: Add-on available for every plan

- **GIVEN** the plans `BASIC` and `PRO`, a feature `sso` whose value is `false` in both plans, and one add-on with `features.sso: true` and `availableFor: []`
- **WHEN** `renderComparison` renders the comparison in the table layout and in the compact layout
- **THEN** in each layout the `sso` row contains exactly 2 markers, one in each plan cell
- **AND** the row contains no `pr-value--excluded` span

#### Scenario: Two add-ons cover the two plans

- **GIVEN** the plans `BASIC` and `PRO`, a feature `sso` whose value is `false` in both plans, an add-on `ssoBasic` with `features.sso: true` and `availableFor: [BASIC]`, and an add-on `ssoPro` with `features.sso: true` and `availableFor: [PRO]`
- **WHEN** `renderComparison` renders the comparison in the table layout and in the compact layout
- **THEN** in each layout the `sso` row contains exactly 2 markers, one in each plan cell

#### Scenario: Availability and provision come from the same add-on

- **GIVEN** the plans `BASIC` and `PRO`, a feature `sso` whose value is `false` in both plans, an add-on `ssoPack` with `features.sso: true` and `availableFor: [PRO]`, and an add-on `storage` with `features.sso: false` and `availableFor: [BASIC]`
- **WHEN** `renderComparison` renders the comparison in the table layout
- **THEN** the `PRO` cell of the `sso` row contains the marker
- **AND** the `BASIC` cell of the `sso` row contains the em dash with "Not included"

#### Scenario: Usage-limit row provided by a restricted extension

- **GIVEN** the plans `BASIC` and `PRO`, a usage limit `seats` with no value in either plan, and one add-on with `usageLimitsExtensions.seats: 5` and `availableFor: [PRO]`
- **WHEN** `renderComparison` renders the comparison in the compact layout
- **THEN** the `PRO` cell of the `seats` row contains the marker
- **AND** the `BASIC` cell of the `seats` row contains the em dash with "Not included"

#### Scenario: Mixed row keeps the em dash

- **GIVEN** the plans `BASIC` and `PRO`, a feature `sso` whose value is `false` in `BASIC` and `true` in `PRO`, and one add-on with `features.sso: true` and `availableFor: [BASIC]`
- **WHEN** `renderComparison` renders the comparison in the table layout and in the compact layout
- **THEN** in each layout the `BASIC` cell of the `sso` row contains the em dash with "Not included"
- **AND** the `sso` row contains no marker

#### Scenario: Plan that no add-on is available for

- **GIVEN** the SPECTRA fixture `tests/fixtures/spectra/mailchimp/2024.yml`, whose plans are `FREE`, `ESSENTIALS`, `STANDARD` and `PREMIUM` and whose add-ons never list `FREE` in `availableFor`
- **WHEN** `renderComparison` renders the comparison in the table layout and in the compact layout
- **THEN** the `FREE` cell of every add-on-only row contains the em dash with "Not included" and no marker

#### Scenario: No misleading marker cell in the SPECTRA and stress fixtures

- **GIVEN** every fixture of `tests/fixtures/spectra` and every stress fixture
- **WHEN** `renderComparison` renders each one in the table layout and in the compact layout
- **THEN** the number of marker cells whose plan has no available add-on that provides the row is 0
- **AND** in every add-on-only row the number of markers equals the number of plans for which an available add-on provides the row

### Requirement: Per-plan add-on test stays internal

`req~addon-marker-helper-internal~1`
The core SHALL expose the per-plan test `addOnProvidesForPlan(viewModel, row, planId): boolean` only as an export of `src/core/view-model.ts`, without a re-export from `src/core/index.ts`, without a change to `PricingComparisonRow` or `src/core/types.ts`, and without a new attribute, event, CSS part, data attribute or feature flag.

Needs: impl, utest

#### Scenario: Exported from the view model module only

- **GIVEN** the modules `src/core/view-model.ts` and `src/core/index.ts`
- **WHEN** a test imports both
- **THEN** `typeof addOnProvidesForPlan` imported from `src/core/view-model.ts` is `'function'`
- **AND** `'addOnProvidesForPlan' in core` is `false` for the namespace import of `src/core/index.ts`
- **AND** the source text of `src/core/index.ts` does not contain `addOnProvidesForPlan`

#### Scenario: Per-plan answers of the helper

- **GIVEN** the plans `BASIC` and `PRO`, a feature row `sso` whose value is `false` in both plans, and one add-on with `features.sso: true` and `availableFor: [PRO]`
- **WHEN** `addOnProvidesForPlan` is called for the `sso` row
- **THEN** it returns `true` for the plan id `PRO`
- **AND** it returns `false` for the plan id `BASIC`

#### Scenario: Marker markup has no new hook

- **GIVEN** the pricing of the scenario "Add-on restricted to one of two plans"
- **WHEN** `renderComparison` renders the comparison in the table layout
- **THEN** the marker span in the `PRO` cell has `class` as its only attribute
- **AND** the rendered comparison contains no `data-pr-part` value and no attribute name that the same pricing without `availableFor` does not also render
