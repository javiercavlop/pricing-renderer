# Intake: ci-speed

- Owner request: `own-b9282d675f9e4b608d7a4e5016bfb533`. Objective: O4, supply-chain and CI health
  (`ROADMAP.md`, draft).
- Base: branch `task/6b4ede13cb9b4835`, head `924bdb5` (the head of PR 55, see "Facts from CI").
- Paths are relative to the repository root. No workflow, configuration or test file is changed by
  this intake.

## Owner facts (last 100 runs, from the owner, not measured here)

- PR CI wall time: median 9.9 min, peak 69 min. About 17 runner-minutes per run. About 76 PR runs
  in two days.
- Almost all of it is the `browsers` job: `pnpm test:browser` 12.2 min, plus 0.7 min for
  `playwright install`. `quality (22)`, `quality (24)` and `audit` take about 1 min each.
- Open question Q4: the 12.2 min of `test:browser` is above the 9.9 min median wall time, so it is
  probably a mean that the long runs pull up. The owner should confirm which statistic it is.

## Facts from the repository

Workflow `.github/workflows/ci.yml`:

- Triggers: `pull_request` and `push`, both for `main` and `develop` (`ci.yml:3-11`). There is no
  `workflow_dispatch` and no `paths` filter.
- There is no `concurrency` block anywhere in the file. A new push to a PR does not cancel the run
  of the previous head.
- No job sets `timeout-minutes` (`ci.yml:17-83`). The GitHub default is 360 min per job (lookup
  L1).
- `quality` is a matrix on Node 22 and 24 (`ci.yml:17-41`): format, lint, unit tests, typecheck,
  package check and three demo builds. `audit` is advisory and uses `continue-on-error`
  (`ci.yml:43-61`).
- `browsers` is a single job (`ci.yml:63-83`). It runs `pnpm format:check` again (`ci.yml:75`, which
  duplicates `ci.yml:34`), installs `chromium firefox webkit` with `--with-deps` (`ci.yml:76`), runs
  `pnpm test:browser` (`ci.yml:77`), and always uploads `playwright-report/` (`ci.yml:78-83`).
- `release.yml` runs the same full browser suite in the publish job, with no `timeout-minutes`
  (`release.yml:21-23,115-119`). It uploads `playwright-report/` on failure (`release.yml:121-128`).

Configuration `playwright.config.ts`:

- Default test timeout 30 s, expect timeout 8 s (`playwright.config.ts:8-10`).
- `fullyParallel: true`, 2 workers on CI, retries 2 on CI (`playwright.config.ts:16-19`).
- On CI the reporters are `html` and `github` (`playwright.config.ts:20`).
- `trace: 'retain-on-failure'` (`playwright.config.ts:23`). This records a trace for every test
  and deletes it when the test passes. The Playwright docs recommend `on-first-retry` on CI (lookup
  L3).
- The `webServer` runs `pnpm demo`, which runs `pnpm build` and then the Vite dev server of
  `examples/vanilla` (`playwright.config.ts:26-31`, `package.json:129`,
  `examples/vanilla/package.json:2,6`). Its start timeout is 120 s.
- Projects: chromium, firefox and webkit (`playwright.config.ts:32-36`).
- There is no `globalTimeout` (the default 0 means no limit) and no `maxFailures`.
- Visual baselines use a `-linux` suffix (`playwright.config.ts:3,7`).
- `package.json:128` defines `test:browser` as `playwright test`. The lockfile resolves
  `playwright@1.62.0` and `playwright-core@1.62.0` (`pnpm-lock.yaml:1811,1816`).

Suite shape:

- PR #51 `browsers` job: 695 passed and 838 skipped (`docs/agent-work/prop-20261026-1/intake.md:57-58`).
  This is consistent with 511 tests in chromium and 92 each in firefox and webkit: the 419
  chromium-only tests are listed, then skipped, in the other two projects (511 + 92 + 92 = 695, and
  2 × 419 = 838). Chromium therefore runs 74% of the executed tests, and it runs the heaviest ones.
- The chromium-only skip sits in a file-level `beforeEach` in `spectra-review.spec.ts:52-53`,
  `spectra-grid.spec.ts:26-27`, `spectra-text.spec.ts:35`, `spectra-shorter-page.spec.ts:25`,
  `spectra-followups.spec.ts:26`, `spectra-addon-grid.spec.ts:21`, `spectra-addon-marker.spec.ts:30`
  and `ux-stress.spec.ts:39-41`. `pricing-renderer.spec.ts:1331` skips one group only.
- The heavy chromium tests:
  - 37 SPECTRA fixtures (glob of `tests/fixtures/spectra/*/*.yml`).
  - `spectra metrics`: 37 × 3 viewports, 60 s each (`spectra-review.spec.ts:501-506`).
  - `spectra captures`: 8 extremes × 3 viewports, 120 s each (`spectra-review.spec.ts:39-48,617-621`).
  - `spectra text`: fixtures × 3 viewports, 60 s each (`spectra-text.spec.ts:18-42`).
  - `spectra plan grid`: fixtures with plans × 3 viewports, 60 s each (`spectra-grid.spec.ts:17-34`).

Time ceiling of today's configuration:

- Every attempt can use up to its test timeout, and there are up to 3 attempts per test on CI.
  Nothing caps the whole run below the 360 min job default.
- Example: the 111 `spectra metrics` tests alone allow 111 × 60 s × 3 / 2 workers ≈ 166 min.
- A 69 min run fits about 38 chromium tests that use their full 60 s on all 3 attempts:
  (69 − 12) min × 2 workers / 3 min per test ≈ 38. This shows the mechanism exists. It does not
  show that this is what happened (see the ux-stress findings).

## Facts from CI (checked 2026-10-26)

- PR 55's head is `924bdb578c9c`, the head of this worktree. `ci_status` for PR 55:
  - `quality (22)`, `quality (24)` and `audit` succeeded in under 1 min.
  - `browsers` (check run `121594178028`) started at `2026-10-26T13:17:35Z` and is `in_progress`.
- `ci_log` for `121594178028` returned 404, "job log storage refused the download". This is the same
  limit seen for an in-progress job in `docs/agent-work/prop-20261026-1/handoff.md:25`. The log can
  be read only after the job ends.
- Not verified: the run id behind the 69 min peak. The owner has it.

## The ux-stress suspect (static reading only; nothing was run)

- `tests/browser/ux-stress.spec.ts` has 6 tests, one per fixture (`ux-stress.spec.ts:19-26,154-156`):
  - Each test sets its own timeout to 120 s (`:156`) and runs in chromium only (`:39-41`).
  - Each test loops over 5 variants (`:31-37,163-209`). Every variant calls `applyPricing`, then
    `measureUx`, `measurePlanGrid` and `measureOverflow`.
  - The fixtures are synthetic and large, with up to 15 plans and 143 features
    (`tests/fixtures/stress/build.ts:39-123`).
- `applyPricing` waits in the page for `pricing-ready`, with a 20 s fallback that resolves
  `timeout` (`tests/browser/helpers/spectra.ts:64-74`). After that, `renderer.updateComplete`,
  `document.fonts.ready` and 3 animation frames have no timeout of their own (`:80-87`). For
  variants 2-5 the YAML is unchanged, so the helper calls `reload()` (`:78`). `reload()` dispatches
  `pricing-ready` on success (`src/element/pricing-renderer-element.ts:251,431-441`), so this path
  should not wait for the 20 s fallback.
- The in-page loops are bounded:
  - `measureUx` makes fixed scroll jumps (`ux-stress.spec.ts:43-151`).
  - `measureOverflow` makes one pass over `renderer.querySelectorAll('*')` with an ancestor walk
    (`helpers/spectra.ts:247-274`).
  - `_updateCompactLayout` switches at 840 px (`pricing-renderer-element.ts:539-547`). That is far
    from the tested widths 1440, 1024 and 375, so no resize oscillation is expected.
- Conclusion: the static reading finds no unbounded wait. One test costs at most 120 s × 3 attempts.
  If all 6 fail, that is at most about 18 min with 2 workers.
- A run over 1 h needs one of these hypotheses, to be checked against the log or report once the job
  ends:
  - (H1) Many tests failed and were retried. A broken build makes every SPECTRA test wait for its
    timeout.
  - (H2) A worker or browser hung, beyond what Playwright's per-test timeout stops. An example is a
    renderer stuck in a synchronous loop during teardown.
  - (H3) Tracing with `retain-on-failure` (`playwright.config.ts:23`) takes DOM snapshots of the
    stress pages, with thousands of nodes, at every action.

## Scope

1. Lab gate. When a change affects rendering, the task runs browser tests in the lab through
   `qa_run`. Blocked today: the lab workers have no Playwright browser executables. Evidence:
   `docs/agent-work/visual-review-spectra/report.md:577` and
   `docs/agent-work/spectra-grid-and-text/handoff.md:17`. Proposal P-LAB below. Fast substitute
   checks are listed in the same section.
2. Trim the PR `browsers` job: sharding, browsers installed per shard, skipping changes that touch no
   rendered code with an always-reporting gate job, PR concurrency cancel, timeouts, and the
   69 min / PR 55 investigation. Pushes to develop still run everything.
3. Never self-hosted runners: the repository is public. Standard GitHub-hosted runners are free and
   unlimited for public repositories, and their Linux runner has 4 vCPU, 16 GB RAM and a 14 GB SSD
   (lookup L2). Every slice keeps `runs-on: ubuntu-latest`.

## Proposal P-LAB (factory/lab change, for the coordinator and the owner; not a repository slice)

What is missing: browser builds matching the lockfile's Playwright version (1.62.0,
`pnpm-lock.yaml:1811-1816`), plus their system libraries, inside the project container that runs the
checks.

- Option A (recommended): install the browsers when the project image is built.
  - Set `PLAYWRIGHT_BROWSERS_PATH=/ms-playwright`, a read-only shared path. Run
    `npx -y playwright@<version from pnpm-lock.yaml> install --with-deps chromium`. Add firefox and
    webkit only if the lab is meant to replace the CI cross-browser run.
  - Rebuild the image when the lockfile's Playwright version changes. Dependabot bumps
    devDependencies weekly in the `development` group (`.github/dependabot.yml:24-26`). A mismatch
    brings back "Executable doesn't exist".
  - Disk, estimated (lookup L4, low confidence; measure with `du -sh /ms-playwright/*` after the
    build):
    - chromium + chromium-headless-shell: about 0.75-0.95 GB
    - all three engines: about 1.3-1.6 GB
    - apt dependencies: about 0.3-0.5 GB
- Option B: base the project image on `mcr.microsoft.com/playwright:v<version>-noble`. It includes
  the browsers, their dependencies and Node.
  - Size, estimated (L4): about 0.9-1.1 GB compressed and about 2.5 GB unpacked.
  - L4 could not confirm that the `v1.62.0-noble` tag exists.
- Option C (not recommended): a check that runs `pnpm exec playwright install chromium` at run
  time. It needs network egress from the check container and system libraries already in the image.
  It downloads about 150 MB on every run unless a cache persists.
- Memory: an estimate, not measured. Roughly 0.5 GB for the Vite dev server and the runner, plus
  0.3-0.6 GB per chromium worker on the stress pages. That is about 1.5-2 GB at `--workers=2`. The
  QA gate allows two checks at once only while memory has room, so browser checks must be classed
  as heavy.
- Fonts: the `-linux` baselines (`playwright.config.ts:3,7`) come from GitHub runners. Lab fonts
  may differ, so lab checks use `--ignore-snapshots` (lookup L5). Visual baselines stay CI-only
  until one lab run proves they match.
- Lab checks to register once the browsers exist (timeout 1800 s, heavy):
  - Targeted, per task:
    `["pnpm", "exec", "playwright", "test", "<spec files>", "--project=chromium", "--workers=2", "--ignore-snapshots", "--reporter=line"]`
  - Change level:
    `["pnpm", "exec", "playwright", "test", "--project=chromium", "--workers=2", "--ignore-snapshots", "--reporter=line"]`
  - Firefox and webkit stay CI-only, unless Option A installs them.
  - `test-results/` and `playwright-report/` are gitignored (`.gitignore:6-7`), so these checks leave
    no tracked files.

Fast substitutes until then (no browser needed; each also runs in CI):

- `["pnpm", "typecheck"]`
- `["pnpm", "lint"]`
- `["pnpm", "format:check"]`
- `["pnpm", "test"]`: Vitest in a node environment (`vitest.config.ts:5-6`).
- `["pnpm", "--filter", "pricing-renderer-demo", "build"]`: bundles the page the browser suite
  serves (`ci.yml:39`).
- `["pnpm", "package:check"]`
- `["pnpm", "exec", "playwright", "test", "--list"]`: collects every spec, so it catches import and
  syntax errors in `tests/browser/**`. The docs do not say whether `--list` needs browser executables
  or starts the `webServer` (L5). Its first lab run decides; drop it if it fails for that reason.
- None of these proves rendering. Until P-LAB lands, the PR's CI `browsers` gate is the only
  rendering proof. A task touching rendered code records "browser proof: CI" in its result block.

## Slices

Order: S0 can run at any time. S1 comes before S2, because the S2 shard jobs rely on the S1 blob
reporter switch. S3 and S4 come after S2.

### S0: investigate the slow runs (read-only)

- Role: debugger. Turn budget: 30. Risk: low (reads CI, writes one doc).
- Owns: `docs/agent-work/ci-speed/slow-runs.md`.
- Read-only: this intake, the files cited above.
- Steps:
  1. When `121594178028` has ended (or the owner cancels it), read `ci_log` with 1500 lines.
  2. Ask the owner for the 69 min run id and read its jobs.
  3. Download the `playwright-report` artifact (`ci.yml:78-83`, kept 14 days) to get per-test
     durations and retry counts.
  4. Decide between H1, H2 and H3 with the log lines as evidence.
- Checks: `["pnpm", "exec", "prettier", "--check", "docs/agent-work/ci-speed/slow-runs.md"]`.

### S1: Playwright configuration (`playwright.config.ts`, about 25 lines)

- Role: implementer. Risk: medium. It changes the CI test policy for every PR and for releases.
- Owns: `playwright.config.ts`.
- Read-only: this intake, `.github/workflows/ci.yml`, `.github/workflows/release.yml`.
- Changes:
  - `globalTimeout: process.env.CI ? 30 * 60_000 : 0`. This is below the S2 job timeouts, so
    Playwright writes its report before GitHub kills the job. The unsharded release job takes about
    13 min today, so 30 min leaves headroom.
  - `trace: process.env.CI ? 'on-first-retry' : 'retain-on-failure'` (L3).
  - `maxFailures: process.env.CI ? 20 : 0`, so that a broken build stops early. L5 could not confirm
    whether flaky tests count toward it. The value is an owner decision (Q3).
  - Reporter: `blob` plus `github` when `PW_BLOB=1` (set only by the S2 shard jobs). Otherwise it
    stays `html` plus `github`, so `release.yml:121-128` still finds `playwright-report/`.
  - Optional, in a separate commit: a project-level `testIgnore` in firefox and webkit for the
    chromium-only files listed above. This removes the 838 skipped entries, so shards balance by
    executed tests. With it, firefox and webkit list 92 tests each.
- Checks:
  - `["pnpm", "exec", "prettier", "--check", "playwright.config.ts"]`
  - `["pnpm", "exec", "eslint", "playwright.config.ts"]`
  - `["pnpm", "exec", "playwright", "test", "--list", "--reporter=line"]` (it loads the configuration)
  - P-LAB chromium check, if available.

### S2: CI workflow (`.github/workflows/ci.yml`, about 120 changed lines)

- Role: implementer. Risk: medium-high. It changes the merge gate. A wrong aggregate condition
  would let unverified code merge.
- Owns: `.github/workflows/ci.yml`. Pushing it needs a token with Workflows: write, which only the
  owner has.
- Changes:
  - PR concurrency: group by workflow and PR number, `cancel-in-progress` only for
    `pull_request`.
  - `timeout-minutes`: quality and audit 15, shards 25, the gate 5.
  - Remove the duplicate `pnpm format:check` from the browser job (`ci.yml:75`).
  - A `changes` job: checkout with `fetch-depth: 0`, then a `git diff --name-only` between the
    base and head SHAs. It outputs `rendered=false` only for a `pull_request` whose files all match
    a non-rendering allowlist:
    - `**/*.md`, except `examples/**`
    - `docs/**`, `.changeset/**`, `openspec/**`
    - `tests/unit/**`
    - `LICENSE`, `.github/dependabot.yml`

    On `push` it is always `true`. No third-party action is used.

  - `browser-shards` matrix, with `PW_BLOB=1`, `if: needs.changes.outputs.rendered == 'true'`:
    - shard `chromium 1/2`: `--project=chromium --shard=1/2`, installs chromium only
    - shard `chromium 2/2`: `--project=chromium --shard=2/2`, installs chromium only
    - shard `firefox+webkit`: `--project=firefox --project=webkit`, installs those two

    Each shard uploads `blob-report/`. Do not cache browsers (L3: the docs advise against it, and
    install takes 0.7 min).

  - A `merge-report` job (`if: always()` after the shards) runs
    `pnpm exec playwright merge-reports --reporter html ./all-blob-reports` (L3) and uploads
    `playwright-report/`.
  - A gate job named `browsers` (`if: always()`, needs `changes` and the shards):
    - fails if any shard result is `failure` or `cancelled`
    - passes if the shards succeeded, or were skipped because `rendered == 'false'`

    It keeps the existing required-check name. A skipped job reports success to branch protection,
    but a workflow skipped by `paths` stays pending, which is why no `paths` filter is used (L1).
- Checks:
  - `["pnpm", "exec", "prettier", "--check", ".github/workflows/ci.yml"]`
  - `["node", "--input-type=module", "-e", "import {parse} from 'yaml'; import {readFileSync} from 'node:fs'; parse(readFileSync('.github/workflows/ci.yml','utf8'));"]`
- Proof: the PR's own CI run. Expect 3 shards, the merged report and the gate. Add one docs-only test
  PR where the gate passes while the shards are skipped.
- Optional S2b: `timeout-minutes: 60` on the release job (`release.yml:21`). Same token, risk
  medium.

### S3: worker count experiment (after S2)

- Raise `workers` on CI from 2 to 3 or 4 (`playwright.config.ts:17`). Public runners have 4 vCPU
  (L2). Keep the change only if shard time drops and no visual test turns flaky over 5 runs.
  Owner decision. Risk: medium (flakiness).

### S4: measurement record (after S2 has been on develop for 2 days)

- Role: doc-steward. Risk: low. Owns `docs/agent-work/ci-speed/measurement.md`.
- Metrics: the same set before and after.
  - Median and peak PR run wall time
  - Runner-minutes per run (the sum of job durations)
  - PR runs per 2 days, and runs cancelled by concurrency
  - Per shard: install time and test time
  - PR runs whose shards were skipped
- Source (run by the owner, since workers have no run-list operation):
  - `gh run list --workflow CI --event pull_request --limit 100 --json databaseId,startedAt,updatedAt,conclusion`
  - `gh api repos/javiercavlop/pricing-renderer/actions/runs/<id>/jobs` for job timings
- Expected effect: an estimate to confirm. Wall time should fall to about 6-8 min, because the
  chromium shards bound it. Runner-minutes per run may rise by about 2-3 min, because each shard
  repeats install and build. Concurrency cancels and docs-only skips should lower the total per day.

## Questions for the owner

- Q1: which checks are required in branch protection for `develop` and `main`? The plan assumes
  `browsers`, `quality (22)` and `quality (24)`.
- Q2: approve S2, and push it with a Workflows: write token. Same question for S2b on
  `release.yml`.
- Q3: the `maxFailures` value (20 proposed, or 0 for none), and the S3 worker count.
- Q4: are 12.2 min the mean or the median of `test:browser`, and what is the run id of the 69 min
  peak?
- Q5 (coordinator and owner): P-LAB option A or B, and chromium only or all three engines.

## Lookups (external facts)

- L1: GitHub docs. A job skipped by `if:` is marked skipped, and required checks accept
  `skipped`. A workflow skipped by path filtering leaves its checks pending and blocks merging. The
  default `timeout-minutes` is 360. Sources:
  - docs.github.com workflow-syntax
  - docs.github.com about-protected-branches
  - docs.github.com skipping-workflow-runs
  - docs.github.com actions limits
- L2: on public repositories, the GitHub-hosted ubuntu runner has 4 vCPU, 16 GB RAM and a 14 GB
  SSD, and standard runners are free and unlimited. Source: docs.github.com github-hosted-runners.
- L3: Playwright docs.
  - With `fullyParallel`, shards split individual tests. Shards are merged with the `blob` reporter
    and `merge-reports`. Shard weights are not documented.
  - `globalTimeout` defaults to 0, which means no limit.
  - `retain-on-failure` records every test; `on-first-retry` is recommended on CI.
  - Caching browser binaries is not recommended.

  Sources: playwright.dev test-sharding, class-testconfig, trace-viewer and ci.

- L4: browser and image sizes. Low confidence, estimates. Sources:
  - playwright.dev/docs/browsers
  - the playwright-core `browsers.json` on GitHub
  - third-party image listings
- L5: `--ignore-snapshots` exists. The docs do not say whether `--list` needs browsers or the
  `webServer`, or whether `maxFailures` counts flaky tests. Source: playwright.dev test-cli and
  class-testconfig.
