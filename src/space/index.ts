import type { PricingSelection } from '../core/index.js';

export interface SpaceContractLike {
  contractedServices?: Record<string, string>;
  subscriptionPlans?: Record<string, string>;
  subscriptionAddOns?: Record<string, Record<string, number>>;
  usageLevels?: Record<string, Record<string, { consumed?: number }>>;
}

export interface SpaceSubscription {
  contractedServices: Record<string, string>;
  subscriptionPlans: Record<string, string>;
  subscriptionAddOns: Record<string, Record<string, number>>;
}

export interface SpaceSelectionLike {
  planId?: string;
  addOns?: Record<string, { selected: boolean; quantity: number }>;
}

// Maps the plan and add-on quantities of one service of a SPACE contract to the input of
// applySelection. SPACE contracts carry no billing period, so billingPeriod is never set.
// [impl->req~space-select-from-contract~1]
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

// Builds the SPACE novation body of one service from a reconciled selection.
// [impl->req~space-subscription-body~1] [impl->req~space-subscription-version~1]
// [impl->req~space-subscription-plan~1] [impl->req~space-subscription-addons~1]
// [impl->req~space-roundtrip~1] [impl->req~space-no-runtime-deps~1]
// [impl->req~space-no-mutation~1]
export function subscriptionFromSelection(
  serviceKey: string,
  version: string,
  selection: SpaceSelectionLike,
): SpaceSubscription {
  const plans: Record<string, string> = {};
  if (typeof selection.planId === 'string' && selection.planId !== '') {
    plans[serviceKey] = selection.planId;
  }
  const addOns: Record<string, number> = {};
  for (const [id, entry] of Object.entries(selection.addOns ?? {})) {
    if (entry?.selected === true && Number.isFinite(entry.quantity) && entry.quantity > 0) {
      addOns[id] = entry.quantity;
    }
  }
  return {
    contractedServices: { [serviceKey]: version },
    subscriptionPlans: plans,
    subscriptionAddOns: { [serviceKey]: addOns },
  };
}

// SPACE stores versions with "." replaced by "_" and clients read them back dotted.
// [impl->req~space-contracted-version~1] [impl->req~space-no-mutation~1]
export function contractedVersion(
  contract: SpaceContractLike,
  serviceKey: string,
): string | undefined {
  const stored = contract.contractedServices?.[serviceKey];
  return typeof stored === 'string' ? stored.replaceAll('_', '.') : undefined;
}

// Maps the consumed amount of each usage limit of one service.
// [impl->req~space-current-usage~1] [impl->req~space-no-mutation~1]
export function currentUsageFromContract(
  contract: SpaceContractLike,
  serviceKey: string,
): Record<string, number> {
  const usage: Record<string, number> = {};
  for (const [name, level] of Object.entries(contract.usageLevels?.[serviceKey] ?? {})) {
    const consumed = level?.consumed;
    if (typeof consumed === 'number' && Number.isFinite(consumed) && consumed >= 0) {
      usage[name] = consumed;
    }
  }
  return usage;
}
