# Roadmap

Status: accepted by the owner on 2026-10-26.

This roadmap lists the SPECTRA improvement items from
`docs/agent-work/visual-review-spectra/report.md:108-121` and the first step of phase 2
(`report.md:422`). Objectives are the accepted ones of `INTENT.md`:

- O1: real-world Pricing2Yaml pricings render legibly.
- O2: accessibility and visual-regression guards.
- O3: a stable public API and package across the integrations.
- O4: supply-chain and CI health.

States: done, partly done, not started, proposed drop. A PR number is written only when a file in
the repository confirms it; otherwise the row says "merged, PR not verified".

## SPECTRA items

- Item 1, sticky plan header and total near the plans
  - Objective: O1. State: done.
  - Evidence: `.changeset/sticky-plan-header.md`; merged, PR not verified.
- Item 2, shorter collapsed page, differences-only by default
  - Objective: O1. State: done.
  - Evidence: PR #48, commit `5b00315`, `.changeset/spectra-shorter-page.md`.
- Item 3a, plural units (English)
  - Objective: O1. State: partly done; English only.
  - Evidence: `.changeset/plural-units.md:5-7`; merged, PR not verified.
- Item 3a-es, Spanish plural rules
  - Objective: O1. State: non-goal (owner decision, 2026-10-27); the open question of Q5 is closed.
    Units keep being written as in the pricing under non-English locales. To translate or
    pluralize a unit, use `presentation.unitLabels` (item 3b, PR #49; `docs/i18n.md`, "Unit labels").
  - Evidence: `.changeset/plural-units.md:5-7` against `report.md:236`.
- Item 3b, `presentation.unitLabels` override for exotic units
  - Objective: O1 (public API: O3). State: done.
  - Evidence: PR #49, commit `c75bbeb`, `.changeset/spectra-unit-labels.md`.
- Item 4, names instead of ids for dependencies and the dialog
  - Objective: O1. State: done.
  - Evidence: `.changeset/names-for-dependencies.md`; merged, PR not verified.
- Item 5, Okta without plans
  - Objective: O1. State: done.
  - Evidence: `.changeset/no-plans-pricing.md`; merged, PR not verified.
- Item 6, "Add-on" marker instead of the em dash
  - Objective: O1. State: done.
  - Evidence: PR #47, commit `144b5ef`, `.changeset/spectra-addon-marker.md`.
- Item 7, add-on grid with equal heights, fewer details and a filter for 14+ add-ons
  - Objective: O1. State: done.
  - Evidence: PR #50, commit `bea3f5c`, `.changeset/spectra-addon-grid.md`.
- Item 8, plan grid with balanced tracks and the CTA in the first view
  - Objective: O1. State: done.
  - Evidence: PR #46, commit `6561348`, `.changeset/spectra-grid-plan-columns.md`.
- Item 9, group by tags
  - Objective: O1. State: not started (owner reopened 2026-10-27); the earlier drop of 2026-10-26 no
    longer stands.
  - Owner decision of 2026-10-27: comparison groups follow the declared tags. A pricing with no tags
    renders one comparison with no group headers. In a partly tagged pricing, the untagged features
    and usage limits go into one final group, "Other features". A fully tagged pricing is unchanged.
    The visual change is approved. The report's concern about grouping by name prefix
    (`report.md:364-367`) does not apply, because the groups use only declared tags.
  - Evidence: `docs/agent-work/spectra-item9-tags/`. The state becomes done, with the PR number,
    after the merge.
- Item 10, long text handling, no split words such as "Unlimited"
  - Objective: O1. State: done.
  - Evidence: PR #46, commit `6561348`, `.changeset/spectra-grid-plan-columns.md`.
- Item 11, empty or filler descriptions
  - Objective: O1. State: done.
  - Evidence: `.changeset/skip-filler-descriptions.md`; merged, PR not verified.

## Phase 2 checks

- Expanded-state height check (phase 2, step 1)
  - Objective: O2. State: done (measurement delivered by PR #53).
  - Evidence: PR #53 (`xscreens`); proposed in `report.md:422`. Values are not recorded yet
    (`docs/agent-work/visual-review-spectra/o1-remeasure.md:26`).
  - Next step: proposal P-20261027-2 (owner approved, intake in progress). The values come from
    a run of the `on-demand-specs` job, which runs `spectra-review.spec.ts` (`ci.yml:299-302`).
- Contrast guard (contrast stays at 0)
  - Objective: O2. State: done as a regression guard; not a ranked item (`report.md:126`).
  - Evidence: `report.md:88-89`.

## UX review (PR 56)

Source: `docs/agent-work/ux-review/report.md` (`ux-report.md` below), summary table at
`ux-report.md:587-599`, dependencies at `:601-602`. No proposal has started. Owner CRP is needed
for UX-4, UX-5, UX-6, UX-7, UX-8 and UX-11; UX-1, UX-2, UX-3, UX-9 and UX-10 need none
(`ux-report.md:582-584`). The report's thresholds predate the owner's Q2 and Q3 answers
(`ux-report.md:617-621` against Q2 and Q3 below), and its questions Q-A to Q-G
(`ux-report.md:623-640`) are open, except that Q2 already answers part of Q-A.

- UX-1, stress spec: browser measurement extension (`ux-report.md:341`)
  - Objective: O1. State: not started. Priority P8, about 250 lines, risk low. Owner CRP: no.
- UX-2, unit-level counts on the stress fixtures and the 37 real pricings (`ux-report.md:373`)
  - Objective: O1. State: not started. Priority P8, about 200 lines, risk low. Owner CRP: no.
- UX-3, narrow top compaction (`ux-report.md:395`)
  - Objective: O1. State: not started. Priority P2, about 60 lines, risk low. Owner CRP: no.
    Depends on UX-1.
- UX-4, CTA directly under the price, from 840 px (`ux-report.md:413`)
  - Objective: O1. State: not started. Priority P2, about 120 lines, risk medium. Owner CRP: yes.
    Depends on UX-1.
- UX-5, narrow plan cards with the highlights closed (`ux-report.md:431`)
  - Objective: O1. State: not started. Priority P1, about 180 lines, risk medium. Owner CRP: yes.
    Depends on UX-1.
- UX-6, narrow comparison, smaller initial row cap (`ux-report.md:458`)
  - Objective: O1. State: not started. Priority P1, about 90 lines, risk medium. Owner CRP: yes.
    Depends on UX-1.
- UX-7, add-on marker aware of `availableFor` (`ux-report.md:482`)
  - Objective: O1. State: not started. Priority P4, about 120 lines, risk low. Owner CRP: yes.
    Depends on UX-2.
- UX-8, add-on filter for the selected plan only (`ux-report.md:502`)
  - Objective: O1. State: not started. Priority P5, about 150 lines, risk low. Owner CRP: yes.
    Depends on UX-1.
- UX-9, filler descriptions for plans and add-ons (`ux-report.md:527`)
  - Objective: O1. State: not started. Priority P6, about 60 lines, risk low. Owner CRP: no.
    Depends on UX-2.
- UX-10, stress spec asserts the targets (`ux-report.md:540`)
  - Objective: O1. State: not started. Priority P8, about 150 lines, risk medium. Owner CRP: no.
    Depends on UX-1 and every product proposal the owner accepts.
- UX-11, mark the selected plan's column in the table (`ux-report.md:558`)
  - Objective: O1. State: not started. Priority P3, about 90 lines, risk low. Owner CRP: yes.
    Depends on UX-1.

## Owner decisions (2026-10-26)

- Q1: objectives O1-O4 accepted; the focus is the rest of SPECTRA phase 2.
- Q2: page height at most 5 screens at 1440 px; no target at 375 px for now.
- Q3: CTA in the first screen at 1440 and 375 px; no 1024 px target.
- Q4: item 9 dropped; on 2026-10-27 the owner reversed this and asked for the item (see item 9).
- Q5: Spanish plurals were a low-priority objective (row 3a-es); on 2026-10-27 the owner made them
  a non-goal, closing the question.
- Q6: the SPECTRA browser spec becomes on demand in CI; the release of the pending changesets is
  postponed and no release to main is prepared until the owner asks. The in-flight `ci-speed` change
  covers sharding and docs-only skips only (`docs/agent-work/ci-speed/intake.md`), so the backlog
  row below stays.
  Update 2026-10-27: the on-demand job now exists; see the first backlog row.

## Release

Owner decision of 2026-10-27, which replaces the postponement of Q6:

- There is NO release of pricing-renderer until further notice. All work accumulates in `develop`.
- The next version is ONE single release. It carries the 20 pending changesets plus everything
  requested on 2026-10-27.
- It goes out only when the owner says that the companion PRs to SPACE, SPHERE and the SPACE
  clients (space-node-client, space-python-client, space-java-client, space-react-client) are
  merged.
- Until then: no release PR to main, no `changeset version`, no npm publish. New changesets stay
  pending.

## Phases

Phase list from the owner's plan:

- Phase 0, hygiene and fixes.
- Phase 1, design-system integration and private pricings.
- Phase 2, subscription-change flow.
- Phase 3, React headless and composition.
- Phase 4, reference integration with SPACE (later).

## Backlog

Every entry is not verified, from earlier task followups.

- SPECTRA browser spec optional (on demand) in CI, because it runs on every PR and costs CI time
  (`report.md:592-594`). Decided by the owner (Q6). Objective: O4. State: done.
  - Evidence: job `on-demand-specs`, `.github/workflows/ci.yml:282-311` (`if:` at `:283`), commit
    `0dfff01`; merged, PR not verified. Design: `docs/agent-work/ci-speed/on-demand-specs.md`.
  - A dispatch works only once `ci.yml` is on the default branch (`ci.yml:277-278`).
- Make the `audit` job blocking; today it has `continue-on-error: true`
  (`docs/audit-report.md:72-75`). Objective: O4.
- Replace `typescript 5.6.1-rc`, which comes in through `@arethetypeswrong/core`
  (`docs/audit-report.md:38-41`). Objective: O4.
- Release workflow findings: global npm, and the publish job runs everything
  (`docs/audit-report.md:88-99`). Objective: O4.
- Release the 20 pending changesets; `CHANGELOG.md` has only 0.1.0 (`CHANGELOG.md:3`). On hold by
  owner decision of 2026-10-27 (see "Release"): no release until further notice; the single next
  release also includes everything requested on 2026-10-27. Objective: O3.
- Refresh the stale `docs/agent-work/spectra-grid-and-text/handoff.md`. Objective: O1.
- Record the expanded-state values that PR #53 now measures (see the phase 2 row). Objective: O2.
