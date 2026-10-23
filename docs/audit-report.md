# Audit report

Summary of audit findings, each checked against the repository files. Anything
that could not be checked from the repository is marked **not verified**.

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

## Release workflow (`.github/workflows/release.yml`)

1. **Global npm without integrity verification.**
   `npm install --global npm@11.18.0` (line 89) installs a version-pinned CLI
   with no checksum or signature check, in a job that has `id-token: write`. A
   compromised package would run in a job that can mint the OIDC token. A
   risk comment above that step in `release.yml` documents it and lists
   mitigations to consider separately; it is not marked as accepted.
2. **Whole pipeline in the publishing job.** Install, lint, tests, package
   checks, browser engine install and browser tests all run in the same job
   that holds `id-token: write` and the `npm` environment. Third-party code
   (dev dependencies, install scripts, browser tooling) runs next to the
   publish credentials. Splitting build/test from publish would reduce the
   exposure. A comment at the top of the job in `release.yml` records this as
   accepted deliberately.
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

## CI audit job and Dependabot

`.github/dependabot.yml` already existed since the 0.1.0 release. The recent
dependency update only modified it (grouping), together with
`.github/workflows/ci.yml` (the `audit` job) and comments in `release.yml`
(the risk notes referenced in items 1 and 2 above).

- **`audit` job in `ci.yml` is non-blocking.** It runs
  `pnpm audit --audit-level high` with `continue-on-error: true`. The audit is
  now clean (0 advisories with the `pnpm.overrides`), **not verified**: this
  result comes from the CI of the dependency update PR, not from a run made
  for this document.
- **Promoting `audit` to blocking.** The comment in `ci.yml` says to do this
  once advisories are triaged. With a clean audit that condition could already
  be met. Owner decision; not applied.
- **`dependabot.yml` is grouped.** The `npm` ecosystem has security,
  framework-tooling and development groups; `github-actions` has security and
  version groups. The `npm` entry lists both `/` and `/examples/*`. In a pnpm
  workspace with a single lockfile this may open duplicate PRs for the same
  update. To watch on the first run.

## Open items

- **Harden `.npmrc`: pending, to be applied by hand.** Current content:
  `engine-strict=false`, `prefer-frozen-lockfile=true`,
  `strict-peer-dependencies=false`, `cache=.npm-cache`. Proposed: set
  `engine-strict=true`, keep `strict-peer-dependencies=false` with a comment
  explaining why (the React peers are optional), then validate with
  `pnpm install --frozen-lockfile`. The file is sensitive and was not edited
  here.
- Release workflow items 1, 3 and 4 are still open. Item 1 (global npm
  without integrity verification) is only documented as a risk in a comment
  in `release.yml`, which lists "Mitigations to consider separately"; it is
  not accepted. Item 2 is the only one documented as accepted deliberately
  (job-level note in `release.yml`). No workflow change was made for any of
  them.
- Resolved: the `next`/`vite`/`vitest`/`@vitejs/plugin-react` update, and the
  copyright lines for Sphere and Pricing4TS in `THIRD_PARTY_NOTICES.md`
  (checked against both upstream `LICENSE` files).
- Not verified: latest upstream versions of `next`, `vite`, `vitest` and
  `yaml`.
