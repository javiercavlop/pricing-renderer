# Handoff: phase3-react-headless

- Status: waiting on the owner (CRP-P3-A to CRP-P3-D) · Updated: 2026-10-28
- Base: `88f5141` · Branch: the planner task branch · PR: none

## Summary

- The intake audits the six items of the owner request with `file:line` facts at `88f5141`.
- The selection logic to extract spans `pricing-renderer-element.ts:476-494,578-893` and has no unit test.
- Exporting `applySelectionInput` reverses `req~apply-input-internal~1` (`apply-selection.test.ts:69-73`).
- The plan has 19 slices (18 PRs) of at most about 300 lines, in five waves, with disjoint owned files.
- Code starts only after the owner answers CRP-P3-A (core) and CRP-P3-B (React API and subpath).

## Goal

Plan Phase 3 (React headless and composition), additive only, so 0.1.0 code keeps working.

## State (with evidence)

- `docs/agent-work/phase3-react-headless/intake.md`: facts per item, tests that pin them, package,
  SSR and React 18/19 facts, risks R1-R8.
- `docs/agent-work/phase3-react-headless/plan.md`: conventions, check arrays, CRPs, slices, order,
  shared files, risk per slice.
- Checks of this task: `install` and `fmt` through qa_run (see the task result).

## Decisions

- Characterization tests of the new core functions come before the element refactor (P3-1T before
  P3-2). Reason: the element logic is pinned only by browser specs
  (`tests/browser/pricing-renderer.spec.ts:125-432,1547-1600`).
- Hooks are thin layers over framework-free stores tested in node, with no new dependency
  (CRP-P3-D (a)). Reason: unit tests run in `node` with no DOM (`vitest.config.ts:5`).
- Plan slots use `keyed(plan.id, ...)` around the slot node, not `repeat()` for the whole map.
  Reason: about 16 test helpers flatten a directive to `''` (intake item 4).
- No new peer dependency: `createPortal` comes from `react-dom`, already an optional peer.
- No runtime flag. Reason: the release hold (`ROADMAP.md:137-148`) keeps every slice unreleased.

## Ruled out

- One React entry that holds the hooks too: it always loads Lit and registers the element
  (`src/react/index.ts:28`). It is kept only as the alternative in CRP-P3-B.
- `URLSearchParams` in core signatures: the core has no DOM types (`tsconfig.core.json:4-5`).

## Open questions and risks

- CRP-P3-A to CRP-P3-D: waiting on the owner (plan section 3).
- N-spec: the `openspec` CLI in the lab, needed for `spec(add-react-headless)`.
- R4: an uncached `resolvedState` in `useSyncExternalStore` re-renders without end. The plan caches
  the event detail.
- R8: `renderers.ts`, `README.md`, `docs/api-reference.md` and `src/yaml/index.ts` are shared with
  the phase 1b and 1c chains. The coordinator orders them.

## Next three steps

1. Send CRP-P3-A and CRP-P3-B to the owner with the recommendations of plan section 3.
2. After the answers, start P3-S1 (specifier) and, in parallel, P3-5's test task.
3. Then run P3-1T and P3-1I as one PR, followed by P3-2 and P3-3.

## Evidence

- Base `88f5141`. No code, spec or test changed by this task.
