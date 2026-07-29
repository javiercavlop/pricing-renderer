# Release and npm publication

This project publishes a public, unscoped npm package from a public GitHub
repository. Source availability is not permission to publish: each release must
pass the quality gates and the `0.1.0` candidate additionally requires explicit
approval of the interactive demo.

## Public locations

The canonical release locations are:

- npm: <https://www.npmjs.com/package/pricing-renderer>
- GitHub releases:
  <https://github.com/javiercavlop/pricing-renderer/releases>
- `0.1.0` source tag:
  `https://github.com/javiercavlop/pricing-renderer/releases/tag/v0.1.0`

The npm page and version-specific tag link may not exist before the first
release. Do not describe either as available until registry and GitHub
verification has succeeded.

## `0.1.0` release sequence

1. Obtain explicit maintainer acceptance of the Vanilla demo.
2. Confirm that the unscoped npm name `pricing-renderer` is still available.
   Stop instead of silently renaming the package if it is no longer available.
3. Change the README pre-release notice, pending npm badge, and installation
   section to published wording. Keep the versioned
   `npm install pricing-renderer@0.1.0` example and make the `v0.1.0` source tag
   a canonical link.
4. Add the final Changeset/changelog entry and run:

   ```bash
   pnpm format:check
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm package:check
   pnpm test:browser
   pnpm release:check -- v0.1.0
   ```

   The last command fails closed if the version and tag differ, pre-release
   wording remains, or canonical npm/release links are missing.

5. Merge or push the release documentation commit and wait for CI to pass.
6. Set the repository variable `NPM_PUBLICATION_APPROVED=true`. This variable is
   intentionally absent or false during demo review.
7. Create and push the exact SemVer tag `v0.1.0`. Do not reuse or move a
   published tag.
8. Let the release workflow publish with public access and npm provenance, then
   create the corresponding GitHub release.
9. Verify all public locations and confirm that npm reports version `0.1.0`,
   public access, the expected entry points, README, license, and provenance.
10. Test the registry artifact from an empty temporary project:

    ```bash
    npm install pricing-renderer@0.1.0
    ```

    Import at least `pricing-renderer`, `pricing-renderer/yaml`,
    `pricing-renderer/define`, `pricing-renderer/react`, and
    `pricing-renderer/styles.css`.

11. Confirm the README npm badge and links render correctly on both GitHub and
    npm. If publication failed, restore pending wording and investigate rather
    than claiming the release exists.

## Later releases

Use Changesets and SemVer. Installation documentation should normally use the
stable package name:

```bash
npm install pricing-renderer
```

Use an exact version in migration, reproduction, or audit instructions. Every
release must keep the npm package page, GitHub release, source tag, changelog,
and package metadata consistent.
