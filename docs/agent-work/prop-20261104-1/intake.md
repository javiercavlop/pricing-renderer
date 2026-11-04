# Intake: P-20261104-1, render tests for unsafe `docUrl` and `metadata.url`

- Proposal: P-20261104-1 (kind maintenance, size S, risk low, auto-approved).
- Base: `fe7bfe9` (task branch `task/603f2ede60954461`). Planner intake, 2026-11-04.
- INTENT link: **O3, "a stable public API and package across the integrations"** (`INTENT.md`, objective O3;
  `ROADMAP.md` lists O3 under the same name).
- OpenSpec: no new change is needed for the test itself (see Q1). There is no behaviour change, no spec delta
  and no `acceptance/**` file.

## Objective

Pin with render tests what the pending changeset promises: comparison-row documentation links and the
metadata URL that start with `//` or `/\` are not rendered as links (`.changeset/safe-link-other-host-paths.md:5`).
A refactor of either render path must then fail a test before the next release.

## Verified facts (file:line at `fe7bfe9`)

- The two guards:
  - `src/element/renderers.ts:812-816`: `row.docUrl && isSafeLink(row.docUrl)` renders
    `<a href=${row.docUrl} target="_blank" rel="noopener noreferrer">` with the text `pricing.documentation`.
  - `src/element/renderers.ts:1547-1558`: `metadata.url && isSafeLink(metadata.url)` renders the
    `<div><dt>URL</dt><dd><a href=${metadata.url} ...>${metadata.url}</a></dd></div>` row.
- **The doc link exists only in the compact layout.** `:812` is inside `renderCompactComparison` (`:773`).
  `renderTableComparison` (`:868`) has no `docUrl` use (the only `docUrl` hits in `src/` are `:812-813`,
  `src/core/normalize.ts:183`, `src/core/view-model.ts:348` and the types). `renderComparison` picks the
  layout with `state.compact` (`:997-999`). A test with `compact: false` would pass even without the guard.
- **The metadata block exists only in catalog mode.** `renderCatalogMetadata` returns `nothing` unless
  `viewModel.mode === 'catalog'` (`:1524`). The mode comes from `createPricingViewModel(..., { mode })`
  (`src/core/view-model.ts:459`, `src/core/types.ts:344`); the default is `'commercial'`.
- Input path: `normalize.ts:183` copies `docUrl` from a feature and `normalize.ts:559` copies `url` from the
  pricing, both through `asString`, which trims (`src/core/utils.ts:11-13`). So leading spaces, tabs or
  newlines are trimmed before render, while a tab between the slashes (`/\t/evil.example`) stays.
  `view-model.ts:348` passes `docUrl` on to the comparison row.
- `isSafeLink` (`src/core/view-model.ts:600-607`) rejects `//` and `/\` after removing tab, CR and LF (`:605`).
  Its unit tests are `tests/unit/cta-href.test.ts:50-105`. They call the function only, not the renderers.
- No render test with an unsafe value: in `tests/`, `docUrl` appears only in the fixtures
  `tests/fixtures/acme-pricing.yml:26` and `tests/fixtures/spectra/wrike/2024.yml:19,423` (all `https`) and in
  the key list `tests/unit/addon-marker.test.ts:654`. A metadata `url` appears only in
  `tests/fixtures/stress/build.ts:493` (`https`). No test calls `renderCatalogMetadata`.
- Pattern to copy: `tests/unit/row-descriptions.test.ts:1-69` imports `renderComparison` and the
  `RenderState`/`RenderActions` types from `src/element/renderers.js`, builds a `RenderState` with a no-op
  `actions` object and `compact` as a parameter, and reads the lit template with a `flatten` helper, because
  Vitest runs in `node` without a DOM (`vitest.config.ts:5`). The build of a pricing from an inline object with
  `normalizePricing` is at `tests/unit/cta-href.test.ts:21-26`.
- `flatten` joins template strings and values, so a rendered link reads as `<a href=<value> target="_blank"`.
  An unsafe value is not interpolated anywhere else in either block, so its absence from the flattened text
  is a strong check.
- No requirement id covers the two render call sites. `req~cta-href-template-unsafe~1`
  (`openspec/changes/add-subscription-change-flow/specs/plan-cta/spec.md:177-186`) is about plan CTAs only, and
  `grep 'docUrl|metadata URL|req~safe-link' openspec/` finds nothing. Untagged unit tests already exist
  (`tests/unit/row-descriptions.test.ts` has no `utest->` tag).
- The file name `tests/unit/*link*.test.ts` is free (glob finds none).

## Scope

- One new file, proposed name `tests/unit/unsafe-render-links.test.ts`, with:
  - a compact comparison row whose `docUrl` is `//evil.example`, and one with `/\evil.example`, renders no
    link with that `href` (and no `evil.example` text);
  - a catalog-mode metadata block whose `url` is `//evil.example` renders no URL row (no `<dt>URL</dt>`, no
    `evil.example`);
  - controls: an `https://` `docUrl` renders `href=https://...` with `target="_blank"` and
    `rel="noopener noreferrer"`, and an `https://` metadata URL renders the URL row.

## Non-goals

- No change to `src/**`, `isSafeLink`, the public API, dependencies, CI, `.changeset/**`, docs or fixtures.
- No `acceptance/**`, no `openspec/specs/**`, no new OpenSpec change (unless Q1 decides otherwise).
- No browser (Playwright) test. The node render test covers both call sites at the template level.
- No new cases for `isSafeLink` itself (already in `cta-href.test.ts:69-87`).
- No change to the table layout, which does not render `docUrl` at all.

## Slices

One slice. It is one capability (a coverage gap), well under 300 lines, and owns one new file, so there is no
parallel work and no shared-file order.

### T1: render tests for unsafe doc and metadata links

- Role: test-designer (writes `tests/unit/**`, not `acceptance/**`). Model and effort: role default.
  Turn budget: 25.
- Owns: `tests/unit/unsafe-render-links.test.ts` (new). Nothing else.
- Read-only context:
  - this intake;
  - `src/element/renderers.ts:773-866,974-1004,1522-1562`;
  - `src/core/view-model.ts:426-462,600-607`, `src/core/normalize.ts:160-190,553-563`, `src/core/utils.ts:11-13`;
  - `tests/unit/row-descriptions.test.ts:1-69` (state, actions, `flatten`);
  - `tests/unit/cta-href.test.ts:20-48` (inline `normalizePricing`);
  - `.changeset/safe-link-other-host-paths.md`.
- Content and pitfalls:
  - Use `compact: true` for every `docUrl` case. Optionally add one `compact: false` case that states the
    table layout has no doc link, so a reader does not take a green table test for coverage.
  - Pass `{ mode: 'catalog' }` to `createPricingViewModel` for the metadata cases; the control must show
    that the URL row renders in catalog mode, otherwise the negative case passes for the wrong reason.
  - Build the pricing through `normalizePricing` (inline object, as `cta-href.test.ts:22-26`) or
    `parsePricingYaml`, so the values go through `normalize.ts:183,559` like real input. Overriding the view
    model, as `row-descriptions.test.ts:71-88` does, skips that path; use it only if normalization gets in
    the way, and say so in a comment.
  - Value table: `//evil.example`, `/\evil.example`, and `/\t/evil.example` (tab between the slashes survives
    `asString`). Leading-whitespace variants are trimmed by `asString` before render and add nothing here.
  - Assert on `href=//evil.example` absence and on `evil.example` absence; each control asserts the presence of
    the `https` `href` and of the documentation text or `<dt>URL</dt>`, so the test fails if the block is not
    rendered at all.
  - No `[utest->...]` tag unless Q1 adds a requirement. A short comment cites the changeset line instead.
- Size: about 80-130 lines. Risk: **low** (score 0: tests only, no `src/`, API, dependency or CI change, and
  no risk area).
- Checks (arrays as in the earlier intakes, `docs/agent-work/prop-20261103-3/intake.md:118-126`; the
  coordinator registers them):
  - `install`: `["pnpm","install","--frozen-lockfile"]`
  - `unit`: `["pnpm","exec","vitest","run","tests/unit/unsafe-render-links.test.ts"]`
  - `test`: `["pnpm","run","test"]`
  - `lint`: `["pnpm","run","lint"]`
  - `fmt`: `["pnpm","run","format:check"]`
  - `type`: `["pnpm","run","typecheck"]` (only useful if the `tsc -b` project includes `tests/`; not verified)
  - Optional guard-removal proof (see G3 below): the usual `red_before` check overlays the new test on the
    base, and here the base already has the guards, so it would pass rather than fail. The proof would need a
    check that runs the test against a copy of `src/element/renderers.ts` without the two `isSafeLink` calls,
    or a mutation check (G8). I have not verified that the check runner supports either; the coordinator
    decides (Q2).
- Depends on: nothing beyond `fe7bfe9`. The guards are already in `develop` (#79, `f3302b2`).
- PR: T1 alone is one PR into `develop`. It is green on the base by design.

## Gates per slice

The mapping follows the earlier intakes (`docs/agent-work/prop-20261103-3/intake.md:259-280`,
`docs/agent-work/prop-20261103-1/intake.md:196-217`). G5, G7 and G10 are not defined in any file I read.

| Gate                 | T1                                                                              |
| -------------------- | ------------------------------------------------------------------------------- |
| G1 openspec --strict | N/A (no change, unless Q1)                                                      |
| G2 EPIC review       | N/A                                                                             |
| G3 red-before        | N/A in the usual sense: the code exists, so the test is green on the base. See the optional guard-removal check, and the test-reviewer confirms each negative case has a matching positive control |
| G4 frozen tests      | N/A (no implementation slice follows)                                           |
| G5, G7, G10          | coordinator registry                                                            |
| G6 trace             | no tag (no requirement); trace must still pass at project level                 |
| G8 mutation          | if registered for `src/element`; it would kill the removal of either guard      |
| G9 deps and licence  | N/A (no dependency)                                                             |
| G11 review           | one test-reviewer                                                               |
| G12 ui-qa            | N/A (no UI change)                                                              |
| G13                  | n/a with a how-to-review: read the test file, run `unit`, and optionally delete `&& isSafeLink(...)` at `renderers.ts:812` or `:1548` locally to see the test fail |

## Feature flags

None. One slice, tests only, no runtime behaviour.

## Risks

- R1. False green: a `docUrl` test in table layout, or a metadata test in commercial mode, passes without the
  guard. Mitigation: `compact: true`, `mode: 'catalog'` and positive controls in the same file (T1 content).
- R2. Template-text assertions depend on lit's string split (`<a href=` then the value). A harmless markup
  change in the renderer could break the positive control. Mitigation: assert on `href=<value>` and on the
  value, not on whole markup lines.
- R3. Without G3, nothing proves the negative cases can fail. Mitigation: the positive controls, the
  test-reviewer, and the optional guard-removal check or G8.

## Open questions

- Q1 (coordinator decision, no CRP recommended): should the two render call sites get a requirement so the
  tests can carry `[utest->...]` tags? There is none today. Options: (A) no requirement, untagged tests, as
  the proposal says "tests only" and untagged tests exist (recommended); (B) a small spec-only OpenSpec change
  with one requirement for doc and metadata links, as an S0 slice before T1. B changes `openspec/changes/**`
  and adds G1 and G2.
- Q2 (coordinator, no CRP): register the optional guard-removal red check, or rely on G8 and review.

No question needs an owner CRP: no public API, schema, dependency, threshold or release decision is involved.

## Followups outside scope

- `.changeset/safe-link-other-host-paths.md:5` says "comparison-row documentation links ... are no longer
  rendered as links", but the table layout never rendered them (`renderers.ts:868-972` has no `docUrl`). The
  text is right for the compact layout only. Not a defect; a docs owner may want to know.
- `docs/agent-work/prop-20261101-3/handoff.md:23` cites the metadata guard at `renderers.ts:1534`; it is now at
  `:1548`.
