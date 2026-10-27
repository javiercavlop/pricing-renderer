import {
  isRecord,
  mergeSelection,
  reconcileSelection,
  type AddOnSelection,
  type NormalizedPricing,
  type PricingDiagnostic,
  type PricingSelection,
} from '../core/index.js';

/** What the element marks as current, derived from the loaded pricing. */
export interface CurrentContext {
  /** The current plan id; always a plan id of the pricing. */
  planId: string;
  /** The add-ons still selected after reconciliation on the current plan. */
  addOnIds: ReadonlySet<string>;
}

const hasId = (items: readonly { id: string }[], id: string): boolean =>
  items.some((item) => item.id === id);

/** The current side of Decision 2 (steps 1 to 4), or `undefined` without a known current plan. */
// [impl->req~current-selection-plan-mark~1] [impl->req~current-selection-addons~1]
// [impl->req~current-selection-unknown-plan~1] [impl->req~current-selection-unset~1]
// Without a known plan, reconciling would use the default plan, which is not the customer's, so no
// add-on is marked either. Unknown add-on ids are ignored.
export function deriveCurrentContext(
  pricing: NormalizedPricing,
  current: Partial<PricingSelection> | undefined,
): CurrentContext | undefined {
  if (!isRecord(current)) return undefined;
  const planId = typeof current.planId === 'string' ? current.planId : undefined;
  if (planId === undefined || !hasId(pricing.plans, planId)) return undefined;
  const addOns: Record<string, AddOnSelection> = {};
  if (isRecord(current.addOns)) {
    for (const [id, entry] of Object.entries(current.addOns)) {
      if (!hasId(pricing.addOns, id) || !isRecord(entry) || typeof entry.selected !== 'boolean') {
        continue;
      }
      const quantity = typeof entry.quantity === 'number' ? entry.quantity : 0;
      addOns[id] = { selected: entry.selected, quantity };
    }
  }
  const { selection } = reconcileSelection(pricing, mergeSelection(pricing, { planId, addOns }));
  const addOnIds = new Set<string>();
  for (const [id, entry] of Object.entries(selection.addOns)) {
    if (entry.selected) addOnIds.add(id);
  }
  return { planId, addOnIds };
}

/** One warning per plan id or add-on id of the current selection that the pricing does not define. */
// [impl->req~current-selection-diagnostics~1]
export function currentSelectionDiagnostics(
  pricing: NormalizedPricing,
  current: Partial<PricingSelection> | undefined,
): PricingDiagnostic[] {
  if (!isRecord(current)) return [];
  const diagnostics: PricingDiagnostic[] = [];
  if (typeof current.planId === 'string' && !hasId(pricing.plans, current.planId)) {
    diagnostics.push({
      code: 'PR_CURRENT_SELECTION_UNKNOWN_PLAN',
      severity: 'warning',
      message: `Unknown plan "${current.planId}" in currentSelection; no plan is marked as current.`,
      path: 'currentSelection.planId',
    });
  }
  if (isRecord(current.addOns)) {
    for (const id of Object.keys(current.addOns)) {
      if (hasId(pricing.addOns, id)) continue;
      diagnostics.push({
        code: 'PR_CURRENT_SELECTION_UNKNOWN_ADDON',
        severity: 'warning',
        message: `Unknown add-on "${id}" in currentSelection; it is ignored.`,
        path: `currentSelection.addOns.${id}`,
      });
    }
  }
  return diagnostics;
}
