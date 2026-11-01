import type { PriceBreakdownLine, PriceStabilizer, ResolvedPrice } from './types.js';

// [impl->req~price-stabilizer-last-valid~1] [impl->req~price-stabilizer-records~1]
// [impl->req~price-stabilizer-breakdown-line~1] [impl->req~price-stabilizer-subtotal~1]
// [impl->req~price-stabilizer-reset~1]
// A line whose price is replaced by the last valid price takes that price's own factors, and
// the subtotal is the line amount fold of the stabilized breakdown, so both stay in sync.
export function createPriceStabilizer(): PriceStabilizer {
  let lastValidPlanPrices = new Map<string, ResolvedPrice>();
  let lastValidAddOnPrices = new Map<string, ResolvedPrice>();

  // an id such as "__proto__" must become an own key, never a prototype change
  const setOwn = (target: Record<string, ResolvedPrice>, id: string, price: ResolvedPrice) => {
    Object.defineProperty(target, id, {
      value: price,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  };

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
        const lastValid = lastValidPlanPrices.get(id);
        if (price.kind === 'amount') {
          lastValidPlanPrices.set(id, price);
        } else if (price.kind === 'error' && lastValid) {
          setOwn(resolved.planPrices, id, lastValid);
          keptPlanIds.add(id);
        }
      }
      for (const [id, price] of Object.entries(resolved.addOnPrices)) {
        const lastValid = lastValidAddOnPrices.get(id);
        if (price.kind === 'amount') {
          lastValidAddOnPrices.set(id, price);
        } else if (price.kind === 'error' && lastValid) {
          setOwn(resolved.addOnPrices, id, lastValid);
          keptAddOnIds.add(id);
        }
      }

      const { breakdown } = resolved;
      if (breakdown.plan && keptPlanIds.has(breakdown.plan.id)) {
        breakdown.plan = keptLine(breakdown.plan, lastValidPlanPrices.get(breakdown.plan.id)!);
      }
      breakdown.addOns = breakdown.addOns.map((line) =>
        keptAddOnIds.has(line.id) ? keptLine(line, lastValidAddOnPrices.get(line.id)!) : line,
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
      lastValidPlanPrices = new Map();
      lastValidAddOnPrices = new Map();
    },
  };
}
