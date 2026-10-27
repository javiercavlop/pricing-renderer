import {
  mergeSelection,
  normalizeAddOnQuantity,
  reconcileSelection,
  resolvePricing,
} from './resolve.js';
import type {
  AddOnSelection,
  ExpressionOptions,
  PriceBreakdown,
  PricingDiagnostic,
  PricingSelection,
  SelectionComparisonSide,
} from './types.js';
import { cloneValue, isRecord } from './utils.js';

export type SideName = 'before' | 'after';

export interface ComparedSideState {
  /** Merged, sanitized, quantity-normalized and reconciled selection. */
  selection: PricingSelection;
  /** Ids the input selects, including ids the pricing does not define. */
  requestedAddOnIds: Set<string>;
  /** Add-ons that reconciliation deselected, in pricing declaration order. */
  removedAddOnIds: string[];
  breakdown: PriceBreakdown;
  /** Unknown plan, billing period and add-on warnings, in that order. */
  diagnostics: PricingDiagnostic[];
}

function jsonCopy(value: Record<string, unknown>): Record<string, unknown> {
  try {
    const copy: unknown = JSON.parse(JSON.stringify(value));
    return isRecord(copy) ? copy : {};
  } catch {
    return {};
  }
}

// [impl->req~compare-json~1]
function readInput(selection: unknown): Partial<PricingSelection> {
  if (!isRecord(selection)) return {};
  const input: Partial<PricingSelection> = {};
  if (typeof selection.planId === 'string') input.planId = selection.planId;
  if (typeof selection.billingPeriod === 'string') input.billingPeriod = selection.billingPeriod;
  if (isRecord(selection.variables)) input.variables = jsonCopy(selection.variables);
  if (isRecord(selection.addOns)) {
    input.addOns = { ...selection.addOns } as Record<string, AddOnSelection>;
  }
  return input;
}

const warning = (code: string, message: string, path: string): PricingDiagnostic => ({
  code,
  severity: 'warning',
  message,
  path,
});

/** Decision 2, steps 1 to 5: derive one side without throwing. */
// [impl->req~compare-selections-output~1] [impl->req~compare-price-sides~1]
export function deriveSide(
  name: SideName,
  side: SelectionComparisonSide,
  expression: ExpressionOptions | undefined,
): ComparedSideState {
  const { pricing } = side;
  const merged = mergeSelection(pricing, readInput(side.selection));
  const diagnostics: PricingDiagnostic[] = [];

  // [impl->req~compare-unknown-plan~1]
  if (merged.planId !== undefined && !pricing.plans.some((plan) => plan.id === merged.planId)) {
    diagnostics.push(
      warning(
        'PR_COMPARE_UNKNOWN_PLAN',
        `Unknown plan "${merged.planId}" in the ${name} selection.`,
        `${name}.selection.planId`,
      ),
    );
  }
  // [impl->req~compare-unknown-billing~1]
  if (
    merged.billingPeriod !== undefined &&
    !pricing.billing.some((period) => period.id === merged.billingPeriod)
  ) {
    diagnostics.push(
      warning(
        'PR_COMPARE_UNKNOWN_BILLING_PERIOD',
        `Unknown billing period "${merged.billingPeriod}" in the ${name} selection.`,
        `${name}.selection.billingPeriod`,
      ),
    );
  }

  const addOns: Record<string, AddOnSelection> = {};
  const requestedAddOnIds = new Set<string>();
  for (const [id, value] of Object.entries(merged.addOns as Record<string, unknown>)) {
    const entry = isRecord(value) && typeof value.selected === 'boolean' ? value : undefined;
    if (entry?.selected) requestedAddOnIds.add(id);
    // [impl->req~compare-unknown-addon~1]
    if (!pricing.addOns.some((addOn) => addOn.id === id)) {
      diagnostics.push(
        warning(
          'PR_COMPARE_UNKNOWN_ADDON',
          `Unknown add-on "${id}" in the ${name} selection; it is ignored.`,
          `${name}.selection.addOns.${id}`,
        ),
      );
      continue;
    }
    if (!entry) continue;
    addOns[id] = entry.selected
      ? {
          selected: true,
          quantity: normalizeAddOnQuantity(pricing, id, entry as unknown as AddOnSelection),
        }
      : {
          selected: false,
          quantity:
            typeof entry.quantity === 'number' && Number.isFinite(entry.quantity)
              ? entry.quantity + 0
              : 0,
        };
  }

  const { selection, removedAddOnIds } = reconcileSelection(pricing, { ...merged, addOns });
  const breakdown = cloneValue(resolvePricing(pricing, selection, { expression }).breakdown);
  return { selection, requestedAddOnIds, removedAddOnIds, breakdown, diagnostics };
}
