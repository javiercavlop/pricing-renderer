# Handoff: prop-20261104-2 (API reference coverage guard)

- Status: waiting on the coordinator. The plan is ready. Q1, Q2 and Q4 are coordinator decisions; Q3 and Q5
  need an owner CRP. Updated: 2026-11-04.
- Branch / head: planner task `task/84f8fa00b73b4a9e`, base `8ae591b`. PR: none.

## Goal

A unit test measures how much of the package's public value API `docs/api-reference.md` covers, prints the
ratio for the INTENT O3 signal (`INTENT.md:73-75`), and fails when a new value export arrives undocumented and
not on a commented pending list.

## State (with evidence)

- The intake is written: `docs/agent-work/prop-20261104-2/intake.md`. It has slice T1 (test), optional D1
  (INTENT value) and coordinator action C1 (contract amendments).
- Entries: 8 JavaScript subpaths in `package.json:32-71`, not the proposal's 5. The extra ones are `./define`,
  `./define-change-review` and `./react/headless` (the last added by #84).
- Value exports: 62 unique names. 19 are undocumented (word-boundary grep of `docs/api-reference.md`):
  - 17 in core: the proposal's 8, plus `selectionFromSearchParams` and `selectionToSearchParams`
    (`src/core/index.ts:21`) and 7 helpers from `utils.js` (`:55-62`);
  - `loadPricingSource` (`src/yaml/index.ts:3`);
  - `PricingRendererProvider` (`src/react/headless.ts:6`).
  - Coverage today: 43/62 (69%), against the proposal's "8 of 51".
- Proposal line refs that drifted: `humanizeIdentifier` is at `src/core/index.ts:59`, not `:53`. The value
  exports end at `:63`, not `:57`.
- The literal rule "in backticks" is wrong: 14 documented names appear only in fenced code blocks
  (`docs/api-reference.md:10-14,105-113,122-129,387-400,1027-1031`).
- Namespace imports of every entry already work in node (`tests/unit/space-contract.test.ts:4-9`).
- Remaining export slices that do not own the docs or the test: P3-6, P3-7b and P3-8 through
  `src/react/headless.ts` (`openspec/changes/add-react-headless/tasks.md:194-240,436`), and B2b on
  `src/yaml/index.ts` (`docs/agent-work/pending-phases/plan.md:288-293`).
- No code, test, spec, acceptance or INTENT file was changed.

## Decisions

- One test file, `tests/unit/api-reference-coverage.test.ts` (test-designer). Reason: one capability, about
  120-170 lines, no shared file.
- Value exports come from `Object.keys` of a runtime namespace import, not from parsing source. Reason: it
  covers `export *`, `export function` and `export const`, and it drops type-only exports by construction.
- Entries come from `package.json` `exports`, and a missing source file fails. Reason: a new subpath cannot slip
  past the guard.
- "Documented" means a whole-word match inside an inline code span or a fenced block. Reason: fenced-only
  signatures (`api-reference.md:10-14`).
- A stale `PENDING` entry fails. Reason: the list only shrinks (see R3 and Q1 (C) for the softer variant).
- Risk low (score 0). No feature flag. G13 as how-to-review.

## Ruled out

- Parsing `export { ... }` with a regex. It misses `export function` (`src/space/index.ts:44`) and `export *`
  (`src/react/index.ts:213`).
- Five hard-coded entry modules. They miss `./define` and `./react/headless`.
- api-extractor or typedoc. The proposal rules them out (new dependency, docs format change).

## Open questions and risks

- Q1: land T1 now with contract amendments C1 (recommended), after P3-15b, or with a warn-only stale check.
  Waiting on the coordinator.
- Q2: document-wide or per-section matching. Recommended: document-wide. Waiting on the coordinator.
- Q3: should O3 coverage also include types, attributes, events and parts? Owner, via CRP.
- Q4: a requirement for a `utest` tag, or untagged. Recommended: untagged. Waiting on the coordinator.
- Q5: the O3 coverage threshold (`INTENT.md:75`). Owner, via CRP.
- Risk R1: the guard fails in-flight export PRs. Mitigation: C1, or the order in Q1 (B).
- Risk R2: a common word in unrelated code counts as documented. Mitigation: code text only. Q2.
- G5, G7 and G10 are not defined in the files read. The coordinator applies its registry.

## Next three steps

1. The coordinator decides Q1, Q2 and Q4, opens a CRP for Q3 and Q5, and creates the T1 task contract from
   `intake.md`. The contract has the owned file, the read-only context, and the checks `install`, `unit`,
   `test`, `lint` and `fmt`.
2. If Q1 = A, the coordinator applies C1 to the contracts of P3-6, P3-7b, P3-8, P3-15b and B2b before the next
   of them starts.
3. A test-designer writes the test, runs the checks through `qa_run` and quotes the coverage line. A
   test-reviewer removes one `PENDING` entry to see the failure. Then D1 records the value in `INTENT.md:73-75`.

## Evidence

- Files read: `package.json`, `src/core/index.ts`, `src/yaml/index.ts`, `src/element/index.ts`,
  `src/element/define.ts`, `src/element/define-change-review.ts`, `src/react/index.ts`, `src/react/headless.ts`,
  `src/space/index.ts`, `docs/api-reference.md:1-135,385-430,1020-1119` (plus greps),
  `INTENT.md:55-94`, `openspec/changes/add-react-headless/tasks.md:1-75,194-469`,
  `docs/agent-work/pending-phases/plan.md:257-313,431-437`,
  `tests/unit/space-contract.test.ts:1-40`, `tests/unit/phase0-docs.test.ts:1-60`,
  `tests/unit/design-systems-docs.test.ts:195-208`, `vitest.config.ts`, `.prettierignore`.
- Checks: none registered for this task, and none run.
