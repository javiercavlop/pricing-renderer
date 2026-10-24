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

declare global {
  interface HTMLElementTagNameMap {
    'pricing-renderer': import('./pricing-renderer-element.js').PricingRendererElement;
  }
}
