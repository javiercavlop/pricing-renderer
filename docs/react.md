# React

This guide covers the React side of `pricing-renderer`: the full wrapper component, the headless
hooks, the provider that shares settings with both, and the render props that let your React code
fill parts of the renderer. For Next.js specifics (server components, loading on the server) see
the [Next.js guide](./nextjs.md).

## Two entries

- `pricing-renderer/react`: `PricingRenderer`, `PricingChangeReview`, the element classes, the
  render-prop types and everything in the headless entry. It registers the custom elements.
- `pricing-renderer/react/headless`: `PricingRendererProvider`, `usePricingSource`,
  `usePricingSelection`, `usePricingRendererState` and their types. No Lit, no element definition.

Use the full entry when you want the built-in renderer in React. Use the headless entry when you
build your own pricing UI from the core view model: it imports nothing from Lit and defines no
custom element, so it adds neither to your bundle. `pricing-renderer/react` re-exports the whole
headless entry, so a page that already uses the wrapper can import the hooks from the same place.

Both entries start with `'use client'`. Import them from a client module (see
[SSR rules](#ssr-rules)).

## Install and peers

```bash
npm install pricing-renderer react react-dom
```

`react` and `react-dom` are optional peer dependencies of the package, both `^18.2.0 || ^19.0.0`.
A package manager does not enforce optional peers, so install what your entry needs yourself:

- `pricing-renderer/react` needs **both** `react` and `react-dom`. `react-dom` is required because
  the [render props](#render-props) are drawn through `createPortal` from `react-dom`. The import
  of the entry resolves `react-dom` even when you pass no render prop.
- `pricing-renderer/react/headless` imports only `react`. Without `react-dom` the headless hooks
  work; nothing in that entry reads `react-dom`.

Import the stylesheet once when you use the wrapper:

```tsx
import 'pricing-renderer/styles.css';
```

## The wrapper

```tsx
'use client';

import { PricingRenderer } from 'pricing-renderer/react';

export function PricingPage({ yaml }: { yaml: string }) {
  return <PricingRenderer yaml={yaml} locale="en-US" theme="auto" />;
}
```

The wrapper assigns every prop to the element on each render. Which props reload and how inputs are
compared is in the [API reference](./api-reference.md#when-a-property-starts-a-new-load); the
[Next.js guide](./nextjs.md#keep-request-and-loadpricing-stable) shows the stable-identity rules.
A `ref` gives you the `PricingRendererElement` (`applySelection`, `reload`, `resolvedState`).

## `PricingRendererProvider`

The provider shares settings with every wrapper and hook below it, without writing anything global.

```tsx
import { PricingRendererProvider } from 'pricing-renderer/react/headless';

export function Providers({ children, token }: { children: ReactNode; token: string }) {
  return (
    <PricingRendererProvider
      config={{ locale: 'es-ES', variablesEnabled: true }}
      presentation={{ planInheritance: 'auto' }}
      request={{ headers: { Authorization: `Bearer ${token}` }, timeoutMs: 10_000 }}
      requestOrigins={['https://api.example.com']}
    >
      {children}
    </PricingRendererProvider>
  );
}
```

Props: `config` (a partial `PricingRendererConfig`), `messages`, `presentation`, `request`,
`requestOrigins`, `loadPricing` and `children`.

- **Precedence.** An instance prop (or hook option) wins over the nearest provider, which wins over
  the global configuration (`configurePricingRenderer`), which wins over `custom.pricingRenderer`
  in the YAML (presentation only). For `config` the provider supplies `locale`, `pricingPath`,
  `selectionEnabled`, `ctaEnabled`, `variablesEnabled` and `presentation`.
- **Presentation** is merged layer by layer: the provider's `config.presentation`, then its
  `presentation`, then the instance's. See
  [Project and instance configuration](./configuration.md).
- **Messages.** The provider's `messages` are merged under the instance's `messages`; the instance
  wins per key.
- **Nearest provider wins as a whole.** Nested providers do not merge. A host that wants a merge
  builds the props itself.
- **No global write.** The provider never calls `configurePricingRenderer` or
  `registerMessageCatalog`. That makes it the right tool on a server, where a global is shared by
  every request ([Next.js guide](./nextjs.md#configure-in-client-code-only)). Outside a provider
  the wrapper passes only the props you gave it, and the hooks read the global configuration at
  render time.

### `request` and `loadPricing` layers

For a `src` input, `request` and `loadPricing` each come from the instance when it sets them, else
from the provider. An instance `request` replaces the provider `request` as a whole: the provider's
`maxBytes`, `timeoutMs`, `headers` and `credentials` do not apply to that instance. Spread the
provider object yourself if you want both.

Because a provider `request` applies to every `src` in its subtree, its `headers` and
`credentials` are kept only when `src` is an absolute URL whose origin is the page origin or an
origin listed in `requestOrigins`. A relative `src` such as `/api/pricing` counts as a foreign
origin and gets neither (the loader itself also needs an absolute URL for `src`), so resolve it
first, for example with `new URL('/api/pricing', location.origin).href`. On a server there is no
page origin, so only listed origins get them. `maxBytes` and `timeoutMs` are kept for every
origin. An instance `request` is used as given.

Two limits of that rule:

- The check reads the requested URL only. On a cross-origin redirect, fetch drops the
  `Authorization` header (WHATWG Fetch, HTTP-redirect fetch) but keeps other custom headers, and
  cookies follow the `credentials` mode. A listed origin or the page origin must not redirect to
  another origin while the provider sends headers to it.
- A provider `loadPricing`, and a `fetch` inside a provider `request`, run for every `src`. A
  loader or `fetch` wrapper that adds its own credentials must check the URL it receives.

## `usePricingSource`

Resolves a pricing from `pricing`, `yaml` or `src` and returns it normalized.

```tsx
import { usePricingSource } from 'pricing-renderer/react/headless';

const { status, pricing, diagnostics, reload } = usePricingSource({
  src: 'https://api.example.com/pricing.yml',
});
```

Props: `pricing`, `yaml`, `src`, `request`, `loadPricing`, `normalizeOptions`. Result: `status`
(`'loading'`, `'ready'` or `'error'`), `pricing` (a `NormalizedPricing` or `undefined`),
`diagnostics` and `reload()`.

- `pricing` and `yaml` resolve during render. `src` loads in an effect on the client, so on a
  server the status stays `'loading'`; the load is abortable and safe under React StrictMode.
- Inputs compare like the element: `pricing`, `request` and `normalizeOptions` by content;
  `yaml`, `src` and `loadPricing` by identity. A new function each render reloads.
- A result of a superseded input is ignored when it settles.
- A failed load keeps the last successful `pricing` with status `'ready'` (and the new
  `diagnostics`); a load in flight keeps it with `'loading'`. The status is `'error'` only when
  there was never a pricing.
- On the hook path, a `request.maxBytes` that is not a positive finite number, and a
  `request.timeoutMs` that is not a positive finite number up to 2147483647, fall back to their
  defaults (2 MiB, 15 s), so a provider value cannot switch a limit off.
- A `src` taken from user input is fetched as given. The host owns that risk: use an allow-list or
  your own `loadPricing`.

## `usePricingSelection`

Holds a selection for a pricing and derives the view model, so you can render your own UI.

```tsx
const view = usePricingSelection(pricing, { currentSelection, onSelectionChange });

view.selectPlan('growth');
view.toggleAddOn('audit-log', true);
if (view.pending) view.confirm();
```

The result holds `selection`, `viewModel`, `resolved`, `pending` and `current`, the actions below,
and `confirm`, `cancel`, `apply`, `relationOf` and `compareWithCurrent`.

The first argument is a `NormalizedPricing` or `undefined` (for example straight from
`usePricingSource`). While it is `undefined`, every state field is `undefined`, the actions do
nothing and `apply` returns `undefined`.

Options: `selection`, `onSelectionChange`, `defaultSelection`, `currentSelection`, `locale`,
`mode`, `visibility`, `messages`, `presentation`, `expressionOptions`, `variablesEnabled`. Only
`locale`, `variablesEnabled`, `messages` and `presentation` fall back to the provider, then the
global configuration, as above. `mode`, `visibility`, `expressionOptions`, `selection`,
`defaultSelection` and `currentSelection` have no provider or global layer.

- **Uncontrolled** (no `selection` option): the hook holds the selection. It starts from the
  defaults merged with `defaultSelection`, and it restarts when `pricing` is a different object.
- **Controlled** (`selection` given): the hook holds nothing. Actions compute the next selection
  and call `onSelectionChange`; you store it and pass it back.
- `onSelectionChange` receives `{ selection, resolved }`. Every action that produces a next
  selection calls it once, also when the result equals the previous selection. An action that
  becomes `pending` calls nothing until `confirm()`.
- **Actions.** `selectPlan(planId)`, `toggleAddOn(addOnId, selected)`, `setVariable(path, value)`,
  `setAddOnQuantity(addOnId, quantity)`, `setBillingPeriod(id)`, `resetVariables()`. Their
  identities are stable for the life of the hook.
- **`pending`.** Turning an add-on on or off, or picking a plan, can add or remove other add-ons
  through dependencies and exclusions. Then nothing changes yet and `pending` describes the change.
  `confirm()` applies it to the selection held at that moment (a controlled selection the host
  changed meanwhile is the one confirmed); `cancel()` drops it.
- **`apply(input)`** merges a partial selection and returns the `ApplySelectionInputResult`. Unlike
  the element's `applySelection`, it calls `onSelectionChange` and works in controlled mode, where
  your handler decides what to keep.
- **`currentSelection`** is the customer's contract. `current` is then
  `{ planId, addOnIds }` (or `undefined`), `relationOf(planId)` gives `'current'`, `'upgrade'`,
  `'downgrade'` or `'change'`, and `compareWithCurrent()` returns the `SelectionComparison` between
  the current contract and the selection (or `undefined` without a current selection). Pass the
  comparison to `PricingChangeReview` for the review step, as in
  [Change a subscription](./change-subscription-flow.md).
- **View model.** `viewModel` is the core `PricingViewModel` and `resolved` its prices. Each hook
  instance keeps its own price stabilizer; nothing is cached at module level, so concurrent
  server requests never share state.

## `usePricingRendererState(ref)`

Reads the state of a rendered `PricingRenderer` from React.

```tsx
const ref = useRef<PricingRendererElement>(null);
const state = usePricingRendererState(ref);
// <PricingRenderer ref={ref} yaml={yaml} />
// state: { pricing, selection, resolved, applySelection } | undefined
```

The hook listens to `pricing-ready` and `pricing-selection-change` on `ref.current`. It attaches in
a layout effect on the client, which runs before the element's first update can announce
`pricing-ready`, so a hook committed in the same render as the element misses nothing. The ref is
checked on every commit: when it points to another element the listeners move and the state is
`undefined` until that element announces itself. The state is `undefined` on the server and until
the first `pricing-ready`.

`applySelection(input)` on the returned state calls the element's method and refreshes the state;
it returns `undefined` when no element is attached.

Limits:

1. **Direct calls are invisible.** The element's own `applySelection` is silent. A call made on
   the element (`ref.current.applySelection(...)`) does not update the hook's state. Neither does a
   change of a controlled `selection` prop. Call `applySelection` of the returned state instead.
2. **Events from other elements are ignored.** Only events dispatched on the attached element
   count, not those bubbling from a nested renderer.

Late attach: a hook that starts listening after the element has already announced `pricing-ready`
(for example a component that mounts later than the renderer) stays `undefined` until the next
`pricing-ready` or `pricing-selection-change`. The element has no public getter for its normalized
pricing, so the hook cannot seed itself. This is a documented limit. Mount the hook in the same
component or earlier than the element, or use `usePricingSelection` with your own pricing when you
need state at any time.

## Render props

`PricingRenderer` lets React fill four parts of the element: the CTA of each plan card, the
summary actions, the loading state and the error state. Each prop is a function; you give only the
ones you need.

- `renderPlanCta(context: PricingPlanCtaContext)` replaces the CTA of every plan card.
- `renderSummaryActions(context: PricingSummaryActionsContext)` replaces the action in the summary.
- `renderLoading()` replaces the content of the loading state.
- `renderError(context: PricingErrorContext)` replaces the content of the error state.

```tsx
<PricingRenderer
  src="https://api.example.com/pricing.yml"
  renderPlanCta={({ planId, label, href, relation, anyPending, trigger }) => (
    <a
      href={href ?? `/checkout/${encodeURIComponent(planId)}`}
      aria-disabled={anyPending}
      data-relation={relation}
      onClick={(event) => {
        event.preventDefault();
        trigger();
      }}
    >
      {label}
    </a>
  )}
  renderError={({ diagnostics, reload }) => (
    <div role="alert">
      {diagnostics.map((entry) => (
        <p key={`${entry.code}:${entry.path ?? ''}`}>{entry.message}</p>
      ))}
      <button type="button" onClick={() => void reload()}>
        Try again
      </button>
    </div>
  )}
/>
```

Contexts:

- `PricingPlanCtaContext`: `planId`, `planName`, `label` (the label of the built-in CTA), `href`
  (the built-in CTA's link, absent for a button), `relation` (absent without a current plan),
  `selected`, `current`, `pending` (this plan's action is the pending one), `anyPending` (any
  action is pending; disable your CTA on it, as the built-in ones do) and `trigger()`.
  `trigger()` dispatches the same cancelable `pricing-action` as the built-in CTA, so your
  `onAction` handler still runs; it returns `false` when the element ignores it (for example while
  an action is pending).
- `PricingSummaryActionsContext`: `selection`, `resolved`, `relation` (absent without a current
  plan) and `pending` (here: any action is pending).
- `PricingErrorContext`: `diagnostics` (code, severity, message and optional path of the failed
  load) and `reload()`, which loads the source again. The diagnostics are those the element
  reports in the error slot, not collected from `pricing-diagnostic` events.
- `renderLoading` receives no context.

How it works: when at least one render prop is a function, the wrapper sets the element's `slots`
property. The element then renders an empty node (`data-pr-slot="plan-cta"`, `"summary-actions"`,
`"loading"` or `"error"`; plan nodes also carry `data-plan-id`) in place of the default markup, and
the wrapper draws your output into that node with `createPortal`. The context travels on the node's
`data-*` attributes and is rebuilt on every `pricing-slots-change` event, so it follows the
selection, the current plan and pending actions. Your React tree therefore keeps its place in the
component hierarchy (context, state and event handling work as usual), while the DOM sits inside
the element. Without render props the markup is unchanged. A renderer nested inside a slot node is
not served by the outer wrapper.

You can combine render props with [`hideSections`](./api-reference.md#hidesections-slots-and-render-props) (a list of section names
that the element does not render: `hero`, `metadata`, `billing`, `variables`, `plans`,
`comparison`, `addOns`, `summary`) and with the raw `slots` property of the element
(`PricingSlotName`: `plan-cta`, `summary-actions`, `loading`, `error`) in non-React hosts.

### Order: element upgrade, hydration and when render props apply

- `pricing-renderer/react` imports the element definition, so importing the entry registers the
  custom element. The top-level import registers the element, so for client-only renders it is
  defined before the tree commits. The element never renders on the server; the server HTML of the
  wrapper is an empty `<pricing-renderer>` tag. Hydrating the wrapper is clean whether or not the
  element has rendered: see [Hydration of the element](#hydration-of-the-element).
- Render props are client only. The server render and the first client render call no render
  prop and hold no portal. That holds for the portals only: the element's own light DOM is a
  separate matter (see [Hydration of the element](#hydration-of-the-element)).
- After the first client commit, the wrapper reads the slot nodes that already exist. It also
  listens to `pricing-slots-change`, whose listener is set by the same commit, before the wrapper's
  own effect. The slot nodes exist only once the element has rendered, and the wrapper reads
  their data attributes after the element's `pricing-slots-change` event (or the on-attach read).
  So your output appears right after hydration and the element's first render, not during it.
- A render prop added later is picked up when the element reports its slot nodes again. A render
  prop removed later clears its portals. A node the element no longer reports gets no portal.
- The summary context needs the element's state. A summary node gets no output until the element
  has a ready state to read.

<a id="known-limitation-hydration-of-the-element"></a>

### Hydration of the element

The server HTML of the wrapper is an empty `<pricing-renderer>` tag. The element does not render on
the server; it renders its light DOM on the client, in a microtask after it is defined and
connected. The wrapper passes `dangerouslySetInnerHTML: { __html: '' }` (one stable object per
instance) and `suppressHydrationWarning` to the host, so React treats the host's children as opaque
content: it neither hydrates nor deletes what the element renders. The host node is kept.

Hydration is therefore clean in any order of element definition and hydration: the element defined
before or after the server HTML is set, and hydration after the element's first update, in a later
task, or inside `flushSync`. No workaround is needed: import `pricing-renderer/react` at the top of
the module as usual, and no dynamic import or deferred definition is required.

Measured in Chromium and Firefox on React 19 (`tests/browser/react-hydration-order.spec.ts`,
`examples/vanilla/react-slots.html?mode=hydrate-late`): in every order there are 0 recoverable
hydration errors, the host node is kept and the final DOM is complete (3 plans, 3 calls to action
and 1 summary action in the fixture). WebKit runs in CI. Render props still appear after hydration
and the element's first render, as described above.

The browser tests run on React 19. React 18 is supported by the same mechanism, but this repository has no browser measurement for it.

### Render the context as text

The context strings are not under your control. `planName`, `label`, `href`, `relation` and the
diagnostic `message` and `path` come from the pricing document or the host's data through DOM
`data-*` attributes, and a document can come from outside your system.

- Render them as React text (`{label}`). Never put them in `dangerouslySetInnerHTML` or any other
  HTML sink.
- `href` is checked only by the library's `isSafeLink`: it must be an `http:`, `https:` or
  `mailto:` URL, a path starting with a single `/`, a relative `./` or `../` path, or a `#`
  fragment, and `javascript:`, `data:` and similar are refused. That check does not make it a
  same-site link. An absolute `https://` link may point to another host, and the library does not
  compare it with your site. A host that needs same-site links checks `href` itself before using it
  (compare its origin with `location.origin`, or build the link from `planId` and ignore `href`).

## SSR rules

- Import the React entries only from client code. Both start with `'use client'`; in Next.js put
  the wrapper and the hooks in a client component ([Next.js guide](./nextjs.md)).
- Importing either entry on the server is safe: nothing touches the DOM at import time.
- The element is not server-rendered. The wrapper's full content appears after hydration; render
  props appear after that, as described above. Hydrating the wrapper logs no hydration error in
  any order; see [Hydration of the element](#hydration-of-the-element).
- Hooks are server-safe. `usePricingSource` resolves `pricing` and `yaml` during render and never
  loads `src` on the server. `usePricingSelection` is pure and renders the same on the server and
  the client. `usePricingRendererState` returns `undefined` on the server.
- Keep per-request settings out of globals. Use `PricingRendererProvider` instead of
  `configurePricingRenderer` for values that depend on the request.
- The hooks use only APIs common to React 18 and 19.

## Examples

- [`examples/next`](../examples/next): a Next.js App Router app with the provider in
  `app/providers.tsx`, a `next/link` plan CTA and the current plan in `app/pricing-client.tsx`
  (route `/pricing`), and the review flow in `app/change` (route `/change`) against the route
  handler `app/api/subscription`.
- [`examples/react`](../examples/react): only the basic wrapper demo (a Vite app using the React
  entry). It does not show the hooks, the provider or a router link. A React (Vite) example with a
  router link and the review flow is planned as a follow-up.
- [`examples/vanilla/src/react-slots.ts`](../examples/vanilla/src/react-slots.ts): mounts
  `PricingRenderer` with each render prop, the page used by the browser specs.

## Related

- [API reference](./api-reference.md)
- [Project and instance configuration](./configuration.md)
- [Events and diagnostics](./events.md)
- [Next.js guide](./nextjs.md)
- [Change a subscription](./change-subscription-flow.md)
