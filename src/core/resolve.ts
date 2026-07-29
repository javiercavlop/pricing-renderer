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
  const maximum = constraints.maxQuantity ?? Number.POSITIVE_INFINITY;
  const raw = Number.isFinite(selection.quantity) ? selection.quantity : minimum;
  const stepped =
    minimum + Math.round((raw - minimum) / constraints.quantityStep) * constraints.quantityStep;
  return Math.min(maximum, Math.max(minimum, stepped));
}

export function resolvePricing(
  pricing: NormalizedPricing,
  selectionInput?: Partial<PricingSelection>,
  options: ResolvePricingOptions = {},
): ResolvedPricing {
  const selection = mergeSelection(pricing, selectionInput);
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

  for (const [addOnId, state] of Object.entries(selection.addOns)) {
    if (!state.selected) continue;
    const resolved = addOnPrices[addOnId];
    if (resolved?.kind === 'amount') {
      const quantity = normalizeAddOnQuantity(pricing, addOnId, state);
      subtotal += resolved.baseAmount * resolved.billingMultiplier * quantity;
    } else {
      requiresQuote = true;
    }
  }

  return {
    selection,
    planPrices,
    addOnPrices,
    subtotal,
    requiresQuote,
    diagnostics,
  };
}
