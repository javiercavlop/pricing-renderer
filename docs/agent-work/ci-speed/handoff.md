# Handoff: ci-speed

- Status: waiting-review · Updated: 2026-10-26
- Branch / head: `change/ci-speed` / round-3 fixes on top of `e583f7c` · PR: none yet. The
  workflow file needs an owner push with a Workflows token.

## Goal

Cut PR CI wall time and runner-minutes, which were almost all the single `browsers` job; add
timeouts so that no run can hang for an hour; make browser tests runnable in the lab; never use
self-hosted runners.

## State (with evidence)

- S0, slow runs: done. `slow-runs.md`. PR 55 run `121594178028` was a normal run (713 passed, 850
  skipped, test step 8.7 min). The 69 min run is still unexplained (owner Q4).
- S1, `playwright.config.ts`: done.
  - On CI: `trace: on-first-retry`, `maxFailures` 20, `globalTimeout` 15 min with `PW_BLOB=1`
    (shards) and 30 min otherwise; blob reporter on the shards, HTML elsewhere.
  - `testIgnore` skips `ux-stress.spec.ts` and `spectra-review.spec.ts` on CI unless
    `PW_UX_STRESS=1` (Q6 option A, see `on-demand-specs.md`).
- S2, `.github/workflows/ci.yml`: done in the branch, not yet pushed to GitHub.
  - `concurrency`: PRs by number, cancel in progress; other runs by event and ref, never cancelled
    in progress.
  - Every job has `timeout-minutes`.
  - `changes`: bash filter; `rendered=false` only for PRs into `develop` that touch only docs,
    changesets, specs, unit tests, root Markdown, `LICENSE` or the Dependabot config.
  - `browser-shards`: chromium 1/2, chromium 2/2, firefox+webkit; blob artifacts with
    `overwrite: true`.
  - `merge-report`: advisory (`continue-on-error: true`), builds `playwright-report`.
  - `browsers`: the required check, `if: always()`, gate script on `needs.changes.result`,
    `rendered` and `needs.browser-shards.result`.
  - `on-demand-specs`: `workflow_dispatch` only, no `needs`, both heavy specs on chromium with
    `PW_UX_STRESS: '1'`, `--global-timeout=2400000`, 50 min job timeout, artifact
    `on-demand-specs-report`.
- Round-1 review: all findings dispositioned (`review-round1.md`).
- Round-2 review: all findings dispositioned (`review-round2.md`).
- Round-3 review: reviewer approved (minor doc findings); test review asked for changes with one
  major (R3-TST-001, the shard run step pinned only by its `run` string). All findings
  dispositioned in `review-round3.md` and applied in `simulate-ci.sh` and the docs. The major was
  fixed after round 3; no round-4 review has seen the fix. `ci.yml` and `playwright.config.ts` did
  not change in round 3.
- Simulation (`gate-simulation.md`): wiring 54/54, three `--list` runs as expected in 3 s (CI=1:
  1125 tests in 8 files; CI=1 PW_UX_STRESS=1: 143 tests in 2 files; no CI, chromium: 518 tests in
  10 files; the flagged listing holds exactly the 143 chromium tests of the two files), gate
  48/48, change detection 47/47.
- Registered checks of the round-3 task: frozen install, prettier and `simulate-ci.sh`; all
  passed.
- Mutations of the simulation were not run (no shell in the round-2 and round-3 tasks); the
  full-copy procedure and expected results are in `gate-simulation.md`.

## Decisions

- Shard by project (chromium 1/2, 2/2, firefox+webkit). Reason: plain `--shard` counts the skipped
  chromium-only entries, so shards would be unbalanced; chromium carries 74% of executed tests.
- Skip by job-level `if:` plus an always-running gate job named `browsers`, never a `paths`
  filter. Reason: a workflow skipped by `paths` leaves required checks pending.
- The gate uses `if: always()`, not `!cancelled()`. Reason: GitHub counts a skipped required check
  as passed.
- No `${{ }}` in any `run:` block; values reach scripts through `env:`. Reason: script injection.
- `persist-credentials: false` on the new checkouts. Reason: R1-SEC-003.
- Q6 option A (owner, `own-42fb8cb3c624469698194642b8898809`, relayed by the coordinator): both
  heavy specs on demand behind one flag and one dispatch job; `browsers` does not depend on it.
- Non-PR concurrency key includes the event. Reason: a dispatch must not replace a pending push run
  (R2-REV-003).
- `on-demand-specs` uploads `playwright-report/` only. Reason: `spectra-review.spec.ts` writes no
  file; its metrics and JPEGs are test attachments, which the HTML report contains.
- No browser cache; hosted runners only. Reason: Playwright docs advise against caching browsers;
  the repository is public.

## Ruled out

- `on.pull_request.paths` filtering: required checks would stay pending.
- Caching `~/.cache/ms-playwright`: advised against, apt dependencies cannot be cached.
- Self-hosted runners: owner rule, public repository.
- Installing browsers inside a lab check at run time: needs egress and re-downloads about 150 MB.

## Open questions and risks

- Owner: CODEOWNERS for `.github/**` and pinning the required `browsers` check to the GitHub
  Actions app in branch protection (R1-SEC-001).
- Owner: whether `simulate-ci.sh` should run in CI; today it runs only as a lab check.
- Owner: confirm the repository default branch. GitHub accepts a dispatch only when the workflow
  file with `workflow_dispatch` is on it, so `on-demand-specs` cannot be dispatched until this
  change reaches it (R2-REV-004).
- Owner: test whether a dispatch run on a PR branch can replace a failed `pull_request` `browsers`
  check on the same SHA (R2-SEC-001).
- Assumption: `actions/download-artifact` v8 (`9000827ccba6bdab643e8b6fd33ac0654aef8333`) reads
  artifacts of `actions/upload-artifact` v6. Unproven until a real run; a failure only loses the
  merged HTML report (`merge-report` is advisory).
- Out of scope: `.gitignore` and `.prettierignore` entries for `blob-report/` (R1-REV-009).
  Followup.
- Owner Q4 (69 min run id) and Q5 (P-LAB image option) remain open; see `slow-runs.md` and
  `lab-chromium.md`.
- Risk: a wrong gate lets an unverified PR merge. Mitigation: the simulation, and the failing-test
  proof on the PR before merge.
- PR text must state: the release job has `globalTimeout` 30 min and `maxFailures` 20 and skips
  both on-demand specs; recover a stopped publish by re-running it; the dispatch job stops after
  20 failed tests (`--max-failures=0` by hand only, owner choice).
- Owner followup: the `publish` job of `release.yml` has no `timeout-minutes` (outside this
  change, R3-TST-005).
- Risk: the R3-TST-001 fix has no independent review round yet.

## Next three steps

1. The owner pushes `.github/workflows/ci.yml` (with `playwright.config.ts` and the docs) on
   `change/ci-speed` with a Workflows token and opens the PR into `develop`, using the PR-text
   reminders of `review-round2.md` and `review-round3.md`.
2. The owner runs the proof procedure of `gate-simulation.md` ("Proof on the PR"): a failing test
   turns `browsers` red; the revert turns it green; a re-run does not conflict on artifacts; a
   separate docs-only PR keeps `browsers` green with the shards skipped.
3. After the first real run, record whether `merge-report` read the v6 artifacts, and once
   `ci.yml` is on the default branch, dispatch CI once to prove `on-demand-specs`.

## Evidence

- Files: `playwright.config.ts`, `.github/workflows/ci.yml`, `docs/agent-work/ci-speed/`
  (`intake.md`, `slow-runs.md`, `lab-chromium.md`, `on-demand-specs.md`, `gate-simulation.md`,
  `simulate-ci.sh`, `review-round1.md`, `review-round2.md`, `review-round3.md`).
- CI: PR 55 `browsers` run `121594178028` (713 passed, 850 skipped). No run of the new `ci.yml`
  yet.
