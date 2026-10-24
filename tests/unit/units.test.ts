import { describe, expect, it } from 'vitest';
import { formatUnit } from '../../src/core/index.js';

// unit -> [singular result, plural result]
const english: Record<string, string> = {
  unit: 'units',
  execution: 'executions',
  GB: 'GB',
  'user/month': 'user/month',
  credit: 'credits',
  box: 'boxes',
  day: 'days',
  license: 'licenses',
};

const spanish: Record<string, string> = {
  unit: 'unites',
  execution: 'executiones',
  GB: 'GB',
  'user/month': 'user/month',
  credit: 'credites',
  box: 'boxes',
  day: 'dayes',
  license: 'licenses',
};

describe('formatUnit', () => {
  for (const [locale, table] of [
    ['en', english],
    ['es', spanish],
  ] as const) {
    for (const [unit, plural] of Object.entries(table)) {
      it(`${locale}: ${unit}`, () => {
        expect(formatUnit(unit, 1, locale)).toBe(unit);
        expect(formatUnit(unit, 0, locale)).toBe(plural);
        expect(formatUnit(unit, 2, locale)).toBe(plural);
        expect(formatUnit(unit, 1.5, locale)).toBe(plural);
      });
    }
  }

  it('handles y, z and multi-word edge cases', () => {
    expect(formatUnit('city', 2, 'en-US')).toBe('cities');
    expect(formatUnit('quiz', 2, 'en')).toBe('quizes');
    expect(formatUnit('luz', 2, 'es-ES')).toBe('luces');
    expect(formatUnit('api call', 2, 'en')).toBe('api call');
    expect(formatUnit('seat', 2, 'fr')).toBe('seat');
  });
});
