# ux-stress on demand

- Status: implemented in `playwright.config.ts` and `.github/workflows/ci.yml`.
- Decision: owner decision Q6 (`own-42fb8cb3c624469698194642b8898809`). The SPECTRA browser spec
  `tests/browser/ux-stress.spec.ts` is optional and runs on demand in CI. It never runs as a
  required shard, and the required `browsers` gate does not depend on it.

## What is ignored and when

`playwright.config.ts` sets `testIgnore` to `**/ux-stress.spec.ts` when both hold:

- `CI` is set (any non-empty value), and
- `PW_UX_STRESS` is not `1`.

Otherwise `testIgnore` is `undefined` and nothing is ignored.

Where it runs:

- `browser-shards` jobs of `ci.yml` (behind the required gate): `CI` set, no `PW_UX_STRESS`. Not
  run.
- Release job of `release.yml` (`pnpm test:browser`): `CI` set, no `PW_UX_STRESS`. Not run.
- `ux-stress` job of `ci.yml` (manual dispatch only): `CI` set, `PW_UX_STRESS=1`. Run.
- Local run (`pnpm test:browser` or `pnpm exec playwright test`) without `CI`: run.
- Lab checks: see `lab-chromium.md`.

The release job in `release.yml` runs `pnpm test:browser` with `CI` set by GitHub Actions and no
`PW_UX_STRESS`, so it also skips ux-stress now. A local run without `CI` still includes it.

## How to trigger

The `ux-stress` job runs only when `github.event_name == 'workflow_dispatch'`:

- GitHub UI: Actions tab > CI > Run workflow, then pick the branch.
- CLI: `gh workflow run ci.yml --ref <branch>`.

The job installs chromium, runs
`pnpm exec playwright test --project=chromium tests/browser/ux-stress.spec.ts` with
`PW_UX_STRESS: '1'`, and uploads `playwright-report/` as the artifact `ux-stress-report` (14 days),
even when the tests fail. No `PW_BLOB` is set, so Playwright uses the HTML reporter and a
`globalTimeout` of 30 min; the job timeout is 40 min.

A manual dispatch also runs every other job of `ci.yml`. `changes` emits `rendered=true` for any
event that is not `pull_request`, so the browser shards, `merge-report` and the `browsers` gate run
as well. The `ux-stress` job is not in `needs` of `browsers`, so its result never changes the gate.

## How this is guarded

`docs/agent-work/ci-speed/simulate-ci.sh` asserts the wiring: `workflow_dispatch` in `on`, the
`if:` of `ux-stress`, no `needs` on it, `browsers` not needing it, no shard `args` naming it, the
`PW_UX_STRESS: '1'` env and the spec path on its run step, and the `testIgnore` pattern, condition
and `defineConfig` entry in `playwright.config.ts`. See `gate-simulation.md`.
