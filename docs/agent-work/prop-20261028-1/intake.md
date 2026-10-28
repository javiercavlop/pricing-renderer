# Intake: P-20261028-1, bring ROADMAP.md and INTENT.md up to date (item 9, phases 0 and 2)

- Proposal: P-20261028-1 (kind docs, size S, risk low, owner-approved). Planner intake, 2026-10-28.
- Base: `9cf7e21` (task branch `task/f953231a382448f7`).
- INTENT link: **O1, "real-world Pricing2Yaml pricings render legibly"** (`INTENT.md:26`). Item 9
  is an O1 row (`ROADMAP.md:51-52`). The changeset count is an O3 signal (`INTENT.md:68`).
- `report.md` means `docs/agent-work/visual-review-spectra/report.md`.

## Objective

Make `ROADMAP.md` and `INTENT.md` match what is merged in `develop`. That covers item 9 (merged),
phase 0 and phase 2 (merged), and the real number of pending changesets. Proposers and planners work
from these two files. Today they would treat item 9 as open work, and INTENT still lists it as a
non-goal.

## Verified facts (file:line at `9cf7e21`)

- Commits (git log at the base): `3072086` "feat: comparison groups follow declared tags (SPECTRA
  item 9) (#62)", `2b79e45` "Phase 2: subscription-change flow (...) (#63)", `9cf7e21` "Phase 0:
  hygiene and bug fixes from the React/CSS audit (#64)".
- Item 9 is merged. `.changeset/spectra-item9-tags.md:1-5` exists. It describes the owner decision
  recorded at `ROADMAP.md:54-58` (no tags: one comparison with no headers; partly tagged: a final
  "Other features" group; fully tagged: unchanged).
- ROADMAP is stale on item 9. `ROADMAP.md:52` says "State: not started", and `:59-60` says "The
  state becomes done, with the PR number, after the merge".
- INTENT is stale on item 9:
  - `INTENT.md:99` lists the non-goal "Item 9 (group by tags) is dropped (Q4)".
  - `INTENT.md:123` says "Dropped: item 9, group by tags (Q4)".
  - `INTENT.md:134` records the Q4 answer of 2026-10-26 but not the 2026-10-27 reversal.
    `ROADMAP.md:126` already records that reversal.
  - The item 9 planner had already flagged these three INTENT lines
    (`docs/agent-work/spectra-item9-tags/handoff.md:50-51`).
- PR numbers confirmed by a repository file (the rule at `ROADMAP.md:14-15`):
  - PR 64 = phase 0: `docs/agent-work/phase0-hygiene/handoff.md:1` ("Phase 0 hygiene, PR 64").
  - PR 63 = phase 2: `docs/agent-work/phase2-subscription-change/review/ui-qa-r2.md:1` ("(PR 63)").
  - **#62 is not named in any repository file.** It appears only in the commit subject (grep
    `#6[2-6]|PR 6[2-6]|pull/6[2-6]`: only the two files above match).
  - **#65 (phase 1a draft) is not named in any repository file.** I could not check it either: the
    repo tool answered "this role cannot use repository operations" for `pr_get` 65 and `pr_list`.
- Phases: `ROADMAP.md:148-156` lists phases 0-4 with no state. Phase 1 has two planned parts:
  - 1a, design system: intake only, planning done, owner CRP-A/B/C open
    (`docs/agent-work/phase1a-design-system/handoff.md:3,59-65`).
  - 1b, private pricings: intake only, waiting on the owner's CRP-1 and CRP-2
    (`docs/agent-work/phase1b-private-pricings/handoff.md:3,20-21`).
  - Phases 3 and 4 have no directory under `docs/agent-work/` (glob).
- Naming clash: `ROADMAP.md:68` "Phase 2 checks" means **SPECTRA** phase 2 (`report.md:422`).
  `ROADMAP.md:154` "Phase 2, subscription-change flow" is the **owner's plan** phase 2. A "Phase 2:
  done" next to "Phase 2 checks" is easy to misread.
- Changesets: `.changeset/` holds 39 entries: `README.md`, `config.json` and 37 `.md` changesets
  (glob at the base). The proposal says "37 files besides README.md". The precise statement is "37
  `.md` files besides `README.md`", because `config.json` is also there. The stale counts are:
  - `ROADMAP.md:140`, "the 20 pending changesets", inside the owner's release decision of
    2026-10-27;
  - `ROADMAP.md:173`, "Release the 20 pending changesets", a backlog row;
  - `INTENT.md:68`, "17 files in `.changeset/` besides `README.md`", an O3 signal;
  - `INTENT.md:138`, "the 17 pending changesets", the owner's Q6 answer record.
- Other stale lines, verified, but not named by the proposal:
  - `INTENT.md:121` says "Spanish plurals are a low-priority objective (Q5)". The owner made them a
    non-goal on 2026-10-27 (`ROADMAP.md:28-31,127-128`).
  - `INTENT.md:69` sets the O3 threshold "the release is postponed (Q6)". The owner replaced this
    with the 2026-10-27 release decision (`ROADMAP.md:137-146`).
  - `INTENT.md:90-91` still lists the CI time of the SPECTRA spec as open, but the on-demand job
    exists (`.github/workflows/ci.yml:330-331`; `ROADMAP.md:162-163` marks it done).
    `INTENT.md:139-141` still says "the on-demand switch stays a backlog row".
  - The ci.yml citations in ROADMAP drifted:
    - `ROADMAP.md:75` cites `ci.yml:299-302`. The run step is now `ci.yml:347-350`.
    - `ROADMAP.md:164` cites `ci.yml:282-311` with `if:` at `:283`. The job is now `ci.yml:320-358`
      with `if:` at `:331`.
    - `ROADMAP.md:166` cites `ci.yml:277-278`. The dispatch note is now `ci.yml:325-326`.
- CI for a docs-only PR: root `*.md` and `docs/*` emit no rendered change (`ci.yml:130,134`), so the
  browser shards skip. `quality` runs `pnpm format:check` (`ci.yml:45`), which is
  `prettier --check .` (`package.json:134`).
- `openspec/` exists with one change (`openspec/changes/add-subscription-change-flow/`) and no
  `openspec/specs/` (glob).

## Scope

Two files, one slice each: `ROADMAP.md` (S1) and `INTENT.md` (S2).

## Non-goals

- No code, test, workflow, changeset, `acceptance/**` or `openspec/specs/**` change.
- No new owner decision in the files. S1 and S2 record decisions already taken (ROADMAP item 9,
  Q5, release) and merged facts. The INTENT wording is the owner's to approve (CRP-1).
- No rewording of owner answer records (`ROADMAP.md:121-146`, `INTENT.md:127-141`). A changed fact
  gets a pointer or a dated note appended, as `ROADMAP.md:126` already does. The one exception is a
  snapshot count inside such a record (D3).
- No release, no `changeset version` (`ROADMAP.md:139-146`).
- No state for UX-1..UX-11, and no refresh of `spectra-grid-and-text/handoff.md` (`ROADMAP.md:176`).

## Decisions taken in this intake

- D1. Two slices and two PRs, in parallel. Reason: disjoint files. S1 records merged facts and
  needs no new owner text. S2 waits for the owner's approval of the INTENT text (the proposal:
  "The INTENT.md text is yours to approve"), and should not hold S1 back.
- D2. PR numbers follow `ROADMAP.md:14-15`. Write PR 64 and PR 63 (confirmed by the files above).
  Write #62 and #65 only if the coordinator confirms them with the repo tool (`pr_get` 62 and 65,
  or `ci_status` with sha `3072086`) before S1 runs. Otherwise write "merged, PR not verified" for
  item 9 and "in progress, PR not verified" for phase 1a. The doc-steward may not have repo access,
  so the coordinator passes the answer in the S1 contract.
- D3. Changeset counts become "37 (at `9cf7e21`)". In the owner's release decision
  (`ROADMAP.md:140`), only the snapshot number changes, into "all pending changesets (37 at
  `9cf7e21`)". The decision itself stays word for word. `INTENT.md:138` (the Q6 answer record) keeps
  "17", because it is what the owner answered on 2026-10-26. Reason: counts are snapshots, and
  decisions are records.
- D4. The ROADMAP state legend (`ROADMAP.md:14`) gains "in progress" for phase 1a. Reason: the
  legend has no such state today, and "partly done" would be wrong for an unmerged draft.
- D5. Phase 1 gets two sub-rows, 1a and 1b, each with its own state and its intake path. Reason:
  their states differ (1a has a draft PR per the proposal; 1b waits on owner CRPs).
- D6. The phase list is labelled "Phases (owner plan)", and the "Phase 2 checks" heading stays as
  it is with one disambiguating line ("SPECTRA phase 2, `report.md:422`; not owner phase 2").
  Reason: renaming a heading breaks references, and a single added line removes the clash.
- D7. No feature flag. Reason: docs only, each slice is one PR, reverted by reverting it.
- D8. S2 cites ROADMAP by section and row name ("ROADMAP.md, item 9"), not by line. Reason: S1
  shifts ROADMAP lines and the two slices run in parallel.

## Slices

### S1: ROADMAP.md

- Role: doc-steward (default model and effort). Turn budget: 25. Risk: **low** (score 0: docs only,
  one file, no risk area, no public API). The file is owner-accepted (`ROADMAP.md:3`), so the owner
  reviews the PR.
- Owns: `ROADMAP.md` only. Read-only: this intake, `.changeset/*.md`,
  `.changeset/spectra-item9-tags.md`, the two handoffs cited for PR 63 and PR 64,
  `docs/agent-work/phase1a-design-system/handoff.md`,
  `docs/agent-work/phase1b-private-pricings/handoff.md`, `.github/workflows/ci.yml:320-358`.
- Content:
  1. Item 9 (`:51-60`): set "State: done". Keep the owner decision text `:54-58` as it is. Replace
     `:59-60` with: evidence commit `3072086`, `.changeset/spectra-item9-tags.md`,
     `docs/agent-work/spectra-item9-tags/`, and the PR per D2.
  2. Legend `:14`: add "in progress" (D4).
  3. Phases `:148-156`, labelled per D6:
     - 0: done, PR 64, commit `9cf7e21`.
     - 1a: in progress, PR per D2, with `docs/agent-work/phase1a-design-system/`.
     - 1b: not started (intake only, waiting on the owner's CRP-1 and CRP-2), with
       `docs/agent-work/phase1b-private-pricings/`.
     - 2: done, PR 63, commit `2b79e45`, with `docs/agent-work/phase2-subscription-change/` and
       `openspec/changes/add-subscription-change-flow/`.
     - 3 and 4: not started.
  4. Add the disambiguating line under "Phase 2 checks" (`:68`, D6).
  5. Changeset counts at `:140` (D3) and `:173`: 37 at `9cf7e21`.
  6. Extension (the coordinator may drop it): refresh the drifted ci.yml citations at `:75`, `:164`
     and `:166` to `ci.yml:347-350`, `:320-358` / `:331` and `:325-326`.
- If the base is not `9cf7e21`, recount `.changeset/*.md` and re-check the cited lines first.
- Size: about 30-50 diff lines. Requirement id: none (docs only; the coordinator decides whether the
  change carries one).
- Checks (worker, local):
  - `["pnpm", "install", "--frozen-lockfile"]`
  - `["pnpm", "exec", "prettier", "--check", "ROADMAP.md"]`
- Depends on: D2 answer (or the fallback wording). Order: parallel with S2.

### S2: INTENT.md

- Role: doc-steward (default model and effort). Turn budget: 20. Risk: **low** (score 0: docs only,
  one file). INTENT is owner-accepted (`INTENT.md:3`): the text needs the owner's approval
  (CRP-1), and the PR merges only after the answer.
- Owns: `INTENT.md` only. Read-only: this intake, `ROADMAP.md` (item 9, 3a-es, Q4, Q5, Release),
  `.changeset/*.md`.
- Content, option (a) of CRP-1 (the proposal's scope):
  1. `:99`: remove the item 9 non-goal.
  2. `:123`: remove "Dropped: item 9". Add item 9 to the Done list `:117-119` as "9 (comparison
     groups follow declared tags, `3072086`)", with the PR per D2.
  3. `:68`: "37 `.md` files in `.changeset/` besides `README.md` (at `9cf7e21`)".
  4. `:134`: keep the Q4 answer and append "Reversed by the owner on 2026-10-27 (ROADMAP.md, item
     9)".
- Added under option (b):
  5. `:121`: Spanish plurals are a non-goal since 2026-10-27 (ROADMAP.md, row 3a-es).
  6. `:69`: the threshold points to the 2026-10-27 release decision (ROADMAP.md, "Release").
  7. `:90-91`: the CI-time signal is met by the `on-demand-specs` job (`ci.yml:330-331`).
  8. `:139-141`: append a pointer that the on-demand switch is done (ROADMAP.md, Backlog). The "17"
     at `:138` stays (D3).
- Size: (a) about 8-12 diff lines; (b) about 15-25.
- Checks (worker, local):
  - `["pnpm", "install", "--frozen-lockfile"]`
  - `["pnpm", "exec", "prettier", "--check", "INTENT.md"]`
- Depends on: CRP-1 for the merge. The text can be drafted before the answer, as option (b) with
  items 5-8 easy to drop. Order: parallel with S1, and merged after CRP-1.

Ownership is disjoint: S1 owns `ROADMAP.md`, S2 owns `INTENT.md`. No shared file.

## Gates per slice (S1 and S2 alike)

The skills I read define no G5 or G7, so the coordinator maps them, as in
`docs/agent-work/prop-20261027-3/intake.md:156-176`.

- G1, `openspec validate --strict`: at change level, if the coordinator creates an OpenSpec change
  for this docs work (`openspec/` exists at the base).
- G2, EPIC review: N/A unless the change carries a requirement.
- G3, red-before: N/A (docs only).
- G4, acceptance freeze: N/A (no acceptance tests).
- G5: not defined in the skills I read; the coordinator maps it.
- G6, trace: N/A (no requirement, no code).
- G7: not defined in the skills I read; the coordinator maps it.
- G8, mutation: N/A (no code).
- G9, dependency and licence: N/A.
- G10, secrets: applies if registered.
- G11, review: one reviewer (low risk). The reviewer checks:
  - every new citation against its file and line;
  - the count of 37 against `.changeset/*.md`;
  - that no owner record is reworded beyond D3;
  - for S2, that the text matches the CRP-1 answer.
- G12, ui-qa: N/A (no UI).
- G13: N/A. Docs-only PRs use how_to_review: read the diff next to `git log 3072086 2b79e45
  9cf7e21` and the `.changeset/` listing.

Change-level proof: CI `quality` (`pnpm format:check`) passes on each PR head, and `browsers`
passes with the shards skipped (root `*.md`, `ci.yml:134`).

## Open questions

Needs a CRP (owner):

- CRP-1. The INTENT.md text (S2). Options:
  - (a) The proposal's three fixes plus the Q4 pointer (S2 items 1-4).
  - (b) (a) plus the other verified stale lines (items 5-8: Q5, release threshold, CI time, Q6
    pointer).
  - (c) No INTENT PR. The owner edits INTENT, and S2 is dropped.

  Recommendation: (b). Each line in it is verified stale against an owner decision or merged code,
  and one review is cheaper than a second proposal. (a) keeps the proposal's exact scope.

For the coordinator (not owner decisions):

- Q1. Confirm #62 (item 9, `3072086`) and #65 (phase 1a, draft) with the repo tool before S1 runs
  (D2). My role could not.
- Q2. Is phase 1a's draft PR the only phase 1 work in flight? Does 1b have a PR? No repository file
  says so. S1 writes 1b as "not started" unless told otherwise.
- Q3. Should this docs work have an OpenSpec change at all (no requirement), or only two task
  contracts?
- Q4. Keep or drop S1 item 6 (ci.yml citation refresh). It is outside the proposal's text, but in
  the same file and verified.
