import type { PricingSelection } from '../../src/core/index.js';

export interface SpaceContractLike {
  subscriptionPlans?: Record<string, string>;
  subscriptionAddOns?: Record<string, Record<string, number>>;
}

// Maps the plan and add-on quantities of one service of a SPACE contract to the input of
// applySelection. SPACE contracts carry no billing period, so billingPeriod is never set.
// [impl->req~space-map-plan~1] [impl->req~space-map-addons~1] [impl->req~space-map-service-only~1]
// [impl->req~space-map-missing-service~1] [impl->req~space-map-invalid-quantity~1]
// [impl->req~space-map-addons-only~1] [impl->req~space-map-result-keys~1]
// [impl->req~space-map-no-mutation~1]
export function selectionFromContract(
  contract: SpaceContractLike,
  serviceKey: string,
): Partial<PricingSelection> {
  const result: Partial<PricingSelection> = {};
  const planId = contract.subscriptionPlans?.[serviceKey];
  if (planId !== undefined) {
    result.planId = planId;
  }
  const addOns: PricingSelection['addOns'] = {};
  for (const [name, quantity] of Object.entries(contract.subscriptionAddOns?.[serviceKey] ?? {})) {
    if (typeof quantity === 'number' && Number.isFinite(quantity) && quantity > 0) {
      addOns[name] = { selected: true, quantity };
    }
  }
  if (Object.keys(addOns).length > 0) {
    result.addOns = addOns;
  }
  return result;
}
