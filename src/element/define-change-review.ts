import { definePricingChangeReview } from './change-review-define.js';

// [impl->req~review-element-defined~1] The side-effect module published as
// pricing-renderer/define-change-review. It is the only module that registers the tag on import.
if (typeof globalThis.customElements !== 'undefined') {
  definePricingChangeReview();
}
