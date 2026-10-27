export { PricingRendererElement } from './pricing-renderer-element.js';
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
  }
}
