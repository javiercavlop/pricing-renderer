## ADDED Requirements

### Requirement: Variable help and error linked to the control

`req~variable-field-describedby~1`
WHEN the renderer renders a variable field, the renderer SHALL set on every input of its control an `aria-describedby` listing the description id `<control id>-help` if the field has a description, then the error text id `<control id>-error` if the field is invalid, and no `aria-describedby` if neither applies.

Needs: impl, utest

#### Scenario: Described controls of every type

- **GIVEN** `renderVariables` with `idPrefix: 'pr-7'`, no diagnostics, and the controls `flag` (boolean), `region` (select with options `eu` and `us`), `seats` (slider, min 1, max 50), `users` (number) and `team` (text), each with the description `Help for <path>`
- **WHEN** the output renders
- **THEN** the input of `flag` has `aria-describedby` `pr-7-variable-flag-help`, the select of `region` has `pr-7-variable-region-help`, the input of `users` has `pr-7-variable-users-help` and the input of `team` has `pr-7-variable-team-help`
- **AND** for each path an element with id `pr-7-variable-<path>-help` exists and contains `Help for <path>`

#### Scenario: Both inputs of a slider

- **GIVEN** the output of the scenario "Described controls of every type"
- **WHEN** the slider `seats` is inspected
- **THEN** its range input (id `pr-7-variable-seats`) and its number input both have `aria-describedby` `pr-7-variable-seats-help`

#### Scenario: No description and valid

- **GIVEN** `renderVariables` with `idPrefix: 'pr-7'`, no diagnostics, and the number control `users` with no description
- **WHEN** the output renders
- **THEN** the input with id `pr-7-variable-users` has no `aria-describedby` attribute
- **AND** no element has the id `pr-7-variable-users-help` or `pr-7-variable-users-error`

#### Scenario: Invalid field with a description

- **GIVEN** `renderVariables` with `idPrefix: 'pr-7'`, a plan `pro` whose price is an expression that depends on `users`, a diagnostic with path `plans.pro.price`, and the number control `users` with the description `Help for users`
- **WHEN** the output renders
- **THEN** the error text element of the `users` field has the id `pr-7-variable-users-error`
- **AND** the input with id `pr-7-variable-users` has `aria-describedby` `pr-7-variable-users-help pr-7-variable-users-error`

#### Scenario: Invalid field without a description

- **GIVEN** the setup of "Invalid field with a description", except that `users` has no description
- **WHEN** the output renders
- **THEN** the input with id `pr-7-variable-users` has `aria-describedby` `pr-7-variable-users-error`

#### Scenario: Every reference resolves

- **GIVEN** the outputs of the scenarios above
- **WHEN** each `aria-describedby` value is split on whitespace
- **THEN** every token equals the `id` of an element in the same output

#### Scenario: No instance prefix

- **GIVEN** `renderVariables` with no `idPrefix` and the number control `users` with the description `Help for users`
- **WHEN** the output renders
- **THEN** the input with id `pr-variable-users` has `aria-describedby` `pr-variable-users-help`
