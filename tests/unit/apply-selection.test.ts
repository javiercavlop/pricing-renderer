import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import * as core from '../../src/core/index.js';
import { createDefaultSelection, resolvePricing } from '../../src/core/index.js';
import type { NormalizedPricing, PricingSelection } from '../../src/core/index.js';
import { applySelectionInput } from '../../src/core/apply-selection.js';
import { parsePricingYaml } from '../../src/yaml/index.js';

async function loadFixture(relative: string): Promise<NormalizedPricing> {
  const url = new URL(relative, import.meta.url);
  const result = parsePricingYaml(await readFile(fileURLToPath(url), 'utf8'));
  return result.value!;
}

let acme: NormalizedPricing;
let slack: NormalizedPricing;
let acmeDefaults: PricingSelection;
let slackDefaults: PricingSelection;

beforeAll(async () => {
  acme = await loadFixture('../fixtures/acme-pricing.yml');
  slack = await loadFixture('../fixtures/spectra/slack/2024.yml');
  acmeDefaults = createDefaultSelection(acme);
  slackDefaults = createDefaultSelection(slack);
});

const defaultVariables = {
  seats: 5,
  prioritySupport: false,
  region: 'eu',
  priceByRegion: { 'eu-price': 8, 'us-price': 10 },
};

const contractC = () => ({
  planId: 'growth',
  addOns: {
    extraStorage: { selected: true, quantity: 2 },
    prioritySuccess: { selected: true, quantity: 1 },
  },
});

function currentOf(
  pricing: NormalizedPricing,
  extra: Partial<PricingSelection> = {},
): PricingSelection {
  return { ...createDefaultSelection(pricing), ...extra };
}

describe('applySelectionInput', () => {
  // [utest->req~apply-input-result~1]
  it('returns the selection, removed ids and diagnostics for the Delivera contract', () => {
    expect(typeof applySelectionInput).toBe('function');
    const result = applySelectionInput(acme, acmeDefaults, contractC());
    expect(result.selection).toEqual({
      planId: 'growth',
      billingPeriod: 'monthly',
      variables: defaultVariables,
      addOns: {
        extraStorage: { selected: true, quantity: 2 },
        prioritySuccess: { selected: true, quantity: 1 },
      },
    });
    expect(result.removedAddOnIds).toEqual([]);
    expect(result.diagnostics).toEqual([]);
    expect(resolvePricing(acme, result.selection).subtotal).toBe(80);
  });

  // [utest->req~apply-input-internal~1]
  it('is not exported from the core entry point', () => {
    expect(Object.keys(core)).not.toContain('applySelectionInput');
    expect(typeof applySelectionInput).toBe('function');
  });

  // [utest->req~apply-input-unknown-plan~1]
  it('keeps the current plan when the input plan is unknown', () => {
    const result = applySelectionInput(acme, currentOf(acme, { planId: 'growth' }), {
      planId: 'legacy',
    });
    expect(result.selection.planId).toBe('growth');
  });

  // [utest->req~apply-input-unknown-plan~1]
  it('compares plan ids with case sensitivity', () => {
    const result = applySelectionInput(acme, acmeDefaults, { planId: 'Growth' });
    expect(result.selection.planId).toBe('starter');
  });

  // [utest->req~apply-input-unknown-billing~1]
  it('keeps the current billing period when the input period is unknown (acme)', () => {
    const result = applySelectionInput(acme, currentOf(acme, { billingPeriod: 'yearly' }), {
      planId: 'growth',
      billingPeriod: 'quarterly',
    });
    expect(result.selection.billingPeriod).toBe('yearly');
    expect(result.selection.planId).toBe('growth');
  });

  // [utest->req~apply-input-unknown-billing~1]
  it('keeps the base billing period on a pricing without billing (Slack)', () => {
    const result = applySelectionInput(slack, slackDefaults, {
      planId: 'PRO',
      billingPeriod: 'monthly',
    });
    expect(result.selection.billingPeriod).toBe('base');
    expect(result.selection.planId).toBe('PRO');
  });

  const ghostInput = () => ({
    planId: 'growth',
    addOns: {
      ghost: { selected: true, quantity: 1 },
      extraStorage: { selected: true, quantity: 2 },
      phantom: { selected: false, quantity: 3 },
    },
  });

  // [utest->req~apply-input-unknown-addons~1]
  it('leaves unknown add-on ids out of the selection', () => {
    const result = applySelectionInput(acme, acmeDefaults, ghostInput());
    expect(result.selection.addOns).toEqual({ extraStorage: { selected: true, quantity: 2 } });
  });

  // [utest->req~apply-input-warnings~1]
  it('warns about an unknown plan', () => {
    const result = applySelectionInput(acme, currentOf(acme, { planId: 'growth' }), {
      planId: 'legacy',
    });
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({
      code: 'PR_SELECTION_UNKNOWN_PLAN',
      severity: 'warning',
      path: 'selection.planId',
    });
    expect(result.diagnostics[0]?.message).toEqual(expect.any(String));
    expect(result.diagnostics[0]?.message).not.toBe('');
  });

  // [utest->req~apply-input-warnings~1]
  it('warns about an unknown billing period', () => {
    const result = applySelectionInput(acme, currentOf(acme, { billingPeriod: 'yearly' }), {
      planId: 'growth',
      billingPeriod: 'quarterly',
    });
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({
      code: 'PR_SELECTION_UNKNOWN_BILLING_PERIOD',
      severity: 'warning',
      path: 'selection.billingPeriod',
    });
  });

  // [utest->req~apply-input-warnings~1]
  it('warns about unknown add-ons in the key order of the input', () => {
    const result = applySelectionInput(acme, acmeDefaults, ghostInput());
    expect(result.diagnostics).toHaveLength(2);
    expect(result.diagnostics[0]).toMatchObject({
      code: 'PR_SELECTION_UNKNOWN_ADDON',
      severity: 'warning',
      path: 'selection.addOns.ghost',
    });
    expect(result.diagnostics[1]).toMatchObject({
      code: 'PR_SELECTION_UNKNOWN_ADDON',
      severity: 'warning',
      path: 'selection.addOns.phantom',
    });
  });

  // [utest->req~apply-input-warnings~1]
  it('reports no diagnostics for valid or omitted fields', () => {
    expect(applySelectionInput(acme, acmeDefaults, {}).diagnostics).toEqual([]);
    expect(applySelectionInput(acme, acmeDefaults, contractC()).diagnostics).toEqual([]);
  });

  // [utest->req~apply-input-quantities~1]
  it('normalizes the quantity of selected add-ons (above maximum, zero, NaN)', () => {
    const quantities = [25, 0, Number.NaN].map(
      (quantity) =>
        applySelectionInput(acme, acmeDefaults, {
          planId: 'growth',
          addOns: { extraStorage: { selected: true, quantity } },
        }).selection.addOns.extraStorage?.quantity,
    );
    expect(quantities).toEqual([10, 1, 1]);
  });

  // [utest->req~apply-input-quantities~1]
  it('keeps the input quantity of an unselected entry', () => {
    const result = applySelectionInput(acme, acmeDefaults, {
      planId: 'growth',
      addOns: { extraStorage: { selected: false, quantity: 25 } },
    });
    expect(result.selection.addOns.extraStorage).toEqual({ selected: false, quantity: 25 });
  });

  // [utest->req~apply-input-quantities~1]
  it('applies no maximum when the add-on has none (Slack)', () => {
    const result = applySelectionInput(slack, slackDefaults, {
      planId: 'PRO',
      addOns: { premiumWorkflowOverageCost: { selected: true, quantity: 1000 } },
    });
    expect(result.selection.addOns.premiumWorkflowOverageCost).toEqual({
      selected: true,
      quantity: 1000,
    });
  });

  // [utest->req~apply-input-merge-defaults~1]
  it('takes the schema defaults for omitted fields, not the current selection', () => {
    const current = currentOf(acme, {
      planId: 'growth',
      billingPeriod: 'yearly',
      addOns: { extraStorage: { selected: true, quantity: 1 } },
    });
    const result = applySelectionInput(acme, current, {});
    expect(result.selection).toEqual(acmeDefaults);
    expect(result.selection).toEqual({
      planId: 'starter',
      billingPeriod: 'monthly',
      variables: defaultVariables,
      addOns: {},
    });
  });

  // [utest->req~apply-input-merge-defaults~1]
  it('drops explicit undefined fields', () => {
    const result = applySelectionInput(acme, currentOf(acme, { planId: 'growth' }), {
      planId: undefined,
      billingPeriod: 'yearly',
    });
    expect(result.selection.planId).toBe('starter');
    expect(result.selection.billingPeriod).toBe('yearly');
    expect(result.diagnostics).toEqual([]);
  });

  // [utest->req~apply-input-merge-defaults~1]
  it('merges variables without validating them', () => {
    const result = applySelectionInput(acme, acmeDefaults, {
      planId: 'starter',
      variables: { seats: 12, region: 'mars' },
    });
    expect(result.selection.variables).toEqual({
      seats: 12,
      prioritySupport: false,
      region: 'mars',
      priceByRegion: { 'eu-price': 8, 'us-price': 10 },
    });
    expect(result.diagnostics).toEqual([]);
    expect(resolvePricing(acme, result.selection).subtotal).toBe(48);
  });

  // [utest->req~apply-input-merge-defaults~1]
  it('replaces the current add-ons', () => {
    const current = currentOf(acme, {
      planId: 'growth',
      addOns: { extraStorage: { selected: true, quantity: 1 } },
    });
    const result = applySelectionInput(acme, current, { planId: 'growth' });
    expect(result.selection.addOns).toEqual({});
  });

  // [utest->req~apply-input-reconcile~1]
  it('reconciles Starter with extraStorage on acme', () => {
    const result = applySelectionInput(acme, acmeDefaults, {
      planId: 'starter',
      addOns: { extraStorage: { selected: true, quantity: 2 } },
    });
    expect(result.selection.addOns.extraStorage).toEqual({ selected: false, quantity: 2 });
    expect(result.removedAddOnIds).toEqual(['extraStorage']);
    expect(resolvePricing(acme, result.selection).subtotal).toBe(20);
  });

  // [utest->req~apply-input-reconcile~1]
  it('removes the Business+ add-on on Slack PRO and keeps the overage add-on', () => {
    const result = applySelectionInput(slack, slackDefaults, {
      planId: 'PRO',
      addOns: {
        premiumWorkflowOverageCost: { selected: true, quantity: 1000 },
        slackAtlas: { selected: true, quantity: 1 },
      },
    });
    expect(result.removedAddOnIds).toEqual(['slackAtlas']);
    expect(result.selection.addOns.slackAtlas).toEqual({ selected: false, quantity: 1 });
    expect(result.selection.addOns.premiumWorkflowOverageCost).toEqual({
      selected: true,
      quantity: 1000,
    });
    const resolved = resolvePricing(slack, result.selection);
    expect(resolved.subtotal).toBe(58.75);
    expect(resolved.requiresQuote).toBe(false);
  });

  // [utest->req~apply-input-reconcile~1]
  it('drops the overage add-on on Slack FREE', () => {
    const result = applySelectionInput(slack, slackDefaults, {
      planId: 'FREE',
      addOns: { premiumWorkflowOverageCost: { selected: true, quantity: 1000 } },
    });
    expect(result.removedAddOnIds).toEqual(['premiumWorkflowOverageCost']);
    expect(resolvePricing(slack, result.selection).subtotal).toBe(0);
  });

  // [utest->req~apply-input-removed-diagnostics~1]
  it('reports each removed add-on as an info diagnostic in removal order', () => {
    const result = applySelectionInput(acme, acmeDefaults, {
      planId: 'starter',
      addOns: {
        prioritySuccess: { selected: true, quantity: 1 },
        extraStorage: { selected: true, quantity: 2 },
      },
    });
    expect(result.removedAddOnIds).toEqual(['extraStorage', 'prioritySuccess']);
    expect(result.diagnostics).toHaveLength(2);
    expect(result.diagnostics[0]).toMatchObject({
      code: 'PR_SELECTION_ADDON_REMOVED',
      severity: 'info',
      path: 'selection.addOns.extraStorage',
      details: { addOnId: 'extraStorage' },
    });
    expect(result.diagnostics[1]).toMatchObject({
      code: 'PR_SELECTION_ADDON_REMOVED',
      severity: 'info',
      path: 'selection.addOns.prioritySuccess',
      details: { addOnId: 'prioritySuccess' },
    });
  });

  const everyStepInput = () => ({
    planId: 'legacy',
    billingPeriod: 'weekly',
    addOns: {
      ghost: { selected: true, quantity: 1 },
      extraStorage: { selected: true, quantity: 2 },
    },
  });

  // [utest->req~apply-input-diagnostic-order~1]
  it('orders warnings by step before the removal diagnostics', () => {
    const result = applySelectionInput(acme, acmeDefaults, everyStepInput());
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      'PR_SELECTION_UNKNOWN_PLAN',
      'PR_SELECTION_UNKNOWN_BILLING_PERIOD',
      'PR_SELECTION_UNKNOWN_ADDON',
      'PR_SELECTION_ADDON_REMOVED',
    ]);
    expect(result.selection.planId).toBe('starter');
    expect(result.selection.billingPeriod).toBe('monthly');
    expect(resolvePricing(acme, result.selection).subtotal).toBe(20);
  });

  // [utest->req~apply-input-no-mutation~1]
  it('does not mutate pricing, current or input', () => {
    const current = currentOf(acme, { planId: 'growth' });
    const input = everyStepInput();
    const pricingCopy = structuredClone(acme);
    const currentCopy = structuredClone(current);
    const inputCopy = structuredClone(input);
    applySelectionInput(acme, current, input);
    expect(acme).toEqual(pricingCopy);
    expect(current).toEqual(currentCopy);
    expect(input).toEqual(inputCopy);
  });
});
