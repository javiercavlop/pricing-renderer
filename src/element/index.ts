export { PricingRendererElement } from './pricing-renderer-element.js';
// Exported, not registered: only define-change-review.ts registers the tag on import.
export { PricingChangeReviewElement } from './change-review-element.js';
export { PRICING_CHANGE_REVIEW_TAG, definePricingChangeReview } from './change-review-define.js';
export type {
  PricingChangeBackDetail,
  PricingChangeBackEvent,
  PricingChangeConfirmDetail,
  PricingChangeConfirmEvent,
} from './change-review-events.js';
export type {
  ApplySelectionResult,
  PendingAddOnChange,
  PricingActionDetail,
  PricingActionEvent,
  PricingDiagnosticDetail,
  PricingDiagnosticEvent,
  PricingReadyDetail,
  PricingReadyEvent,
  PricingSelectionChangeDetail,
  PricingSelectionChangeEvent,
  PricingSlotName,
  PricingSlotsChangeDetail,
  PricingSlotsChangeEvent,
} from './events.js';
export type { PricingSectionName } from './renderers.js';
export type { ReviewSectionName } from './change-review-renderers.js';
export type { SelectionRelation } from '../core/index.js';

declare global {
  interface HTMLElementTagNameMap {
    'pricing-renderer': import('./pricing-renderer-element.js').PricingRendererElement;
    'pricing-change-review': import('./change-review-element.js').PricingChangeReviewElement;
  }
}
