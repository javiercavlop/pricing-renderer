# Handoff: phase1a-design-system

- Status: waiting-review (planning done, owner CRPs open) · Updated: 2026-10-27T00:00:00Z
- Branch / head: task/52ed3e72c76e40fd / base `465e248` (planner task, uncommitted) · PR: none

## Goal

Let a host product theme the renderer with its own design system (owner request
own-bae08f30d9784ccc837fdb6594a70581, items 1-9): a guide, a shadcn token overlay, new optional
tokens, `.dark` on an ancestor, density, state attributes, a minimal theme, a React `style` prop,
and a theme builder demo. No release.

## State (with evidence)

- Intake written: `docs/agent-work/phase1a-design-system/intake.md`. It has the verified facts at
  `465e248`, decisions D1-D12, slices S0-S10, gates, risks R1-R7, CRP-A/B/C and Q4-Q6.
- No code, spec or test written. No check was run: the task registered none.
- External facts were checked by lookup (sources are in the intake). They cover the Tailwind v3.4.0
  preflight button rule (unlayered), the Tailwind v4 layer order, the shadcn variable names and
  formats (v4 oklch versus v3 HSL channels), and how `@lit/react` passes `style`/`className`.

## Decisions

- D1 one change per capability, no flags. Docs are collected in S6 and S10 so parallel slices
  share no file. Reason: disjoint ownership, and each capability is additive or opt-in.
- D2 new tokens are optional with `var(--pr-x, today)` fallbacks in `base.css`, and `theme.css`
  does not declare them. Weights are grouped per site. Reason: `base.css` uses nine weight values
  (intake "Tokens"), so declaring four would change the look.
- D3 `--pr-sticky-top` applies to the toolbar and the 840px summary, not to the table header in its
  scroll box. Reason: `base.css:652-655,1366-1369,787-791,823-826`. Correction: the request said
  "0 today", but the summary sticks at `var(--pr-space-4)`.
- D4 `@supports (max-block-size: 1dvh)` guard for `--pr-table-max-height`. Reason: a `var()`
  declaration would drop the `80vh` fallback (`base.css:789-790`).
- D5 `--pr-plan-columns` on every plan-grid rule, with the shared rules `:262-268` and `:1269-1273`
  split.
- D6 font tokens left undeclared, so the inherited value stays as today. Never use the value
  `inherit` in a token.
- D7 `data-featured`, `data-kind` and `data-available` (add-on cards only) are added. `data-current`
  is reserved for phase 2. Reason: `src/` has no current-plan concept.
- D8 `tokens-shadcn.css` is an overlay in `pricing-renderer.shadcn`, with an order statement as its
  first line.
- D9 `theme-minimal.css` is a full replacement for `theme.css`. D10 density overrides sit directly
  in the `pricing-renderer` layer.
- D11 the theme builder is a second demo page. Reason: a new package would break
  `--frozen-lockfile`.
- D12 tests first: a test-designer task with red-before (G3), then an implementer task, in each code
  slice.

## Ruled out

- Declaring four weight tokens in `theme.css`: visible change (R1).
- A full-replacement shadcn theme: duplicates tokens and loses the dark values of success, warning
  and overlay.
- A new workspace package for the theme builder: lockfile change.
- Putting `--pr-sticky-top` on `thead th`: wrong containing scroll box.

## Open questions and risks

- CRP-A (public API, additive): token names and weight grouping, display-font scope, state
  attributes, the React `style` type, the two new exports and the shadcn mapping, `density` versus
  `plan-density`. Waiting on the owner via CRP. I1-I4 merge only after the answer.
- CRP-B (visual default): `.dark` always (like `[data-theme='dark']`, `theme.css:44`) or only with
  `theme="auto"`. Screenshots come from T5 in CI. I5 merges after the answer.
- CRP-C (Q-G, `docs/agent-work/ux-review/report.md:639-640`): density at all, and the compact values.
  S8 starts after the answer.
- Q4 (coordinator): shadcn v3 HSL support out of scope (a guide snippet only)? Q5: register
  `pnpm package:check` for I4 and I7? Q6: the OpenBinding context is unverifiable, so no host product
  is named in the docs.
- Risks: R2 the generic `.dark` class; R3 the overlay layer order (asserted in T4); R4 shadcn v3
  formats; R5 the `plan-grid-columns.test.ts` helper change; R6 no browsers in the lab (all
  screenshots from CI); R7 the medium-confidence Tailwind facts (proven by `host-reset.spec.ts` in S6).

## Next three steps

1. The coordinator sends CRP-A, CRP-B and CRP-C to the owner with the options and recommendations
   from the intake's "Open questions".
2. Run S0 (specifier): write `docs/agent-work/phase1a-design-system/spec.md` with the proposed
   requirement ids. Then start T1-T5 in parallel, with the owned files and red-before argv from the
   intake's "Slices".
3. After each T is integrated and frozen, run its I task with the full check set (install,
   typecheck, lint, test, format:check). Open one PR per capability into develop, and merge per the
   CRP answers (I1-I4 after CRP-A, I5 after CRP-B).

## Evidence

- Tasks: 52ed3e72c76e40fd (this planner intake). Heads: base `465e248`. CI: none (no push).
- Lookup sources: raw.githubusercontent.com tailwindcss v3.4.0 `src/css/preflight.css`; tailwindcss
  main `packages/tailwindcss/index.css` and `preflight.css`; ui.shadcn.com/docs/theming and
  /docs/tailwind-v4; lit/lit `packages/react/src/create-component.ts` at `@lit/react@1.0.7`.
