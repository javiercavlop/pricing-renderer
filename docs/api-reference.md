# API reference

The package is ESM-only. Types shown here are exported from their corresponding
entry point.

## `pricing-renderer`

### Project configuration

```ts
configurePricingRenderer(options?: Partial<PricingRendererConfig>): Readonly<PricingRendererConfig>
createPricingRendererConfig(options?: Partial<PricingRendererConfig>): Readonly<PricingRendererConfig>
getPricingRendererConfig(): Readonly<PricingRendererConfig>
```

`DEFAULT_PRICING_RENDERER_CONFIG` contains `locale: "en-US"`,
`pricingPath: "/pricing"`, and enabled selection, CTAs, and variables. See
[Project and instance configuration](./configuration.md) for precedence and
disabled behavior.

### Parsing-independent functions

```ts
normalizePricing(
  pricing: IPricingLike,
  options?: NormalizePricingOptions,
): PricingResult<NormalizedPricing>

resolvePricing(
  pricing: NormalizedPricing,
  selection?: Partial<PricingSelection>,
  options?: ResolvePricingOptions,
): ResolvedPricing

createPricingViewModel(
  pricing: NormalizedPricing,
  selection?: Partial<PricingSelection>,
  options?: ViewModelOptions,
): PricingViewModel
```

`normalizePricing` validates versions and preserves the raw source.
`resolvePricing` resolves all plan/add-on prices, subtotal, quote state, and
diagnostics. `createPricingViewModel` adds presentation, visibility, locale,
variable controls, and comparison groups.

Supporting functions:

| Function                   | Purpose                                                     |
| -------------------------- | ----------------------------------------------------------- |
| `createDefaultSelection`   | Build a complete selection from model defaults              |
| `mergeSelection`           | Safely merge a partial selection                            |
| `normalizeAddOnQuantity`   | Clamp a quantity to subscription constraints                |
| `mergePresentation`        | Apply props → `custom.pricingRenderer` → derived precedence |
| `getPlanHighlights`        | Select configured/derived card highlights                   |
| `getPlanCta`               | Resolve the CTA associated with a plan                      |
| `getPricingRendererCustom` | Read the renderer-specific `custom` extension               |
| `getCustomDetails`         | Return preserved custom details                             |
| `isSafeLink`               | Validate a renderable link scheme                           |

### Expression functions

```ts
evaluatePriceExpression(
  source: string,
  variables: Record<string, unknown>,
  options?: ExpressionOptions,
): ExpressionEvaluation

collectExpressionDependencies(source: string): string[]
```

Built-in expressions support `#variable` references, arrays, objects,
arithmetic, comparisons, logical operators, ternaries, safe property/index
access, an allow-list of `Math` methods, and `concat`. Extension functions are
passed through `ExpressionOptions.functions`.

### Internationalization

```ts
registerMessageCatalog(locale: string, catalog: MessageCatalog): () => void
getRegisteredLocales(): string[]
getMessages(locale?: string, overrides?: MessageCatalog): MessageCatalog
translate(messages: MessageCatalog, key: string, values?: Record<string, unknown>): string
formatCurrency(amount: number, currency: string, locale?: string): string
formatDate(value: string, locale?: string): string
```

`registerMessageCatalog` returns an unregister function. Locale lookup falls
back from an exact tag to the registered language family and finally `en-US`.
`enUS` and `esES` are included catalogs.

### Key data contracts

```ts
interface PricingSelection {
  planId?: string;
  billingPeriod?: string;
  variables: Record<string, unknown>;
  addOns: Record<string, { selected: boolean; quantity: number }>;
}

type PriceSource =
  | { kind: 'fixed'; amount: number }
  | { kind: 'label'; text: string }
  | { kind: 'expression'; source: string; dependencies: string[] };

interface PricingResult<T> {
  ok: boolean;
  value?: T;
  diagnostics: PricingDiagnostic[];
}
```

See the generated declarations for the complete normalized model and view-model
shape.

## `pricing-renderer/yaml`

```ts
parsePricingYaml(
  source: string,
  options?: {
    maxAliasCount?: number;
    normalize?: NormalizePricingOptions;
  },
): PricingResult<NormalizedPricing>

loadPricingFromUrl(
  source: string,
  options?: LoadPricingOptions,
): Promise<PricingResult<NormalizedPricing>>
```

`LoadPricingOptions` supports:

- `headers`: a `HeadersInit` value or async token-producing function.
- `credentials`: defaults to `"omit"`.
- `timeoutMs`: defaults to 15 seconds.
- `maxBytes`: defaults to 2 MiB.
- `fetch`: an injected fetch implementation.
- `loadPricing`: a custom loader for OAuth, signed URLs, proxies, or SDKs.
- `signal`: an external cancellation signal.
- `normalize`: syntax adapters used after loading.

Only HTTP/HTTPS URLs are accepted by the built-in loader.

## `pricing-renderer/element`

Exports `PricingRendererElement` without registering it globally.

### Properties and attributes

| Property            | Attribute       | Type                             | Default            |
| ------------------- | --------------- | -------------------------------- | ------------------ |
| `pricing`           | —               | `IPricingLike`                   | —                  |
| `yaml`              | —               | `string`                         | —                  |
| `src`               | `src`           | `string`                         | —                  |
| `request`           | —               | `PricingRequestOptions`          | —                  |
| `loadPricing`       | —               | `PricingLoader`                  | —                  |
| `normalizeOptions`  | —               | `NormalizePricingOptions`        | —                  |
| `expressionOptions` | —               | `ExpressionOptions`              | —                  |
| `selection`         | —               | `PricingSelection`               | uncontrolled       |
| `defaultSelection`  | —               | `Partial<PricingSelection>`      | schema defaults    |
| `presentation`      | —               | `PricingPresentation`            | merged defaults    |
| `locale`            | `locale`        | `string`                         | `"en-US"`          |
| `pricingPath`       | `pricing-path`  | `string`                         | `"/pricing"`       |
| `selectionEnabled`  | —               | `boolean`                        | `true`             |
| `ctaEnabled`        | —               | `boolean`                        | `true`             |
| `variablesEnabled`  | —               | `boolean`                        | `true`             |
| `messages`          | —               | `MessageCatalog`                 | registered catalog |
| `mode`              | `mode`          | `"commercial" \| "catalog"`      | `"commercial"`     |
| `layout`            | `layout`        | `"auto" \| "compact" \| "table"` | `"auto"`           |
| `visibility`        | `visibility`    | `"public-only" \| "all"`         | `"public-only"`    |
| `theme`             | `theme`         | `"light" \| "dark" \| "auto"`    | `"light"`          |
| `loadingLabel`      | `loading-label` | `string`                         | localized          |

Exactly one of `pricing`, `yaml`, or `src` is required. Sensitive request
configuration is property-only.

### Methods

```ts
reload(): Promise<void>
```

Reloads the current source and aborts an obsolete remote request.

### Events

All events bubble and are composed.

| Event                      | Detail                                                         | Cancelable |
| -------------------------- | -------------------------------------------------------------- | ---------- |
| `pricing-ready`            | `{ pricing, diagnostics }`                                     | No         |
| `pricing-selection-change` | `{ selection, resolved }`                                      | No         |
| `pricing-action`           | `{ actionId, planId?, href?, selection, resolved, metadata? }` | Yes        |
| `pricing-diagnostic`       | `{ diagnostics }`                                              | No         |

Cancel `pricing-action` to keep navigation, checkout, or authentication under
host control.

## `pricing-renderer/define`

Exports:

```ts
PRICING_RENDERER_TAG
definePricingRenderer(): typeof PricingRendererElement
PricingRendererElement
```

Importing this entry registers `<pricing-renderer>` idempotently. If the tag has
already been defined by another constructor, registration fails explicitly
instead of silently using an incompatible implementation.

## `pricing-renderer/react`

Exports `PricingRenderer`, the element class, event/detail types, loader types,
and mutually exclusive input props:

```tsx
<PricingRenderer pricing={pricing} />
<PricingRenderer yaml={source} />
<PricingRenderer src={url} request={request} loadPricing={loader} />
```

React callbacks are `onReady`, `onSelectionChange`, `onAction`, and
`onDiagnostic`. The module contains `"use client"` and supports React 18/19.

## CSS entry points

| Entry                         | Contents                                             |
| ----------------------------- | ---------------------------------------------------- |
| `pricing-renderer/base.css`   | Required structure, responsive layout, accessibility |
| `pricing-renderer/theme.css`  | Default visual token values and color modes          |
| `pricing-renderer/styles.css` | Base and theme combined                              |

Import exactly one strategy: `styles.css`, or `base.css` plus your own tokens.
