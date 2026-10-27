import type { NormalizedPricing, SelectionRelation } from './types.js';

/**
 * How moving from one plan to another reads: by the declaration order of `pricing.plans`
 * (private plans included), not by price. `'current'` for the same defined id, `'change'` when
 * either id is not a plan of the pricing.
 */
// [impl->req~compare-relation-plan-order~1] [impl->req~compare-relation-change~1]
export function planRelation(
  pricing: NormalizedPricing,
  fromPlanId: string | undefined,
  toPlanId: string | undefined,
): SelectionRelation {
  if (fromPlanId !== undefined && fromPlanId === toPlanId) return 'current';
  const from = pricing.plans.findIndex((plan) => plan.id === fromPlanId);
  const to = pricing.plans.findIndex((plan) => plan.id === toPlanId);
  if (from < 0 || to < 0) return 'change';
  return to > from ? 'upgrade' : 'downgrade';
}
