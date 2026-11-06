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

export function buildBreakdown(input: BreakdownInput): PriceBreakdown {
  const { pricing, selection, reconciled, planPrices, addOnPrices, billingPeriod } = input;
  const billingMultiplier = billingPeriod?.multiplier ?? 1;

  const plan = pricing.plans.find((candidate) => candidate.id === selection.planId);
  const planLine = plan
    ? createLine('plan', plan.id, plan.name, 1, billingMultiplier, planPrices[plan.id])
    : undefined;

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

  let subtotal = planLine?.amount ?? 0;
  for (const line of addOns) {
    if (line.amount !== undefined) subtotal += line.amount;
  }

  const knownAddOnIds = new Set(pricing.addOns.map((addOn) => addOn.id));
  const requiresQuote =
    planLine === undefined ||
    planLine.requiresQuote ||
    addOns.some((line) => line.requiresQuote) ||
    Object.entries(reconciled.addOns).some(
      ([id, state]) => state.selected && !knownAddOnIds.has(id),
    );

  return {
    currency: pricing.metadata.currency,
    ...(plan?.unit ? { unit: plan.unit } : {}),
    ...(billingPeriod
      ? {
          billingPeriod: {
            id: billingPeriod.id,
            label: billingPeriod.label,
            multiplier: billingPeriod.multiplier,
            // carried through, so a consumer can tell an invented period from a real choice
            ...(billingPeriod.synthesized ? { synthesized: true as const } : {}),
          },
        }
      : {}),
    ...(planLine ? { plan: planLine } : {}),
    addOns,
    subtotal,
    requiresQuote,
  };
}
