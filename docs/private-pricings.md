# Private pricings

A private pricing sits behind a credential. This guide shows where that credential may live and how
to serve the pricing to the renderer without exposing it.

## Rules

1. **Never put a SPHERE or SPACE key in browser code.** Anything shipped to the browser is readable
   by every visitor. That includes bundled constants, `request.headers`, `loadPricing` closures and
   every Next.js variable whose name starts with `NEXT_PUBLIC_`: Next.js inlines those into the
   client bundle at build time, and only those. Keep a key in a variable without that prefix and
   read it on the server.
2. **Use `request.headers` only for short-lived tokens of the signed-in user**, such as an access
   token that expires in minutes and is scoped to that user. It is never the place for a long-lived
   key, an organization key or a service credential.
3. **Never put a token in `src`.** The `src` property is reflected into the `src` attribute, so a
   token in the URL appears in the DOM, in logs and in history. Secrets travel in `request`, which
   is property-only and never reflected.
4. **Keep secrets out of errors and logs.** A failed load shows its message on screen and dispatches
   it in the `pricing-diagnostic` event. A custom `loadPricing` must not put a header, a key or a
   signed URL into the errors it throws.
5. **A SPACE-managed service is always read through SPACE**, never from a copy of its YAML kept
   elsewhere.

## The safe default: a same-origin server route

Run a route on your own server that holds the key, calls the pricing provider, and returns the
pricing. The browser only calls your route:

```text
browser  --(session cookie)-->  your server route  --(key)-->  SPHERE or SPACE
```

The renderer then needs no secret:

```ts
renderer.src = '/api/pricing';
renderer.request = {
  credentials: 'same-origin', // the default is 'omit'; this sends your session cookie
  timeoutMs: 15_000,
};
```

`credentials: 'same-origin'` sends cookies to your own origin only. Do not use `'include'` for this
setup: it also sends cookies to other origins, which a same-origin route does not need.

The route decides who may read the pricing. Check the session there, before it spends the key.

### What the credential looks like

The SPHERE documentation describes two ways to authenticate: a user bearer token sent as
`Authorization: Bearer <token>`, and an API key sent in an `x-api-key` header. API keys are created
in the SPHERE interface, are tied to an organization and a scope, and the secret is shown once. The
documentation does not describe a key format and does not say that a key is required for private
pricings. Check the current SPHERE and SPACE documentation for the credential your account needs
and how a private pricing is addressed; the recipes below call a placeholder URL and header.

- SPHERE: <https://sphere-docs.vercel.app/docs/2.0.1/api/sphere/sphere-api>

### Format of the response

A route that serves YAML answers with a YAML body. SPACE returns JSON, not YAML. Either serve the
JSON body as it is, or read it on the server and hand the object to the renderer through the
`pricing` property. The renderer does not take the JSON on trust: check what it makes of it with
the diagnostics that `normalizePricing` returns before relying on it.

## Next.js Route Handler

`app/api/pricing/route.ts`. The `server-only` import makes the build fail if a Client Component
ever imports this module.

```ts
import 'server-only';

const UPSTREAM = process.env.PRICING_UPSTREAM_URL!; // no NEXT_PUBLIC_ prefix
const KEY = process.env.PRICING_API_KEY!;

export async function GET(request: Request): Promise<Response> {
  // Check the user's session here and answer 401 or 403 when it fails.

  const upstream = await fetch(UPSTREAM, {
    headers: {
      'x-api-key': KEY, // header name: see the provider documentation
      ...(request.headers.get('if-none-match')
        ? { 'if-none-match': request.headers.get('if-none-match')! }
        : {}),
    },
    cache: 'no-store',
  });

  if (upstream.status === 304) {
    return new Response(null, { status: 304 });
  }
  if (!upstream.ok) {
    // Do not forward the upstream body or headers: they may name the key or the account.
    return new Response('Pricing unavailable', { status: 502 });
  }

  const headers = new Headers({
    'content-type': 'application/yaml; charset=utf-8',
    'cache-control': 'private, no-cache',
  });
  const etag = upstream.headers.get('etag');
  if (etag) headers.set('etag', etag);

  return new Response(await upstream.text(), { headers });
}
```

`cache-control: private, no-cache` lets the browser keep a copy and forces it to revalidate with
`If-None-Match`, while shared caches (a CDN, a proxy) do not store it.

## Next.js Server Component

A Server Component can fetch the pricing during rendering and pass it to a client island. The key
never leaves the server and the page needs no `/api` call.

```tsx
// app/pricing/page.tsx (Server Component)
import 'server-only';
import { PricingView } from './pricing-view';

export default async function Page() {
  const res = await fetch(process.env.PRICING_UPSTREAM_URL!, {
    headers: { 'x-api-key': process.env.PRICING_API_KEY! },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Pricing unavailable'); // no upstream detail in the message

  return <PricingView yaml={await res.text()} />;
}
```

```tsx
// app/pricing/pricing-view.tsx
'use client';

import { PricingRenderer } from 'pricing-renderer/react';
import 'pricing-renderer/styles.css';

export function PricingView({ yaml }: { yaml: string }) {
  return <PricingRenderer yaml={yaml} locale="en-US" />;
}
```

Props passed from a Server Component to a Client Component are serialized into the page, so pass
the pricing only, never the key or a header. Authorize the request before rendering a private
pricing, and do not let a full-route cache store a page that is specific to one user.

## Express

```ts
import express from 'express';

const app = express();

app.get('/api/pricing', async (req, res) => {
  if (!req.session?.user) {
    res.status(401).end();
    return;
  }

  const headers: Record<string, string> = { 'x-api-key': process.env.PRICING_API_KEY! };
  const inm = req.get('if-none-match');
  if (inm) headers['if-none-match'] = inm;

  const upstream = await fetch(process.env.PRICING_UPSTREAM_URL!, { headers });

  if (upstream.status === 304) {
    res.status(304).end();
    return;
  }
  if (!upstream.ok) {
    res.status(502).type('text/plain').send('Pricing unavailable');
    return;
  }

  res.set('Cache-Control', 'private, no-cache');
  const etag = upstream.headers.get('etag');
  if (etag) res.set('ETag', etag);
  res.type('application/yaml').send(await upstream.text());
});
```

`req.session` stands for whatever session or authentication middleware your application uses. Node
18 and later provide a global `fetch`.

## Pin a version in production

A pricing that changes underneath a running page changes the prices your customers see and the
subscriptions they compare. In production:

- Address a fixed `versionId` of the pricing in the upstream URL, not "latest". Take the
  parameter name and where it goes from the provider documentation.
- Move to a new version by changing the pinned id in your configuration, after you have checked
  the new pricing in a preview.
- Keep "latest" for previews and staging.

## Revalidate with ETag

A pinned version does not change, so its response is cheap to revalidate:

1. The route forwards the upstream `ETag` to the browser.
2. The browser sends it back as `If-None-Match` on the next load.
3. The route forwards `If-None-Match` upstream and answers `304 Not Modified` with no body when the
   upstream does.

The built-in loader uses the browser `fetch`, so the browser handles the conditional request and
the cache itself; the renderer needs no code for it. Rely on `private, no-cache` as in the recipes,
and do not use `public` or a long `max-age` on a response that depends on the signed-in user: a
shared cache would hand one user's pricing to another.

## Checklist

- No SPHERE or SPACE key in any browser file, `NEXT_PUBLIC_*` variable, `request.headers`, `src` or
  `loadPricing` closure.
- A same-origin route (or a Server Component) holds the key and checks the session.
- `credentials: 'same-origin'` for the route, not `'include'`.
- The route returns a generic error and does not forward upstream bodies or headers.
- The production URL pins a `versionId`; responses carry `ETag` and `private, no-cache`.
- The key lives in a server-only environment variable and is rotated if it was ever exposed.

## Related

- [API reference](./api-reference.md) for `request`, `loadPricing` and the error state.
- [Events and diagnostics](./events.md) for the `pricing-diagnostic` event.
- [Project and instance configuration](./configuration.md).
