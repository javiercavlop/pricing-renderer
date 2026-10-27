# CI install resilience

## Incident

On develop `0dfff01` the shard `browsers (firefox+webkit)` hung in the step
"Install browsers" (`apt Get:` stalled) until the 25 minute job timeout.

## Evidence that the first design failed (PR 61, head `edd427e`)

Jobs 121878581927 (chromium 1/2) and 121878581917 (firefox+webkit) both failed in
"Install browsers". The mirror `azure.archive.ubuntu.com` stalled again: attempt 1 stopped printing
after `Get:7 ... fonts-freefont-ttf` (chromium) and after `Get:24 ... libcodec2` (firefox+webkit).

The attempt timeout fired after 4 m but did not stop apt. Playwright runs
`sudo -- sh -c 'apt-get update && apt-get install ...'`, so apt is a root process, and `timeout`
(running as the unprivileged runner user) cannot signal it (EPERM). The orphaned `apt-get`
(pid 2717 / 2913) kept `/var/lib/dpkg/lock-frontend`, kept downloading into the output of attempt 2
(`Get:8`, `Get:9` ... appeared there) and attempt 2 died with
`Waiting for cache lock ... E: Unable to acquire the dpkg frontend lock` after
`DPkg::Lock::Timeout 60`. The retry never had a chance. The earlier assumption that the kill
reaches apt through the process group was wrong.

## Design

The step in `jobs.browser-shards` of `.github/workflows/ci.yml`:

1. Writes `/etc/apt/apt.conf.d/99ci-resilience` (runner only): `Acquire::Retries "3"`,
   `Acquire::http::Timeout "20"`, `Acquire::https::Timeout "20"`, `DPkg::Lock::Timeout "60"`.
2. Runs `pnpm exec playwright install --with-deps` under
   `timeout --kill-after=15s $ATTEMPT_TIMEOUT`, at most `$ATTEMPTS` times.
3. Emits `::warning::` per failed attempt (with its exit code; 124 means the timeout fired) and
   `::error::` plus exit 1 after the last one.
4. Between attempts only (when another attempt follows), the function `stop_apt` sends
   `sudo pkill -TERM -x` to `apt-get`, `apt`, `dpkg`, sleeps 5 s, then sends `-KILL` to the same.
   `-x` matches the exact process name; `pkill -f` is not used because it would match the sudo
   wrapper of the pkill itself. Each pkill exits 1 when nothing matches, so each is wrapped in
   `if ...; then echo ::notice::...; fi` and never aborts under `bash -e`.
5. Then the bounded repair `sudo timeout 60s dpkg --configure -a` (a warning if it fails) and
   `sleep 10`.
6. Mirror fallback, from attempt 2 on, before the install: writes
   `http://archive.ubuntu.com/ubuntu/` to `/etc/apt/apt-mirrors.txt` (the runner's sources use
   `mirror+file:/etc/apt/apt-mirrors.txt`, seen in the log as `Get:1 file:/etc/apt/apt-mirrors.txt
Mirrorlist`) and logs a `::notice::`. This is best effort: it cannot be verified outside CI.

Values and why:

- `ATTEMPT_TIMEOUT=3m`, `ATTEMPTS=3`: apt keeps already downloaded debs between attempts, so the
  retries make cumulative progress.
- Worst case of the step: 3 x (180 + 15) s = 585 s of attempts, plus 2 x (5 s pkill wait + 60 s
  dpkg repair + 10 s sleep) = 150 s, total 735 s. `timeout-minutes: 13` (780 s) leaves 45 s spare
  (at least 30 s required).
- Worst case of the shard job: checkout, pnpm/node setup and `pnpm install` (a few minutes) +
  735 s install step; the job `timeout-minutes: 25` is unchanged and the browser test run keeps
  the rest of its budget.
- A step timeout alone would not work: it kills the whole step, so no retry could happen.
- Values are in `env`; the script has no `${{ }}`, no `|| true`, no `continue-on-error`;
  `${INSTALL}` stays unquoted so it splits into browser names.

## Verification

`verify-retry.sh` extracts the run script, `timeout-minutes` and `env` from the step node with the
repo's `yaml` package, runs `bash -n`, checks the budget invariant
(`timeout-minutes*60 >= ATTEMPTS*(timeout+15) + (ATTEMPTS-1)*(5+60+10) + 30`), and runs the script
with the workflow's ATTEMPTS (expectations are computed from it; ATTEMPT_TIMEOUT is overridden only
in the hang case, where the real `timeout` kills a hanging pnpm stub). `sudo`, `pnpm` and `sleep`
are stubs; sudo records argv and tee stdin per target file. The cases assert, besides the apt config
and pnpm args: with a retry, `pkill -TERM` and `-KILL` for `apt-get`, `apt`, `dpkg` happen before
`timeout 60s dpkg --configure -a`, once per retry; the `apt-mirrors.txt` tee happens once per
retry, after the first repair (so never on attempt 1); none of these happen when the first attempt
works. Nothing is written outside the temp dir.

Real output (check 1):

```
PASS: bash -n on the extracted script
PASS: budget 735s worst case + 30s <= step timeout 780s (3 attempts x 3m)
PASS: first-attempt-ok (exit 0, warnings 0, errors 0, pnpm calls 1, dpkg repairs 0, 0s)
PASS: fail-once-then-ok (exit 0, warnings 1, errors 0, pnpm calls 2, dpkg repairs 1, 0s)
PASS: always-fails (exit 1, warnings 3, errors 1, pnpm calls 3, dpkg repairs 2, 0s)
PASS: hangs-timeout-fires (exit 1, warnings 3, errors 1, pnpm calls 3, dpkg repairs 2, 3s)
ALL PASS
```

Check 0 (`pnpm install --frozen-lockfile && simulate-ci.sh`) passed: wiring 54/54 assertions,
gate 48/48 cases, change detection 47/47 scenarios.

## Accepted reviewer nits

- `Acquire::Retries "3"` equals the apt 2.7 default; it is kept explicit so the behaviour does
  not depend on the runner's apt version.
- The `on-demand-specs` job still has an unbounded Playwright install. It is out of scope (not a
  required job) and is a followup.

Not covered: real apt behaviour on a runner (killing root apt, the mirror switch); this is only
observable in CI.
