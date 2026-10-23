# CI hardening report

> Historical: superseded by `docs/audit-report.md` and the current
> `.github/workflows/ci.yml` and `.github/dependabot.yml`. This report
> describes the state at the time of that task.

## Changes

- `.github/workflows/ci.yml`: the workflow now runs on `push` to `main` and `develop`, and on `pull_request` targeting `main` and `develop`. The Node 22/24 matrix and the `quality` and `browsers` jobs are unchanged. (Historical: `ci.yml` now also has a non-blocking `audit` job.)
- `.github/workflows/release.yml`: no changes. `id-token: write` and `environment: npm` are kept.

## Action pinning: complete

Every `uses:` in `ci.yml` and `release.yml` is pinned to a commit SHA, with the tag kept as a `# v6` comment. The SHAs were given by the owner, who resolved them with `git ls-remote`.

| Action                  | Tag | Commit SHA                               | Files               |
| ----------------------- | --- | ---------------------------------------- | ------------------- |
| actions/checkout        | v6  | d23441a48e516b6c34aea4fa41551a30e30af803 | ci.yml, release.yml |
| pnpm/action-setup       | v6  | 0977fd99725f1db4007ccb2928dbb4e90d06cc86 | ci.yml, release.yml |
| actions/setup-node      | v6  | 249970729cb0ef3589644e2896645e5dc5ba9c38 | ci.yml, release.yml |
| actions/upload-artifact | v6  | b7c566a772e6b6bfb58ed0dc250532a479d7789f | ci.yml, release.yml |

## Risk

- The SHAs were not re-resolved in this task (no network access); they rely on the owner's resolution.
- Pins do not update themselves. Security fixes in these actions need a manual SHA bump, so consider Dependabot for `github-actions`. (Historical: `.github/dependabot.yml` now covers `github-actions`.)
- The `# v6` comment is not checked against the SHA. A wrong pairing would go unnoticed.
- CI now also runs on pushes to `develop` and on PRs targeting `develop`. PRs to other branches no longer trigger CI. This is the requested behaviour, but it is a narrowing relative to the previous unfiltered `pull_request`.
