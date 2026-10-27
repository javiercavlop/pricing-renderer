import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { enUS, esES, type ComparedValue, type SelectionComparison } from '../../src/core/index.js';
import {
  formatComparedValue,
  formatSignedCurrency,
  renderChangeReview,
  type ReviewRenderState,
} from '../../src/element/change-review-renderers.js';
import { C, ENT, Side, acme, cmp } from './helpers/compare-fixtures.js';

// The pure helpers of the review templates: value formatting through Intl for the element's
// locale, and the signed difference. The templates themselves need a DOM and are covered by
// tests/browser/change-review-ui.spec.ts.

const elementRoot = fileURLToPath(new URL('../../src/element/', import.meta.url));

describe('formatComparedValue', () => {
  const en = (value: ComparedValue, unit?: string) =>
    formatComparedValue(value, enUS, 'en-US', unit);

  // [utest->req~review-ui-limits~1] [utest->req~review-ui-features~1]
  it('names no value, unlimited and booleans with the catalog texts', () => {
    expect(en({ kind: 'none' })).toBe('Not included');
    expect(en({ kind: 'unlimited' })).toBe('Unlimited');
    expect(en({ kind: 'boolean', value: true })).toBe('Included');
    expect(en({ kind: 'boolean', value: false })).toBe('Not included');
    expect(formatComparedValue({ kind: 'unlimited' }, esES, 'es-ES')).toBe('Ilimitado');
  });

  // [utest->req~review-ui-limits~1]
  it('formats numbers with Intl for the locale and appends the unit', () => {
    expect(en({ kind: 'number', value: 1234.5 })).toBe('1,234.5');
    expect(en({ kind: 'number', value: 200 }, 'GB')).toBe('200 GB');
    expect(formatComparedValue({ kind: 'number', value: 1234.5 }, esES, 'es-ES')).toBe('1234,5');
    expect(formatComparedValue({ kind: 'number', value: 12345.5 }, esES, 'es-ES')).toBe('12.345,5');
  });

  // [utest->req~review-ui-features~1]
  it('keeps text as is and writes json with JSON.stringify', () => {
    expect(en({ kind: 'text', value: 'Business hours' })).toBe('Business hours');
    expect(en({ kind: 'text', value: '<b>x</b>' })).toBe('<b>x</b>');
    expect(en({ kind: 'json', value: { a: [1, 2] } })).toBe('{"a":[1,2]}');
  });
});

describe('formatSignedCurrency', () => {
  // [utest->req~review-ui-price~1]
  it('signs the difference in en-US and drops the sign of zero', () => {
    expect(formatSignedCurrency(-5, 'EUR', 'en-US')).toBe('-€5');
    expect(formatSignedCurrency(2, 'EUR', 'en-US')).toBe('+€2');
    expect(formatSignedCurrency(0, 'EUR', 'en-US')).toBe('€0');
  });

  // [utest->req~review-ui-price~1]
  it('keeps two decimals for a fractional difference', () => {
    expect(formatSignedCurrency(1.5, 'USD', 'en-US')).toBe('+$1.50');
  });

  // [utest->req~review-ui-price~1]
  it('formats for the locale of the element', () => {
    expect(formatSignedCurrency(-5, 'EUR', 'es-ES')).toContain('-5');
    expect(formatSignedCurrency(-5, 'EUR', 'es-ES')).toContain('€');
  });

  // [utest->req~review-ui-price~1]
  it('accepts a locale written with an underscore', () => {
    expect(formatSignedCurrency(-5, 'EUR', 'es_ES')).toContain('-5');
  });

  // [utest->req~review-ui-price~1]
  it('falls back to a plain number for an invalid currency code', () => {
    expect(formatSignedCurrency(3, 'not a currency', 'en-US')).toBe('+3');
  });
});

// The text of a template result: its static strings with its values, nested results and arrays
// included. Enough to read what a template would render without a DOM.
function textOf(value: unknown): string {
  if (Array.isArray(value)) return value.map(textOf).join('');
  if (value && typeof value === 'object' && 'strings' in value && 'values' in value) {
    const { strings, values } = value as { strings: string[]; values: unknown[] };
    return strings
      .map((part, index) => part + (index < values.length ? textOf(values[index]) : ''))
      .join('');
  }
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function reviewText(comparison: SelectionComparison, locale = 'en-US'): string {
  const state: ReviewRenderState = {
    comparison,
    locale,
    messages: enUS,
    notices: [],
    pending: false,
    blocked: false,
    idPrefix: 'test',
    onConfirm: () => undefined,
    onBack: () => undefined,
  };
  return textOf(renderChangeReview(state));
}

const upgrade = (): SelectionComparison => cmp(Side(acme, C()), Side(acme, ENT()));

describe('renderChangeReview', () => {
  // [utest->req~review-ui-price~1]
  it('renders the review for a locale that Intl rejects', () => {
    const text = reviewText(upgrade(), '!!');
    expect(text).toContain('80');
    expect(text).toContain('75');
    expect(text).toContain('review-price');
  });

  // [utest->req~review-ui-limits~1]
  it('shows no limit row and no warning for a limit that is only unchanged and exceeded', () => {
    const comparison = upgrade();
    comparison.usageLimits = { changed: [], unchanged: ['storage'], exceeded: ['storage'] };
    const text = reviewText(comparison);
    expect(text).not.toContain('review-limits');
    expect(text).not.toContain('above the new limit');
  });

  // [utest->req~review-ui-limits~1]
  it('warns only for the changed limit that is exceeded', () => {
    const comparison = upgrade();
    const [storage] = comparison.usageLimits.changed;
    comparison.usageLimits = {
      changed: [
        { ...storage!, currentUsage: 150, exceedsCurrentUsage: true },
        { ...storage!, id: 'seats', name: 'Seats' },
      ],
      unchanged: [],
      exceeded: ['storage'],
    };
    const text = reviewText(comparison);
    expect(text).toContain('Storage');
    expect(text).toContain('Seats');
    expect(text.match(/above the new limit/g)).toHaveLength(1);
  });

  // [utest->req~review-ui-plan~1]
  it('names a plan that is not in the pricing by its id', () => {
    const comparison = upgrade();
    comparison.plan = {
      before: { id: 'legacy', known: false },
      after: { id: 'legacy', known: false },
      changed: false,
    };
    const text = reviewText(comparison);
    expect(text).toContain('legacy');
    expect(text).not.toContain('undefined');
  });
});

describe('text-only rendering', () => {
  const files = readdirSync(elementRoot).filter(
    (file) => file.startsWith('change-review-') && file.endsWith('.ts'),
  );

  // [utest->req~review-text-only~1]
  it('finds the review modules', () => {
    expect(files).toContain('change-review-element.ts');
    expect(files).toContain('change-review-renderers.ts');
  });

  // [utest->req~review-text-only~1]
  it.each(files)('%s never parses text as HTML', (file) => {
    const comments = /\/\*[\s\S]*?\*\/|\/\/.*$/gm;
    const source = readFileSync(`${elementRoot}${file}`, 'utf8').replace(comments, '');
    expect(source).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|unsafeHTML|unsafeSVG/);
    expect(source).not.toMatch(/\.html\s*=|DOMParser|createContextualFragment|document\.write/);
  });
});
