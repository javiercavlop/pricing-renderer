# Intake: P-20261027-2, full SPECTRA O1 metrics from one on-demand CI run

- Proposal: P-20261027-2 (kind dx, size S, risk low, owner-approved). Planner intake, 2026-10-27.
- Base: `595ad24` (task branch `task/70ea4da45bdd4b79`).
- INTENT link: objective **O1, "real-world Pricing2Yaml pricings render legibly"** (`INTENT.md:26`).
  The decided thresholds are at most 5 screens at 1440 px (`INTENT.md:34`) and the CTA in the first
  screen at 1440 and 375 px (`INTENT.md:37-38`). The lone-card signal "needs a new measurement"
  (`INTENT.md:39-41`). The expanded height (O2, `INTENT.md:58-60`) comes from the same lines.

## Objective

Get the O1 signals (height, CTA, lone last card, truncation and breaks) for all 111 light `en`
pricing x viewport pairs (37 fixtures x 3 viewports) from one manual dispatch of `ci.yml`, readable
through `ci_log`, and record them in `docs/agent-work/visual-review-spectra/o1-remeasure.md`.
Today that file covers 14 of 111 pairs (`o1-remeasure.md:6-8`).

## Scope

- `tests/browser/spectra-review.spec.ts`: print the `SPECTRA_METRICS` JSON line only when an
  environment variable asks for it. Keep the `SPECTRA_SUMMARY` line and the JSON attachment as
  they are (`spectra-review.spec.ts:413-420`).
- After an owner dispatch: record the 111 light `en` pairs in `o1-remeasure.md`.

## Non-goals

- No renderer change: nothing under `src/`, styles, the demo, the package or the public API.
- No new threshold or assertion. Thresholds not yet decided stay with the owner (`INTENT.md:98`).
- No change to the `SPECTRA_SUMMARY` format, to the attachments or to the screenshots.
- No `.github/` change in the planned slices. The optional `--max-failures=0` (S3) is the owner's
  call, and the owner applies it (Workflows token).
- No `INTENT.md` or `ROADMAP.md` edit. Updating `INTENT.md:39-41` after the measurement is a
  coordinator decision.
- No `acceptance/**`, no `openspec/specs/**`. No changeset: no published file changes.

## Verified facts (and corrections to the proposal)

- Output today: each `report()` call prints two lines, `SPECTRA_SUMMARY` and
  `SPECTRA_METRICS <json>`, and attaches the JSON (`spectra-review.spec.ts:413-420`). The summary line already
  carries every O1 field: `screens=` (`:398`), `xscreens=` (`:400`), `cards=<n>/<per row>`
  (`:402`), `fv=<cards>/<price>/<cta>` (`:404`), `trunc=` and `breaks=` (`:406-407`). Leaving the
  JSON out of the log therefore removes no O1 value from the log.
- Volume per run, counted from the spec: the "spectra metrics" describe has 37 x 3 = 111 tests,
  one `report()` each (`:501-529`). There are 37 fixture directories under
  `tests/fixtures/spectra/`. "spectra captures" runs 8 extremes (`:39-48`) x 3 viewports, with 3
  variants at 1440 and 375 and 1 at 1024 (`:626-634`), so 8 x 7 = 56 `measure()` calls
  (`:642-649`). That is 167 `report()` calls, so **334 SPECTRA lines today and 167 without the
  JSON line**, before retries. `ux-stress.spec.ts:226` adds one `SPECTRA_UX_SUMMARY` line per
  test (6 tests, `docs/agent-work/ci-speed/on-demand-specs.md:12`).
- Correction: the 1500-line limit was hit in the `browsers` job, which ran every browser spec
  (`o1-remeasure.md:12-21`). The on-demand job runs only `ux-stress.spec.ts` and
  `spectra-review.spec.ts` on chromium (`ci.yml:299-302`). Even without S1, about 340 test-output
  lines may fit in a 1500-line tail. This is an estimate: no dispatch run exists to check it. The
  install steps come before the tests (`ci.yml:297-298`), so they are not in the tail. The upload
  step and cleanup come after (`ci.yml:303-310`), and the dot reporter prints its failure details
  at the end, so a run with failures uses more of the tail. S1 halves the SPECTRA lines and keeps
  room for that. The proposal says this alternative is "not verified", and that is still true.
- Stdout does reach the log. The CI reporters are `html` and `github` (`playwright.config.ts:9-12`).
  Neither prints test stdout. When no reporter prints to stdio, Playwright 1.55 puts a `dot`
  reporter first on CI, and `dot` prints test stdout. Sources (lookup, confidence medium):
  `microsoft/playwright` v1.55.0 `packages/playwright/src/runner/reporters.ts`,
  `src/reporters/github.ts`, `src/reporters/dot.ts`. The old `browsers` log held the SPECTRA lines
  (`o1-remeasure.md:18`), which fits this.
- Dispatch: `on-demand-specs` runs only on `workflow_dispatch` (`ci.yml:282-283`), sets
  `PW_UX_STRESS: '1'` (`ci.yml:300-301`) and uploads `on-demand-specs-report` (14 days,
  `ci.yml:303-310`). It is not in `needs` of `browsers` (`ci.yml:274-276`). GitHub accepts a
  dispatch only when the file is on the default branch (`ci.yml:277-278`, R2-REV-004 in
  `docs/agent-work/ci-speed/review-round2.md:57-59`). Which branch is the default is not verified
  here.
- Stop after 20 failures: on CI `maxFailures` is 20 and `retries` is 2 (`playwright.config.ts:35,38`).
  The dispatch step does not override them (`ci.yml:302`, R3-REV-002 in
  `docs/agent-work/ci-speed/review-round3.md:41-44`). A metrics test reports before its assertions
  (`spectra-review.spec.ts:516` before `:523-525`). So a failing test still prints its line, but
  up to 3 times, and after 20 failed tests the remaining pairs are not run.
- Name clash to avoid: `SPECTRA_METRICS_OUT` is already the unit test's output variable
  (`tests/unit/spectra-layout-metrics.test.ts:246,284`). The new variable needs another name.
- Lint: `no-console` warns on `console.log` and allows `info`, `warn` and `error`
  (`eslint.config.js:30`). The spec disables the rule on each line (`spectra-review.spec.ts:414,417`).
  Other specs use `console.info` (`ux-stress.spec.ts:226`).
- Nothing in the repository parses `SPECTRA_METRICS` from a log. The grep for `SPECTRA_METRICS` and
  `SPECTRA_SUMMARY` matches only the spec, the unit test's `_OUT` variable and docs.
  `docs/agent-work/ci-speed/on-demand-specs.md:71-72` describes the JSON line in the log, so S1
  updates that sentence.
- Test count: my count of the current spec is 140 tests (111 + 3 at `:565-615` + 24 + 2 yearly at
  `:657-681`). `on-demand-specs.md:7` records 137. The difference is not investigated, and it does not
  change the plan.
- Proposal evidence checked: `ci.yml:272-310`, `spectra-review.spec.ts:413-419`,
  `o1-remeasure.md:6-8,158-164` and `INTENT.md:39-41` match. R3-REV-001 is about the 40 min
  exception in `slow-runs.md` (`review-round3.md:39-40`), not about the log. The related point is
  R3-REV-002 (`review-round3.md:41-44`).

## Slices

One capability: a readable full measurement. S1 is code (about 10-20 diff lines), S2 is an owner
action, and S3 is docs. No feature flag: nothing is user-visible, and S1 is complete alone. The
environment variable is a log switch, not a feature flag.

### S1: print `SPECTRA_METRICS` only on request

- Role: implementer (default model and effort). Turn budget: 25.
- Owns: `tests/browser/spectra-review.spec.ts`, `docs/agent-work/ci-speed/on-demand-specs.md`.
- Read-only context: `playwright.config.ts`, `.github/workflows/ci.yml`, `eslint.config.js`,
  `tests/unit/spectra-layout-metrics.test.ts`, this intake.
- Content:
  1. In `report()` (`spectra-review.spec.ts:413-420`), print `SPECTRA_METRICS <json>` only when
     `process.env.SPECTRA_METRICS_LOG === '1'` (name proposed, it must not be `SPECTRA_METRICS_OUT`).
     The summary line and `testInfo.attach` stay unconditional and unchanged.
  2. Optional: switch both lines to `console.info` and drop the two `eslint-disable` comments
     (`eslint.config.js:30`). The format does not change.
  3. Add a comment above `report()` naming the variable and saying that the full JSON is always
     in the HTML report attachment.
  4. `on-demand-specs.md:71-72`: the JSON line is printed only with the variable set, and the
     attachment always exists.
- Requirement id: the coordinator decides whether the change carries one (e.g.
  `req~spectra-metrics-log-opt-in~1`). If so, S1 tags `report()` with `[utest->...]`.
- Size: about 10-20 lines. Risk: **low**, score 0 (tests and docs only -2, floor 0). This agrees
  with the proposal.
- Checks (worker, local; workers have no Playwright browsers, `o1-remeasure.md:17`):
  - `["pnpm", "install", "--frozen-lockfile"]`
  - `["pnpm", "exec", "eslint", "tests/browser/spectra-review.spec.ts"]`
  - `["pnpm", "exec", "prettier", "--check", "tests/browser/spectra-review.spec.ts", "docs/agent-work/ci-speed/on-demand-specs.md"]`
  - `["pnpm", "exec", "playwright", "test", "--list", "--project=chromium", "tests/browser/spectra-review.spec.ts"]`
    (transpiles the spec. Confirm when registering that `--list` starts no browser and no
    `webServer`.)
- Change-level proof: the PR `browsers` gate stays green. It does not run this spec
  (`playwright.config.ts:15-18`), so the behaviour proof is S2's dispatch log.
- Depends on: nothing. Order: first.

### S2: owner dispatch (no diff)

- Role: owner. Prerequisite: CRP QA (default branch) is answered, and S1 is merged into develop.
- Action: `gh workflow run ci.yml --ref develop`, or Actions > CI > Run workflow (`ci.yml:276-277`).
  The owner gives the run id to the coordinator.
- If the coordinator wants proof before S1, S2 can also run once before it (see QC).

### S3: record the 111 pairs (docs)

- Role: doc-steward. Turn budget: 30. Starts after S2's `on-demand-specs` job has finished.
- Owns: `docs/agent-work/visual-review-spectra/o1-remeasure.md`.
- Read-only context: `report.md` (old values), `INTENT.md:26-44`, this intake.
- Content: read the job with `ci_status` and `ci_log` (`lines: 1500`). Count the light `en`
  `SPECTRA_SUMMARY` lines. Rewrite the coverage, signal 1-4 tables and summaries over all pairs
  found, and set the thresholds against them: 1440 at most 5 screens, CTA at 1440 and 375. Name
  the run id, the head SHA and the coverage line. If fewer than 111 light `en` pairs are in the tail
  or in the run (failures, `maxFailures`), record the exact count and the missing pairs, and do not
  extrapolate.
- Risk: **low**, score 0 (docs only).
- Checks: `["pnpm", "install", "--frozen-lockfile"]`,
  `["pnpm", "exec", "prettier", "--check", "docs/agent-work/visual-review-spectra/o1-remeasure.md"]`.

### S4 (optional, owner only): `--max-failures=0` on the dispatch step

- Only if S2 stops at 20 failures, or if the owner wants it beforehand (QB).
- Owns: `.github/workflows/ci.yml` (step at `:302`) and `docs/agent-work/ci-speed/simulate-ci.sh`,
  which asserts that step's run string (`on-demand-specs.md:90-95`), plus `on-demand-specs.md:61-65`
  (after S1, in sequence).
- Risk: **medium**, score 3 (CI configuration +3). Needs the owner's Workflows token.

Ownership: S1 owns the spec and `on-demand-specs.md`, and S3 owns `o1-remeasure.md`. The two are
disjoint, but S3 depends on S1 and S2 for its data, so the order is S1, S2, S3. S4 runs after S1,
because it shares `on-demand-specs.md`.

## Gates per slice

As in `prop-20261026-2/intake.md:155-157`, I found no definition for G5 or G7 in the skills I read.
The coordinator maps them.

| Gate                     | S1                                     | S3                         |
| ------------------------ | -------------------------------------- | -------------------------- |
| G1 openspec validate     | change level                           | change level               |
| G2 EPIC review           | if a requirement is added              | N/A                        |
| G3 red-before            | N/A (log switch, no failing behaviour) | N/A                        |
| G4 acceptance freeze     | N/A unless tests are requested         | N/A                        |
| G5, G7                   | not defined, coordinator maps          | same                       |
| G6 trace                 | if a requirement is added              | N/A                        |
| G8 mutation              | N/A (test code)                        | N/A                        |
| G9 dependency/licence    | N/A                                    | N/A                        |
| G10 secrets              | if registered                          | if registered              |
| G11 review (1 reviewer)  | JSON still attached, summary unchanged | numbers against the run id |
| G12 ui-qa                | N/A                                    | N/A                        |
| G13 how-to-test / review | N/A, how_to_review                     | N/A, how_to_review         |

S2 has no gates (owner action). S4: G10 and G11 with the CI wiring simulation, review panel for
medium risk.

## Open questions

These need a CRP (owner):

- QA. Which branch is the repository's default, and does its `ci.yml` have `workflow_dispatch` and
  `on-demand-specs`? If it is `main` and `main` lacks them, no dispatch is possible until they reach
  `main`. A release is postponed (Q6), so S2 is blocked (R2-REV-004, `ci.yml:277-278`). Options:
  (a) default is develop, so dispatch as planned; (b) the owner lands `ci.yml` on main by the
  owner's route; (c) the owner runs the specs locally (`pnpm exec playwright test --project=chromium tests/browser/spectra-review.spec.ts`
  without `CI`, `playwright.config.ts:15-18`) and shares the summary lines.
- QB. Run S4 (`--max-failures=0`) before the first dispatch, or only if S2 stops at 20 failures?
  Recommendation: only if needed. It edits `.github/` (medium risk, owner token).

These go to the coordinator and are not owner decisions:

- QC. Whether S2 runs once before S1 to check the estimate. If all 111 light `en` lines are already
  in the tail, S1 is optional. The owner approved S1, so the plan keeps it.
- Requirement id and delta spec for S1 (G1, G2, G6).
- Whether a later docs task updates `INTENT.md:39-41` with the S3 result.
