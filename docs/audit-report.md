# Audit report

Summary of audit findings, each checked against the repository files. Anything
that could not be checked from the repository is marked **not verified**.

## Scope

The dependency and release-workflow findings below were checked against the
repository files (`package.json` files, `pnpm-lock.yaml`,
`.github/workflows/release.yml`). The commands run for this revision, and
their results, are listed under "Commands run for this revision". Anything
not listed there, in particular `pnpm audit`, was not run and is
**not verified**.

Workflow and configuration changes landed after the first version of this
audit and are described in "CI and Dependabot configuration": the `audit` job
in `ci.yml`, the grouped Dependabot configuration, SHA pinning of actions and
the narrowed CI triggers. The `audit` job is now blocking. Against the
current `release.yml`, release workflow findings 1, 3 and 4 are resolved and
finding 2 is an accepted, documented risk.

## Dependencies

- **`next`, `vite`, `vitest`, `@vitejs/plugin-react`: resolved by the
  dependency update.** Verified in the current tree: `next` is pinned to
  16.4.3 (`examples/next/package.json`); `vite` is `^7.3.7` and `vitest`
  `^5.0.5` (root `package.json`), resolved in `pnpm-lock.yaml` to 7.3.7 and
  5.0.5; `@vitejs/plugin-react` is `^5.2.0` (`examples/react/package.json`),
  resolved to 5.2.0. The root `package.json` also carries `pnpm.overrides`
  for `brace-expansion@1` and `@5`, `js-yaml@3` and `@4`, `nanoid@3` and
  `source-map-js`, mirrored in the lockfile. Whether newer releases exist is
  **not verified**.
- **`yaml` 2.9.0 vs 2.9.1.** 2.9.0 is verified (lockfile). The existence of 2.9.1 was confirmed only by an external
  query and is **not verified** from the repository.
- **React versions differ.** Verified: `examples/next/package.json` pins
  `react` and `react-dom` to exactly 19.2.0. The lockfile resolves 19.2.8,
  and `examples/react` declares `^19.1.1`.
- **`playwright` and `@playwright/test` both declared.** Verified: both are
  `^1.55.0` in the root `package.json` and the lockfile resolves both to
  1.62.0. The duplicate declaration is redundant but harmless.
- **`typescript` 5.6.1-rc, transitive: resolved by an override.** The root
  `package.json` `pnpm.overrides` has `@arethetypeswrong/core@0.18.5>typescript`:
  `5.6.3` (scoped to the parent version, so an attw upgrade turns it off by
  itself; remove it when attw ships a stable `typescript` pin), and the lockfile `overrides` section mirrors it. The lockfile
  resolves `typescript@5.6.3` for `@arethetypeswrong/core@0.18.5`; the
  project's own `typescript` stays 5.9.3. That attw version pins the exact
  version `5.6.1-rc`, and still does in its latest release, according to
  `docs/agent-work/ci-health/typescript-override.md`; this registry fact is
  **not verified** from the repository files. The lockfile entry was edited by
  hand. `pnpm install --frozen-lockfile` accepts it locally (see "Commands
  run for this revision"); confirmation under pnpm 10.19.0 is the pull
  request's CI (**not verified** here).
- **Local pnpm differs from the declared one.** Verified: `packageManager` is
  `pnpm@10.19.0`, and `release.yml` and `ci.yml` use 10.19.0. An earlier
  local `pnpm install --frozen-lockfile` run reportedly showed pnpm v9.15.9;
  the lab run of this revision also reported v9.15.9 (see "Commands run for
  this revision"), so local results may differ from CI, which pins 10.19.0.

### What the dependency update changed

Only the current state is verifiable from the repository; the versions before
the update are not recorded in this document and are **not verified** here.
The current state is:

- `next` is pinned to `16.4.3` in `examples/next/package.json` (lockfile:
  `next@16.4.3`).
- `vite` is `^7.3.7` in the root `package.json`, `examples/react` and
  `examples/vanilla` (lockfile: `vite@7.3.7`); `vitest` is `^5.0.5` (lockfile:
  `vitest@5.0.5`).
- `@vitejs/plugin-react` is `^5.2.0` in `examples/react/package.json`
  (lockfile: `5.2.0`).
- `pnpm.overrides` in the root `package.json` constrain `brace-expansion@1`
  (`>=1.1.19 <2`, locked 1.1.21), `brace-expansion@5` (`>=5.0.10 <6`, locked
  5.0.12), `js-yaml@3` (`>=3.15.1 <4`, locked 3.15.2), `js-yaml@4`
  (`>=4.3.2 <5`, locked 4.3.2), `nanoid@3` (`>=3.3.18 <4`, locked 3.3.20) and
  `source-map-js` (`>=1.2.2 <2`, locked 1.2.2), and
  `@arethetypeswrong/core@0.18.5>typescript` (`5.6.3`, locked 5.6.3). The lockfile
  `overrides` section mirrors them.
- Why each override was added (for example, which advisory) is **not
  verified** from the repository.

## CI and Dependabot configuration

- **`audit` job** (`.github/workflows/ci.yml`): installs with
  `pnpm install --frozen-lockfile` on Node 22 and runs
  `pnpm audit --audit-level high`. It is blocking: the job has no
  `continue-on-error`, and a comment in the job says a failure is fixed with a
  dependency update or a documented override. Waiver path: when a high
  advisory has no fixed release and neither can fix it, one GHSA may be waived
  with `pnpm.auditConfig.ignoreGhsas` (pnpm 10 setting) in `package.json`, only
  with the owner's approval, with a follow-up id and review date recorded here.
  The `merge-report` job keeps
  `continue-on-error: true` on purpose, because it only builds a report.
- **Triggers and permissions:** `ci.yml` runs on `push` and `pull_request` for
  `main` and `develop`, with top-level `permissions: contents: read`. Actions
  in `ci.yml` and `release.yml` are pinned to commit SHAs.
- **Dependabot** (`.github/dependabot.yml`): weekly updates, limit 5, for npm
  (`/` and `/examples/*`) and for `github-actions` (`/`). npm groups:
  `security` (security updates, all packages), `framework-tooling` (version
  updates for `next`, `vite`, `vite-*`, `@vitejs/*`, `vitest`, `@vitest/*`) and
  `development` (version updates of development dependencies). The
  `github-actions` ecosystem has the groups `actions-security` and `actions`.
- **Audit result:** a lab run of `pnpm audit --audit-level high` exited 0 with
  2 moderate advisories and no high or critical ones
  (`docs/agent-work/ci-health/audit-job.md`). This is a point-in-time lab
  result under pnpm 9.15.9, not a CI run, and it is **not verified** for this
  document; no audit was run here.

## Release workflow (`.github/workflows/release.yml`)

1. **Global npm without integrity verification. Resolved.** The step
   `npm install --global npm@11.18.0` is gone, so no registry code is
   installed in the job that has `id-token: write`. The step "Require an
   OIDC-capable npm CLI" fails the job when the npm bundled with setup-node's
   Node 24 is older than 11.5.1 (`NPM_MIN_VERSION`). Residual risk: the bundled
   npm comes from the Node distribution fetched by setup-node and is not
   pinned (details: `docs/agent-work/ci-health/release-npm.md`).
2. **Whole pipeline in the publishing job. Accepted risk.** Install, lint, tests, package
   checks, browser engine install and browser tests all run in the same job
   that holds `id-token: write` and the `npm` environment. Third-party code
   (dev dependencies, install scripts, browser tooling) runs next to the
   publish credentials. Splitting build/test from publish would reduce the
   exposure.
3. **`prepublishOnly` ran the unit tests a second time. Resolved.**
   `package.json` defined `prepublishOnly` as `pnpm test && pnpm package:check`,
   so the unit tests ran twice. It is now `pnpm package:check`, and the
   workflow runs `pnpm test` once. `package:check` (build, publint, attw) still
   runs in the workflow and again through `prepublishOnly` during publish, and
   the build also runs in `prepack`.
4. **`dist_tag` interpolated into `run`. Resolved.** The last step used
   `--tag "${{ steps.release.outputs.dist_tag }}"` directly in the script. The
   value now reaches the step through `env` (`DIST_TAG`), a guard rejects
   anything other than `latest` or `next` before `npm publish`, and no `run`
   script of the publish job contains a template expression.

The changed workflow is not exercised until the owner's next release. The
static test `tests/unit/release-workflow.test.ts` checks both fixes (items 3
and 4); it checks that the guard text is present and anchored on `DIST_TAG`.
The static test also checks that the dist-tag mapping writes `next` only for
`true` and `latest` only for `false` and fails on any other value, and that a
commented-out `exit 1` does not count as a guard.

## Open items

- **Harden `.npmrc`: pending, not applied.** The edit was refused in this
  revision because `.npmrc` is a protected sensitive file, so
  `engine-strict=true` was neither applied nor validated. Current content:
  `engine-strict=false`, `prefer-frozen-lockfile=true`,
  `strict-peer-dependencies=false`, `cache=.npm-cache`. To apply by hand:
  set `engine-strict=true`, and put a `#` comment saying that the React peer
  dependencies are optional above `strict-peer-dependencies=false`, then run
  `pnpm install --frozen-lockfile`. Compatibility check done: the root
  `package.json` `engines` is `"node": ">=22"` and no other `package.json`
  in the repository declares `engines` (searched the root and
  `examples/*/package.json`), so the setting has nothing stricter to trip on.
  CI uses Node 22 (`ci.yml`) and Node 24 (`release.yml`), both within
  `>=22`; that the install passes with the setting on is **not verified**.
- **Release workflow finding 2 (whole pipeline in the publishing job): accepted
  risk, split not approved.** A comment in `release.yml` records that it is
  accepted deliberately, gated by the protected `npm` environment and the
  immutable release tag. The proposed split is under "For the owner: proposed
  release.yml change (not applied)"; background in
  `docs/agent-work/ci-health/release-split-deferred.md`. The release workflow
  is not exercised until the owner's next release.
- **Audit not run.** `pnpm audit --audit-level high` could not be run in this
  revision (no command-line access, only the registered checks), so no audit
  result is claimed. The blocking `audit` job in CI is the check.
- Not verified: latest upstream versions of `next`, `vite`, `vitest` and
  `yaml`.

Resolved (details in the sections above): the `next`, `vite`, `vitest` and
`@vitejs/plugin-react` update, the `typescript` 5.6.1-rc override, the blocking
`audit` job, release workflow findings 1, 3 and 4 and the dist-tag mapping, and
the copyright lines for Sphere and Pricing4TS in `THIRD_PARTY_NOTICES.md`
(checked against both upstream `LICENSE` files).

## Commands run for this revision

All run through the registered checks, in the lab with pnpm v9.15.9 (not the
declared 10.19.0):

- `pnpm install --frozen-lockfile`: exit 0 ("Lockfile is up to date"; 382
  packages added; root `typescript` 5.9.3).
- Search for `5.6.1-rc` in `pnpm-lock.yaml`: no match.
- `pnpm typecheck`: exit 0.
- `pnpm lint`: exit 0 (one warning, `no-console` in
  `docs/agent-work/prop-20261028-3/review/demo.mjs`, not part of this change).
- `pnpm test`: exit 0 (94 files, 2011 tests passed).
- `pnpm package:check`: exit 0 (build, publint and attw passed).
- `pnpm build`: exit 0.
- `pnpm format:check`: exit 0, with the diff fence in the owner section
  wrapped in prettier-ignore comments (it failed without them).

Not run, **not verified**: `pnpm audit --audit-level high`, the release
workflow, the `.npmrc` change (needs the owner, see "Open items"), and CI under
pnpm 10.19.0.

## For the owner: proposed release.yml change (not applied)

This splits the `publish` job into an unprivileged `verify` job and a minimal
`publish` job. It is a proposal only: `.github/workflows/release.yml` is
unchanged. Applying it needs the owner's approval and a token with
Workflows: write. The diff is against the current `release.yml` (164 lines).
`actions/download-artifact` is pinned to the SHA of its `v6` tag
(`018cc2cf5baa6db3ef3c5f8a56943fffe632ef53`, v6.0.0). The SHA was confirmed
through the GitHub API tags by an external lookup, not from the repository.
No documented incompatibility between `upload-artifact` v6 and
`download-artifact` v6 was found (no compatibility matrix exists).

<!-- prettier-ignore-start -->
```diff
--- a/.github/workflows/release.yml
+++ b/.github/workflows/release.yml
@@ -18,23 +18,19 @@
   cancel-in-progress: false
 
 jobs:
-  publish:
+  verify:
     runs-on: ubuntu-latest
-    environment: npm
-    # NOTE: this single job holds id-token: write (needed for npm provenance
-    # and OIDC publishing) and also installs dependencies and runs the full
-    # test suite from the release tag. Third-party install scripts and test
-    # code therefore execute in a job that can mint an OIDC token. This is
-    # accepted deliberately so that the exact commit that is tested is the
-    # one that is published, and the job is gated by the protected "npm"
-    # environment and the immutable release tag. Splitting it into an
-    # unprivileged verify job and a minimal publish job would reduce the
-    # exposure but changes the release flow and has not been approved.
-    # The npm CLI is the one bundled with the Node that setup-node installs,
-    # checked against a minimum version below; no npm is installed globally.
+    # NOTE: this job runs everything that executes third-party code (install
+    # scripts, lint, tests, browser tooling) with read-only permissions: no
+    # id-token and no "npm" environment. Only the packed tarball, its sha256
+    # and the dist-tag leave it; the publish job does not check out or install
+    # anything from the repository.
     permissions:
       contents: read
-      id-token: write
+    outputs:
+      dist_tag: ${{ steps.release.outputs.dist_tag }}
+      tarball: ${{ steps.pack.outputs.tarball }}
+      sha256: ${{ steps.pack.outputs.sha256 }}
     env:
       RELEASE_TAG: ${{ inputs.release_tag || github.event.release.tag_name }}
     steps:
@@ -82,32 +78,8 @@
       - uses: actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38 # v6
         with:
           node-version: 24
-          registry-url: https://registry.npmjs.org
           package-manager-cache: false
 
-      # npm trusted publishing (OIDC) needs npm >= 11.5.1. The npm CLI comes
-      # bundled with the Node distribution that setup-node installs; nothing
-      # else is downloaded here. Fail closed if the bundled npm is too old.
-      - name: Require an OIDC-capable npm CLI
-        env:
-          NPM_MIN_VERSION: 11.5.1
-        run: |
-          npm_version="$(npm --version)"
-          if ! NPM_VERSION="$npm_version" node -e '
-            const parse = (v) => v.split("-")[0].split(".").map(Number);
-            const have = parse(process.env.NPM_VERSION);
-            const need = parse(process.env.NPM_MIN_VERSION);
-            for (let i = 0; i < 3; i++) {
-              if ((have[i] || 0) !== (need[i] || 0)) {
-                process.exit((have[i] || 0) > (need[i] || 0) ? 0 : 1);
-              }
-            }
-          '; then
-            echo "::error::npm $npm_version is older than $NPM_MIN_VERSION, which npm trusted publishing requires."
-            exit 1
-          fi
-          echo "npm $npm_version satisfies >= $NPM_MIN_VERSION"
-
       - name: Install exact dependencies
         run: pnpm install --frozen-lockfile
 
@@ -148,17 +120,109 @@
           retention-days: 14
           if-no-files-found: ignore
 
-      # [impl->req~release-dist-tag-env~1]
-      # [impl->req~release-check-substrings-kept~1]
-      - name: Publish stable releases to latest and prereleases to next
-        env:
-          DIST_TAG: ${{ steps.release.outputs.dist_tag }}
-        run: |
-          case "$DIST_TAG" in
-            latest|next) ;;
-            *)
-              echo "::error::Unexpected npm dist-tag: $DIST_TAG"
-              exit 1
-              ;;
-          esac
-          npm publish --access public --provenance --tag "$DIST_TAG"
+      - name: Pack the release tarball
+        id: pack
+        env:
+          PACK_DIR: ${{ runner.temp }}/release-pack
+        run: |
+          mkdir -p "$PACK_DIR"
+          npm pack --pack-destination "$PACK_DIR"
+          set -- "$PACK_DIR"/*.tgz
+          if [ "$#" -ne 1 ] || [ ! -f "$1" ]; then
+            echo "::error::Expected exactly one packed tarball in $PACK_DIR."
+            exit 1
+          fi
+          {
+            echo "tarball=$(basename "$1")"
+            echo "sha256=$(sha256sum "$1" | cut -d' ' -f1)"
+          } >>"$GITHUB_OUTPUT"
+
+      - name: Upload the release tarball
+        uses: actions/upload-artifact@b7c566a772e6b6bfb58ed0dc250532a479d7789f # v6
+        with:
+          name: release-tarball-${{ github.run_id }}-${{ github.run_attempt }}
+          path: ${{ runner.temp }}/release-pack/${{ steps.pack.outputs.tarball }}
+          retention-days: 7
+          if-no-files-found: error
+
+  publish:
+    needs: verify
+    runs-on: ubuntu-latest
+    environment: npm
+    # NOTE: this job holds id-token: write and runs no repository code. It
+    # does not check out the repository and does not install dependencies; it
+    # publishes the tarball that the verify job packed, after checking its
+    # sha256 against the value that job reported. The npm CLI is the one
+    # bundled with the Node that setup-node installs, checked against a
+    # minimum version below; no npm is installed globally.
+    permissions:
+      contents: read
+      id-token: write
+    steps:
+      - name: Download the release tarball
+        uses: actions/download-artifact@018cc2cf5baa6db3ef3c5f8a56943fffe632ef53 # v6
+        with:
+          name: release-tarball-${{ github.run_id }}-${{ github.run_attempt }}
+          path: ${{ runner.temp }}/release-tarball
+
+      - name: Verify the tarball checksum
+        env:
+          TARBALL: ${{ needs.verify.outputs.tarball }}
+          EXPECTED_SHA256: ${{ needs.verify.outputs.sha256 }}
+        run: |
+          case "$TARBALL" in
+            ""|*/*)
+              echo "::error::Unexpected tarball name: $TARBALL"
+              exit 1
+              ;;
+          esac
+          actual="$(sha256sum "$RUNNER_TEMP/release-tarball/$TARBALL" | cut -d' ' -f1)"
+          if [ "$actual" != "$EXPECTED_SHA256" ]; then
+            echo "::error::The downloaded tarball does not match the sha256 reported by the verify job."
+            exit 1
+          fi
+
+      - uses: actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38 # v6
+        with:
+          node-version: 24
+          registry-url: https://registry.npmjs.org
+          package-manager-cache: false
+
+      # npm trusted publishing (OIDC) needs npm >= 11.5.1. The npm CLI comes
+      # bundled with the Node distribution that setup-node installs; nothing
+      # else is downloaded here. Fail closed if the bundled npm is too old.
+      - name: Require an OIDC-capable npm CLI
+        env:
+          NPM_MIN_VERSION: 11.5.1
+        run: |
+          npm_version="$(npm --version)"
+          if ! NPM_VERSION="$npm_version" node -e '
+            const parse = (v) => v.split("-")[0].split(".").map(Number);
+            const have = parse(process.env.NPM_VERSION);
+            const need = parse(process.env.NPM_MIN_VERSION);
+            for (let i = 0; i < 3; i++) {
+              if ((have[i] || 0) !== (need[i] || 0)) {
+                process.exit((have[i] || 0) > (need[i] || 0) ? 0 : 1);
+              }
+            }
+          '; then
+            echo "::error::npm $npm_version is older than $NPM_MIN_VERSION, which npm trusted publishing requires."
+            exit 1
+          fi
+          echo "npm $npm_version satisfies >= $NPM_MIN_VERSION"
+
+      # [impl->req~release-dist-tag-env~1]
+      # [impl->req~release-check-substrings-kept~1]
+      - name: Publish stable releases to latest and prereleases to next
+        env:
+          DIST_TAG: ${{ needs.verify.outputs.dist_tag }}
+          TARBALL: ${{ needs.verify.outputs.tarball }}
+        run: |
+          case "$DIST_TAG" in
+            latest|next) ;;
+            *)
+              echo "::error::Unexpected npm dist-tag: $DIST_TAG"
+              exit 1
+              ;;
+          esac
+          npm publish --access public --provenance --tag "$DIST_TAG" "$RUNNER_TEMP/release-tarball/$TARBALL"
```
<!-- prettier-ignore-end -->

The diff was written by hand. A scripted check applied it with
`git apply --recount` to a temporary copy of `release.yml` at this head: it
applied cleanly, the result parses as YAML with the jobs `verify` and
`publish`, `publish` needs `verify`, `verify` has no `id-token` permission and
no environment, `publish` has `id-token: write` and no checkout or install
step. The behaviour of the workflow was **not exercised** (no run of the
release workflow).

Deviation from the brief: the tarball is passed after the flags
(`npm publish --access public --provenance --tag "$DIST_TAG" <path>`), not as
`npm publish ./<tarball> ...`, so that the required substring
`npm publish --access public --provenance` stays in the file
(`requiredWorkflowContent` in `scripts/check-release-ready.mjs`). npm accepts
the package spec at any position; this is not verified by a run.

### Trade-offs

- The tarball is built in the unprivileged job and trusted by the publish job.
  Anything that can alter the tarball inside `verify` (a compromised
  dependency or test code) now decides what is published. The sha256 passed
  as a job output only protects the artifact in transit and at rest between
  the two jobs, not against a malicious `verify` job. This reduces what runs
  next to the OIDC token but does not remove trust in the build.
- `prepublishOnly` (`pnpm package:check`) does not run when a tarball is
  published, so `package:check` must keep running in `verify`; the proposed
  file keeps it. `npm pack` runs `prepack` (the build) in `verify`.
- Provenance is attached when publishing the tarball from a job that has no
  checkout; whether `--provenance` accepts this without repository metadata
  beyond `package.json` is **not verified** until a real release.
- `actions/download-artifact` at the `v6` SHA is a new pin, and its
  compatibility with `upload-artifact` v6 is inferred, not documented.
- `tests/unit/release-workflow.test.ts` asserts on `release.yml` and must be
  updated in the same change:
  - the read of `jobs.publish.steps` (line 269) must read `verify` steps for
    the release lookup and unit-test assertions and `publish` steps for the
    publish assertions;
  - `distTagValue` (line 278) must become
    the expression on `needs.verify.outputs.dist_tag`; the publish step keeps
    `DIST_TAG` in its own `env`, so the `distTagName` lookup still works;
  - "has no expression interpolated into a run script" (line 285) must cover
    the steps of both jobs;
  - "runs the unit tests once" (line 739) must count `pnpm test` over both
    jobs (still once, in `verify`) and `pnpm test:browser`;
  - the "maps isPrerelease" test (line 401) uses `releaseSteps`, which now come
    from `verify`;
  - the test that keeps what `scripts/check-release-ready.mjs` requires and
    forbids (line 749) still holds with the file as proposed: `release:`, `workflow_call:`,
    `id-token: write`, the `gh release view` call and
    `npm publish --access public --provenance` are all present, and none of
    the forbidden patterns appears.
- New assertions worth adding to that test: `verify` has no `id-token` and no
  `environment`; `publish` has no checkout or `pnpm install` step.
- This changes the release flow, so it needs the owner's approval, and the
  edit needs a token with Workflows: write. It is not exercised until a real
  release.
