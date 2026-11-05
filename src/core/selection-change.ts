import { normalizeAddOnQuantity, reconcileSelection } from './resolve.js';
import type {
  NormalizedPricing,
  PendingAddOnChange,
  PricingSelection,
  SelectionChangeIntent,
  SelectionChangeResult,
} from './types.js';
import { cloneValue, setAtPath } from './utils.js';

function collectDependencies(
  pricing: NormalizedPricing,
  addOnId: string,
  collected = new Set<string>(),
): Set<string> {
  const addOn = pricing.addOns.find((candidate) => candidate.id === addOnId);
  for (const dependency of addOn?.dependsOn ?? []) {
    if (!collected.has(dependency)) {
      collected.add(dependency);
      collectDependencies(pricing, dependency, collected);
    }
  }
  return collected;
}

function selectedDependents(
  pricing: NormalizedPricing,
  selection: PricingSelection,
  addOnId: string,
): string[] {
  const dependents = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const addOn of pricing.addOns) {
      if (!selection.addOns[addOn.id]?.selected || dependents.has(addOn.id)) continue;
      if (addOn.dependsOn.some((id) => id === addOnId || dependents.has(id))) {
        dependents.add(addOn.id);
        changed = true;
      }
    }
  }
  return [...dependents];
}

export function planSelectionChange(
  pricing: NormalizedPricing,
  selection: PricingSelection,
  intent: SelectionChangeIntent,
): SelectionChangeResult {
  if (intent.type === 'plan') {
    const { planId } = intent;
    const { selection: reconciled, removedAddOnIds } = reconcileSelection(pricing, {
      ...selection,
      planId,
    });
    if (removedAddOnIds.length === 0) return { kind: 'apply', selection: reconciled };
    return {
      kind: 'confirm',
      pending: { addOnId: '', select: false, addIds: [], removeIds: removedAddOnIds, planId },
    };
  }

  const { addOnId, selected } = intent;
  const addOn = pricing.addOns.find((candidate) => candidate.id === addOnId);
  if (!addOn) return { kind: 'apply', selection: cloneValue(selection) };

  let addIds: string[] = [];
  let removeIds: string[] = [];
  if (selected) {
    addIds = [...collectDependencies(pricing, addOnId)].filter(
      (id) => id !== addOnId && !selection.addOns[id]?.selected,
    );
    const conflicts = new Set(addOn.excludes);
    for (const candidate of pricing.addOns) {
      if (candidate.excludes.includes(addOnId)) conflicts.add(candidate.id);
    }
    for (const dependency of addIds) {
      const item = pricing.addOns.find((candidate) => candidate.id === dependency);
      item?.excludes.forEach((id) => conflicts.add(id));
    }
    removeIds = [...conflicts].filter((id) => selection.addOns[id]?.selected);
  } else {
    removeIds = selectedDependents(pricing, selection, addOnId);
  }

  const pending: PendingAddOnChange = { addOnId, select: selected, addIds, removeIds };
  if (addIds.length || removeIds.length) return { kind: 'confirm', pending };
  return { kind: 'apply', selection: applySelectionChange(pricing, selection, pending) };
}

export function applySelectionChange(
  pricing: NormalizedPricing,
  selection: PricingSelection,
  pending: PendingAddOnChange,
): PricingSelection {
  const addOns = { ...selection.addOns };
  const setState = (id: string, selected: boolean): void => {
    const item = pricing.addOns.find((candidate) => candidate.id === id);
    const current = addOns[id];
    addOns[id] = {
      selected,
      quantity: current?.quantity ?? item?.subscriptionConstraints?.minQuantity ?? 1,
    };
  };
  if (pending.planId === undefined) setState(pending.addOnId, pending.select);
  pending.addIds.forEach((id) => setState(id, true));
  pending.removeIds.forEach((id) => setState(id, false));
  return reconcileSelection(
    pricing,
    cloneValue({
      ...selection,
      ...(pending.planId !== undefined ? { planId: pending.planId } : {}),
      addOns,
    }),
  ).selection;
}

export function selectionWithVariable(
  selection: PricingSelection,
  path: string,
  value: unknown,
): PricingSelection {
  const variables = cloneValue(selection.variables);
  setAtPath(variables, path, value);
  return { ...selection, variables };
}

export function selectionWithAddOnQuantity(
  pricing: NormalizedPricing,
  selection: PricingSelection,
  addOnId: string,
  quantity: number,
): PricingSelection {
  const current = selection.addOns[addOnId] ?? { selected: true, quantity };
  const normalized = normalizeAddOnQuantity(pricing, addOnId, {
    ...current,
    selected: true,
    quantity,
  });
  return {
    ...selection,
    addOns: { ...selection.addOns, [addOnId]: { selected: true, quantity: normalized } },
  };
}

export function selectionInEffect(
  pricing: NormalizedPricing,
  selection: PricingSelection,
  options: { variablesEnabled?: boolean } = {},
): PricingSelection {
  const variables = options.variablesEnabled === false ? pricing.variables : selection.variables;
  return { ...cloneValue(selection), variables: cloneValue(variables) };
}
