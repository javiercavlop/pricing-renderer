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

The npm page and version-specific tag link may not exist before the first
release. Do not describe either as available until registry and GitHub
verification has succeeded.

## CD behavior

The workflow listens to `release.published`, which includes stable releases and
prereleases. It:

1. Checks out the exact `github.event.release.tag_name` without persisting Git
   credentials.
2. Uses a GitHub-hosted runner, Node 24, npm 11.18.0, and pnpm 10.19.0 without a
   release dependency cache.
3. Verifies that the tag is exactly `v<package version>`, release documentation
   is final, and that the version is not already present on npm.
4. Runs formatting, lint, typechecking, unit tests, packed-artifact validation,
   Chromium/Firefox/WebKit tests, accessibility checks, and visual regression.
5. Publishes stable releases with npm dist-tag `latest` and GitHub prereleases
   with `next`.
6. Publishes public provenance from this public repository.

Any failed gate skips `npm publish`. Published npm versions and release tags are
immutable and must never be moved or reused.

## One-time npm bootstrap

npm Trusted Publishing can only be configured after the package already exists.
For `0.1.0` only:

1. Enable account-level 2FA on npm.
2. Create a least-privilege granular npm token that can publish the new public
   package, with the shortest practical expiry.
3. Add it as the `NPM_TOKEN` secret on the GitHub `npm` environment. Do not add
   it as a repository variable or commit it to any file.
4. Publish the first GitHub Release using the sequence below.
5. After `pricing-renderer@0.1.0` exists, configure its npm Trusted Publisher
   with these exact values:

   - provider: GitHub Actions
   - organization or user: `javiercavlop`
   - repository: `pricing-renderer`
   - workflow filename: `release.yml`
   - environment: `npm`
   - allowed action: `npm publish`

   npm 11.15 or newer can configure the same relationship interactively:

   ```bash
   npm trust github pricing-renderer \
     --file release.yml \
     --repo javiercavlop/pricing-renderer \
     --env npm \
     --allow-publish
   ```

6. Remove the `NPM_TOKEN` GitHub environment secret.
7. Set npm publishing access to require 2FA and disallow tokens. Future releases
   authenticate with short-lived GitHub OIDC credentials.

The workflow deliberately contains no permanent npm credential. The
`NODE_AUTH_TOKEN` environment value is empty once the one-time secret is
removed, allowing npm Trusted Publishing to handle `npm publish`.

## `0.1.0` release sequence

1. Obtain explicit maintainer acceptance of the Vanilla demo.
2. Confirm that the unscoped npm name `pricing-renderer` is still available.
   Stop instead of silently renaming the package if it is no longer available.
3. Complete the one-time npm bootstrap configuration above, up to adding the
   temporary environment secret.
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
10. Complete the Trusted Publishing migration and remove the temporary token as
    described above.
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
