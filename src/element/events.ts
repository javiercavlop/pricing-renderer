import type {
  NormalizedPricing,
  PendingAddOnChange,
  PricingDiagnostic,
  PricingSelection,
  ResolvedPricing,
  SelectionRelation,
  UnknownRecord,
} from '../core/index.js';

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
  // present only while the current plan is known
  relation?: SelectionRelation;
  source?: 'plan' | 'summary';
}

export interface PricingDiagnosticDetail {
  diagnostics: PricingDiagnostic[];
}

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

// the slots a host can ask the element to render
export type PricingSlotName = 'plan-cta' | 'summary-actions' | 'loading' | 'error';

export interface PricingSlotsChangeDetail {
  nodes: HTMLElement[];
}

export type PricingReadyEvent = CustomEvent<PricingReadyDetail>;
export type PricingSelectionChangeEvent = CustomEvent<PricingSelectionChangeDetail>;
export type PricingActionEvent = CustomEvent<PricingActionDetail>;
export type PricingDiagnosticEvent = CustomEvent<PricingDiagnosticDetail>;
export type PricingSlotsChangeEvent = CustomEvent<PricingSlotsChangeDetail>;

// Typed addEventListener for the five events of <pricing-renderer>.
// Every entry (/define, /element, /react) reaches this module, so the augmentation travels with them.
declare global {
  interface HTMLElementEventMap {
    'pricing-ready': PricingReadyEvent;
    'pricing-selection-change': PricingSelectionChangeEvent;
    'pricing-action': PricingActionEvent;
    'pricing-diagnostic': PricingDiagnosticEvent;
    'pricing-slots-change': PricingSlotsChangeEvent;
  }
}

export type { PendingAddOnChange };
