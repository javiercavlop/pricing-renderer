# React example

A client-side React 19 app (Vite, no server rendering) that uses `pricing-renderer/react` with
`react-router` in library mode (`BrowserRouter`, `Routes`, `Link`).

## Routes

- `/`: the pricing page. `PricingRenderer` marks the current plan, and `renderPlanCta` renders a
  router `Link` to `/change?plan=<id>` as the CTA of every other plan.
- `/change`: the review page. The `plan` query parameter picks the plan, `usePricingSelection`
  compares it with the current subscription and `PricingChangeReview` asks for confirmation.
  Confirming saves the change (simulated, 600 ms), shows a notice and returns to `/`.
- Any other path shows a short not-found message.

The current subscription lives in memory (`src/subscription.tsx`), so a reload starts again from the
Starter plan. There is no backend, no `fetch` and no storage.

## Run

From the repository root:

```sh
pnpm build
pnpm demo:react
```

The first command builds the package that the example imports. The app listens on
`http://127.0.0.1:4174`.
