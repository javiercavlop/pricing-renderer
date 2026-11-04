// Types only: the contexts the render props of PricingRenderer receive. The runtime that builds
// them lives in slots.ts.
import type { PricingDiagnostic, SelectionRelation } from '../core/index.js';
import type { PricingSelectionChangeDetail } from '../element/index.js';

// [impl->req~react-plan-cta-context~2]
export interface PricingPlanCtaContext {
  planId: string;
  /** Plain text that may carry text from the pricing document: render it as text, never as HTML. */
  planName: string;
  /**
   * The label of the built-in CTA. Plain text that may carry text from the pricing document:
   * render it as text, never as HTML.
   */
  label: string;
  /** The safe link of the built-in CTA; absent for a button. */
  href?: string;
  /** Absent without a current plan. */
  relation?: SelectionRelation;
  selected: boolean;
  current: boolean;
  /** This CTA's action is the pending one. */
  pending: boolean;
  /** Any action is pending, whichever it names. */
  anyPending: boolean;
  /** Dispatches the `pricing-action` of the built-in CTA; false when the element ignores it. */
  trigger(): boolean;
}

// [impl->req~react-other-slot-contexts~1]
export interface PricingSummaryActionsContext {
  selection: PricingSelectionChangeDetail['selection'];
  resolved: PricingSelectionChangeDetail['resolved'];
  /** Absent without a current plan. */
  relation?: SelectionRelation;
  /** Any action is pending, whichever it names. */
  pending: boolean;
}

// [impl->req~react-other-slot-contexts~1]
export interface PricingErrorContext {
  /** Messages are plain text that may carry text from the pricing document: render them as text. */
  diagnostics: readonly PricingDiagnostic[];
  reload(): Promise<void>;
}
