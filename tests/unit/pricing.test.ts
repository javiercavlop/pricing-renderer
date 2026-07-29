import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createPricingViewModel, normalizePricing, resolvePricing } from '../../src/core/index.js';
import { parsePricingYaml } from '../../src/yaml/index.js';

const fixtureUrl = new URL('../fixtures/acme-pricing.yml', import.meta.url);

describe('Pricing2Yaml normalization and resolution', () => {
  it('parses a complete 3.1 pricing without losing expressions or metadata', async () => {
    const yaml = await readFile(fileURLToPath(fixtureUrl), 'utf8');
    const result = parsePricingYaml(yaml);
    expect(result.ok).toBe(true);
    expect(result.value?.metadata.saasName).toBe('Acme Cloud');
    expect(result.value?.plans[0]?.price.kind).toBe('expression');
    expect(result.value?.addOns[0]?.subscriptionConstraints).toEqual({
      minQuantity: 1,
      maxQuantity: 10,
      quantityStep: 1,
    });
    expect(result.value?.plans[2]?.usageLimits.storage).toEqual({
      value: Number.POSITIVE_INFINITY,
    });
  });

  it('resolves variables, billing and selected add-on quantities in order', async () => {
    const result = parsePricingYaml(await readFile(fileURLToPath(fixtureUrl), 'utf8'));
    const pricing = result.value!;
    const resolved = resolvePricing(pricing, {
      planId: 'growth',
      billingPeriod: 'yearly',
      variables: { ...pricing.variables, seats: 10, prioritySupport: true },
      addOns: { extraStorage: { selected: true, quantity: 3 } },
    });
    expect(resolved.planPrices.growth).toMatchObject({ kind: 'amount', amount: 96 });
    expect(resolved.addOnPrices.extraStorage).toMatchObject({ kind: 'amount', amount: 12 });
    expect(resolved.subtotal).toBe(108);
    expect(resolved.requiresQuote).toBe(false);
  });

  it('marks totals containing text prices as requiring a quote', async () => {
    const pricing = parsePricingYaml(await readFile(fileURLToPath(fixtureUrl), 'utf8')).value!;
    const resolved = resolvePricing(pricing, {
      planId: 'enterprise',
      variables: pricing.variables,
      addOns: { compliance: { selected: true, quantity: 1 } },
    });
    expect(resolved.subtotal).toBe(40);
    expect(resolved.requiresQuote).toBe(true);
  });

  it('creates configured controls, cards and grouped comparison rows', async () => {
    const pricing = parsePricingYaml(await readFile(fileURLToPath(fixtureUrl), 'utf8')).value!;
    const viewModel = createPricingViewModel(pricing);
    expect(viewModel.presentation.recommendedPlanId).toBe('growth');
    expect(viewModel.variableControls.map((control) => control.path)).toEqual([
      'seats',
      'prioritySupport',
      'region',
    ]);
    expect(viewModel.comparisonGroups.map((group) => group.name)).toEqual([
      'Workspace',
      'Security',
      'Usage',
    ]);
  });

  it('warns for compatible 3.x versions and blocks other majors', () => {
    const compatible = normalizePricing({
      syntaxVersion: '3.2',
      saasName: 'Future',
      plans: {},
    });
    expect(compatible.value).toBeTruthy();
    expect(compatible.diagnostics.some((item) => item.code === 'PR_VERSION_BEST_EFFORT')).toBe(
      true,
    );

    const unsupported = normalizePricing({
      syntaxVersion: '4.0',
      saasName: 'Future',
      plans: {},
    });
    expect(unsupported.ok).toBe(false);
    expect(unsupported.value).toBeUndefined();
  });

  it('preserves zero and false plan values instead of replacing them with defaults', () => {
    const result = normalizePricing({
      syntaxVersion: '3.1',
      saasName: 'Falsy values',
      features: {
        enabled: { defaultValue: true },
        allowance: { defaultValue: 10 },
      },
      plans: {
        free: {
          price: 0,
          features: {
            enabled: { value: false },
            allowance: { value: 0 },
          },
        },
      },
    });
    const rows = createPricingViewModel(result.value!).comparisonGroups.flatMap(
      (group) => group.rows,
    );
    expect(rows.find((row) => row.id === 'enabled')?.values[0]?.value).toBe(false);
    expect(rows.find((row) => row.id === 'allowance')?.values[0]?.value).toBe(0);
  });
});
