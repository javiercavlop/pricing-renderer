# CI hardening report

> **Historical report.** This describes an earlier task and the state of the
> repository at that time. Later changes superseded some of it: see the
> "Later changes" section at the end and `docs/audit-report.md`.

## Changes

- `.github/workflows/ci.yml`: the workflow now runs on `push` to `main` and `develop`, and on `pull_request` targeting `main` and `develop`. The Node 22/24 matrix and the `quality` and `browsers` jobs are unchanged.
- `.github/workflows/release.yml`: no changes in that task (see "Later changes"). `id-token: write` and `environment: npm` are kept.

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
- Pins do not update themselves. Security fixes in these actions need a manual SHA bump, so consider Dependabot for `github-actions`. (Since then, `.github/dependabot.yml` configures weekly `github-actions` updates, grouped as `actions-security` and `actions`.)
- The `# v6` comment is not checked against the SHA. A wrong pairing would go unnoticed.
- CI now also runs on pushes to `develop` and on PRs targeting `develop`. PRs to other branches no longer trigger CI. This is the requested behaviour, but it is a narrowing relative to the previous unfiltered `pull_request`.

## Later changes

Verified against the files on `develop` after this task:

- `ci.yml` has an advisory `audit` job (`continue-on-error: true`, Node 22) that runs `pnpm audit --audit-level high`, and top-level `permissions: contents: read`.
- `.github/dependabot.yml` configures npm and `github-actions` updates.
- `release.yml` now has top-level `permissions: {}` and comments documenting the risks of the global npm install and of the single publishing job. The global npm install remains an open item in `docs/audit-report.md`.
