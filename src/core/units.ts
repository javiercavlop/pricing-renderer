function pluralizeEnglish(unit: string): string {
  if (!/^[a-z]+$/.test(unit)) return unit;
  if (/(s|x|z|ch|sh)$/.test(unit)) return `${unit}es`;
  if (/[^aeiou]y$/.test(unit)) return `${unit.slice(0, -1)}ies`;
  return `${unit}s`;
}

/**
 * Formats a usage unit for a count: exactly 1 keeps the singular, other counts get a
 * naive English plural, but only when the base language of the locale is English. Units are
 * written in the language of the pricing, not of the UI, so for any other locale, and for
 * compound, uppercase, numeric, slashed or already plural units, the unit is returned
 * unchanged. A locale that is not valid also leaves the unit unchanged.
 */
export function formatUnit(unit: string, count: number, locale = 'en-US'): string {
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
