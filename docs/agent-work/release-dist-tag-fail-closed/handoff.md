## Handoff

### Goal

The `release` step of `.github/workflows/release.yml` writes `dist_tag=next` only for `isPrerelease` equal to `true` and `latest` only for `false`. For any other value it fails before `npm publish`. The static test enforces this and no longer accepts a commented-out `exit 1`. Proposal P-20261103-1, work item `own-304cf5b7c5bc42fbabbf205d15ef53ec`.

### State

- PR 87 into develop, branch `fix/release-dist-tag-fail-closed`.
- All slices and the round 1 fixes are integrated on `change/release-dist-tag-fail-closed`.
- The OpenSpec change `release-dist-tag-fail-closed` adds `req~release-dist-tag-prerelease-map~1` and validates with `--strict`.
- The test `tests/unit/release-workflow.test.ts` has 45 passing cases. The mapping case on the real workflow was red before the workflow change.
- The I1 checks passed: the release test, the full unit run and `node scripts/check-release-ready.mjs v0.1.0`.
- Round 1 panel: the security-auditor approved. The reviewer and the test-reviewer asked for changes. The fixes cover the `::error::` assertion, the read-time default (`//`, `||`, `:-`), `stripComments` and the exit detection, plus the docs wording.
- CI was red at the first head only because Prettier rejected the earlier handoff file. This handoff is written to be Prettier-clean.

### Decisions

- A new change, not an amendment of `harden-release-workflow` (coordinator answer Q1).
- Static tests (coordinator answer Q2, design D7).
- The raw value stays in the `::error::` echo: the field is a boolean from the Release API (security-auditor nit, not changed).

### Ruled out

- `jq -e` alone, which would still map `null` to `latest`.
- Relying on `bash -e` alone.
- Executing the script in tests with a stubbed `gh`: it would amend design D7.

### Risks

- The first real run of the changed step is the owner's next release. A mistake would stop it before publish, which is safe but a delay.
- Static shell matching is brittle. The limits are listed in the test.

### Next three steps

1. Push this head and read the CI result.
2. Run review round 2 on the new head: reviewer, test-reviewer and security-auditor.
3. Mark the PR ready, store the review package and call ready.
