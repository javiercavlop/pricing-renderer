## ADDED Requirements

### Requirement: Dist-tag chosen from the prerelease flag, fail-closed

`req~release-dist-tag-prerelease-map~1`
WHEN the `release` step of the publish job has read `isPrerelease` from the GitHub Release, the step SHALL write `dist_tag=next` only for the exact value `true` and `dist_tag=latest` only for the exact value `false`; IF the value is anything else (empty, `null`, `True` or other text), THEN the step SHALL write an `::error::` annotation, write no `dist_tag` output and exit non-zero by a command outside any comment, before `npm publish`.

Needs: impl, utest

#### Scenario: Prerelease maps to next

- **GIVEN** the `release` step with the `isPrerelease` value read as `true`
- **WHEN** its `run` script executes
- **THEN** it appends `dist_tag=next` to `$GITHUB_OUTPUT`
- **AND** the step exits with status 0

#### Scenario: Stable release maps to latest

- **GIVEN** the `release` step with the `isPrerelease` value read as `false`
- **WHEN** its `run` script executes
- **THEN** it appends `dist_tag=latest` to `$GITHUB_OUTPUT`
- **AND** the step exits with status 0

#### Scenario: Empty value after a failed read fails the step

- **GIVEN** the `release` step with the `isPrerelease` value read as the empty string
- **WHEN** its `run` script executes
- **THEN** it writes an annotation that starts with `::error::`
- **AND** no line starting with `dist_tag=` is appended to `$GITHUB_OUTPUT`
- **AND** the step exits with a non-zero status, so `npm publish` is not invoked

#### Scenario: Null value fails the step

- **GIVEN** the `release` step with the `isPrerelease` value read as `null`
- **WHEN** its `run` script executes
- **THEN** it writes an annotation that starts with `::error::`
- **AND** no line starting with `dist_tag=` is appended to `$GITHUB_OUTPUT`
- **AND** the step exits with a non-zero status, so `npm publish` is not invoked

#### Scenario: Wrong-case value fails the step

- **GIVEN** the `release` step with the `isPrerelease` value read as `True`
- **WHEN** its `run` script executes
- **THEN** it writes an annotation that starts with `::error::`
- **AND** no line starting with `dist_tag=` is appended to `$GITHUB_OUTPUT`
- **AND** the step exits with a non-zero status, so `npm publish` is not invoked

#### Scenario: Static, only the literal false selects latest

- **GIVEN** the `run` value of the step of `jobs.publish.steps` with `id: release`, with full-line `#` comments removed
- **WHEN** the branches that write `dist_tag=` are read
- **THEN** `dist_tag=next` is written only in a branch selected by the literal `true`
- **AND** `dist_tag=latest` is written only in a branch selected by the literal `false`
- **AND** no default branch (`*)` arm or final `else`) writes `dist_tag=latest` or any other `dist_tag=` value

#### Scenario: Static, the failing default branch exits by a command

- **GIVEN** the `run` value of the `release` step, with full-line `#` comments removed
- **WHEN** the default branch (`*)` arm or final `else`) of the `isPrerelease` mapping is read
- **THEN** it contains an `echo` of a text starting with `::error::` and an `exit 1` command
- **WHEN** the only `exit 1` of that branch is inside a comment (`# exit 1`) instead
- **THEN** the branch does not count as a failing guard and the check fails

#### Scenario: Base text is rejected

- **GIVEN** the base text of the `release` step (`release.yml:58-62`), where `if [ "$(jq -r '.isPrerelease' <<<"$release_json")" = "true" ]` writes `dist_tag=next` and the `else` branch writes `dist_tag=latest`
- **WHEN** the requirement is checked
- **THEN** the check fails, because a branch not selected by the literal `false` writes `latest`
