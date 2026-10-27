# Intent

- Status: accepted by the owner on 2026-10-26 (answers to Q1-Q6 below).
- Objectives O1-O4 are accepted as written. Thresholds decided by the owner are marked in each
  signal; the others stay owner decisions.
- Evidence paths are relative to the repository root. `report.md` means
  `docs/agent-work/visual-review-spectra/report.md`.

## Purpose

Pricing Renderer turns a Pricing2Yaml document into a responsive, interactive pricing
experience (`README.md:9-11`). It ships as a light-DOM Web Component, a React 18/19 adapter and a
DOM-free TypeScript core. What it promises (`README.md:20-35`):

- Complete Pricing2Yaml 3.1 normalization, with best-effort support for other 3.x revisions.
- Reactive formulas parsed into a restricted AST, never `eval` or `Function`.
- Plans, add-ons, billing periods, variables, quantities, dependency and exclusion confirmation.
- Accessible semantic HTML, keyboard flows, dark mode, forced colors, RTL, zoom, reduced motion.
- CSS variables and stable `data-pr-part` hooks, so the renderer belongs to the host product.
- SSR-safe imports and a client-island React/Next integration.

A Vue 3 example also exists (`README.md:60`, `docs/vue.md`). It is an example, not a promise.

## Objectives

### O1: real-world Pricing2Yaml pricings render legibly

Why: the SPECTRA review measured 37 real pricings and found long pages and hidden calls to action.

Progress signals:

- Page height in viewports (`rendererHeightInViewports`, collapsed state). Current value at 1440:
  2.4 to 8.82, median 4.85, 2 of 29 at most 3. At 375: 3.95 to 44.63, 0 of 29 at most 3. Evidence:
  `report.md:83`. Threshold: at most 5 screens at 1440 px; no target at 375 px for now (Q2). Items 2, 3b, 6 and 7 are merged since that
  measurement, so the table is not re-measured here.
- CTA in the first viewport (`firstCtaVisible`). Current value: false for 8 pricings at 1440 and for
  7 at 375. Evidence: `report.md:82`. Threshold: CTA visible in the first screen at 1440 and 375 px;
  the 1024 px target is removed (Q3).
- Lone last card in the plan grid (`planCardsPerRow`). Current value at the time of the report: 5
  pricings with a 3+1 grid at 1440. Evidence: `report.md:86`. Item 8 is merged since then, so the
  value needs a new measurement. Threshold in the report: 0 pricings (a proposal).
- Truncated texts and awkward breaks (`truncatedTexts.count`, `awkwardBreaks.count`). Current value:
  truncated 0 everywhere; awkward breaks in several pricings before item 10. Evidence:
  `report.md:87`. Threshold in the report: 0 truncated, awkward breaks 0 (a proposal).

### O2: accessibility and visual-regression guards stay green

Why: contrast and target size are already met and should not regress while the look changes.

Progress signals:

- Contrast AA violations (`contrastViolations`, axe `color-contrast`). Current value: 0 on the 8
  extreme pricings, light, dark and `es`. Evidence: `report.md:88`. Threshold: 0 (kept as a guard).
- Selection targets of at least 44px (`.pr-selection-control`, `min-block-size: 44px`). Current
  value: not measured by the SPECTRA spec. Evidence: `report.md:89`. Threshold: no change.
- Visual baselines (Playwright screenshots). Current value: not recorded in this draft; the
  count and the pass rate need a check of `tests/browser`. Threshold: owner decision.
- Expanded-state height. Current value: the measurement was delivered by PR #53 (`xscreens`), but
  `docs/agent-work/visual-review-spectra/o1-remeasure.md:26` records no values yet. Threshold: owner
  decision.

### O3: a stable public API and package across the integrations

Why: the same package serves the Web Component, React, Next and the Vue example.

Progress signals:

- Pending changesets. Current value: 17 files in `.changeset/` besides `README.md`. Evidence:
  `.changeset/*.md`. Threshold: the release is postponed (Q6).
- Released versions. Current value: `CHANGELOG.md` has only 0.1.0 (`CHANGELOG.md:3`). Threshold:
  no release to main is prepared until the owner asks (Q6).
- API reference coverage. Current value: `docs/api-reference.md` exists; whether it lists every
  public attribute, property, event and part added since 0.1.0 is not verified in this draft.
  Threshold: owner decision.

### O4: supply-chain and CI health

Why: the audit report lists open findings in the release workflow and in the dependency tree.

Progress signals:

- Audit job strictness. Current value: advisory only, `continue-on-error: true`. Evidence:
  `docs/audit-report.md:72-75`. Threshold: owner decision.
- Pre-release compiler in the tree. Current value: `typescript 5.6.1-rc` through
  `@arethetypeswrong/core@0.18.5`, dev tool only. Evidence: `docs/audit-report.md:38-41`.
  Threshold: owner decision.
- Release workflow findings. Current value: 3 listed (global npm install in a job with
  `id-token: write`, whole pipeline in the publishing job, `prepublishOnly` repeats work). Evidence:
  `docs/audit-report.md:88-104`. Threshold: owner decision.
- CI time of the SPECTRA browser spec, which runs on every PR. Current value: not measured here.
  Evidence: `report.md:592-594`. Threshold: the spec becomes optional (on demand) in CI (Q6).

## Non-goals

- No change of the Pricing2Yaml 3.1 model or of the restricted-AST formula rule.
- No framework lock-in: the core stays DOM-free and SSR-safe.
- No hand-tuned layouts for a single customer pricing; fixes must hold for the measured set.
- Thresholds not marked as decided in the signals stay owner decisions.
- Item 9 (group by tags) is dropped (Q4), as the report advises (`report.md:364-367`).

## Constraints

- Node.js `>=22` for the published library (`package.json:25`); development tools need 22.12 or
  newer (`README.md:39`).
- pnpm 10.19.0 (`package.json:27`), frozen lockfile in CI.
- Pricing2Yaml 3.1 is the primary format (`README.md:22`).
- No `eval` or `Function` for formulas (`README.md:24`).
- A change to the public API (attribute, property, event field, CSS part) needs a CRP first
  (`report.md:99-101`).
- Markdown is formatted by prettier and checked by `pnpm format:check` in CI.

## Current focus

The rest of SPECTRA phase 2 (`report.md:420-436`), confirmed by the owner (Q1). State of the ranked
items (`report.md:108-121`):

- Done: 1 (sticky header), 2 (shorter collapsed page, #48), 3b (`unitLabels`, #49), 4 (names for
  dependencies), 5 (Okta without plans), 6 (add-on marker, #47), 7 (add-on grid, #50), 8 and 10 (grid
  and no split words, #46), 11 (filler descriptions).
- Partly done: 3a (plural units, English only; Spanish units are shown as written,
  `.changeset/plural-units.md:5-7`). Spanish plurals are a low-priority objective (Q5).
- Done: phase 2 step 1, the expanded-state height measurement (PR #53).
- Dropped: item 9, group by tags (Q4).

## Owner questions

All answered by the owner on 2026-10-26.

- Q1. Answered 2026-10-26: objectives O1-O4 accepted as they are; the current focus is the rest of
  SPECTRA phase 2.
- Q2. Answered 2026-10-26: page height at most 5 screens at 1440 px; no target at 375 px for now.
- Q3. Answered 2026-10-26: the CTA is visible in the first screen at 1440 and 375 px; the 1024 px
  target is removed.
- Q4. Answered 2026-10-26: item 9 (group by tags) is dropped.
- Q5. Answered 2026-10-26: Spanish plurals become a low-priority objective, with its own row in
  `ROADMAP.md`.
- Q6. Answered 2026-10-26: the SPECTRA browser spec becomes optional (on demand) in CI. The release
  of the 17 pending changesets is postponed; no release to main is prepared until the owner asks.
  The in-flight `ci-speed` change (`docs/agent-work/ci-speed/intake.md`) covers sharding and
  docs-only skips, not an on-demand SPECTRA spec; the on-demand switch stays a backlog row in
  `ROADMAP.md`, and no new change is added here.
