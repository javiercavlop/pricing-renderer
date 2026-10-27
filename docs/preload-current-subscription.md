# Preload the current subscription

A customer who already has a subscription should open the pricing page on the
plan and add-ons they have today, then change them. `applySelection` loads that
selection into `<pricing-renderer>` once the pricing is ready, and the element
keeps the selection afterwards.

## The SPACE contract

A SPACE contract stores the current subscription by service. The parts that
matter here are:

```ts
interface SpaceContract {
  subscriptionPlans?: Record<string, string>; // service -> plan name
  subscriptionAddOns?: Record<string, Record<string, number>>; // service -> add-on -> quantity
}
```

```json
{
  "subscriptionPlans": { "acme": "growth" },
  "subscriptionAddOns": { "acme": { "extraStorage": 2, "prioritySuccess": 1 } }
}
```

The contract carries no billing period, so the mapping does not set one. An
omitted `billingPeriod` becomes the schema default (the billing period with
multiplier 1), not the period in `defaultSelection` and not the one in effect.
To keep another period, pass `billingPeriod` to `applySelection`, for example
the one from `renderer.resolvedState?.selection.billingPeriod`.

## Map the contract to a selection

The subpath `pricing-renderer/space` exports `selectionFromContract(contract, serviceKey)`.
Its input type (`SpaceContractLike`) is structural, so nothing depends on SPACE.
The subpath has no runtime imports, needs no DOM and makes no HTTP call.

```ts
import { selectionFromContract } from 'pricing-renderer/space';

const selection = selectionFromContract(contract, 'acme');
```

Only the entries of `serviceKey` are read, and the key is matched exactly. SPACE
lowercases service names when it creates a contract, so pass the lowercase key.
Add-ons with a quantity that is 0, negative or not finite are left out. A service
that is not in the contract maps to `{}`.

The subpath has three more helpers:

- `subscriptionFromSelection(serviceKey, version, selection)` returns the SPACE
  novation body `{ contractedServices, subscriptionPlans, subscriptionAddOns }`
  for one service. Pass a reconciled selection and the dotted version of the
  pricing, for example `'2026.07'`. Add-ons that are not selected or have a
  quantity that is not a finite number above 0 are left out.
- `contractedVersion(contract, serviceKey)` returns the contracted version with
  each `_` turned back into `.` (SPACE stores `2026_07`), or `undefined`.
- `currentUsageFromContract(contract, serviceKey)` returns
  `{ [limit]: consumed }` for the `usageLevels` entries whose `consumed` is a
  finite number of at least 0.

`examples/space-contract/map-contract.ts` re-exports `selectionFromContract`
from the same module.

## Apply it when the pricing is ready

`applySelection` is refused while the pricing is loading, so call it from the
`pricing-ready` listener:

```ts
import { selectionFromContract } from 'pricing-renderer/space';

const renderer = document.querySelector('pricing-renderer');

renderer.addEventListener('pricing-ready', () => {
  const result = renderer.applySelection(selectionFromContract(contract, 'acme'));
  if (result.applied) {
    console.info(`Current subscription: ${result.resolved.subtotal}`);
  }
});
```

With React, use the forwarded ref (a ref to `PricingRenderer` is the element):

```tsx
const ref = useRef<PricingRendererElement>(null);

<PricingRenderer
  ref={ref}
  src={pricingUrl}
  onReady={() => {
    ref.current?.applySelection(selectionFromContract(contract, 'acme'));
  }}
/>;
```

The listener does nothing if you attach it after the first load has finished,
because `pricing-ready` has already fired. When the element may already be
ready, check `renderer.resolvedState` and apply at once, and still listen for
later loads:

```ts
const apply = () => {
  const keepPeriod = renderer.resolvedState?.selection.billingPeriod;
  renderer.applySelection({
    ...selectionFromContract(contract, 'acme'),
    billingPeriod: keepPeriod,
  });
};

if (renderer.resolvedState) apply(); // already ready
renderer.addEventListener('pricing-ready', apply); // later loads
```

The call is synchronous and the selection applied from the listener stays for
that load. It emits no `pricing-selection-change`, because the user changed
nothing.

`applySelection` replaces the selection. Fields you omit take the schema
defaults, not the current selection. An applied selection that the plan does not
allow is reconciled: add-ons that are unavailable for the plan, and their
dependents, are deselected.

## Read the subtotal

The result has the resolved pricing of the selection that was applied:

```ts
const result = renderer.applySelection(selection);
if (result.applied) {
  result.resolved.subtotal; // the subtotal the element renders
  result.selection; // the selection in effect after validation
}
```

Later, read `renderer.resolvedState` for the current `{ selection, resolved }`.
Read it on events, not in a render loop, because it resolves the pricing on each
read. The `pricing-ready` detail also has `selection` and `resolved`.

## Delivera flow

On `tests/fixtures/acme-pricing.yml` (defaults: 5 seats, monthly billing) the
customer's contract is:

```json
{
  "subscriptionPlans": { "acme": "growth" },
  "subscriptionAddOns": { "acme": { "extraStorage": 2, "prioritySuccess": 1 } }
}
```

`selectionFromContract(contract, 'acme')` returns Growth with 2 `extraStorage`
packs and `prioritySuccess`. After `applySelection`, the element shows Growth
selected and an estimate of 80 EUR (45 + 2 x 5 + 25), and `result.resolved.subtotal`
is 80. The customer then changes the plan or the add-ons as usual and each
change emits `pricing-selection-change`.

## Replace the private-state workaround

Earlier integrations preloaded a selection by writing the private
`_internalSelection` and `_viewModel` fields of the element. Remove that code:
those fields are not part of the API and may change in any release. Call
`applySelection` from `pricing-ready` instead.

## Handle diagnostics

An id that is not in the pricing does not throw. The call still applies what is
valid, returns the diagnostics and dispatches them in one `pricing-diagnostic`
event when the list is not empty:

```ts
const result = renderer.applySelection(selectionFromContract(contract, 'acme'));
for (const diagnostic of result.diagnostics) {
  console.warn(diagnostic.code, diagnostic.path);
}
```

- `PR_SELECTION_UNKNOWN_PLAN`: the plan name is not a plan id (ids are
  case-sensitive), so the plan in effect is kept.
- `PR_SELECTION_UNKNOWN_ADDON`: the add-on is not in the pricing and is dropped.
- `PR_SELECTION_ADDON_REMOVED`: the plan does not allow the add-on, so it is
  deselected.
- `PR_SELECTION_NOT_READY`: called before the pricing is ready; nothing is
  stored.
- `PR_SELECTION_CONTROLLED`: the `selection` property is set; nothing is stored.

`PR_SELECTION_UNKNOWN_BILLING_PERIOD` is also possible if you add a billing
period to the mapping. The diagnostics are not added to the list the element
renders.

`pricing-diagnostic` also fires for load diagnostics. A listener that treats any
error as a load failure must check the code, because `PR_SELECTION_NOT_READY` and
`PR_SELECTION_CONTROLLED` are errors that mean only that the call was refused.

## Reload

`reload()` or a new source restarts the element from `defaultSelection` (or the
schema defaults). An applied selection is not kept across loads, so the
`pricing-ready` listener above applies the contract again after each load.
