## ADDED Requirements

### Requirement: Dist-tag passed to npm publish only through env

`req~release-dist-tag-env~1`
The publish job of `.github/workflows/release.yml` SHALL pass the npm dist-tag to `npm publish` only through a step `env` variable mapped from `steps.release.outputs.dist_tag`, with no `${{ ... }}` expression in any `run` script of the job, and with a guard that fails the step before `npm publish` when the value is not exactly `latest` or `next`.

Needs: impl, utest

#### Scenario: Dist-tag mapped through the step env

- **GIVEN** `.github/workflows/release.yml` parsed as YAML
- **WHEN** the step of `jobs.publish.steps` whose `run` invokes `npm publish` is read
- **THEN** its `env` has an entry whose value is exactly `${{ steps.release.outputs.dist_tag }}`
- **AND** its `run` passes that variable, quoted, after `--tag` of `npm publish --access public --provenance`

#### Scenario: No expression in any run script of the publish job

- **GIVEN** `.github/workflows/release.yml` parsed as YAML
- **WHEN** the `run` value of every step of `jobs.publish.steps` is read
- **THEN** no `run` value contains the text `${{`
- **AND** the base text `--tag "${{ steps.release.outputs.dist_tag }}"` (`release.yml:131`) is not present

#### Scenario: Dist-tag latest or next proceeds to publish

- **GIVEN** the publish step with its dist-tag variable set to `latest`
- **WHEN** its `run` script executes
- **THEN** the guard passes and `npm publish` is invoked with `--tag latest`
- **WHEN** the variable is set to `next` instead
- **THEN** the guard passes and `npm publish` is invoked with `--tag next`

#### Scenario: Unexpected dist-tag fails before npm publish

- **GIVEN** the publish step with its dist-tag variable set to `beta`
- **WHEN** its `run` script executes
- **THEN** the step exits with a non-zero status
- **AND** `npm publish` is not invoked
- **WHEN** the variable is the empty string, `Latest` or `latest ` (with a trailing space) instead
- **THEN** the step exits with a non-zero status before `npm publish` in each case

#### Scenario: Guard placed before npm publish in the script text

- **GIVEN** the `run` value of the publish step
- **WHEN** its text is read from the start
- **THEN** a check of the dist-tag variable against `latest` and `next` that exits non-zero on any other value appears before the text `npm publish`

### Requirement: Unit tests run once per release

`req~release-single-unit-test-run~1`
The release path SHALL run the command `pnpm test` exactly once, in one step of the publish job of `.github/workflows/release.yml`, with `scripts.prepublishOnly` of `package.json` set to exactly `pnpm package:check`, so that `npm publish` does not run `pnpm test`; a step that runs `pnpm test:browser` does not count as running `pnpm test`.

Needs: impl, utest

#### Scenario: prepublishOnly checks the package without the unit tests

- **GIVEN** `package.json` read as JSON
- **WHEN** `scripts.prepublishOnly` is read
- **THEN** its value is exactly `pnpm package:check`
- **AND** it does not contain `pnpm test`

#### Scenario: Base prepublishOnly value is rejected

- **GIVEN** `scripts.prepublishOnly` with the base value `pnpm test && pnpm package:check` (`package.json:147`)
- **WHEN** the requirement is checked
- **THEN** the check fails, because `npm publish` would run `pnpm test` a second time

#### Scenario: Exactly one publish-job step runs pnpm test

- **GIVEN** `.github/workflows/release.yml` parsed as YAML
- **WHEN** the `run` value of every step of `jobs.publish.steps` is split into trimmed command lines
- **THEN** exactly one step has a command line equal to `pnpm test`

#### Scenario: Browser tests do not count as the unit test run

- **GIVEN** the publish job with one step running `pnpm test` and one step running `pnpm test:browser` (`release.yml:110,119`)
- **WHEN** the steps that run `pnpm test` are counted
- **THEN** the count is 1

### Requirement: Release readiness check kept satisfied

`req~release-check-substrings-kept~1`
The file `.github/workflows/release.yml` SHALL contain each substring that `scripts/check-release-ready.mjs` requires (`release:`, `workflow_call:`, `id-token: write`, `gh release view "$RELEASE_TAG"`, `npm publish --access public --provenance`) and no reference that it forbids (`secrets.`, the word `NPM_TOKEN`, the word `NODE_AUTH_TOKEN`).

Needs: impl, utest

#### Scenario: Required substrings present

- **GIVEN** the text of `.github/workflows/release.yml`
- **WHEN** it is searched for the substrings listed at `scripts/check-release-ready.mjs:51-57`
- **THEN** each of `release:`, `workflow_call:`, `id-token: write`, `gh release view "$RELEASE_TAG"` and `npm publish --access public --provenance` is found

#### Scenario: Forbidden references absent

- **GIVEN** the text of `.github/workflows/release.yml`
- **WHEN** it is matched against the patterns at `scripts/check-release-ready.mjs:65-69`
- **THEN** none of `\bNPM_TOKEN\b`, `\bNODE_AUTH_TOKEN\b` and `\bsecrets\.` matches

#### Scenario: Release readiness script passes

- **GIVEN** the repository at the change head, with `package.json` version `0.1.0` and the README release markers for `v0.1.0`
- **WHEN** `node scripts/check-release-ready.mjs v0.1.0` runs
- **THEN** it exits with status 0
- **AND** its output contains no failure that starts with `release workflow`
