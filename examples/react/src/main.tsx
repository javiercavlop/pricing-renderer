import React from 'react';
import { createRoot } from 'react-dom/client';
import { PricingRenderer } from 'pricing-renderer/react';
import 'pricing-renderer/styles.css';
import pricingYaml from '../../../tests/fixtures/acme-pricing.yml?raw';

function Demo() {
  return (
    <PricingRenderer
      yaml={pricingYaml}
      locale="en-US"
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
