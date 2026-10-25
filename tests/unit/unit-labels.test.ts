import { describe, expect, it } from 'vitest';
import { mergePresentationOptions } from '../../src/core/index.js';
import { formatUnit } from '../../src/core/units.js';

// The cast keeps malformed unitLabels shapes callable.
const format = formatUnit as unknown as (
  unit: string,
  count: number,
  locale?: string,
  unitLabels?: unknown,
) => string;

const runs = { execution: { one: 'run', other: 'runs' } };

describe('formatUnit with unitLabels', () => {
  it('U1 the override wins over the built-in English plural', () => {
    expect(formatUnit('execution', 3, 'en-US')).toBe('executions');
    const labels = { '*': { execution: { one: 'run', other: 'go' } } };
    expect(format('execution', 3, 'en-US', labels)).toBe('go');
  });

  it('U2 the override wins for units the built-ins leave alone', () => {
    const labels = {
      '*': {
        'user/month': { one: 'user per month', other: 'users per month' },
        GB: { one: 'gigabyte', other: 'gigabytes' },
        news: { one: 'news item', other: 'news items' },
      },
    };
    expect(format('user/month', 3, 'en-US', labels)).toBe('users per month');
    expect(format('GB', 3, 'en-US', labels)).toBe('gigabytes');
    expect(format('news', 3, 'en-US', labels)).toBe('news items');
  });

  it('U3 a count of exactly 1 returns the one label', () => {
    expect(format('execution', 1, 'en-US', { '*': runs })).toBe('run');
    const labels = { '*': { GB: { one: 'gigabyte', other: 'gigabytes' } } };
    expect(format('GB', 1, 'en-US', labels)).toBe('gigabyte');
    expect(format('execution', 1, 'es', { '*': runs })).toBe('run');
    expect(format('execution', 2, 'es', { '*': runs })).toBe('runs');
  });

  it('U4 an invalid locale uses one for a count of 1 and other for any other count', () => {
    expect(format('execution', 1, 'not a locale!', { '*': runs })).toBe('run');
    expect(format('execution', 3, 'not a locale!', { '*': runs })).toBe('runs');
    expect(format('execution', 0, 'not a locale!', { '*': runs })).toBe('runs');
  });

  it('U4 the category comes from Intl.PluralRules', () => {
    // French puts 0 and 1.5 in the "one" category.
    expect(format('execution', 0, 'fr', { '*': runs })).toBe('run');
    expect(format('execution', 1.5, 'fr', { '*': runs })).toBe('run');
    expect(format('execution', 2, 'fr', { '*': runs })).toBe('runs');
  });

  it('U4 an underscore tag reaches Intl.PluralRules normalized', () => {
    expect(format('execution', 0, 'fr_CA', { '*': runs })).toBe('run');
  });

  it('U5 a unit without an entry keeps the built-in rule', () => {
    const labels = { '*': runs };
    expect(format('seat', 3, 'en-US', labels)).toBe('seats');
    expect(format('seat', 1, 'en-US', labels)).toBe('seat');
    expect(format('user/month', 3, 'en-US', labels)).toBe('user/month');
    expect(format('execution', 3, 'es', {})).toBe('execution');
  });

  it('U6 absent unitLabels behaves exactly as before', () => {
    expect(format('execution', 3, 'en-US', undefined)).toBe('executions');
    expect(format('execution', 3, 'en-US')).toBe('executions');
    expect(format('execution', 1)).toBe('execution');
    expect(format('execution', 3, 'es')).toBe('execution');
  });
});

describe('unitLabels locale lookup', () => {
  const mx = { one: 'ejecución mx', other: 'ejecuciones mx' };
  const es = { one: 'ejecución', other: 'ejecuciones' };
  const any = { one: 'run', other: 'runs' };
  const labels = {
    'es-MX': { execution: mx },
    es: { execution: es, token: { one: 'ficha', other: 'fichas' } },
    '*': {
      execution: any,
      token: { one: 'token', other: 'tokens*' },
      widget: { one: 'widget', other: 'widgets*' },
    },
  };

  it('U7 the exact locale wins, then the base language, then *, then the built-ins', () => {
    expect(format('execution', 3, 'es-MX', labels)).toBe('ejecuciones mx');
    expect(format('execution', 3, 'es-ES', labels)).toBe('ejecuciones');
    expect(format('execution', 3, 'fr', labels)).toBe('runs');
    expect(format('seat', 3, 'en-US', labels)).toBe('seats');
  });

  it('U8 a locale key without the unit continues to the next key', () => {
    expect(format('token', 3, 'es-MX', labels)).toBe('fichas');
    expect(format('widget', 3, 'es-MX', labels)).toBe('widgets*');
    expect(format('widget', 1, 'es-MX', labels)).toBe('widget');
  });

  it('U8 a malformed entry in the exact locale continues to the next key', () => {
    const broken = { 'en-US': { execution: { one: 'only one' } }, '*': { execution: any } };
    expect(format('execution', 3, 'en-US', broken)).toBe('runs');
  });

  it('U8 a non-object locale value ahead of a valid key continues to the next key', () => {
    const ahead = { 'en-US': 'nope', en: null, '*': { execution: any } };
    expect(format('execution', 3, 'en-US', ahead)).toBe('runs');
  });

  it('U9 underscore and case forms of the locale tag are equivalent', () => {
    expect(format('execution', 3, 'es_MX', labels)).toBe('ejecuciones mx');
    expect(format('execution', 3, 'ES-mx', labels)).toBe('ejecuciones mx');
    expect(format('execution', 3, 'es-MX', { ES_mx: { execution: mx } })).toBe('ejecuciones mx');
    expect(format('execution', 3, 'es_MX', { es: { execution: es } })).toBe('ejecuciones');
  });
});

describe('unitLabels malformed entries', () => {
  const valid = { execution: { one: 'run', other: 'runs' } };
  const malformed: [string, unknown][] = [
    ['null', null],
    ['a string', 'runs'],
    ['a number', 42],
    ['an array', Object.assign([], { '*': valid })],
    ['a null locale value', { '*': null }],
    ['a string locale value', { '*': 'runs' }],
    ['an array locale value', { '*': Object.assign([], valid) }],
    ['a null unit value', { '*': { execution: null } }],
    ['a string unit value', { '*': { execution: 'runs' } }],
    ['a missing other', { '*': { execution: { one: 'run' } } }],
    ['a missing one', { '*': { execution: { other: 'runs' } } }],
    ['a non-string one', { '*': { execution: { one: 1, other: 'runs' } } }],
    ['a non-string other', { '*': { execution: { one: 'run', other: {} } } }],
    ['an empty one', { '*': { execution: { one: '', other: 'runs' } } }],
    ['a blank other', { '*': { execution: { one: 'run', other: '   ' } } }],
    ['a blank one', { '*': { execution: { one: '  ', other: 'runs' } } }],
    [
      'an array unit entry with own one and other',
      { '*': { execution: Object.assign([], { one: 'run', other: 'runs' }) } },
    ],
    [
      'an inherited one and other',
      { '*': { execution: Object.create({ one: 'run', other: 'runs' }) as unknown } },
    ],
  ];

  it.each(malformed)('U10 ignores %s without throwing', (_name, labels) => {
    expect(() => format('execution', 3, 'en-US', labels)).not.toThrow();
    expect(format('execution', 3, 'en-US', labels)).toBe('executions');
    expect(format('execution', 1, 'en-US', labels)).toBe('execution');
    expect(format('user/month', 3, 'en-US', labels)).toBe('user/month');
  });
});

describe('unitLabels prototype safety', () => {
  it('U11 does not read units or locales from Object.prototype', () => {
    expect(format('constructor', 3, 'en-US', { '*': {} })).toBe('constructors');
    expect(format('toString', 3, 'en-US', { '*': runs })).toBe('toString');
    expect(format('__proto__', 3, 'en-US', { '*': {} })).toBe('__proto__');
    expect(format('execution', 3, 'en-US', {})).toBe('executions');
  });

  it('U11 ignores entries that are only inherited through the prototype chain', () => {
    const inheritedUnit = { '*': Object.create(runs) as unknown };
    expect(format('execution', 3, 'en-US', inheritedUnit)).toBe('executions');
    const inheritedLocale = Object.create({ '*': runs }) as unknown;
    expect(format('execution', 3, 'en-US', inheritedLocale)).toBe('executions');
  });

  it('U11 an own __proto__ key created by JSON.parse is an ordinary unit', () => {
    const labels = JSON.parse('{"*":{"__proto__":{"one":"proto","other":"protos"}}}') as unknown;
    expect(format('__proto__', 3, 'en-US', labels)).toBe('protos');
    expect(format('__proto__', 1, 'en-US', labels)).toBe('proto');
    expect(format('constructor', 3, 'en-US', labels)).toBe('constructors');
  });
});

describe('unitLabels in mergePresentationOptions', () => {
  it('U12 keeps valid entries, drops malformed ones and empty maps', () => {
    const merged = mergePresentationOptions(undefined, {
      unitLabels: {
        '*': { execution: { one: 'run', other: 'runs' }, bad: { one: 'x' } },
        es: { broken: null },
        fr: 'nope',
      },
    } as never);
    expect(merged.unitLabels).toStrictEqual({ '*': { execution: { one: 'run', other: 'runs' } } });

    const none = mergePresentationOptions(undefined, { unitLabels: { '*': { x: 1 } } } as never);
    expect(none.unitLabels).toBeUndefined();
    const text = mergePresentationOptions(undefined, { unitLabels: 'x' } as never);
    expect(text.unitLabels).toBeUndefined();
    expect(mergePresentationOptions().unitLabels).toBeUndefined();
  });

  it('U13 merges deep by locale and unit, the provided layer winning per unit', () => {
    const merged = mergePresentationOptions(
      {
        unitLabels: {
          '*': {
            execution: { one: 'base run', other: 'base runs' },
            seat: { one: 'base seat', other: 'base seats' },
          },
          es: { execution: { one: 'base ejecución', other: 'base ejecuciones' } },
        },
      },
      {
        unitLabels: {
          '*': { execution: { one: 'top run', other: 'top runs' } },
          fr: { execution: { one: 'exécution', other: 'exécutions' } },
        },
      },
    );
    expect(merged.unitLabels).toEqual({
      '*': {
        execution: { one: 'top run', other: 'top runs' },
        seat: { one: 'base seat', other: 'base seats' },
      },
      es: { execution: { one: 'base ejecución', other: 'base ejecuciones' } },
      fr: { execution: { one: 'exécution', other: 'exécutions' } },
    });
  });

  it('U13 locale keys that differ in case or underscore merge as one key', () => {
    const label = (other: string) => ({ one: 'one', other });
    const merged = mergePresentationOptions(
      { unitLabels: { 'ES-MX': { a: label('Z') }, 'es-mx': { a: label('W') } } },
      { unitLabels: { es_MX: { a: label('Y') } } },
    );
    expect(formatUnit('a', 3, 'es-MX', merged.unitLabels)).toBe('Y');
    expect(Object.keys(merged.unitLabels ?? {})).toStrictEqual(['es-mx']);
  });

  it('U13 two spellings in one layer merge per unit, the later winning', () => {
    const label = (other: string) => ({ one: 'one', other });
    const merged = mergePresentationOptions(undefined, {
      unitLabels: {
        'ES-MX': { a: label('first'), b: label('only b') },
        es_mx: { a: label('second') },
      },
    });
    expect(merged.unitLabels).toStrictEqual({
      'es-mx': { a: label('second'), b: label('only b') },
    });
  });

  it('U13 a malformed defaults layer keeps the valid provided layer', () => {
    const merged = mergePresentationOptions({ unitLabels: { '*': { a: { one: 'x' } } } } as never, {
      unitLabels: { '*': { b: { one: 'b', other: 'bs' } } },
    });
    expect(merged.unitLabels).toStrictEqual({ '*': { b: { one: 'b', other: 'bs' } } });
  });

  it('U13 an own __proto__ unit survives normalize and merge', () => {
    const parse = (text: string) => JSON.parse(text) as never;
    const merged = mergePresentationOptions(
      { unitLabels: parse('{"*":{"__proto__":{"one":"p","other":"ps"}}}') },
      { unitLabels: parse('{"es":{"a":{"one":"a","other":"as"}}}') },
    );
    expect(formatUnit('__proto__', 3, 'en-US', merged.unitLabels)).toBe('ps');
    expect(Object.prototype.hasOwnProperty.call(merged.unitLabels?.['*'], '__proto__')).toBe(true);
    expect(({} as Record<string, unknown>).one).toBeUndefined();
  });

  it('U13 does not mutate the inputs', () => {
    const base = { unitLabels: { '*': { a: { one: 'a', other: 'as' } } } };
    const top = { unitLabels: { '*': { b: { one: 'b', other: 'bs' } } } };
    const before = JSON.stringify([base, top]);
    mergePresentationOptions(base, top);
    expect(JSON.stringify([base, top])).toBe(before);
  });

  it('U14 the merged value survives a JSON round trip unchanged', () => {
    const merged = mergePresentationOptions(
      { unitLabels: { '*': { a: { one: 'a', other: 'as' } } } },
      { unitLabels: { es: { b: { one: 'b', other: 'bs' } }, bad: 3 } } as never,
    );
    expect(merged.unitLabels).toStrictEqual({
      '*': { a: { one: 'a', other: 'as' } },
      es: { b: { one: 'b', other: 'bs' } },
    });
    expect(JSON.parse(JSON.stringify(merged.unitLabels))).toStrictEqual(merged.unitLabels);
    expect(JSON.stringify(JSON.parse(JSON.stringify(merged)))).toBe(JSON.stringify(merged));
  });
});
