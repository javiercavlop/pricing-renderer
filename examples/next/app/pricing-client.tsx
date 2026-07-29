'use client';

import { configurePricingRenderer } from 'pricing-renderer';
import { PricingRenderer } from 'pricing-renderer/react';

configurePricingRenderer({
  locale: 'en-US',
  pricingPath: '/pricing',
  selectionEnabled: true,
  ctaEnabled: true,
  variablesEnabled: true,
});

export function PricingClient({ yaml }: { yaml: string }) {
  return (
    <PricingRenderer
      yaml={yaml}
      theme="auto"
      onAction={(event) => {
        event.preventDefault();
        window.alert(`Host checkout received: ${event.detail.actionId}`);
      }}
    />
  );
}
