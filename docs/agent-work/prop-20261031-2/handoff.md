# Handoff: prop-20261031-2

- Status: waiting-review (intake done; needs owner CRP-DISPATCH and the D1 probe) · Updated: 2026-11-01
- Branch / head: task/553d6314609544d5 / base `a82cd88` · PR: none

## Goal

Record one verified answer to "can `on-demand-specs` be dispatched on `develop` before the
release?". If it cannot, record the owner's fallback. This unblocks N-CI (`pending-phases/plan.md:581-585`),
M1 (`plan.md:364-373`) and the O1 re-measure (INTENT O1).

## State (with evidence)

- Intake written: `docs/agent-work/prop-20261031-2/intake.md` (slices D0, D1, D2 and conditional F1;
  gates; CRP-DISPATCH).
- No code changed. No check registered or run for this task.
- Proposal evidence E1-E7 reproduces at `a82cd88`. E8 (`playwright.config.ts:14-16`) is partly right:
  the flag is read at `:15-18`.
- Lookup (medium confidence): the default branch is `main`. `main`'s `ci.yml` has no
  `workflow_dispatch` and no `on-demand-specs`; `develop`'s `ci.yml` has both. Sources are in the
  intake, F-A.
- Lookup (low confidence): whether `gh workflow run ci.yml --ref develop` is accepted in that case
  is undocumented. Community reports lean towards success (intake F-C).

## Decisions

- The probe is the CLI or API dispatch, not the Actions tab. Reason: the GitHub docs say the "Run
  workflow" button needs the `workflow_dispatch` trigger, and `main`'s file has none (intake E4, F-B).
- The probe is an owner action. Reason: the repo tool has no dispatch operation, and the lab has no
  browsers (`o1-remeasure.md:17`).
- The fallback measuring PR, if needed, widens `if:` at `ci.yml:331` to `pull_request`, instead of
  setting `PW_UX_STRESS=1` on a shard. Reason: shards have a 15 min global timeout
  (`playwright.config.ts:6-8`) and a 25 min job timeout (`ci.yml:147`), they split tests, and they
  feed the required gate.
- No feature flag and no OpenSpec requirement. Reason: no behaviour changes.

## Ruled out

- Agent dispatch, and a lab run of the specs: no tool for the first, no Playwright browsers for the
  second (intake F-E).
- The Actions-tab dispatch: the button does not appear while `main` lacks the trigger (intake F-B).

## Open questions and risks

- CRP-DISPATCH (options A-D, A recommended). Waiting on the owner via CRP. It blocks D1 and D2.
- Q2: does a successful probe also count as P-20261027-2 S2 or M1? Coordinator decision;
  recommended no.
- Q3: close CRP QA of P-20261027-2 with CRP-DISPATCH. Coordinator decision; recommended yes.
- Risk: D2 and P-20261027-2 S1 both own `docs/agent-work/ci-speed/on-demand-specs.md`. Mitigation:
  serialize them.
- Risk: F-A and F-C come from lookups. Mitigation: D2 cites the real run or error, not the lookups.

## Next three steps

1. The coordinator sends CRP-DISPATCH (intake, "Open questions") to the owner.
2. The owner runs `gh workflow run ci.yml --repo javiercavlop/pricing-renderer --ref develop` and
   reports the run URL or the exact error text.
3. The doc-steward does D2 and owns `docs/agent-work/ci-speed/on-demand-specs.md`: a "Dispatch status"
   section and a corrected "How to trigger" (`:38-47`). If the probe was refused and the owner chose
   B, the pr-steward opens F1 as a draft PR that is never merged.

## Evidence

- Tasks: this intake task (`553d6314609544d5`) · Heads: `a82cd88` · CI: no run used.
- Lookups: GitHub docs on `workflow_dispatch`; the repository's default branch and `main` or
  `develop` `ci.yml`; community reports on `--ref` dispatch. URLs are in intake E4, F-A and F-C.
