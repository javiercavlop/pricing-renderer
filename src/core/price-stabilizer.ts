import type { PriceBreakdownLine, PriceStabilizer, ResolvedPrice } from './types.js';

// [impl->req~price-stabilizer-last-valid~1] [impl->req~price-stabilizer-records~1]
// [impl->req~price-stabilizer-breakdown-line~1] [impl->req~price-stabilizer-subtotal~1]
// [impl->req~price-stabilizer-reset~1]
// A line whose price is replaced by the last valid price takes that price's own factors, and
// the subtotal is the line amount fold of the stabilized breakdown, so both stay in sync.
export function createPriceStabilizer(): PriceStabilizer {
  let lastValidPlanPrices: Record<string, ResolvedPrice> = {};
  let lastValidAddOnPrices: Record<string, ResolvedPrice> = {};

  const keptLine = (line: PriceBreakdownLine, kept: ResolvedPrice): PriceBreakdownLine => {
    if (kept.kind !== 'amount') return line;
    // a line of a failed expression has no label, so none is carried over
    return {
      ...line,
      quantity: kept.quantity,
      unitAmount: kept.baseAmount,
      billingMultiplier: kept.billingMultiplier,
      amount: kept.amount,
      requiresQuote: false,
    };
  };

  return {
    stabilize(viewModel) {
      const { resolved } = viewModel;
      const keptPlanIds = new Set<string>();
      const keptAddOnIds = new Set<string>();
      for (const [id, price] of Object.entries(resolved.planPrices)) {
        if (price.kind === 'amount') {
          lastValidPlanPrices[id] = price;
        } else if (price.kind === 'error' && lastValidPlanPrices[id]) {
          resolved.planPrices[id] = lastValidPlanPrices[id]!;
          keptPlanIds.add(id);
        }
      }
      for (const [id, price] of Object.entries(resolved.addOnPrices)) {
        if (price.kind === 'amount') {
          lastValidAddOnPrices[id] = price;
        } else if (price.kind === 'error' && lastValidAddOnPrices[id]) {
          resolved.addOnPrices[id] = lastValidAddOnPrices[id]!;
          keptAddOnIds.add(id);
        }
      }

      const { breakdown } = resolved;
      if (breakdown.plan && keptPlanIds.has(breakdown.plan.id)) {
        breakdown.plan = keptLine(breakdown.plan, resolved.planPrices[breakdown.plan.id]!);
      }
      breakdown.addOns = breakdown.addOns.map((line) =>
        keptAddOnIds.has(line.id) ? keptLine(line, resolved.addOnPrices[line.id]!) : line,
      );
      let subtotal = breakdown.plan?.amount ?? 0;
      for (const line of breakdown.addOns) {
        if (line.amount !== undefined) subtotal += line.amount;
      }
      breakdown.subtotal = subtotal;
      resolved.subtotal = subtotal;
      return viewModel;
    },
    reset() {
      lastValidPlanPrices = {};
      lastValidAddOnPrices = {};
    },
  };
}
