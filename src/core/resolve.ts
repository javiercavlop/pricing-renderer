import { evaluatePriceExpression } from './expression.js';
import type {
  AddOnSelection,
  NormalizedPricing,
  PriceSource,
  PricingDiagnostic,
  PricingSelection,
  ResolvePricingOptions,
  ResolvedPrice,
  ResolvedPricing,
  SubscriptionConstraints,
} from './types.js';
import { cloneValue } from './utils.js';

export function createDefaultSelection(pricing: NormalizedPricing): PricingSelection {
  const preferredBilling =
    pricing.billing.find((period) => period.multiplier === 1)?.id ?? pricing.billing[0]?.id;
  const firstPublicPlan = pricing.plans.find((plan) => !plan.private)?.id ?? pricing.plans[0]?.id;
  return {
    ...(firstPublicPlan ? { planId: firstPublicPlan } : {}),
    ...(preferredBilling ? { billingPeriod: preferredBilling } : {}),
    variables: cloneValue(pricing.variables),
    addOns: {},
  };
}

export function mergeSelection(
  pricing: NormalizedPricing,
  selection?: Partial<PricingSelection>,
): PricingSelection {
  const defaults = createDefaultSelection(pricing);
  return {
    ...defaults,
    ...selection,
    variables: { ...defaults.variables, ...(selection?.variables ?? {}) },
    addOns: { ...defaults.addOns, ...(selection?.addOns ?? {}) },
  };
}

function resolvePriceSource(
  price: PriceSource,
  variables: Record<string, unknown>,
  billingMultiplier: number,
  quantity: number,
  options: ResolvePricingOptions,
): ResolvedPrice {
  if (price.kind === 'label') {
    return { kind: 'label', label: price.text, quantity };
  }
  if (price.kind === 'fixed') {
    return {
      kind: 'amount',
      amount: price.amount * billingMultiplier * quantity,
      baseAmount: price.amount,
      billingMultiplier,
      quantity,
    };
  }
  const result = evaluatePriceExpression(price.source, variables, options.expression);
  if (result.value === undefined) {
    return {
      kind: 'error',
      message: result.error ?? 'Expression could not be resolved.',
      quantity,
    };
  }
  return {
    kind: 'amount',
    amount: result.value * billingMultiplier * quantity,
    baseAmount: result.value,
    billingMultiplier,
    quantity,
  };
}

/** Largest quantity on the min/step grid that does not exceed the maximum. */
export function maxQuantityOnGrid(constraints: SubscriptionConstraints): number | undefined {
  if (constraints.maxQuantity === undefined) return undefined;
  const { minQuantity, quantityStep, maxQuantity } = constraints;
  // the epsilon absorbs floating-point error with decimal steps (0.3 / 0.1 = 2.9999999999999996)
  const steps = Math.floor((maxQuantity - minQuantity) / quantityStep + 1e-9);
  return minQuantity + steps * quantityStep;
}

export function normalizeAddOnQuantity(
  pricing: NormalizedPricing,
  addOnId: string,
  selection?: AddOnSelection,
): number {
  const addOn = pricing.addOns.find((candidate) => candidate.id === addOnId);
  if (!addOn || !selection?.selected) {
    return 0;
  }
  const constraints = addOn.subscriptionConstraints;
  if (!constraints) {
    return 1;
  }
  const minimum = constraints.minQuantity;
  const maximum = maxQuantityOnGrid(constraints) ?? Number.POSITIVE_INFINITY;
  const raw = Number.isFinite(selection.quantity) ? selection.quantity : minimum;
  const stepped =
    minimum + Math.round((raw - minimum) / constraints.quantityStep) * constraints.quantityStep;
  return Math.min(maximum, Math.max(minimum, stepped));
}

// [impl->req~reconcile-selection-result~1]
export function reconcileSelection(
  pricing: NormalizedPricing,
  selection: PricingSelection,
): { selection: PricingSelection; removedAddOnIds: string[] } {
  const removed = new Set<string>();
  // [impl->req~reconcile-unavailable-addons~1]
  for (const addOn of pricing.addOns) {
    if (!selection.addOns[addOn.id]?.selected) continue;
    const available =
      addOn.availableFor.length === 0 ||
      (selection.planId !== undefined && addOn.availableFor.includes(selection.planId));
    if (!available) removed.add(addOn.id);
  }
  // [impl->req~reconcile-dependents~1]
  let changed = true;
  while (changed) {
    changed = false;
    for (const addOn of pricing.addOns) {
      if (!selection.addOns[addOn.id]?.selected || removed.has(addOn.id)) continue;
      if (addOn.dependsOn.some((id) => removed.has(id))) {
        removed.add(addOn.id);
        changed = true;
      }
    }
  }
  // [impl->req~reconcile-unrestricted-addons~1] only the removal set is deselected
  const removedAddOnIds = pricing.addOns.filter((addOn) => removed.has(addOn.id)).map((a) => a.id);
  // [impl->req~reconcile-valid-unchanged~1] [impl->req~reconcile-no-mutation~1]
  // [impl->req~reconcile-preserves-fields~1]
  const addOns = { ...selection.addOns };
  for (const id of removedAddOnIds) {
    addOns[id] = { selected: false, quantity: selection.addOns[id]!.quantity };
  }
  return { selection: { ...selection, addOns }, removedAddOnIds };
}

export function resolvePricing(
  pricing: NormalizedPricing,
  selectionInput?: Partial<PricingSelection>,
  options: ResolvePricingOptions = {},
): ResolvedPricing {
  const selection = mergeSelection(pricing, selectionInput);
  // [impl->req~resolve-totals-exclude-removed~1]
  const reconciled = reconcileSelection(pricing, selection).selection;
  const billingMultiplier =
    pricing.billing.find((period) => period.id === selection.billingPeriod)?.multiplier ?? 1;
  const diagnostics: PricingDiagnostic[] = [];
  const planPrices: Record<string, ResolvedPrice> = {};
  const addOnPrices: Record<string, ResolvedPrice> = {};

  for (const plan of pricing.plans) {
    const resolved = resolvePriceSource(
      plan.price,
      selection.variables,
      billingMultiplier,
      1,
      options,
    );
    planPrices[plan.id] = resolved;
    if (resolved.kind === 'error') {
      diagnostics.push({
        code: 'PR_EXPRESSION_RESOLUTION_FAILED',
        severity: 'error',
        message: resolved.message,
        path: `plans.${plan.id}.price`,
      });
    }
  }

  for (const addOn of pricing.addOns) {
    const constraints = addOn.subscriptionConstraints;
    if (
      constraints?.maxQuantity !== undefined &&
      Math.abs(maxQuantityOnGrid(constraints)! - constraints.maxQuantity) > 1e-9
    ) {
      diagnostics.push({
        code: 'PR_ADDON_CONSTRAINTS_INVALID',
        severity: 'warning',
        message: `Maximum quantity ${constraints.maxQuantity} is not reachable from minimum ${constraints.minQuantity} in steps of ${constraints.quantityStep}; quantities are capped at ${maxQuantityOnGrid(constraints)}.`,
        path: `addOns.${addOn.id}.subscriptionConstraints`,
      });
    }
    const quantity = normalizeAddOnQuantity(pricing, addOn.id, selection.addOns[addOn.id]);
    const resolved = resolvePriceSource(
      addOn.price,
      selection.variables,
      billingMultiplier,
      quantity || 1,
      options,
    );
    addOnPrices[addOn.id] = resolved;
    if (resolved.kind === 'error') {
      diagnostics.push({
        code: 'PR_EXPRESSION_RESOLUTION_FAILED',
        severity: 'error',
        message: resolved.message,
        path: `addOns.${addOn.id}.price`,
      });
    }
  }

  const selectedPlanPrice = selection.planId ? planPrices[selection.planId] : undefined;
  let subtotal = selectedPlanPrice?.kind === 'amount' ? selectedPlanPrice.amount : 0;
  let requiresQuote =
    selectedPlanPrice === undefined ||
    selectedPlanPrice.kind === 'label' ||
    selectedPlanPrice.kind === 'error';

  for (const [addOnId, state] of Object.entries(reconciled.addOns)) {
    if (!state.selected) continue;
    const resolved = addOnPrices[addOnId];
    if (resolved?.kind === 'amount') {
      const quantity = normalizeAddOnQuantity(pricing, addOnId, state);
      subtotal += resolved.baseAmount * resolved.billingMultiplier * quantity;
    } else {
      requiresQuote = true;
    }
  }

  // [impl->req~resolve-selection-unreconciled~1]
  return {
    selection,
    planPrices,
    addOnPrices,
    subtotal,
    requiresQuote,
    diagnostics,
  };
}
