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

`subtotal` is summed in a fixed order: the plan amount first, then the amounts
of the selected add-ons in the declaration order of `pricing.addOns`, whatever
the key order of `selection.addOns`. This is also the order of
`resolved.breakdown`, so `breakdown.subtotal` is the same number as `subtotal`
and adding the line amounts in line order gives exactly that number. Integer
amounts and selections with at most one priced add-on give the same values as
before. With two or more decimal add-on amounts the result can differ from
earlier versions in the last binary digit.

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

interface PricingUnitLabel {
  one: string;
  other: string;
}

// locale -> unit -> label; the locale key `*` applies to every locale
type PricingUnitLabels = Record<string, Record<string, PricingUnitLabel>>;

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

`PricingPresentation.unitLabels?: PricingUnitLabels` overrides how a usage unit
is shown next to a number. See [Unit labels](configuration.md#unit-labels).

`ResolvedPricing` has the required field `breakdown: PriceBreakdown`, a
JSON-safe description of the lines that make up `subtotal` and
`requiresQuote`. `PriceBreakdown` and `PriceBreakdownLine` are exported from
`pricing-renderer`. Code that builds a `ResolvedPricing` by hand, such as test
doubles, must add the field.

```ts
interface PriceBreakdownLine {
  kind: 'plan' | 'addOn';
  id: string;
  name: string;
  quantity: number;
  unitAmount?: number;
  billingMultiplier: number;
  amount?: number;
  requiresQuote: boolean;
  label?: string;
}

interface PriceBreakdown {
  currency: string;
  billingPeriod?: NormalizedBillingPeriod;
  plan?: PriceBreakdownLine;
  addOns: PriceBreakdownLine[];
  subtotal: number;
  requiresQuote: boolean;
}
```

- `currency` is `pricing.metadata.currency`. `billingPeriod` is a copy of the
  `pricing.billing` entry of the selection's billing period; it is absent when
  that id is unknown, and then every `billingMultiplier` is 1.
- `plan` is the line of the selected plan; it is absent when `planId` is
  `undefined` or not a plan id (then `requiresQuote` is `true`).
- `addOns` has one line per add-on that is selected after
  `reconcileSelection`, in the declaration order of `pricing.addOns`.
  Unselected entries, removed add-ons and unknown ids get no line.
- `quantity` is 1 for the plan and `normalizeAddOnQuantity` for an add-on, the
  quantity that is billed.
- A priced line has `unitAmount` (before the billing multiplier) and
  `amount = unitAmount * billingMultiplier * quantity`, evaluated left to
  right and equal to `planPrices[id].amount`, or to `addOnPrices[id].amount`
  when the billed quantity is not 0. An add-on with `minQuantity: 0` selected at
  quantity 0 has a line with `quantity` 0 and `amount` 0, so it adds 0 to the
  subtotal, while `addOnPrices[id]` still prices it at quantity 1.
- A label price (such as "Contact sales") has `requiresQuote: true` and the
  `label` text, without `unitAmount` and `amount`. A price expression that
  cannot be resolved has `requiresQuote: true` and none of the three, so hosts
  can tell a quote by label from a failed expression.
- Optional keys are absent, never `undefined`. A breakdown survives
  `JSON.parse(JSON.stringify(breakdown))` unchanged and shares no object with
  the pricing or the selection.

Example for acme with selection `CY` (Growth, 2 `extraStorage`, 1
`prioritySuccess`, billed yearly):

```json
{
  "currency": "EUR",
  "billingPeriod": { "id": "yearly", "label": "Yearly", "multiplier": 0.8 },
  "plan": {
    "kind": "plan",
    "id": "growth",
    "name": "Growth",
    "quantity": 1,
    "unitAmount": 45,
    "billingMultiplier": 0.8,
    "amount": 36,
    "requiresQuote": false
  },
  "addOns": [
    {
      "kind": "addOn",
      "id": "extraStorage",
      "name": "Extra Storage",
      "quantity": 2,
      "unitAmount": 5,
      "billingMultiplier": 0.8,
      "amount": 8,
      "requiresQuote": false
    },
    {
      "kind": "addOn",
      "id": "prioritySuccess",
      "name": "Priority Success",
      "quantity": 1,
      "unitAmount": 25,
      "billingMultiplier": 0.8,
      "amount": 20,
      "requiresQuote": false
    }
  ],
  "subtotal": 64,
  "requiresQuote": false
}
```

The breakdown reaches every `ResolvedPricing` the element provides (`resolvedState`,
the `applySelection` result and the details of `pricing-ready`,
`pricing-selection-change` and `pricing-action`) with no change to those types.
To compare two selections, resolve both and diff the two breakdowns by line
`id`; a dedicated comparison function is not part of the API.

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

| Property            | Attribute           | Type                             | Default            |
| ------------------- | ------------------- | -------------------------------- | ------------------ |
| `pricing`           | —                   | `IPricingLike`                   | —                  |
| `yaml`              | —                   | `string`                         | —                  |
| `src`               | `src`               | `string`                         | —                  |
| `request`           | —                   | `PricingRequestOptions`          | —                  |
| `loadPricing`       | —                   | `PricingLoader`                  | —                  |
| `normalizeOptions`  | —                   | `NormalizePricingOptions`        | —                  |
| `expressionOptions` | —                   | `ExpressionOptions`              | —                  |
| `selection`         | —                   | `PricingSelection`               | uncontrolled       |
| `defaultSelection`  | —                   | `Partial<PricingSelection>`      | schema defaults    |
| `presentation`      | —                   | `PricingPresentation`            | merged defaults    |
| `locale`            | `locale`            | `string`                         | `"en-US"`          |
| `pricingPath`       | `pricing-path`      | `string`                         | `"/pricing"`       |
| `selectionEnabled`  | —                   | `boolean`                        | `true`             |
| `ctaEnabled`        | —                   | `boolean`                        | `true`             |
| `variablesEnabled`  | —                   | `boolean`                        | `true`             |
| `messages`          | —                   | `MessageCatalog`                 | registered catalog |
| `mode`              | `mode`              | `"commercial" \| "catalog"`      | `"commercial"`     |
| `layout`            | `layout`            | `"auto" \| "compact" \| "table"` | `"auto"`           |
| `visibility`        | `visibility`        | `"public-only" \| "all"`         | `"public-only"`    |
| `theme`             | `theme`             | `"light" \| "dark" \| "auto"`    | `"light"`          |
| `loadingLabel`      | `loading-label`     | `string`                         | localized          |
| `onlyDifferences`   | `only-differences`  | `boolean`                        | automatic          |
| `toolbarThreshold`  | `toolbar-threshold` | `number`                         | `40`               |

Exactly one of `pricing`, `yaml`, or `src` is required. Sensitive request
configuration is property-only.

### Comparison toolbar and the shorter page

The comparison toolbar (search, Only differences, expand all, collapse all
and a counter) is shown when the pricing has more than `toolbarThreshold`
comparison rows. The default is 40, unchanged. Invalid or negative values
fall back to 40.

`only-differences` sets the initial state of the Only differences checkbox:

- Absent: automatic.
- Present, or any value except `false`: on.
- `only-differences="false"`: off.

The automatic default is on when the pricing has more than 100 comparison
rows, at least 2 plans, and the toolbar is shown. Otherwise it is off, so
small pricings (including the demo pricing) look as before. A click on the
checkbox overrides the initial state until a new pricing loads or the
property changes.

The counter reads `{shown} of {total} items` (Spanish:
`{shown} de {total} elementos`). `shown` is the number of rows rendered
right now: rows of collapsed groups and rows behind `Show N more` are not
counted. `total` is all comparison rows of the pricing.

When the search or Only differences leaves no row, the comparison shows
`No matching items` (Spanish: `Sin resultados`) and keeps the toolbar. The
empty state exposes the stable part hook `comparison-empty`.

The texts come from the i18n keys `pricing.rowsShownOf` and
`pricing.noMatches`. The key `pricing.rowsShown` stays in the catalogs but is
no longer rendered.

### Price breakdown disclosure

Next to the estimated total, the summary shows a small icon button with the
accessible name "How is this calculated?" (`pricing.breakdownToggle`). It toggles
an inline panel (not a modal) that lists the plan and each add-on as
`unit price × quantity × billing multiplier = amount`, a quote line with its
label or "Requires quote", the billing period (only when the pricing has more
than one), the currency and the total. The button is read-only: it is shown
whatever `selectionEnabled`, `ctaEnabled` and `variablesEnabled`.

- The button has `aria-expanded` and `aria-controls`; the panel id is unique per
  element. Enter, Space and click toggle it and keep focus on the button.
- Escape closes the panel and returns focus to the button when focus is on the
  button or inside the panel; elsewhere (and in the plan-change dialog) it does
  nothing to the panel.
- The panel stays open when the selection changes and closes when a new pricing
  loads.
- The `aria-live="polite"` attribute of the summary is on an inner region that
  holds the label, the total and the quote note, so opening the panel is not
  announced. Hosts that select `[data-pr-part='summary'][aria-live]` must update
  the selector, for example to `[data-pr-part='summary'] [aria-live]`.

Stable part hooks: `breakdown-toggle` (the button), `breakdown` (the panel) and
`breakdown-line` (one row per line, with `data-line-kind` and `data-line-id`).
To hide the button:

```css
pricing-renderer [data-pr-part='breakdown-toggle'] {
  display: none;
}
```

The summary (`[data-pr-part='summary']`) reserves end padding for the button
(`--pr-space-4` plus 24px plus `--pr-space-2`). When you hide the button, give
that space back:

```css
pricing-renderer [data-pr-part='summary'] {
  padding-inline-end: var(--pr-space-4);
}
```

There is no new property, attribute or event.

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
