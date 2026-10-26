# Slow CI runs: S0 result

- Status: partly answered. The cause of the 69 min run is still unknown.
- Source: `docs/agent-work/ci-speed/intake.md` and `playwright.config.ts`.

## What was observed

PR 55, `browsers` check run `121594178028`:

- At intake it was `in_progress`, and its log returned 404.
- It later ended, and the log was readable.
- Result: 713 passed, 850 skipped.
- Test step time: 8.7 min.

This run did not hang. It was a normal run.

## Hypotheses

The intake listed three hypotheses (H1 to H3).

- H1, mass failures and retries. Did not occur in this run. All executed tests passed.
- H2, a hung worker. Did not occur in this run. The test step took 8.7 min.
- H3, tracing cost. Partly addressed. See below.

## What the config already limits

From the current `playwright.config.ts`:

- `trace` is `on-first-retry` on CI (line 42). Traces are no longer kept for every failure.
- `globalTimeout` (line 37) takes its value from line 8:
  - 15 min on the shard jobs of `ci.yml`, which set `PW_BLOB=1` (`isBlobRun`, line 6). Those jobs
    have a 25 min job timeout (`timeout-minutes: 25`), so Playwright stops first.
  - 30 min on every other CI run, including the browser step of the release job in
    `release.yml`, which runs `pnpm test:browser` without `PW_BLOB`.
  - 40 min in the on-demand `on-demand-specs` job of `ci.yml`, whose run step passes
    `--global-timeout=2400000` (50 min job timeout).
  - No limit outside CI.
- `maxFailures` is 20 on CI (line 38).
- `retries` is 2 (line 35) and `workers` is 2 (line 33) on CI.
- On CI, `ux-stress.spec.ts` and `spectra-review.spec.ts` are ignored unless `PW_UX_STRESS=1`
  (`testIgnore`, lines 13-18 and 22), so the shard jobs and the release job no longer run them. See
  `on-demand-specs.md`.

With these limits, one Playwright run stops after 15 min at most in a shard job and after 30 min
at most in any other CI run, except the manual `on-demand-specs` job (40 min). The release job had
no such limit before. Its `publish` job in `release.yml` still has no `timeout-minutes`; that file
is outside this change, so it is an owner followup.

## What is not known

The 69 min peak run id is still unknown. It is owner question Q4. Run
`121594178028` is not that run, so it says nothing about why the peak happened.

The 69 min run is still not explained. Its cause is not established, and any explanation is a
guess. The new limits cap how long such a run can last; they do not explain it.
The intake figures for run time are estimates unless a log backs them.

## What to collect if a slow run happens again

- The job logs of the `browsers (...)` shard jobs and of the `browsers` gate job, saved before
  they expire.
- The `playwright-report` artifact (or the `blob-report-*` artifacts if `merge-report` failed).
  It holds traces of retried tests.
- The run id, the PR number and the head commit.
- The start and end time of each step, to see which step took the time.
- The number of failed and retried tests in the log summary.

With these, check H1 first (many failures and retries), then H2 (one test or
worker with no progress), then H3 (trace cost).
