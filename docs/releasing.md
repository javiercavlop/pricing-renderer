# Release and npm publication

Publishing a GitHub Release is the deployment authorization. The
`.github/workflows/release.yml` workflow checks out that immutable tag, runs all
release gates, and publishes the public, unscoped npm package. A tag push alone
does not publish anything.

## Public locations

The canonical release locations are:

- npm: <https://www.npmjs.com/package/pricing-renderer>
- GitHub releases:
  <https://github.com/javiercavlop/pricing-renderer/releases>
- `0.1.0` source tag:
  <https://github.com/javiercavlop/pricing-renderer/releases/tag/v0.1.0>

`pricing-renderer@0.1.0` is published under npm dist-tag `latest`. Do not
document a later version as available until registry and GitHub verification has
succeeded.

## CD behavior

The workflow listens to `release.published`, which includes stable releases and
prereleases, and also exposes a reusable `workflow_call` interface with one
required `release_tag` input. It:

1. Queries the GitHub API and refuses to continue unless `release_tag` identifies
   an existing, non-draft GitHub Release. The Release itself determines whether
   the npm dist-tag is `latest` or `next`.
2. Checks out the exact immutable release tag without persisting Git credentials.
3. Uses a GitHub-hosted runner, Node 24, npm 11.18.0, and pnpm 10.19.0 without a
   release dependency cache.
4. Verifies that the tag is exactly `v<package version>`, release documentation
   is final, and that the version is not already present on npm.
5. Runs formatting, lint, typechecking, unit tests, packed-artifact validation,
   Chromium/Firefox/WebKit tests, accessibility checks, and visual regression.
6. Publishes stable releases with npm dist-tag `latest` and GitHub prereleases
   with `next`.
7. Publishes public provenance from this public repository using short-lived
   GitHub OIDC credentials.

Any failed gate skips `npm publish`. Published npm versions and release tags are
immutable and must never be moved or reused.

## Tokenless npm authentication

The first `0.1.0` publication used a temporary, least-privilege repository
secret because npm Trusted Publishing can only be configured after a package
exists. That bootstrap is complete. The workflow does not read, accept, or
forward npm credentials.

The package Trusted Publisher uses these exact values:

- provider: GitHub Actions
- organization or user: `javiercavlop`
- repository: `pricing-renderer`
- workflow filename: `release.yml`
- environment: `npm`
- allowed action: `npm publish`

npm 11.15 or newer can configure the same relationship from an authenticated
maintainer session:

```bash
npm trust github pricing-renderer \
  --file release.yml \
  --repo javiercavlop/pricing-renderer \
  --env npm \
  --allow-publish
```

Keep npm publishing access configured to require 2FA and disallow tokens. Future
releases authenticate with short-lived GitHub OIDC credentials. Do not recreate
an npm publication secret.

## Reusing the release workflow

Automation in this repository can call the complete release pipeline without
copying its jobs:

```yaml
jobs:
  publish:
    permissions:
      contents: read
      id-token: write
    uses: ./.github/workflows/release.yml
    with:
      release_tag: v0.2.0
```

The caller cannot supply a dist-tag or npm credential. The referenced GitHub
Release must already be published. GitHub does not allow a called workflow to
elevate the caller's permissions, so the caller must explicitly grant
`contents: read` and `id-token: write`.

The workflow definition is reusable, while npm authorization remains
package-specific by design. A different package or repository must create its
own npm Trusted Publisher instead of sharing this package's trust relationship.

Authoritative references:

- [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/)
- [npm trust CLI](https://docs.npmjs.com/cli/v11/commands/npm-trust/)
- [GitHub reusable workflows and OIDC](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-with-reusable-workflows)

## Completed `0.1.0` bootstrap sequence

1. Obtain explicit maintainer acceptance of the Vanilla demo.
2. Confirm that the unscoped npm name `pricing-renderer` is still available.
   Stop instead of silently renaming the package if it is no longer available.
3. Add a temporary least-privilege npm publication token for the first
   publication only.
4. Change the README pre-release notice, pending npm badge, and installation
   section to published wording. Keep the versioned
   `npm install pricing-renderer@0.1.0` example and the canonical `v0.1.0` link.
5. Add the final Changeset/changelog entry and run:

   ```bash
   pnpm format:check
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm package:check
   pnpm test:browser
   pnpm release:check -- v0.1.0
   pnpm release:registry-check
   ```

   `release:check` fails closed if the version and tag differ, pre-release
   wording remains, or canonical npm/release links are missing.

6. Merge or push the release commit and wait for CI to pass.
7. Create the immutable SemVer tag from that exact commit and push it:

   ```bash
   git tag -s v0.1.0
   git push origin v0.1.0
   ```

8. Create a draft GitHub Release for `v0.1.0`, review its notes and tag, and then
   publish it. Publishing—not creating the tag or draft—triggers npm CD.
9. Wait for the `Publish npm package` workflow to complete successfully.
10. Complete the Trusted Publishing migration, remove the temporary token, and
    remove all token references from the workflow.
11. Verify that npm reports version `0.1.0`, public access, the expected entry
    points, README, license, dist-tag, and provenance.
12. Test the registry artifact from an empty temporary project:

    ```bash
    npm install pricing-renderer@0.1.0
    ```

    Import at least `pricing-renderer`, `pricing-renderer/yaml`,
    `pricing-renderer/define`, `pricing-renderer/react`, and
    `pricing-renderer/styles.css`.

13. Confirm the README npm/CD badges and links render correctly on GitHub and
    npm. If publication fails, do not claim that the package is available.

## Later releases

Use Changesets and SemVer. Prepare and merge the version/changelog commit, wait
for CI, tag that exact commit, and publish its GitHub Release. The release event
will publish npm automatically through OIDC.

Installation documentation should normally use the stable package name:

```bash
npm install pricing-renderer
```

Use an exact version in migration, reproduction, or audit instructions. Every
release must keep the npm package page, GitHub release, source tag, changelog,
dist-tag, and package metadata consistent.
