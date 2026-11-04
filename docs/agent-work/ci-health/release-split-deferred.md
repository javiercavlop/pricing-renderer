# Release workflow: job split deferred

This is a proposal for the owner. Nothing of it is implemented; `release.yml`
is unchanged by it (audit finding 2, accepted risk). The decision record is
[ADR 0002](../../adr/0002-release-trust-model-and-supply-chain-gates.md).

## What the split would be

- Job `verify`: `permissions: contents: read`, no `id-token`, no `npm`
  environment. It does install, `release:check`, registry check, format, lint,
  typecheck, test, `package:check`, browser engine install and browser tests,
  then `npm pack` and uploads the tarball as an artifact.
- Job `publish`: `needs: verify`, `id-token: write`, `environment: npm`. It keeps
  the step "Verify the published GitHub Release" and the dist-tag guard,
  downloads the tarball and runs
  `npm publish --access public --provenance --tag "$DIST_TAG" ./<tarball>`.
  It also keeps `actions/setup-node` with `registry-url` and the npm
  minimum-version gate, because the npm that publishes runs there.

Publishing a tarball skips the `prepack` and `prepublishOnly` lifecycle
scripts (per npm's publish code; not verified here), so no build code runs
beside the OIDC token, and the exact artifact that was tested is the one
published.

## Why deferred

- Not approved: the comment in `release.yml` says the split changes the release
  flow and has not been approved.
- The changed path would only be exercised by the owner's real release, which
  is on hold.
- It needs changes outside this change's scope:
  - `tests/unit/release-workflow.test.ts` reads only `jobs.publish.steps` and
    requires `pnpm test` exactly once and `pnpm test:browser` there (test
    "runs the unit tests once..."). Those steps would move to `verify`.
  - The openspec release-workflow requirements (for example
    `req~release-single-unit-test-run~1`) must stay satisfied.
  - `scripts/check-release-ready.mjs` `requiredWorkflowContent` must stay
    satisfied: `npm publish --access public --provenance` must remain a
    contiguous substring, so the tarball goes after the options.

## What to test first

1. Whether `npm publish <tarball> --provenance` works with OIDC trusted
   publishing (not verified). Ideally try it with a throwaway package or a
   prerelease on a non-production tag in a fork.
2. That artifact upload and download keep the tarball unchanged: compare the
   sha256 before and after.
3. That the provenance subject digest equals the tarball digest.
4. That the dist-tag guard still runs before the publish step.
5. Run `npm publish ./x.tgz --dry-run` on a throwaway package whose `prepack`
   and `prepublishOnly` scripts write a marker file, and check the marker is
   absent (the safety argument depends on a tarball publish skipping them).
6. That the `setup-node` `registry-url` and the npm gate run in the `publish`
   job.

## Residual risk

A compromised install or test in `verify` can still alter the tarball, and
`publish` then publishes and attests it. The split protects the OIDC token, not
the integrity of the artifact.
