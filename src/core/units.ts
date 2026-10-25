import type { PricingUnitLabel, PricingUnitLabels } from './types.js';

function pluralizeEnglish(unit: string): string {
  if (!/^[a-z]+$/.test(unit)) return unit;
  if (/(s|x|z|ch|sh)$/.test(unit)) return `${unit}es`;
  if (/[^aeiou]y$/.test(unit)) return `${unit.slice(0, -1)}ies`;
  return `${unit}s`;
}

export function isUnitLabel(value: unknown): value is PricingUnitLabel {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  if (
    !Object.prototype.hasOwnProperty.call(value, 'one') ||
    !Object.prototype.hasOwnProperty.call(value, 'other')
  ) {
    return false;
  }
  const { one, other } = value as Record<string, unknown>;
  return (
    typeof one === 'string' && one.trim() !== '' && typeof other === 'string' && other.trim() !== ''
  );
}

function findUnitLabel(
  unit: string,
  tag: string,
  unitLabels: unknown,
): PricingUnitLabel | undefined {
  if (typeof unitLabels !== 'object' || unitLabels === null || Array.isArray(unitLabels)) {
    return undefined;
  }
  const keys = Object.keys(unitLabels);
  const normalizedKeys = keys.map((key) => key.replace(/_/g, '-').toLowerCase());
  const lowerTag = tag.toLowerCase();
  const candidates = [lowerTag, lowerTag.split('-')[0] ?? lowerTag, '*'];
  for (const candidate of candidates) {
    // later keys win: a merged map lists the provided layer after the defaults
    for (let index = keys.length - 1; index >= 0; index -= 1) {
      const key = keys[index]!;
      if (normalizedKeys[index] !== candidate) continue;
      const units = (unitLabels as Record<string, unknown>)[key];
      if (
        typeof units !== 'object' ||
        units === null ||
        Array.isArray(units) ||
        !Object.prototype.hasOwnProperty.call(units, unit)
      )
        continue;
      const entry = (units as Record<string, unknown>)[unit];
      if (isUnitLabel(entry)) return entry;
    }
  }
  return undefined;
}

/**
 * Formats a usage unit for a count. When `unitLabels` holds an override for the unit, it wins:
 * the lookup order is the exact locale tag, the base language, then `*`, and the plural
 * category of the locale picks `one` or `other`. Without an override: exactly 1 keeps the
 * singular, other counts get a naive English plural, but only when the base language of the
 * locale is English. Units are written in the language of the pricing, not of the UI, so for
 * any other locale, and for compound, uppercase, numeric, slashed or already plural units,
 * the unit is returned unchanged. A locale that is not valid also leaves the unit unchanged.
 */
export function formatUnit(
  unit: string,
  count: number,
  locale = 'en-US',
  unitLabels?: PricingUnitLabels,
): string {
  const override = findUnitLabel(unit, locale.replace(/_/g, '-'), unitLabels);
  if (override) {
    let one = count === 1;
    try {
      one = new Intl.PluralRules(locale.replace(/_/g, '-')).select(count) === 'one';
    } catch {
      /* invalid locale: keep the count === 1 rule */
    }
    return one ? override.one : override.other;
  }
  if (count === 1) return unit;
  if (/\s|\/|\d|[A-Z]/.test(unit) || unit.endsWith('s')) return unit;

  const tag = locale.replace(/_/g, '-');
  let category: Intl.LDMLPluralRule;
  try {
    category = new Intl.PluralRules(tag).select(count);
  } catch {
    return unit;
  }
  if (category === 'one') return unit;

  return tag.split('-')[0]?.toLowerCase() === 'en' ? pluralizeEnglish(unit) : unit;
}
