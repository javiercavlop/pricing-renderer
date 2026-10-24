import { describe, expect, it } from 'vitest';
import { normalizePricing, resolvePricing } from '../../src/core/index.js';
import { maxQuantityOnGrid } from '../../src/core/resolve.js';

function pricingWith(constraints: Record<string, unknown>) {
  return normalizePricing({
    syntaxVersion: '3.1',
    saasName: 'Grid',
    version: '1',
    createdAt: '2026-01-01',
    currency: 'EUR',
    plans: { base: { price: 10 } },
    addOns: {
      seats: { price: 2, subscriptionConstraints: constraints },
    },
  }).value!;
}

function subtotalFor(constraints: Record<string, unknown>, quantity: number) {
  const pricing = pricingWith(constraints);
  return resolvePricing(pricing, {
    planId: 'base',
    addOns: { seats: { selected: true, quantity } },
  });
}

describe('add-on quantity grid', () => {
  it('clamps an over-maximum quantity to the largest valid grid value', () => {
    // min 1, step 5, max 8: valid quantities are 1 and 6
    const resolved = subtotalFor({ minQuantity: 1, quantityStep: 5, maxQuantity: 8 }, 9);
    expect(resolved.addOnPrices.seats).toMatchObject({ kind: 'amount', quantity: 6 });
    expect(resolved.subtotal).toBe(10 + 2 * 6);
  });

  it('keeps valid grid quantities and an exact maximum unchanged', () => {
    const constraints = { minQuantity: 1, quantityStep: 5, maxQuantity: 11 };
    expect(subtotalFor(constraints, 11).subtotal).toBe(10 + 2 * 11);
    expect(subtotalFor(constraints, 50).subtotal).toBe(10 + 2 * 11);
    expect(subtotalFor(constraints, 6).subtotal).toBe(10 + 2 * 6);
  });

  it('never bills an off-grid quantity', () => {
    const constraints = { minQuantity: 1, quantityStep: 5, maxQuantity: 8 };
    for (let quantity = -2; quantity <= 20; quantity += 1) {
      const billed = (subtotalFor(constraints, quantity).subtotal - 10) / 2;
      expect([1, 6]).toContain(billed);
    }
  });

  it('computes the largest valid quantity with one shared function', () => {
    expect(maxQuantityOnGrid({ minQuantity: 1, quantityStep: 5, maxQuantity: 8 })).toBe(6);
    expect(maxQuantityOnGrid({ minQuantity: 1, quantityStep: 5, maxQuantity: 11 })).toBe(11);
    expect(maxQuantityOnGrid({ minQuantity: 1, quantityStep: 5 })).toBeUndefined();
  });

  it('tolerates floating-point error with decimal steps', () => {
    const constraints = { minQuantity: 0, quantityStep: 0.1, maxQuantity: 0.3 };
    expect(maxQuantityOnGrid(constraints)).toBeCloseTo(0.3, 9);
    const resolved = subtotalFor(constraints, 0.3);
    expect(resolved.diagnostics.filter((d) => d.code === 'PR_ADDON_CONSTRAINTS_INVALID')).toEqual(
      [],
    );
  });

  it('does not warn when the maximum is an exact multiple of the step', () => {
    const resolved = subtotalFor({ minQuantity: 1, quantityStep: 5, maxQuantity: 11 }, 1);
    expect(resolved.diagnostics.filter((d) => d.code === 'PR_ADDON_CONSTRAINTS_INVALID')).toEqual(
      [],
    );
  });

  it('warns once per add-on when the maximum is not a multiple of the step', () => {
    const resolved = subtotalFor({ minQuantity: 1, quantityStep: 5, maxQuantity: 8 }, 9);
    const warnings = resolved.diagnostics.filter((d) => d.code === 'PR_ADDON_CONSTRAINTS_INVALID');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({
      severity: 'warning',
      path: 'addOns.seats.subscriptionConstraints',
    });
  });
});
