# Proposal P-LAB: Chromium browser checks in the lab

- Status: spec only. Chromium only.
- Decision: owner decision `crp-pr-ci-speed-workflows`, answer `s2-and-plab-chromium`.
- Source: `docs/agent-work/ci-speed/intake.md`, section "Proposal P-LAB".

## Who does what

The lab image and the check registration live outside this repository. The coordinator or
the lab operators do both. This repository only carries this spec. Nothing here changes
the lab by itself.

## Problem

Lab workers have no Playwright browser executables. A task that changes rendered code
cannot run the browser suite in the lab. Today the CI `browsers` job is the only
rendering proof.

## What the lab image needs

- Playwright browsers at the version in `pnpm-lock.yaml`. That is `playwright@1.62.0`.
- The browsers installed under `PLAYWRIGHT_BROWSERS_PATH=/ms-playwright`, with their
  system libraries.
- Install at image build time:
  `npx -y playwright@1.62.0 install --with-deps chromium`
- Chromium only. Firefox and webkit stay in CI.
- Rebuild the image when the Playwright version in `pnpm-lock.yaml` changes. Dependabot
  bumps it in the weekly `development` group. A mismatch brings back the error
  "Executable doesn't exist".

Disk, estimate only (measure with `du -sh /ms-playwright/*` after the build):

- chromium and chromium-headless-shell: about 0.75 to 0.95 GB
- apt dependencies: about 0.3 to 0.5 GB

## Checks to register

Both checks use a timeout of 1800 s and are classed as heavy.

Targeted, per spec file:

```json
[
  "env",
  "PW_UX_STRESS=1",
  "pnpm",
  "exec",
  "playwright",
  "test",
  "<spec files>",
  "--project=chromium",
  "--workers=2",
  "--ignore-snapshots",
  "--reporter=line",
  "--global-timeout=1500000"
]
```

Change level:

```json
[
  "pnpm",
  "exec",
  "playwright",
  "test",
  "--project=chromium",
  "--workers=2",
  "--ignore-snapshots",
  "--reporter=line",
  "--global-timeout=1500000"
]
```

### `CI` in the lab and the global timeout

This repository cannot tell whether the lab sets `CI`. If it does, `playwright.config.ts` sets
`globalTimeout` to 30 min (line 8), the same as the check timeout of 1800 s. The check would then
be killed at the moment Playwright tries to stop, and no summary would be printed. Without `CI`,
there is no global timeout at all.

Decision: both arrays pass `--global-timeout=1500000` (25 min). The CLI flag overrides the config,
so Playwright stops 5 min before the check timeout and prints its summary whether `CI` is set or
not. The checks do not depend on `CI` being unset.

### `CI` in the lab and `ux-stress.spec.ts`

When `CI` is set, `playwright.config.ts` ignores `tests/browser/ux-stress.spec.ts` unless
`PW_UX_STRESS=1` (see `ux-stress-on-demand.md`).

- The targeted check starts with `env PW_UX_STRESS=1`, so a task that names
  `tests/browser/ux-stress.spec.ts` in `<spec files>` runs it whether `CI` is set or not. For other
  spec files the variable changes nothing.
- The change-level check has no `PW_UX_STRESS`. With `CI` set it skips `ux-stress.spec.ts`, as the
  required CI jobs do; without `CI` it runs it. To run the stress spec in the lab, use the targeted
  check with that file.

`test-results/` and `playwright-report/` are gitignored, so the checks leave no tracked
files.

## Font and snapshot caveat

The `-linux` baselines come from GitHub runners (`playwright.config.ts`: the suffix on line 3,
the `snapshotPathTemplate` on line 20).
Lab fonts may differ. So the lab checks pass `--ignore-snapshots`. Visual baselines stay
CI-only until one lab run shows they match.

A lab pass proves behaviour, not pixels. A task that touches rendered code still records
the CI `browsers` gate as the visual proof.

## Memory

Estimate, not measured:

- about 0.5 GB for the Vite dev server and the runner
- about 0.3 to 0.6 GB per Chromium worker on the stress pages
- so about 1.5 to 2 GB at `--workers=2`

The QA gate runs two checks at once only while memory has room. This is why the checks are
heavy.

## Verification procedure

Do this on the first run after the image is built.

1. Check the install: `ls /ms-playwright` shows the chromium directories, and
   `du -sh /ms-playwright/*` gives the real sizes.
2. Run `pnpm exec playwright test --list --project=chromium`. This shows whether `--list`
   needs the browsers or the web server. If it fails for that reason, drop it from
   the fast checks.
3. Run one small spec with the targeted check. It must pass, with no
   "Executable doesn't exist" error.
4. Run the full change-level check. Record the wall time and the peak memory.
5. Compare the pass and skip counts with the latest CI Chromium result. They should match. If the
   lab does not set `CI`, leave out the `ux-stress.spec.ts` tests before comparing: CI no longer
   runs them in the shards.
6. Update the memory and disk estimates in this file with the measured values.

If a step fails, stop and report. Do not register the checks until step 4 passes.
