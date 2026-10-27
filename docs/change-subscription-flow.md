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

## The review screen

`<pricing-change-review>` shows one `SelectionComparison` to the customer. The
properties, events and guards are in the
[API reference](./api-reference.md#pricing-change-review-element).

### States

- **No comparison.** The element renders nothing.
- **A comparison.** A heading ("Review your change"), one section per kind of
  change, the notices, the error and the Confirm and Back buttons.
- **Nothing to confirm** (`comparison.relation` is `'current'`). The sections are
  replaced by one note, "Your selection is the same as your current subscription."
  The notices, the error and the buttons stay. Confirm is `aria-disabled`.
- **Pending.** Confirm is `aria-disabled` and `aria-busy`, and a status line reads
  "Applying your change…".
- **Error.** When `error` is a non-empty string, an alert with the title "The change
  could not be applied." and your text is shown above the buttons.

### Sections

A section is left out when it has nothing to show. They appear in this order:

1. **Plan.** The plan name, or "before → after" when the plan changed, and a badge
   with the relation: "Upgrade", "Downgrade", "Change" or "No changes". When the
   pricing version changed, a banner reads "Pricing version before → after".
2. **Price.** "Current price" and "New price" as the subtotal in its currency and
   billing period, and "Difference" with its sign (for example `+€2` or `-€5`) when
   the comparison has one. When it has none, a note says why: part of the price
   requires a quote, or the currencies differ. A price that is only a quote reads
   "Contact sales"; a partial one adds "requires a quote". A change of billing
   period gets a note.
3. **Add-ons.** One row per add-on that is added ("Added"), removed by the customer
   or removed by reconciliation ("Removed", with the reason: not available with the
   new plan, requires an add-on that is removed, or not offered in the new
   pricing), or whose quantity changed ("Quantity before → after"). A quantity above
   1 is shown as "× n".
4. **Features.** One row per feature that is gained, lost or changed, with a badge
   and, for a change, "before → after". Values read "Included", "Not included" or
   "Unlimited", a number formatted for the locale with its unit, or the text; an
   array or an object is written as JSON.
5. **Usage limits.** One row per changed limit with "before → after", the unit and
   the signed difference when it is a number. When the new limit is below the
   customer's current usage, the row adds a note: "Your current usage (150 GB) is
   above the new limit." A limit that did not change is not listed here, even when
   the usage is above it.
6. **Unchanged.** One line with the number of add-ons, features and usage limits
   that stay the same. It is left out when all three are 0.

After the sections come the `notices` of the host, each as a line under "Before
you confirm", then the error and the buttons.

### Focus

- When `comparison` is set or replaced, focus moves to the heading, so a screen
  reader starts at the review.
- When `error` becomes a non-empty text, focus moves to Confirm, so the customer
  can retry once the host has set `pending` back to false. When `comparison` and
  `error` change in the same update, the heading wins.
- Confirm is `aria-disabled`, not `disabled`, so it keeps focus while the work is
  pending.

### Localization

All text comes from the `pricing.review*` keys of the catalog for the element's
`locale` (`en-US` and `es-ES` are built in), with the `messages` property on top.
Numbers, currency and units use `Intl` for that locale, and `_` in a locale such as
`es_ES` is read as `-`. `confirmLabel` replaces only the text of Confirm. The keys
are listed in [Internationalization](./i18n.md#review-screen-keys).

### Text only

Plan, add-on and feature names, labels, values, `notices` and `error` are rendered
as text. The element never sets or parses HTML from them, so a name that contains
markup is shown as written. If you need links or formatting in a notice, build your
own screen (route 3).

### Look

Layout, tokens, dark theme, forced colors and reduced motion are in
[Theming](./theming.md#the-review-element).

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
- when the offered version lacks an add-on that the contract has, merge the
  contract's add-on ids that the offered version lacks into the `after` selection
  on the server. `compareSelections` reports an add-on as removed with the reason
  `'not-in-version'` only when the `after` input selected it; otherwise it appears
  in `removedByUser`, as if the customer had unchecked it;
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
declare function offeredVersion(): string | undefined; // the version you offer now, if any
declare function novate(
  userId: string,
  body: unknown,
  guard: { expectedToken: string; idempotencyKey: string }, // compare-and-set on the token
): Promise<unknown>;

class Conflict extends Error {} // answer 409

async function compare(
  userId: string,
  selection: Partial<PricingSelection>,
  pricingVersion: string,
) {
  const { contract, token } = await readContract(userId);
  const contractVersion = contractedVersion(contract, service) ?? '';
  // never trust the client's version: only the contract's own or the one you offer now
  if (pricingVersion !== contractVersion && pricingVersion !== offeredVersion()) {
    throw new Conflict('Unknown pricing version');
  }
  const beforePricing = loadPricing(contractVersion);
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
    { expectedToken: token, idempotencyKey: body.idempotencyKey },
  );
}
```

`userId` comes from the server session, never from the body. All three routes need
session authentication, an ownership check on the contract and CSRF protection.
`novate` applies the change only if the contract still has the token that `compare`
read, and it stores the `idempotencyKey`, so a replay returns the first result. The
token check in `apply` alone leaves a window between the read and the write.

Bound the size of the request body, drop selection ids that the pricing does not
define before `compareSelections`, and render `PR_COMPARE_*` diagnostics as text only.

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
let idempotencyKey: string | undefined; // set by the first Confirm, cleared on success

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
    review.pending = false; // a new comparison is a new change
    idempotencyKey = undefined;
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
  idempotencyKey ??= crypto.randomUUID(); // one key per Confirm, kept for retries
  try {
    await postJson('/subscription/apply', {
      selection: comparison.selections.after,
      contractVersion: current.contractVersion,
      pricingVersion,
      idempotencyKey,
    });
    idempotencyKey = undefined; // the next Confirm is a new change
    current = await getJson('/subscription/current');
    loadContract();
    review.comparison = undefined;
    review.pending = false;
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
  `pendingActionId` on the renderer) set until the apply route answers, and send one
  `idempotencyKey` per pending Confirm, kept until the apply succeeds and not
  regenerated on a retry, so that a retry after a timeout does not apply the change
  twice. A host that manages `pending` itself calls `preventDefault()` on
  `pricing-change-confirm`.
- **Clear `pending` after success.** The element sets `pending = true` on Confirm and
  never clears it. After a successful apply set `review.pending = false`, and do the
  same when `showPreview` assigns a new comparison, so the next review starts with an
  enabled Confirm. The sample does both and also drops the idempotency key then.
- **Cancelable `pricing-action`.** Cancel it, set `pendingActionId` to its
  `actionId`, and clear the property when the work ends. While it is set every plan
  CTA and the summary action ignore activation, and a click on a link CTA does not navigate (a middle click or a
  new tab is not blocked, so keep the server idempotent).
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
