# How to test: price breakdown behind the total (PR #38)

Status of this guide: written from the spec
(`docs/agent-work/delivera-3-price-breakdown/spec.md`), `tests/unit/breakdown.test.ts`
and the `price breakdown:` and `quantity stepper:` tests in
`tests/browser/pricing-renderer.spec.ts`. The author could not start the demo,
so **no step below was run by the author**: every step is `not verified by the
author`. Each step names the Playwright or unit tests that cover it. Those
tests ran in CI on head `b8308f6`, which is green: quality 22/24, audit, and
the browser jobs, including the nine responsive snapshot tests, which pass
unchanged against the committed baselines (no PNG under
`tests/browser/pricing-renderer.spec.ts-snapshots/` changed). No images are
included.

## Setup

```sh
pnpm install --frozen-lockfile
pnpm demo        # builds, then serves the vanilla demo at http://127.0.0.1:4173
```

Open http://127.0.0.1:4173 and scroll to "Configure it like a customer
would". The demo loads the acme fixture (`tests/fixtures/acme-pricing.yml`)
with `variablesEnabled: true` and `locale: 'en-US'`. On load it shows
**Starter** selected and **€20** in the summary.

Open the browser console and define the handle once per page load. Reload the
page between steps so each case starts from Starter and €20.

```js
const r = document.querySelector('pricing-renderer');
```

Selections used below:

```js
const CY = {
  planId: 'growth',
  billingPeriod: 'yearly',
  addOns: {
    extraStorage: { selected: true, quantity: 2 },
    prioritySuccess: { selected: true, quantity: 1 },
  },
};
const E = {
  planId: 'enterprise',
  addOns: {
    extraStorage: { selected: true, quantity: 3 },
    compliance: { selected: true, quantity: 1 },
  },
};
```

## UI steps

### 1. The (i) button next to the total

In the summary, next to the total, there is a small round "i" button. Check:

- Its accessible name is **How is this calculated?** (inspect it in the
  accessibility tree, or hover with a screen reader). It starts with
  `aria-expanded="false"`; the panel it controls is hidden.
- Click it: the panel opens, `aria-expanded` is `true`, and focus stays on the
  button. Click again: the panel closes.
- Tab to the button and press Enter: it opens. Press Space: it closes. Focus
  stays on the button after each key.
- Open it again, press Escape: the panel closes and focus is on the button.
- Open it, focus the "Choose Growth" radio and press Escape: the panel stays
  open.
- Choose **es-ES** in the locale selector: the name becomes **¿Cómo se
  calcula?**.
- The button is also there when selection, CTAs and variables are disabled.

Status: not verified by the author. Covered by (CI green on `b8308f6`):
`price breakdown: toggle starts closed with an English name`,
`price breakdown: toggle has a Spanish name`,
`price breakdown: toggle stays when the flags are off`,
`price breakdown: a click opens and closes the panel`,
`price breakdown: Enter and Space toggle the panel`,
`price breakdown: Escape on the toggle closes the panel`,
`price breakdown: Escape on a plan radio leaves the panel open`,
`price breakdown: Escape cancels the dialog and leaves the panel open`,
`price breakdown: two renderers have distinct panel ids`,
`price breakdown: a pricing without add-ons has one toggle`.

### 2. The panel for the Delivera contract billed yearly

Run:

```js
r.applySelection(CY);
```

After the next frame the summary shows **€64**. Open the panel with the
button. Expect three rows, in this order:

| Row              | Text                  |
| ---------------- | --------------------- |
| Growth           | `€45 × 1 × 0.8 = €36` |
| Extra Storage    | `€5 × 2 × 0.8 = €8`   |
| Priority Success | `€25 × 1 × 0.8 = €20` |

After the rows: **Billing period** `Yearly`, **Currency** `EUR`, and
**Estimated total** `€64`. With the panel open, choose another plan with the
mouse: the panel stays open and shows the new breakdown (for Growth alone,
one row `€45 × 1 × 1 = €45` and total €45). Run `r.reload()`: the panel is
closed again.

Status: not verified by the author. Covered by:
`price breakdown: rows of a contract billed yearly`,
`price breakdown: totals of a contract billed yearly`,
`price breakdown: stays open when the user picks Growth`,
`price breakdown: stays open when the host applies a selection`,
`price breakdown: closes when the pricing reloads`; unit
`describe('breakdown billing period')` and
`describe('breakdown plan line')` in `tests/unit/breakdown.test.ts`.

### 3. Enterprise with Compliance: quote line and known subtotal

Reload, then run `r.applySelection(E)` and open the panel. Expect rows
`Enterprise` `€40 × 1 × 1 = €40`, `Extra Storage` `€5 × 3 × 1 = €15`, and
`Compliance` `Contact sales` (no amount). The panel shows **Known subtotal**
`€55` and **Requires quote**; the summary itself also reads Known subtotal
€55 with the quote note. Opening the panel does not change the text of the
summary's live region.

Status: not verified by the author. Covered by:
`price breakdown: rows of Enterprise with compliance`,
`price breakdown: totals when a quote is required`,
`price breakdown: opening the panel leaves the live text unchanged`,
`price breakdown: toggle and panel are outside live regions`,
`price breakdown: one live region holds label, total and quote note`; unit
`describe('breakdown label line')`.

### 4. The API: `breakdown`

Reload, then run:

```js
const result = r.applySelection(CY);
JSON.stringify(result.resolved.breakdown, null, 2);
r.resolvedState.resolved.breakdown; // same content
```

Expect (`resolved.subtotal` is `64` too):

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

Fields: `currency`, `billingPeriod` (absent when the period is unknown), `plan`
(absent when the plan is unknown), `addOns` (declaration order of the
pricing, not the order of the selection), `subtotal` (equals
`resolved.subtotal`) and `requiresQuote`. A quote line has `requiresQuote:
true` and a `label` (for example `Contact sales`) instead of `unitAmount` and
`amount`. Check `r.applySelection(E).resolved.breakdown`: `subtotal` is `55`,
`requiresQuote` is `true`, and the `compliance` line is
`{ kind: 'addOn', id: 'compliance', name: 'Compliance', quantity: 1, billingMultiplier: 1, requiresQuote: true, label: 'Contact sales' }`.

The same `resolved.breakdown` comes in the detail of the events. Register:

```js
const log = { ready: [], change: [] };
r.addEventListener('pricing-ready', (e) => log.ready.push(e.detail));
r.addEventListener('pricing-selection-change', (e) => log.change.push(e.detail));
```

Run `r.reload()` and wait: `log.ready[0].resolved.breakdown.plan.id` is
`'starter'` and `.subtotal` is `20`. Then check the Growth radio with the
mouse: `log.change[0].resolved.breakdown.plan.id` is `'growth'` and
`.subtotal` is `45`. Clicking "Start free trial" gives a `pricing-action`
detail with the same shape.

Status: not verified by the author. Covered by:
`price breakdown: resolvedState and applySelection carry it`,
`price breakdown: events carry it`,
`price breakdown: keeps the last valid price of a failing expression`; unit
`describe('breakdown field')` (`describes the contract billed yearly`),
`describe('breakdown add-on lines')`, `describe('breakdown label line')`,
JSON-safe and detached cases in `tests/unit/breakdown.test.ts`.

### 5. Dark theme and mobile width

- Run `r.theme = 'dark'`, open the panel: the icon, the rows and the
  separators stay readable (icon contrast at least 3:1 against the surface in
  both themes).
- Resize the window to 375 px wide (or use the device toolbar): the button
  sits in the summary next to the total, the panel spans the summary width
  without horizontal scroll, and the pointer target is at least 44 × 44 px
  (a click up to 21 px to the left or right of the icon still opens it).
- With the panel closed, the summary is exactly as tall as before; the nine
  responsive screenshots are unchanged.

Status: not verified by the author. Covered by:
`price breakdown: no serious violations with the panel open` (axe, light and
dark), `price breakdown: icon contrast is at least 3:1 in the light theme`
and `... in the dark theme`,
`price breakdown: the toggle has a 44 px pointer target at 375 px` (and 1440),
`price breakdown: the closed toggle keeps the layout at 320 px` (and 1440),
`price breakdown: no transitions or animations with reduced motion`, and the
nine `is responsive at ...` tests. CI: they pass against the committed
baselines.

### 6. Audit followups: stepper maximum and billed quantity

a) Maximum on the grid. The grid case (add-on `Seats`, minimum 1, step 5,
maximum 8) is not in the demo; it is built in the test with an inline
pricing. Expect the spinbutton `Quantity for Seats` with `min="1"`,
`step="5"` and `max="6"` (the largest grid value not above 8). In the demo,
select Growth and Extra Storage: the spinbutton `Quantity for Extra Storage`
has `max="10"`.

b) Controlled quantity 25 shown as 10:

```js
r.selection = {
  planId: 'growth',
  billingPeriod: 'monthly',
  variables: { seats: 5, prioritySupport: false, region: 'eu' },
  addOns: { extraStorage: { selected: true, quantity: 25 } },
};
```

Expect the Extra Storage input to show **10**, the card **€50** and the
summary **€95**, while `r.selection.addOns.extraStorage.quantity` stays `25`.
Press the decrease button: the `pricing-selection-change` detail asks for `9`
(not 10), then the increase button asks for `10`.

Status: not verified by the author. Covered by:
`quantity stepper: input max is the largest grid value, not the raw maximum`,
`quantity stepper: the acme storage packs have max 10`,
`quantity stepper: shows the normalized quantity of a controlled selection`,
`quantity stepper: shows the normalized quantity of a default selection`,
`quantity stepper: buttons start from the normalized quantity of a controlled selection`,
`quantity stepper: the decrease button steps down from the normalized quantity of a default selection`;
unit tests in `tests/unit/quantity-grid.test.ts` for the caps
(`req~quantity-grid-max-cap~1`, `req~quantity-normalized-max-cap~1`).

### 7. Automated tests

```sh
pnpm test
pnpm exec playwright test -g 'price breakdown|quantity stepper|is responsive'
```

Expect all suites to pass, including `tests/unit/breakdown.test.ts` and
`tests/unit/custom-elements.test.ts` unchanged, and no changed snapshot.

Status: not verified by the author (not run locally). CI on head `b8308f6`:
green (quality 22/24, audit, browsers with the nine responsive snapshot tests
passing against the committed baselines).

## API examples

None over HTTP. The negative cases are in step 4 (a quote line has `label` and
no amounts) and in the unit tests: unknown billing period (no `billingPeriod`
key, multiplier 1), unknown plan (no `plan` key, subtotal 0, quote required),
and an expression that cannot be resolved (`requiresQuote: true`, no
`unitAmount` or `amount`).

## Findings

- None known. Nothing was executed by the author; the evidence is the CI run
  on `b8308f6`.
- The registered check formats this file with prettier; it is not a run of
  the demo.
