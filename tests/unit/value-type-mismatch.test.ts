import { describe, expect, it } from 'vitest';
import { normalizePricing } from '../../src/core/index.js';
import type { IPricingLike } from '../../src/core/index.js';
import { parsePricingYaml } from '../../src/yaml/index.js';

function mismatches(pricing: IPricingLike) {
  const result = normalizePricing(pricing);
  return {
    result,
    found: result.diagnostics.filter((item) => item.code === 'PR_VALUE_TYPE_MISMATCH'),
  };
}

const base = { syntaxVersion: '3.1', saasName: 'Values' } as const;

// [utest->req~value-type-mismatch-diagnostic~1]
describe('NUMERIC value given as text', () => {
  it('warns for a default value and a plan override with the digit separator hint', () => {
    const parsed = parsePricingYaml(`
syntaxVersion: "3.1"
saasName: Values
usageLimits:
  powerUpsLimit:
    valueType: NUMERIC
    defaultValue: 10_000
plans:
  FREE:
    price: 0
    usageLimits:
      powerUpsLimit: '10_000'
`);
    const found = parsed.diagnostics.filter((item) => item.code === 'PR_VALUE_TYPE_MISMATCH');
    expect(found.map((item) => item.path)).toEqual([
      'usageLimits.powerUpsLimit.defaultValue',
      'plans.FREE.usageLimits.powerUpsLimit',
    ]);
    for (const item of found) {
      expect(item.severity).toBe('warning');
      expect(item.message).toContain('YAML 1.1');
      expect(item.message).toContain('digit separators');
      expect(item.message).toContain('.inf');
    }
    expect(parsed.value?.usageLimits[0]?.defaultValue).toBe('10_000');
    expect(parsed.value?.plans[0]?.usageLimits.powerUpsLimit).toBe('10_000');
  });

  it('warns for a wrapped value without the hint, at the override key', () => {
    const { found, result } = mismatches({
      ...base,
      features: { seats: { valueType: 'NUMERIC', defaultValue: 1 } },
      plans: { PRO: { price: 1, features: { seats: { value: 'many' } } } },
    });
    expect(found).toHaveLength(1);
    expect(found[0]?.path).toBe('plans.PRO.features.seats');
    expect(found[0]?.severity).toBe('warning');
    expect(found[0]?.message).not.toContain('YAML 1.1');
    expect(result.value?.plans[0]?.features.seats).toEqual({ value: 'many' });
  });

  it('warns for add-on features, usage limits and usage limit extensions', () => {
    const { found } = mismatches({
      ...base,
      features: { seats: { valueType: 'NUMERIC', defaultValue: 1 } },
      usageLimits: { calls: { valueType: 'NUMERIC', defaultValue: 1 } },
      plans: { PRO: { price: 1 } },
      addOns: {
        extra: {
          price: 1,
          features: { seats: '5' },
          usageLimits: { calls: { value: '1_000' } },
          usageLimitsExtensions: { calls: '2_000' },
        },
      },
    });
    expect(found.map((item) => item.path)).toEqual([
      'addOns.extra.features.seats',
      'addOns.extra.usageLimits.calls',
      'addOns.extra.usageLimitsExtensions.calls',
    ]);
    expect(found[0]?.message).not.toContain('YAML 1.1');
    expect(found[1]?.message).toContain('YAML 1.1');
    expect(found[2]?.message).toContain('YAML 1.1');
  });

  it('does not warn for numbers, .inf, booleans, TEXT values or untyped ids', () => {
    const { found } = mismatches({
      ...base,
      features: {
        note: { valueType: 'TEXT', defaultValue: 'abc' },
        flag: { valueType: 'BOOLEAN', defaultValue: false },
      },
      usageLimits: {
        calls: { valueType: 'NUMERIC', defaultValue: 10000 },
        unlimited: { valueType: 'NUMERIC', defaultValue: Infinity },
      },
      plans: {
        PRO: {
          price: 1,
          features: { note: 'xyz', flag: true, unknown: 'text' },
          usageLimits: { calls: 5, unlimited: { value: Infinity } },
        },
      },
    });
    expect(found).toEqual([]);
  });
});
