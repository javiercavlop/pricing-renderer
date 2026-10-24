import type {
  NormalizedBillingPeriod,
  NormalizedPricing,
  PriceBreakdown,
  PriceBreakdownLine,
  PricingSelection,
  ResolvedPrice,
} from './types.js';

interface BreakdownInput {
  pricing: NormalizedPricing;
  selection: PricingSelection;
  reconciled: PricingSelection;
  planPrices: Record<string, ResolvedPrice>;
  addOnPrices: Record<string, ResolvedPrice>;
  billingPeriod: NormalizedBillingPeriod | undefined;
  addOnQuantity: (addOnId: string) => number;
}

// [impl->req~breakdown-priced-line~1] [impl->req~breakdown-label-line~1]
// [impl->req~breakdown-error-line~1] [impl->req~breakdown-json~1]
function createLine(
  kind: PriceBreakdownLine['kind'],
  id: string,
  name: string,
  quantity: number,
  billingMultiplier: number,
  price: ResolvedPrice | undefined,
): PriceBreakdownLine {
  const base = { kind, id, name, quantity, billingMultiplier };
  if (price?.kind === 'amount') {
    return {
      ...base,
      unitAmount: price.baseAmount,
      amount: price.baseAmount * billingMultiplier * quantity,
      requiresQuote: false,
    };
  }
  if (price?.kind === 'label') {
    return { ...base, requiresQuote: true, label: price.label };
  }
  return { ...base, requiresQuote: true };
}

// [impl->req~breakdown-field~1] [impl->req~breakdown-detached~1]
export function buildBreakdown(input: BreakdownInput): PriceBreakdown {
  const { pricing, selection, reconciled, planPrices, addOnPrices, billingPeriod } = input;
  const billingMultiplier = billingPeriod?.multiplier ?? 1;

  // [impl->req~breakdown-plan-line~1] [impl->req~breakdown-no-plan-line~1]
  const plan = pricing.plans.find((candidate) => candidate.id === selection.planId);
  const planLine = plan
    ? createLine('plan', plan.id, plan.name, 1, billingMultiplier, planPrices[plan.id])
    : undefined;

  // [impl->req~breakdown-addon-lines~1] [impl->req~breakdown-addon-order~1]
  // [impl->req~breakdown-addon-quantity~1]
  const addOns = pricing.addOns
    .filter((addOn) => reconciled.addOns[addOn.id]?.selected)
    .map((addOn) =>
      createLine(
        'addOn',
        addOn.id,
        addOn.name,
        input.addOnQuantity(addOn.id),
        billingMultiplier,
        addOnPrices[addOn.id],
      ),
    );

  // [impl->req~breakdown-subtotal-order~1] [impl->req~breakdown-subtotal-equals~1]
  let subtotal = planLine?.amount ?? 0;
  for (const line of addOns) {
    if (line.amount !== undefined) subtotal += line.amount;
  }

  // [impl->req~breakdown-requires-quote~1]
  const knownAddOnIds = new Set(pricing.addOns.map((addOn) => addOn.id));
  const requiresQuote =
    planLine === undefined ||
    planLine.requiresQuote ||
    addOns.some((line) => line.requiresQuote) ||
    Object.entries(reconciled.addOns).some(
      ([id, state]) => state.selected && !knownAddOnIds.has(id),
    );

  return {
    // [impl->req~breakdown-currency~1]
    currency: pricing.metadata.currency,
    // [impl->req~breakdown-billing-period~1] [impl->req~breakdown-unknown-billing-period~1]
    ...(billingPeriod
      ? {
          billingPeriod: {
            id: billingPeriod.id,
            label: billingPeriod.label,
            multiplier: billingPeriod.multiplier,
          },
        }
      : {}),
    ...(planLine ? { plan: planLine } : {}),
    addOns,
    subtotal,
    requiresQuote,
  };
}
