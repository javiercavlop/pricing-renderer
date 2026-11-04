// Constants shared by the provider and the components. Module-level, so the objects keep one
// identity across renders and requests; nothing here depends on a request or on the browser.
import type { MessageCatalog, PricingPresentation, PricingRendererConfig } from 'pricing-renderer';

export const LOCALE = 'en-US';

export const rendererConfig: Partial<PricingRendererConfig> = {
  locale: LOCALE,
  pricingPath: '/pricing',
  selectionEnabled: true,
  ctaEnabled: true,
  variablesEnabled: true,
};

// A layer above `custom.pricingRenderer` of the YAML and below the props of an instance.
export const rendererPresentation: PricingPresentation = {
  billingLabels: { monthly: 'Monthly', yearly: 'Yearly (save 20%)' },
};

export const rendererMessages: MessageCatalog = {
  'pricing.billing': 'Billing',
};
