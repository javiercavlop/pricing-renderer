'use client';

import { PricingRenderer } from 'pricing-renderer/react';

export function PricingClient({ yaml }: { yaml: string }) {
  return (
    <PricingRenderer
      yaml={yaml}
      locale="en-US"
      theme="auto"
      onAction={(event) => {
        event.preventDefault();
        window.alert(`Host checkout received: ${event.detail.actionId}`);
      }}
    />
  );
}
