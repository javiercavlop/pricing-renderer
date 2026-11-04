# Intake: P-20261104-2, a guard for API reference coverage of the public value exports

- Proposal: P-20261104-2 (kind dx, size S, risk low, owner-approved).
- Base: `8ae591b` (task branch `task/84f8fa00b73b4a9e`). Planner intake, 2026-11-04.
- INTENT link: **O3, "a stable public API and package across the integrations"**. The signal "API reference
  coverage" reads "not verified in this draft" and "Threshold: owner decision" (`INTENT.md:73-75`).
- OpenSpec: no behaviour change and no spec delta. No `acceptance/**` file. The coordinator decides whether
  the guard needs a requirement (Q4).

## Objective

Turn the O3 signal into a number and stop it from growing: a unit test lists the value exports of every
JavaScript entry of the package. It fails when one of them is not named in `docs/api-reference.md` and is not
on an explicit, commented pending list. It prints the coverage ratio.

## Verified facts (file:line at `8ae591b`)

- Package entries: `package.json:32-71` has 8 JavaScript subpaths, not 5. They are `.` (`:33`), `./yaml`
  (`:37`), `./element` (`:41`), `./define` (`:45`), `./define-change-review` (`:49`), `./react` (`:53`),
  `./react/headless` (`:57`) and `./space` (`:61`). Each maps `./dist/<path>.js` to `src/<path>.ts`
  (glob: `src/{core,yaml,element,react,space}/index.ts`, `src/react/headless.ts`, `src/element/define.ts`,
  `src/element/define-change-review.ts`). `./react/headless` was added by #84 (`8ae591b`).
- Export forms differ between entries, so a regex over `export { ... }` misses some names:
  - `export { ... } from` blocks (`src/core/index.ts:1-63`);
  - `export function` declarations (`src/space/index.ts:44,71,95,105`);
  - `export const` (`src/react/index.ts:161,198`, `src/element/define.ts:3`);
  - local `export { ... }` (`src/react/index.ts:211`, `src/element/define.ts:25`);
  - `export *` (`src/react/index.ts:213` re-exports `src/react/headless.ts`);
  - type-only forms to skip (`export type`, `export interface`, `export type *` at `src/element/define.ts:26`).
- A runtime namespace import already works in node for every entry that needs a DOM library:
  `tests/unit/space-contract.test.ts:4-9` imports `* as core`, `* as element`, `* as react` and `* as yaml`
  at top level (`vitest.config.ts:5`, `environment: 'node'`).
- Value exports per entry (counted by reading the files; the test's output is the authoritative number):
  - `.`: 46 (`src/core/index.ts:1-63`);
  - `./yaml`: 3 (`src/yaml/index.ts:1-3`);
  - `./element`: 4 (`src/element/index.ts:1,4-5`);
  - `./define`: 3 (`src/element/define.ts:3,5,25`);
  - `./define-change-review`: 0 (`src/element/define-change-review.ts:1-7`, side effect only);
  - `./react`: 5 (`src/react/index.ts:161,198,211,213`);
  - `./react/headless`: 1 (`src/react/headless.ts:6`);
  - `./space`: 4.
  - That is 62 unique names (66 entry/name pairs).
- Undocumented today: **19 unique names**. None of them appears anywhere in `docs/api-reference.md` (grep
  with word boundaries):
  - core (17):
    - the 8 the proposal names: `applySelectionInput` (`src/core/index.ts:9`), `applySelectionChange`,
      `planSelectionChange`, `selectionInEffect`, `selectionWithAddOnQuantity`, `selectionWithVariable`
      (`:12-18`), `createPriceStabilizer` (`:19`) and `humanizeIdentifier` (**`:59`, not `:53`**);
    - also `selectionFromSearchParams` and `selectionToSearchParams` (`:21`, added by #83);
    - also `asRecord`, `cloneValue`, `deepEqual`, `getAtPath`, `isRecord`, `setAtPath` and `unwrapValue`
      (`:55-62`).
  - `./yaml`: `loadPricingSource` (`src/yaml/index.ts:3`; shipped by `.changeset/load-pricing-source.md:5`).
  - `./react` and `./react/headless`: `PricingRendererProvider` (`src/react/headless.ts:6`). The reference has
    no `pricing-renderer/react/headless` section; its `##` headings are `:6,385,427,968,1023,1037,1053,1120`.
  - Coverage today: 43 of 62 unique names (69%). The proposal's "8 of 51" undercounts.
- **The proposal's literal rule "appears in backticks" would give false failures.** Ten documented core names
  appear only inside fenced `ts` blocks, never in an inline code span. They are `configurePricingRenderer`,
  `createPricingRendererConfig` and `getPricingRendererConfig` (`docs/api-reference.md:10-14`),
  `evaluatePriceExpression` and `collectExpressionDependencies` (`:105-113`), and `getRegisteredLocales`,
  `getMessages`, `translate`, `formatCurrency` and `formatDate` (`:122-129`). The same holds for
  `parsePricingYaml` and `loadPricingFromUrl` (`:387-400`) and for `PRICING_RENDERER_TAG` and
  `definePricingRenderer` (`:1027-1031`).
- Existing API-reference tests check specific content only: `tests/unit/phase0-docs.test.ts:36,51,103,130,138`
  and `tests/unit/design-systems-docs.test.ts:200-207`. No coverage test exists. The file name
  `tests/unit/api-reference-coverage.test.ts` is free (glob).
- Ownership of `docs/api-reference.md` in open plans: the pending chain B2b → B3b → U8, then P3-15b
  (`openspec/changes/add-react-headless/tasks.md:444`). P3-15b documents "core functions,
  `pricing-renderer/react`, the new subpath" (`tasks.md:412-420`). B2b owns the `pricing-renderer/yaml` section
  and `src/yaml/index.ts` (`docs/agent-work/pending-phases/plan.md:288-293`).
- Phase 3 slices that will still add value exports to a package entry go through `src/react/headless.ts`, which
  `src/react/index.ts:213` re-exports. They are P3-6 `usePricingSource`, P3-7b `usePricingSelection` and P3-8
  `usePricingRendererState` (`tasks.md:194-240`). They form one sequential chain on that file (`tasks.md:436`).
  None of them owns `docs/api-reference.md` or the new test file.
- The `[ ]` boxes of `tasks.md` are not a reliable status: P3-3 to P3-5 show `[ ]` (`tasks.md:129-167`) but
  #83 and #84 merged them (`git log`).
- Check names and arrays: `openspec/changes/add-react-headless/tasks.md:30-41,61`.

## Scope

- One new test file, `tests/unit/api-reference-coverage.test.ts`. It:
  1. reads `package.json` `exports` and keeps the subpaths whose `default` ends in `.js`, mapping
     `./dist/<p>.js` to `src/<p>.ts`. A subpath whose source file is missing fails the test; it is not skipped;
  2. imports each source module as a namespace and takes `Object.keys(namespace)` as its value exports.
     Type-only exports do not exist at runtime, and `export *` and `export function` are included. This is
     simpler and more exact than parsing. Precedent: `space-contract.test.ts:4-9`;
  3. extracts every inline code span and every fenced code block of `docs/api-reference.md`. A name is
     documented when it matches as a whole word (`\bname\b`) in that code text. Prose-only mentions do not
     count;
  4. compares with a `PENDING` list of names, one per line, each with a short comment (entry and planned
     slice, for example `// P3-15b`). It holds the 19 names above;
  5. asserts:
     - (a) every exported name not in `PENDING` is documented;
     - (b) every `PENDING` name is still exported and still undocumented. A stale entry fails with "remove
       it from PENDING", so the list only shrinks;
  6. logs one line, `API reference coverage: <documented>/<total> unique value exports (<pct>%)`, and the
     per-entry counts, through `console.info`, so the O3 value can be recorded;
  7. self-checks the matcher on small inline strings: a name inside a fenced block counts, a name in prose only
     does not, and `PricingRenderer` is not matched by `PricingRendererElement`.

## Non-goals

- No change to `src/**`, `docs/api-reference.md`, `package.json`, CI, dependencies or `.changeset/**`.
- No documentation of the 19 names (P3-15b, B2b, or a later docs slice).
- No coverage of type exports, element attributes, properties, events or CSS parts. The INTENT wording
  (`INTENT.md:73-74`) names those too; see Q3. Events already have a guard
  (`tests/unit/docs-examples.test.ts:80-112`, cited at `tasks.md:302-305`).
- No api-extractor or typedoc, no generated reference (ruled out by the proposal).
- No per-section matching (a name must sit under its own subpath heading). The headless subpath has no heading
  yet; see Q2.
- No edit of `INTENT.md` in T1 (slice D1).

## Slices

### T1: API reference coverage guard

- Role: test-designer (writes `tests/unit/**`). Model and effort: role default. Turn budget: 30.
- Owns: `tests/unit/api-reference-coverage.test.ts` (new). Nothing else.
- Read-only context:
  - this intake;
  - `package.json:32-71`;
  - `src/core/index.ts:1-63`, `src/yaml/index.ts`, `src/element/index.ts`, `src/element/define.ts`,
    `src/element/define-change-review.ts`, `src/react/index.ts:161-213`, `src/react/headless.ts`,
    `src/space/index.ts`;
  - `docs/api-reference.md`;
  - `tests/unit/space-contract.test.ts:1-12` (namespace imports in node);
  - `tests/unit/phase0-docs.test.ts:1-26` (`repoRoot` and `read` helpers).
- Pitfalls:
  - Import entries with a static map of namespaces, or with `await import()` of a path built from
    `package.json`. Either way, an entry added to `exports` without a source file must fail. A silent skip is
    not allowed.
  - Importing `src/element/define.ts` registers the element only when `customElements` exists
    (`define.ts:21-23`). In node it does not exist, so there is no side effect. Do not add a DOM shim.
  - Fenced blocks first, then inline spans of the remaining text, so backticks inside a fence are not split
    into spans.
  - Keep `PENDING` sorted per entry, with the planned slice in the comment. Assertion messages name the entry
    and say what to do: "document it in docs/api-reference.md or add it to PENDING with a reason".
  - No `[utest->...]` tag unless Q4 adds a requirement. A header comment cites the proposal id and
    `INTENT.md:73-75`.
- Size: about 120-170 lines. Risk: **low** (score 0: one test file; no `src/`, API, dependency, CI or security
  area). Its only effect is that it can fail later PRs; see R1 and Q1.
- Checks (arrays from `tasks.md:30-41`; the coordinator registers them):
  - `install`: `["pnpm","install","--frozen-lockfile"]`
  - `unit`: `["pnpm","exec","vitest","run","tests/unit/api-reference-coverage.test.ts"]`
  - `test`: `["pnpm","run","test"]`
  - `lint`: `["pnpm","run","lint"]`
  - `fmt`: `["pnpm","run","format:check"]`
  - `type`: `["pnpm","run","typecheck"]`. It is useful only if `tsc -b` includes `tests/`; the per-entry
    `tsconfig.*.json` files include `src/<entry>/**` only. A root `tsconfig.json` was not read.
- Depends on: nothing beyond `8ae591b`. Placement against Phase 3: Q1.
- PR: T1 alone, one PR into `develop`. It is green on the base by design. The PR text quotes the coverage line
  from the `unit` output.

### D1: record the measured value in INTENT (optional, after T1 merges)

- Role: doc-steward. Turn budget: 10. Owns `INTENT.md` (the O3 "API reference coverage" bullet, `:73-75`
  only).
- Content: the current value from T1's output, with the commit, and "guard:
  `tests/unit/api-reference-coverage.test.ts`". The threshold stays "owner decision" unless the CRP (Q5)
  answers it.
- Size: about 5 lines. Risk: **low**. Checks: `install`, `fmt`.
- Depends on: T1 merged. The coordinator may instead fold it into the next INTENT refresh (like #80).

### C1: contract amendments (coordinator action, not a worker slice)

Needed only if Q1 is answered (A). The coordinator updates the open contracts:

- add `tests/unit/api-reference-coverage.test.ts` to the test-task file lists of P3-6, P3-7b and P3-8. Each one
  adds its new hook name to `PENDING`. This follows the existing chain on `src/react/headless.ts`
  (`tasks.md:436`), so it creates no new contention;
- add the same file to P3-15b (`tasks.md:412-420`), which removes the names it documents and should leave
  `PENDING` empty for Phase 3 names;
- state one rule for every other open contract that adds a value export to a package entry (B2b on
  `src/yaml/index.ts`, `pending-phases/plan.md:288-293`, for example): it either documents the name in the
  same PR, or its test task adds it to `PENDING`.

## Order

T1 → (C1 before the next export slice starts, if Q1 = A) → D1. T1 and D1 do not share files. Nothing runs in
parallel with T1 on its file.

## Gates per slice

The mapping follows the earlier intakes (`docs/agent-work/prop-20261104-1/intake.md:122-139`). G5, G7 and G10
are not defined in any file I read.

| Gate                 | T1                                                                                                                                                                                | D1                       |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| G1 openspec --strict | N/A (no change, unless Q4)                                                                                                                                                        | N/A                      |
| G2 EPIC review       | N/A                                                                                                                                                                               | N/A                      |
| G3 red-before        | N/A in the usual sense: a guard is green on the base. Proof that it can fail: the matcher self-checks (Scope 7), and the test-reviewer removes one `PENDING` entry locally and sees (a) fail | N/A                      |
| G4 frozen tests      | N/A (no implementation slice follows)                                                                                                                                             | N/A                      |
| G5, G7, G10          | coordinator registry                                                                                                                                                              | coordinator registry     |
| G6 trace             | no tag (no requirement, unless Q4); trace must still pass at project level                                                                                                        | N/A                      |
| G8 mutation          | N/A (no `src/` change)                                                                                                                                                            | N/A                      |
| G9 deps and licence  | N/A (no dependency)                                                                                                                                                               | N/A                      |
| G11 review           | one test-reviewer                                                                                                                                                                 | one reviewer             |
| G12 ui-qa            | N/A                                                                                                                                                                               | N/A                      |
| G13                  | n/a with a how-to-review: read `PENDING`, run `unit` and read the coverage line, delete one `PENDING` entry and see the failure message                                                       | n/a with a how-to-review |

## Feature flags

None. T1 is a single test file with no runtime behaviour. Phase 3 also uses no flags (`tasks.md:26`).

## Risks

- R1. The guard fails in-flight PRs that add an export (P3-6, P3-7b, P3-8, B2b) when their contracts do not
  own the test file or the docs. Mitigation: Q1 (C1 amendments), or land T1 after those slices.
- R2. False documented: whole-word matching in any code text can count a common word (`translate`,
  `formatDate`) that appears in an unrelated example. Mitigation: code text only, not prose. Q2 keeps a stricter
  per-section rule open.
- R3. A stale-entry failure (5b) breaks a docs-only PR (P3-15b, B2b, U8) that documents a pending name without
  touching the test. Mitigation: C1 gives those slices the file. Fallback: make 5b a `console.warn` instead of a
  failure (coordinator choice in Q1).
- R4. A runtime import of an entry could start doing work at import time later (for example a DOM access).
  Today only `define.ts:21-23` has a side effect, and it is guarded.

## Open questions

- Q1 (coordinator decision; the owner only if amending the `add-react-headless` plan needs it): where does T1
  go relative to the remaining Phase 3 export slices?
  - (A) Recommended: land T1 now and apply C1. The guard holds from today, and P3-15b gets a concrete list to
    empty.
  - (B) Land T1 after P3-15b merges. There are no contract changes, but no guard during Phase 3, which the
    proposal wants to avoid.
  - (C) Land T1 now with 5b as a warning only. This lowers R3 but lets `PENDING` go stale.
- Q2 (coordinator): document-wide matching (recommended for T1), or per-subpath sections? Per-section needs a
  `pricing-renderer/react/headless` heading first (P3-15b).
- Q3 (owner, CRP): does the O3 signal also cover type exports and element attributes, properties, events and
  parts (`INTENT.md:73-74`)? If yes, later slices extend the guard. T1 measures value exports only.
- Q4 (coordinator): add a requirement so T1 can carry a `[utest->...]` tag, or keep it untagged? Recommended:
  untagged, as in `docs/agent-work/prop-20261104-1/intake.md:157-160`.
- Q5 (owner, CRP): the O3 threshold for API reference coverage ("owner decision", `INTENT.md:75`). One
  proposal is 100% of value exports, with an empty `PENDING` list, after P3-15b.

## Followups outside scope

- Document the 11 undocumented names that no open slice clearly owns. They are the 9 core helpers outside
  the Phase 3 selection logic (`asRecord`, `cloneValue`, `deepEqual`, `getAtPath`, `isRecord`, `setAtPath`,
  `unwrapValue`, `humanizeIdentifier`, `createPriceStabilizer`) and the search-param pair. P3-15b's "core
  functions" may cover them; its contract should say so. Another option is to stop exporting the generic
  helpers, but that is a breaking change and the owner's decision.
- `loadPricingSource` (`src/yaml/index.ts:3`) is undocumented. The `pricing-renderer/yaml` section belongs to B2b
  (`pending-phases/plan.md:293`), not to P3-15b.
- The P3 checkboxes in `openspec/changes/add-react-headless/tasks.md` lag the merged PRs (#83, #84).
