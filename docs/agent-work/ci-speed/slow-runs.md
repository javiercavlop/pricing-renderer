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

From `playwright.config.ts`:

- `trace` is `on-first-retry` on CI (line 26). Traces are no longer kept for every failure.
- `globalTimeout` is 30 min on CI (line 21).
- `maxFailures` is 20 on CI (line 22).
- `retries` is 2 and `workers` is 2 on CI (lines 17 and 19).

With these limits, one Playwright run on CI stops after 30 min at most. A job timeout in
`ci.yml` is a separate change (slice S2).

## What is not known

The 69 min peak run id is still unknown. It is owner question Q4. Run
`121594178028` is not that run, so it says nothing about why the peak happened.

The cause of the 69 min run is not established. Any explanation is a guess.
The intake figures for run time are estimates unless a log backs them.

## What to collect if a slow run happens again

- The job log of the `browsers` job, saved before it expires.
- The `playwright-report` artifact. It holds traces of retried tests.
- The run id, the PR number and the head commit.
- The start and end time of each step, to see which step took the time.
- The number of failed and retried tests in the log summary.

With these, check H1 first (many failures and retries), then H2 (one test or
worker with no progress), then H3 (trace cost).
