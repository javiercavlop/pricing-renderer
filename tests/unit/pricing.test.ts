import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  configurePricingRenderer,
  createPricingViewModel,
  DEFAULT_PRICING_RENDERER_CONFIG,
  getPricingRendererConfig,
  getMessages,
  normalizePricing,
  registerMessageCatalog,
  resolvePricing,
} from '../../src/core/index.js';
import { parsePricingYaml } from '../../src/yaml/index.js';

const fixtureUrl = new URL('../fixtures/acme-pricing.yml', import.meta.url);

describe('library initialization configuration', () => {
  it('defaults to English and the conventional /pricing application path', () => {
    configurePricingRenderer();
    expect(getPricingRendererConfig()).toEqual({
      locale: 'en-US',
      pricingPath: '/pricing',
      selectionEnabled: true,
      ctaEnabled: true,
      variablesEnabled: true,
    });
    expect(DEFAULT_PRICING_RENDERER_CONFIG).toEqual({
      locale: 'en-US',
      pricingPath: '/pricing',
      selectionEnabled: true,
      ctaEnabled: true,
      variablesEnabled: true,
    });
  });

  it('canonicalizes configurable locale and pricing path values', () => {
    try {
      expect(
        configurePricingRenderer({
          locale: 'es-es',
          pricingPath: '/planes/precios/',
          selectionEnabled: false,
          ctaEnabled: false,
          variablesEnabled: false,
        }),
      ).toEqual({
        locale: 'es-ES',
        pricingPath: '/planes/precios',
        selectionEnabled: false,
        ctaEnabled: false,
        variablesEnabled: false,
      });
      expect(() => configurePricingRenderer({ pricingPath: 'pricing' })).toThrow(
        'absolute application pathname',
      );
      expect(() => configurePricingRenderer({ ctaEnabled: 'yes' as unknown as boolean })).toThrow(
        'ctaEnabled must be a boolean',
      );
    } finally {
      configurePricingRenderer();
    }
  });
});

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
    const storage = viewModel.comparisonGroups
      .flatMap((group) => group.rows)
      .find((row) => row.id === 'storage');
    expect(storage?.values.find((cell) => cell.planId === 'enterprise')?.value).toBe(
      Number.POSITIVE_INFINITY,
    );
    expect(viewModel.messages['pricing.unlimited']).toBe('Unlimited');
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

  it('adapts future syntax versions through an explicit, isolated adapter', () => {
    const result = normalizePricing(
      {
        syntaxVersion: '4.0',
        saasName: 'Future',
        offers: { starter: { price: 10 } },
      },
      {
        syntaxAdapters: [
          {
            id: 'pricing4-preview',
            supports: (version) => version === '4.0',
            adapt: (pricing) => ({
              ...pricing,
              syntaxVersion: '3.1',
              plans: pricing.offers,
            }),
          },
        ],
      },
    );
    expect(result.ok).toBe(true);
    expect(result.value?.metadata.syntaxVersion).toBe('4.0');
    expect(result.value?.plans[0]?.id).toBe('starter');
    expect(result.diagnostics[0]?.code).toBe('PR_VERSION_ADAPTED');
  });

  it('composes syntax adapters without re-running the same adapter', () => {
    const result = normalizePricing(
      {
        syntaxVersion: '5.0',
        saasName: 'Future',
        offers: { starter: { amount: 10 } },
      },
      {
        syntaxAdapters: [
          {
            id: 'v5-to-v4',
            supports: (version) => version === '5.0',
            adapt: (pricing) => ({ ...pricing, syntaxVersion: '4.0' }),
          },
          {
            id: 'v4-to-v3',
            supports: (version) => version === '4.0',
            adapt: (pricing) => ({
              ...pricing,
              syntaxVersion: '3.1',
              plans: {
                starter: {
                  price: (pricing.offers as { starter: { amount: number } }).starter.amount,
                },
              },
            }),
          },
        ],
      },
    );
    expect(result.ok).toBe(true);
    expect(result.value?.metadata.syntaxVersion).toBe('5.0');
    expect(result.value?.plans[0]?.price).toEqual({ kind: 'fixed', amount: 10 });
    expect(result.diagnostics.map((item) => item.code)).toEqual([
      'PR_VERSION_ADAPTED',
      'PR_VERSION_ADAPTED',
    ]);
  });

  it('registers additional locales without changing component source data', () => {
    const unregister = registerMessageCatalog('fr-FR', {
      'pricing.title': 'Tarifs',
    });
    expect(getMessages('fr-CA')['pricing.title']).toBe('Tarifs');
    unregister();
    expect(getMessages('fr-CA')['pricing.title']).toBe('Pricing');
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
