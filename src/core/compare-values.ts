import type {
  ComparedValue,
  JsonValue,
  NormalizedPricing,
  PricingSelection,
  UsageLimitChange,
} from './types.js';
import { isRecord, unwrapValue } from './utils.js';

export type ComparedValueKind = 'feature' | 'usage-limit';

export const UNLIMITED_TEXT = new Set(['.inf', 'Infinity', 'unlimited']);

const hasOwn = (record: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(record, key) && record[key] !== undefined;

export function toComparedValue(raw: unknown, kind: ComparedValueKind): ComparedValue {
  if (raw === undefined) return { kind: 'none' };
  if (raw === null) return kind === 'usage-limit' ? { kind: 'unlimited' } : { kind: 'none' };
  if (typeof raw === 'boolean') return { kind: 'boolean', value: raw };
  if (typeof raw === 'number') {
    if (raw === Number.POSITIVE_INFINITY) return { kind: 'unlimited' };
    if (!Number.isFinite(raw)) return { kind: 'none' };
    return { kind: 'number', value: raw };
  }
  if (typeof raw === 'string') {
    return UNLIMITED_TEXT.has(raw) ? { kind: 'unlimited' } : { kind: 'text', value: raw };
  }
  if (Array.isArray(raw) || isRecord(raw)) {
    try {
      return { kind: 'json', value: JSON.parse(JSON.stringify(raw)) as JsonValue };
    } catch {
      return { kind: 'none' };
    }
  }
  return { kind: 'none' };
}

function extendLimit(current: ComparedValue, amount: number): ComparedValue {
  if (current.kind === 'unlimited') return current;
  if (current.kind === 'number') return { kind: 'number', value: current.value + amount };
  if (current.kind === 'none') return { kind: 'number', value: amount };
  return current;
}

/**
 * The value of a feature or usage limit for a reconciled selection: the plan value (or the
 * definition's default), replaced or extended by each selected add-on in declaration order.
 */
export function effectiveValue(
  pricing: NormalizedPricing,
  selection: PricingSelection,
  kind: ComparedValueKind,
  id: string,
  defaultValue: unknown,
): ComparedValue {
  const plan = pricing.plans.find((candidate) => candidate.id === selection.planId);
  const planValues = kind === 'feature' ? plan?.features : plan?.usageLimits;
  let value = toComparedValue(
    planValues && hasOwn(planValues, id) ? unwrapValue(planValues[id]) : defaultValue,
    kind,
  );
  for (const addOn of pricing.addOns) {
    const state = selection.addOns[addOn.id];
    if (!state?.selected) continue;
    const overrides = kind === 'feature' ? addOn.features : addOn.usageLimits;
    if (hasOwn(overrides, id)) value = toComparedValue(unwrapValue(overrides[id]), kind);
    if (kind === 'usage-limit' && hasOwn(addOn.usageLimitsExtensions, id)) {
      const extension = unwrapValue(addOn.usageLimitsExtensions[id]);
      if (typeof extension === 'number' && Number.isFinite(extension)) {
        value = extendLimit(value, extension * state.quantity);
      }
    }
  }
  return value;
}

export function hasCapability(value: ComparedValue): boolean {
  switch (value.kind) {
    case 'none':
      return false;
    case 'boolean':
      return value.value;
    case 'number':
      return value.value !== 0;
    case 'text':
      return value.value !== '';
    default:
      return true;
  }
}

const LIMIT_RANK: Partial<Record<ComparedValue['kind'], number>> = {
  none: 0,
  number: 1,
  unlimited: 2,
};

export function limitDirection(
  before: ComparedValue,
  after: ComparedValue,
): UsageLimitChange['direction'] {
  if (before.kind === 'number' && after.kind === 'number') {
    return after.value > before.value ? 'increased' : 'decreased';
  }
  const beforeRank = LIMIT_RANK[before.kind];
  const afterRank = LIMIT_RANK[after.kind];
  if (beforeRank === undefined || afterRank === undefined) return 'changed';
  return afterRank > beforeRank ? 'increased' : 'decreased';
}

export function exceedsUsage(after: ComparedValue, consumed: number): boolean {
  if (after.kind === 'number') return consumed > after.value;
  if (after.kind === 'none') return consumed > 0;
  return false;
}
