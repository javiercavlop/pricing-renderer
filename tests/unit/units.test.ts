import { describe, expect, it } from 'vitest';
import { formatUnit } from '../../src/core/units.js';

// unit -> result for a count other than one
const english: Record<string, string> = {
  unit: 'units',
  execution: 'executions',
  GB: 'GB',
  'user/month': 'user/month',
  credit: 'credits',
  credits: 'credits',
  box: 'boxes',
  day: 'days',
  license: 'licenses',
  batch: 'batches',
  dish: 'dishes',
};

describe('formatUnit', () => {
  for (const [unit, plural] of Object.entries(english)) {
    it(`en: ${unit}`, () => {
      expect(formatUnit(unit, 1, 'en')).toBe(unit);
      expect(formatUnit(unit, 0, 'en')).toBe(plural);
      expect(formatUnit(unit, 2, 'en')).toBe(plural);
      expect(formatUnit(unit, 1.5, 'en')).toBe(plural);
    });
  }

  it('handles y, z and multi-word edge cases', () => {
    expect(formatUnit('city', 2, 'en-US')).toBe('cities');
    expect(formatUnit('quiz', 2, 'en')).toBe('quizes');
    expect(formatUnit('api call', 2, 'en')).toBe('api call');
  });

  it('pluralizes negative counts but keeps -1 singular', () => {
    expect(formatUnit('credit', -2, 'en')).toBe('credits');
    expect(formatUnit('credit', -1, 'en')).toBe('credit');
  });

  it('never changes the unit for a locale whose base language is not English', () => {
    for (const locale of ['es', 'es-ES', 'es_ES', 'fr', 'de-DE']) {
      for (const unit of ['unit', 'execution', 'credit', 'day', 'luz', 'licencia']) {
        expect(formatUnit(unit, 2, locale)).toBe(unit);
      }
    }
  });

  it('accepts hyphen and underscore separators', () => {
    expect(formatUnit('seat', 2, 'en_US')).toBe('seats');
    expect(formatUnit('seat', 2, 'EN-gb')).toBe('seats');
  });

  it('leaves the unit unchanged for an invalid locale', () => {
    expect(formatUnit('seat', 2, 'not a locale')).toBe('seat');
    expect(formatUnit('seat', 2, '')).toBe('seat');
  });
});
