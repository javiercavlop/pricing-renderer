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
  "pnpm",
  "exec",
  "playwright",
  "test",
  "<spec files>",
  "--project=chromium",
  "--workers=2",
  "--ignore-snapshots",
  "--reporter=line"
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
  "--reporter=line"
]
```

`test-results/` and `playwright-report/` are gitignored, so the checks leave no tracked
files.

## Font and snapshot caveat

The `-linux` baselines come from GitHub runners (`playwright.config.ts`, lines 3 and 7).
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
5. Compare the pass and skip counts with the latest CI Chromium result. They should match.
6. Update the memory and disk estimates in this file with the measured values.

If a step fails, stop and report. Do not register the checks until step 4 passes.
