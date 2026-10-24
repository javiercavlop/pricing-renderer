# How to test: reconcile add-on selection on plan change (PR #34)

Status of this guide: written from the specs, the source and the existing
Playwright tests. The role that wrote it had no way to start the demo, run
`pnpm test` or capture screenshots (no shell tool and no registered check), so
**no step below was executed**. Every step is marked `not verified`, with the
nearest existing evidence named. No visual regression snapshot under
`tests/browser` was added or updated.

## Setup

```sh
pnpm install --frozen-lockfile
pnpm demo        # builds, then serves the vanilla demo at http://127.0.0.1:4173
```

Open http://127.0.0.1:4173. Use the billing period the page starts with
(monthly).

## UI steps

### 1. Growth + Extra Storage shows €50

1. Choose the **Growth** plan (radio "Choose Growth").
2. On the **Extra Storage** card tick the checkbox.

Expect: the summary shows **€50**; no dialog.

Capture (planned): `01-growth-extra-storage-desktop.png`, `-mobile.png`.
Status: not verified: demo not run. Same flow is asserted by the browser test
helper `selectGrowthWithExtraStorage` (`tests/browser/pricing-renderer.spec.ts`).

### 2. Starter opens the review dialog; Cancel changes nothing

1. From step 1, choose **Starter**.
2. Read the dialog **Review configuration changes**.
3. Click **Cancel**.

Expect: the dialog lists `extraStorage` ("Will remove: extraStorage"). After
Cancel the dialog closes, **Growth** is still checked, Extra Storage is still
added, the summary still shows €50.

Capture (planned): `02-starter-review-dialog-desktop.png`, `-mobile.png`.
Status: not verified: demo not run. Related browser test: `plan-change-cancel`.

### 3. Starter again and Apply

1. Choose **Starter** again; in the dialog click **Apply changes**.

Expect: dialog closes; **Starter** is checked; Extra Storage is not added; the
summary shows **€20**.

Capture (planned): `03-starter-applied-desktop.png`.
Status: not verified: demo not run. Related browser test: `plan-change-apply`.

### 4. Dependent add-on is listed too

1. Reload the page. Choose **Growth**, then tick **Priority Success**. The
   dependency dialog offers Extra Storage; click **Apply changes**. Both
   add-ons are now added.
2. Choose **Starter**.

Expect: the dialog lists `extraStorage` and `prioritySuccess`
("Will remove: extraStorage, prioritySuccess").

Capture (planned): `04-dependents-listed-desktop.png`.
Status: not verified: demo not run. Related browser test:
`plan-change-confirmation`.

### 5. The event fires once on Apply and not on Cancel

Reload, then in the browser console run:

```js
document.querySelector('pricing-renderer').addEventListener('pricing-selection-change', e => console.log(e.detail))
```

1. Choose Growth (one log line, expected), tick Extra Storage (one line).
2. Choose Starter, click **Cancel**: expect **no new log line**.
3. Choose Starter, click **Apply changes**: expect **exactly one new log
   line** whose `selection.planId` is `starter`,
   `selection.addOns.extraStorage.selected` is `false` and `resolved.subtotal`
   is `20`.

Status: not verified: demo not run. Related browser tests: `plan-change-apply`
(one event) and `plan-change-cancel` (no event).

### 6. Unit level

```sh
pnpm test
```

Expect: all suites pass, including `tests/unit/reconcile.test.ts`. To run only
that file: `pnpm exec vitest run tests/unit/reconcile.test.ts`.

Import example from the package root:

```ts
import { reconcileSelection } from 'pricing-renderer';

const { selection: next, removedAddOnIds } = reconcileSelection(pricing, {
  ...selection,
  planId: 'starter',
});
// removedAddOnIds: ['extraStorage', 'prioritySuccess'] when both were selected
```

Expect: `next` has the removed add-ons as `{ selected: false, quantity }`;
`planId`, `billingPeriod`, `variables` and unknown add-on ids are preserved.
See `docs/api-reference.md`.

Status: not verified: `pnpm test` not run by this role; the import example is
copied from `docs/api-reference.md` and the root export exists
(`src/core/index.ts` exports `reconcileSelection`).

## API examples

None over HTTP. Negative case: step 2 / step 5 Cancel (no change, no event).

## Findings

- None. Nothing contradicting the spec was seen, but nothing was executed.
- G13 guide check: no registered check available to this role (index list
  empty), so it was **not run**.
