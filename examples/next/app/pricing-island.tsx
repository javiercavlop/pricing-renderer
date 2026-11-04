'use client';

import { PricingClient } from './pricing-client';

// The server HTML of the wrapper is an empty <pricing-renderer> tag and React treats the host as
// opaque, so hydration is clean whether the element has rendered or not (docs/react.md,
// "Hydration of the element"). No dynamic import or ssr: false is needed.
export function PricingIsland({ yaml }: { yaml: string }) {
  return <PricingClient yaml={yaml} />;
}
