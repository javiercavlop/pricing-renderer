# Roadmap

Status: draft, waiting for the owner.

This roadmap lists the SPECTRA improvement items from
`docs/agent-work/visual-review-spectra/report.md:108-121` and the first step of phase 2
(`report.md:422`). Objectives are the draft ones of `INTENT.md`:

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
  - Objective: O1. State: not started. Spanish units are shown as written.
  - Evidence: `.changeset/plural-units.md:5-7` against `report.md:236`.
  - Whether this is a goal or a non-goal is an owner question.
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
  - Objective: O1. State: proposed drop; drop proposed, owner decides.
  - Evidence: no `spectra-item9*` folder; the report advises dropping it (`report.md:364-367`).
- Item 10, long text handling, no split words such as "Unlimited"
  - Objective: O1. State: done.
  - Evidence: PR #46, commit `6561348`, `.changeset/spectra-grid-plan-columns.md`.
- Item 11, empty or filler descriptions
  - Objective: O1. State: done.
  - Evidence: `.changeset/skip-filler-descriptions.md`; merged, PR not verified.

## Phase 2 checks

- Expanded-state height check (phase 2, step 1)
  - Objective: O2. State: not started.
  - Evidence: the browser metrics describe only the collapsed state
    (`tests/browser/spectra-review.spec.ts:6`); proposed in `report.md:422`.
- Contrast guard (contrast stays at 0)
  - Objective: O2. State: done as a regression guard; not a ranked item (`report.md:126`).
  - Evidence: `report.md:88-89`.

## Open owner decisions that change this roadmap

- Item 9: drop it as the report advises, or keep it.
- Spanish plural rules (3a-es): roadmap goal or non-goal.
- Page-height and CTA thresholds (`report.md:91-95`): not settled here.

## Backlog

Every entry is not verified, from earlier task followups.

- Opt-in SPECTRA browser spec in CI, because it runs on every PR and costs CI time
  (`report.md:592-594`). Objective: O4.
- Make the `audit` job blocking; today it has `continue-on-error: true`
  (`docs/audit-report.md:72-75`). Objective: O4.
- Replace `typescript 5.6.1-rc`, which comes in through `@arethetypeswrong/core`
  (`docs/audit-report.md:38-41`). Objective: O4.
- Release workflow findings: global npm, and the publish job runs everything
  (`docs/audit-report.md:88-99`). Objective: O4.
- Release the 17 pending changesets; `CHANGELOG.md` has only 0.1.0 (`CHANGELOG.md:3`).
  Objective: O3.
- Refresh the stale `docs/agent-work/spectra-grid-and-text/handoff.md`. Objective: O1.
- Collapsed-only browser metrics: extend them to the expanded state (see the phase 2 row).
  Objective: O2.
