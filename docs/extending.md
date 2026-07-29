# Extending pricing-renderer

The public extension model is explicit: extend syntax before normalization,
extend calculations through allow-listed functions, extend language through
catalog registration, and extend visuals through tokens and stable parts.
Unknown `custom` data remains available for application-specific features.

## Support another syntax revision

Use a `PricingSyntaxAdapter` when an input is not directly compatible with the
supported Pricing2Yaml 3.x shape:

```ts
import type { PricingSyntaxAdapter } from 'pricing-renderer';
import { normalizePricing } from 'pricing-renderer';

const pricing32: PricingSyntaxAdapter = {
  id: 'pricing2yaml-3.2-preview',
  supports: (version) => version === '3.2',
  adapt: (pricing) => ({
    ...pricing,
    syntaxVersion: '3.1',
    // Convert only fields whose semantics are known.
  }),
};

const result = normalizePricing(input, {
  syntaxAdapters: [pricing32],
});
```

Adapters run before version validation, must return a new object, and should be
pure and deterministic. The normalized value preserves the original raw input
and emits `PR_VERSION_ADAPTED`. A thrown adapter error becomes
`PR_VERSION_ADAPTER_FAILED`.

When contributing first-party support:

1. Add specification fixtures, including unknown fields and edge values.
2. Keep normalization backward compatible.
3. Add diagnostics with stable codes and YAML paths.
4. Test formulas and all affected rendering modes.
5. Update [compatibility](./pricing2yaml-compatibility.md).

## Add a domain expression function

Custom functions are never discovered from globals. Pass them by name:

```ts
import { resolvePricing } from 'pricing-renderer';

const resolved = resolvePricing(pricing, selection, {
  expression: {
    functions: {
      volumePrice: (units, rate) => Number(units) * Number(rate),
    },
  },
});
```

On the element or React wrapper:

```ts
renderer.expressionOptions = {
  functions: {
    volumePrice: (units) => Number(units) * 0.8,
  },
};
```

Treat extension functions as pure calculations:

- Validate/coerce arguments locally.
- Return serializable primitive, array, or object values.
- Do not perform network, DOM, storage, time-dependent, or secret-bearing work.
- Do not mutate input values.
- Add unit tests for malformed arguments and upper bounds.

Functions remain behind the same AST limits; configuring a name only permits
calls to that exact local function.

## Register a locale

```ts
import { enUS, registerMessageCatalog } from 'pricing-renderer';

const unregister = registerMessageCatalog('fr-FR', {
  ...enUS,
  'pricing.plans': 'Offres',
  'pricing.choosePlan': 'Choisir {plan}',
});

// Optional cleanup in tests or dynamically loaded modules.
unregister();
```

Catalogs are plain records and can be code-split. Keep placeholders unchanged
unless the corresponding call site is changed. Use `Intl` for currency, dates,
and plural-sensitive values rather than embedding formatting rules into
messages. See [Internationalization](./i18n.md).

## Add presentation metadata

Use `custom.pricingRenderer` for portable YAML-owned presentation:

```yaml
custom:
  pricingRenderer:
    title: Pricing built for every stage
    planBadges:
      growth:
        - id: most-popular
          label: Most popular
          tone: accent
          emphasize: true
    planInheritance: auto
    planHighlights:
      growth:
        mode: hybrid
        items:
          - id: auditLog
            kind: feature
          - id: storage
            kind: usage-limit
    variableControls:
      - path: seats
        type: slider
        label: Team seats
        min: 1
        max: 500
        step: 1
```

Use component `presentation` for application-owned copy and CTAs. Component
configuration wins over YAML configuration. Do not place checkout secrets or
authorization rules in `custom`.

`planHighlights` supports:

- `auto`: derive highlights entirely from meaningful plan values.
- `manual`: render only valid configured references.
- `hybrid`: render configured references first, then fill to `maxItems`
  automatically.
- Array shorthand: equivalent to a manual `items` list.

Use typed `{ id, kind }` references whenever a feature and usage limit could
share an ID. `planInheritance: auto` checks the previous visible plan.
`inheritsFrom: { planId, label }` selects a specific plan and supports a
localized label containing `{plan}`; `inheritsFrom: false` disables it for one
card. Inheritance is conservative: the renderer compares the full set and only
shows the inherited claim plus genuine differences when no capability is
reduced.

Badges are plain optional data. `tone` is restricted to `accent`, `success`,
`warning`, or `neutral`; `emphasize: true` also gives the plan card featured
styling. Put translated badge labels in the appropriate host/YAML presentation
layer.

## Build a custom renderer

The core is intentionally DOM-free:

```ts
import { createPricingViewModel } from 'pricing-renderer';
import { parsePricingYaml } from 'pricing-renderer/yaml';

const parsed = parsePricingYaml(source);
if (!parsed.ok || !parsed.value) throw new Error('Invalid pricing');

const viewModel = createPricingViewModel(parsed.value, selection, {
  locale: 'en-US',
  mode: 'catalog',
  presentation,
});
```

Render `PricingViewModel` in Vue, Svelte, a server template, native UI, or a
design-system-specific React tree. Keep selection updates immutable and call
`createPricingViewModel` again after every change.

## Extend the supplied component visually

Prefer this order:

1. Public `--pr-*` tokens.
2. Stable `[data-pr-part]` hooks.
3. A complete theme loaded after `base.css`.

Do not depend on internal `pr-*` class names or Lit template structure. New
stable hooks require documentation and tests. See [Theming](./theming.md).

## Add a renderer section upstream

When contributing a new visual section:

- Derive its data in core/view-model when reusable semantics are involved.
- Keep the element renderer small and driven by `RenderState`.
- Use semantic HTML before ARIA.
- Add a stable `data-pr-part` only if consumers need to theme the section.
- Avoid viewport queries; respond to the renderer container.
- Do not duplicate desktop and mobile content in the accessible tree.
- Add keyboard, Axe, RTL, forced-colors, reduced-motion, and visual coverage.
- Ensure unknown or partial data produces a useful fallback.

## Compatibility rules

Public normalized types, diagnostic codes, event names/detail shapes, CSS
tokens, `data-pr-part` values, and package subpaths follow SemVer. Internal class
names and markup nesting do not. Breaking an extension contract requires a major
release and migration notes.
