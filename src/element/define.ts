import { PricingRendererElement } from './pricing-renderer-element.js';

export const PRICING_RENDERER_TAG = 'pricing-renderer';

export function definePricingRenderer(): typeof PricingRendererElement {
  if (typeof globalThis.customElements === 'undefined') {
    return PricingRendererElement;
  }
  const existing = customElements.get(PRICING_RENDERER_TAG);
  if (existing && existing !== PricingRendererElement) {
    throw new Error(
      `The custom element "${PRICING_RENDERER_TAG}" is already registered by another constructor.`,
    );
  }
  if (!existing) {
    customElements.define(PRICING_RENDERER_TAG, PricingRendererElement);
  }
  return PricingRendererElement;
}

if (typeof globalThis.customElements !== 'undefined') {
  definePricingRenderer();
}

export { PricingRendererElement };
export type * from './events.js';
