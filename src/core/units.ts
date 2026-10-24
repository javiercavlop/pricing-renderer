function pluralizeEnglish(unit: string): string {
  if (!/^[a-z]+$/.test(unit)) return unit;
  if (/(s|x|z|ch|sh)$/.test(unit)) return `${unit}es`;
  if (/[^aeiou]y$/.test(unit)) return `${unit.slice(0, -1)}ies`;
  return `${unit}s`;
}

function pluralizeSpanish(unit: string): string {
  if (!/^\p{Ll}+$/u.test(unit)) return unit;
  if (unit.endsWith('z')) return `${unit.slice(0, -1)}ces`;
  if (/[aeiouáéó]$/.test(unit)) return `${unit}s`;
  return `${unit}es`;
}

/**
 * Formats a usage unit for a count: exactly 1 keeps the singular, other counts get a
 * naive plural for English and Spanish. Compound, uppercase, numeric, slashed or
 * already plural units, and other languages, are returned unchanged.
 */
export function formatUnit(unit: string, count: number, locale = 'en-US'): string {
  if (count === 1) return unit;
  if (/\s|\/|\d|[A-Z]/.test(unit) || unit.endsWith('s')) return unit;

  let category: Intl.LDMLPluralRule;
  try {
    category = new Intl.PluralRules(locale).select(count);
  } catch {
    return unit;
  }
  if (category === 'one') return unit;

  const language = locale.split(/[-_]/)[0]?.toLowerCase();
  if (language === 'en') return pluralizeEnglish(unit);
  if (language === 'es') return pluralizeSpanish(unit);
  return unit;
}
