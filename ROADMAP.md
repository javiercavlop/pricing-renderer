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
  - Objective: O1. State: not started, low priority (owner, Q5, 2026-10-26). Spanish units are
    shown as written.
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
  - Objective: O1. State: dropped (owner, Q4, 2026-10-26).
  - Evidence: no `spectra-item9*` folder; the report advised dropping it (`report.md:364-367`).
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
- Contrast guard (contrast stays at 0)
  - Objective: O2. State: done as a regression guard; not a ranked item (`report.md:126`).
  - Evidence: `report.md:88-89`.

## Owner decisions (2026-10-26)

- Q1: objectives O1-O4 accepted; the focus is the rest of SPECTRA phase 2.
- Q2: page height at most 5 screens at 1440 px; no target at 375 px for now.
- Q3: CTA in the first screen at 1440 and 375 px; no 1024 px target.
- Q4: item 9 dropped.
- Q5: Spanish plurals are a low-priority objective (row 3a-es).
- Q6: the SPECTRA browser spec becomes on demand in CI; the release of the pending changesets is
  postponed and no release to main is prepared until the owner asks. The in-flight `ci-speed` change
  covers sharding and docs-only skips only (`docs/agent-work/ci-speed/intake.md`), so the backlog
  row below stays.

## Backlog

Every entry is not verified, from earlier task followups.

- SPECTRA browser spec optional (on demand) in CI, because it runs on every PR and costs CI time
  (`report.md:592-594`). Decided by the owner (Q6). Objective: O4.
- Make the `audit` job blocking; today it has `continue-on-error: true`
  (`docs/audit-report.md:72-75`). Objective: O4.
- Replace `typescript 5.6.1-rc`, which comes in through `@arethetypeswrong/core`
  (`docs/audit-report.md:38-41`). Objective: O4.
- Release workflow findings: global npm, and the publish job runs everything
  (`docs/audit-report.md:88-99`). Objective: O4.
- Release the 17 pending changesets; `CHANGELOG.md` has only 0.1.0 (`CHANGELOG.md:3`). Postponed
  by the owner (Q6): no release to main until the owner asks. Objective: O3.
- Refresh the stale `docs/agent-work/spectra-grid-and-text/handoff.md`. Objective: O1.
- Record the expanded-state values that PR #53 now measures (see the phase 2 row). Objective: O2.
