import { mergeSelection, normalizeAddOnQuantity, reconcileSelection } from './resolve.js';
import type {
  AddOnSelection,
  NormalizedPricing,
  PricingDiagnostic,
  PricingSelection,
} from './types.js';
import { cloneValue } from './utils.js';

export interface ApplySelectionInputResult {
  selection: PricingSelection;
  removedAddOnIds: string[];
  diagnostics: PricingDiagnostic[];
}

// [impl->req~apply-input-result~1] [impl->req~apply-input-no-mutation~1]
export function applySelectionInput(
  pricing: NormalizedPricing,
  current: PricingSelection,
  input: Partial<PricingSelection>,
): ApplySelectionInputResult {
  const copy = cloneValue(input);
  const diagnostics: PricingDiagnostic[] = [];
  const validated: Partial<PricingSelection> = {};

  // [impl->req~apply-input-unknown-plan~1] [impl->req~apply-input-warnings~1]
  if (copy.planId !== undefined) {
    if (pricing.plans.some((plan) => plan.id === copy.planId)) {
      validated.planId = copy.planId;
    } else {
      diagnostics.push({
        code: 'PR_SELECTION_UNKNOWN_PLAN',
        severity: 'warning',
        message: `Unknown plan "${copy.planId}"; the current plan is kept.`,
        path: 'selection.planId',
      });
      if (current.planId !== undefined) validated.planId = current.planId;
    }
  }

  // [impl->req~apply-input-unknown-billing~1] [impl->req~apply-input-warnings~1]
  if (copy.billingPeriod !== undefined) {
    if (pricing.billing.some((period) => period.id === copy.billingPeriod)) {
      validated.billingPeriod = copy.billingPeriod;
    } else {
      diagnostics.push({
        code: 'PR_SELECTION_UNKNOWN_BILLING_PERIOD',
        severity: 'warning',
        message: `Unknown billing period "${copy.billingPeriod}"; the current billing period is kept.`,
        path: 'selection.billingPeriod',
      });
      if (current.billingPeriod !== undefined) validated.billingPeriod = current.billingPeriod;
    }
  }

  if (copy.variables !== undefined) {
    validated.variables = copy.variables;
  }

  // [impl->req~apply-input-unknown-addons~1] [impl->req~apply-input-quantities~1]
  if (copy.addOns !== undefined) {
    const addOns: Record<string, AddOnSelection> = {};
    for (const id of Object.keys(copy.addOns)) {
      const entry = copy.addOns[id];
      if (!pricing.addOns.some((addOn) => addOn.id === id)) {
        diagnostics.push({
          code: 'PR_SELECTION_UNKNOWN_ADDON',
          severity: 'warning',
          message: `Unknown add-on "${id}"; it is ignored.`,
          path: `selection.addOns.${id}`,
        });
        continue;
      }
      if (entry === undefined) continue;
      addOns[id] = entry.selected
        ? { ...entry, quantity: normalizeAddOnQuantity(pricing, id, entry) }
        : entry;
    }
    validated.addOns = addOns;
  }

  // [impl->req~apply-input-merge-defaults~1] [impl->req~apply-input-reconcile~1]
  const { selection, removedAddOnIds } = reconcileSelection(
    pricing,
    mergeSelection(pricing, validated),
  );

  // [impl->req~apply-input-removed-diagnostics~1] [impl->req~apply-input-diagnostic-order~1]
  for (const id of removedAddOnIds) {
    diagnostics.push({
      code: 'PR_SELECTION_ADDON_REMOVED',
      severity: 'info',
      message: `Add-on "${id}" is not available with the selected plan and was removed.`,
      path: `selection.addOns.${id}`,
      details: { addOnId: id },
    });
  }

  return { selection, removedAddOnIds, diagnostics };
}
