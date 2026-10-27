# Events

`<pricing-renderer>` reports what happens through four DOM events. All four are
`CustomEvent`s that bubble and are composed, so a listener on an ancestor, on
`document` or outside a shadow root receives them. Only `pricing-action` is
`cancelable`. The payload is always in `event.detail`.

| Event                      | Emitted when                                         | Cancelable | `detail`                                                       |
| -------------------------- | ---------------------------------------------------- | ---------- | -------------------------------------------------------------- |
| `pricing-ready`            | A load that completes with a pricing value           | No         | `{ pricing, diagnostics, selection, resolved }`                |
| `pricing-selection-change` | The user changed plan, billing, variables or add-ons | No         | `{ selection, resolved }`                                      |
| `pricing-action`           | The user clicked a plan CTA or the summary action    | Yes        | `{ actionId, planId?, href?, selection, resolved, metadata? }` |
| `pricing-diagnostic`       | A load or applySelection returned diagnostics        | No         | `{ diagnostics }`                                              |

Details that the table leaves out:

- `pricing-ready` is emitted for a load of `pricing`, `yaml` or `src` (with or
  without `loadPricing`), on the first load and on every later load that
  completes with a pricing value. A load superseded by a newer one emits nothing. It fires before the
  `pricing-diagnostic` event of the same load.
- `pricing-selection-change` follows a change by the user: plan, billing period,
  variable, add-on or add-on quantity, including a confirmed dialog. It is not
  emitted by `applySelection` or by a load.
- `pricing-diagnostic` is never emitted with an empty list.
- While `currentSelection` names a plan of the pricing, the `pricing-action` detail
  also has `relation` and `source` (see below). The table shows the detail without
  them, as it is when no current plan is known.

The event types are exported from `pricing-renderer/element`:

```ts
import type {
  PricingActionEvent,
  PricingDiagnosticEvent,
  PricingReadyEvent,
  PricingSelectionChangeEvent,
} from 'pricing-renderer/element';
```

## Review events

`<pricing-change-review>` has two events of its own. Both are `CustomEvent`s that
bubble, are composed and are `cancelable`. Properties, guards and default actions
are in the [API reference](./api-reference.md#pricing-change-review-element).

| Emitted by                | Event                    | Emitted when               | `detail`                              |
| ------------------------- | ------------------------ | -------------------------- | ------------------------------------- |
| `<pricing-change-review>` | `pricing-change-confirm` | The user activates Confirm | `{ comparison: SelectionComparison }` |
| `<pricing-change-review>` | `pricing-change-back`    | The user activates Back    | `{ comparison: SelectionComparison }` |

- `detail.comparison` is a detached deep copy of the `comparison` property.
- Confirm emits nothing while `pending` is true or the relation is `'current'`.
  When no listener calls `preventDefault()`, the element sets `pending` to true, so
  a second click cannot submit twice. A host that manages `pending` itself cancels
  the event.
- Back has no default action and does not change `pending`.
- The types are exported from `pricing-renderer/element`:
  `PricingChangeConfirmEvent` and `PricingChangeBackEvent`.

[Change a subscription](./change-subscription-flow.md) shows both in a full flow.

## `pricing-ready` and `pricing-selection-change`

```ts
interface PricingReadyDetail {
  pricing: NormalizedPricing;
  diagnostics: PricingDiagnostic[]; // the diagnostics of this load
  selection: PricingSelection; // the selection in effect
  resolved: ResolvedPricing;
}

interface PricingSelectionChangeDetail {
  selection: PricingSelection;
  resolved: ResolvedPricing;
}
```

`selection` is reconciled: add-ons that the plan does not allow, and their
dependents, are already deselected. The selection of a load starts from
`defaultSelection` or the schema defaults. To load an existing subscription from
a `pricing-ready` listener, see
[Preload the current subscription](./preload-current-subscription.md).

When the `selection` property is set (controlled mode), the element does not
store the change but still emits `pricing-selection-change` with the new
selection; the host decides whether to write it back.

## `pricing-action`

A plan card shows a CTA when `ctaEnabled` is true (the default, see
[Project and instance configuration](./configuration.md)). Clicking it emits
`pricing-action`. The CTA is the entry of `presentation.ctas` whose `planId`
matches the plan; a plan without one gets a default "choose plan" button. The
event is emitted for every click, whether or not the CTA has a link. While the
host sets `currentSelection`, the summary action in the price summary emits it
too (see "Relation and source").

```ts
interface PricingActionDetail {
  actionId: string;
  planId?: string;
  href?: string;
  selection: PricingSelection;
  resolved: ResolvedPricing;
  metadata?: UnknownRecord;
  relation?: SelectionRelation; // 'current' | 'upgrade' | 'downgrade' | 'change'
  source?: 'plan' | 'summary';
}
```

- `actionId`: the `id` of the CTA, or `choose-<planId>` when the plan has no
  configured CTA. Always present.
- `planId`: the plan of the card that was clicked. It is not the plan in
  `selection`, which is the plan currently selected. Typed optional; set for plan
  card CTAs.
- `href`: the `href` of the configured CTA, as configured but trimmed. Present only
  when the CTA has an `href`; check it before you use it.
- `selection`: the reconciled selection at the time of the click (plan, billing
  period, variables and add-ons). Always present.
- `resolved`: the prices resolved for that selection: `selection`, `planPrices`,
  `addOnPrices`, `subtotal`, `requiresQuote`, `diagnostics` and `breakdown`.
  Always present.
- `metadata`: the `metadata` of the configured CTA, passed through. Present only
  when the CTA has `metadata`.
- `relation` and `source`: see "Relation and source" below. Absent unless the
  current plan is known.

`href` is the `href` after the `{planId}` expansion: every `{planId}` in the
configured value is replaced with `encodeURIComponent` of the plan id before the
link is checked, so `https://example.com/signup?plan={planId}` gives
`https://example.com/signup?plan=growth` on the Growth card. An expanded value
that is not safe renders the CTA as a button.

### Relation and source

While `currentSelection.planId` is a plan of the loaded pricing, the detail also
has two fields:

- `source`: `'plan'` for a plan CTA, `'summary'` for the summary action.
- `relation`: for a plan CTA, how that plan relates to the current plan, by the
  declaration order of the plans (`'upgrade'` for a later plan, `'downgrade'` for
  an earlier one). For the summary action, the relation between the current
  selection and the selection in effect (`'current'`, `'upgrade'`, `'downgrade'`
  or `'change'`), and `planId` is the plan of the selection in effect.

The summary action has the action id `review-change`, or `contact-sales` when
the selection in effect requires a quote. It is disabled while the selection
equals the current one, so no event is emitted then. Without a known current plan
there is no summary action, and the detail of a plan CTA has no `relation` or
`source` key.

### While an action is pending

While `pendingActionId` is set, activating a plan CTA or the summary action emits
no `pricing-action`, and a link CTA does not navigate. Clear the property when
the host work is done.

### Cancel the default navigation

The event is `cancelable`. A CTA with a safe `href` (`http:`, `https:`,
`mailto:`, a value starting with `/` (this includes `//host` URLs), `./` or `../`, or a
`#` fragment) renders
as a link. When a listener calls `event.preventDefault()`, the element cancels
the click, so the browser does not follow the link. A CTA without an `href`, or
with one that is not safe (such as `checkout/growth` or `?plan=x`), renders as a
button and has no default navigation. Either way, calling
`preventDefault()` is how the host takes ownership of checkout, authentication
and navigation: the element never opens a checkout itself.

```ts
const renderer = document.querySelector('pricing-renderer')!;

renderer.addEventListener('pricing-action', (event) => {
  event.preventDefault();
  const { planId, selection } = (event as PricingActionEvent).detail;

  const params = new URLSearchParams({
    plan: planId ?? selection.planId ?? '',
    billing: selection.billingPeriod ?? '',
  });
  for (const [id, addOn] of Object.entries(selection.addOns)) {
    if (addOn.selected) params.append('addon', `${id}:${addOn.quantity}`);
  }
  window.location.assign(`/checkout?${params}`);
});
```

Without `preventDefault()` the element does nothing else: the link is followed,
or nothing happens for a button. `pricingPath` is configuration for the host
app and has no effect on this event.

### Read the price

`detail.resolved` is the same `ResolvedPricing` the element rendered, so the
host does not need to resolve the pricing again:

```ts
renderer.addEventListener('pricing-action', (event) => {
  const { resolved, planId } = (event as PricingActionEvent).detail;

  if (resolved.requiresQuote) {
    // at least one selected price has no amount: send the customer to sales
    return;
  }
  const price = planId ? resolved.planPrices[planId] : undefined;
  console.info('Total', resolved.subtotal, 'plan price', price);
});
```

`resolved.subtotal` is the total of the selection (plan plus selected
add-ons). `resolved.breakdown` lists the lines of that total.

## `pricing-diagnostic`

```ts
interface PricingDiagnosticDetail {
  diagnostics: PricingDiagnostic[];
}

interface PricingDiagnostic {
  code: string; // see the code reference below
  severity: 'info' | 'warning' | 'error';
  message: string; // for logs, not for end users
  path?: string; // where in the pricing or selection, for example "plans.growth.price"
  details?: UnknownRecord;
}
```

It is emitted in four cases:

- **Load.** After each load (`pricing`, `yaml`, or `src` with or without
  `loadPricing`) that returns diagnostics: source problems, YAML parse
  problems, validation of the pricing (version, prices, billing, add-ons). A
  successful load can carry warnings, so `pricing-ready` and `pricing-diagnostic` can both be emitted for
  one load.
- **Missing source.** `reload()` with no source, or with more than one of
  `pricing`, `yaml` and `src`.
- **`applySelection`.** When the returned `diagnostics` is not empty, including a
  refused call. The same list is the `diagnostics` of the returned result. See
  [Preload the current subscription](./preload-current-subscription.md).
- **`currentSelection`.** After an update that follows a change of
  `currentSelection` or of the loaded pricing, when the current selection has a
  plan id or add-on ids that the pricing does not define: one warning per id,
  `PR_CURRENT_SELECTION_UNKNOWN_PLAN` or `PR_CURRENT_SELECTION_UNKNOWN_ADDON`. It
  is emitted once per change, not on every render.

The prices that fail to resolve while rendering (`resolved.diagnostics`) are not
dispatched with this event; read them from `resolved`.

### Severity is not a load failure

A diagnostic with `severity: 'error'` does not always mean the pricing failed
to load. The pricing is usable when the load emitted `pricing-ready`, even if it
carries errors such as `PR_PRICE_INVALID`. Errors from `applySelection`
(`PR_SELECTION_NOT_READY` and `PR_SELECTION_CONTROLLED`) mean only that the call
was refused. Do not treat every error as a load failure: decide by code.

```ts
const loadFailures = new Set([
  'PR_SOURCE_MISSING',
  'PR_SOURCE_CONFLICT',
  'PR_SOURCE_URL_INVALID',
  'PR_SOURCE_PROTOCOL_INVALID',
  'PR_SOURCE_HTTP_ERROR',
  'PR_SOURCE_TOO_LARGE',
  'PR_SOURCE_ABORTED',
  'PR_SOURCE_LOAD_FAILED',
  'PR_FETCH_UNAVAILABLE',
  'PR_YAML_EMPTY',
  'PR_YAML_PARSE_ERROR',
  'PR_YAML_ROOT_INVALID',
  'PR_INPUT_INVALID',
  'PR_VERSION_INVALID',
  'PR_VERSION_UNSUPPORTED_MAJOR',
  'PR_VERSION_ADAPTER_FAILED',
]);

renderer.addEventListener('pricing-diagnostic', (event) => {
  for (const diagnostic of (event as PricingDiagnosticEvent).detail.diagnostics) {
    if (loadFailures.has(diagnostic.code)) {
      showPricingUnavailable(diagnostic); // no pricing to show
    } else if (diagnostic.severity === 'error') {
      reportToMonitoring(diagnostic); // pricing works, but the data has a defect
    } else {
      console.warn(diagnostic.code, diagnostic.path, diagnostic.message);
    }
  }
});
```

When a reload fails and an earlier pricing was loaded, the element keeps showing
the earlier pricing, so a load failure code does not always mean an empty page.
The element also lists the diagnostics of the load that are not `info` in its own
warnings disclosure; the diagnostics of `applySelection` and of `currentSelection`
are not added to it.

## Diagnostic code reference

The source is the stage that creates the diagnostic: **load** (`src` or
`loadPricing`), **parse** (YAML text), **normalize** (`normalizePricing`),
**resolve** (`resolvePricing`, in `resolved.diagnostics`), **applySelection** or
**element**. The table is HTML so that long cells stay on one row each.

<table>
<thead>
<tr><th>Code</th><th>Severity</th><th>Source</th><th>Meaning and what the host should do</th></tr>
</thead>
<tbody>
<tr><td><code>PR_SOURCE_MISSING</code></td><td>error</td><td>element</td><td>None of <code>pricing</code>, <code>yaml</code> or <code>src</code> is set. Set exactly one source.</td></tr>
<tr><td><code>PR_SOURCE_CONFLICT</code></td><td>error</td><td>element</td><td>More than one of <code>pricing</code>, <code>yaml</code> and <code>src</code> is set. Keep one.</td></tr>
<tr><td><code>PR_SOURCE_URL_INVALID</code></td><td>error</td><td>load</td><td><code>src</code> is not a valid URL. Fix the URL.</td></tr>
<tr><td><code>PR_SOURCE_PROTOCOL_INVALID</code></td><td>error</td><td>load</td><td><code>src</code> is not HTTP or HTTPS. Use an <code>http:</code> or <code>https:</code> URL.</td></tr>
<tr><td><code>PR_FETCH_UNAVAILABLE</code></td><td>error</td><td>load</td><td>There is no <code>fetch</code> in the runtime. Pass <code>request.fetch</code> or a <code>loadPricing</code> function.</td></tr>
<tr><td><code>PR_SOURCE_HTTP_ERROR</code></td><td>error</td><td>load</td><td>The server answered with a status that is not 2xx (it is in the message). Fix the URL or the credentials, then call <code>reload()</code>.</td></tr>
<tr><td><code>PR_SOURCE_TOO_LARGE</code></td><td>error</td><td>load</td><td>The source is larger than <code>request.maxBytes</code>. Raise the limit or shrink the file.</td></tr>
<tr><td><code>PR_SOURCE_ABORTED</code></td><td>error</td><td>load</td><td>The request timed out or was cancelled. Retry with <code>reload()</code> or raise <code>request.timeoutMs</code>.</td></tr>
<tr><td><code>PR_SOURCE_LOAD_FAILED</code></td><td>error</td><td>load</td><td>The request or the <code>loadPricing</code> function threw, for example on a network error. Show an error state and offer a retry.</td></tr>
<tr><td><code>PR_YAML_EMPTY</code></td><td>error</td><td>parse</td><td>The YAML text is empty. Check what the source returns.</td></tr>
<tr><td><code>PR_YAML_PARSE_ERROR</code></td><td>error</td><td>parse</td><td>The YAML is invalid; the message has the position. Fix the document.</td></tr>
<tr><td><code>PR_YAML_PARSE_WARNING</code></td><td>warning</td><td>parse</td><td>The YAML parsed with a warning. The pricing still loads; review the document.</td></tr>
<tr><td><code>PR_YAML_ROOT_INVALID</code></td><td>error</td><td>parse</td><td>The YAML root is not a mapping. Fix the document.</td></tr>
<tr><td><code>PR_INPUT_INVALID</code></td><td>error</td><td>normalize</td><td>The pricing input is not an object. Pass the parsed pricing.</td></tr>
<tr><td><code>PR_VERSION_INVALID</code></td><td>error</td><td>normalize</td><td><code>syntaxVersion</code> is missing or is not a version such as <code>3.1</code>. Fix the pricing.</td></tr>
<tr><td><code>PR_VERSION_UNSUPPORTED_MAJOR</code></td><td>error</td><td>normalize</td><td>The major version is not 3. Convert the pricing or pass a syntax adapter in <code>normalizeOptions</code>.</td></tr>
<tr><td><code>PR_VERSION_BEST_EFFORT</code></td><td>warning</td><td>normalize</td><td>The minor version is not 3.1, so the compatible 3.1 subset is rendered. Check that nothing you need is ignored.</td></tr>
<tr><td><code>PR_VERSION_ADAPTED</code></td><td>info</td><td>normalize</td><td>A syntax adapter converted the pricing. Informational.</td></tr>
<tr><td><code>PR_VERSION_ADAPTER_FAILED</code></td><td>error</td><td>normalize</td><td>A syntax adapter threw or returned the same object. Fix the adapter.</td></tr>
<tr><td><code>PR_PRICE_INVALID</code></td><td>error</td><td>normalize</td><td>A numeric price is negative or not finite and shows as unavailable. Fix the value at <code>path</code>.</td></tr>
<tr><td><code>PR_PRICE_MISSING</code></td><td>warning</td><td>normalize</td><td>A price is missing and shows as a quote request. Add a price at <code>path</code> or accept the quote.</td></tr>
<tr><td><code>PR_EXPRESSION_INVALID</code></td><td>error</td><td>normalize</td><td>A price expression cannot be parsed. Fix the expression at <code>path</code>.</td></tr>
<tr><td><code>PR_BILLING_INVALID</code></td><td>warning</td><td>normalize</td><td>A billing multiplier is not a positive number and is dropped. Fix the value at <code>path</code>.</td></tr>
<tr><td><code>PR_ADDON_CONSTRAINTS_INVALID</code></td><td>error (normalize), warning (resolve)</td><td>normalize, resolve</td><td>The add-on quantity constraints are invalid. From normalize (error): <code>min</code> is below 0, <code>step</code> is not above 0 or <code>max</code> is below <code>min</code>, and the constraints are ignored. From resolve (warning): <code>max</code> cannot be reached from <code>min</code> in steps of <code>step</code>, so quantities are capped at the last value on the grid. Fix the constraints at <code>path</code>.</td></tr>
<tr><td><code>PR_ADDON_DEPENDENCY_MISSING</code></td><td>error</td><td>normalize</td><td>An add-on depends on an add-on that does not exist. Fix the id at <code>path</code>.</td></tr>
<tr><td><code>PR_ADDON_EXCLUSION_MISSING</code></td><td>warning</td><td>normalize</td><td>An add-on excludes an add-on that does not exist. Fix the id at <code>path</code>.</td></tr>
<tr><td><code>PR_ADDON_PLAN_MISSING</code></td><td>warning</td><td>normalize</td><td>An add-on is available for a plan that does not exist. Fix the id at <code>path</code>.</td></tr>
<tr><td><code>PR_ADDON_DEPENDENCY_CYCLE</code></td><td>error</td><td>normalize</td><td>Add-ons depend on each other in a cycle. Break the cycle.</td></tr>
<tr><td><code>PR_PLANS_EMPTY</code></td><td>warning</td><td>normalize</td><td>The pricing defines no plans. Add plans or do not show the component.</td></tr>
<tr><td><code>PR_EXPRESSION_RESOLUTION_FAILED</code></td><td>error</td><td>resolve</td><td>A price expression failed for the current selection. The element keeps the last valid price of that item when it has one. Check the variables and the expression at <code>path</code>.</td></tr>
<tr><td><code>PR_SELECTION_UNKNOWN_PLAN</code></td><td>warning</td><td>applySelection</td><td><code>planId</code> is not a plan id (ids are case-sensitive); the plan in effect is kept. Map the name to a valid id.</td></tr>
<tr><td><code>PR_SELECTION_UNKNOWN_BILLING_PERIOD</code></td><td>warning</td><td>applySelection</td><td><code>billingPeriod</code> is not a billing period of the pricing; the one in effect is kept. Use an id from the pricing.</td></tr>
<tr><td><code>PR_SELECTION_UNKNOWN_ADDON</code></td><td>warning</td><td>applySelection</td><td>An add-on id is not in the pricing and is ignored. Drop it from the mapping.</td></tr>
<tr><td><code>PR_SELECTION_ADDON_REMOVED</code></td><td>info</td><td>applySelection</td><td>The plan does not allow the add-on, or it depends on an add-on that was removed, so it was deselected; <code>details.addOnId</code> has the id. Tell the customer if it matters.</td></tr>
<tr><td><code>PR_SELECTION_NOT_READY</code></td><td>error</td><td>element</td><td><code>applySelection</code> was called before the pricing was ready; nothing was stored. Call it from <code>pricing-ready</code>.</td></tr>
<tr><td><code>PR_SELECTION_CONTROLLED</code></td><td>error</td><td>element</td><td><code>applySelection</code> was called while the <code>selection</code> property is set; nothing was stored. Update the property instead.</td></tr>
<tr><td><code>PR_CURRENT_SELECTION_UNKNOWN_PLAN</code></td><td>warning</td><td>element</td><td><code>currentSelection.planId</code> is not a plan of the loaded pricing (ids are case-sensitive), so no plan is marked as current and the CTAs keep their default labels. <code>path</code> is <code>currentSelection.planId</code>. The contract and the pricing version disagree: resolve it in the backend, not in the customer's screen.</td></tr>
<tr><td><code>PR_CURRENT_SELECTION_UNKNOWN_ADDON</code></td><td>warning</td><td>element</td><td>An add-on id of <code>currentSelection</code> is not in the loaded pricing and is ignored. <code>path</code> is <code>currentSelection.addOns.&lt;id&gt;</code>. Expected when the contract uses an older version.</td></tr>
<tr><td><code>PR_COMPARE_UNKNOWN_PLAN</code></td><td>warning</td><td>compareSelections</td><td>A side's plan id is not a plan of its pricing (ids are case-sensitive); the id is kept and that side requires a quote. <code>path</code> is <code>before.selection.planId</code> or <code>after.selection.planId</code>. Map the name to a valid id.</td></tr>
<tr><td><code>PR_COMPARE_UNKNOWN_BILLING_PERIOD</code></td><td>warning</td><td>compareSelections</td><td>A side's billing period is not a billing period of its pricing; the id is kept and the multiplier is 1. <code>path</code> is <code>&lt;side&gt;.selection.billingPeriod</code>. Use an id from the pricing.</td></tr>
<tr><td><code>PR_COMPARE_UNKNOWN_ADDON</code></td><td>warning</td><td>compareSelections</td><td>A side selects an add-on id that its pricing does not define, so the entry is dropped before pricing. <code>path</code> is <code>&lt;side&gt;.selection.addOns.&lt;id&gt;</code>. Expected when the contract uses an older version.</td></tr>
<tr><td><code>PR_COMPARE_ADDON_DROPPED</code></td><td>info</td><td>compareSelections</td><td>The edit selects an add-on that the plan does not allow or that depends on a removed add-on, and the contract did not have it, so it is in no list. <code>path</code> is <code>after.selection.addOns.&lt;id&gt;</code>; <code>details.addOnId</code> has the id.</td></tr>
<tr><td><code>PR_COMPARE_UNKNOWN_USAGE_LIMIT</code></td><td>info</td><td>compareSelections</td><td>A <code>currentUsage</code> key is not a usage-limit id of either pricing and is ignored. <code>path</code> is <code>currentUsage.&lt;id&gt;</code>.</td></tr>
<tr><td><code>PR_COMPARE_INVALID_USAGE</code></td><td>warning</td><td>compareSelections</td><td>A <code>currentUsage</code> value is not a finite number of at least 0 and is ignored. <code>path</code> is <code>currentUsage.&lt;id&gt;</code>. Fix the consumed amount.</td></tr>
</tbody>
</table>

## Related

- [Vue integration](./vue.md): listen to these events from Vue 3 templates.
- [API reference](./api-reference.md): the functions and types behind `detail`.
- [Preload the current subscription](./preload-current-subscription.md):
  `applySelection` and its diagnostics.
