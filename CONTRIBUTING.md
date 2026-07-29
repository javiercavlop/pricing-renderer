# Contributing

Thank you for helping make pricing interfaces clearer and easier to integrate.
Source, API, documentation, tests, commit messages, and Changesets are written in
English.

## Before opening a change

- Search existing issues and discussions.
- Keep one change focused on one problem.
- For a public contract or substantial UI change, open an issue describing the
  use case and compatibility impact before implementation.
- Never include real customer pricing, tokens, or confidential YAML in a
  fixture.

Contributions are accepted under the repository's MIT license.

## Development setup

Requirements:

- Node.js 22 or newer.
- Corepack and the pnpm version declared in `package.json`.
- Browsers installed by Playwright for browser-test work.

```bash
git clone https://github.com/javiercavlop/pricing-renderer.git
cd pricing-renderer
corepack enable
pnpm install
pnpm exec playwright install
pnpm build
```

Run the acceptance demo:

```bash
pnpm demo
```

The React adapter example is available through `pnpm demo:react`.

## Architecture rules

Read [docs/architecture.md](./docs/architecture.md) first.

- Core cannot import the DOM, Lit, React, or the YAML parser.
- YAML owns parsing and transport, not presentation.
- Reusable pricing semantics belong in core/view-model, not element templates.
- The Custom Element owns accessible interaction and light-DOM markup.
- React is a thin typed adapter; do not duplicate state or calculations there.
- CSS tokens and `data-pr-part` are public; internal class names are not.
- Unknown `custom` data and raw source fields must remain intact.
- Prefer additive, typed extension points to branches for one consumer.

## Implementation workflow

1. Create a focused branch from current `main`.
2. Add or update a failing test that demonstrates the behavior.
3. Implement the smallest coherent change in the correct layer.
4. Update public types, custom element metadata, docs, and examples together.
5. Add a Changeset for any user-visible behavior or package output.
6. Run the relevant gates and visually review the demo.
7. Open a pull request with the problem, design decision, verification, and
   screenshots for UI changes.

Do not update visual snapshots only to make CI green. Inspect each diff and state
why it is intended.

## Extending syntax support

Start with a `PricingSyntaxAdapter`; see
[docs/extending.md](./docs/extending.md). First-party normalization support also
requires:

- a specification link and version policy;
- representative valid, invalid, unknown-field, and edge-value fixtures;
- stable diagnostic codes and YAML paths;
- preserved formulas and raw input;
- tests for `0`, `false`, infinity, textual prices, and partial failures;
- compatibility documentation.

Never guess billing duration, multiply unspecified functional effects, or invent
a numeric total from a quote price.

## Extending expressions

Never evaluate Pricing2Yaml expressions using `eval`, `Function`, dynamic module
loading, global lookup, or arbitrary method calls.

Parser/interpreter changes require:

- precedence and associativity tests;
- dependency-collection tests;
- source-size, depth, and complexity bounds;
- prototype/constructor/global/assignment attack cases;
- failure behavior that preserves the last valid interactive result.

Domain functions must use `ExpressionOptions.functions`, be explicitly
allow-listed, pure, deterministic, and covered for malformed input.

## Adding a locale

- Copy all keys from the canonical `enUS` catalog.
- Preserve interpolation placeholders.
- Use `Intl` for locale-sensitive formatting.
- Test exact locale, language-family fallback, and `en-US` fallback.
- Review 320 px, long text, 200/400% zoom, and RTL when applicable.
- Update [docs/i18n.md](./docs/i18n.md).

Do not translate YAML-owned product content automatically.

## Changing the UI

The renderer should remain elegant, professional, informative, and interactive
without copying another product's identity.

Every visual change must account for:

- container widths 320, 375, 599, 600, 839, 840, 1024, 1200, and 1440 px;
- 1, 3, and 8 plans;
- variables, constrained add-ons, partial totals, and confirmation dialogs;
- light, dark, forced-colors, and reduced-motion;
- keyboard-only operation and visible focus;
- WCAG 2.2 AA contrast and 44×44 px internal touch targets;
- RTL, long copy, 200/400% zoom, and safe-area insets;
- no document-level horizontal overflow or duplicated mobile content.

Use semantic HTML before ARIA. Avoid hover-only information, drag-only controls,
carousels, and fixed viewport assumptions.

When exposing a theming hook, prefer an existing token. Add `data-pr-part` only
when consumers need a stable structural target, then document and test it.

Plan-card presentation must use the generic `planHighlights` and `planBadges`
contracts. Do not add one-off “recommended plan” IDs or feature-only highlight
aliases. New highlight semantics belong in the headless summary, must remain
usable without Lit, and must prove any inheritance claim from the complete
comparison data. Badge emphasis is explicit data, never inferred from label
copy or a magic badge ID.

## Tests and quality gates

Fast local loop:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Before requesting review:

```bash
pnpm format:check
pnpm test:browser
pnpm package:check
```

`package:check` validates the real package with `publint` and
`arethetypeswrong`. Browser tests cover Chromium, Firefox, WebKit, Axe, keyboard
interaction, integration examples, and visual baselines.

Tests should describe behavior, not implementation. Prefer small fixtures for
unit tests and the documented stress fixture for performance-sensitive work.

## Documentation and examples

Public behavior is incomplete until it is documented:

- Update README quick starts for the common path.
- Update the API reference for types, properties, events, or subpaths.
- Update the extension/compatibility guide for new boundaries.
- Keep Vanilla and React examples executable against the built package.
- Capture real demo screenshots when the default visual result changes.
- Document limitations and security consequences, not only the happy path.

Do not document an npm version as available before it is actually published.

## Changesets and releases

Create a Changeset:

```bash
pnpm changeset
```

Use:

- patch for compatible fixes or documentation shipped in package output;
- minor for additive public capabilities;
- major for breaking API, event, diagnostic, CSS token/part, or subpath changes.

Maintainers own versioning, tags, provenance, and npm publication. A green pull
request, approved source push, tag, or draft release is not permission to
publish. The `0.1.0` candidate specifically requires explicit acceptance of the
interactive demo. Follow [docs/releasing.md](./docs/releasing.md); installation
documentation must be switched to published wording before publishing the
GitHub Release. That release event runs npm CD, and the result must then be
verified with a clean registry installation.

## Pull request checklist

- [ ] The change belongs in the selected architecture layer.
- [ ] Public types and metadata are updated.
- [ ] Unit and/or browser tests cover the behavior and failures.
- [ ] Security and privacy boundaries remain intact.
- [ ] Accessibility and responsive states were reviewed.
- [ ] Documentation and runnable examples are updated.
- [ ] A Changeset is included when required.
- [ ] All quality gates pass.
- [ ] Visual diffs/screenshots are attached for UI changes.

## Reporting security issues

Do not open a public issue for a suspected vulnerability. Follow
[SECURITY.md](./SECURITY.md).
