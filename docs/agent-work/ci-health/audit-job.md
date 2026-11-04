# CI audit job is blocking

## What changed

In `.github/workflows/ci.yml`, job `audit` (`pnpm audit --audit-level high`):

- Removed `continue-on-error: true`.
- Replaced the comment above `runs-on` with a note that the job is blocking, that
  the result depends on the live advisory database, and that a failure is fixed
  with a dependency update or a documented pnpm override, not by re-adding
  `continue-on-error`.

The `merge-report` job keeps its `continue-on-error: true` on purpose: it only
builds an HTML report and never decides the outcome of a run.

## Why

An advisory job that cannot fail the workflow gives no protection. High and
critical advisories in dependencies should stop a pull request. The cost is that
a new advisory published against an unrelated dependency can fail unrelated pull
requests until it is fixed.

## Audit result

Command: `pnpm audit --audit-level high`, run in this worktree after the frozen
install check. The frozen install reported pnpm v9.15.9 in the lab, while
`packageManager` and CI use pnpm 10.19.0, so CI is the authoritative run.

- Exit code: 0
- Output: `2 vulnerabilities found`, `Severity: 2 moderate`
- High or critical advisories: none. The two moderate advisories are below the
  `high` threshold and do not fail the job. The lab output did not list package,
  path or advisory id, so they are not recorded here.

This is a point-in-time result against the live database; the blocking job in CI
is the continuing check.
