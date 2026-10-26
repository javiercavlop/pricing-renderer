# On-demand specs: ux-stress and the SPECTRA review

- Status: implemented in `playwright.config.ts` and `.github/workflows/ci.yml`.
- Decision: owner decision Q6, option A (`own-42fb8cb3c624469698194642b8898809`), relayed by the
  coordinator: the owner's Q6 says the SPECTRA browser spec must be optional/on demand in CI.
  `INTENT.md` Q6 and `docs/agent-work/visual-review-spectra/report.md:592-594` point at
  `tests/browser/spectra-review.spec.ts` (137 tests, full-page JPEGs); `ux-stress.spec.ts` is the
  other heavy spec. Both go on demand behind the one flag `PW_UX_STRESS=1` and one dispatch job,
  never in the required shards; the `browsers` gate must not depend on it.
- Files covered:
  - `tests/browser/spectra-review.spec.ts`, the SPECTRA browser spec.
  - `tests/browser/ux-stress.spec.ts`, the stress spec (6 tests, one per stress fixture).

## What is ignored and when

`playwright.config.ts` sets `testIgnore` to `['**/ux-stress.spec.ts', '**/spectra-review.spec.ts']`
when both hold:

- `CI` is set (any non-empty value), and
- `PW_UX_STRESS` is not `1`.

Otherwise `testIgnore` is `undefined` and nothing is ignored. The flag keeps its old name: one flag
runs both specs.

Where they run:

- `browser-shards` jobs of `ci.yml` (behind the required gate): `CI` set, no `PW_UX_STRESS`. Neither
  runs.
- Release job of `release.yml` (`pnpm test:browser`): `CI` set, no `PW_UX_STRESS`. Neither runs.
- `on-demand-specs` job of `ci.yml` (manual dispatch only): `CI` set, `PW_UX_STRESS=1`. Both run.
- Local run (`pnpm test:browser` or `pnpm exec playwright test`) without `CI`: both run.
- Lab checks: see `lab-chromium.md`.

The release job in `release.yml` runs `pnpm test:browser` with `CI` set by GitHub Actions and no
`PW_UX_STRESS`, so it skips both specs now. A local run without `CI` still runs both. The PR text
must say this.

## How to trigger

The `on-demand-specs` job runs only when `github.event_name == 'workflow_dispatch'`:

- GitHub UI: Actions tab > CI > Run workflow, then pick the branch.
- CLI: `gh workflow run ci.yml --ref <branch>`.

GitHub shows Run workflow and accepts a dispatch only when the workflow file with
`workflow_dispatch` exists on the repository's default branch (R2-REV-004). The owner confirms which
branch that is. Until this change reaches it, the job cannot be dispatched.

The job installs chromium, runs

```text
pnpm exec playwright test --project=chromium --global-timeout=2400000 \
  tests/browser/ux-stress.spec.ts tests/browser/spectra-review.spec.ts
```

with `PW_UX_STRESS: '1'`, and uploads `playwright-report/` as the artifact `on-demand-specs-report`
(14 days, `overwrite: true`), even when the tests fail. No `PW_BLOB` is set, so Playwright uses the
HTML reporter. The CLI flag sets the global timeout to 40 min (the config default on CI is 30 min);
the job timeout is 50 min, so Playwright stops and writes its report first.

## Where the output goes

`spectra-review.spec.ts` writes no file of its own. Each test:

- prints a `SPECTRA_SUMMARY` line and a `SPECTRA_METRICS` JSON line to stdout
  (`spectra-review.spec.ts:413-420`), which appear in the job log and in the HTML report;
- attaches the metrics JSON with `testInfo.attach(..., { body })` (`spectra-review.spec.ts:419`);
- attaches each JPEG screenshot with `testInfo.attach(..., { body })`
  (`spectra-review.spec.ts:434-441`).

The HTML reporter copies body attachments into `playwright-report/data/`, so the measurements and
the JPEGs are inside `playwright-report/`. `test-results/` only holds per-test temporary output
(traces of retried tests, failure screenshots), which the HTML reporter also copies into the report.
The job therefore uploads `playwright-report/` only.

A manual dispatch also runs every other job of `ci.yml`. `changes` emits `rendered=true` for any
event that is not `pull_request`, so the browser shards, `merge-report` and the `browsers` gate run
as well. The `on-demand-specs` job is not in `needs` of `browsers`, so its result never changes the
gate. A dispatch has its own concurrency group (`ci-CI-workflow_dispatch-refs/heads/<branch>`), so it does not
replace a pending push run.

## How this is guarded

`docs/agent-work/ci-speed/simulate-ci.sh` asserts the wiring: `workflow_dispatch` in `on`, the `if:`
of `on-demand-specs`, no `needs` on it, `browsers` not needing it, no mention of `PW_UX_STRESS`,
`ux-stress` or `spectra-review` anywhere in `browser-shards` or the workflow env, no job other than
`on-demand-specs` setting `PW_UX_STRESS`, the `PW_UX_STRESS: '1'` env, both spec paths and the
global timeout on its run step, and the `testIgnore` patterns, condition and `defineConfig` entry
in `playwright.config.ts`. It also lists the tests with `CI=1`, with and without `PW_UX_STRESS=1`.
See `gate-simulation.md`.
