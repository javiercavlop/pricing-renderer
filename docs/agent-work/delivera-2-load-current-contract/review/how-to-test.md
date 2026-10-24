# How to test: load the current contract into the renderer (PR #35)

Status of this guide: written from the spec
(`docs/agent-work/delivera-2-load-current-contract/spec.md`), the source
(`src/core/apply-selection.ts`, `src/element/pricing-renderer-element.ts`,
`examples/vanilla/src/main.ts`) and the Playwright tests under
`load API` in `tests/browser/pricing-renderer.spec.ts`. The role that wrote it
had no way to start the demo, run `pnpm test` or Playwright, or capture
screenshots (the only registered check is the formatting check of this
guide), so **no step below was executed**. Every step is marked
`not verified`, with the nearest existing evidence named. Expected values come
from the spec. No images are included and no visual snapshot under
`tests/browser` was added or updated (the spec lists "Visual snapshots
unchanged").

## Setup

```sh
pnpm install --frozen-lockfile
pnpm demo        # builds, then serves the vanilla demo at http://127.0.0.1:4173
```

Open http://127.0.0.1:4173 and scroll to "Configure it like a customer
would". The demo page loads the acme fixture (`tests/fixtures/acme-pricing.yml`)
itself (`renderer.yaml = pricingYaml` in `examples/vanilla/src/main.ts`), with
`variablesEnabled: true` and `locale: 'en-US'`. On load it shows **Starter**
selected and **€20** in the summary.

Open the browser console and define the handle once per page load. Reload the
page between steps so every case starts from Starter and €20.

```js
const r = document.querySelector('pricing-renderer');
```

## UI steps

All steps use the console. Planned captures are not possible in this run; no
file is named below.

### 1. The Delivera flow: Growth with 2 Extra Storage and Priority Success

Run:

```js
const result = r.applySelection({
  planId: 'growth',
  addOns: {
    extraStorage: { selected: true, quantity: 2 },
    prioritySuccess: { selected: true, quantity: 1 },
  },
});
[result.applied, result.resolved.subtotal, result.removedAddOnIds, result.diagnostics];
```

Expect: `[true, 80, [], []]`. On the page (after the next frame): the **Growth**
radio is checked, the **Extra Storage** and **Priority Success** cards are
added, and the summary shows **€80**. No dialog opens.

Status: not verified: demo not run. Related browser tests:
`load API: applies the Delivera contract`, `load API: returns the applied result`.

### 2. Starter with Extra Storage: the add-on is removed, with an info diagnostic

Reload, then run:

```js
const result = r.applySelection({
  planId: 'starter',
  addOns: { extraStorage: { selected: true, quantity: 2 } },
});
[result.applied, result.removedAddOnIds, result.resolved.subtotal, result.diagnostics];
```

Expect: `applied` is `true`; `removedAddOnIds` is `['extraStorage']`;
`resolved.subtotal` is `20`; `diagnostics` has one entry with
`code: 'PR_SELECTION_ADDON_REMOVED'`, `severity: 'info'`,
`path: 'selection.addOns.extraStorage'`. The page shows Starter and **€20**,
and **no review dialog** opens.

Status: not verified: demo not run. Related browser tests:
`load API: reports the removed add-on`, `load API: removes add-ons without a dialog`.

### 3. Unknown plan and unknown add-on: warnings, current selection kept

Reload. Pick **Growth** and **Yearly** with the mouse, then run:

```js
const a = r.applySelection({ planId: 'legacy', billingPeriod: 'quarterly' });
[a.selection.planId, a.selection.billingPeriod, a.diagnostics.map((d) => d.code)];
```

Expect: `['growth', 'yearly', ['PR_SELECTION_UNKNOWN_PLAN',
'PR_SELECTION_UNKNOWN_BILLING_PERIOD']]`, both diagnostics with severity
`warning`.

Now an unknown add-on id:

```js
const b = r.applySelection({
  planId: 'growth',
  addOns: {
    ghost: { selected: true, quantity: 1 },
    extraStorage: { selected: true, quantity: 2 },
  },
});
[b.selection.addOns, b.diagnostics.map((d) => [d.code, d.severity, d.path])];
```

Expect: `selection.addOns` is only `{ extraStorage: { selected: true, quantity: 2 } }`
(`ghost` is dropped); one diagnostic
`['PR_SELECTION_UNKNOWN_ADDON', 'warning', 'selection.addOns.ghost']`.
The page's own diagnostics list (`[data-pr-part="diagnostics"]`) gains no
`PR_SELECTION_` item.

Status: not verified: demo not run. Related browser tests:
`load API: falls back to the selection in effect`,
`load API: keeps the diagnostics out of the rendered list`.

### 4. Controlled mode refuses (negative case)

Reload, then run:

```js
r.selection = {
  planId: 'growth',
  billingPeriod: 'monthly',
  variables: { seats: 5, prioritySupport: false, region: 'eu' },
  addOns: { extraStorage: { selected: true, quantity: 1 } },
};
const before = JSON.stringify(r.selection);
const result = r.applySelection({
  planId: 'growth',
  addOns: {
    extraStorage: { selected: true, quantity: 2 },
    prioritySuccess: { selected: true, quantity: 1 },
  },
});
[
  result.applied,
  result.resolved.subtotal,
  result.diagnostics.map((d) => [d.code, d.severity]),
  JSON.stringify(r.selection) === before,
];
```

Expect: `[false, 50, [['PR_SELECTION_CONTROLLED', 'error']], true]`. The page
still shows Growth with one Extra Storage pack (**€50**); nothing was stored.
Back to uncontrolled with `r.selection = undefined`: the page returns to
Starter and **€20**.

Status: not verified: demo not run. Related browser tests:
`load API: refuses in controlled mode`,
`load API: a controlled refusal stores nothing`.

### 5. `resolvedState`, the `pricing-ready` detail and the events

Reload, then register the listeners:

```js
const log = { diagnostic: [], change: [], ready: [] };
r.addEventListener('pricing-diagnostic', (e) => log.diagnostic.push(e.detail));
r.addEventListener('pricing-selection-change', (e) => log.change.push(e.detail));
r.addEventListener('pricing-ready', (e) => log.ready.push(e.detail));
```

a) `resolvedState` read. Run `r.resolvedState` and then apply the Delivera
contract of step 1 and read it again. Expect first
`{ selection: { planId: 'starter', ... }, resolved: { subtotal: 20, ... } }`,
then `selection.planId` `'growth'` and `resolved.subtotal` `80`, equal to the
`selection` and `resolved` that `applySelection` returned. Each read returns
new objects (`r.resolvedState !== r.resolvedState`).

b) `pricing-diagnostic` event. Run `r.applySelection({ planId: 'legacy' })`.
Expect `log.diagnostic.length` is `1` and its `diagnostics` has one
`PR_SELECTION_UNKNOWN_PLAN` warning, equal to the returned `diagnostics`.
Run the step 1 call again: `log.diagnostic.length` stays `1` (no event for an
empty list).

c) No `pricing-selection-change`. After all the calls above,
`log.change.length` is `0`.

d) `pricing-ready` detail. Run `r.reload()` and wait for it to finish. Expect
`log.ready.length` is `1`, and
`log.ready[0].selection.planId` is `'starter'` and
`log.ready[0].resolved.subtotal` is `20`. The reload also restarts from the
default selection: the page returns to Starter and **€20**.

Status: not verified: demo not run. Related browser tests:
`load API: reads the initial state`, `load API: returns detached snapshots`,
`load API: dispatches one pricing-diagnostic event`,
`load API: dispatches no event for an empty list`,
`load API: emits no pricing-selection-change`,
`load API: pricing-ready carries the selection`,
`load API: a reload restarts from the default selection`.

### 6. Automated tests

```sh
pnpm test
pnpm exec playwright test -g 'load API'
```

Expect: `pnpm test` passes all suites, including
`tests/unit/apply-selection.test.ts`, `tests/unit/space-contract.test.ts` and
`tests/unit/custom-elements.test.ts`. The Playwright run (it starts
`pnpm demo` through `playwright.config.ts`) passes every test whose title
contains `load API`. Neither command shows a changed visual snapshot.

Status: not verified: neither command was run by this role (Playwright had
also never run in the lab when this was written; CI is its first run).

## API examples

None over HTTP. The negative case is step 4 (controlled refusal, nothing
stored). Step 3 adds the unknown plan, billing period and add-on cases. The
refusal while the first load is in flight (`PR_SELECTION_NOT_READY`) needs a
second element with a pending `loadPricing` and is covered only by the
Playwright test `load API: refuses while the first load is in flight`.

## Findings

- None. Nothing contradicting the spec was seen, but nothing was executed.
- G13 guide check: the registered check formats this file with prettier; it is
  not a run of the demo. See the final report for its result.
