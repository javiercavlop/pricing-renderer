import { describe, expect, it } from 'vitest';
import { enUS, esES, getMessages, translate } from '../../src/core/index.js';

// The "Review" table of openspec/changes/add-subscription-change-flow/design.md, "i18n keys":
// 36 keys with an en-US and an es-ES text. The rendering of the texts is covered by
// tests/browser/change-review-ui.spec.ts.

const table: readonly (readonly [key: string, en: string, es: string])[] = [
  ['pricing.reviewTitle', 'Review your change', 'Revisa tu cambio'],
  ['pricing.reviewPlan', 'Plan', 'Plan'],
  ['pricing.reviewChangeArrow', '{before} → {after}', '{before} → {after}'],
  ['pricing.reviewRelationUpgrade', 'Upgrade', 'Mejora de plan'],
  ['pricing.reviewRelationDowngrade', 'Downgrade', 'Bajada de plan'],
  ['pricing.reviewRelationChange', 'Change', 'Cambio'],
  ['pricing.reviewRelationCurrent', 'No changes', 'Sin cambios'],
  [
    'pricing.reviewVersionChange',
    'Pricing version {before} → {after}',
    'Versión de precios {before} → {after}',
  ],
  ['pricing.reviewPrice', 'Price', 'Precio'],
  ['pricing.reviewPriceBefore', 'Current price', 'Precio actual'],
  ['pricing.reviewPriceAfter', 'New price', 'Precio nuevo'],
  ['pricing.reviewPriceDifference', 'Difference', 'Diferencia'],
  [
    'pricing.reviewDifferenceQuote',
    'The difference is not shown because part of the price requires a quote.',
    'No se muestra la diferencia porque parte del precio requiere presupuesto.',
  ],
  [
    'pricing.reviewDifferenceCurrency',
    'The difference is not shown because the currencies differ.',
    'No se muestra la diferencia porque las monedas son distintas.',
  ],
  [
    'pricing.reviewBillingChange',
    'Billing period {before} → {after}',
    'Periodo de facturación {before} → {after}',
  ],
  ['pricing.reviewAddOns', 'Add-ons', 'Complementos'],
  ['pricing.reviewAddOnAdded', 'Added', 'Se añade'],
  ['pricing.reviewAddOnRemoved', 'Removed', 'Se elimina'],
  ['pricing.reviewRemovedUnavailable', 'Not available with {plan}', 'No disponible con {plan}'],
  [
    'pricing.reviewRemovedDependency',
    'Requires an add-on that is removed',
    'Requiere un complemento que se elimina',
  ],
  [
    'pricing.reviewRemovedNotInVersion',
    'Not offered in the new pricing',
    'No se ofrece en los nuevos precios',
  ],
  ['pricing.reviewQuantityChange', 'Quantity {before} → {after}', 'Cantidad {before} → {after}'],
  ['pricing.reviewFeatures', 'Features', 'Características'],
  ['pricing.reviewFeatureGained', 'Gained', 'Se obtiene'],
  ['pricing.reviewFeatureLost', 'Lost', 'Se pierde'],
  ['pricing.reviewFeatureChanged', 'Changed', 'Cambia'],
  ['pricing.reviewLimits', 'Usage limits', 'Límites de uso'],
  [
    'pricing.reviewLimitExceeded',
    'Your current usage ({usage}) is above the new limit.',
    'Tu uso actual ({usage}) supera el nuevo límite.',
  ],
  ['pricing.reviewUnchanged', 'Unchanged', 'Sin cambios'],
  [
    'pricing.reviewUnchangedSummary',
    '{addOns} add-ons, {features} features and {limits} usage limits stay the same.',
    '{addOns} complementos, {features} características y {limits} límites de uso no cambian.',
  ],
  ['pricing.reviewNotices', 'Before you confirm', 'Antes de confirmar'],
  ['pricing.reviewConfirm', 'Confirm change', 'Confirmar cambio'],
  ['pricing.reviewBack', 'Back', 'Volver'],
  ['pricing.reviewPending', 'Applying your change…', 'Aplicando tu cambio…'],
  ['pricing.reviewErrorTitle', 'The change could not be applied.', 'No se pudo aplicar el cambio.'],
  [
    'pricing.reviewNoChanges',
    'Your selection is the same as your current subscription.',
    'Tu selección es igual a tu suscripción actual.',
  ],
];

const placeholders = (text: string): string[] =>
  [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!).sort();

describe('review messages', () => {
  // [utest->req~review-i18n~1]
  it('has the 36 keys of the Review table', () => {
    expect(table).toHaveLength(36);
    expect(new Set(table.map(([key]) => key)).size).toBe(36);
  });

  // [utest->req~review-i18n~1]
  it.each(table)('%s has its en-US and es-ES text', (key, en, es) => {
    expect(enUS[key]).toBe(en);
    expect(esES[key]).toBe(es);
  });

  // [utest->req~review-i18n~1]
  it('defines no other review key in either catalog', () => {
    const expected = table.map(([key]) => key).sort();
    // pricing.reviewChangeCta belongs to the plan CTA (phase C), not to the review element
    const own = (key: string): boolean =>
      key.startsWith('pricing.review') && key !== 'pricing.reviewChangeCta';
    const reviewKeys = (catalog: Record<string, string>): string[] =>
      Object.keys(catalog).filter(own).sort();
    expect(reviewKeys(enUS)).toEqual(expected);
    expect(reviewKeys(esES)).toEqual(expected);
  });

  // [utest->req~review-i18n~1]
  it('uses the same placeholders in both languages', () => {
    for (const [key, en, es] of table) {
      expect(placeholders(es), key).toEqual(placeholders(en));
    }
  });

  // [utest->req~review-i18n~1]
  it('resolves through getMessages and translate for each locale', () => {
    expect(translate(getMessages('en-US'), 'pricing.reviewTitle')).toBe('Review your change');
    expect(translate(getMessages('es-ES'), 'pricing.reviewTitle')).toBe('Revisa tu cambio');
    const params = { addOns: 2, features: 3, limits: 0 };
    const summary = translate(getMessages('es-ES'), 'pricing.reviewUnchangedSummary', params);
    expect(summary).toBe('2 complementos, 3 características y 0 límites de uso no cambian.');
  });
});
