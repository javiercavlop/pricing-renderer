# Tasks: phase1a-design-systems

Rules for every slice:

- At most 300 diff lines without tests. A slice that grows beyond it is split by requirement group.
- Slices that may run at the same time own disjoint files. A file listed in two slices is touched
  only in the stated order, after the earlier slice is merged.
- Tests are written first by test-designer and fail before the implementation (red before). A test
  of a file that does not exist yet first asserts `existsSync(...)`, so it fails on an assertion,
  not on `ENOENT`. Browser specs are written in the lab and run in CI (no browser in the lab).
- Every requirement id is traced: `[impl->req~…~<rev>]` in code or CSS comments, `[utest->req~…~<rev>]` in
  tests. JSON files hold no tags; their requirements need `utest` only.
- No feature flag: every addition is a new token, attribute, prop or file that is unset or unused by
  default. The `.dark` selector applies only with `theme="auto"` (CRP-B, option (b)), so no existing
  host changes.
- No release: one `minor` changeset per implementation slice.

Checks (the planner registers them; names are the commands):

- `install`: `["pnpm", "install", "--frozen-lockfile"]`
- `typecheck`: `["pnpm", "typecheck"]`
- `lint`: `["pnpm", "lint"]`
- `format`: `["pnpm", "format:check"]`
- `unit`: `["pnpm", "test"]`
- `browser`: `["pnpm", "test:browser"]` in CI, including the responsive visual tests against the
  committed baselines without `--update-snapshots`
- `package`: `["pnpm", "package:check"]` (CI; in the lab only if registered)
- `demo`: `["pnpm", "--filter", "pricing-renderer-demo", "build"]`
- `spec`: `["openspec", "validate", "phase1a-design-systems", "--strict"]`

## Phase T: tests (test-designer, after this spec is accepted)

- [ ] T1 Design-token tests.
  - Files: `tests/unit/design-tokens.test.ts` (new), `tests/unit/plan-grid-columns.test.ts` (only
    the `var(--pr-plan-columns, X)` unwrap that rejects other variable names; expected values stay),
    `tests/browser/design-tokens.spec.ts` (new).
  - Requirements: `req~token-fallbacks~1`, `req~font-family-tokens~1`, `req~font-weight-tokens~1`,
    `req~line-height-token~1`, `req~sticky-top-token~1`, `req~table-size-tokens~1`,
    `req~dialog-z-token~1`, `req~plan-columns-token~1`.
  - Checks: `unit` red before (the two unit files), `lint`, `format`.
- [ ] T2 State-attribute and React tests.
  - Files: `tests/unit/state-attributes.test.ts` (new), `tests/unit/react-style-prop.test.ts` (new).
  - Requirements: `req~state-featured~1`, `req~state-available~1`, `req~state-kind~1`,
    `req~state-current~1`, `req~react-style-prop~1`, `req~react-classname~1`.
  - Checks: `unit` red before, `lint`, `format`. `req~state-current~1` and `req~react-classname~1`
    hold already; their tests are green from the start and guard the behaviour.
- [ ] T3 Theme-file tests.
  - Files: `tests/unit/host-dark-class.test.ts`, `tests/unit/tokens-shadcn.test.ts`,
    `tests/unit/theme-minimal.test.ts` (all new), `tests/browser/theme-files.spec.ts`.
  - Requirements: the eight `theme-files` ids.
  - Checks: `unit` red before, `lint`, `format`.
- [ ] T4 Density tests.
  - Files: `tests/unit/density.test.ts` (new), `tests/browser/density.spec.ts` (new).
  - Requirements: the four `density` ids.
  - Checks: `unit` red before, `lint`, `format`.
- [ ] T5 Docs and demo tests.
  - Files: `tests/unit/design-systems-docs.test.ts` (new), `tests/browser/host-reset.spec.ts`
    (new), `tests/browser/theme-builder.spec.ts` (new).
  - Requirements: `req~design-systems-guide~1`, `req~theming-docs-accuracy~1`,
    `req~host-reset-spec~1`, `req~theme-builder-page~1`, and the docs scenario of
    `req~font-family-tokens~1`.
  - Checks: `unit` red before, `lint`, `format`.

## Phase I: implementation (implementer; no test file is touched)

- [ ] I1 Tokens (after CRP-A and T1).
  - Files: `src/styles/base.css`, `.changeset/design-tokens.md` ("no visual change").
  - Checks: `typecheck`, `lint`, `unit`, `format`, `browser` (baselines unchanged).
- [ ] I2 State attributes and React props (after CRP-A and T2).
  - Files: `src/element/renderers.ts`, `src/react/index.ts`, `.changeset/state-attributes.md`,
    `.changeset/react-style-prop.md`.
  - Checks: `typecheck`, `lint`, `unit`, `format`, `browser`, `package`.
- [ ] I3 Theme files (after T3 and CRP-A).
  - Files: `src/styles/theme.css`, `src/styles/tokens-shadcn.css` (new),
    `src/styles/theme-minimal.css` (new), `package.json` (the two exports only),
    `.changeset/host-dark-class.md` (`.dark` applies only with `theme="auto"`; no visual change for
    existing hosts),
    `.changeset/tokens-shadcn.md`, `.changeset/theme-minimal.md`.
  - Order inside the slice: `.dark` in `theme.css` first (the overlay's dark mode and the minimal
    theme's selector lists follow it), then `tokens-shadcn.css`, then `theme-minimal.css`. Split
    into I3a/I3b/I3c if the diff exceeds 300 lines.
  - Checks: `typecheck`, `lint`, `unit`, `format`, `browser`, `package`.
- [ ] I4 Density (after T4, I1 and I2).
  - Files: `src/element/pricing-renderer-element.ts`, `src/react/index.ts`, `src/styles/base.css`,
    `custom-elements.json`, `.changeset/density.md` (says compact changes spacing tokens only and the
    element writes no default `density` attribute).
  - Checks: `typecheck`, `lint`, `unit`, `format`, `browser`, `package`.

## Phase D: documentation (doc-steward, after I1, I2 and I3)

- [ ] D1 Guide and references.
  - Files: `docs/design-systems.md` (new), `docs/theming.md` (layer name, the import example
    without `layer(...)`, the twelve tokens with defaults, state hooks, link), `docs/api-reference.md`
    (CSS entry rows, the React `style` prop, the `density` row once I4 is merged, link),
    `README.md` (CSS table, hooks, link).
  - Content: design.md "Tailwind v3 fix" and "Tailwind v4 order", CSS Modules with
    `:global(pricing-renderer)` and attribute hooks, the token mapping and shadcn overlay with the
    `hsl(var(--x))` snippet for shadcn v3, fonts (D6, never `inherit`), dark mode, density, state
    attributes, fixed container breakpoints with `--pr-plan-columns` inside a host query. No host
    product is named.
  - Checks: `unit`, `format`. If I4 is not merged yet, the `Density` section says so and a closeout
    task completes it.

## Phase E: demo (implementer, lowest priority, after I1 and I3)

- [ ] E1 Theme builder page.
  - Files: `examples/vanilla/theme-builder.html` (new), `examples/vanilla/src/theme-builder.ts`
    (new), `examples/vanilla/vite.config.ts` (the build input only). The page is documented in `docs/design-systems.md` (task D1).
  - Checks: `typecheck`, `lint`, `unit`, `format`, `demo`, `browser` (the page shares the web
    server; the other specs stay green).

## Traceability checklist

- design-tokens: 8 requirements, unit tests on `base.css` text plus browser specs.
- state-attributes: 4 requirements, unit render tests.
- react-style-prop: 2 requirements, compiler API and mocked `@lit/react`.
- theme-files: 8 requirements, unit tests on CSS and `package.json` plus browser specs.
- density: 4 requirements, unit tests (declaration, manifest, types, CSS) plus browser specs.
- docs: 4 requirements, unit tests on docs text plus browser specs (host reset, theme builder).
