import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import * as core from '../../src/core/index.js';
import { createDefaultSelection, resolvePricing } from '../../src/core/index.js';
import type { NormalizedPricing } from '../../src/core/index.js';
import * as element from '../../src/element/index.js';
import * as react from '../../src/react/index.js';
import * as yaml from '../../src/yaml/index.js';
import { applySelectionInput } from '../../src/core/apply-selection.js';
import { parsePricingYaml } from '../../src/yaml/index.js';
import { selectionFromContract } from '../../examples/space-contract/map-contract.js';

let acme: NormalizedPricing;

beforeAll(async () => {
  const url = new URL('../fixtures/acme-pricing.yml', import.meta.url);
  acme = parsePricingYaml(await readFile(fileURLToPath(url), 'utf8')).value!;
});

const deliveraContract = () => ({
  subscriptionPlans: { acme: 'growth' },
  subscriptionAddOns: { acme: { extraStorage: 2, prioritySuccess: 1 } },
});

const twoServices = () => ({
  subscriptionPlans: { acme: 'growth', mail: 'pro' },
  subscriptionAddOns: { acme: { extraStorage: 2 }, mail: { archive: 1 } },
});

const invalidQuantities = () => ({
  subscriptionPlans: { acme: 'growth' },
  subscriptionAddOns: {
    acme: {
      extraStorage: 0,
      prioritySuccess: Number.NaN,
      compliance: Number.POSITIVE_INFINITY,
      backup: -1,
    },
  },
});

const addOnsOnly = () => ({ subscriptionAddOns: { acme: { extraStorage: 3 } } });

describe('selectionFromContract', () => {
  // [utest->req~space-map-plan~1]
  it('maps the plan name of the service', () => {
    expect(selectionFromContract({ subscriptionPlans: { acme: 'growth' } }, 'acme')).toEqual({
      planId: 'growth',
    });
  });

  // [utest->req~space-map-addons~1]
  it('maps the add-on quantities of the Delivera contract', () => {
    const result = selectionFromContract(deliveraContract(), 'acme');
    expect(result).toEqual({
      planId: 'growth',
      addOns: {
        extraStorage: { selected: true, quantity: 2 },
        prioritySuccess: { selected: true, quantity: 1 },
      },
    });
    const applied = applySelectionInput(acme, createDefaultSelection(acme), result);
    expect(resolvePricing(acme, applied.selection).subtotal).toBe(80);
  });

  // [utest->req~space-map-service-only~1]
  it('ignores the entries of other services', () => {
    expect(selectionFromContract(twoServices(), 'acme')).toEqual({
      planId: 'growth',
      addOns: { extraStorage: { selected: true, quantity: 2 } },
    });
  });

  // [utest->req~space-map-missing-service~1]
  it('returns an empty object when the service has no entry', () => {
    expect(selectionFromContract({}, 'acme')).toEqual({});
    expect(
      selectionFromContract(
        { subscriptionPlans: { mail: 'pro' }, subscriptionAddOns: { mail: { archive: 1 } } },
        'acme',
      ),
    ).toEqual({});
  });

  // [utest->req~space-map-invalid-quantity~1]
  it('omits zero, negative and non-finite quantities', () => {
    expect(selectionFromContract(invalidQuantities(), 'acme')).toEqual({ planId: 'growth' });
  });

  // [utest->req~space-map-addons-only~1]
  it('maps add-ons without a plan and without a planId key', () => {
    const result = selectionFromContract(addOnsOnly(), 'acme');
    expect(result).toEqual({ addOns: { extraStorage: { selected: true, quantity: 3 } } });
    expect(Object.prototype.hasOwnProperty.call(result, 'planId')).toBe(false);
  });

  // [utest->req~space-map-result-keys~1]
  it('returns only planId and addOns keys', () => {
    expect(Object.keys(selectionFromContract(deliveraContract(), 'acme'))).toEqual([
      'planId',
      'addOns',
    ]);
    expect(Object.keys(selectionFromContract(invalidQuantities(), 'acme'))).toEqual(['planId']);
    expect(Object.keys(selectionFromContract(addOnsOnly(), 'acme'))).toEqual(['addOns']);
  });

  // [utest->req~space-map-no-mutation~1]
  it('does not mutate the contract', () => {
    const contract = twoServices();
    const copy = structuredClone(contract);
    const result = selectionFromContract(contract, 'acme');
    for (const entry of Object.values(result.addOns ?? {})) {
      entry.quantity = 99;
      entry.selected = false;
    }
    expect(contract).toEqual(copy);
  });

  // [utest->req~space-map-not-exported~1]
  it('is not exported from any package entry point', () => {
    expect(typeof selectionFromContract).toBe('function');
    for (const entryPoint of [core, yaml, element, react]) {
      expect(Object.keys(entryPoint)).not.toContain('selectionFromContract');
    }
  });
});
