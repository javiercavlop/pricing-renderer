import type { NormalizedPricing, PricingDiagnostic, PricingSelection } from './types.js';

export interface ApplySelectionInputResult {
  selection: PricingSelection;
  removedAddOnIds: string[];
  diagnostics: PricingDiagnostic[];
}

export function applySelectionInput(
  _pricing: NormalizedPricing,
  _current: PricingSelection,
  _input: Partial<PricingSelection>,
): ApplySelectionInputResult {
  throw new Error('not implemented');
}
