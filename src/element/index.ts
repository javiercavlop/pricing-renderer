export { PricingRendererElement } from './pricing-renderer-element.js';
// [impl->req~review-element-defined~1] [impl->req~review-define-separate~1]
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
} from './events.js';
// [impl->req~cta-event-types~1]
export type { SelectionRelation } from '../core/index.js';

declare global {
  interface HTMLElementTagNameMap {
    'pricing-renderer': import('./pricing-renderer-element.js').PricingRendererElement;
    'pricing-change-review': import('./change-review-element.js').PricingChangeReviewElement;
  }
}
