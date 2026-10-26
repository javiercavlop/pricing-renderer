# Round-2 review of slices S1 and S2: dispositions

- Scope: `playwright.config.ts`, `.github/workflows/ci.yml` and the `docs/agent-work/ci-speed/`
  records.
- Reviews: reviewer (R2-REV, approve), security (R2-SEC, approve), test review (R2-TST, changes
  requested).
- Dispositions: fixed here, accepted (no change, reason given), or owner decision.
- Owner decision applied in this round: Q6, option A (`own-42fb8cb3c624469698194642b8898809`,
  relayed by the coordinator). `tests/browser/spectra-review.spec.ts` and
  `tests/browser/ux-stress.spec.ts` both run on demand behind `PW_UX_STRESS=1` in one dispatch job,
  never in the required shards. See `on-demand-specs.md`.

## Changes made in this round

- `playwright.config.ts`: `testIgnore` is `['**/ux-stress.spec.ts', '**/spectra-review.spec.ts']`
  on CI unless `PW_UX_STRESS` is `1`.
- `ci.yml`:
  - The job `ux-stress` is now `on-demand-specs`. It runs both specs with `PW_UX_STRESS: '1'` and
    `--global-timeout=2400000`, has a 50 min timeout, and uploads `on-demand-specs-report`.
  - The concurrency group keys non-PR runs by event and ref, so a dispatch never replaces a
    pending push run.
- `simulate-ci.sh`: per-project shard fractions, install coverage, no soft-fail on the required
  path, leak scans for the on-demand flag and files, triggers, concurrency, timeouts and runners,
  a `--list` behaviour check, and four new change-detection scenarios.
- Docs: `ux-stress-on-demand.md` renamed to `on-demand-specs.md`; `gate-simulation.md`,
  `lab-chromium.md`, `slow-runs.md` and `handoff.md` updated.

## Findings

| ID         | Disposition    | Note                                         |
| ---------- | -------------- | -------------------------------------------- |
| R2-REV-001 | fixed here     | handoff.md rewritten to the current state    |
| R2-REV-002 | fixed here     | SPECTRA spec is spectra-review.spec.ts       |
| R2-REV-003 | fixed here     | concurrency group includes the event         |
| R2-REV-004 | fixed here     | default-branch requirement documented        |
| R2-REV-005 | accepted       | PR text reminder, see below                  |
| R2-SEC-001 | owner decision | owner verifies on GitHub                     |
| R2-SEC-002 | fixed here     | concurrency key, same fix as R2-REV-003      |
| R2-SEC-003 | fixed here     | nit, concurrency key, same fix as R2-REV-003 |
| R2-TST-001 | fixed here     | shard fractions and install per project      |
| R2-TST-002 | fixed here     | JSON scans of shards, steps and workflow env |
| R2-TST-003 | fixed here     | no continue-on-error, no `if`, exact run     |
| R2-TST-004 | fixed here     | `--list` inside simulate-ci.sh (2 s)         |
| R2-TST-005 | fixed here     | branches, concurrency, timeouts, runners     |
| R2-TST-006 | fixed here     | root files, one-sided SHAs, changes checkout |
| R2-TST-007 | fixed here     | comment on the non-ASCII scenario            |
| R2-TST-008 | fixed here     | gate-simulation.md sentence reworded         |

- R2-REV-001: `handoff.md` described the state before S1 and S2. It now lists S0 to S2, both
  review rounds, Q6 option A, the open owner items and the next steps.
- R2-REV-002: `ux-stress.spec.ts` was called "the SPECTRA browser spec". The SPECTRA browser spec
  of `INTENT.md` Q6 and `docs/agent-work/visual-review-spectra/report.md:592-594` is
  `tests/browser/spectra-review.spec.ts`. With Q6 option A both are on demand.
- R2-REV-003: the group was `pull_request.number || github.ref`, so a dispatch on `develop` shared
  the group of a push to `develop` and could replace a pending push run. The non-PR key is now
  `format('{0}-{1}', github.event_name, github.ref)`. `simulate-ci.sh` asserts the exact string.
- R2-REV-004: GitHub shows Run workflow and accepts a dispatch only when the workflow file with
  `workflow_dispatch` is on the default branch. Documented in `on-demand-specs.md`, `ci.yml` and
  the handoff; the owner confirms the default branch.
- R2-REV-005, accepted: the PR text must say that the release job skips both on-demand specs. See
  "PR-text reminders".
- R2-SEC-001, owner decision: whether a `workflow_dispatch` run on a PR branch can report a
  `browsers` check that replaces a failed `pull_request` `browsers` check on the same SHA. This
  cannot be tested outside GitHub. The owner verifies it, and pinning the required check to the
  GitHub Actions app (R1-SEC-001) bounds the risk.
- R2-SEC-002 (minor) and R2-SEC-003 (nit): both concern the shared concurrency key; fixed by the
  R2-REV-003 change. No other security finding.
- R2-TST-001: coverage by project name only allowed a shard to be dropped (`chromium 1/2` alone).
  Each project must now be one entry without `--shard` or exactly `1/N..N/N` with one N, and every
  entry's `install` names its projects.
- R2-TST-002: the flag and the file names were checked only in matrix `args`. The JSON of
  `jobs.browser-shards`, each of its steps and the workflow `env` must not mention
  `PW_UX_STRESS`, `ux-stress` or `spectra-review`, and only `on-demand-specs` may set the flag.
- R2-TST-003: a `continue-on-error`, an `if` on the gate step, a `name` on `browsers`, a changed
  shard command or a `|| true` could bypass the gate without failing a case. Each is now asserted.
- R2-TST-004: the script lists the tests with `CI=1`, with and without `PW_UX_STRESS=1`. It took
  2 s, so it stays in the script; checks 3 and 4 remain as well.
- R2-TST-005 to R2-TST-008: see the change list and `gate-simulation.md`.
- Simulation output in `gate-simulation.md`: only the end of the check log (from the gate row
  `| skipped | false | skipped |` to `SUMMARY`) is copied; the wiring and listing lines above it
  are reconstructed from the fixed labels and the `SUMMARY` line of the same run, as that file
  states.
- Mutations: not run. The task had no shell; the procedure and the expected results are in
  `gate-simulation.md`, section "Mutations".

## PR-text reminders

- The release job now has `globalTimeout` 30 min and `maxFailures` 20 (before: none). It fails
  closed: nothing is published after a stopped run. Recover a stopped publish by re-running it.
- The release job (`pnpm test:browser`, `CI` set, no `PW_UX_STRESS`) skips both on-demand specs,
  `ux-stress.spec.ts` and `spectra-review.spec.ts`. They run only in the dispatch job
  `on-demand-specs` and in local runs without `CI`.
- The dispatch job can be triggered only once `ci.yml` is on the default branch.
