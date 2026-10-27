# Project and instance configuration

`pricing-renderer` has deterministic project defaults and per-instance
overrides. Configure project defaults before creating any renderer element:

```ts
import { configurePricingRenderer } from 'pricing-renderer';

configurePricingRenderer({
  locale: 'en-US',
  pricingPath: '/pricing',
  selectionEnabled: true,
  ctaEnabled: true,
  variablesEnabled: true,
  presentation: {
    planInheritance: 'auto',
  },
});
```

Every key is optional. Calling `configurePricingRenderer` creates a complete
configuration from the built-in defaults rather than inheriting an earlier
partial call.

## Defaults

| Option             | Default      | Effect                                                       |
| ------------------ | ------------ | ------------------------------------------------------------ |
| `locale`           | `"en-US"`    | Selects library-owned messages and `Intl` formatting         |
| `pricingPath`      | `"/pricing"` | Declares the canonical pricing pathname for the host app     |
| `selectionEnabled` | `true`       | Enables plan/add-on controls and full-card pointer selection |
| `ctaEnabled`       | `true`       | Renders configured plan CTAs                                 |
| `variablesEnabled` | `true`       | Renders variable controls and applies interactive values     |
| `presentation`     | `{}`         | Supplies project-wide highlights, badges, controls, and CTAs |

`pricingPath` must be an absolute application pathname such as `/pricing` or
`/account/plans`. It cannot contain a scheme, query, or fragment. The library
does not install or mutate routes; the integrating router owns the page and can
read this value through `getPricingRendererConfig()` or an element's
`pricingPath` property.

## Per-instance overrides

Global configuration is read when an element is constructed. Properties passed
to one element or React component override those defaults:

```ts
const renderer = document.querySelector('pricing-renderer');
renderer.locale = 'es-ES';
renderer.pricingPath = '/precios';
renderer.selectionEnabled = false;
renderer.ctaEnabled = false;
renderer.variablesEnabled = false;
renderer.presentation = {
  planHighlights: {
    enterprise: {
      mode: 'hybrid',
      items: [{ id: 'storage', kind: 'usage-limit' }],
    },
  },
};
```

```tsx
<PricingRenderer
  pricing={pricing}
  locale="es-ES"
  pricingPath="/precios"
  selectionEnabled={false}
  ctaEnabled={false}
  variablesEnabled={false}
  presentation={{
    planBadges: {
      enterprise: [{ id: 'scale', label: 'Built for scale', tone: 'neutral' }],
    },
  }}
/>
```

`locale` and `pricing-path` also have HTML attributes. The three feature flags
are JavaScript/React properties so `false` remains unambiguous.

## Disabled behavior

- With `selectionEnabled: false`, plan and add-on selection controls, quantity
  steppers, and full-card selection are disabled. Existing/default selection
  data can still determine a resolved summary.
- With `ctaEnabled: false`, plan CTAs are not rendered and therefore cannot emit
  `pricing-action`. It does not disable host-owned controls outside the
  renderer.
- With `variablesEnabled: false`, variable controls are not rendered and price
  resolution uses the normalized defaults from the iPricing. Variable overrides
  from controlled or internal interactive selection are ignored until the
  option is enabled again.

- The "How is this calculated?" button next to the estimated total only reads
  the resolved pricing, so it is shown whatever the three flags. Hide it with
  CSS (see the API reference).

These options only govern supplied UI behavior. Headless consumers decide how
to expose their own interactions.

## Controlled versus uncontrolled

The element owns the selection unless the host sets the `selection` property.

| Mode         | Who owns the state | How to set it                                |
| ------------ | ------------------ | -------------------------------------------- |
| Uncontrolled | The element        | `defaultSelection` at load, `applySelection` |
| Controlled   | The host           | the `selection` property                     |

- `defaultSelection` is merged over the schema defaults and reconciled silently
  on each successful load. It is read at load only: setting it later changes
  nothing until the next load. A later successful load (`reload()` or a new
  source) restarts from it, so an applied selection is not kept across loads.
- `applySelection(selection)` replaces the internal selection of a ready,
  uncontrolled element, validates it and emits no `pricing-selection-change`.
  It also restarts from the schema defaults for omitted fields, not from the
  current selection. A reload restarts from `defaultSelection`.
- `selection` is controlled input. The element never assigns it and shows it
  reconciled. The host stores each change from `pricing-selection-change` and
  passes it back. `applySelection` is refused in controlled mode with
  `applied: false` and the error `PR_SELECTION_CONTROLLED`. Set `selection` to
  `undefined` to return to uncontrolled mode, which starts from the internal
  selection.

- Quantities are shown and stepped as normalized quantities. A quantity above
  the maximum or off the step grid (from `selection` or `defaultSelection`) is
  shown in the stepper, billed and listed in the breakdown as its normalized
  value; the stored selection keeps the value the host passed. The decrease and
  increase buttons start from the normalized quantity.

Uncontrolled, with a preloaded selection:

```tsx
const ref = useRef<PricingRendererElement>(null);

<PricingRenderer
  ref={ref}
  yaml={source}
  defaultSelection={{ planId: 'growth' }}
  onReady={() => {
    ref.current?.applySelection({ planId: 'growth', billingPeriod: 'yearly' });
  }}
/>;
```

If the element may already be ready when the listener is attached, `onReady`
does not fire for that load; see
[Preload the current subscription](preload-current-subscription.md) to apply
at once from `resolvedState`.

Controlled:

```tsx
const [selection, setSelection] = useState<PricingSelection>();

<PricingRenderer
  yaml={source}
  selection={selection}
  onSelectionChange={(event) => setSelection(event.detail.selection)}
/>;
```

Read `resolvedState` in event handlers, for example to show the subtotal in
host UI after `pricing-ready` or `pricing-selection-change`. It resolves the
pricing on every read, so do not read it in a render loop. See
[Preload the current subscription](./preload-current-subscription.md) for
`applySelection` in a full flow.

## Current selection and pending actions

`currentSelection` tells the element what the customer already has. It is not the
selection: `selection` and `applySelection` set what the editor shows, while
`currentSelection` only marks and labels.

```ts
renderer.currentSelection = {
  planId: 'growth',
  addOns: { extraStorage: { selected: true, quantity: 2 } },
};
renderer.applySelection(renderer.currentSelection); // start the editor on the contract
```

- The element keeps a deep copy of the value. Changing your object later has no
  effect until you set the property again.
- It never becomes the selection in effect and emits no
  `pricing-selection-change`. To start the editor on the contract, also call
  `applySelection` with the same value, as in
  [Preload the current subscription](./preload-current-subscription.md).
- When `planId` is a plan of the loaded pricing, that plan's card gets
  `data-current="true"` and a "Your plan" badge, and its CTA becomes a disabled
  "Current plan" button. Add-ons that the reconciled contract still selects get a
  "Current" badge. The other plans' CTAs read "Upgrade to {plan}" or "Downgrade to
  {plan}", by the declaration order of the plans in the pricing (private plans
  included, even when `visibility` hides their cards), or "Contact sales" when the
  plan has no price amount.
- While the current plan is known and `ctaEnabled` is true, the price summary also
  has a button, `summary-action`: "Review change ({total})", or "Contact sales"
  when the selection requires a quote. It is disabled while the selection equals
  the current one. Its click emits `pricing-action` (see [Events](./events.md)).
- An unknown `planId` marks nothing, keeps the default CTA labels and emits a
  `pricing-diagnostic` with `PR_CURRENT_SELECTION_UNKNOWN_PLAN`. Unknown add-on ids
  are ignored with `PR_CURRENT_SELECTION_UNKNOWN_ADDON`. Both are emitted once per
  change of `currentSelection` or of the pricing, and are not listed in the
  element's warnings.
- Set it to `undefined` to remove every mark; the element then renders as before.

`pendingActionId` (attribute `pending-action-id`) tells the element that the host
is working on one action, for example after a `pricing-action` that it did not
finish at once. While it is set:

- the CTA or the summary action with that action id has `aria-busy="true"`,
  `data-pending="true"` and a "Processing…" text;
- every plan CTA and the summary action has `aria-disabled="true"`, and activating
  one emits no `pricing-action` and does not follow a link. `aria-disabled` is used
  so that keyboard focus stays on the control that was activated;
- plan and add-on controls stay enabled. The host decides whether the edit may
  continue.

```ts
renderer.addEventListener('pricing-action', (event) => {
  event.preventDefault();
  renderer.pendingActionId = (event as PricingActionEvent).detail.actionId;
  void startChange().finally(() => {
    renderer.pendingActionId = undefined;
  });
});
```

### CTA labels and links

An entry of `presentation.ctas` can set `labels` for the states above. Only string
values are kept:

```ts
renderer.presentation = {
  ctas: [
    {
      id: 'start-starter',
      label: 'Start with Starter',
      planId: 'starter',
      labels: {
        upgrade: 'Move up to Starter',
        downgrade: 'Move to Starter',
        current: 'Your current plan',
        contactSales: 'Talk to us',
      },
    },
  ],
};
```

`labels.current` replaces "Current plan", `labels.upgrade` and `labels.downgrade`
replace "Upgrade to {plan}" and "Downgrade to {plan}", and `labels.contactSales`
replaces "Contact sales" for a plan without a price amount. Without a known
current plan, `label` is used as before.

In the `href` of a plan CTA, every `{planId}` is replaced with
`encodeURIComponent` of the plan's id before the link is checked, for example
`https://example.com/signup?plan={planId}`. The `pricing-action` detail has the
expanded value. An expanded link that is not safe renders the CTA as a button.

## Presentation precedence

Presentation can be owned by three layers:

1. Per-instance `presentation` on the Web Component or React adapter.
2. Project defaults passed to `configurePricingRenderer`.
3. Portable YAML metadata under `custom.pricingRenderer`.

Plan-keyed `planHighlights` and `planBadges` maps merge by plan, while an entry
from a higher layer replaces the same plan's entry. This makes shared defaults
easy to extend for one pricing page without mutating the iPricing. `unitLabels`
merges per locale and per unit, and the higher layer wins.

## Unit labels

`presentation.unitLabels` sets the singular and plural text of a usage unit
shown next to a number. It is keyed by locale, then by unit, and each entry has
a `one` and an `other` form. The locale key `*` applies to every locale.

```ts
configurePricingRenderer({
  presentation: {
    unitLabels: {
      '*': { seat: { one: 'seat', other: 'seats' } },
      es: { credit: { one: 'crédito', other: 'créditos' } },
    },
  },
});
```

The same map can live in the pricing, so it travels with the YAML:

```yaml
custom:
  pricingRenderer:
    unitLabels:
      es:
        credit:
          one: crédito
          other: créditos
```

An entry wins over the built-in unit rules, including for compound or
uppercase units such as `user/month` or `GB`. Entries that are not an object,
or whose `one` or `other` is missing, not a string or blank, are ignored.
Layers merge per locale key first, then the lookup order (exact tag, base
language, `*`) applies to the merged map, so an exact-locale entry from a lower
layer wins over a `*` or base-language entry from a higher layer. Locale keys
ignore case and treat `_` as `-`. See [Internationalization](i18n.md#unit-labels)
for the lookup order.

## Reading and validating configuration

```ts
import {
  createPricingRendererConfig,
  DEFAULT_PRICING_RENDERER_CONFIG,
  getPricingRendererConfig,
} from 'pricing-renderer';

const validated = createPricingRendererConfig({
  locale: 'es-es',
  pricingPath: '/precios/',
});
// { locale: 'es-ES', pricingPath: '/precios', ...enabledDefaults }

console.info(DEFAULT_PRICING_RENDERER_CONFIG);
console.info(getPricingRendererConfig());
```

Invalid locales and non-absolute pricing paths throw `TypeError` during
initialization rather than creating a silently inconsistent integration.

## SSR and multiple applications

Project configuration is module-global and intended to run once during client
application bootstrap. Do not mutate it per request in a shared SSR process.
For request-, tenant-, or locale-specific rendering, pass per-instance props.
