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
3. Emits `::warning::` per failed attempt and `::error::` plus exit 1 after the last one.

Values and why:

- `ATTEMPT_TIMEOUT=4m`: a normal install of firefox+webkit with deps takes well under that;
  a stall is cut early enough for a second attempt.
- `ATTEMPTS=2`: 2 x (4m + 15s kill grace) + 10 s sleep is about 8.6 min.
- `timeout-minutes: 10` on the step: backstop above that total, far below the 25 min job
  timeout (unchanged). A step timeout alone would not work: it kills the whole step, so no
  retry could happen. The per-attempt timeout is what makes the retry possible.
- Values are in `env`, and the script has no `${{ }}`, no `|| true`, no `continue-on-error`.
  The `if ...; then` form keeps `set -e` from aborting before the retry.

## Verification

`docs/agent-work/ci-install-resilience/verify-retry.sh` extracts the run script with the
repo's `yaml` package, runs `bash -n`, and executes it with stubs for `sudo` (discards input,
nothing written to /etc), `pnpm`, `sleep` (no-op), and the real `timeout`.

Real output (check 1):

```
PASS: bash -n on the extracted script
PASS: first-attempt-ok (exit 0, warnings 0, errors 0, pnpm calls 1, 0s)
PASS: fail-once-then-ok (exit 0, warnings 1, errors 0, pnpm calls 2, 0s)
PASS: always-fails (exit 1, warnings 2, errors 1, pnpm calls 2, 1s)
PASS: hangs-timeout-fires (exit 1, warnings 2, errors 1, pnpm calls 2, 2s)
ALL PASS
```

Check 0 (`pnpm install --frozen-lockfile && simulate-ci.sh`) passed: wiring 54/54 assertions,
gate 48/48 cases, change detection 47/47 scenarios.

Not covered: real apt behaviour on a runner; this is only observable in CI.
