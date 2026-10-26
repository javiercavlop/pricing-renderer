# Handoff: ci-speed

- Status: waiting on the owner (Q1-Q5) · Updated: 2026-10-26
- Branch / head: `task/6b4ede13cb9b4835` / `924bdb5` · PR: none. PR 55 is a separate change whose
  head is the same commit.

## Goal

Cut PR CI wall time and runner-minutes, which today are almost all the `browsers` job. Add timeouts
so that no run can hang for an hour. Make browser tests runnable in the lab. Never use self-hosted
runners.

## State (with evidence)

- Intake written: `docs/agent-work/ci-speed/intake.md`. It cites every fact with a file and line,
  and states which numbers are estimates.
- CI configuration read:
  - No `concurrency` block in `ci.yml`.
  - No `timeout-minutes` (`ci.yml:17-83`), so the default of 360 min applies.
  - `format:check` runs twice (`ci.yml:34,75`).
  - All three browsers run in one job (`ci.yml:63-83`).
  - In the Playwright config: retries 2 and workers 2 on CI, `trace: retain-on-failure`, and no
    `globalTimeout` or `maxFailures` (`playwright.config.ts:16-23`).
- Suite shape, from PR #51: 695 passed and 838 skipped. That is 511 tests in chromium and 92 each in
  firefox and webkit. The 419 chromium-only tests are skipped by file-level `beforeEach` in
  8 specs.
- PR 55, `browsers` check run `121594178028`: started at `2026-10-26T13:17:35Z` and still
  `in_progress`. Its log returns 404 while it runs, so the cause is not confirmed.
- Static reading of `ux-stress.spec.ts` and `helpers/spectra.ts`:
  - No unbounded wait: each test is capped at 120 s and has 3 attempts.
  - `reload()` dispatches `pricing-ready` (`src/element/pricing-renderer-element.ts:431-441`).
  - Three hypotheses remain (H1-H3 in the intake).
- Nothing was run. No check is registered for this task.

## Decisions

- Five slices: S0 investigation, S1 `playwright.config.ts`, S2 `ci.yml`, S3 worker experiment,
  S4 measurement. Reason: disjoint files, each under 300 lines, and the workflow file needs the
  owner's token.
- S1 comes before S2. Reason: the S2 shard jobs set `PW_BLOB=1`, and the S1 reporter switch reads
  it. `release.yml` keeps the `html` reporter, so its artifact (`release.yml:121-128`) still works.
- Shard by project: chromium 1/2, chromium 2/2, and firefox+webkit. Reason: plain `--shard` counts
  the 838 skipped entries, so the shards would be unbalanced. Chromium carries 74% of the executed
  tests.
- Skip by job-level `if:` plus an always-running gate job named `browsers`, never a `paths` filter.
  Reason: a workflow skipped by `paths` leaves required checks pending; a skipped job reports as
  skipped, which required checks accept (L1).
- No browser cache. Reason: the Playwright docs advise against it, and install takes 0.7 min.
- Hosted runners only. Reason: the repository is public, and hosted runners are free there (L2).

## Ruled out

- `on.pull_request.paths` filtering: required checks would stay pending (L1).
- Caching `~/.cache/ms-playwright`: the docs advise against it, and apt dependencies cannot be
  cached (L3).
- Self-hosted runners: the repository is public (owner rule).
- Proposal option C, installing browsers inside a check at run time: it needs network egress and
  re-downloads about 150 MB per run.

## Open questions and risks

- Q1: which checks are required in branch protection. Waiting on the owner.
- Q2: approval and a Workflows: write token for `.github/workflows/ci.yml` (S2), and optionally
  `.github/workflows/release.yml` (S2b). Waiting on the owner.
- Q3: the `maxFailures` value and the S3 worker count. Waiting on the owner.
- Q4: is the 12.2 min a mean, and what is the 69 min run id? Waiting on the owner.
- Q5: proposal P-LAB, option A (browsers in the image at the lockfile version) or B (the Playwright
  base image), and which engines. Waiting on the coordinator and the owner.
- Risk: the S2 gate is computed wrongly and lets an unverified PR merge. Mitigation: the gate fails
  on `failure` or `cancelled` of any shard. Prove it with one deliberately failing test commit on
  the S2 PR before merging.
- Risk: the lab image's Playwright drifts from the lockfile after a Dependabot bump. Mitigation:
  rebuild the image from the version in `pnpm-lock.yaml`.
- Risk: lab fonts differ from the GitHub runners'. Mitigation: lab checks use
  `--ignore-snapshots`; visual checks stay CI-only.
- Risk: the disk and memory figures in P-LAB are estimates (L4). Mitigation: measure with `du` and
  the lab's memory accounting on the first image build.

## Next three steps

1. Once check run `121594178028` has ended or been cancelled, run S0: read
   `ci_log {job_id: 121594178028, lines: 1500}` and the `playwright-report` artifact, then record
   H1, H2 or H3 in `docs/agent-work/ci-speed/slow-runs.md`.
2. After the owner answers Q3, run S1 (implementer) on `playwright.config.ts` with the checks in the
   intake. Then run S2 on `ci.yml`, pushed by the owner with a Workflows: write token.
3. The coordinator files P-LAB as a lab change. Once the browsers are in the image, register the two
   lab Playwright checks from the intake (timeout 1800 s, heavy).

## Evidence

- Files: `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `playwright.config.ts`,
  `tests/browser/ux-stress.spec.ts`, `tests/browser/helpers/spectra.ts`, `pnpm-lock.yaml:1811-1816`
- CI: PR 55 `ci_status` at head `924bdb578c9c` (browsers `121594178028` in progress);
  PR #51 browsers `121088477761` (695 passed, 838 skipped, from
  `docs/agent-work/prop-20261026-1/intake.md:57-58`)
- Lookups: L1-L5, listed in the intake.
