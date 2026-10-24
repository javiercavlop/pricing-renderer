import { describe, expect, it } from 'vitest';
import { enUS, esES, getMessages, translate } from '../../src/core/index.js';

const formula = '{unitPrice} × {quantity} × {multiplier} = {amount}';
const parameters = { unitPrice: '€45', quantity: 1, multiplier: 0.8, amount: '€36' };

describe('breakdown message keys', () => {
  // [utest->req~breakdown-i18n-keys~1]
  it('defines the three keys with the English texts in enUS', () => {
    expect(enUS['pricing.breakdownToggle']).toBe('How is this calculated?');
    expect(enUS['pricing.breakdownTitle']).toBe('Price breakdown');
    expect(enUS['pricing.breakdownFormula']).toBe(formula);
  });

  // [utest->req~breakdown-i18n-keys~1]
  it('defines the three keys with the Spanish texts in esES', () => {
    expect(esES['pricing.breakdownToggle']).toBe('¿Cómo se calcula?');
    expect(esES['pricing.breakdownTitle']).toBe('Desglose del precio');
    expect(esES['pricing.breakdownFormula']).toBe(formula);
  });

  // [utest->req~breakdown-i18n-keys~1]
  it('translates the texts through getMessages and translate in en-US', () => {
    const messages = getMessages('en-US');
    expect(translate(messages, 'pricing.breakdownToggle')).toBe('How is this calculated?');
    expect(translate(messages, 'pricing.breakdownTitle')).toBe('Price breakdown');
    const text = translate(messages, 'pricing.breakdownFormula', parameters);
    expect(text).toBe('€45 × 1 × 0.8 = €36');
  });

  // [utest->req~breakdown-i18n-keys~1]
  it('translates the texts through getMessages and translate in es-ES', () => {
    const messages = getMessages('es-ES');
    expect(translate(messages, 'pricing.breakdownToggle')).toBe('¿Cómo se calcula?');
    expect(translate(messages, 'pricing.breakdownTitle')).toBe('Desglose del precio');
    const text = translate(messages, 'pricing.breakdownFormula', parameters);
    expect(text).toBe('€45 × 1 × 0.8 = €36');
  });

  // [utest->req~breakdown-i18n-keys~1]
  it('fills the four formula placeholders and leaves none behind', () => {
    const other = { unitPrice: '$1.5', quantity: 3, multiplier: 1, amount: '$4.5' };
    for (const catalog of [enUS, esES]) {
      expect(translate(catalog, 'pricing.breakdownFormula', other)).toBe('$1.5 × 3 × 1 = $4.5');
    }
  });

  // [utest->req~breakdown-i18n-keys~1]
  it('falls back to the English texts for a locale without a catalog', () => {
    const messages = getMessages('fr-FR');
    expect(messages['pricing.breakdownToggle']).toBe('How is this calculated?');
    expect(messages['pricing.breakdownTitle']).toBe('Price breakdown');
  });
});
