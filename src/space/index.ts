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

// Contract maps come from JSON, so keys such as "constructor", "toString" or "__proto__" are
// data: they are read as own properties only and written with defineProperty.
function ownValue<T>(record: Record<string, T> | undefined, key: string): T | undefined {
  if (!record || !Object.prototype.hasOwnProperty.call(record, key)) return undefined;
  return record[key];
}

function setOwn<T>(record: Record<string, T>, key: string, value: T): void {
  Object.defineProperty(record, key, {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  });
}

// Maps the plan and add-on quantities of one service of a SPACE contract to the input of
// applySelection. SPACE contracts carry no billing period, so billingPeriod is never set.
export function selectionFromContract(
  contract: SpaceContractLike,
  serviceKey: string,
): Partial<PricingSelection> {
  const result: Partial<PricingSelection> = {};
  const planId = ownValue(contract.subscriptionPlans, serviceKey);
  if (typeof planId === 'string') {
    result.planId = planId;
  }
  const addOns: PricingSelection['addOns'] = {};
  const quantities = ownValue(contract.subscriptionAddOns, serviceKey);
  for (const [name, quantity] of Object.entries(quantities ?? {})) {
    if (typeof quantity === 'number' && Number.isFinite(quantity) && quantity > 0) {
      setOwn(addOns, name, { selected: true, quantity });
    }
  }
  if (Object.keys(addOns).length > 0) {
    result.addOns = addOns;
  }
  return result;
}

// Builds the SPACE novation body of one service from a reconciled selection.
export function subscriptionFromSelection(
  serviceKey: string,
  version: string,
  selection: SpaceSelectionLike,
): SpaceSubscription {
  const plans: Record<string, string> = {};
  if (typeof selection.planId === 'string' && selection.planId !== '') {
    setOwn(plans, serviceKey, selection.planId);
  }
  const addOns: Record<string, number> = {};
  for (const [id, entry] of Object.entries(selection.addOns ?? {})) {
    if (entry?.selected === true && Number.isFinite(entry.quantity) && entry.quantity > 0) {
      setOwn(addOns, id, entry.quantity);
    }
  }
  return {
    contractedServices: { [serviceKey]: version },
    subscriptionPlans: plans,
    subscriptionAddOns: { [serviceKey]: addOns },
  };
}

// SPACE stores versions with "." replaced by "_" and clients read them back dotted.
export function contractedVersion(
  contract: SpaceContractLike,
  serviceKey: string,
): string | undefined {
  const stored = ownValue(contract.contractedServices, serviceKey);
  return typeof stored === 'string' ? stored.replaceAll('_', '.') : undefined;
}

// Maps the consumed amount of each usage limit of one service.
export function currentUsageFromContract(
  contract: SpaceContractLike,
  serviceKey: string,
): Record<string, number> {
  const usage: Record<string, number> = {};
  const levels = ownValue(contract.usageLevels, serviceKey);
  for (const [name, level] of Object.entries(levels ?? {})) {
    const consumed = ownValue(level, 'consumed');
    if (typeof consumed === 'number' && Number.isFinite(consumed) && consumed >= 0) {
      setOwn(usage, name, consumed);
    }
  }
  return usage;
}
