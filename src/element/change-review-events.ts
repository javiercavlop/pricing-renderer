import type { SelectionComparison } from '../core/index.js';

// [impl->req~review-event-types~1]
export interface PricingChangeConfirmDetail {
  comparison: SelectionComparison;
}

export interface PricingChangeBackDetail {
  comparison: SelectionComparison;
}

export type PricingChangeConfirmEvent = CustomEvent<PricingChangeConfirmDetail>;
export type PricingChangeBackEvent = CustomEvent<PricingChangeBackDetail>;
