// Global renderer configuration, applied once when the module is imported (before the first
// render), and the pricing document shared by both pages.
import { configurePricingRenderer } from 'pricing-renderer';
import pricingYaml from '../../../tests/fixtures/acme-pricing.yml?raw';

export const LOCALE = 'en-US';

configurePricingRenderer({
  locale: LOCALE,
  selectionEnabled: true,
  ctaEnabled: true,
  variablesEnabled: true,
});

export const YAML = pricingYaml;
