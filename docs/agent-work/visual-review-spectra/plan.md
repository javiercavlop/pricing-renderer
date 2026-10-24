Phase 1 only (measure and report, default look unchanged).
Tasks: A load test (spectra-load.test.ts, first); B layout metrics test + metrics.json; C Playwright spec spectra-review.spec.ts (captures + height metrics, chromium only, no toHaveScreenshot, no baselines); D report.md (after A,B integrate; heights from CI added in a later pass).
Then PR into develop, CI, panel reviewer + test-reviewer on final head, set_review_package, lead_ready.
