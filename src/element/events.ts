import type {
  NormalizedPricing,
  PricingDiagnostic,
  PricingSelection,
  ResolvedPricing,
  UnknownRecord,
} from '../core/index.js';

// [impl->req~ready-detail-required-fields~1]
export interface PricingReadyDetail {
  pricing: NormalizedPricing;
  diagnostics: PricingDiagnostic[];
  selection: PricingSelection;
  resolved: ResolvedPricing;
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

// [impl->req~apply-selection-result-type~1]
export type ApplySelectionResult =
  | {
      applied: true;
      selection: PricingSelection;
      resolved: ResolvedPricing;
      removedAddOnIds: string[];
      diagnostics: PricingDiagnostic[];
    }
  | {
      applied: false;
      selection: PricingSelection | undefined;
      resolved: ResolvedPricing | undefined;
      removedAddOnIds: [];
      diagnostics: PricingDiagnostic[];
    };

export type PricingReadyEvent = CustomEvent<PricingReadyDetail>;
export type PricingSelectionChangeEvent = CustomEvent<PricingSelectionChangeDetail>;
export type PricingActionEvent = CustomEvent<PricingActionDetail>;
export type PricingDiagnosticEvent = CustomEvent<PricingDiagnosticDetail>;

export interface PendingAddOnChange {
  addOnId: string;
  select: boolean;
  addIds: string[];
  removeIds: string[];
  planId?: string;
}
