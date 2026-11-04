import type { PricingSourceStatus } from 'pricing-renderer/react';

// A Server Component: it imports only a type from the React entry, which names its exports.
const status: PricingSourceStatus = 'ready';

export function SourceStatus() {
  return <small data-status={status}>Source: inline YAML</small>;
}
