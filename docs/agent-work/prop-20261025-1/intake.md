# Intake: P-20261025-1, draft INTENT.md and ROADMAP.md

- Proposal: P-20261025-1 (kind docs, size S, owner-approved). Planner intake, 2026-10-25.
- Base: `bea3f5c` (task branch `task/08028d6e811d49d9`).
- INTENT link: objective **O0, "INTENT.md missing"**. No `INTENT.md`, `ROADMAP.md`,
  `constitution.md`, `.agentic/` or `openspec/` exists in the tree (glob at `bea3f5c`, no match).

## Objective

Give the owner a draft `INTENT.md` (candidate objectives with progress signals, non-goals,
constraints, current focus) and a `ROADMAP.md` (SPECTRA items with state and evidence) to approve,
so later proposals can cite an `O<n>` other than O0.

## Scope

- `INTENT.md` (repository root, new): candidate objectives O1-O4, each with progress signals taken
  from existing measurements; non-goals; constraints; current focus; open owner questions.
- `ROADMAP.md` (repository root, new): one row per SPECTRA item of
  `docs/agent-work/visual-review-spectra/report.md:108-121`, plus the phase 2 step "expanded-state
  height check" (`report.md:422`), each with state and evidence; a backlog section with the
  followups listed in the proposal.

## Non-goals

- No code, test, CSS, API, schema, CI or dependency change.
- No `constitution.md`, `.agentic/` or `openspec/specs/**` (living specs change only in an archive task).
- No change to the existing `docs/**` files, including the stale
  `docs/agent-work/spectra-grid-and-text/handoff.md` (it is a backlog item, not this change).
- No decision on thresholds: they are written as open questions for the owner, not as settled targets.
- The drafts do not mark objectives as accepted; the status line says "draft, waiting for the owner".

## Verified facts the slices must use (and corrections to the proposal)

`report.md` below is `docs/agent-work/visual-review-spectra/report.md`.

- Product purpose (Pricing2Yaml 3.1 rendering, restricted-AST formulas, accessibility, theming,
  SSR, React/Next): `README.md:9-35`.
- A Vue integration exists; the README lists it as an example, not under "Why it exists":
  `README.md:60`, `docs/vue.md`.
- Measurable targets and their CI status: `report.md:80-89`.
- Owner threshold questions (3 vs 5 screens; CTA at 1024): `report.md:91-95`.
- Ranked items 1-11 with the CRP column: `report.md:108-121`.
- Phase 2 order, step 1 "expanded-state height check": `report.md:420-436`.
- Browser metrics still describe only the collapsed state: `tests/browser/spectra-review.spec.ts:6`.
- The SPECTRA spec runs on every PR and costs CI time; the report suggests opt-in: `report.md:592-594`.
- The `audit` job is advisory (`continue-on-error: true`): `docs/audit-report.md:72-75`.
- `typescript 5.6.1-rc` comes in through `@arethetypeswrong/core`: `docs/audit-report.md:38-41`.
- Release workflow findings (global npm, publish job runs everything): `docs/audit-report.md:88-99`.
- 17 pending changesets (besides `README.md`); CHANGELOG has only 0.1.0: `.changeset/*.md`,
  `CHANGELOG.md:3`.
- CI runs `pnpm format:check`, and prettier also formats markdown under the root and `docs/`:
  `.github/workflows/ci.yml:34,75`, `.prettierignore:1-10`.

SPECTRA item state at `bea3f5c`. The proposal is out of date here: items 2, 3b and 7 are merged, and
PR #47 is merged, not open.

- Item 1, sticky header and total: done. `.changeset/sticky-plan-header.md:5`.
- Item 2, shorter collapsed page: done, #48. Commit `5b00315`, `.changeset/spectra-shorter-page.md`.
- Item 3a, plural units: partly done. English only; Spanish units are shown as written.
  `.changeset/plural-units.md:5-7` vs `report.md:236`.
- Item 3b, `unitLabels`: done, #49. Commit `c75bbeb`, `.changeset/spectra-unit-labels.md:5`.
- Item 4, names instead of ids: done. `.changeset/names-for-dependencies.md:5-8`.
- Item 5, Okta without plans: done. `.changeset/no-plans-pricing.md:5`.
- Item 6, Add-on marker: done, #47. Commit `144b5ef`, `.changeset/spectra-addon-marker.md:5`.
- Item 7, add-on grid: done, #50. Commit `bea3f5c`, `.changeset/spectra-addon-grid.md`.
- Items 8 and 10, grid and no split words: done, #46. Commit `6561348`,
  `.changeset/spectra-grid-plan-columns.md`.
- Item 11, filler descriptions: done. `.changeset/skip-filler-descriptions.md:5`.
- Item 9, group by tags: not started, and the report advises dropping it. No `spectra-item9*` folder;
  `report.md:364-367`.
- Phase 2 step 1, expanded-state height: not started. `spectra-review.spec.ts:6`.

PR numbers #41-#45 for items 1, 3a, 4, 5 and 11 come from the proposal only. I could not check them
here: the planner role has no PR read access and the worktree has no git log tool. Slice S2 must
confirm each number from `git log --oneline` before writing it, or write "merged, PR not verified".

## Slices

The objective ids O1-O4 and their titles are fixed by this intake (list below), so S2 can refer to
them without reading S1. Both slices go into one docs change. Merge order: S1, then S2, so that
ROADMAP never cites an objective that does not yet exist on develop. No feature flag is needed
because this is docs only and nothing is user-visible.

Frozen objective ids (the wording can change in S1; the ids and their order cannot):

- O1, real-world Pricing2Yaml pricings render legibly. Signals from the `report.md:80-89` targets.
- O2, accessibility and visual-regression guards. Signals: contrast 0, 44px targets, baselines
  (`report.md:88-89`).
- O3, a stable public API and package across the integrations. Signals: changesets, CHANGELOG,
  `docs/api-reference.md`.
- O4, supply-chain and CI health. Signals: `docs/audit-report.md:19-99`, `report.md:592-594`.

### S1: INTENT.md

- Role: doc-steward (default model and effort). Turn budget: 30.
- Owns: `INTENT.md` (new). Nothing else.
- Read-only context: `README.md`, `docs/architecture.md`, `docs/api-reference.md`,
  `docs/agent-work/visual-review-spectra/report.md`, `docs/agent-work/visual-review-spectra/metrics.md`,
  `docs/audit-report.md`, `CHANGELOG.md`, `.changeset/*.md`, this intake.
- Content: a status line ("draft, waiting for the owner"); purpose (from `README.md:9-35`); O1-O4,
  each with 2-4 progress signals, each signal naming its metric, the current value with evidence and
  "threshold: owner decision" where the report leaves it open; non-goals; constraints (Node >= 22,
  pnpm 10.19.0, Pricing2Yaml 3.1, no `eval`, public API changes need a CRP); current focus (SPECTRA
  phase 2 remainder); "Open questions for the owner" listing Q1-Q6 below.
- Requirement ids: none yet (the coordinator assigns them in the OpenSpec change).
- Size: about 120-160 lines. Risk: **low** (score 0: docs only -2, no risk area, floor 0).
- Checks (after a frozen install):
  - `["pnpm", "install", "--frozen-lockfile"]`
  - `["pnpm", "exec", "prettier", "--check", "INTENT.md"]`
- Depends on: nothing.

### S2: ROADMAP.md

- Role: doc-steward (default model and effort). Turn budget: 30.
- Owns: `ROADMAP.md` (new). Nothing else.
- Read-only context: same as S1, plus `git log --oneline` on develop to confirm the PR numbers.
- Content: a status line; a table with the item, its objective (O1 for every SPECTRA item; O2 for the
  contrast guard), its state (done / partly done / not started / proposed drop), and its evidence
  (PR number if confirmed, changeset file). Separate rows for 3a-es (Spanish plural rules), the
  expanded-state height check, and item 9 with "drop proposed, owner decides". Backlog section with
  the proposal's followups, each linked to O1-O4 and marked "not verified, from earlier task
  followups".
- Size: about 60-90 lines. Risk: **low** (score 0).
- Checks:
  - `["pnpm", "install", "--frozen-lockfile"]`
  - `["pnpm", "exec", "prettier", "--check", "ROADMAP.md"]`
- Depends on: S1 merged first (for ids only); it can be written in parallel because the ids are frozen.

Ownership is disjoint: S1 has `INTENT.md` only, S2 has `ROADMAP.md` only. Change-level check for the
PR: `["pnpm", "format:check"]` (same command as CI, `ci.yml:34`).

## Gates per slice

The factory skills I could read define G1, G2, G3, G4, G6, G8, G9, G10, G11, G12 and G13. I found no
definition for G5 or G7, so the coordinator must map them.

The same for S1 (`INTENT.md`) and S2 (`ROADMAP.md`) unless a line says otherwise.

- G1, openspec validate --strict: at change level, required once the coordinator creates the change.
- G2, EPIC spec review: N/A unless the change carries requirements.
- G3, red-before: N/A (no tests).
- G4, acceptance freeze: N/A (no `acceptance/`).
- G5: not defined in the skills I could read; the coordinator maps it.
- G6, trace: N/A (no requirement tags in code).
- G7: not defined in the skills I could read; the coordinator maps it.
- G8, mutation: N/A.
- G9, dependency and licence: N/A (no dependency).
- G10, secrets: applies if registered (docs text).
- G11, review: one reviewer (low risk), who checks the facts against the cited lines. For S2 the
  reviewer also checks every PR number against `git log`.
- G12, ui-qa: N/A (no UI).
- G13, how-to-test: N/A. The PR uses how_to_review (files, sections, decisions asked).

## Open questions that need a CRP (owner)

- Q1. Accept, reword or replace objectives O1-O4, and choose the current focus. INTENT is the owner's
  (proposal "Auto-start: no").
- Q2. Page-height target: "at most 3 screens" or "at most 5 at 1440"; and a 375 target
  (`report.md:91-94`; best case is 3.95 at 375).
- Q3. CTA in the first viewport at 1024: keep it as a target or drop it (`report.md:94`).
- Q4. Item 9, group by tags: drop as the report advises (`report.md:364-367`) or keep it.
- Q5. Spanish plural units: a roadmap goal or a non-goal (3a shipped English only,
  `.changeset/plural-units.md:5-7`).
- Q6. Under O4: make the SPECTRA browser spec opt-in in CI (`report.md:592-594`), and whether a
  release of the 17 pending changesets is part of O3.

Other needs for the coordinator, not owner decisions:

- The repository has no `openspec/`. The first OpenSpec change needs `openspec init` or a decision
  to track this docs change without G1.
- PR numbers #41-#45 have to be confirmed (see above).
