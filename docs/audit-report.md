# Audit report

Summary of audit findings, each checked against the repository files. Anything
that could not be checked from the repository is marked **not verified**.

## Scope

The dependency and release-workflow findings below were checked against the
repository files (`package.json` files, `pnpm-lock.yaml`,
`.github/workflows/release.yml`). No command was run for this document, so
no `pnpm audit` or install result is claimed here.

Workflow and configuration changes landed after the first version of this
audit and are described in "CI and Dependabot configuration": the `audit` job
in `ci.yml`, the grouped Dependabot configuration, SHA pinning of actions and
the narrowed CI triggers. The release workflow findings were re-checked
against the current `release.yml` and still hold.

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
- **`yaml` 2.9.0 vs 2.9.1.** 2.9.0 is verified (lockfile and installed
  `package.json`). The existence of 2.9.1 was confirmed only by an external
  query and is **not verified** from the repository.
- **React versions differ.** Verified: `examples/next/package.json` pins
  `react` and `react-dom` to exactly 19.2.0. The root install resolves 19.2.8,
  and `examples/react` declares `^19.1.1`.
- **`playwright` and `@playwright/test` both declared.** Verified: both are
  `^1.55.0` in the root `package.json` and the lockfile resolves both to
  1.62.0. The duplicate declaration is redundant but harmless.
- **`typescript` 5.6.1-rc, transitive.** Verified in `pnpm-lock.yaml`:
  `@arethetypeswrong/core@0.18.5` depends on `typescript: 5.6.1-rc`. The
  project's own `typescript` is 5.9.3. It is a pre-release compiler used only
  by a dev tool.
- **Local pnpm differs from the declared one.** Verified: `packageManager` is
  `pnpm@10.19.0` (and `release.yml` uses 10.19.0), while the local
  `pnpm install --frozen-lockfile` run on the current tree reported pnpm
  v9.15.9. Local results may differ from CI.

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
  `source-map-js` (`>=1.2.2 <2`, locked 1.2.2). The lockfile `overrides`
  section mirrors them.
- Why each override was added (for example, which advisory) is **not
  verified** from the repository.

## CI and Dependabot configuration

- **`audit` job** (`.github/workflows/ci.yml`): installs with
  `pnpm install --frozen-lockfile` on Node 22 and runs
  `pnpm audit --audit-level high`. It is advisory only
  (`continue-on-error: true`), so a finding does not fail the workflow.
- **Triggers and permissions:** `ci.yml` runs on `push` and `pull_request` for
  `main` and `develop`, with top-level `permissions: contents: read`. Actions
  in `ci.yml` and `release.yml` are pinned to commit SHAs.
- **Dependabot** (`.github/dependabot.yml`): weekly updates, limit 5, for npm
  (`/` and `/examples/*`) and for `github-actions` (`/`). npm groups:
  `security` (security updates, all packages), `framework-tooling` (version
  updates for `next`, `vite`, `vite-*`, `@vitejs/*`, `vitest`, `@vitest/*`) and
  `development` (version updates of development dependencies). The
  `github-actions` ecosystem has the groups `actions-security` and `actions`.
- **Audit result:** a clean `pnpm audit` was reported, but it is **not
  verified** for this document; no audit was run here.

## Release workflow (`.github/workflows/release.yml`)

1. **Global npm without integrity verification.** `npm install --global
npm@11.18.0` (line 89) installs a version-pinned CLI with no checksum or
   signature check, in a job that has `id-token: write`. A compromised package
   would run in a job that can mint the OIDC token.
2. **Whole pipeline in the publishing job.** Install, lint, tests, package
   checks, browser engine install and browser tests all run in the same job
   that holds `id-token: write` and the `npm` environment. Third-party code
   (dev dependencies, install scripts, browser tooling) runs next to the
   publish credentials. Splitting build/test from publish would reduce the
   exposure.
3. **`prepublishOnly` repeats work.** `package.json` defines `prepublishOnly`
   as `pnpm test && pnpm package:check`, and `package:check` runs
   `pnpm build`. The workflow already ran `pnpm test` and `pnpm package:check`,
   and `prepack` builds again. Tests run twice and the package is rebuilt
   before publish.
4. **`dist_tag` interpolated into `run`.** The last step (line 131) uses
   `--tag "${{ steps.release.outputs.dist_tag }}"` directly in the script. The
   value is only `next` or `latest`, set by an earlier step, so it is not
   exploitable today. Passing it through `env` would avoid template injection
   if that step changes.

## Open items

- **Harden `.npmrc`: pending, to be applied by hand.** Current content:
  `engine-strict=false`, `prefer-frozen-lockfile=true`,
  `strict-peer-dependencies=false`, `cache=.npm-cache`. Proposed: set
  `engine-strict=true`, keep `strict-peer-dependencies=false` with a comment
  explaining why (the React peers are optional), then validate with
  `pnpm install --frozen-lockfile`. The file is sensitive and was not edited
  here.
- Release workflow item 1 (global `npm install --global npm@11.18.0` without
  integrity verification, in the job holding `id-token: write`) is **open**.
  Its integrity is **not verified**, and it is not accepted.
- Release workflow item 2 (whole pipeline in the publishing job) is the
  accepted risk: a comment in `release.yml` records that it is accepted
  deliberately, gated by the protected `npm` environment and the immutable
  release tag, and that splitting the job has not been approved.
- Release workflow items 3 (`prepublishOnly` repeats work) and 4 (`dist_tag`
  interpolated into `run`) remain open; both were re-checked against the
  current files and still hold.
- Resolved: the `next`/`vite`/`vitest`/`@vitejs/plugin-react` update, and the
  copyright lines for Sphere and Pricing4TS in `THIRD_PARTY_NOTICES.md`
  (checked against both upstream `LICENSE` files).
- Not verified: latest upstream versions of `next`, `vite`, `vitest` and
  `yaml`.
