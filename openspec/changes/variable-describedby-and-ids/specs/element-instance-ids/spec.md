## ADDED Requirements

### Requirement: Instance-scoped injective ids

`req~element-instance-ids~2`
The renderer element of instance `<n>` SHALL build each `id` it renders, except the breakdown id, as `pr-<n>-<name>` or, from pricing data, `pr-<n>-<name>-<data>`, where `<data>` keeps ASCII letters and digits and writes every other code point, `-` and `_` included, as `_<lowercase hex code point>_`.

Needs: impl, utest

#### Scenario: Two renderers of one pricing

- **GIVEN** two elements loaded with the same `tests/fixtures/acme-pricing.yml`
- **WHEN** both render
- **THEN** no `id` value appears twice in the combined output
- **AND** every ARIA reference and `for` value resolves to an id inside the same element's output

#### Scenario: Group id with spaces

- **GIVEN** a comparison group with id `Core Features` rendered with prefix `pr-3`
- **WHEN** the group toggle renders
- **THEN** its `aria-controls` is `pr-3-group-Core_20_Features`, and an element with that id exists

#### Scenario: Space and hyphen in variable paths

- **GIVEN** `renderVariables` with `idPrefix: 'pr-7'` and the number controls `a b` and `a-b`
- **WHEN** the output renders
- **THEN** the control ids are `pr-7-variable-a_20_b` and `pr-7-variable-a_2d_b`
- **AND** no `id` value appears twice in the output

#### Scenario: Space and hyphen in group ids

- **GIVEN** `renderComparison` with `idPrefix: 'pr-3'`, comparison groups `a b` and `a-b`, both expanded
- **WHEN** the output renders
- **THEN** the group ids are `pr-3-group-a_20_b` and `pr-3-group-a_2d_b`
- **AND** each `aria-controls` value equals the `id` of an element in the output

#### Scenario: CJK variable paths

- **GIVEN** `renderVariables` with `idPrefix: 'pr-7'` and the number controls `座席` and `席位`
- **WHEN** the output renders
- **THEN** the control ids are `pr-7-variable-_5ea7__5e2d_` and `pr-7-variable-_5e2d__4f4d_`
- **AND** every id other than `pr-7-variables-title` matches `/^pr-7-variable-[\w-]+$/`

#### Scenario: Help suffix does not collide

- **GIVEN** `renderVariables` with `idPrefix: 'pr-7'`, the number control `x` with the description `Help for x`, and the number control `x-help`
- **WHEN** the output renders
- **THEN** the ids `pr-7-variable-x`, `pr-7-variable-x-help` and `pr-7-variable-x_2d_help` each appear once
- **AND** no `id` value appears twice in the output

#### Scenario: Punctuation in a variable path

- **GIVEN** `renderVariables` with `idPrefix: 'pr-7'` and the number control `priceByRegion.eu price[0]`
- **WHEN** the output renders
- **THEN** its control id is `pr-7-variable-priceByRegion_2e_eu_20_price_5b_0_5d_`

#### Scenario: Add-on id with a space

- **GIVEN** the acme pricing with the add-on id `extraStorage` replaced by `extra storage`, rendered by `renderAddOns` with `idPrefix: 'pr-9'`
- **WHEN** the output renders
- **THEN** the help id is `pr-9-addon-help-extra_20_storage`
- **AND** every ARIA reference in the output resolves to an id in the output

#### Scenario: Astral code point is one escape

- **GIVEN** `renderVariables` with `idPrefix: 'pr-7'` and the number control `seats😀` (U+1F600)
- **WHEN** the output renders
- **THEN** its control id is `pr-7-variable-seats_1f600_`

#### Scenario: Letters and digits keep the ids

- **GIVEN** the add-on grid render of `tests/unit/addon-grid.test.ts:405-407` with no prefix, and the acme add-on `extraStorage` rendered with prefix `pr-9`
- **WHEN** they render
- **THEN** the first output still has `aria-describedby="pr-addon-help-a02"`
- **AND** the second output has the id `pr-9-addon-help-extraStorage`
