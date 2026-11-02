# Intake: P-20261031-2, can `on-demand-specs` be dispatched, and the fallback if not

- Origin: proposal P-20261031-2 (kind research, size S, risk low), approved by the owner. Planner
  intake, 2026-11-01.
- Base: HEAD `a82cd88` of the task branch `task/553d6314609544d5`. Every `file:line` below is at this
  base.
- INTENT link: O1, "real-world Pricing2Yaml pricings render legibly" (`INTENT.md`, section "O1").
  The CI side also concerns O4 (supply-chain and CI health), because a fallback may touch `.github/`.
- No code, no release, no changeset.

## Verification of the proposal's evidence

Status: R = reproduces, P = partly, N = does not reproduce.

- E1, 97 of 111 pairs have no value. **R.** `docs/agent-work/visual-review-spectra/o1-remeasure.md:6-8`
  (14 of 111 measured) and `:158-159`.
- E2, M1 gates UX-3 to UX-11 and needs one dispatch. **R.** `docs/agent-work/pending-phases/plan.md:364-373`
  ("Blocked by N-CI if a dispatch is not possible", `:373`) and `:487`.
- E3, the job runs only on `workflow_dispatch`. **R.** `.github/workflows/ci.yml:330-331`. The trigger
  is in `on` at `ci.yml:12`.
- E4, a dispatch needs the workflow on the default branch. **R.** `ci.yml:325-326`;
  `docs/agent-work/ci-speed/on-demand-specs.md:45-47`. The GitHub docs say: "To trigger the
  `workflow_dispatch` event, your workflow must be in the default branch." They also say: "To see the
  **Run workflow** button, your workflow file must use the `workflow_dispatch` event trigger." (lookup,
  medium confidence; sources:
  https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-workflow-runs/manually-running-a-workflow,
  https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows).
- E5, no release to `main`. **R.** `ROADMAP.md:139-148` ("no release PR to main", `:147`).
- E6, P-20261027-2 is parked on CRP QA, and its S1 never landed. **R.**
  `docs/agent-work/prop-20261027-2/handoff.md:3,41-42`. A grep for `SPECTRA_METRICS_LOG` matches only
  `docs/agent-work/prop-20261027-2/` and nothing in `tests/`.
- E7, the same blocker is N-CI. **R.** `plan.md:581-585`.
- E8, the measuring-PR alternative cites `playwright.config.ts:14-16`. **P.** The flag is read at
  `playwright.config.ts:15-18`. Setting it on a shard has costs the proposal does not list (F1 below).

New facts, not in the proposal. They come from lookups against the public repository and were not
read in this worktree:

- F-A. The default branch is `main`. `main`'s `ci.yml` has `on: pull_request` and `push: branches:
  [main]` only, the jobs `quality` and `browsers`, and **no `workflow_dispatch` and no
  `on-demand-specs`**. `develop`'s `ci.yml` has both, which matches this worktree (`ci.yml:3-12,330`).
  Sources: https://github.com/javiercavlop/pricing-renderer,
  https://raw.githubusercontent.com/javiercavlop/pricing-renderer/main/.github/workflows/ci.yml,
  https://raw.githubusercontent.com/javiercavlop/pricing-renderer/develop/.github/workflows/ci.yml
  (medium confidence; the files were read through a summarizing fetch, not byte for byte).
- F-B. So the **Actions-tab path will not work**. By E4 the "Run workflow" button needs the trigger in
  the file GitHub shows, and `main`'s file has none. The proposal's first alternative ("from the
  Actions tab") and `on-demand-specs.md:42` describe a path that is not available today.
- F-C. **Whether a CLI or API dispatch works is undocumented.** That means
  `gh workflow run ci.yml --ref develop`, which is REST `createWorkflowDispatch` with `ref: develop`.
  The docs do not say which ref's copy of the file must carry the trigger. Community reports lean
  towards success when the file exists on the default branch, even without the trigger there. No
  report covers this exact case, and one source disagrees (lookup, low confidence; sources:
  https://github.com/orgs/community/discussions/169535, https://github.com/cli/cli/issues/9781,
  https://github.com/orgs/community/discussions/8140, https://github.com/github/gh-aw/issues/72647).
  Only one real attempt settles it. That attempt is this proposal's probe.
- F-D. The first page of Actions runs (25 of 284) shows only `push` and `pull_request` events
  (lookup, medium confidence). So no earlier dispatch is known, but the later pages were not checked.
- F-E. No agent can dispatch. The repo tool has `push`, `pr_*`, `ci_status` and `ci_log`, and no
  dispatch operation. The lab has no Playwright browsers (`o1-remeasure.md:17`). The probe is an
  owner action.

## Objective

Record one verified answer to "can `on-demand-specs` be dispatched on `develop` today?". If the
answer is no, record the owner's chosen fallback. The answer goes into
`docs/agent-work/ci-speed/on-demand-specs.md`, where N-CI (`plan.md:581-585`) and CRP QA of
P-20261027-2 can cite it.

## Scope

- One decision request to the owner (CRP-DISPATCH, below) that asks for the CLI probe first.
- The owner's probe and its result: a run URL, or the exact error text.
- One docs slice that records the result and corrects the trigger instructions in
  `on-demand-specs.md:38-47`.
- Only if the probe fails and the owner picks it: one never-merged measuring PR (F1).

## Non-goals

- Reading or recording the measurements: O1 re-measure (P-20261027-2 S3) and M1 (`plan.md:364-373`).
  This intake only unblocks them.
- P-20261027-2 S1 (`SPECTRA_METRICS_LOG`) and the 1500-line limit of `ci_log` (`o1-remeasure.md:158-159`).
- Any merged change to `.github/workflows/ci.yml`, `release.yml` or `playwright.config.ts`.
- Any PR, push or release to `main`. That needs an explicit owner decision (option D of the CRP).
- `--max-failures=0` on the dispatch step (CRP QB of P-20261027-2).

## Slices

Order: D0, then D1, then D2. F1 exists only if D1 fails and the owner chooses option B. Owned
files are disjoint. D2 shares `on-demand-specs.md` with P-20261027-2 S1
(`prop-20261027-2/handoff.md:56-57`), so the coordinator serializes those two.

### D0. Decision request CRP-DISPATCH (coordinator; no diff)

- Send the CRP in "Open questions" to the owner. Budget: a single message.
- Risk low (score 0): it only asks a question.

### D1. Owner probe (owner; no diff)

- Command, from a clone with `gh` authenticated as a user with write access:
  `gh workflow run ci.yml --repo javiercavlop/pricing-renderer --ref develop`. Then run
  `gh run list --workflow ci.yml --event workflow_dispatch --limit 1`.
- Expected outcomes:
  - Accepted. A run of `ci.yml` with event `workflow_dispatch` on `develop` appears, and its
    `on-demand-specs` job starts. Report the run URL. The job takes up to 50 min (`ci.yml:333`). The
    dispatch also runs the shards and the gate (`on-demand-specs.md:82-86`), so it costs runner time.
  - Refused. Typical forms are HTTP 422 "Workflow does not have 'workflow_dispatch' trigger" or
    HTTP 404 "could not find any workflows". Report the exact text.
- Run it as soon as the CRP is answered. There is no need to wait for P-20261027-2 S1 or U1b. The
  probe answers the fact. Its log tail is useful but incomplete (`o1-remeasure.md:158-159`).
- Agent check afterwards: `repo ci_status` with `args.sha` = the `develop` head the run used. It
  lists the check runs of that commit, including the dispatch ones.
- Risk low (score 0): it changes nothing in the repository.

### D2. Record the outcome (doc-steward; docs only)

- Depends on: D1 answered (or the owner choosing C or D without a probe).
- Owns: `docs/agent-work/ci-speed/on-demand-specs.md`.
- Read-only: this intake, the CRP answer, `ci.yml:320-358`, `plan.md:581-585`,
  `prop-20261027-2/intake.md:189-195`.
- Content:
  - A section "Dispatch status" with the date, the `develop` head, the command, the result (run URL
    or error text) and the CRP answer id.
  - "How to trigger" (`:38-47`) corrected. The Actions-tab button needs the trigger on `main`
    (F-A, F-B). Write down which path works, if any.
  - If refused: the chosen fallback and who acts next.
- Expected diff: about 20-35 lines.
- Checks: the task contract registers them. Suggested:
  `["pnpm", "exec", "prettier", "--check", "docs/agent-work/ci-speed/on-demand-specs.md"]`.
- Risk low (docs only, score 0). Budget 15 turns.

### F1. Measuring-only PR (pr-steward plus the owner; conditional; never merged)

- Only if D1 is refused and the owner picks option B.
- Owns: `.github/workflows/ci.yml` on a throwaway branch only.
- Recommended form, a one-line change in a draft PR into `develop`. `pull_request` runs only for
  PRs into `main` or `develop` (`ci.yml:4-7`):
  `if: github.event_name == 'workflow_dispatch' || github.event_name == 'pull_request'` at
  `ci.yml:331`. A `pull_request` run uses the PR's copy of the workflow, so the existing job runs
  with its own budget (40 min global timeout, 50 min job timeout, `ci.yml:333,350`). It is outside
  the `browsers` gate (`ci.yml:320-324`).
- Not recommended: the proposal's form (`PW_UX_STRESS=1` on one shard). Shards use blob reporting
  with a 15 min global timeout (`playwright.config.ts:6-8`) and a 25 min job timeout
  (`ci.yml:147`). Each chromium shard runs only half the tests (`--shard=1/2`, `ci.yml:156,160`).
  The heavy specs would then go into the required `browsers` gate.
- `docs/agent-work/ci-speed/simulate-ci.sh:341-353` asserts that no other job sets `PW_UX_STRESS`
  and checks the `if:` wiring. Either form breaks that local guard. It is not run in `ci.yml` (grep
  `simulate-ci`: no match), so the PR's CI does not fail on it.
- Close the PR without merging after the run. Its branch must never reach `develop`.
- Risk **medium**, score 3: CI config +3, as scored for S4 of P-20261027-2
  (`prop-20261027-2/handoff.md:29-30`). It is never merged, and the owner approves it. Budget
  10 turns.

## Gates per slice

| Gate | D0 | D1 | D2 | F1 |
|---|---|---|---|---|
| G1 openspec validate --strict | N/A | N/A | N/A unless the coordinator opens a change | N/A |
| G2 EPIC | N/A | N/A | N/A | N/A |
| G3 red before | N/A | N/A | N/A (docs) | N/A |
| G4 frozen tests | N/A | N/A | N/A | N/A |
| G5, G7, G10 | registry | registry | registry | registry |
| G6 trace | N/A | N/A | N/A (no requirement id) | N/A |
| G8 mutation | N/A | N/A | N/A | N/A |
| G9 dependencies | N/A | N/A | N/A | N/A (no new action or version) |
| G11 review | N/A | N/A | one reviewer | owner approval; never merged |
| G12 ui-qa | N/A | N/A | N/A | N/A |
| G13 | N/A | N/A | how-to-review: compare the run URL or error with the recorded text | how-to-review: the run's `on-demand-specs` job |

"Registry": this intake did not read where G5, G7 and G10 are defined. The coordinator applies its
own registry.

## Feature flags

None. `PW_UX_STRESS=1` already exists (`playwright.config.ts:15-18`). No slice adds behaviour.

## Risks

- R1. The probe succeeds, but the log tail is not enough to read the metrics
  (`o1-remeasure.md:158-159`). Mitigation: that belongs to P-20261027-2 S1 and S3, not here. D2
  records only that a dispatch works.
- R2. A dispatch on `develop` runs every CI job (`on-demand-specs.md:82-86`). It costs about one
  extra full run of runner time. Mitigation: one probe only.
- R3. The run stops after 20 failed tests (`playwright.config.ts:38`), so a red on-demand job still
  proves that the dispatch works. Mitigation: D2 records the job result separately from the dispatch
  result.
- R4. D2 and P-20261027-2 S1 both own `on-demand-specs.md`. Mitigation: the coordinator runs them
  one after the other.
- R5. F-A and F-C rest on lookups of medium and low confidence. Mitigation: D1 is the real test.
  D2 cites the run, not the lookups.

## Open questions

- **CRP-DISPATCH (owner).** "Can `on-demand-specs` run before the release?" Evidence: E3-E5, F-A to
  F-C. Options:
  - (A) **Recommended.** The owner runs the D1 command once on `develop` now and reports the run URL
    or the error text. It costs one run of runner time and changes nothing.
  - (B) If (A) is refused, approve F1: one draft PR into `develop` that changes `ci.yml:331` and is
    never merged.
  - (C) Wait for the release. M1, UX-3 to UX-11 and the O1 re-measure stay blocked until then
    (`ROADMAP.md:141-146`).
  - (D) Land only the `ci.yml` of `develop` on `main` ahead of the release. Not recommended. It
    conflicts with "no release PR to main" (`ROADMAP.md:147`), and `main`'s `ci.yml` is a different,
    older file (F-A).
  - The owner runs Playwright locally, without CI. That gives values, but not the CI fact, and N-CI
    stays open.
- Q2 (coordinator, no CRP). If (A) succeeds, does the same run also count as P-20261027-2 S2 and
  the M1 run? The coordinator decides. Recommended: no. P-20261027-2 S1 and U1b are not merged, so a
  new run after them is needed anyway (`plan.md:487`).
- Q3 (coordinator). Should P-20261027-2's CRP QA (`prop-20261027-2/intake.md:189-195`) be closed by
  CRP-DISPATCH? Recommended: yes. QA asks the same question, and F-A answers its first half.
