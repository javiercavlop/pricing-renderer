# Next.js (App Router)

This guide shows how to use `pricing-renderer` in a Next.js App Router application: what runs on
the server, what runs in the browser, and how to load the pricing and the signed-in user's
subscription on the server without leaking either. `examples/next` is a working app that pins Next
16.4.3.

## The client island

The `pricing-renderer/react` entry starts with `'use client'` (`src/react/index.ts:1`). The
renderer is therefore a client island: a Server Component renders a small Client Component, and the
Client Component renders `PricingRenderer`.

What server rendering gives you:

- All entry points are safe to import in an SSR build. Importing `pricing-renderer`,
  `pricing-renderer/react` or `pricing-renderer/space` does not touch the DOM at import time.
- The Client Component can be part of the HTML the server sends, so the page shell and your own
  markup around the island arrive without waiting for JavaScript.

What it does not give you:

- No server-rendered pricing markup. The full pricing content appears after hydration, and deep
  light-DOM SSR is not a v1 contract ([architecture](./architecture.md#ssr-model)). Reserve space
  for the island or show a stable skeleton to avoid layout shift.
- The element does not fetch remote sources on the server. With `src`, the request runs in the
  browser. To keep the fetch on the server, load the pricing there and pass `yaml` or `pricing`
  (next section).

Import the stylesheet in the client module:

```tsx
// app/pricing/pricing-view.tsx
'use client';

import { PricingRenderer } from 'pricing-renderer/react';
import 'pricing-renderer/styles.css';

export function PricingView({ yaml }: { yaml: string }) {
  return <PricingRenderer yaml={yaml} locale="en-US" theme="auto" />;
}
```

## Load the pricing on the server

A Server Component fetches the pricing with the key, which stays on the server, and passes the
result to the client island as a `yaml` string or as a plain `pricing` object:

```tsx
// app/pricing/page.tsx (Server Component)
import 'server-only';
import { PricingView } from './pricing-view';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const res = await fetch(process.env.PRICING_UPSTREAM_URL!, {
    headers: { 'x-api-key': process.env.PRICING_API_KEY! },
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error('Pricing unavailable');

  return <PricingView yaml={await res.text()} />;
}
```

[Private pricings](./private-pricings.md) has the rules for the key, the session check, the
timeout, caching headers and the route-handler alternative. Do not repeat them per page; follow
that guide.

Props that a Server Component passes to a Client Component are serialized into the RSC payload and
into the HTML. Treat everything you pass as public, including to users who are not allowed to buy.
Next.js accepts serializable values: strings, numbers, plain objects, arrays, `Date`, `Map`, `Set`
and Promises. Class instances and functions that are not server functions are not accepted.

For a provider that answers JSON, parse it on the server and pass the object:

```tsx
const pricing: Record<string, unknown> = await res.json();
return <PricingView pricing={pricing} />;
```

`export const dynamic = 'force-dynamic'` is a valid route segment option when Cache Components are
not enabled. Use it for a page that depends on the signed-in user, so no full-route cache stores
one user's page for another.

## Load the signed-in user's subscription

A customer who already has a subscription should see it as the current selection. Read the contract
on the server, map it, and pass only the result to the client.

```tsx
// app/pricing/page.tsx (Server Component)
import 'server-only';
import { contractedVersion, selectionFromContract } from 'pricing-renderer/space';
import { cookies } from 'next/headers';
import { loadContract } from '../../lib/space'; // your server-only code
import { loadPricingYaml } from '../../lib/pricing'; // your server-only code
import { PricingView } from './pricing-view';

export const dynamic = 'force-dynamic';

const SERVICE_KEY = 'acme'; // lowercase, as SPACE stores it

export default async function Page() {
  const jar = await cookies(); // async in Next 15 and 16
  const session = jar.get('session')?.value;
  const contract = session ? await loadContract(session) : undefined;

  const version = contract ? contractedVersion(contract, SERVICE_KEY) : undefined;
  const yaml = await loadPricingYaml(version); // pinned version, see pricing-versions.md

  return (
    <PricingView
      yaml={yaml}
      current={contract ? selectionFromContract(contract, SERVICE_KEY) : undefined}
      contractedVersion={version}
    />
  );
}
```

Pass `selectionFromContract(...)` and `contractedVersion(...)` only. Never pass the contract object
itself: it carries `userInformation` and the subscription history, and everything you pass reaches
the browser. In Next 15 and 16, `cookies()` from `next/headers` is async and must be awaited.

The plan and add-on names in a contract belong to the contracted version. Load the pricing of that
version for a signed-in customer; another version can make `applySelection` return
`PR_SELECTION_UNKNOWN_PLAN`. [Pricing versions](./pricing-versions.md) says which version a page
shows for signed-out and signed-in visitors.

Apply the selection in the client with the `ref` and `onReady` pattern from
[Preload the current subscription](./preload-current-subscription.md), because `applySelection` is
refused while the pricing is loading:

```tsx
// app/pricing/pricing-view.tsx
'use client';

import { useRef } from 'react';
import { PricingRenderer, type PricingRendererElement } from 'pricing-renderer/react';
import type { PricingSelection } from 'pricing-renderer';
import 'pricing-renderer/styles.css';

interface Props {
  yaml: string;
  current?: Partial<PricingSelection>;
  contractedVersion?: string;
}

export function PricingView({ yaml, current }: Props) {
  const ref = useRef<PricingRendererElement>(null);

  return (
    <PricingRenderer
      ref={ref}
      yaml={yaml}
      locale="en-US"
      onReady={() => {
        if (current) ref.current?.applySelection(current);
      }}
    />
  );
}
```

`contractedVersion` is in the props so you can show "Your plan is on version 2026.07" or compare it
with the version loaded. The contract has no billing period, so the mapping does not set one; the
preload guide shows how to keep the period in effect.

## Configure in client code only

`configurePricingRenderer` is module-global (`src/core/config.ts`) and the element reads it when it
is constructed. A server process handles many requests, so a call made per request would leak one
request's settings into the next. Call it only in client code, once, at the top of a `'use client'`
module. `examples/next/app/pricing-client.tsx` does this:

```tsx
'use client';

import { configurePricingRenderer } from 'pricing-renderer';
import { PricingRenderer } from 'pricing-renderer/react';

configurePricingRenderer({
  locale: 'en-US',
  pricingPath: '/pricing',
  selectionEnabled: true,
  ctaEnabled: true,
});
```

For settings that vary by request, tenant or locale, pass props to the instance instead
([configuration](./configuration.md)).

## Keep `request` and `loadPricing` stable

The element reloads the pricing whenever `pricing`, `yaml`, `src`, `request`, `loadPricing` or
`normalizeOptions` change identity. React passes props through to the element, so an object or
function created in the render body is new on every render and reloads the pricing on every render.

Before:

```tsx
'use client';

export function PricingView() {
  return (
    <PricingRenderer
      src="/api/pricing"
      // New object on every render: the pricing reloads each time.
      request={{ credentials: 'same-origin', timeoutMs: 15_000 }}
    />
  );
}
```

After:

```tsx
'use client';

import { useMemo } from 'react';

export function PricingView() {
  const request = useMemo(() => ({ credentials: 'same-origin' as const, timeoutMs: 15_000 }), []);
  return <PricingRenderer src="/api/pricing" request={request} />;
}
```

A constant defined at module level works too. Do the same for `loadPricing` and `normalizeOptions`,
with `useMemo` or `useCallback` and the values they depend on in the dependency list. `loadPricing`
is only used together with `src`. Put no secret in a client `request`; see
[private pricings](./private-pricings.md).

## Planned

These are planned and are not yet available in this version; do not write code against them:

- `createSpherePublicLoader`, a helper in `pricing-renderer/yaml`. It would return `src`,
  `loadPricing` and `fetchYaml`, use https only, and skip the manifest when a `versionId` is pinned.
- An ETag cache hook for the `src` loader, for anonymous requests only.

Until then, use plain `fetch` as in this guide.

## Checklist

- The page is a Server Component; `PricingRenderer` lives in a `'use client'` module that also
  imports `pricing-renderer/styles.css`.
- Keys are read on the server from variables without `NEXT_PUBLIC_`, and the loading module imports
  `server-only`.
- The pricing reaches the client as `yaml` or `pricing`; everything passed is treated as public.
- The page that depends on the user is `force-dynamic` (or otherwise not cached across users).
- `cookies()` is awaited.
- Only `selectionFromContract(...)` and `contractedVersion(...)` cross to the client, never the
  contract.
- The pricing loaded is the contracted version, and the selection is applied from `onReady`.
- `configurePricingRenderer` is called only in client code.
- `request`, `loadPricing` and `normalizeOptions` have a stable identity.

## Related

- [API reference](./api-reference.md) for the props, `request` and `loadPricing`.
- [Private pricings](./private-pricings.md) for keys, routes and caching.
- [Pricing versions](./pricing-versions.md) for which version to load.
- [Preload the current subscription](./preload-current-subscription.md) for `applySelection`.
- [Project and instance configuration](./configuration.md).
- [Architecture](./architecture.md) for the SSR model.
