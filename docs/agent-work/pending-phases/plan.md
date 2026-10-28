# Plan: pending phases 1a, 1b, 1c and 3 of pricing-renderer

- Planner audit and plan, 2026-10-28. Read-only: no code, spec or test was changed.
- Base: `85bb102` (develop, "Enforce maxBytes and timeoutMs while a pricing is loading (#70)"). Every
  `file:line` below is at this base.
- Sources: `docs/agent-work/inbox/` does not exist in this worktree, so the owner requests were read
  from what the repository holds:
  - Phase 1a, `own-bae08f30d9784ccc837fdb6594a70581`: items 1-9 as listed in
    `docs/agent-work/phase1a-design-system/intake.md:12-17` and
    `openspec/changes/phase1a-design-systems/proposal.md:10-15`.
  - Phase 1b, `own-0a8bc0e65ad74eec86dcfa5c8c0ebf1a`: items 1-5 of
    `docs/agent-work/phase1b-private-pricings/intake.md:12-19`.
  - Phase 1c, `own-6a1956f04e014f038ba0739cdb0b96f8`: no intake names this id. It is read as the UX
    review proposals UX-1 to UX-11 (`docs/agent-work/ux-review/report.md:341-578`,
    `ROADMAP.md:82-121`). If the request numbers its items differently, the mapping in section 1.3
    has to be redone.
  - Phase 3, `own-3f3b38da4a6a49c9a91ffff65873a31d`: **no text of this request is in the
    repository.** The only references are `ROADMAP.md:164` ("Phase 3, React headless and
    composition. State: not started") and
    `openspec/changes/add-subscription-change-flow/proposal.md:120` ("Hooks and providers
    (`usePricing…`, context providers): Phase 3"). Its numbered items cannot be audited (section 1.4).

## 1. Audit at `85bb102`

States: DONE (in the code, with a test), PARTIAL, NOT STARTED.

### 1.1 Phase 1a, design systems (merged as PR 65, commit `e68e0bc`, `ROADMAP.md:157-158`)

- Item 1, design-systems guide: **DONE**.
  - Code: `docs/design-systems.md` covers Tailwind v3 (`:12`), Tailwind v4 (`:80`), CSS Modules
    (`:107`), the token mapping (`:142`), fonts (`:215`), dark mode (`:240`), density (`:316`), state
    attributes (`:333`) and breakpoints (`:358`). Also `docs/theming.md`.
  - Tests: `tests/unit/design-systems-docs.test.ts`, `tests/browser/host-reset.spec.ts:5`.
- Item 2, `tokens-shadcn.css`: **DONE**.
  - Code: `src/styles/tokens-shadcn.css`, exported at `package.json:63`.
  - Tests: `tests/unit/tokens-shadcn.test.ts`, `tests/browser/theme-files.spec.ts`.
- Item 3, optional tokens: **DONE**.
  - Code: `src/styles/base.css` uses each token with a fallback:
    - font family `:10` and line height `:12`;
    - weights, for example `:133,429,681,946`;
    - sticky top `:755,1489`;
    - table `:901,908`;
    - dialog `z-index: var(--pr-z-dialog, 1000)` `:1327`;
    - plan columns `:298,1387-1560`.
  - Tests: `tests/unit/design-tokens.test.ts`, `tests/unit/plan-grid-columns.test.ts`,
    `tests/browser/design-tokens.spec.ts`.
- Item 4, host `.dark` class: **DONE**.
  - Code: `src/styles/theme.css:48-50`. It applies only with `theme="auto"`, which is the owner's
    CRP-B answer, option (b) (`openspec/changes/phase1a-design-systems/design.md:380-387`).
  - Tests: `tests/unit/host-dark-class.test.ts`, `tests/browser/theme-files.spec.ts`.
- Item 5, density: **DONE**, spacing only, as accepted in CRP-C.
  - Code: `src/styles/base.css:16-17`; `src/element/pricing-renderer-element.ts:151-154,243-262`;
    `src/react/index.ts:86-87`; `custom-elements.json`.
  - Tests: `tests/unit/density.test.ts`, `tests/browser/density.spec.ts`.
- Item 6, state attributes: **DONE**.
  - Code: `src/element/renderers.ts:355-383` (`data-kind`), `:429-430` (`data-current`,
    `data-featured`), `:1137-1148` (`data-available`).
  - Tests: `tests/unit/state-attributes.test.ts`.
- Item 7, `theme-minimal.css`: **DONE**.
  - Code: `src/styles/theme-minimal.css`, exported at `package.json:64`.
  - Tests: `tests/unit/theme-minimal.test.ts`, `tests/browser/theme-files.spec.ts:291-316`.
- Item 8, React `style` prop: **DONE**.
  - Code: `src/react/index.ts:95-109` (`className`, and `style?: PricingRendererStyle` with `--*`
    keys).
  - Tests: `tests/unit/react-style-prop.test.ts`.
- Item 9, theme builder demo: **DONE**.
  - Code: `examples/vanilla/theme-builder.html`; `examples/vanilla/src/theme-builder.ts:9`; the build
    input at `examples/vanilla/vite.config.ts:20`; the nav link at `examples/vanilla/index.html:26`.
  - Tests: `tests/browser/theme-builder.spec.ts:3`.

Phase 1a leftovers (none of them is a missing item):

- L1. The OpenSpec change is not archived. Every box in
  `openspec/changes/phase1a-design-systems/tasks.md:33-106` is unchecked, and `openspec/specs/` does
  not exist (glob). This is bookkeeping for an explicit archive task.
- L2. The theme builder page has no entry in the docs. A grep for `theme.builder` in `docs/` outside
  `docs/agent-work/` finds nothing, but `tasks.md:108` says the page "is documented in
  `docs/design-systems.md`".
- L3. Open owner question from the lead's last checkpoint
  (`docs/agent-work/phase1a-design-systems/handoff.md:1`). The shadcn overlay's dark mode gives a
  mixed palette in two cases (`docs/design-systems.md:301-311`, asserted by
  `tests/unit/design-systems-docs.test.ts:140`). It is documented, not fixed.
- L4. Compact density changes spacing only. Compact type sizes were deferred to "a later change with
  its own owner decision" (`design.md:267-269`). The owner accepted CRP-C unchanged (`design.md:388-389`).
  So the density part of Q-G (`ux-review/report.md:639-640`) is answered. Two sub-questions remain
  (section 3, O-1b and O-1c).

### 1.2 Phase 1b, loading public and private pricings

Nothing is implemented. The owner has not answered CRP-1 or CRP-2 (`ROADMAP.md:159-160`,
`docs/agent-work/phase1b-private-pricings/handoff.md:3`).

- Item 1, security guide `docs/private-pricings.md`: **NOT STARTED**. The file is absent (glob
  `docs/*.md`). `README.md:387-401` still shows `credentials: 'include'` with a bearer token. That is
  the example the intake wants replaced (`intake.md:42-43`).
- Item 2, `createSpherePublicLoader` in `pricing-renderer/yaml`: **NOT STARTED**. A grep for `sphere`
  in `src/` finds nothing. `src/yaml/` holds only `index.ts`, `load.ts`, `parser.ts` and `types.ts`.
- Item 3, ETag cache hook for the `src` loader: **NOT STARTED**. A grep for `etag`, `If-None-Match`
  or `cache` in `src/` finds nothing (only `normalizeTags`).
- Item 4, `docs/nextjs.md`: **NOT STARTED**. The file is absent.
- Item 5, `docs/pricing-versions.md` (the owner-decided policy): **NOT STARTED**. The file is absent.

What changed since the intake (base `465e248`):

- `enforce-load-limits` (#70) rewrote the load steps of `src/yaml/load.ts`. Every awaited step now
  races `timeoutMs` and the signal, and the body is counted while it is read
  (`openspec/changes/enforce-load-limits/proposal.md:31-46`). The SPHERE loader (B2b) should reuse
  those helpers instead of the `:22-40` helpers that the intake names.
- The intake's README line numbers are stale. "Private remote sources" is now `README.md:387-412`.
  The docs list moved too.
- Loader error text still reaches the diagnostics. `src/yaml/load.ts:220-221` copies
  `error.message`, and the error state lists `item.message` under "Technical details"
  (`src/element/pricing-renderer-element.ts:1093`). Followup F1 of the intake still stands, and the
  guide must keep its "no secrets in error messages" rule.
- `src` is still reflected (`pricing-renderer-element.ts:127`). Followup F2 still stands.

### 1.3 Phase 1c, UX review items (UX-1 to UX-11)

Nothing has started. This matches `ROADMAP.md:91-121`.

- UX-1, stress spec measurement extension: **NOT STARTED**.
  - `tests/browser/ux-stress.spec.ts:223` keeps the old formula `rows.length > 1 && last === 1`,
    with no `gridColumns > 1` guard.
  - There are still only 2 variants (`:25-28`).
  - `tests/fixtures/stress/metrics.ts` and `tests/unit/ux-stress-metrics.test.ts` are absent.
  - The spec never calls `measureText` or `revealAllRows`.
- UX-2, unit-level counts: **NOT STARTED**. `tests/unit/ux-counts.test.ts` is absent, and no
  `UX_COUNTS` output exists.
- UX-3, narrow top compaction: **NOT STARTED**. `src/styles/base.css` has only `min-width` container
  queries (`:1385,1419,1522,1535,1551`). There is no compaction rule below 840 px.
- UX-4, CTA under the price: **NOT STARTED**. The plan CTA is still pushed down with
  `margin-block-start: auto` (`base.css:585-588`). No `subgrid` is used.
- UX-5, narrow plan cards with closed highlights: **NOT STARTED**. There is no `pr-plan-details`. The
  plan description and highlights render in the card for every plan count (`renderers.ts:498`).
- UX-6, smaller narrow row cap: **NOT STARTED**. The cap is fixed at 30 whatever the layout:
  `group.rows.slice(0, 30)` (`renderers.ts:703`).
- UX-7, add-on marker aware of `availableFor`: **NOT STARTED**. `isAddOnOnlyRow` checks the row
  against all add-ons and ignores `availableFor` (`src/core/view-model.ts:611-620`). There is no
  `addOnProvidesForPlan`.
- UX-8, add-on filter for the selected plan: **NOT STARTED**. There is no
  `pricing.onlyAvailableAddOns` key in `src/core/i18n.ts`.
- UX-9, filler descriptions for plans and add-ons: **NOT STARTED**. Plan and add-on descriptions
  render whenever they are non-empty (`renderers.ts:498,1165`). The filler check `rowDescription`
  (`:253`) covers rows only.
- UX-10, the stress spec asserts the targets: **NOT STARTED**. The spec records and asserts nothing
  beyond "renders" (`ux-stress.spec.ts:11-16`).
- UX-11, selected plan column: **NOT STARTED**. The table header is
  `<th scope="col">${plan.name}</th>` with no selected marker (`renderers.ts:879`). There is no
  `is-selected-plan`.

A constraint that the UX report predates:

- `ux-stress.spec.ts` and `spectra-review.spec.ts` run only in the `on-demand-specs` job, on
  `workflow_dispatch` (`.github/workflows/ci.yml:320-331`). `playwright.config.ts` ignores them in
  the PR shards.
- GitHub accepts a dispatch only once `ci.yml` is on the default branch (`ci.yml:325-326`,
  `ROADMAP.md:175`).
- No release to `main` happens until the owner says so (`ROADMAP.md:141-148`).
- The measurements that gate UX-3 to UX-11 therefore depend on a dispatch being possible (need N-CI,
  section 4).

### 1.4 Phase 3, React headless and composition

- All items: **NOT STARTED**, and the request text was not found, so no numbered item can be audited.
- Phase 3 is listed as not started at `ROADMAP.md:164`.
- The React adapter is two `@lit/react` wrappers only: `PricingRenderer` (`src/react/index.ts:31-121`)
  and `PricingChangeReview` (`:123-161`). It has no hook, no context provider and no composable part
  component.
- The headless core that Phase 3 would build on exists: `createPricingViewModel`, `resolvePricing`,
  `reconcileSelection`, `compareSelections` and related exports (`src/core/index.ts:1-45`).

## 2. Remaining work, sliced

### 2.1 Conventions

- Each slice is one PR into `develop`, at most about 300 diff lines (tests included unless stated),
  with one changeset if it touches `src/` or `package.json`. No release (`ROADMAP.md:141-148`).
- Code slices follow the phase 1a pattern: a test task with a red-before check first (G3), then an
  implementer task in the same PR, which touches no test file. "T/I" below means that pair.
- Owned globs never overlap between slices of the same wave. A file in two slices is edited in the
  stated order, after the earlier slice is merged (section 2.7).
- Committed visual baselines live in `tests/browser/pricing-renderer.spec.ts-snapshots/*.png`
  (`pricing-renderer.spec.ts:1344`, `playwright.config.ts:23`). A slice that moves them owns the files
  it moves. They change only through the registered update check, and only after the owner has
  approved the CRP screenshots. A worker never accepts them blind.
- No browser runs in the lab. Browser proof and CRP screenshots come from the CI `browser-shards`
  (PR) or `on-demand-specs` (dispatch) artifacts.
- `docs/agent-work/pending-phases/` is not in `.prettierignore`, so this plan must pass
  `prettier --check`.

### 2.2 Check arrays

Names used per slice below:

- `install`: `["pnpm","install","--frozen-lockfile"]`
- `type`: `["pnpm","run","typecheck"]`
- `lint`: `["pnpm","run","lint"]`
- `test`: `["pnpm","run","test"]`
- `fmt`: `["pnpm","run","format:check"]`
- `pkg`: `["pnpm","run","package:check"]` (`package.json:143`; builds into the git-ignored `dist/`)
- `demo`: `["pnpm","--filter","pricing-renderer-demo","build"]`
- `spec(<id>)`: `["pnpm","exec","openspec","validate","<id>","--strict"]`. This is the precedent of
  `docs/agent-work/prop-20261028-3/intake.md:109`. `openspec` is not in `package.json`, so the
  coordinator confirms that the lab provides the CLI before it registers this check.
- `unit(<files>)`: `["pnpm","exec","vitest","run",<files...>]`
- `red(<files>)`:
  `{"argv":["pnpm","exec","vitest","run",<files...>],"type":"red_before","expect_exit":[1],"expect_pattern":"AssertionError|expected","reject_pattern":"Cannot find module|SyntaxError|is not a function","overlay":[<files...>]}`.
  A test of a file that does not exist yet first asserts `existsSync(...)`, and a test of a missing
  export first asserts `toBeTypeOf('function')`, so the base fails on an assertion.
- `full` = install, type, lint, test, fmt.
- `docs` = install, test, fmt. The docs-examples test reads `README.md` and `docs/events.md`
  (`tests/unit/docs-examples.test.ts`).
- CI only: `browser-shards` on the PR; `on-demand-specs` by dispatch for `ux-stress.spec.ts`.

### 2.3 Phase 1a closeout

- **A1, archive `phase1a-design-systems`** (doc-steward, explicit archive task, risk low)
  - Owns: `openspec/changes/phase1a-design-systems/**` and
    `openspec/specs/{design-tokens,state-attributes,react-style-prop,theme-files,density,docs}/**`
    (new).
  - Content: tick `tasks.md` against the merged files of section 1.1, and move the six capability
    specs into the living specs.
  - Checks: install, `spec(phase1a-design-systems)` before the move, fmt.
  - Size: about 40 diff lines plus the moved specs (a move, not new text).
  - Depends on nothing. Wave 1.
- **A2, guide closeout** (doc-steward, risk low)
  - Owns: `docs/design-systems.md`.
  - Content: a short "Theme builder" section for L2. It covers the page, the presets
    `default`/`shadcn`/`minimal`, and the export box of `design.md:293-299`.
  - Size: about 25 lines.
  - Checks: docs. Wave 1.
- **A3, overlay dark palette** (T/I, risk medium; conditional on owner answer O-1a, section 3)
  - Owns: `src/styles/tokens-shadcn.css`, `tests/unit/tokens-shadcn.test.ts`,
    `tests/browser/theme-files.spec.ts`, `docs/design-systems.md` (after A2),
    `openspec/specs/theme-files/**` (after A1; spec delta first), and
    `.changeset/tokens-shadcn-dark.md`.
  - Runs only if the owner picks "the overlay follows `.dark` and the system scheme fully". That
    reverses the "no status token" SHALL. It is a visual change for overlay users, so the CRP needs
    screenshots.
  - Size: about 120 lines.
  - Checks: full, `pkg`, `red(tests/unit/tokens-shadcn.test.ts)`; CI browser-shards.
- **A4, compact type sizes** (T/I, risk medium; conditional on owner answer O-1b)
  - Owns: `src/styles/base.css` (the compact rule at `:16-17` only), `tests/unit/density.test.ts`,
    `tests/browser/density.spec.ts`, `openspec/specs/density/**` (after A1), and
    `.changeset/density-type-sizes.md`.
  - Needs the owner's compact `--pr-font-size-*` values, with screenshots at 1440 and 375.
  - Size: about 60 lines.
  - Order: `base.css` is serialized with U3, U4, U11 and U5 (section 2.7).
  - Checks: full, `red(tests/unit/density.test.ts)`; CI browser-shards.

### 2.4 Phase 1b, private pricings

This keeps the intake's slices (`docs/agent-work/phase1b-private-pricings/intake.md:128-353`) with
three updates:

- The spec is an OpenSpec change now that `openspec/changes/` exists.
- B2b reuses the `#70` helpers in `load.ts`.
- The README line numbers are refreshed.

Slices:

- **B0, spec** (specifier, risk medium; after CRP-1 and CRP-2)
  - Owns: `openspec/changes/add-private-pricing-loading/**`.
  - Content: the `req~sphere-*~1` and `req~src-cache-*~1` ids of `intake.md:224-291`, adjusted to the
    CRP answers.
  - Checks: install, `spec(add-private-pricing-loading)`, fmt.
- **B1, security guide** (doc-steward, risk high; panel: reviewer and security-auditor)
  - Owns: `docs/private-pricings.md` (new), the "Private remote sources" section of `README.md`
    (`:387-412`), one line in the README docs list, and `.changeset/docs-private-pricings.md` (patch).
  - Content: `intake.md:164-183`, with plain `fetch` recipes. Any private SPHERE credential format is
    checked by lookup before the guide names it.
  - Size: about 250 lines.
  - Checks: docs. Wave 1; it needs no CRP.
- **B5, versions guide** (doc-steward, risk medium)
  - Owns: `docs/pricing-versions.md` (new), `docs/preload-current-subscription.md` (one section), and
    `.changeset/docs-pricing-versions.md`.
  - Content: the owner policy of `intake.md:338-348`. It does not state the `SphereVersion` shape
    until N2 arrives.
  - Size: about 150 lines.
  - Checks: docs. Wave 1.
- **B2a, SPHERE loader tests** (implementer writing tests first, risk high)
  - Owns: `tests/unit/sphere-loader.test.ts` and `tests/fixtures/sphere/**`.
  - Fixtures are minimal YAML documents so the slice stays under 300 lines. Recorded responses come
    from N1, or are derived from SPHERE `8472610` and labelled so.
  - Checks: install, `red(tests/unit/sphere-loader.test.ts)` with the fixtures in the overlay, lint,
    fmt.
  - After CRP-1 (name and return shape).
- **B2b, SPHERE loader** (implementer, risk high, score 10; panel: reviewer, test-reviewer,
  security-auditor, arch-reviewer)
  - Owns:
    - `src/yaml/sphere.ts` (new) and `src/yaml/index.ts`;
    - `src/yaml/load.ts`, for the internal export of the abort, timeout and counted-read helpers only;
    - the `pricing-renderer/yaml` section of `docs/api-reference.md`;
    - `docs/architecture.md` (the "does not fetch on the server" sentence and the security
      boundaries);
    - `docs/events.md`, only if CRP-1 (i) picks new codes;
    - `.changeset/sphere-public-loader.md` (minor).
  - Size: about 240 lines.
  - Checks: full,
    `unit(tests/unit/sphere-loader.test.ts tests/unit/load.test.ts tests/unit/load-timeout.test.ts tests/unit/load-stream-max-bytes.test.ts tests/unit/docs-examples.test.ts)`,
    `pkg`.
  - After B0 and B2a.
- **B3a, cache hook tests** (risk high)
  - Owns: `tests/unit/load-cache.test.ts`.
  - Checks: install, `red(tests/unit/load-cache.test.ts)`, lint, fmt.
  - After CRP-2. Runs in parallel with B2b.
- **B3b, cache hook** (implementer, risk high, score 9; panel: reviewer, test-reviewer,
  security-auditor)
  - Owns: `src/yaml/load.ts`, `src/yaml/types.ts`, `src/yaml/index.ts`, the `LoadPricingOptions` list
    of `docs/api-reference.md`, and `.changeset/src-etag-cache.md` (minor).
  - Size: about 150 lines.
  - Checks: full,
    `unit(tests/unit/load-cache.test.ts tests/unit/load.test.ts tests/unit/load-timeout.test.ts tests/unit/load-stream-max-bytes.test.ts)`,
    `pkg`.
  - After B2b is merged; it shares three files with B2b.
- **B4, Next.js guide** (doc-steward, risk medium; panel: reviewer and security-auditor)
  - Owns: `docs/nextjs.md` (new), the "React and Next" section and the docs list of `README.md`,
    `docs/configuration.md` (the shared-SSR paragraph), one "See also" line each in
    `docs/private-pricings.md` and `docs/pricing-versions.md`, and `.changeset/docs-nextjs.md`.
  - Size: about 200 lines.
  - Checks: docs.
  - After B1, B2b and B5.

### 2.5 Phase 1c, UX items

Order:

1. Measure: U1a, U1b, U2, then the measurement run M1.
2. Cheap changes: U9, then U3.
3. CRP changes, in the report's order: U7, U4, U6, U11, U5, U8.
4. The assertions last: U10.

`src/element/renderers.ts` and `src/styles/base.css` are shared by most product slices, so those
slices form two chains (section 2.7). Only slices with disjoint files run side by side.

- **U1a, metric fix and first fields** (implementer, test only, risk low)
  - Owns: `tests/fixtures/stress/metrics.ts` (new), `tests/unit/ux-stress-metrics.test.ts` (new),
    `tests/browser/ux-stress.spec.ts`, and `tests/fixtures/stress/README.md`.
  - Content: three parts of UX-1:
    - (k) the pure `loneLastCard` function with `gridColumns > 1`;
    - (a) print `firstCtaBottom`, `cardWidths` and `layoutBreakdown`;
    - (c) section heights by `data-pr-part`.
  - Size: about 150 lines.
  - Checks: install, type, lint, `red(tests/unit/ux-stress-metrics.test.ts)`, test, fmt. In CI the
    spec runs only on dispatch.
  - Wave 1.
- **U1b, remaining measurements** (implementer, test only, risk low)
  - Owns: `tests/browser/ux-stress.spec.ts` (after U1a) and `tests/browser/helpers/spectra.ts`.
  - Content: UX-1 (b) and (d)-(j):
    - `measureText`, the expanded height, add-on rows and summary visibility;
    - `visiblePlanColumns` and the axe contrast scan;
    - `layout="table"` at 375;
    - the variants 1440 and 375 crossed with light `en` and dark `es`, plus 1024;
    - all six shapes behind an environment variable.
  - Size: about 200 lines.
  - Watch the job budget: `on-demand-specs` has `timeout-minutes: 50` (`ci.yml:333`) and a global
    timeout of 2400000 ms (`:350`).
  - Checks: install, type, lint, test, fmt.
- **U2, unit-level counts** (implementer, test only, risk low)
  - Owns: `tests/unit/ux-counts.test.ts` (new).
  - Content: UX-2 (a)-(d), printed as `UX_COUNTS` lines, with invariants only.
  - Size: about 200 lines.
  - Checks: install, type, lint, `unit(tests/unit/ux-counts.test.ts)`, test, fmt. Wave 1.
- **M1, measurement record** (doc-steward, docs only; after U1b is merged and one `on-demand-specs`
  run)
  - Owns: `docs/agent-work/ux-review/measurements.md` (new).
  - Content:
    - the new `SPECTRA_UX_SUMMARY` fields and the per-section heights;
    - the `layout="table"` against cards comparison at 375 (Q-C);
    - the go or no-go of each gate: UX-3 (price within the saving), UX-4 (highlight share), UX-7
      (count above 0, from U2) and UX-9 (fillers found, from U2).
  - Checks: install, fmt.
  - Blocked by N-CI if a dispatch is not possible.
- **U9, filler descriptions for plans and add-ons** (T/I, risk low, no CRP)
  - Owns: `src/element/renderers.ts`, `tests/unit/row-descriptions.test.ts`, and
    `.changeset/filler-plan-addon-descriptions.md`.
  - Size: about 60 lines.
  - Checks: full, `red(tests/unit/row-descriptions.test.ts)`; CI browser-shards with the baselines
    unchanged. The demo pricing is expected to have no filler; U2 confirms it.
  - Go only if U2 finds fillers.
- **U3, narrow top compaction** (T/I, risk low; CRP-U3 with screenshots, see section 3)
  - Owns: `src/styles/base.css`, `tests/unit/narrow-compaction.test.ts` (new),
    `tests/browser/pricing-renderer.spec.ts-snapshots/{mobile,tablet}-*.png`, and
    `.changeset/narrow-top-compaction.md`.
  - Size: about 60 lines plus baselines.
  - Checks: full, `red(tests/unit/narrow-compaction.test.ts)`; CI browser-shards, and the baseline
    update check after the CRP.
  - After M1.
- **U7, add-on marker aware of `availableFor`** (T/I, risk low; CRP-U7)
  - Owns: `src/core/view-model.ts`, `src/element/renderers.ts` (after U9),
    `tests/unit/addon-marker.test.ts`, a spec delta in
    `docs/agent-work/spectra-item6-addon-marker/spec.md` (R1, R3), and
    `.changeset/addon-marker-availability.md`.
  - Size: about 120 lines.
  - Checks: full, `red(tests/unit/addon-marker.test.ts)`; CI browser-shards
    (`spectra-addon-marker.spec.ts`).
  - Go only if U2 counts misleading cells above 0. It can run in parallel with U3 and U4, whose files
    are disjoint.
- **U4, CTA under the price from 840 px** (T/I, risk medium; CRP-U4 with screenshots)
  - Owns: `src/styles/base.css` (after U3), `tests/unit/plan-card-order.test.ts` (new),
    `tests/browser/plan-cta-alignment.spec.ts` (new),
    `tests/browser/pricing-renderer.spec.ts-snapshots/{table-840,desktop}-*.png`, and
    `.changeset/plan-cta-under-price.md`.
  - Size: about 120 lines.
  - Checks: full, `red(tests/unit/plan-card-order.test.ts)`; CI browser-shards, with the baseline
    update after the CRP.
  - After M1 confirms that the highlight list is a large part of the card height.
- **U6, narrow comparison cap of 10** (T/I, risk medium; CRP-U6 with screenshots)
  - Owns: `src/element/renderers.ts` (after U7), `tests/unit/shorter-page.test.ts`,
    `tests/browser/pricing-renderer.spec.ts-snapshots/{mobile,tablet}-*.png` (after U3, and only if
    the demo has a group of more than 10 rows), and `.changeset/compact-row-cap.md`.
  - Size: about 90 lines.
  - Checks: full, `red(tests/unit/shorter-page.test.ts)`; CI browser-shards.
  - After M1 and Q-C. The owner may prefer the table at narrow widths instead.
- **U11, selected plan column** (T/I, risk low; CRP-U11 with screenshots)
  - Owns: `src/element/renderers.ts` (after U6), `src/styles/base.css` (after U4),
    `tests/unit/selected-plan-column.test.ts` (new),
    `tests/browser/pricing-renderer.spec.ts-snapshots/{table-840,desktop}-*.png` (after U4), and
    `.changeset/selected-plan-column.md`.
  - Size: about 90 lines.
  - Checks: full, `red(tests/unit/selected-plan-column.test.ts)`; CI browser-shards, with the
    baseline update after the CRP.
- **U5, narrow plan cards with closed highlights** (T/I, risk medium; CRP-U5 with screenshots)
  - Owns: `src/element/renderers.ts` (after U11), `src/styles/base.css` (after U11),
    `tests/unit/plan-details.test.ts` (new), and `.changeset/narrow-plan-details.md`.
  - The baselines are expected not to move, because the demo has 3 plans
    (`ux-review/report.md:439-441`).
  - Size: about 180 lines.
  - Checks: full, `red(tests/unit/plan-details.test.ts)`; CI browser-shards.
  - After M1 and Q-B.
- **U8, add-on filter for the selected plan** (T/I, risk low; CRP-U8, which the owner may waive as
  additive)
  - Owns: `src/element/renderers.ts` (after U5), `src/element/pricing-renderer-element.ts`,
    `src/core/i18n.ts`, the add-on grid section of `docs/api-reference.md` (after B3b),
    `tests/unit/addon-grid-filter.test.ts`, and `.changeset/addon-filter-selected-plan.md`.
  - Size: about 150 lines.
  - Checks: full, `red(tests/unit/addon-grid-filter.test.ts)`, `pkg`; CI browser-shards.
- **U10, the stress spec asserts the targets** (implementer, test only, risk medium)
  - Owns: `tests/browser/ux-stress.spec.ts` (after U1b) and
    `docs/agent-work/ux-review/thresholds.md` (new).
  - Content: it asserts only the owner-approved thresholds:
    - page height at most 5 screens at 1440 (Q2, `ROADMAP.md:126`);
    - the CTA in the first screen at 1440 and 375 (Q3, `ROADMAP.md:127`);
    - a margin taken from at least 5 runs.
  - Size: about 150 lines.
  - Checks: install, type, lint, test, fmt; CI on-demand-specs.
  - Last. It depends on Q-F: the spec does not run on PRs today (`ci.yml:320-331`), so an assertion
    there guards nothing unless the owner moves it into the shards.

### 2.6 Phase 3, React headless and composition

These slices are provisional. Without the request text (section 1.4) only an intake can be planned.
The rest is a placeholder shaped by the repository, and P3-0 replaces it.

- **P3-0, intake** (planner, risk low)
  - Owns: `docs/agent-work/phase3-react-headless/**`.
  - Input: the full text of `own-3f3b38da4a6a49c9a91ffff65873a31d` (need N-P3).
  - Output: the numbered items and the verified facts, CRP-P3 (the public API shape), and the slices.
    The facts include:
    - unit tests run in `node` (`vitest.config.ts:5-6`);
    - `react-dom` 19 is a dev dependency (`package.json:114`), but no DOM test environment exists.
      Hook tests therefore use `react-dom/server`, or they need a dependency change with a lockfile
      check.
  - Checks: install, fmt.
- Provisional capabilities, for sizing only:
  - P3-1, spec: `openspec/changes/add-react-headless/**`.
  - P3-2, data hooks over the core: for example a view-model hook and a selection hook in
    `src/react/hooks.ts` (new), exported from `src/react/index.ts`.
  - P3-3, a context provider and composable part components in `src/react/compose.ts` (new).
  - P3-4, docs: `docs/react.md` (new), the README React section (after B4), `docs/api-reference.md`
    (after U8), and an update of `examples/react/**`.
  - Each one is public API (`INTENT.md:110-111`), so CRP-P3 comes first.
  - If a new subpath is chosen, the `package.json` exports and the `package:check` entrypoint list
    (`package.json:143`) belong to one slice only.
  - Expected checks: full, `pkg`, and `red(<the new tests>)`.

### 2.7 Waves and shared files

Waves (the slices in one wave own disjoint files):

- Wave 1: A1, A2, B1, B5, U1a, U2. No gate.
- Wave 2: U1b, U9, B0, B2a.
  - U1b starts after U1a is merged.
  - U9 needs the U2 filler count.
  - B0 and B2a need the answers to CRP-1 and CRP-2.
- Wave 3: M1, B2b, B3a.
  - M1 needs U1b merged and one dispatch run (N-CI).
  - B2b needs B0 and B2a merged.
- Wave 4: U3, U7, B3b, P3-0.
  - U3 and U7 need M1 and their CRP answers.
  - B3b needs B2b merged.
  - P3-0 needs N-P3.
- Wave 5: U4, U6, B4.
  - U4 needs U3 merged (`base.css`).
  - U6 needs U7 merged (`renderers.ts`).
  - B4 needs B1, B2b and B5 merged.
- Wave 6: U11, and A3 or A4 (only one of them at a time). U11 needs U4 and U6 merged. A3 needs
  owner answer O-1a, and A4 needs O-1b.
- Wave 7: U5, then U8, then U10, following the chains below.
- Wave 8: P3-1 onwards, after P3-0 and CRP-P3. The README part waits for B4, and the api-reference
  part waits for U8.

Shared files are edited in this order only:

- `src/element/renderers.ts`: U9 → U7 → U6 → U11 → U5 → U8.
- `src/styles/base.css`: U3 → U4 → U11 → U5, then A4 (if any).
- `tests/browser/pricing-renderer.spec.ts-snapshots/{mobile,tablet}-*`: U3 → U6.
- `tests/browser/pricing-renderer.spec.ts-snapshots/{table-840,desktop}-*`: U4 → U11.
- `tests/browser/ux-stress.spec.ts`: U1a → U1b → U10.
- `src/yaml/{load,index}.ts`: B2b → B3b.
- `docs/api-reference.md`: B2b → B3b → U8 → P3-4.
- `README.md`: B1 → B4 → P3-4.
- `docs/design-systems.md`: A2 → A3.
- `docs/private-pricings.md`: B1 → B4.
- `docs/pricing-versions.md`: B5 → B4.
- `openspec/specs/**`: A1 first, then the deltas of A3 or A4.
- `docs/agent-work/ux-review/**`: M1 → U10.

## 3. Owner decisions needed (CRPs)

Owner rules that apply here:

- A public API change needs a CRP (`INTENT.md:110-111`).
- A visual default change needs a CRP with screenshots (`phase1a-design-system/intake.md:9-10`).
  Screenshots come from CI artifacts at 1440 and 375, and at 840 for table changes.

Decisions:

- **CRP-1**, the shape of `createSpherePublicLoader` (`phase1b intake.md:408-421`). No screenshots.
  - Recommendation: option (a), `{ src, loadPricing, fetchYaml }`; reuse `PR_SOURCE_LOAD_FAILED`;
    https only; a pinned version skips the manifest.
- **CRP-2**, the ETag cache hook (`intake.md:422-427`). No screenshots.
  - Recommendation: option (a), `request.cache`, for anonymous loads only.
- **N1 and N2**, recorded SPHERE and SPACE responses (`intake.md:431-435`).
  - Fallback: fixtures derived from SPHERE `8472610`.
- **O-1a**, the shadcn overlay dark palette (A3). Should the overlay keep the documented mixed
  palette, or follow `.dark` and the system scheme fully? Screenshots only if it changes.
  - Recommendation: keep it as documented, and revisit if hosts report it.
- **O-1b**, Q-G remainder: should compact density also shrink `--pr-font-size-*` (A4)? Screenshots
  are needed.
  - Recommendation: not now, because spacing-only was accepted.
- **O-1c**, Q-G remainder: should the narrow UX changes U5 and U6 apply by default, or only under
  `density="compact"`? The opt-in avoids a default change. Screenshots of both options are needed.
  - Recommendation: by default, because the narrow problem P1 is in the default reading. Use the
    opt-in only if the owner rejects the default change.
- **CRP-U3**, narrow top compaction. The report says no CRP (`report.md:411`), but the narrow
  baselines move, so the owner rule asks for screenshots (mobile and tablet).
  - Recommendation: accept; it is minor and keeps the token meanings.
- **CRP-U4**, CTA under the price from 840 px. It is a major change and needs screenshots.
  - Recommendation: decide after M1 shows the highlight share.
- **CRP-U5**, highlights behind a disclosure at narrow widths with 4 or more plans (Q-B). Screenshots
  of the stress fixtures are needed.
  - Recommendation: decide after M1.
- **CRP-U6**, a narrow comparison cap of 10 rows (Q-B), or the scrolling table at narrow widths
  (Q-C). Screenshots are needed.
  - Recommendation: decide after M1's `layout="table"` measurement.
- **CRP-U7**, amend item 6 R3 so that the marker follows `availableFor`; Q-D is about keeping R6 (no
  marker in mixed rows). A minor change, no screenshots.
  - Recommendation: accept if U2 counts above 0, and keep R6.
- **CRP-U8**, a new i18n key and a checkbox in filter mode. Screenshots are optional.
  - Recommendation: accept as additive.
- **CRP-U11**, the selected plan column marked in every table. It is major: every table baseline
  moves. Screenshots at 840 and 1440.
  - Recommendation: accept.
- **Q-F**, should the stress spec assert in CI (U10)? Today it runs on dispatch only
  (`ci.yml:320-331`).
  - Recommendation: assert in the dispatch job only, and keep the PR shards free of it.
- **CRP-P3**, the Phase 3 public API (hooks, provider, parts, subpath).
  - Recommendation: after P3-0.

Already answered:

- Q-A, by the owner's Q2 for 1440: at most 5 screens, and no target at 375 (`ROADMAP.md:126`).
- Q-E is closed: Spanish plurals are a non-goal (`ROADMAP.md:29-31`).

## 4. Needs and risks

- N-P3: the full text of owner request `own-3f3b38da4a6a49c9a91ffff65873a31d`. Neither it nor
  `docs/agent-work/inbox/` is in this worktree. The 1a, 1b and 1c request texts were not read
  directly either: this audit relies on the intakes.
- N-CI: proof that a `workflow_dispatch` of `ci.yml` works on a feature branch. That requires
  `on-demand-specs` in the default branch's `ci.yml` (`ci.yml:325-326`). If it is not there, M1 and
  every gate behind it are blocked. The options are then:
  - an owner-approved `ci.yml` change (O4);
  - running the stress spec in a PR shard with `PW_UX_STRESS=1`, for the measuring PRs only.
- N-spec: confirm that the `openspec` CLI is available in the lab. It is not in `package.json`.
- R1: `renderers.ts` serializes six slices and `base.css` four. A slow CRP stalls the chain.
  Mitigation: the chain order follows the expected CRP order, and a slice whose gate fails (U7, U9)
  is dropped without blocking the next one.
- R2: the baseline file sets are shared (section 2.7). Two slices that move the same PNGs must not be
  open at the same time.
- R3: B2b and B3b score 10 and 9 (`intake.md:253-259,292-297`), so they need full panels with a
  clean-context review.
- R4: U1b and U10 add CI time to a job with a 50-minute limit (`ci.yml:333`).

## 5. Followups outside these phases

- Archive the other merged OpenSpec changes. `add-subscription-change-flow`, `enforce-load-limits`
  and `variable-describedby-and-ids` are still in `openspec/changes/`, and `openspec/specs/` is
  absent.
- F1 and F2 of the 1b intake (`intake.md:439-442`), both public behaviour that needs a CRP:
  - sanitise loader error text before it reaches the diagnostics (`load.ts:220-221`,
    `pricing-renderer-element.ts:1093`);
  - stop reflecting `src` (`:127`).
- Update the ROADMAP rows of 1b and UX as the slices merge (`ROADMAP.md:91-121,159-160`).
