import { mergeSelection, normalizeAddOnQuantity, reconcileSelection } from './resolve.js';
import type {
  AddOnSelection,
  NormalizedPricing,
  PricingDiagnostic,
  PricingSelection,
} from './types.js';
import { cloneValue, isRecord } from './utils.js';

export interface ApplySelectionInputResult {
  selection: PricingSelection;
  removedAddOnIds: string[];
  diagnostics: PricingDiagnostic[];
}

export function applySelectionInput(
  pricing: NormalizedPricing,
  current: PricingSelection,
  input: Partial<PricingSelection>,
): ApplySelectionInputResult {
  const copy = cloneValue(input);
  const diagnostics: PricingDiagnostic[] = [];
  const validated: Partial<PricingSelection> = {};

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

  if (isRecord(copy.variables)) {
    validated.variables = copy.variables;
  }

  if (isRecord(copy.addOns)) {
    const inputAddOns: Record<string, unknown> = copy.addOns;
    const addOns: Record<string, AddOnSelection> = {};
    for (const id of Object.keys(inputAddOns)) {
      const entry = inputAddOns[id];
      if (!pricing.addOns.some((addOn) => addOn.id === id)) {
        diagnostics.push({
          code: 'PR_SELECTION_UNKNOWN_ADDON',
          severity: 'warning',
          message: `Unknown add-on "${id}"; it is ignored.`,
          path: `selection.addOns.${id}`,
        });
        continue;
      }
      // a known add-on without a plain-object entry counts as omitted: the default applies
      if (!isRecord(entry)) continue;
      const accepted = entry as unknown as AddOnSelection;
      addOns[id] = entry.selected
        ? { ...accepted, quantity: normalizeAddOnQuantity(pricing, id, accepted) }
        : accepted;
    }
    validated.addOns = addOns;
  }

  const { selection, removedAddOnIds } = reconcileSelection(
    pricing,
    mergeSelection(pricing, validated),
  );

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
