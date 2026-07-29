import type {
  NormalizedPricing,
  PricingDiagnostic,
  PricingSelection,
  ResolvedPricing,
  UnknownRecord,
} from '../core/index.js';

export interface PricingReadyDetail {
  pricing: NormalizedPricing;
  diagnostics: PricingDiagnostic[];
}

export interface PricingSelectionChangeDetail {
  selection: PricingSelection;
  resolved: ResolvedPricing;
}

export interface PricingActionDetail {
  actionId: string;
  planId?: string;
  href?: string;
  selection: PricingSelection;
  resolved: ResolvedPricing;
  metadata?: UnknownRecord;
}

export interface PricingDiagnosticDetail {
  diagnostics: PricingDiagnostic[];
}

export type PricingReadyEvent = CustomEvent<PricingReadyDetail>;
export type PricingSelectionChangeEvent = CustomEvent<PricingSelectionChangeDetail>;
export type PricingActionEvent = CustomEvent<PricingActionDetail>;
export type PricingDiagnosticEvent = CustomEvent<PricingDiagnosticDetail>;

export interface PendingAddOnChange {
  addOnId: string;
  select: boolean;
  addIds: string[];
  removeIds: string[];
}
