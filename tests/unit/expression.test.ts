import { describe, expect, it } from 'vitest';
import { collectExpressionDependencies, evaluatePriceExpression } from '../../src/core/index.js';

describe('safe price expression evaluator', () => {
  it.each([
    ['5 * #x', { x: 4 }, 20],
    ['#vip ? #x : 0.0', { vip: true, x: 12 }, 12],
    ['#test[0] ? #value[0] : #value[1]', { test: [false], value: [4, 9] }, 9],
    ['#test.nested ? 5 : 0.0', { test: { nested: true } }, 5],
    ['Math.floor(#x / 5) < 1 ? #x * 10 : 100.0', { x: 3 }, 30],
    [
      "5 * #priceByRegion[#region.concat('-price')]",
      { priceByRegion: { 'eu-price': 8 }, region: 'eu' },
      40,
    ],
  ])('evaluates %s', (source, variables, expected) => {
    expect(evaluatePriceExpression(source, variables)).toEqual({ value: expected });
  });

  it('collects unique variable dependencies', () => {
    expect(collectExpressionDependencies('#seats * #price + #seats')).toEqual(['seats', 'price']);
  });

  it.each([
    'globalThis.process',
    '#value.constructor.constructor("return 1")()',
    'Math.random()',
    'new Date()',
    'this.alert(1)',
    '#value.__proto__',
    '(() => 1)()',
  ])('rejects unsafe source %s', (source) => {
    expect(evaluatePriceExpression(source, { value: {} }).error).toBeTruthy();
  });

  it('rejects missing variables, infinity and negative results', () => {
    expect(evaluatePriceExpression('#missing', {}).error).toContain('not defined');
    expect(evaluatePriceExpression('1 / 0', {}).error).toContain('finite');
    expect(evaluatePriceExpression('-1', {}).error).toContain('non-negative');
  });
});
