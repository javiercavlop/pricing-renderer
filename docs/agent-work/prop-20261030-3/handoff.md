# Handoff: prop-20261030-3 (lead)

## Goal
Add dark and RTL Chromium visual baselines at 375 and 1440 px in a new spec file (V1). The INTENT.md edit (D1, Q5) is not part of this change.

## C0 finding (lab calibration)
- Task 1acee2abaf1c4239 ran the 9 `is responsive at <name>` tests in comparison mode with a self-installing check (`pnpm install --frozen-lockfile` passed, then `playwright test ... --project=chromium --grep 'is responsive at'`).
- Verdict: C0 NOT RUN, 0 of 9 reached a screenshot comparison. All 9 (mobile-320, mobile-375, mobile-599, tablet-600, tablet-839, table-840, desktop-1024, desktop-1200, desktop-1440) failed at `browserType.launch`: "Executable doesn't exist at /home/dev/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell".
- Cause: the lab has no Playwright Chromium headless shell (a lab fault). `docs/agent-work/ci-speed/lab-chromium.md` expects `PLAYWRIGHT_BROWSERS_PATH=/ms-playwright`; the runner looked in `~/.cache/ms-playwright`. No diff ratios exist.
- The lab therefore cannot produce or calibrate baselines. Not retried and nothing installed (coordinator instruction).

## State
- Coordinator opened owner CRP crp-pr-visual-baselines-route (recommended: a one-off CI run with a temporary workflow generates the 4 -linux PNGs).
- Task 21ec890c1bea4a48 (implementer) writes only the spec file, with lint, prettier and tsc checks. No baselines, no PR yet.

## Decisions
- No baselines are committed unless calibrated or generated on CI by the owner-approved route.
- Checks use the self-installing sh -c form. No playwright run in the lab.
- Spec design follows intake.md section V1 (tolerances 0.025 at 375, 0.015 at 1440; dark via the `#theme` select, RTL via `document.documentElement.dir`).

## Ruled out
- Lab generation of baselines (no Chromium; uncalibrated).
- Retrying C0 or installing a browser (coordinator).

## Risks
- The spec is untested against a browser until CI. An RTL overflow assertion could fail (a finding, not to be loosened).
- Without baselines, CI fails on the new tests (missing snapshots) until the route supplies the PNGs.

## Next three steps
1. Review the diff of 21ec890c1bea4a48 and integrate it.
2. Park until the coordinator's note with the owner's answer.
3. Add the PNGs by the chosen route, run ui-qa and a reviewer, push, open the PR, declare ready.
