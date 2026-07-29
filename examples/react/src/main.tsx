import React from 'react';
import { createRoot } from 'react-dom/client';
import { configurePricingRenderer } from 'pricing-renderer';
import { PricingRenderer } from 'pricing-renderer/react';
import 'pricing-renderer/styles.css';
import pricingYaml from '../../../tests/fixtures/acme-pricing.yml?raw';

configurePricingRenderer({
  locale: 'en-US',
  pricingPath: '/pricing',
  selectionEnabled: true,
  ctaEnabled: true,
  variablesEnabled: true,
});

function Demo() {
  return (
    <PricingRenderer
      yaml={pricingYaml}
      theme="light"
      onAction={(event) => {
        event.preventDefault();
        console.info('Pricing action', event.detail);
      }}
    />
  );
}

createRoot(document.querySelector('#root')!).render(
  <React.StrictMode>
    <Demo />
  </React.StrictMode>,
);
