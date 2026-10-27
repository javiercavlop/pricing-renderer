# Intake: P-20261027-3, bring ROADMAP.md up to date (on-demand specs, UX review)

- Proposal: P-20261027-3 (kind docs, size S, risk low, owner-approved). Planner intake, 2026-10-27.
- Base: `595ad24` (task branch `task/f3595faaa10f461f`).
- INTENT link: **O4, "supply-chain and CI health"** (`INTENT.md:76`) for the on-demand row, and
  **O1, "real-world Pricing2Yaml pricings render legibly"** (`INTENT.md:26`) for the UX rows. The
  signal the on-demand row closes is "CI time of the SPECTRA browser spec ... the spec becomes
  optional (on demand) in CI (Q6)" (`INTENT.md:90-91`).
- `report.md` means `docs/agent-work/visual-review-spectra/report.md` (the SPECTRA report).
  `ux-report.md` means `docs/agent-work/ux-review/report.md` (PR 56).

## Objective

Make `ROADMAP.md` match the repository. The roadmap should no longer show the on-demand SPECTRA
spec as open work, it should show the 11 UX review proposals with their CRP status, and the
phase 2 row should say where its missing values will come from. Proposers and planners work from
the roadmap, so stale rows lead to finished work being proposed again.

## Verified facts (file:line at `595ad24`)

- The backlog row is still open: `ROADMAP.md:86-87` ("SPECTRA browser spec optional (on demand) in
  CI ... Decided by the owner (Q6). Objective: O4."). The owner decision record also says "so the
  backlog row below stays" (`ROADMAP.md:77-80`).
- The job exists: `on-demand-specs` at `.github/workflows/ci.yml:282-311`, with
  `if: github.event_name == 'workflow_dispatch'` (`ci.yml:283`), `workflow_dispatch` in `on`
  (`ci.yml:12`), `PW_UX_STRESS: '1'` and both specs on the run step (`ci.yml:299-302`), and the
  artifact `on-demand-specs-report` (`ci.yml:303-310`). The comment at `ci.yml:272-281` says that
  it is not a required check and that a dispatch works only once the file is on the default branch.
  The design is in `docs/agent-work/ci-speed/on-demand-specs.md:1-9,38-47`.
- Commit: the subject of `0dfff01` is "ci: shard browser tests, add timeouts and an always-running
  browsers gate (#58)" (git log at the base). No file in the repository mentions PR 58 (grep `#58|PR 58|pull/58`:
  no match outside a CSS colour). Under the roadmap's rule (`ROADMAP.md:14-15`), the PR number may
  be written only when a file confirms it (see Decisions D3).
- The original SPECTRA reason for the row is still at `report.md:592-594`.
- ROADMAP has no UX row: grep `UX|stress|ux-` (case-insensitive) on `ROADMAP.md`, no match.
- The UX proposals: `ux-report.md:341-578` (one `### UX-n` section each, UX-1 at `:341`, UX-11 at
  `:558`). The summary table with order, priority, size, risk and "Owner CRP" is at
  `ux-report.md:587-599`. Dependencies are at `:601-602`, and the CRP split is at `:30-31` and
  `:582-584` (CRP: UX-4, UX-5, UX-6, UX-7, UX-8, UX-11; no CRP: UX-1, UX-2, UX-3, UX-9, UX-10).
  The owner questions Q-A to Q-G are at `ux-report.md:623-640`.
- None of UX-1 to UX-11 has started: `UX-\d+` matches only `ux-report.md` and
  `docs/agent-work/ux-review-report/handoff.md`.
- Correction to the proposal: it cites `ux-report.md:587-602` and `:587-598` for the list. The table
  ends at `:599` (UX-10 is that row), and `:601-602` are the dependencies. Use `:587-602`.
- Stale threshold wording in the UX report: `ux-report.md:617-621` calls Q2 and Q3 "undecided"
  (`INTENT.md:127-134`). Since then INTENT records both as answered on 2026-10-26: at most 5 screens
  at 1440 px with no 375 target (Q2), CTA in the first screen at 1440 and 375 px (Q3)
  (`INTENT.md:131-133`, `ROADMAP.md:73-74`). So its Q-A (`ux-report.md:625-626`) is partly answered
  already. Q-E differs from the owner's Q5 answer, and the report says so (`ux-report.md:633-636`).
- Phase 2 row: "Values are not recorded yet" (`ROADMAP.md:64-65`), which matches `xscreens=` being
  `-` on all 35 lines (`o1-remeasure.md:26`). The duplicate backlog row is `ROADMAP.md:97`. The
  proposal says the row "should point to P2" (P-20261027-2, the dispatch re-measure). No file in the
  repository mentions `P-20261027` (grep, no match), so that pointer is not verifiable yet (see Q2).
- "Related followup: R2-REV-001 (stale handoff)": two different R2-REV-001 exist. In
  `docs/agent-work/ci-speed/review-round2.md:32,49` it is the ci-speed handoff, marked "fixed
  here". In `docs/agent-work/delivera-3-price-breakdown/handoff.md:4` it is a doc-precision note.
  The stale-handoff backlog row is `ROADMAP.md:96` (`spectra-grid-and-text/handoff.md`). That file
  still says "PR 45 is open" and "Before/after tables in both specs are empty"
  (`docs/agent-work/spectra-grid-and-text/handoff.md:6,19`), while item 8/10 is done via PR #46
  (`ROADMAP.md:47-49`). The row stays open, and this change does not touch it.
- INTENT has the same stale wording at `INTENT.md:56-60` (expanded height), `:90-91` (CI time) and
  `:137-141` (Q6: "the on-demand switch stays a backlog row"). INTENT is out of scope (see
  Non-goals).
- The proposal's backlog titles were checked and are accurate at the base. The `release.yml`
  `publish` job (`release.yml:21`) has no `timeout-minutes` (grep: none in `release.yml`). The
  `quality` and `audit` checkouts (`ci.yml:36,64`) have no `persist-credentials: false`. The
  on-demand install (`ci.yml:298`) has no step timeout. `blob-report` is in neither `.gitignore`
  nor `.prettierignore` (only `playwright-report`, `.gitignore:6`, `.prettierignore:4`). These are
  separate proposals, not part of this change.
- Formatting: `pnpm format:check` is `prettier --check .` (`package.json:125`). The prettier config
  is `printWidth` 100 (`.prettierrc.json:4`). CI runs it in `quality` (`ci.yml:45`). A
  `ROADMAP.md`-only diff skips the browser shards (`ci.yml:130-134`, root `*.md`).
- `openspec/` does not exist at the base (glob `openspec/**/*.md`: no match).

## Scope

One file: `ROADMAP.md`.

1. Backlog row `ROADMAP.md:86-87`: state **done**. Evidence: the `on-demand-specs` job,
   `ci.yml:272-311` (`if:` at `:283`), commit `0dfff01`, and
   `docs/agent-work/ci-speed/on-demand-specs.md`. Add one line saying that a dispatch works only
   once `ci.yml` is on the default branch (`ci.yml:277-278`, `on-demand-specs.md:45-47`), and that
   the release job skips both specs (`on-demand-specs.md:34-36`). Move the row out of the
   "not verified" backlog (`ROADMAP.md:84`): into a new "CI" section, or keep it in place marked
   done, as the doc-steward chooses. Either way, the evidence is verified.
2. Owner decision Q6 (`ROADMAP.md:77-80`): keep the owner's wording, and append one clause
   pointing to the done row (D2).
3. New section "UX review (PR 56)": one row per proposal, UX-1 to UX-11, in the order of
   `ux-report.md:587-599`. Per row: title, objective (O1, as the proposal says; the report does not
   map objectives), state **not started**, priority, size, risk, "Owner CRP: yes/no", depends on
   (`ux-report.md:601-602`), and evidence `ux-report.md:<section line>`. One intro line names the
   CRP split (`ux-report.md:582-584`). One line says that the report's thresholds predate the owner's
   Q2/Q3 answers (`ux-report.md:617-621` against `ROADMAP.md:73-74`) and that its questions Q-A to
   Q-G (`ux-report.md:623-640`) are open, except that Q2 already answers part of Q-A.
4. Phase 2 row `ROADMAP.md:62-65`: keep "not recorded yet" with its evidence, and add where the
   values will come from: a run of `on-demand-specs` (the job now runs `spectra-review.spec.ts`,
   `ci.yml:302`), and the follow-up proposal once it has a file in the repository (Q2).

## Non-goals

- No change to `INTENT.md`. PR 61 edits INTENT and is waiting for the owner. The stale INTENT
  lines listed above are a followup for PR 61 or a later INTENT task.
- No change to `.github/workflows/**`, `.gitignore`, `.prettierignore`, `playwright.config.ts` or
  any test. The CI backlog titles of the proposal stay separate proposals.
- No refresh of `docs/agent-work/spectra-grid-and-text/handoff.md` (row `ROADMAP.md:96` stays).
- No acceptance or rejection of any UX proposal, and no new threshold. The roadmap lists them; the
  CRPs decide them.
- No new backlog rows from the proposal's backlog list (they are proposals, not roadmap items).
- No `acceptance/**`, no `openspec/specs/**`, no changeset (no published file changes).

## Decisions taken in this intake

- D1. One slice and one PR, separate from PR 61. Reason: one file, about 50-70 diff lines, one
  capability. Folding it into PR 61 (the proposal's alternative) would tie a CI/roadmap fact to an
  INTENT edit that is waiting for the owner. Both need the owner's merge anyway, and a
  ROADMAP-only PR is easier to review.
- D2. Do not rewrite the owner's Q6 decision record. Append a pointer only. Reason: lines 70-80
  record what the owner decided on 2026-10-26. A changed state belongs in the item row.
- D3. Evidence for the done row is the file and the commit (`ci.yml:282-283`, `0dfff01`). Write
  "PR #58" only if the doc-steward confirms it through the repo tool (`ci_status` with the commit
  sha, or the PR). Otherwise write "merged, PR not verified", as `ROADMAP.md:14-15` requires.
  Reason: no file in the repository names PR 58. The number comes from a commit subject only.
- D4. No feature flag. Reason: docs only, one slice, reverted by reverting the PR.
- D5. UX rows are "not started", not "proposed". Reason: the roadmap's state set is "done, partly
  done, not started, proposed drop" (`ROADMAP.md:14`). The CRP status goes in its own field.

## Slices

### S1: ROADMAP.md update

- Role: doc-steward (default model and effort). Turn budget: 25.
- Owns: `ROADMAP.md`. Nothing else.
- Read-only context: this intake, `.github/workflows/ci.yml:272-311`,
  `docs/agent-work/ci-speed/on-demand-specs.md`, `docs/agent-work/ux-review/report.md` (lines
  13-33 and 341-640), `docs/agent-work/visual-review-spectra/o1-remeasure.md:26`, `INTENT.md`
  (lines 26-91 and 125-141).
- Content: Scope items 1-4 and D2, D3, D5. Every new citation is `file:line` at the slice's base.
  If the base is not `595ad24`, re-check `ci.yml:282-283` and `ux-report.md:587-602` first.
- Requirement id: none. Docs only, and no requirement is planned. The coordinator decides whether
  the change carries one.
- Size: about 50-70 diff lines (one edited row, one pointer, one rewritten phase 2 row, one new
  section of about 11 rows of 3-4 lines each). Under 300.
- Risk: **low**. Score 0: docs only, one file, no risk area, no public API. It agrees with the
  proposal. The file is owner-accepted (`ROADMAP.md:3`), so the owner reviews the PR.
- Checks (worker, local):
  - `["pnpm", "install", "--frozen-lockfile"]`
  - `["pnpm", "exec", "prettier", "--check", "ROADMAP.md"]`
- Change-level proof: the CI `quality` job (`pnpm format:check`, `ci.yml:45`) passes on the PR
  head, and `browsers` passes with the shards skipped (root Markdown only, `ci.yml:134`,
  `ci.yml:258-260`).
- Depends on: nothing. Order: S1 only.

Ownership is trivially disjoint (one slice, one file). Possible conflict: PR 61 may also touch
`ROADMAP.md`. I could not verify that from the repository (Q3).

## Gates per slice (S1)

As in the earlier intakes (`docs/agent-work/prop-20261026-3/intake.md:199-220`), the skills I read
define no G5 or G7, so the coordinator maps them.

- G1, openspec validate --strict: change level, once the change exists. `openspec/` is absent at the
  base, so this needs `openspec init` or the coordinator's convention.
- G2, EPIC review: N/A unless the change carries a requirement.
- G3, red-before: N/A (docs, no failing-first behaviour).
- G4, acceptance freeze: N/A (no acceptance tests).
- G5: not defined in the skills I read; the coordinator maps it.
- G6, trace: N/A (no requirement, no code).
- G7: not defined in the skills I read; the coordinator maps it.
- G8, mutation: N/A (no code).
- G9, dependency and licence: N/A (no dependency).
- G10, secrets: applies if registered.
- G11, review: one reviewer (low risk). Check every new citation against its file and line, the
  11 CRP flags against `ux-report.md:587-599`, and that the Q6 record is not reworded.
- G12, ui-qa: N/A (no UI).
- G13, how-to-test: N/A. Docs-only PR, so it uses how_to_review: read the diff of `ROADMAP.md`
  next to `ci.yml:272-311` and `ux-report.md:580-602`.

## Open questions

Needs a CRP (owner):

- Q1. Placement of the UX rows. (a) A new section "UX review (PR 56)" with all 11 rows (this plan).
  (b) Only the 5 no-CRP proposals as roadmap rows, with the 6 CRP ones listed as "awaiting owner
  CRP". (c) A single line pointing to `ux-report.md:580-602`. Recommendation: (a). It is what the
  proposal asks for and keeps the CRP status visible. The owner's merge of S1 can serve as this
  answer if the coordinator states the choice in the PR, so no separate CRP is needed then.

For the coordinator (not owner decisions):

- Q2. The phase 2 pointer "to P2": the proposal names P-20261027-2, which has no file in the
  repository. S1 cites the `on-demand-specs` job as the source of the values and adds the proposal
  id only if the coordinator confirms that it is approved and has an intake by the time S1 runs.
- Q3. Does PR 61 touch `ROADMAP.md`? If it does, S1 waits for PR 61 to merge, or rebases after it.
  Check with `pr_get` on PR 61.
- Q4. Whether the change needs an OpenSpec delta at all (docs only), given that `openspec/` is
  absent.
