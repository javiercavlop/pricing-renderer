# Intake: P-20261031-1, bring ROADMAP.md and INTENT.md up to date with the merged slices

- Origin: proposal P-20261031-1 (kind docs, size S, risk low), approved by the owner. Planner intake,
  2026-11-01.
- Base: HEAD `a82cd88` of the task branch `task/f6d83c6c2b364a17`. Every `file:line` below is at this
  base. The recent merge commits named below come from the branch log at this base:
  - `88f5141` "Docs: private pricings guide, pricing versions guide, theme builder section (#71)";
  - `07f10bf` "Tests: UX stress metric fix and unit-level UX counts; Phase 3 intake and plan (#72)";
  - `09363ed` "Spec: add-react-headless (core selection logic, search params, React hooks,
    provider, composition) (#73)";
  - `ee91c18` "Core selection logic and price stabilizer (Phase 3, P3-1T/P3-1I) (#74)".
- INTENT link: O1, "real-world Pricing2Yaml pricings render legibly" (`INTENT.md:26`), for the
  UX and phase rows. O3, "Pending changesets" (`INTENT.md:68-70`), for the count.
- No code, test, spec or changeset changes. No release.

## Verification of the proposal's evidence

Status: R = reproduces, P = partly, N = does not reproduce.

- E1, UX-1 and UX-2 are stale. **R.**
  - `ROADMAP.md:91-94` says "not started" for both. `ROADMAP.md:85` says "No proposal has started".
  - U1a is in the tree: `tests/fixtures/stress/metrics.ts:6` (`loneLastCard`),
    `tests/unit/ux-stress-metrics.test.ts:4-65`, and `tests/browser/ux-stress.spec.ts:3,242-244`
    (`firstCtaBottom`, `layoutBreakdown`, `loneLastCard`). This matches U1a in
    `docs/agent-work/pending-phases/plan.md:336-346`.
  - U1b is not in the tree. `measureText` is not used in `tests/browser/ux-stress.spec.ts` (grep).
    U1b is in `plan.md:347-358`. So UX-1 is partly done.
  - U2 is in the tree: `tests/unit/ux-counts.test.ts:138-149` prints the `UX_COUNTS` lines
    (`plan.md:359-363`). So UX-2 is done.
  - The commit is `07f10bf` (#72), according to its subject line. This intake did not check which
    commit added each file (no git access in this task). The doc-steward confirms it.
- E2, Phase 1b is stale. **R.** `ROADMAP.md:159` says "not started (intake only; waiting on the
  owner's answers)".
  - `docs/private-pricings.md` (B1) exists, with `.changeset/docs-private-pricings.md`.
  - `docs/pricing-versions.md` (B5) exists, with `.changeset/docs-pricing-versions.md`.
  - B0, B2a, B2b, B3a, B3b and B4 are not done. `docs/nextjs.md` does not exist (glob). The
    1b handoff still waits on CRP-1 and CRP-2 (`docs/agent-work/phase1b-private-pricings/handoff.md:3`).
  - The commit is `88f5141` (#71), according to its subject line.
- E3, Phase 1a leftover L2 is done. **R.** `docs/design-systems.md:215-219` has a "Theme builder"
  section. L2 is listed in `plan.md:76-78`. `ROADMAP.md:157-158` already says that Phase 1a is done
  and does not list L2, so no ROADMAP row changes. The slice may add `88f5141` as evidence.
- E4, Phase 3. **P: the proposal is already stale.**
  - `ROADMAP.md:164` says "not started" and gives no evidence line. Stale: **R**.
  - The intake and plan exist in `docs/agent-work/phase3-react-headless/` (`intake.md`, `plan.md`,
    `handoff.md`). **R.**
  - "PR 73 is open". **N.** At this base, `09363ed` is the merge of #73, the spec. `ee91c18` is the
    merge of #74, the first code slice (P3-1T/P3-1I). `.changeset/core-selection-logic.md` (minor)
    is in the tree.
  - The owner answered CRP-P3 A-D, according to `docs/agent-work/phase3-react-headless/plan.md:1`.
  - So Phase 3 is **in progress**: spec #73 and slice P3-1 #74 are merged. The next slices are listed
    in `openspec/changes/add-react-headless/tasks.md` (`phase3-react-headless/plan.md:1`).
- E5, changeset count. **P: the number has changed.**
  - The stale numbers are at `INTENT.md:68` ("45 ... at `52a31c8`"), `ROADMAP.md:142` and
    `ROADMAP.md:182` ("45 at `47a7b05`"). **R.**
  - The proposal counted 51. At `a82cd88`, the glob `.changeset/*.md` gives 53 files. Without
    `README.md`, that is **52**. The difference is probably `.changeset/core-selection-logic.md`
    from #74. This intake did not check that with git.
  - `a82cd88` is "Keep the local integrations develop does not have yet". So the task branch can
    differ from `develop`. The doc-steward counts on its own base and cites that sha.
- E6, a followup: `pending-phases/handoff.md:36-37` still lists CRP-P3 as open. **R.**
  - `docs/agent-work/pending-phases/handoff.md:36-37` names "the Phase 3 request text and CRP-P3".
  - Both are resolved: `phase3-react-headless/intake.md:6` has the request "in full", and
    `phase3-react-headless/plan.md:1` has the owner's CRP-P3-A..D answers.
  - `phase3-react-headless/handoff.md:15` also names `pending-phases/{plan,handoff}.md` as stale.
  - `pending-phases/plan.md:605` asks for this ROADMAP update as a followup.
- E7, not in the proposal: the title says "#69–#72". The evidence covers #71 and #72 only.
  - #70 is `enforce-load-limits` (`pending-phases/plan.md:4`). `ROADMAP.md` has no row for it, and the
    proposal adds none.
  - No file in `docs/`, `.changeset/`, `openspec/`, `ROADMAP.md` or `INTENT.md` names #69 (grep).
    It stays out of scope (Q1).
- E8, not in the proposal: UX-7 now has an approved proposal. `docs/agent-work/prop-20261101-1/intake.md:1-5`
  says that P-20261101-1 is approved and that the approval also answers CRP-U7. So
  "No proposal has started" (`ROADMAP.md:85`) is wrong for UX-7 too (Q2).

## Objective

Each ROADMAP row and the INTENT changeset signal match the merged state at the slice's base, and
each changed row cites its merge commit and PR.

## Scope

- `ROADMAP.md`:
  - `:85-86`: replace "No proposal has started" with the current fact. U1a and U2 are merged (#72,
    `07f10bf`). If Q2 is accepted, P-20261101-1 (UX-7) is approved with an intake.
  - `:91-92`, UX-1: partly done. U1a is merged (#72, `07f10bf`). U1b is not started, and the
    measurement run M1 waits for it (`pending-phases/plan.md:347-373`). This intake found no open PR
    for U1b. The proposal says "U1b open"; write that only if a PR number is verified (`ROADMAP.md:14-15`).
  - `:93-94`, UX-2: done. U2 is merged (#72, `07f10bf`), `tests/unit/ux-counts.test.ts`.
  - `:159-160`, Phase 1b: partly done. B1 and B5 are merged (#71, `88f5141`), and the rest waits on
    CRP-1 and CRP-2.
  - `:157-158`, Phase 1a: optionally add "L2 theme builder docs: #71, `88f5141`". The state stays
    done.
  - `:164`, Phase 3: in progress.
    - Spec: #73, `09363ed`, `openspec/changes/add-react-headless/`.
    - P3-1: #74, `ee91c18`.
    - Plan: `docs/agent-work/phase3-react-headless/`.
  - `:142`, in the "Release" decision: keep the owner's text "45 pending changesets (at `47a7b05`)",
    because it records what the decision carried. Append the current count as a separate
    clause: "N pending at `<sha>`" (decision D2).
  - `:182`, in the Backlog: replace "45 at `47a7b05`" with "N at `<sha>`".
- `INTENT.md:68-69`: replace "45 ... (at `52a31c8`)" with "N ... (at `<sha>`)".
- `docs/agent-work/pending-phases/handoff.md:36-37`: mark the Phase 3 request text and CRP-P3 as
  answered, and point to `phase3-react-headless/intake.md:6` and `plan.md:1`. Use a dated update
  line. Do not rewrite the whole handoff.
- In every item, N is the count of `.changeset/*.md` files other than `README.md` at the slice's base.
  `<sha>` is that base. Expected value: 52, as at `a82cd88`.

## Non-goals

- New ROADMAP rows, for example for #70 `enforce-load-limits`. New INTENT signals or thresholds.
- `INTENT.md` "Current focus" (`:114-127`). It is not cited by the proposal, so Phase 3 stays out
  of it (Q3).
- `INTENT.md:142-143` ("17 pending changesets"): it is a dated answer to Q6, and it stays.
- Rewriting `pending-phases/plan.md`. It is a dated audit at `85bb102` (`plan.md:4`).
- The stale "intake in progress" note for P-20261027-2 at `ROADMAP.md:76`. This intake did not
  verify it (followup).
- Any code, test, changeset, `openspec/**` or `acceptance/**` file. No release or version step
  (`ROADMAP.md:141-148`).

## Slices

### D1. ROADMAP and INTENT state refresh (doc-steward)

- The only slice. One PR into `develop`.
- Owns: `ROADMAP.md`, `INTENT.md`, and `docs/agent-work/pending-phases/handoff.md`.
- Read-only:
  - this intake;
  - `.changeset/*.md` (count only);
  - `docs/agent-work/pending-phases/plan.md`;
  - `docs/agent-work/phase3-react-headless/**`;
  - `docs/agent-work/prop-20261101-1/intake.md`;
  - `tests/unit/ux-counts.test.ts`, `tests/fixtures/stress/metrics.ts`,
    `tests/browser/ux-stress.spec.ts`;
  - `docs/private-pricings.md`, `docs/pricing-versions.md`, `docs/design-systems.md`.
- Before writing:
  - Confirm each merge sha and PR number from the git log of the base: `88f5141` #71, `07f10bf` #72,
    `09363ed` #73, `ee91c18` #74. Per `ROADMAP.md:14-15`, a PR number is written only when it is
    confirmed. Otherwise the row says "merged, PR not verified".
  - Recount the changesets on the base.
  - If the base has merges after `ee91c18` (for example P-20261101-1 or more Phase 3 slices), add
    the rows those merges change, with the same evidence rule.
- Requirement ids: none. This is a docs-only state refresh, with no behaviour and no OpenSpec
  requirement.
- Checks (factory:qa-checks):
  - `["pnpm", "install", "--frozen-lockfile"]`
  - `["pnpm", "run", "format:check"]`. This runs `prettier --check .` (`package.json:136`), and CI
    runs it too (`.github/workflows/ci.yml:45`). `ROADMAP.md`, `INTENT.md` and
    `docs/agent-work/pending-phases/` are not in `.prettierignore` (`.prettierignore:1-22`).
  - No test reads `ROADMAP.md` or `INTENT.md`: a grep of `tests/`, `scripts/`, `package.json` and
    `.github/` finds nothing. So `pnpm run test` is not needed.
- Expected diff: about 25-45 lines. ROADMAP about 20-35, INTENT about 2, pending-phases handoff
  about 3.
- Risk low, score 0. Docs only. No public API, no code, no external input, under 200 lines.
- Budget: 20 turns.
- Dependencies: none.

## Gates per slice

- G1, openspec validate --strict: N/A. There is no OpenSpec change or requirement. If the
  coordinator wraps the plan in an OpenSpec change anyway, G1 runs on that change id.
- G2, EPIC: N/A (no spec).
- G3, red before: N/A (no test).
- G4, frozen tests: N/A.
- G5, G7, G10: the coordinator's registry. This intake found no definition of them in the files it
  read.
- G6, trace: N/A (no requirement id).
- G8, mutation: N/A.
- G9, dependencies: N/A (no dependency change).
- G11, review: one reviewer. The reviewer checks each new state and sha against the git log and the
  tree.
- G12, ui-qa: N/A (no UI).
- G13: how-to-review. Read the ROADMAP rows UX-1, UX-2, Phase 1b and Phase 3, the Release and
  Backlog counts, and `INTENT.md:68`. Check each cited sha with `git show --stat <sha>`, and the
  count with `ls .changeset/*.md`.

## Feature flags

None. This is one docs slice with no behaviour.

## Decisions

- D1. One slice. The whole change is about 25-45 lines in three docs files. Splitting it would
  only create merge conflicts in `ROADMAP.md`.
- D2. Keep "45" in the owner's Release decision (`ROADMAP.md:142`) and append the current count.
  Reason: that line records what the owner decided on 2026-10-27. Changing the number there would
  rewrite the decision.
- D3. Phase 3 is "in progress", not "in progress (PR 73)". Reason: #73 and #74 are already merged
  at this base (E4).
- D4. The count is taken on the slice's own base. Reason: it changes with every merged code slice
  (E5), and the task base `a82cd88` can differ from `develop`.
- D5. The `pending-phases` handoff gets a dated update line, not a rewrite. Reason: the handoff is a
  dated record of its own task. The proposal asks only for the CRP-P3 entry.

## Risks

- R1. Drift returns with the next merge, because the Phase 3 and UX-7 slices are in flight.
  Mitigation: D4, and the slice adds any rows that merges after `ee91c18` change. A standing rule
  that every slice updates its own ROADMAP row is a followup.
- R2. A row could cite a wrong sha or PR. Mitigation: the doc-steward confirms each one from the git
  log (`ROADMAP.md:14-15`), and G11 checks it again.
- R3. A conflict with another open change that edits `ROADMAP.md`. Mitigation: the coordinator
  serializes owners of `ROADMAP.md`. This intake found no other open contract that names it.

## Open questions

No question needs a CRP. The owner's approval covers the `INTENT.md` edit (proposal: "Auto-start:
no ... it edits INTENT.md"). Questions for the coordinator:

- Q1. Does "#69–#72" in the title mean anything beyond #71 and #72? No file names #69, and #70
  has no ROADMAP row. Recommendation: no row for either.
- Q2. Should `ROADMAP.md:85-86` and the UX-7 row (`:107-109`) say "P-20261101-1 approved, intake
  written; the approval answers CRP-U7"? Recommendation: yes. It is in the same sentence that must
  change anyway, and the evidence is `prop-20261101-1/intake.md:1-5`.
- Q3. Should INTENT "Current focus" (`INTENT.md:127`) mention Phase 3 in progress? Recommendation:
  no, because the proposal limits INTENT to the count.
