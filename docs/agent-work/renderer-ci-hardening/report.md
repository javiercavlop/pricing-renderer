# CI hardening report

## Changes

- `.github/workflows/ci.yml`: the workflow now runs on `push` to `main` and `develop`, and on `pull_request` targeting `main` and `develop`. The Node 22/24 matrix and the `quality` and `browsers` jobs are unchanged.
- `.github/workflows/release.yml`: no changes. `id-token: write` and `environment: npm` are kept.

## Action pinning: NOT complete

No commit SHA for any action could be verified offline. The repository contains no existing SHA-pinned `uses:` entries, and no network access was available. No SHA was guessed, so every action is still referenced by tag.

Unpinned actions (all in `ci.yml` and `release.yml`):

| Action                  | Current tag | Files               |
| ----------------------- | ----------- | ------------------- |
| actions/checkout        | v6          | ci.yml, release.yml |
| pnpm/action-setup       | v6          | ci.yml, release.yml |
| actions/setup-node      | v6          | ci.yml, release.yml |
| actions/upload-artifact | v6          | ci.yml, release.yml |

Resolve each tag to a commit SHA:

```sh
gh api repos/actions/checkout/git/ref/tags/v6
gh api repos/pnpm/action-setup/git/ref/tags/v6
gh api repos/actions/setup-node/git/ref/tags/v6
gh api repos/actions/upload-artifact/git/ref/tags/v6
```

If `object.type` is `tag` (an annotated tag), dereference it with `gh api repos/<owner>/<repo>/git/tags/<object.sha>` and use `object.sha` from that response. Then replace each reference with `uses: <owner>/<repo>@<sha> # v6`.

## Risk

- Until pinned, a moved or compromised `v6` tag would change what runs in CI and in the npm publish job (which has `id-token: write`).
- CI now also runs on pushes to `develop` and on PRs targeting `develop`. PRs to other branches no longer trigger CI. This is the requested behaviour, but it is a narrowing relative to the previous unfiltered `pull_request`.
