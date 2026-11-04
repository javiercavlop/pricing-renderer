## Handoff

### Goal

The `release` step of `.github/workflows/release.yml` writes `dist_tag=next` only for `isPrerelease` equal to `true` and `latest` only for `false`. For any other value it fails before `npm publish`. The static test enforces this and no longer accepts a commented-out `exit 1`. Proposal P-20261103-1, work item `own-304cf5b7c5bc42fbabbf205d15ef53ec`.

### State

- PR 87 into develop, branch `fix/release-dist-tag-fail-closed`.
- The round 2 fix F3 (task `2e6b0c65e0ad4cd5`) is integrated at head `997b5d5`. It is not pushed yet.
- F3 adds killing fixtures for a missing `true` or `false` arm and for an arm that writes nothing. It requires the exact jq filter `.isPrerelease`, rejects a conditional or nested `exit 1`, and tightens `distTagGuard`. The release test has 68 cases and the real workflow is accepted.
- `release.yml` is unchanged since the round 2 panel. The security-auditor approved it at `38989e2`.
- CI at `38989e2`: quality, audit and changes passed. The browser jobs were still running without failure.

### Decisions

- A new change, not an amendment of `harden-release-workflow` (coordinator answer Q1).
- Static tests (coordinator answer Q2, design D7).
- The raw value stays in the `::error::` echo: the field is a boolean from the Release API.

### Ruled out

- `jq -e` alone, which would still map `null` to `latest`.
- Relying on `bash -e` alone.
- Executing the script in tests with a stubbed `gh`: it would amend design D7.

### Risks

- The first real run of the changed step is the owner's next release. A mistake would stop it before publish, which is safe but a delay.
- Static shell matching is brittle. The limits are listed in the test header.

### Next three steps

1. Push, read the CI result on the new head.
2. Run review round 3: a test-reviewer and a reviewer on the new head.
3. Store the review package and call ready.
