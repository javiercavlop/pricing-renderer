# Intent

- Status: draft, waiting for the owner. Nothing below is accepted until the owner says so.
- Objectives O1-O4 are candidates. Thresholds are not decided; they are listed as questions.
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
  `report.md:83`. Threshold: owner decision (Q2). Items 2, 3b, 6 and 7 are merged since that
  measurement, so the table is not re-measured here.
- CTA in the first viewport (`firstCtaVisible`). Current value: false for 8 pricings at 1440 and for
  7 at 375. Evidence: `report.md:82`. Threshold: owner decision (Q3).
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
- Expanded-state height. Current value: not measured, the browser metrics describe only the
  collapsed state (`tests/browser/spectra-review.spec.ts:6`). Threshold: owner decision.

### O3: a stable public API and package across the integrations

Why: the same package serves the Web Component, React, Next and the Vue example.

Progress signals:

- Pending changesets. Current value: 17 files in `.changeset/` besides `README.md`. Evidence:
  `.changeset/*.md`. Threshold: owner decision (Q6).
- Released versions. Current value: `CHANGELOG.md` has only 0.1.0 (`CHANGELOG.md:3`). Threshold:
  owner decision (Q6).
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
  Evidence: `report.md:592-594`. Threshold: owner decision (Q6).

## Non-goals

- No change of the Pricing2Yaml 3.1 model or of the restricted-AST formula rule.
- No framework lock-in: the core stays DOM-free and SSR-safe.
- No hand-tuned layouts for a single customer pricing; fixes must hold for the measured set.
- No decision on thresholds in this draft; they stay owner questions.
- Item 9 (group by tags) is not a goal while Q4 is open. The report advises dropping it
  (`report.md:364-367`).

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

SPECTRA phase 2 remainder (`report.md:420-436`). State of the ranked items (`report.md:108-121`):

- Done: 1 (sticky header), 2 (shorter collapsed page, #48), 3b (`unitLabels`, #49), 4 (names for
  dependencies), 5 (Okta without plans), 6 (add-on marker, #47), 7 (add-on grid, #50), 8 and 10 (grid
  and no split words, #46), 11 (filler descriptions).
- Partly done: 3a (plural units, English only; Spanish units are shown as written,
  `.changeset/plural-units.md:5-7`).
- Not started: phase 2 step 1, the expanded-state height check; item 9, group by tags (drop
  advised).

## Open questions for the owner

Each answer below is a proposed answer, owner reviews. None is a settled decision. Q1 and Q6 (the
release part) have no recommendation and stay open.

- Q1. Accept, reword or replace objectives O1-O4, and confirm the current focus. Open: INTENT is the
  owner's, no answer is proposed.
- Q2. Page-height target: "at most 3 screens" or "at most 5 at 1440", and a target at 375.
  Proposed answer, owner reviews: use "at most 5 at 1440" (15 of 29 measured pass; the best case at
  375 is 3.95, so 3 cannot be met there). A 375 target is left open (`report.md:91-94`).
- Q3. CTA in the first viewport at 1024: keep it as a target or drop it. Proposed answer, owner
  reviews: keep it at 1440 and 375 only and drop it at 1024, where it holds for 2 pricings
  (`report.md:94`).
- Q4. Item 9, group by tags: drop or keep. Proposed answer, owner reviews: drop it, as the report
  advises (`report.md:364-367`).
- Q5. Spanish plural units: a roadmap goal or a non-goal (3a shipped English only). Proposed answer,
  owner reviews: roadmap goal at low priority, tracked as its own row.
- Q6. Under O4, make the SPECTRA browser spec opt-in in CI. Proposed answer, owner reviews: make it
  opt-in, as the report suggests (`report.md:592-594`). Whether releasing the 17 pending changesets
  belongs to O3 stays open: no answer is proposed.
