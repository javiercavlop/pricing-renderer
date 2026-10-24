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

`resolvePricing` computes `subtotal` and `requiresQuote` from the reconciled
selection of the merged input, so add-ons that are unavailable for the selected
plan, and their dependents, are not summed. `resolved.selection` stays the
merged input, unreconciled.

```ts
reconcileSelection(
  pricing: NormalizedPricing,
  selection: PricingSelection,
): { selection: PricingSelection; removedAddOnIds: string[] }
```

An add-on is available for plan `P` when its `availableFor` is empty, or `P` is
defined and listed. The removal set is the selected add-ons unavailable for
`selection.planId`, plus, transitively, the selected add-ons whose `dependsOn`
contains a member of the set. `removedAddOnIds` lists each removed id once, in
the order of `pricing.addOns`. Removed entries become
`{ selected: false, quantity }` with the input quantity. Everything else
(`planId`, `billingPeriod`, `variables`, unknown add-on ids) is preserved, a
valid selection comes back deeply equal, and the inputs are not mutated.

```ts
const { selection: next, removedAddOnIds } = reconcileSelection(pricing, {
  ...selection,
  planId: 'starter',
});
// removedAddOnIds: ['extraStorage', 'prioritySuccess']
```

Supporting functions:

| Function                   | Purpose                                                     |
| -------------------------- | ----------------------------------------------------------- |
| `createDefaultSelection`   | Build a complete selection from model defaults              |
| `mergeSelection`           | Safely merge a partial selection                            |
| `normalizeAddOnQuantity`   | Clamp a quantity to subscription constraints                |
| `reconcileSelection`       | Deselect add-ons unavailable for the plan and dependents    |
| `mergePresentation`        | Apply props → `custom.pricingRenderer` → derived precedence |
| `mergePresentationOptions` | Merge project and instance presentation maps                |
| `getPlanHighlightSummary`  | Resolve typed highlights, verified inheritance, and badges  |
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

interface PricingPlanBadge {
  id: string;
  label: string;
  tone?: 'accent' | 'success' | 'warning' | 'neutral';
  emphasize?: boolean;
}

interface PricingPlanHighlightConfiguration {
  mode?: 'auto' | 'manual' | 'hybrid';
  items?: Array<string | { id: string; kind?: 'feature' | 'usage-limit' }>;
  inheritsFrom?: false | 'auto' | { planId: string; label?: string };
  maxItems?: number;
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

```ts
applySelection(selection: Partial<PricingSelection>): ApplySelectionResult
```

Loads a known selection, such as the customer's current subscription, into an
uncontrolled element. The call is synchronous. It merges the input over the
schema defaults (as `mergeSelection` does, so omitted or `undefined` fields take
the default, not the current selection), validates it against the loaded
pricing, applies `reconcileSelection`, replaces the internal selection and
re-renders.

- An unknown plan or billing period is replaced by the one of the selection in
  effect, unknown add-on ids are dropped, and the quantities of selected add-ons
  are normalized silently.
- It emits no `pricing-selection-change`, opens no confirmation dialog, and
  discards an open pending-change dialog as Cancel does.
- The input is not mutated and the element keeps no reference to it.
- It never throws for an expected state. Before the pricing is ready (first
  load, reload in flight, failed first load) it returns `applied: false` with
  the error `PR_SELECTION_NOT_READY`. In controlled mode (the `selection`
  property is set) it returns `applied: false` with the error
  `PR_SELECTION_CONTROLLED` and the current state. A refused call stores
  nothing and is not queued.
- A selection applied from a `pricing-ready` listener stays for that load. A
  later successful load restarts from `defaultSelection`.

```ts
type ApplySelectionResult =
  | {
      applied: true;
      selection: PricingSelection;
      resolved: ResolvedPricing;
      removedAddOnIds: string[];
      diagnostics: PricingDiagnostic[];
    }
  | {
      applied: false;
      selection: PricingSelection | undefined;
      resolved: ResolvedPricing | undefined;
      removedAddOnIds: [];
      diagnostics: PricingDiagnostic[];
    };
```

`ApplySelectionResult` is exported from `pricing-renderer/element` and
re-exported from `pricing-renderer/react`. Narrow on `applied`: when it is
`true`, `selection` and `resolved` are always defined. When it is `false`,
`selection` and `resolved` are the current state in controlled mode and
`undefined` when the element is not ready.

```ts
const result = renderer.applySelection({
  planId: 'growth',
  addOns: { extraStorage: { selected: true, quantity: 2 } },
});
if (result.applied) {
  console.info(result.resolved.subtotal);
}
```

#### Selection diagnostics

| Code                                  | Severity  | Path                      | Raised when                                      |
| ------------------------------------- | --------- | ------------------------- | ------------------------------------------------ |
| `PR_SELECTION_UNKNOWN_PLAN`           | `warning` | `selection.planId`        | `planId` is not a plan id (case-sensitive)       |
| `PR_SELECTION_UNKNOWN_BILLING_PERIOD` | `warning` | `selection.billingPeriod` | `billingPeriod` is not a billing period id       |
| `PR_SELECTION_UNKNOWN_ADDON`          | `warning` | `selection.addOns.<id>`   | an `addOns` key is not an add-on id (dropped)    |
| `PR_SELECTION_ADDON_REMOVED`          | `info`    | `selection.addOns.<id>`   | reconciliation deselected the add-on             |
| `PR_SELECTION_NOT_READY`              | `error`   | —                         | the call was made while the element is not ready |
| `PR_SELECTION_CONTROLLED`             | `error`   | —                         | the call was made in controlled mode             |

The warnings come first, in the order plan, billing period, add-ons (in the key
order of `input.addOns`), followed by one `PR_SELECTION_ADDON_REMOVED` per
removed add-on, with `details.addOnId`. Diagnostics are returned in the result,
dispatched in one `pricing-diagnostic` event when the list is not empty, and not
added to the diagnostics the element renders. `variables` are merged as
`mergeSelection` does and are not validated.

### Getters

```ts
readonly resolvedState: PricingSelectionChangeDetail | undefined
```

A detached snapshot `{ selection, resolved }` of the selection in effect (the
reconciled controlled `selection`, else the internal selection, with `variables`
replaced by the pricing defaults while `variablesEnabled` is `false`) and the
resolved pricing with the subtotal the element renders. It is `undefined` while
the element is not ready. Each read returns new objects that share no reference
with the element. It resolves the pricing on every read: read it on events, not
in a render loop.

### Events

All events bubble and are composed.

| Event                      | Detail                                                         | Cancelable |
| -------------------------- | -------------------------------------------------------------- | ---------- |
| `pricing-ready`            | `{ pricing, diagnostics, selection, resolved }`                | No         |
| `pricing-selection-change` | `{ selection, resolved }`                                      | No         |
| `pricing-action`           | `{ actionId, planId?, href?, selection, resolved, metadata? }` | Yes        |
| `pricing-diagnostic`       | `{ diagnostics }`                                              | No         |

Cancel `pricing-action` to keep navigation, checkout, or authentication under
host control.

`pricing-ready` carries `selection` and `resolved` as required fields, equal to
`resolvedState` read in the listener. Code that builds a `PricingReadyDetail` by
hand must add both. The element sets its ready state and selection before it
dispatches the event, so `applySelection` called from a `pricing-ready` listener
works.

`pricing-diagnostic` fires with the diagnostics of a load and also after an
`applySelection` call that returns diagnostics, including the error refusals
`PR_SELECTION_NOT_READY` and `PR_SELECTION_CONTROLLED`. Hosts that treat any
error in `pricing-diagnostic` as a load failure must check the diagnostic code.

`detail.selection` of `pricing-selection-change` and `pricing-action` is always
a reconciled selection (see `reconcileSelection`). The controlled `selection`
property is never assigned by the element.

### Plan change confirmation

Picking a plan applies it at once (one `pricing-selection-change`) unless
`reconcileSelection` would remove selected add-ons. In that case the element
opens the confirmation dialog listing the add-ons it will remove, including
dependents, and emits nothing while the dialog is open. Apply sets the plan and
deselects the listed add-ons in one update with one event. Cancel and Escape
keep the previous plan and its checked radio, emit no event, and restore focus.

A pending plan change is a `PendingAddOnChange` with
`{ addOnId: '', select: false, addIds: [], removeIds, planId }`. The optional
`planId` field is set only for plan changes; add-on changes leave it undefined.

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

A ref to `PricingRenderer` is the element, so it gives `applySelection` and
`resolvedState` without wrapper code:

```tsx
const ref = useRef<PricingRendererElement>(null);

<PricingRenderer
  ref={ref}
  yaml={source}
  onReady={() => {
    const result = ref.current?.applySelection({ planId: 'growth' });
    if (result && !result.applied) console.warn(result.diagnostics);
  }}
/>;
```

If the element may already be ready when the listener is attached, `onReady`
does not fire for that load; see
[Preload the current subscription](preload-current-subscription.md) to apply
at once from `resolvedState`.

`ApplySelectionResult` is re-exported from this entry point.

## CSS entry points

| Entry                         | Contents                                             |
| ----------------------------- | ---------------------------------------------------- |
| `pricing-renderer/base.css`   | Required structure, responsive layout, accessibility |
| `pricing-renderer/theme.css`  | Default visual token values and color modes          |
| `pricing-renderer/styles.css` | Base and theme combined                              |

Import exactly one strategy: `styles.css`, or `base.css` plus your own tokens.
