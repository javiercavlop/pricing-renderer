import { deriveSide } from './compare-sides.js';
import type { ComparedSideState } from './compare-sides.js';
import { effectiveValue, exceedsUsage, hasCapability, limitDirection } from './compare-values.js';
import type { ComparedValueKind } from './compare-values.js';
import { planRelation } from './plan-relation.js';
import type {
  AddOnChange,
  AddOnComparison,
  AddOnRemovalReason,
  CatalogIds,
  ComparedPlan,
  ComparedValue,
  FeatureChange,
  FeatureComparison,
  ItemPresence,
  NormalizedPricing,
  PriceComparison,
  PricingDiagnostic,
  SelectionComparison,
  SelectionComparisonInput,
  SelectionRelation,
  UsageLimitChange,
  UsageLimitComparison,
  VersionComparison,
} from './types.js';
import { cloneValue, deepEqual, isRecord } from './utils.js';

interface Merged<T> {
  id: string;
  /** The definition of the after pricing when it has one, else the before pricing's. */
  item: T;
  presence: ItemPresence;
}

function presenceOf(inBefore: boolean, inAfter: boolean): ItemPresence {
  if (inBefore && inAfter) return 'both';
  return inBefore ? 'before-only' : 'after-only';
}

/** After-pricing declaration order, then the ids only the before pricing defines. */
// [impl->req~compare-order~1] [impl->req~compare-item-presence~1]
function mergeItems<T extends { id: string }>(before: T[], after: T[]): Merged<T>[] {
  const beforeIds = new Set(before.map((item) => item.id));
  const afterIds = new Set(after.map((item) => item.id));
  const beforeOnly = before.filter((item) => !afterIds.has(item.id));
  return [...after, ...beforeOnly].map((item): Merged<T> => {
    const presence = presenceOf(beforeIds.has(item.id), afterIds.has(item.id));
    return { id: item.id, item, presence };
  });
}

function idsOnlyIn(from: Array<{ id: string }>, other: Array<{ id: string }>): string[] {
  const otherIds = new Set(other.map((item) => item.id));
  return from.filter((item) => !otherIds.has(item.id)).map((item) => item.id);
}

function catalogOnlyIn(from: NormalizedPricing, other: NormalizedPricing): CatalogIds {
  return {
    plans: idsOnlyIn(from.plans, other.plans),
    addOns: idsOnlyIn(from.addOns, other.addOns),
    features: idsOnlyIn(from.features, other.features),
    usageLimits: idsOnlyIn(from.usageLimits, other.usageLimits),
  };
}

// [impl->req~compare-plan~1]
function comparedPlan(pricing: NormalizedPricing, id: string | undefined): ComparedPlan {
  const plan = pricing.plans.find((candidate) => candidate.id === id);
  const result: ComparedPlan = { known: plan !== undefined };
  if (id !== undefined) result.id = id;
  if (plan) result.name = plan.name;
  return result;
}

function removalReason(
  after: NormalizedPricing,
  afterPlanId: string | undefined,
  id: string,
): AddOnRemovalReason {
  const addOn = after.addOns.find((candidate) => candidate.id === id);
  if (!addOn) return 'not-in-version';
  const offered = afterPlanId !== undefined && addOn.availableFor.includes(afterPlanId);
  return addOn.availableFor.length > 0 && !offered ? 'unavailable-for-plan' : 'dependency-removed';
}

interface Definition {
  id: string;
  defaultValue?: unknown;
}

/** The value of the id on one side, or none when that side's pricing does not define the id. */
function sideValue(
  kind: ComparedValueKind,
  pricing: NormalizedPricing,
  side: ComparedSideState,
  id: string,
): ComparedValue {
  const definitions: Definition[] = kind === 'feature' ? pricing.features : pricing.usageLimits;
  const definition = definitions.find((candidate) => candidate.id === id);
  if (!definition) return { kind: 'none' };
  return effectiveValue(pricing, side.selection, kind, id, definition.defaultValue);
}

// [impl->req~compare-addons-added~1] [impl->req~compare-addons-removed-by-user~1]
// [impl->req~compare-addons-removed-by-reconciliation~1] [impl->req~compare-addons-quantity~1]
// [impl->req~compare-addons-unchanged~1]
function compareAddOns(
  beforePricing: NormalizedPricing,
  afterPricing: NormalizedPricing,
  before: ComparedSideState,
  after: ComparedSideState,
): AddOnComparison {
  const result: AddOnComparison = {
    added: [],
    removedByUser: [],
    removedByReconciliation: [],
    quantityChanged: [],
    unchanged: [],
  };
  const merged = mergeItems(beforePricing.addOns, afterPricing.addOns);
  for (const { id, item, presence } of merged) {
    const was = before.selection.addOns[id];
    const now = after.selection.addOns[id];
    const base = { id, name: item.name, presence };
    if (now?.selected && !was?.selected) {
      const added: AddOnChange = { ...base, quantity: now.quantity };
      result.added.push(added);
    } else if (was?.selected && !now?.selected) {
      const removed: AddOnChange = { ...base, quantity: was.quantity };
      if (after.requestedAddOnIds.has(id)) {
        const reason = removalReason(afterPricing, after.selection.planId, id);
        result.removedByReconciliation.push({ ...removed, reason });
      } else {
        result.removedByUser.push(removed);
      }
    } else if (was?.selected && now?.selected) {
      if (was.quantity === now.quantity) {
        result.unchanged.push(id);
      } else {
        const delta = now.quantity - was.quantity;
        const change = { id, name: item.name, before: was.quantity, after: now.quantity, delta };
        result.quantityChanged.push(change);
      }
    }
  }
  return result;
}

// [impl->req~compare-features~1] [impl->req~compare-effective-features~1]
function compareFeatures(
  beforePricing: NormalizedPricing,
  afterPricing: NormalizedPricing,
  before: ComparedSideState,
  after: ComparedSideState,
): FeatureComparison {
  const result: FeatureComparison = { gained: [], lost: [], changed: [], unchanged: [] };
  const merged = mergeItems(beforePricing.features, afterPricing.features);
  for (const { id, item, presence } of merged) {
    const beforeValue = sideValue('feature', beforePricing, before, id);
    const afterValue = sideValue('feature', afterPricing, after, id);
    const beforeCapable = hasCapability(beforeValue);
    const afterCapable = hasCapability(afterValue);
    if (deepEqual(beforeValue, afterValue) || (!beforeCapable && !afterCapable)) {
      result.unchanged.push(id);
      continue;
    }
    const entry: FeatureChange = {
      id,
      name: item.name,
      before: beforeValue,
      after: afterValue,
      presence,
    };
    if (!beforeCapable) result.gained.push(entry);
    else if (!afterCapable) result.lost.push(entry);
    else result.changed.push(entry);
  }
  return result;
}

interface UsageReading {
  valid: Map<string, number>;
  diagnostics: PricingDiagnostic[];
}

// [impl->req~compare-usage-diagnostics~1]
function readCurrentUsage(input: unknown, knownIds: Set<string>): UsageReading {
  const valid = new Map<string, number>();
  const diagnostics: PricingDiagnostic[] = [];
  if (!isRecord(input)) return { valid, diagnostics };
  for (const [id, value] of Object.entries(input)) {
    const path = `currentUsage.${id}`;
    if (!knownIds.has(id)) {
      diagnostics.push({
        code: 'PR_COMPARE_UNKNOWN_USAGE_LIMIT',
        severity: 'info',
        message: `Unknown usage limit "${id}"; the entry is ignored.`,
        path,
      });
    } else if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      diagnostics.push({
        code: 'PR_COMPARE_INVALID_USAGE',
        severity: 'warning',
        message: `Invalid current usage for "${id}"; the entry is ignored.`,
        path,
      });
    } else {
      // + 0 turns a negative zero into 0, which JSON keeps
      valid.set(id, value + 0);
    }
  }
  return { valid, diagnostics };
}

// [impl->req~compare-limits~1] [impl->req~compare-effective-limits~1]
// [impl->req~compare-current-usage~1] [impl->req~compare-current-usage-entry~1]
function compareUsageLimits(
  beforePricing: NormalizedPricing,
  afterPricing: NormalizedPricing,
  before: ComparedSideState,
  after: ComparedSideState,
  usage: Map<string, number>,
): UsageLimitComparison {
  const result: UsageLimitComparison = { changed: [], unchanged: [], exceeded: [] };
  const merged = mergeItems(beforePricing.usageLimits, afterPricing.usageLimits);
  for (const { id, item, presence } of merged) {
    const beforeValue = sideValue('usage-limit', beforePricing, before, id);
    const afterValue = sideValue('usage-limit', afterPricing, after, id);
    const consumed = usage.get(id);
    const exceeded = consumed !== undefined && exceedsUsage(afterValue, consumed);
    if (exceeded) result.exceeded.push(id);
    if (deepEqual(beforeValue, afterValue)) {
      result.unchanged.push(id);
      continue;
    }
    const entry: UsageLimitChange = {
      id,
      name: item.name,
      before: beforeValue,
      after: afterValue,
      direction: limitDirection(beforeValue, afterValue),
      presence,
    };
    if (item.unit !== undefined) entry.unit = item.unit;
    if (beforeValue.kind === 'number' && afterValue.kind === 'number') {
      entry.delta = afterValue.value - beforeValue.value;
    }
    if (consumed !== undefined) entry.currentUsage = consumed;
    if (exceeded) entry.exceedsCurrentUsage = true;
    result.changed.push(entry);
  }
  return result;
}

// [impl->req~compare-price-sides~1] [impl->req~compare-price-difference~1]
// [impl->req~compare-price-difference-omitted~1]
function comparePrice(before: ComparedSideState, after: ComparedSideState): PriceComparison {
  const beforePrice = before.breakdown;
  const afterPrice = after.breakdown;
  const price: PriceComparison = {
    before: beforePrice,
    after: afterPrice,
    billingPeriodChanged: beforePrice.billingPeriod?.id !== afterPrice.billingPeriod?.id,
  };
  if (beforePrice.requiresQuote || afterPrice.requiresQuote) {
    price.differenceOmitted = 'quote';
  } else if (beforePrice.currency !== afterPrice.currency) {
    price.differenceOmitted = 'currency';
  } else {
    price.difference = afterPrice.subtotal - beforePrice.subtotal;
  }
  return price;
}

function selectedQuantities(side: ComparedSideState): Map<string, number> {
  const quantities = new Map<string, number>();
  for (const [id, state] of Object.entries(side.selection.addOns)) {
    if (state.selected) quantities.set(id, state.quantity);
  }
  return quantities;
}

// [impl->req~compare-relation-current~1]
function isCurrent(
  versions: VersionComparison,
  before: ComparedSideState,
  after: ComparedSideState,
): boolean {
  if (versions.changed) return false;
  if (before.selection.planId !== after.selection.planId) return false;
  if (before.selection.billingPeriod !== after.selection.billingPeriod) return false;
  if (!deepEqual(before.selection.variables, after.selection.variables)) return false;
  const was = selectedQuantities(before);
  const now = selectedQuantities(after);
  return was.size === now.size && [...was].every(([id, quantity]) => now.get(id) === quantity);
}

// [impl->req~compare-version~1] [impl->req~compare-version-items~1]
function compareVersions(before: NormalizedPricing, after: NormalizedPricing): VersionComparison {
  const version: VersionComparison = {
    changed: before.metadata.version !== after.metadata.version,
    onlyInBefore: catalogOnlyIn(before, after),
    onlyInAfter: catalogOnlyIn(after, before),
  };
  if (before.metadata.version !== undefined) version.before = before.metadata.version;
  if (after.metadata.version !== undefined) version.after = after.metadata.version;
  return version;
}

// [impl->req~compare-addon-dropped~1]
function droppedDiagnostics(before: ComparedSideState, after: ComparedSideState) {
  const dropped: PricingDiagnostic[] = [];
  for (const id of after.removedAddOnIds) {
    if (before.selection.addOns[id]?.selected) continue;
    dropped.push({
      code: 'PR_COMPARE_ADDON_DROPPED',
      severity: 'info',
      message: `Add-on "${id}" is not available with the selected plan and was dropped.`,
      path: `after.selection.addOns.${id}`,
      details: { addOnId: id },
    });
  }
  return dropped;
}

/**
 * Compares a contract with an edit: which plan, add-ons, features and limits change, what the
 * price does, and which pricing items exist in only one version. Never throws on unknown ids.
 */
// [impl->req~compare-selections-export~1] [impl->req~compare-headless~1]
// [impl->req~compare-no-mutation~1] [impl->req~compare-detached~1] [impl->req~compare-json~1]
export function compareSelections(input: SelectionComparisonInput): SelectionComparison {
  const beforePricing = input.before.pricing;
  const afterPricing = input.after.pricing;
  const before = deriveSide('before', input.before, input.expression);
  const after = deriveSide('after', input.after, input.expression);
  const version = compareVersions(beforePricing, afterPricing);

  const limitIds = new Set(beforePricing.usageLimits.map((limit) => limit.id));
  for (const limit of afterPricing.usageLimits) limitIds.add(limit.id);
  const usage = readCurrentUsage(input.currentUsage, limitIds);

  const beforePlanId = before.selection.planId;
  const afterPlanId = after.selection.planId;
  // [impl->req~compare-relation-plan-order~1] [impl->req~compare-relation-change~1]
  let relation: SelectionRelation;
  if (isCurrent(version, before, after)) relation = 'current';
  else if (beforePlanId === afterPlanId) relation = 'change';
  else relation = planRelation(afterPricing, beforePlanId, afterPlanId);

  const result: SelectionComparison = {
    relation,
    version,
    plan: {
      before: comparedPlan(beforePricing, beforePlanId),
      after: comparedPlan(afterPricing, afterPlanId),
      changed: beforePlanId !== afterPlanId,
    },
    addOns: compareAddOns(beforePricing, afterPricing, before, after),
    features: compareFeatures(beforePricing, afterPricing, before, after),
    usageLimits: compareUsageLimits(beforePricing, afterPricing, before, after, usage.valid),
    price: comparePrice(before, after),
    selections: { before: before.selection, after: after.selection },
    // [impl->req~compare-diagnostics-order~1]
    diagnostics: [
      ...before.diagnostics,
      ...after.diagnostics,
      ...droppedDiagnostics(before, after),
      ...usage.diagnostics,
    ],
  };
  return cloneValue(result);
}
