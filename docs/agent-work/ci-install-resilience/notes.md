# CI install resilience

## Incident

On develop `0dfff01` the shard `browsers (firefox+webkit)` hung in the step
"Install browsers" (`apt Get:` stalled) until the 25 minute job timeout.

## Design

The step in `jobs.browser-shards` of `.github/workflows/ci.yml` now:

1. Writes `/etc/apt/apt.conf.d/99ci-resilience` (runner only): `Acquire::Retries "3"`,
   `Acquire::http::Timeout "20"`, `Acquire::https::Timeout "20"`, `DPkg::Lock::Timeout "60"`.
   A stalled mirror connection fails after 20 s and apt retries, instead of waiting forever.
2. Runs `pnpm exec playwright install --with-deps` under
   `timeout --kill-after=15s $ATTEMPT_TIMEOUT`, at most `$ATTEMPTS` times, with a 10 s pause.
3. Emits `::warning::` per failed attempt (with its exit code; 124 means the timeout fired) and
   `::error::` plus exit 1 after the last one.
4. Between attempts only, runs `sudo timeout 60s dpkg --configure -a` (a warning if it fails).
   If the timeout killed attempt 1 during the dpkg phase, dpkg is left interrupted and attempt 2
   would fail at once; the bounded repair prevents that.

Values and why:

- `ATTEMPT_TIMEOUT=4m`: a normal install of firefox+webkit with deps takes well under that;
  a stall is cut early enough for a second attempt.
- `ATTEMPTS=2`: worst case 2 x (240 + 15) s + 60 s (dpkg repair) + 10 s (sleep) = 580 s,
  below 600 s, so the step timeout stays at 10 minutes (no raise needed).
- `timeout-minutes: 10` on the step: backstop above that total, far below the 25 min job
  timeout (unchanged). verify-retry.sh asserts
  `timeout-minutes*60 > ATTEMPTS*(timeout+15) + 60 + 10*(ATTEMPTS-1)` from the workflow's values. A step timeout alone would not work: it kills the whole step, so no
  retry could happen. The per-attempt timeout is what makes the retry possible.
- Values are in `env`, and the script has no `${{ }}`, no `|| true`, no `continue-on-error`.
  The `if ...; then` form keeps `set -e` from aborting before the retry.

## Verification

`docs/agent-work/ci-install-resilience/verify-retry.sh` extracts the run script, `timeout-minutes`
and `env` (ATTEMPTS, ATTEMPT_TIMEOUT) from the step node with the repo's `yaml` package, runs
`bash -n`, checks the budget invariant, and executes the script with the workflow's ATTEMPTS
(ATTEMPT_TIMEOUT is overridden only in the hang case) and stubs for `sudo`, `pnpm`, `sleep`
(no-op) and the real `timeout`. The `sudo` and `pnpm` stubs record argv and stdin in a temp
dir; the cases assert the apt config (four lines via `tee /etc/apt/apt.conf.d/99ci-resilience`),
the pnpm args (`exec playwright install --with-deps firefox webkit`), the exit code in the
warning, and that `dpkg --configure -a` ran once via sudo when a retry happens and never on the
first-attempt success. Nothing is written outside the temp dir.

Real output (check 1):

```
PASS: bash -n on the extracted script
PASS: budget 580s worst case < step timeout 600s (2 attempts x 4m)
PASS: first-attempt-ok (exit 0, warnings 0, errors 0, pnpm calls 1, dpkg repairs 0, 0s)
PASS: fail-once-then-ok (exit 0, warnings 1, errors 0, pnpm calls 2, dpkg repairs 1, 0s)
PASS: always-fails (exit 1, warnings 2, errors 1, pnpm calls 2, dpkg repairs 1, 0s)
PASS: hangs-timeout-fires (exit 1, warnings 2, errors 1, pnpm calls 2, dpkg repairs 1, 2s)
ALL PASS
```

Check 0 (`pnpm install --frozen-lockfile && simulate-ci.sh`) passed: wiring 54/54 assertions,
gate 48/48 cases, change detection 47/47 scenarios.

## Accepted reviewer nits

- `Acquire::Retries "3"` equals the apt 2.7 default; it is kept explicit so the behaviour does
  not depend on the runner's apt version.
- The `on-demand-specs` job still has an unbounded Playwright install. It is out of scope (not a
  required job) and is a followup.

Not covered: real apt behaviour on a runner; this is only observable in CI.
