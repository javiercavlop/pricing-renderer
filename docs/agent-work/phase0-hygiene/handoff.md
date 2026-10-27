# Handoff: phase0-hygiene

- Status: in-progress (planned, waiting for the CRP and S0) · Updated: 2026-10-27
- Branch / head: planner task `task/c45e4ae15f014d13`, base `465e248` · PR: none

## Goal

Fix the 13 hygiene items of the React/CSS audit (owner request
`own-5958ee948b474676b37f6dadb6ab1a38`) as small, separately mergeable PRs into develop, tests
first, with no release.

## State (with evidence)

- Intake written: `docs/agent-work/phase0-hygiene/intake.md`. It has the verification of each item
  with `file:line` at `465e248`, decisions D1-D14, slices S0, P0-01 to P0-13 with owned files, risk
  and checks, gates, risks R1-R6 and questions Q1-Q7.
- Verification: 11 items reproduce. Item 5 partly reproduces: `pricingPath` has no runtime effect, but
  the docs already say it is metadata. Item 7 is half done: the breakdown hooks are listed at
  `docs/theming.md:88-89`; the layer name and the padding note are not fixed yet.
- Extra findings: the core `deepEqual` treats two `Headers` objects as equal
  (`src/core/utils.ts:3-5,125-143`), so item 4 needs its own compare. The loading label is
  hard-coded English (`pricing-renderer-element.ts:926,929`), although `pricing.loading` exists (X1,
  folded into P0-06).
- The item 12 fact was checked by lookup (pricing4ts v0.10.3+ `retrievePricingFromText` upgrades
  1.x-3.0 to 3.1; sources in the intake).
- No code, spec or test written. No check is registered for this task, so none was run.

## Decisions

- Spec in `docs/agent-work/phase0-hygiene/spec.md` (S0), because `openspec/` is absent (D14).
- Item 2: instance prefix `pr-<n>-` through an optional `RenderState.idPrefix` (absent = `pr`), so
  renderer-only tests keep their ids (D2).
- Item 4: Lit `hasChanged` with a new internal structural compare for plain objects and arrays.
  Functions and class instances such as `Headers` are compared by identity. `loadPricing` stays by
  identity (D4).
- Item 10: doc precision only. The element keeps the owner-accepted stabilization (D10).
- Item 13: measure only string loader results in UTF-8 bytes; same code `PR_SOURCE_TOO_LARGE` (D13).
- Order: waves A, B and C avoid the files of the in-flight spectra-item9-tags S2. The element chain
  P0-03, P0-01, P0-04, P0-02, P0-09, P0-06 runs one at a time after S2 is merged.

## Ruled out

- Using the exported `deepEqual` for item 4: `Headers` changes would be missed.
- Changing the ids in `tests/unit/addon-grid.test.ts:405-407`: not needed with the optional prefix.
- Coercing `'10_000'` to a number in item 8: the owner asked for a diagnostic, not a coercion.
- A happy-dom/jsdom dependency for element tests: a new dependency for a hygiene phase. Node
  stand-ins plus CI browser specs are used instead.

## Open questions and risks

- Q1-Q5 (one owner CRP): the global event map scope (11), JSDoc `@deprecated` or docs only (5), the
  error-state design (6), toolbar or ignore for forced only-differences (9), doc or code for the
  kept-price note (10).
- Q6-Q7 (coordinator): register the checks and the red-before checks, assign the requirement ids,
  and compare the plan with the inbox file.
- R2: element behaviour is proven only by Playwright in CI. R3/R4: documented behaviour changes in
  items 4 and 13. R5: item 8 may add warnings on existing fixtures.

## Next three steps

1. Coordinator: send the CRP with Q1-Q5, register `pnpm install --frozen-lockfile`, `pnpm typecheck`,
   `pnpm lint`, `pnpm test` and `pnpm format:check` with the red-before checks of the intake, and
   start S0 (specifier, owns `docs/agent-work/phase0-hygiene/spec.md`).
2. After S0: start wave A in parallel. P0-07 (`docs/theming.md`), P0-12 (T then I, `normalize.ts`),
   P0-13 (T then I, `load.ts`), and P0-05 once Q2 is answered.
3. After wave A merges: P0-11 and P0-10, then P0-08. When spectra-item9-tags S2 is merged, start the
   element chain with P0-03.

## Evidence

- Task: planner `c45e4ae15f014d13` (this intake). Base `465e248`. CI: none.
- Sources: `src/element/pricing-renderer-element.ts:90-301,921-1037`,
  `src/element/renderers.ts:104-116,254-316,561-611,693-701,861-867,1064-1082,1220-1224,1369-1422`,
  `src/core/normalize.ts:60-69,161-224`, `src/yaml/load.ts:56-105`, `src/yaml/parser.ts:30-36`,
  `src/element/index.ts:15-19`, `src/react/index.ts:26-101`, `docs/theming.md:5,88-89`,
  `docs/api-reference.md:222-224,308,344`, `docs/events.md:114,128-129,257`.
