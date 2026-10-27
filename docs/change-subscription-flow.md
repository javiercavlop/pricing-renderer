# Change a subscription

A customer who has a subscription opens the pricing page, changes the plan or the
add-ons, reviews what changes and confirms. The package gives you the pieces. Your
backend owns the contract, the checkout and the call to the billing system: the
package makes no HTTP call, and the route names below are examples.

- Mark the current plan and add-ons, CTA labels:
  [Current selection and pending actions](./configuration.md#current-selection-and-pending-actions).
- Load the contract into the editor:
  [Preload the current subscription](./preload-current-subscription.md).
- Compare two selections: [`compareSelections`](./api-reference.md#compareselections).
- SPACE helpers: [`pricing-renderer/space`](./api-reference.md#pricing-rendererspace).
- The review element: [`pricing-change-review`](./api-reference.md#pricing-change-review-element).
- Events: [Events](./events.md).

## Three ways to build the review

Pick one. All three start from the same comparison.

1. **Compute it in the host.** Call `compareSelections` yourself, on the server or
   in the browser, with the contract on one side and the edit on the other. The
   result is JSON-safe, so a route can return it. The sections below use this
   route, with the SPACE adapter from `pricing-renderer/space`.
2. **Use the review element.** Render `<pricing-change-review>` (or the React
   `PricingChangeReview`) and give it the comparison. It owns the Confirm and Back
   buttons, the notices and the error text, and emits `pricing-change-confirm` and
   `pricing-change-back`.
3. **Build your own screen.** Read the fields of the comparison and render them
   with your design system. Nothing in `compareSelections` needs the DOM or a
   custom element.

Routes 2 and 3 differ only in who renders the comparison.

## The pricing version the editor shows

By default the editor shows the pricing version of the customer's contract. The
customer sees the plan they have, marked as current, on the prices they signed up
to. Both sides of `compareSelections` then use the same pricing, and the
comparison reports the plan, add-on, feature, limit and price changes of the edit.

A host may instead offer a move to another version, for example when the
contract's version is retired or a migration campaign runs. The rule is yours. In
that case:

- show the offered version in the editor;
- use the normalized pricing of the contract's version as the `before` side and
  the offered one as the `after` side. `comparison.version` then reports the
  versions and the ids that exist in only one of them;
- `currentSelection` marks the current plan only when its id exists in the offered
  version. Otherwise the element reports `PR_CURRENT_SELECTION_UNKNOWN_PLAN` and
  marks nothing.

The element compares within the loaded pricing. When the customer keeps the same
plan and add-ons on the offered version, the summary action reports `'current'` and
is disabled, and so is the current plan's CTA. In the offer path, render your own
action (for example "Review the move to version 2.0") that asks your preview route
for the cross-version comparison.

## The three host routes

### 1. Read the subscription

`GET /subscription/current` reads the SPACE contract and returns:

- `contract`: the parts of the contract that the package reads
  (`SpaceContractLike`);
- `contractVersion`: a concurrency token, for example the contract's update time or
  the length of its history;
- `currentPricingYaml`: the Pricing2Yaml of `contractedVersion(contract, service)`;
- `offerPricingYaml`: only when you offer another version.

The client sets `yaml` to `currentPricingYaml`. When `pricing-ready` fires it loads
the contract into the editor and marks it as current, with the same value.

### 2. Preview

`POST /subscription/preview { selection, contractVersion, pricingVersion }`.
`pricingVersion` is the `metadata.version` of the pricing the editor shows. The
backend:

- answers 409 when the contract token or the pricing version is no longer current;
- computes `compareSelections` with its own copy of both pricings and the usage
  from `currentUsageFromContract`, so prices that the client computed are never
  trusted;
- returns `{ comparison, notices }`.

The client renders the review with them. You can show a comparison computed in the
browser while the preview loads, but keep Confirm `pending` until the server
comparison arrives.

### 3. Apply

`POST /subscription/apply { selection, contractVersion, pricingVersion, idempotencyKey }`.
The backend:

- checks that the contract's current token equals `contractVersion` and that
  `pricingVersion` is a version it still offers, else answers 409;
- computes `compareSelections` again from `selection`, on its own pricings. It
  never uses a comparison that the client sent;
- sends the SPACE novation built by
  `subscriptionFromSelection(service, pricingVersion, comparison.selections.after)`,
  which is reconciled and carries billed quantities;
- returns the new contract.

SPACE keeps versions with `_` instead of `.` and the helpers turn them back, so
pass the dotted version. Service keys are matched exactly: pass the lowercase key
SPACE stores.

## A complete sample

The server side, with the routes as plain functions. `loadPricing` returns the
normalized pricing of a version from your own store:

```ts
import { compareSelections, type NormalizedPricing, type PricingSelection } from 'pricing-renderer';
import {
  contractedVersion,
  currentUsageFromContract,
  selectionFromContract,
  subscriptionFromSelection,
  type SpaceContractLike,
} from 'pricing-renderer/space';

const service = 'acme';

declare function loadPricing(version: string): NormalizedPricing | undefined;
declare function readContract(
  userId: string,
): Promise<{ contract: SpaceContractLike; token: string }>;
declare function novate(userId: string, body: unknown): Promise<unknown>;

class Conflict extends Error {} // answer 409

async function compare(
  userId: string,
  selection: Partial<PricingSelection>,
  pricingVersion: string,
) {
  const { contract, token } = await readContract(userId);
  const beforePricing = loadPricing(contractedVersion(contract, service) ?? '');
  const afterPricing = loadPricing(pricingVersion);
  if (!beforePricing || !afterPricing) throw new Conflict('Unknown pricing version');
  const comparison = compareSelections({
    before: { pricing: beforePricing, selection: selectionFromContract(contract, service) },
    after: { pricing: afterPricing, selection },
    currentUsage: currentUsageFromContract(contract, service),
  });
  return { comparison, token };
}

export async function preview(
  userId: string,
  body: { selection: Partial<PricingSelection>; contractVersion: string; pricingVersion: string },
) {
  const { comparison, token } = await compare(userId, body.selection, body.pricingVersion);
  if (token !== body.contractVersion) throw new Conflict('The subscription changed');
  return { comparison, notices: ['Your new price applies from the next invoice.'] };
}

export async function apply(
  userId: string,
  body: {
    selection: Partial<PricingSelection>;
    contractVersion: string;
    pricingVersion: string;
    idempotencyKey: string;
  },
) {
  const { comparison, token } = await compare(userId, body.selection, body.pricingVersion);
  if (token !== body.contractVersion) throw new Conflict('The subscription changed');
  return novate(
    userId,
    subscriptionFromSelection(service, body.pricingVersion, comparison.selections.after),
  );
}
```

The browser side. The editor starts on the contract, the summary action asks for a
preview, and the review element confirms it:

```ts
import type { SelectionComparison } from 'pricing-renderer';
import type {
  PricingActionEvent,
  PricingChangeConfirmEvent,
  PricingReadyEvent,
  PricingRendererElement,
} from 'pricing-renderer/element';
import { selectionFromContract } from 'pricing-renderer/space';
import 'pricing-renderer/define';
import 'pricing-renderer/define-change-review';

declare function getJson(url: string): Promise<any>;
declare function postJson(url: string, body: unknown): Promise<any>;

const service = 'acme';
const renderer = document.querySelector('pricing-renderer') as PricingRendererElement;
const review = document.createElement('pricing-change-review');
document.body.append(review);

let current = await getJson('/subscription/current');
let pricingVersion = ''; // metadata.version of the pricing the editor shows
let latestPreview = 0;

const loadContract = (): void => {
  const selection = selectionFromContract(current.contract, service);
  renderer.currentSelection = selection;
  renderer.applySelection(selection);
};

renderer.yaml = current.currentPricingYaml;
renderer.addEventListener('pricing-ready', (event) => {
  pricingVersion = (event as PricingReadyEvent).detail.pricing.metadata.version ?? '';
  loadContract();
});

const showPreview = async (notice?: string): Promise<void> => {
  const request = ++latestPreview;
  const selection = renderer.resolvedState?.selection;
  if (!selection) return;
  try {
    const result = await postJson('/subscription/preview', {
      selection,
      contractVersion: current.contractVersion,
      pricingVersion,
    });
    if (request !== latestPreview) return; // a newer preview replaced this one
    review.comparison = result.comparison as SelectionComparison;
    review.notices = notice ? [notice, ...result.notices] : result.notices;
    review.error = undefined;
  } catch (error) {
    if (request !== latestPreview) return;
    review.error = 'The preview failed. Try again.';
    console.error(error);
  }
};

renderer.addEventListener('pricing-action', (event) => {
  event.preventDefault(); // the host owns the next step
  const { actionId } = (event as PricingActionEvent).detail;
  if (actionId !== 'review-change') return;
  renderer.pendingActionId = actionId;
  void showPreview().finally(() => {
    renderer.pendingActionId = undefined;
  });
});

review.addEventListener('pricing-change-confirm', async (event) => {
  const { comparison } = (event as PricingChangeConfirmEvent).detail;
  // the element set `pending` itself, because the event was not canceled
  try {
    await postJson('/subscription/apply', {
      selection: comparison.selections.after,
      contractVersion: current.contractVersion,
      pricingVersion,
      idempotencyKey: crypto.randomUUID(),
    });
    current = await getJson('/subscription/current');
    loadContract();
    review.comparison = undefined;
  } catch (error) {
    review.pending = false;
    review.error = 'The change could not be applied.';
    console.error(error);
  }
});

review.addEventListener('pricing-change-back', () => {
  review.comparison = undefined; // the edit in the renderer is untouched
});
```

`pricingVersion` comes from the `pricing` of the `pricing-ready` detail.

## Errors and races

- **Keep the edit.** After a failed preview or apply, do not call `reload()` or
  `applySelection`, and do not change `selection`. Keep `<pricing-renderer>`
  mounted so that Back returns to the same edit.
- **Double submit.** Without a canceled event, the review element sets `pending`
  before the dispatch returns, so a second click is ignored. Keep `pending` (or
  `pendingActionId` on the renderer) set until the apply route answers, and send an
  `idempotencyKey` per Confirm so that a retry after a timeout does not apply the
  change twice. A host that manages `pending` itself calls `preventDefault()` on
  `pricing-change-confirm`.
- **Cancelable `pricing-action`.** Cancel it, set `pendingActionId` to its
  `actionId`, and clear the property when the work ends. While it is set every plan
  CTA and the summary action ignore activation, and a link CTA does not navigate.
- **Stale contract.** When the contract changed after route 1 (another tab, a
  billing job), the apply route answers 409. Fetch route 1 again, set
  `currentSelection` from the new contract, run the preview again with the
  customer's unchanged edit, show a notice such as "Your subscription changed;
  review the new comparison", and clear `pending`.
- **Stale pricing version.** When the version changed between the preview and the
  apply, the apply route answers 409. Reload route 1 and run the preview again. A
  comparison is never reused across versions.
- **Network failure or a 5xx.** Set `error` (plain text, never HTML), clear
  `pending`, keep the comparison and let the customer retry.
- **Out-of-order responses.** Number each preview request and ignore a response
  that is not the latest, as the sample does.
- **Diagnostics.** Show `PR_COMPARE_*` diagnostics to support staff, not to
  customers. An unknown current plan means that the contract and the pricing
  version disagree, which the backend has to resolve.
- **Exclusions.** `reconcileSelection` does not enforce `excludes`. A selection
  that you build outside the element can be one that the element's dialog would
  not allow, so validate it on the server.
