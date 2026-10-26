# Round-3 review of slices S1 and S2: dispositions

- Scope: `playwright.config.ts`, `.github/workflows/ci.yml` and the `docs/agent-work/ci-speed/`
  records.
- Reviews: reviewer (R3-REV, approve, minor doc findings), test review (R3-TST, changes requested,
  one major).
- Dispositions: fixed here, accepted (no change, reason given), or followup.
- The round-3 test-review major (R3-TST-001) was fixed after round 3, in the task that wrote this
  file. There was no round-4 review of that fix.

## Changes made in this round

- `ci.yml` and `playwright.config.ts`: unchanged. No finding pointed at a defect in either file.
- `simulate-ci.sh`: 14 new wiring assertions (54 in all), a third `--list` without `CI`, an exact
  test-count comparison between the flagged listing and the listing without `CI`, and a
  `Requires:` header line.
- Docs: `gate-simulation.md` (wiring list, counts, mutation procedure, simulation output),
  `on-demand-specs.md`, `slow-runs.md` and `handoff.md` updated.

## Findings

| ID         | Disposition | Note                                              |
| ---------- | ----------- | ------------------------------------------------- |
| R3-REV-001 | fixed here  | on-demand-specs 40 min exception in slow-runs.md  |
| R3-REV-002 | fixed here  | maxFailures 20 and retries 2 on the dispatch run  |
| R3-REV-003 | fixed here  | overlong line re-wrapped                          |
| R3-TST-001 | fixed here  | major; run step env, keys and step `if`s pinned   |
| R3-TST-002 | fixed here  | matrix args are project and shard tokens only     |
| R3-TST-003 | fixed here  | every job `runs-on: ubuntu-latest`                |
| R3-TST-004 | fixed here  | unique displayed names, gate strategy, `on` keys  |
| R3-TST-005 | fixed here  | timeout bounds, test:browser, release.yml scan    |
| R3-TST-006 | fixed here  | third listing without CI, exact count             |
| R3-TST-007 | fixed here  | full-copy procedure; mutations not run (no shell) |
| R3-TST-008 | fixed here  | nit, `Requires:` line                             |
| R3-TST-009 | fixed here  | nit, `--project=chromium`, persist-credentials    |

Followup (from R3-TST-005): the `publish` job of `release.yml` has no `timeout-minutes`.

- R3-REV-001: `slow-runs.md` said 30 min was the bound for any non-shard CI run. It now names the
  exception, the manual `on-demand-specs` job (40 min).
- R3-REV-002: `on-demand-specs.md` now says the dispatch run uses the CI config values
  `maxFailures` 20 and `retries` 2, so it stops after 20 failed tests. A full measurement needs
  `--max-failures=0` added by hand to the dispatch step only; that is an owner choice, and `ci.yml`
  is not changed for it.
- R3-REV-003: the concurrency-group sentence of `on-demand-specs.md` is re-wrapped.
- R3-TST-001 (major): the shard step was pinned only by its `run` string, so `if: false`, a
  matrix-dependent `if`, a constant `ARGS` or a removed `PW_BLOB` kept every assertion green. Now:
  its env is exactly `ARGS: ${{ matrix.args }}` and `PW_BLOB: '1'` (`isDeepStrictEqual`); it has no
  `if`, `shell`, `working-directory` or `continue-on-error`; no step of `browser-shards` other than
  the `actions/upload-artifact` step has an `if`.
- R3-TST-002: each matrix `args` must split on single spaces into tokens matching
  `/^--project=(chromium|firefox|webkit)$/` or `/^--shard=\d+\/\d+$/`.
- R3-TST-003: the self-hosted denylist is replaced by `runs-on === 'ubuntu-latest'` for every job.
- R3-TST-004: the displayed name (`job.name ?? id`) of every job is unique and is `browsers` only
  for the gate job; the gate job has no `strategy`; `on.pull_request` and `on.push` have exactly
  the key `branches`.
- R3-TST-005: every `timeout-minutes` is at most 30, `browser-shards` at most 25 and
  `on-demand-specs` at most 50; `package.json` `scripts['test:browser']` is `playwright test`;
  `.github/workflows/release.yml` (read only) mentions neither `PW_UX_STRESS` nor `ux-stress` nor
  `spectra-review`. Followup for the owner: the `publish` job of `release.yml` has no
  `timeout-minutes`. That file is outside this change and was not edited.
- R3-TST-006: a third listing runs without `CI` (`env -u CI -u PW_UX_STRESS -u PW_BLOB`) on
  chromium and must list both specs. The flagged `CI=1` listing must say `in 2 files`, its `Total:`
  count must equal the number of test lines of the two files in the listing without `CI` (143 in
  the recorded run), and every test line it holds must belong to one of the two files. The three
  listings took 3 s.
- R3-TST-007: the copy procedure named only `tests/browser/`, but `tests/browser/helpers/spectra.ts`
  reads `../../fixtures/spectra/` and `ux-stress.spec.ts` imports `../fixtures/stress/build.js`. The
  procedure now uses a full `git worktree add --detach` copy plus a `node_modules` symlink, and
  lists four new mutations with their expected results. The mutations were not run: this task had
  no shell, only its registered checks.
- R3-TST-008: `simulate-ci.sh` states `Requires: bash >= 4, git >= 2.32, installed node_modules`.
- R3-TST-009: the on-demand run step must pass `--project=chromium`; every checkout of `changes`,
  `browser-shards`, `merge-report` and `on-demand-specs` must set `persist-credentials: false`.
- Simulation output in `gate-simulation.md`: as in round 2, the end of the check log (from the gate
  row `| skipped | false | skipped |` to `SUMMARY`) is copied; the wiring and listing lines above it
  are reconstructed from the fixed labels and the `SUMMARY` line of the same run.

## PR-text reminders

The reminders of `review-round2.md` still hold. Add:

- The dispatch job stops after 20 failed tests (`maxFailures` 20 on CI).
- `release.yml` `publish` has no job timeout (owner followup).
