import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as core from '../../src/core/index.js';
import type {
  AddOnSelection,
  NormalizedAddOn,
  NormalizedPricing,
  PricingSelection,
} from '../../src/core/index.js';
import { parsePricingYaml } from '../../src/yaml/index.js';

type ReconcileResult = { selection: PricingSelection; removedAddOnIds: string[] };
type ReconcileFn = (pricing: NormalizedPricing, selection: PricingSelection) => ReconcileResult;

const fixtureUrl = new URL('../fixtures/acme-pricing.yml', import.meta.url);

async function loadFixture(): Promise<NormalizedPricing> {
  const result = parsePricingYaml(await readFile(fileURLToPath(fixtureUrl), 'utf8'));
  return result.value!;
}

// The function does not exist yet: assert its presence first so the tests fail by assertion.
function reconcile(): ReconcileFn {
  const candidate = (core as Record<string, unknown>).reconcileSelection;
  expect(typeof candidate).toBe('function');
  return candidate as ReconcileFn;
}

function withAddOns(pricing: NormalizedPricing, extra: NormalizedAddOn[]): NormalizedPricing {
  return { ...pricing, addOns: [...pricing.addOns, ...extra] };
}

function syntheticAddOn(
  pricing: NormalizedPricing,
  id: string,
  overrides: Partial<NormalizedAddOn>,
): NormalizedAddOn {
  const base = pricing.addOns.find((addOn) => addOn.id === 'extraStorage')!;
  return {
    ...base,
    id,
    name: id,
    availableFor: [],
    dependsOn: [],
    excludes: [],
    ...overrides,
  };
}

function selectionOf(
  pricing: NormalizedPricing,
  planId: string | undefined,
  addOns: Record<string, AddOnSelection>,
  extra: Partial<PricingSelection> = {},
): PricingSelection {
  return {
    planId,
    billingPeriod: 'monthly',
    variables: { ...pricing.variables },
    addOns,
    ...extra,
  };
}

const on = (quantity = 1): AddOnSelection => ({ selected: true, quantity });

describe('reconcileSelection', () => {
  it('[utest->req~reconcile-selection-result~1] returns removed ids once, in pricing.addOns order', async () => {
    const reconcileSelection = reconcile();
    const pricing = await loadFixture();
    const result = reconcileSelection(
      pricing,
      selectionOf(pricing, 'starter', { prioritySuccess: on(), extraStorage: on() }),
    );
    expect(result.removedAddOnIds).toEqual(['extraStorage', 'prioritySuccess']);
    expect(Object.keys(result).sort()).toEqual(['removedAddOnIds', 'selection']);
  });

  it('[utest->req~reconcile-unavailable-addons~1] deselects an add-on unavailable for the plan and keeps its quantity', async () => {
    const reconcileSelection = reconcile();
    const pricing = await loadFixture();
    const result = reconcileSelection(
      pricing,
      selectionOf(pricing, 'starter', { extraStorage: on(3) }),
    );
    expect(result.selection.addOns.extraStorage).toEqual({ selected: false, quantity: 3 });
    expect(result.removedAddOnIds).toEqual(['extraStorage']);
  });

  it('[utest->req~reconcile-unavailable-addons~1] removes compliance when moving from Enterprise to Growth', async () => {
    const reconcileSelection = reconcile();
    const pricing = await loadFixture();
    const result = reconcileSelection(
      pricing,
      selectionOf(pricing, 'growth', { compliance: on() }),
    );
    expect(result.removedAddOnIds).toEqual(['compliance']);
    expect(result.selection.addOns.compliance).toEqual({ selected: false, quantity: 1 });
  });

  it('[utest->req~reconcile-unavailable-addons~1] treats an unknown plan id as unavailable for restricted add-ons', async () => {
    const reconcileSelection = reconcile();
    const pricing = await loadFixture();
    const result = reconcileSelection(
      pricing,
      selectionOf(pricing, 'legacy', { extraStorage: on() }),
    );
    expect(result.removedAddOnIds).toEqual(['extraStorage']);
  });

  it('[utest->req~reconcile-unavailable-addons~1] treats an undefined plan id as unavailable for restricted add-ons', async () => {
    const reconcileSelection = reconcile();
    const pricing = await loadFixture();
    const result = reconcileSelection(
      pricing,
      selectionOf(pricing, undefined, { extraStorage: on() }),
    );
    expect(result.removedAddOnIds).toEqual(['extraStorage']);
  });

  it('[utest->req~reconcile-dependents~1] deselects an unrestricted dependent of a removed add-on', async () => {
    const reconcileSelection = reconcile();
    const base = await loadFixture();
    const pricing = withAddOns(base, [
      syntheticAddOn(base, 'backupPlus', { availableFor: [], dependsOn: ['extraStorage'] }),
    ]);
    const result = reconcileSelection(
      pricing,
      selectionOf(pricing, 'starter', { extraStorage: on(), backupPlus: on(2) }),
    );
    expect(result.removedAddOnIds).toEqual(['extraStorage', 'backupPlus']);
    expect(result.selection.addOns.backupPlus).toEqual({ selected: false, quantity: 2 });
  });

  it('[utest->req~reconcile-dependents~1] follows dependencies transitively', async () => {
    const reconcileSelection = reconcile();
    const base = await loadFixture();
    const pricing = withAddOns(base, [
      syntheticAddOn(base, 'backupPlus', { dependsOn: ['extraStorage'] }),
      syntheticAddOn(base, 'backupPro', { dependsOn: ['backupPlus'] }),
    ]);
    const result = reconcileSelection(
      pricing,
      selectionOf(pricing, 'starter', { extraStorage: on(), backupPlus: on(), backupPro: on() }),
    );
    expect(result.removedAddOnIds).toEqual(['extraStorage', 'backupPlus', 'backupPro']);
  });

  it('[utest->req~reconcile-unrestricted-addons~1] keeps an add-on with empty availableFor on every plan', async () => {
    const reconcileSelection = reconcile();
    const base = await loadFixture();
    const pricing = withAddOns(base, [syntheticAddOn(base, 'onboarding', {})]);
    for (const planId of ['starter', 'growth', 'enterprise', 'legacy']) {
      const result = reconcileSelection(
        pricing,
        selectionOf(pricing, planId, { onboarding: on() }),
      );
      expect(result.selection.addOns.onboarding?.selected).toBe(true);
      expect(result.removedAddOnIds).toEqual([]);
    }
  });

  it('[utest->req~reconcile-valid-unchanged~1] returns a valid selection deeply equal to its input', async () => {
    const reconcileSelection = reconcile();
    const pricing = await loadFixture();
    const input = selectionOf(pricing, 'growth', { extraStorage: on(), prioritySuccess: on() });
    const result = reconcileSelection(pricing, input);
    expect(result.selection).toEqual(input);
    expect(result.removedAddOnIds).toEqual([]);
  });

  it('[utest->req~reconcile-valid-unchanged~1] is idempotent for the Starter downgrade', async () => {
    const reconcileSelection = reconcile();
    const pricing = await loadFixture();
    const first = reconcileSelection(
      pricing,
      selectionOf(pricing, 'starter', { extraStorage: on(), prioritySuccess: on() }),
    );
    const second = reconcileSelection(pricing, first.selection);
    expect(second.selection).toEqual(first.selection);
    expect(second.removedAddOnIds).toEqual([]);
  });

  it('[utest->req~reconcile-valid-unchanged~1] is idempotent and never leaves an unavailable add-on selected, for all plans and add-on subsets', async () => {
    const reconcileSelection = reconcile();
    const base = await loadFixture();
    const pricing = withAddOns(base, [
      syntheticAddOn(base, 'backupPlus', { dependsOn: ['extraStorage'] }),
      syntheticAddOn(base, 'onboarding', {}),
    ]);
    const ids = pricing.addOns.map((addOn) => addOn.id);
    const planIds = [...pricing.plans.map((plan) => plan.id), 'legacy', undefined];
    for (const planId of planIds) {
      for (let mask = 0; mask < 1 << ids.length; mask += 1) {
        const addOns: Record<string, AddOnSelection> = {};
        ids.forEach((id, index) => {
          addOns[id] = { selected: Boolean(mask & (1 << index)), quantity: index + 1 };
        });
        const input = selectionOf(pricing, planId, addOns);
        const once = reconcileSelection(pricing, input);
        const twice = reconcileSelection(pricing, once.selection);
        expect(twice.selection).toEqual(once.selection);
        expect(twice.removedAddOnIds).toEqual([]);
        for (const addOn of pricing.addOns) {
          if (!once.selection.addOns[addOn.id]?.selected) continue;
          const available =
            addOn.availableFor.length === 0 ||
            (planId !== undefined && addOn.availableFor.includes(planId));
          expect(available).toBe(true);
        }
      }
    }
  });

  it('[utest->req~reconcile-no-mutation~1] does not mutate pricing or selection', async () => {
    const reconcileSelection = reconcile();
    const pricing = await loadFixture();
    const selection = selectionOf(pricing, 'starter', { extraStorage: on() });
    const pricingCopy = structuredClone(pricing);
    const selectionCopy = structuredClone(selection);
    reconcileSelection(pricing, selection);
    expect(pricing).toEqual(pricingCopy);
    expect(selection).toEqual(selectionCopy);
  });

  it('[utest->req~reconcile-preserves-fields~1] keeps billing, variables and unknown add-on ids', async () => {
    const reconcileSelection = reconcile();
    const pricing = await loadFixture();
    const input = selectionOf(
      pricing,
      'starter',
      { extraStorage: on(), ghost: { selected: true, quantity: 1 } },
      { billingPeriod: 'yearly', variables: { seats: 12 } },
    );
    const result = reconcileSelection(pricing, input);
    expect(result.selection.planId).toBe('starter');
    expect(result.selection.billingPeriod).toBe('yearly');
    expect(result.selection.variables).toEqual({ seats: 12 });
    expect(result.selection.addOns.ghost).toEqual({ selected: true, quantity: 1 });
    expect(result.removedAddOnIds).toEqual(['extraStorage']);
  });
});

describe('resolvePricing with unavailable add-ons', () => {
  it('[utest->req~resolve-totals-exclude-removed~1] excludes an unavailable add-on from the subtotal', async () => {
    const pricing = await loadFixture();
    const resolved = core.resolvePricing(pricing, {
      planId: 'starter',
      addOns: { extraStorage: { selected: true, quantity: 2 } },
    });
    expect(resolved.subtotal).toBe(20);
  });

  it('[utest->req~resolve-totals-exclude-removed~1] ignores an unavailable quote add-on for requiresQuote', async () => {
    const pricing = await loadFixture();
    const resolved = core.resolvePricing(pricing, {
      planId: 'growth',
      addOns: { compliance: { selected: true, quantity: 1 } },
    });
    expect(resolved.requiresQuote).toBe(false);
    expect(resolved.subtotal).toBe(45);
  });

  // Expected to pass already on today's code: resolvePricing never rewrites the selection.
  it('[utest->req~resolve-selection-unreconciled~1] keeps the invalid add-on in resolved.selection', async () => {
    const pricing = await loadFixture();
    const resolved = core.resolvePricing(pricing, {
      planId: 'starter',
      addOns: { extraStorage: { selected: true, quantity: 2 } },
    });
    expect(resolved.selection.addOns.extraStorage).toEqual({ selected: true, quantity: 2 });
  });
});
