import type { PricingSelection } from '../../src/core/index.js';

export interface SpaceContractLike {
  subscriptionPlans?: Record<string, string>;
  subscriptionAddOns?: Record<string, Record<string, number>>;
}

export function selectionFromContract(
  _contract: SpaceContractLike,
  _serviceKey: string,
): Partial<PricingSelection> {
  throw new Error('not implemented');
}
