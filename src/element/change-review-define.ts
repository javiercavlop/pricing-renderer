import { PricingChangeReviewElement } from './change-review-element.js';

export const PRICING_CHANGE_REVIEW_TAG = 'pricing-change-review';

// [impl->req~review-element-defined~1] [impl->req~review-define-conflict~1]
// No side effect on import: define-change-review.ts calls this where a registry exists.
export function definePricingChangeReview(): typeof PricingChangeReviewElement {
  if (typeof globalThis.customElements === 'undefined') {
    return PricingChangeReviewElement;
  }
  const existing = customElements.get(PRICING_CHANGE_REVIEW_TAG);
  if (existing && existing !== PricingChangeReviewElement) {
    throw new Error(
      `The custom element "${PRICING_CHANGE_REVIEW_TAG}" is already registered by another constructor.`,
    );
  }
  if (!existing) {
    customElements.define(PRICING_CHANGE_REVIEW_TAG, PricingChangeReviewElement);
  }
  return PricingChangeReviewElement;
}
