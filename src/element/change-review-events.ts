import type { SelectionComparison } from '../core/index.js';

export interface PricingChangeConfirmDetail {
  comparison: SelectionComparison;
}

export interface PricingChangeBackDetail {
  comparison: SelectionComparison;
}

export type PricingChangeConfirmEvent = CustomEvent<PricingChangeConfirmDetail>;
export type PricingChangeBackEvent = CustomEvent<PricingChangeBackDetail>;
