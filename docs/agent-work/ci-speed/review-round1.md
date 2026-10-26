# Round-1 review of slice S2: dispositions

- Scope: `.github/workflows/ci.yml` and the `docs/agent-work/ci-speed/` records.
- Reviews: reviewer (R1-REV), security (R1-SEC), test review (R1-TST).
- Dispositions: fixed here, accepted (no change, reason given), owner decision, or out of scope
  (with a followup).

## Changes made in this round

- `ci.yml`:
  - Both `upload-artifact` steps set `overwrite: true`.
  - `merge-report` runs on `!cancelled() && needs.browser-shards.result != 'skipped'`. `browsers`
    keeps `if: always()`, with a comment that a skipped required check counts as passed.
  - Markdown is allowed only at the repository root. Any other nested path outside the
    allowlisted directories runs the browsers.
  - `persist-credentials: false` on the checkout of `changes`, `browser-shards` and
    `merge-report`.
  - Comments on the matrix (every Playwright project must be in a shard) and on the allowlist
    (rendering inputs must never live under an allowlisted path).
- `simulate-ci.sh`:
  - Wiring assertions on the parsed workflow.
  - Env values fed through the parsed `env:` maps.
  - New skip, run, deletion, move, diverged-history and unrelated-root scenarios.
  - git isolated from the caller's config.
- Docs: `gate-simulation.md`, `slow-runs.md` and `lab-chromium.md` updated to the current config.

## Findings

| ID         | Disposition    | Note                 |
| ---------- | -------------- | -------------------- |
| R1-REV-001 | fixed here     | overwrite on uploads |
| R1-REV-002 | fixed here     | root-only Markdown   |
| R1-REV-003 | accepted       | see below            |
| R1-REV-004 | fixed here     | see change list      |
| R1-REV-005 | fixed here     | see change list      |
| R1-REV-006 | fixed here     | see change list      |
| R1-REV-007 | fixed here     | see change list      |
| R1-REV-008 | fixed here     | see change list      |
| R1-REV-009 | out of scope   | see below            |
| R1-SEC-001 | owner decision | see below            |
| R1-SEC-002 | fixed here     | see change list      |
| R1-SEC-003 | fixed here     | see below            |
| R1-SEC-004 | accepted       | no change            |
| R1-SEC-005 | fixed here     | comment in ci.yml    |
| R1-SEC-006 | accepted       | no change            |
| R1-SEC-007 | fixed here     | comment in ci.yml    |
| R1-TST-001 | fixed here     | simulate-ci.sh       |
| R1-TST-002 | fixed here     | simulate-ci.sh       |
| R1-TST-003 | fixed here     | simulate-ci.sh       |
| R1-TST-004 | fixed here     | simulate-ci.sh       |
| R1-TST-005 | fixed here     | simulate-ci.sh       |
| R1-TST-006 | fixed here     | simulate-ci.sh       |

- R1-REV-001: `overwrite: true` on both artifact uploads, so a re-run of a failed shard does not
  fail on the artifact name.
- R1-REV-002: nested `*.md` outside `docs/`, `.changeset/`, `openspec/` and `tests/unit/` now runs
  the browsers.
- R1-REV-003, accepted: the release job now has `globalTimeout` 30 min and `maxFailures` 20
  (before: none). It fails closed: nothing is published after a stopped run. Recovery is to re-run
  the publish workflow. The PR text must state this.
- R1-REV-009, out of scope: `.gitignore`, `.prettierignore` and the eslint ignore list are outside
  this change's file scope. `blob-report/` is only produced with `CI=1 PW_BLOB=1`, so a local run
  does not create it. Followup.
- R1-SEC-001, owner decision: CODEOWNERS for `.github/**`, and pinning the required `browsers`
  check to the GitHub Actions app in branch protection. Not a code change.
- R1-SEC-003: fixed for the new jobs `changes`, `browser-shards` and `merge-report`
  (`persist-credentials: false`). The checkouts of `quality` and `audit` are pre-existing and
  unchanged.
- R1-TST-001 to R1-TST-006: the simulation and its record in `gate-simulation.md`.

## Not recorded as a finding

- Running `simulate-ci.sh` in CI, so that a later edit of `ci.yml` cannot break the wiring
  unnoticed, is an owner decision. Today it runs only as a lab check. Followup.
