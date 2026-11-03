# Intake: P-20261103-3, Phase 3 slice P3-3, selection search params in the core

- Proposal: P-20261103-3 (kind feature, size M, risk medium, owner-approved on 2026-11-03).
- Owner note: approved the first P3-3 PR (writer and reader of the search params) with a red test
  first, and the four URL-input limits in a second PR.
- Base: `c0c926d` (task branch `task/2d40bb5b7017406b`). Planner intake, 2026-11-03.
- INTENT link: **O3, "a stable public API and package across the integrations"**
  (`INTENT.md:62-64`). Phase 3 is "in progress" (`ROADMAP.md:197-201`).
- OpenSpec: no new change. The slices are tasks of the existing change `add-react-headless`. Its
  spec is merged (#73, `ROADMAP.md:198`), and the slice is defined at
  `openspec/changes/add-react-headless/tasks.md:129-143`.

## Objective

Add two DOM-free public functions to the core entry `pricing-renderer`:

- `selectionToSearchParams(selection, options?)`, which writes a selection as `[key, value]` pairs.
- `selectionFromSearchParams(pricing, params, options?)`, which reads it back through
  `applySelectionInput`.

The URL format is then fixed for the React hooks and examples. The format is in design.md D4
(`design.md:108-181`) and the spec is `specs/search-params/spec.md`.

## Verified facts (file:line at `c0c926d`)

- P3-1I is merged in full, including both halves of its split point:
  - `src/core/index.ts:11-19` exports `applySelectionChange`, `planSelectionChange`,
    `selectionInEffect`, `selectionWithAddOnQuantity`, `selectionWithVariable` and
    `createPriceStabilizer`.
  - `src/core/index.ts:8-10` exports `applySelectionInput`.
  - So the "after P3-1I merged" gate of P3-3 (`tasks.md:129`) is met.
- `src/core/search-params.ts` and `tests/unit/selection-search-params.test.ts` do not exist (glob
  `src/core/*.ts`).
- The spec has exactly 20 `req~search-params-*` requirements (`specs/search-params/spec.md:5-341`),
  the same list as `tasks.md:132-137`.
- Split point (`tasks.md:139-143`):
  - The first PR has every requirement except the four URL-input limits.
  - The second PR has `-var-length-limit~1`, `-var-depth-limit~1`, `-entry-limit~1` and
    `-diagnostic-id-length~2`.
  - The path, prototype-key and no-throw rules ship with the first reader (`tasks.md:140-141`).
- The root export `.` is `dist/core/index.js` (`package.json:32-36`), so the slice needs no
  `package.json` change.
- `tsc -b` (`package.json:133`) builds `tsconfig.core.json` (`tsconfig.json:4`), which has
  `"lib": ["ES2021"], "types": []` (`tsconfig.core.json:4-5`). `pnpm typecheck` is therefore the
  type half of `req~search-params-no-dom~1`.
- Helpers to reuse:
  - `applySelectionInput` (`src/core/apply-selection.ts:18-106`)
  - `createDefaultSelection` (`src/core/resolve.ts:16`)
  - `normalizeAddOnQuantity` (`src/core/resolve.ts:86`)
  - `cloneValue` (`src/core/utils.ts:60`)
- `setAtPath` / `pathSegments` (`src/core/utils.ts:79-84,150`) are not the reader's rules
  (`design.md:141-142`). The reader keeps its own stricter path split and check.
- `applySelectionInput` writes the full unknown id into the diagnostic `message` and `path`
  (`apply-selection.ts:35,73-74`). The 64-unit cut of `-diagnostic-id-length~2` therefore
  post-processes the returned diagnostics in `search-params.ts`, and `apply-selection.ts` stays
  untouched.
- `cloneValue` is recursive (`utils.ts:60-70`), and `applySelectionInput` clones its whole input
  (`apply-selection.ts:23`). See risk R1.
- Fixture: `tests/fixtures/acme-pricing.yml` has the variables `seats: 5`, `prioritySupport`,
  `region`, `priceByRegion` (`:13-17`), the plans starter, growth and enterprise (`:52-79`) and
  the add-ons extraStorage, compliance and prioritySuccess (`:95-119`). These match the spec
  scenarios.
- Test style to copy: `tests/unit/selection-change.test.ts:5-8` imports
  `* as core from '../../src/core/index.js'` and asserts `toBeTypeOf('function')` first (`:76`).
- No feature flag: design.md D10 (`design.md:447-451`). Release hold: `ROADMAP.md:165-176`.

## Scope

- `src/core/search-params.ts` (new), with the writer, the reader and the option types
  (`{ prefix?: string }` and `{ prefix?: string; current?: PricingSelection }`). It has
  `[impl->req~search-params-*]` tags.
- The exports of both functions and their option types in `src/core/index.ts`.
- `tests/unit/selection-search-params.test.ts` (new), with `[utest->req~search-params-*]` tags.
- `.changeset/selection-search-params.md` (minor), in the style of
  `.changeset/core-selection-logic.md`.

## Non-goals

- No change to `applySelectionInput`, `setAtPath`, `cloneValue` or any other existing export.
  The change is additive only (`tasks.md:15`).
- No element, React, docs or example change. React use comes in later slices (P3-7b, P3-13); the
  reference docs come in P3-15b (`tasks.md:412-420`).
- No new diagnostic code (`design.md:176`).
- No type check of variable values against `pricing.variables`
  (`req~search-params-var-type-unchecked~1`).
- No release and no `changeset version` (`ROADMAP.md:169-176`).
- No backlog item of the proposal: INTENT O4 signal, archiving `addon-marker-available-for`, and
  the `cta-href` test cases.

## Slices

There are two PRs into `develop`. Each PR is one T/I pair (test-designer, then implementer) plus a
how-to-test guide task. The tasks of one PR are not merged on their own, because the T task alone
would merge a failing test.

Order:

1. A-T, then A-I and A-G.
2. PR A merged.
3. B-T, then B-I and B-G.

Ownership:

- Within a PR, ownership is disjoint.
- Between PR A and PR B, the same files are edited in order. PR B starts only after PR A is
  merged.
- P3-2 (the element refactor) may run in parallel with either PR, because it owns only
  `src/element/pricing-renderer-element.ts` (`tasks.md:115`). Its file set does not overlap with
  these slices.

Shared-file order (adds to `tasks.md:428`):

- `src/core/index.ts`: P3-1I (merged), then A-I. PR B does not touch it.
- `tests/unit/selection-search-params.test.ts`: A-T, then B-T.
- `src/core/search-params.ts`: A-I, then B-I.
- `.changeset/selection-search-params.md`: A-I, then B-I.

Check arrays (from `tasks.md:30-48`):

- `install`: `["pnpm","install","--frozen-lockfile"]`
- `type`: `["pnpm","run","typecheck"]`
- `lint`: `["pnpm","run","lint"]`
- `test`: `["pnpm","run","test"]`
- `fmt`: `["pnpm","run","format:check"]`
- `pkg`: `["pnpm","run","package:check"]`
- `unit`: `["pnpm","exec","vitest","run","tests/unit/selection-search-params.test.ts"]`
- `red`: `{"argv":["pnpm","exec","vitest","run","tests/unit/selection-search-params.test.ts"],"type":"red_before","expect_exit":[1],"expect_pattern":"AssertionError|expected","reject_pattern":"Cannot find module|SyntaxError|is not a function","overlay":["tests/unit/selection-search-params.test.ts"],"gate":"G3"}`

### A-T: failing tests for the writer and reader (PR A)

- Role: test-designer. Model and effort: role default. Turn budget: 40.
- Owns: `tests/unit/selection-search-params.test.ts` (new).
- Read-only context:
  - this intake
  - `specs/search-params/spec.md:1-192,273-341`
  - `design.md:108-181`
  - `tasks.md:42-52`
  - `tests/unit/selection-change.test.ts:1-80`
  - `tests/fixtures/acme-pricing.yml`
- Requirements (16):
  - `req~search-params-write~1`
  - `-write-variables~1`
  - `-read~1`
  - `-read-addon-quantity-nan~1`
  - `-read-repeated-addon~1`
  - `-var-text~1`
  - `-var-type-unchecked~1`
  - `-var-path-safe~2`
  - `-var-path-split~1`
  - `-var-proto-keys~1`
  - `-read-no-throw~1`
  - `-unknown-ids~1`
  - `-prefix~1`
  - `-round-trip~2`
  - `-round-trip-variables~1`
  - `-no-dom~1`
- Content:
  - Every scenario of these requirements, 22 scenarios in total.
  - Import `* as core from '../../src/core/index.js'`.
  - In a `beforeAll`, assert `toBeTypeOf('function')` for both functions before any call, so
    the base fails by assertion and not by "is not a function" (`tasks.md:49-52`).
  - Each prototype test restores `Object.prototype` in `afterEach` if it was polluted.
  - Prefer table-driven cases to keep the size down (see Q1).
- Size: about 200-290 lines. Risk: **low** (score 0: tests only -2, floor 0).
- Checks: `install`, `red`, `lint`, `fmt`. Gates G3 and G6 (utest tags).
- Depends on: nothing beyond `c0c926d`.

### A-I: writer and reader (PR A)

- Role: implementer. Model and effort: role default. Turn budget: 40.
- Owns:
  - `src/core/search-params.ts` (new)
  - `src/core/index.ts` (the export lines only)
  - `.changeset/selection-search-params.md` (new, minor)
- Read-only context:
  - this intake
  - `design.md:108-181`
  - the spec lines of A-T
  - `src/core/apply-selection.ts`
  - `src/core/resolve.ts:16-100`
  - `src/core/utils.ts:60-160`
  - the frozen A-T test
- Content: D4 without the four limits.
  - One path split, with `[<digits>]` read as `.<digits>` and empty segments dropped. The check
    and the write use the same segments.
  - `__proto__` keys are dropped from parsed values without unbounded recursion (R1).
  - Only `Iterable<[string, string]>` and `[string, string][]` appear in the signatures.
  - The changeset names both functions and their options, and states that URL values are
    untrusted and must be revalidated on the server.
- Size: about 130-180 lines, tests excluded. Risk: **medium** (score 5):
  - public API and a public URL format: +3 (design.md R10, `design.md:565`)
  - external input (URL text): +2
  - Not counted as the pricing risk area, because it resolves no price and calls the existing
    `applySelectionInput`. If the coordinator counts it, the score is 8, the risk is high, and
    the panel grows.
- Checks: `install`, `type`, `lint`, `test`, `fmt`, `pkg`, `unit`. Gates G4 (runs the frozen
  A-T test) and G6 (impl tags).
- Depends on: A-T integrated and frozen.

### A-G: how-to-test guide (PR A)

- Role: demo-guide. Turn budget: 25.
- Owns: the change's `review/how-to-test.md` (path assigned by the coordinator, for example
  `docs/agent-work/prop-20261103-3/review/how-to-test.md`).
- Content: a Node snippet run after `pnpm build`, with these steps:
  - write the acme selection
  - pass it through `new URLSearchParams`
  - read it back
  - one negative case: `var.__proto__.isAdmin=true` leaves `Object.prototype` unchanged
- No UI and no HTTP API.
- Risk: **low** (docs only). Checks: the project's G13 guide check. Gate G13.
- Depends on: A-I integrated.

### B-T: failing tests for the four URL-input limits (PR B)

- Role: test-designer. Turn budget: 30.
- Owns: `tests/unit/selection-search-params.test.ts`. It adds a block and changes no existing
  test of A-T.
- Requirements:
  - `req~search-params-var-length-limit~1`
  - `-var-depth-limit~1`
  - `-entry-limit~1`
  - `-diagnostic-id-length~2`
- Spec lines: `spec.md:193-271`, six scenarios.
- Content and pitfalls:
  - Entry limit: the "endless" generator must stop by itself, for example after 10,000 yields.
    It counts pulls, and the test asserts `pulled <= 100`. On the base (PR A merged), the reader
    takes all 10,000 entries and fails by assertion. A truly endless generator would hang the
    red check until its timeout.
  - Length limit: on the base, the 20,000-bracket value may end in a `RangeError` (R1) instead of
    an assertion. The other new tests fail by assertion, so `expect_pattern` still matches. Put
    the length case in its own `it` so the other cases still run.
- Size: about 90-130 lines. Risk: **low** (score 0).
- Checks: `install`, `red` (same array), `lint`, `fmt`. Gates G3 and G6.
- Depends on: PR A merged into `develop`.

### B-I: URL-input limits (PR B)

- Role: implementer. Turn budget: 30.
- Owns: `src/core/search-params.ts` and `.changeset/selection-search-params.md` (add the limits to
  its text, because it is still pending and unreleased).
- Content (`design.md:153-162`):
  - Check `value.length > 2048` before `JSON.parse`.
  - Ignore a path of more than 8 segments, and a value with a depth above 8.
  - Stop the iteration after 100 entries.
  - Cut unknown ids to 64 code units, or 63 when the 64th is a high surrogate, in the `message`
    and `path` of the returned diagnostics, after matching the whole id.
- Size: about 50-80 lines. Risk: **medium** (score 5: a public API contract +3 and external
  input +2).
- Checks: `install`, `type`, `lint`, `test`, `fmt`, `pkg`, `unit`. Gates G4 and G6.
- Depends on: B-T integrated and frozen.

### B-G: how-to-test guide update (PR B)

- Same owner file as A-G, which is merged by then.
- Adds a 2,049-unit value and the 100-entry cut as negative cases.
- Risk: **low**. Gate G13.

## Gates per slice

The skills I read for this intake define G3, G4 and G13 (`factory:qa-checks`). For the others I
keep the mapping of the earlier intake (`docs/agent-work/prop-20261026-3/intake.md:199-220`). G5
and G7 are not defined in the skills I read, so the coordinator maps them.

| Gate                  | A-T / B-T                 | A-I / B-I                                        | A-G / B-G     |
| --------------------- | ------------------------- | ------------------------------------------------ | ------------- |
| G1 openspec --strict  | change level              | change level                                     | change level  |
| G2 EPIC review        | done for #73              | done for #73                                     | N/A           |
| G3 red-before         | applies (`red`)           | N/A                                              | N/A           |
| G4 acceptance freeze  | frozen after integration  | runs the frozen test                             | N/A           |
| G5, G7                | coordinator maps          | coordinator maps                                 | coordinator   |
| G6 trace              | utest tags                | impl tags; trace passes at change level          | N/A           |
| G8 mutation           | N/A                       | if registered for `src/core`                     | N/A           |
| G9 deps and licence   | N/A (no dependency)       | N/A (no dependency)                              | N/A           |
| G10 secrets           | if registered             | if registered                                    | if registered |
| G11 review            | test-reviewer             | medium panel with a security-auditor (R2)        | one reviewer  |
| G12 ui-qa             | N/A                       | N/A (no UI)                                      | N/A           |
| G13 how-to-test       | N/A                       | via A-G / B-G                                    | applies       |

G1 is `["openspec","validate","add-react-headless","--strict"]` (`tasks.md:38-40`).

## Feature flags

None. This follows design.md D10 (`design.md:447-451`): the functions are new, nothing calls
them, and the release hold (`ROADMAP.md:169-176`) keeps PR A unpublished until PR B lands. PR B
must merge before any release, and the coordinator records this in the change's handoff.

## Risks

- R1. Interim no-throw gap. `cloneValue` recurses (`utils.ts:60-70`) on the whole input
  (`apply-selection.ts:23`). Between PR A and PR B, a very deep JSON value with no length or depth
  limit might overflow the stack. That would break `req~search-params-read-no-throw~1`, which
  ships in PR A. I have not verified at what depth V8 overflows.
  - Mitigation: A-I drops `__proto__` keys without recursion, the release hold, and PR B right
    after PR A.
  - The owner may instead move `-var-depth-limit~1` into PR A (Q2).
- R2. Prototype pollution through `var.<path>` and JSON values (spec `:114-177`).
  - Mitigation: one split for check and write, own-key reads, a security-auditor on A-I.
- R3. PR A size (Q1).
- R4. The URL format becomes public (design.md R10). Mitigation: D4 is fixed in the spec, and any
  later change needs a new revision.

## Open questions

- Q1 (CRP only if needed): PR A is likely about 330-470 diff lines with tests. The slice rule is
  about 300 (`tasks.md:5-6`), and the P3-3 split point is already used (`tasks.md:139-143`).
  - First, A-T keeps its tests table-driven. This is not an owner decision.
  - If the integrated PR A is still over about 300 lines, the coordinator asks the owner to choose:
    - (A) a size waiver for PR A at its measured size. This is my recommendation: it keeps the
      approved writer-and-reader-together plan.
    - (B) a further split: the writer and its requirements first, then the reader with its
      safety rules.
- Q2 (no CRP recommended; the owner may veto in review): accept the R1 interim gap while PR A is
  merged and unreleased, or pull `req~search-params-var-depth-limit~1` into PR A, which changes
  the approved split.

Needs for the coordinator (not owner decisions):

- Assign the task ids and the `review/how-to-test.md` path of A-G and B-G.
- Register the `red` check with its overlay for A-T and again for B-T, whose base includes PR A.
- Confirm that no task in flight owns `src/core/index.ts`. I could not read the task events.

## Followups outside scope

- `tasks.md:7`, `proposal.md:116` and `design.md:450` cite the release hold as
  `ROADMAP.md:137-148`. It is now at `ROADMAP.md:165-176`.
- `tasks.md:75,84` leave P3-1T and P3-1I unticked, although #74 is merged (`ROADMAP.md:199`).
- `docs/agent-work/phase3-react-headless/plan.md:1` gives the order "P3-2 -> P3-3", while
  `tasks.md:129,424-425` runs P3-3 in parallel with P3-2. This intake follows tasks.md.
- `docs/agent-work/phase3-react-headless/handoff.md` still describes the state before #73 and #74
  merged.
