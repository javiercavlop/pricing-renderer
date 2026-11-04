'use client';

import dynamic from 'next/dynamic';

// The wrapper is loaded after hydration (ssr: false), so React creates its host node on the client
// instead of hydrating the empty server tag after the element has rendered. That avoids a
// recoverable hydration error (docs/react.md, "Known limitation: hydration of the element").
// ssr: false is only allowed in a Client Component. The server sends the placeholder, which keeps
// the space of the renderer.
const PricingClient = dynamic(() => import('./pricing-client').then((mod) => mod.PricingClient), {
  ssr: false,
  loading: () => <div aria-busy="true" style={{ minHeight: 640 }} />,
});

export function PricingIsland({ yaml }: { yaml: string }) {
  return <PricingClient yaml={yaml} />;
}
