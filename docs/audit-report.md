# Audit report

Summary of audit findings, each checked against the repository files. Anything
that could not be checked from the repository is marked **not verified**.

## Dependencies

- **`next`, `vite`, `vitest`.** `next` is pinned to 16.2.11
  (`examples/next/package.json`); the install resolved `vite` 6.4.3 and
  `vitest` 3.2.7. These versions are verified. Whether newer releases exist is
  **not verified**. A separate update PR covers them; out of scope here.
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
  `pnpm@10.19.0` (and `release.yml` uses 10.19.0), while the local install
  ran with pnpm v9.15.9. Local results may differ from CI.

## Release workflow (`.github/workflows/release.yml`)

1. **Global npm without integrity verification.** `npm install --global
npm@11.18.0` (line 72) installs a version-pinned CLI with no checksum or
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
4. **`dist_tag` interpolated into `run`.** The last step uses
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
- Release workflow items 1–4 are not fixed; workflows were out of scope.
- Dependency updates are left to the separate update PR.
- Not verified: latest upstream versions of `next`, `vite`, `vitest` and
  `yaml`, and the copyright lines for Sphere and Pricing4TS in
  `THIRD_PARTY_NOTICES.md`.
