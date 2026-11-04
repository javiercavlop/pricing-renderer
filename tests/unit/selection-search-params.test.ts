import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import * as core from '../../src/core/index.js';
import {
  applySelectionInput,
  createDefaultSelection,
  normalizePricing,
  reconcileSelection,
} from '../../src/core/index.js';
import type {
  NormalizedPricing,
  PricingDiagnostic,
  PricingSelection,
} from '../../src/core/index.js';
import { parsePricingYaml } from '../../src/yaml/index.js';

type Pair = [string, string];
interface ReadResult {
  selection: PricingSelection;
  removedAddOnIds: string[];
  diagnostics: PricingDiagnostic[];
}
interface SearchParamsApi {
  selectionToSearchParams: (s: PricingSelection, o?: { prefix?: string }) => Pair[];
  selectionFromSearchParams: (
    p: NormalizedPricing,
    params: Iterable<Pair>,
    o?: { prefix?: string; current?: PricingSelection },
  ) => ReadResult;
}

// The functions are read from the namespace, so a missing export fails an assertion, not an import.
function api(): SearchParamsApi {
  const found = core as unknown as Partial<SearchParamsApi>;
  expect(found.selectionToSearchParams).toBeTypeOf('function');
  expect(found.selectionFromSearchParams).toBeTypeOf('function');
  return found as SearchParamsApi;
}

let acmeSource: string;
let acme: NormalizedPricing;
let tiers: NormalizedPricing;

beforeAll(async () => {
  const url = new URL('../fixtures/acme-pricing.yml', import.meta.url);
  acmeSource = await readFile(fileURLToPath(url), 'utf8');
  acme = parsePricingYaml(acmeSource).value!;
  const tiersInput = {
    syntaxVersion: '3.1',
    saasName: 'Tiers',
    currency: 'EUR',
    variables: { tiers: [1, 2, 3] },
    plans: { basic: { price: 10 } },
    addOns: {
      pack: {
        price: 1,
        subscriptionConstraints: { minQuantity: 2, maxQuantity: 8, quantityStep: 2 },
      },
    },
  };
  tiers = normalizePricing(tiersInput as never).value!;
});

afterEach(() => {
  for (const key of ['isAdmin', '0', 'x']) {
    delete (Object.prototype as Record<string, unknown>)[key];
  }
});

const codesOf = (diagnostics: PricingDiagnostic[]): string[] =>
  diagnostics.map((item) => item.code);

const selectedQuantities = (selection: PricingSelection): Record<string, number> =>
  Object.fromEntries(
    Object.entries(selection.addOns)
      .filter(([, entry]) => entry.selected)
      .map(([id, entry]) => [id, entry.quantity]),
  );

describe('selectionToSearchParams', () => {
  // [utest->req~search-params-write~1] [utest->req~search-params-write-variables~1]
  it('writes plan, billing, the selected add-ons and the variables in order', () => {
    const { selectionToSearchParams } = api();
    const selection: PricingSelection = {
      planId: 'growth',
      billingPeriod: 'yearly',
      variables: { seats: 12, region: 'eu' },
      addOns: {
        extraStorage: { selected: true, quantity: 3 },
        compliance: { selected: false, quantity: 1 },
        prioritySuccess: { selected: true, quantity: 1 },
      },
    };
    expect(selectionToSearchParams(selection)).toEqual([
      ['plan', 'growth'],
      ['billing', 'yearly'],
      ['addon', 'extraStorage:3'],
      ['addon', 'prioritySuccess'],
      ['var.seats', '12'],
      ['var.region', '"eu"'],
    ]);
  });

  // [utest->req~search-params-write~1]
  it('writes the quantity of an id that contains a colon', () => {
    const { selectionToSearchParams } = api();
    const selection: PricingSelection = {
      variables: {},
      addOns: { 'a:b': { selected: true, quantity: 1 } },
    };
    expect(selectionToSearchParams(selection)).toEqual([['addon', 'a:b:1']]);
  });

  // [utest->req~search-params-write-variables~1]
  it('writes nested values as JSON and skips undefined values', () => {
    const { selectionToSearchParams } = api();
    const selection: PricingSelection = {
      variables: { seats: 5, note: undefined, priceByRegion: { 'eu-price': 8 } },
      addOns: {},
    };
    expect(selectionToSearchParams(selection)).toEqual([
      ['var.seats', '5'],
      ['var.priceByRegion', '{"eu-price":8}'],
    ]);
  });
});

describe('selectionFromSearchParams', () => {
  // [utest->req~search-params-read~1]
  it('reads the entries of a shared link', () => {
    const { selectionFromSearchParams } = api();
    const entries: Pair[] = [
      ['plan', 'growth'],
      ['addon', 'extraStorage:3'],
      ['addon', 'prioritySuccess'],
      ['var.seats', '12'],
      ['var.priceByRegion.us-price', '12'],
      ['utm_source', 'mail'],
    ];
    const { selection, diagnostics } = selectionFromSearchParams(acme, entries);
    expect(selection.planId).toBe('growth');
    expect(selection.billingPeriod).toBe('monthly');
    expect(selection.addOns).toEqual({
      extraStorage: { selected: true, quantity: 3 },
      prioritySuccess: { selected: true, quantity: 1 },
    });
    expect(selection.variables.seats).toBe(12);
    expect(selection.variables.priceByRegion).toEqual({ 'eu-price': 8, 'us-price': 12 });
    expect(diagnostics).toEqual([]);
  });

  // [utest->req~search-params-read~1]
  it('returns the result of applySelectionInput with the current selection', () => {
    const { selectionFromSearchParams } = api();
    const current: PricingSelection = {
      ...createDefaultSelection(acme),
      planId: 'enterprise',
      billingPeriod: 'yearly',
    };
    const entries: Pair[] = [
      ['plan', 'legacy'],
      ['addon', 'extraStorage:2'],
      ['var.seats', '9'],
    ];
    const input: Partial<PricingSelection> = {
      planId: 'legacy',
      addOns: { extraStorage: { selected: true, quantity: 2 } },
      variables: { ...createDefaultSelection(acme).variables, seats: 9 },
    };
    const result = selectionFromSearchParams(acme, entries, { current });
    expect(result).toEqual(applySelectionInput(acme, current, input));
    expect(result.selection.planId).toBe('enterprise');
    expect(codesOf(result.diagnostics)).toEqual(['PR_SELECTION_UNKNOWN_PLAN']);
  });

  // [utest->req~search-params-read~1]
  it('takes the first plan and billing entries', () => {
    const { selectionFromSearchParams } = api();
    const entries: Pair[] = [
      ['plan', 'growth'],
      ['billing', 'yearly'],
      ['plan', 'enterprise'],
      ['billing', 'monthly'],
    ];
    const { selection, diagnostics } = selectionFromSearchParams(acme, entries);
    expect(selection.planId).toBe('growth');
    expect(selection.billingPeriod).toBe('yearly');
    expect(diagnostics).toEqual([]);
  });

  // [utest->req~search-params-read-addon-quantity-nan~1]
  it('selects an add-on with a quantity that is not a number at its minimum', () => {
    const { selectionFromSearchParams } = api();
    const { selection, diagnostics } = selectionFromSearchParams(tiers, [['addon', 'pack:abc']]);
    expect(selection.addOns.pack).toEqual({ selected: true, quantity: 2 });
    expect(diagnostics).toEqual([]);
  });

  // [utest->req~search-params-read-addon-quantity-nan~1]
  it('selects an add-on without a minimum and a quantity that is not a number at 1', () => {
    const { selectionFromSearchParams } = api();
    const entries: Pair[] = [
      ['plan', 'growth'],
      ['addon', 'extraStorage'],
      ['addon', 'prioritySuccess:abc'],
    ];
    const { selection, diagnostics } = selectionFromSearchParams(acme, entries);
    expect(selection.addOns.prioritySuccess).toEqual({ selected: true, quantity: 1 });
    expect(diagnostics).toEqual([]);
  });

  const repeated: [string, string, number][] = [
    ['extraStorage:3', 'extraStorage:5', 5],
    ['extraStorage:5', 'extraStorage:3', 3],
  ];
  for (const [first, last, quantity] of repeated) {
    // [utest->req~search-params-read-repeated-addon~1]
    it(`takes the last of ${first} and ${last}`, () => {
      const { selectionFromSearchParams } = api();
      const entries: Pair[] = [
        ['plan', 'growth'],
        ['addon', first],
        ['addon', last],
      ];
      const { selection, diagnostics } = selectionFromSearchParams(acme, entries);
      expect(selection.addOns.extraStorage).toEqual({ selected: true, quantity });
      expect(diagnostics).toEqual([]);
    });
  }

  // [utest->req~search-params-var-text~1]
  it('keeps variable text that is not JSON as a string', () => {
    const { selectionFromSearchParams } = api();
    const entries: Pair[] = [
      ['var.region', 'us'],
      ['var.prioritySupport', 'true'],
    ];
    const { selection } = selectionFromSearchParams(acme, entries);
    expect(selection.variables.region).toBe('us');
    expect(selection.variables.prioritySupport).toBe(true);
  });

  // [utest->req~search-params-var-type-unchecked~1]
  it('sets values of another type than the default without a diagnostic', () => {
    const { selectionFromSearchParams } = api();
    const entries: Pair[] = [
      ['var.seats', '"many"'],
      ['var.prioritySupport', '3'],
    ];
    const { selection, diagnostics } = selectionFromSearchParams(acme, entries);
    expect(selection.variables.seats).toBe('many');
    expect(selection.variables.prioritySupport).toBe(3);
    expect(diagnostics).toEqual([]);
  });
});

describe('variable paths', () => {
  // [utest->req~search-params-var-path-safe~3]
  it('ignores prototype pollution attempts', () => {
    const { selectionFromSearchParams } = api();
    const entries: Pair[] = [
      ['var.__proto__.isAdmin', 'true'],
      ['var.constructor.prototype.isAdmin', 'true'],
      ['var.__proto__[0]', '1'],
      ['var.prototype', '1'],
      ['var.seats', '7'],
    ];
    const { selection } = selectionFromSearchParams(acme, entries);
    expect(Object.hasOwn(Object.prototype, 'isAdmin')).toBe(false);
    expect(Object.hasOwn(Object.prototype, '0')).toBe(false);
    expect(selection.variables.seats).toBe(7);
    expect(Object.hasOwn(selection.variables, '__proto__')).toBe(false);
    expect(Object.hasOwn(selection.variables, 'constructor')).toBe(false);
    expect(Object.hasOwn(selection.variables, 'prototype')).toBe(false);
  });

  // [utest->req~search-params-var-path-safe~3]
  it('ignores a digit segment under a missing or scalar parent', () => {
    const { selectionFromSearchParams } = api();
    const entries: Pair[] = [
      ['var.x.4294967294', '1'],
      ['var.seats[9]', '1'],
    ];
    let result: ReadResult | undefined;
    expect(() => {
      result = selectionFromSearchParams(acme, entries);
    }).not.toThrow();
    expect(Object.hasOwn(result!.selection.variables, 'x')).toBe(false);
    expect(result!.selection.variables.seats).toBe(5);
  });

  // [utest->req~search-params-var-path-safe~3]
  it('ignores a non-digit segment under a scalar parent', () => {
    const { selectionFromSearchParams } = api();
    const before = structuredClone(acme.variables);
    let result: ReadResult | undefined;
    expect(() => {
      result = selectionFromSearchParams(acme, [['var.seats.x', '1']]);
    }).not.toThrow();
    expect(result!.selection.variables.seats).toBe(5);
    expect(acme.variables).toEqual(before);
  });

  // [utest->req~search-params-var-path-safe~3]
  it('ignores a digit segment under a record parent', () => {
    const { selectionFromSearchParams } = api();
    const entries: Pair[] = [['var.priceByRegion.0', '1']];
    const { selection } = selectionFromSearchParams(acme, entries);
    expect(selection.variables.priceByRegion).toEqual({ 'eu-price': 8, 'us-price': 10 });
  });

  // [utest->req~search-params-var-path-safe~3]
  it('ignores array indexes that are not canonical or not below the length', () => {
    const { selectionFromSearchParams } = api();
    const entries: Pair[] = [
      ['var.tiers.1e9', '7'],
      ['var.tiers.0x7fffffff', '7'],
      ['var.tiers. 5', '7'],
      ['var.tiers.01', '7'],
      ['var.tiers.3', '7'],
      ['var.tiers.length', '0'],
    ];
    let result: ReadResult | undefined;
    expect(() => {
      result = selectionFromSearchParams(tiers, entries);
    }).not.toThrow();
    const variables = result!.selection.variables;
    expect(variables.tiers).toEqual([1, 2, 3]);
    expect((variables.tiers as unknown[]).length).toBe(3);
    expect(Object.keys(variables)).toEqual(['tiers']);
  });

  // [utest->req~search-params-var-path-safe~3]
  it('writes an existing array element', () => {
    const { selectionFromSearchParams } = api();
    const entries: Pair[] = [
      ['var.tiers.2', '9'],
      ['var.tiers[0]', '4'],
    ];
    const { selection } = selectionFromSearchParams(tiers, entries);
    expect(selection.variables.tiers).toEqual([4, 2, 9]);
  });

  // [utest->req~search-params-var-path-split~1]
  it('reads only bracketed digits as an index', () => {
    const { selectionFromSearchParams } = api();
    const entries: Pair[] = [
      ['var.tiers[2]', '9'],
      ['var.tiers[ 5]', '7'],
    ];
    const { selection } = selectionFromSearchParams(tiers, entries);
    expect(selection.variables.tiers).toEqual([1, 2, 9]);
    expect((selection.variables.tiers as unknown[]).length).toBe(3);
    expect(selection.variables['tiers[ 5]']).toBe(7);
  });

  // [utest->req~search-params-var-path-split~1]
  it('drops empty segments', () => {
    const { selectionFromSearchParams } = api();
    const entries: Pair[] = [
      ['var..seats', '8'],
      ['var.priceByRegion..us-price.', '12'],
    ];
    const { selection } = selectionFromSearchParams(acme, entries);
    expect(selection.variables.seats).toBe(8);
    expect(selection.variables.priceByRegion).toEqual({ 'eu-price': 8, 'us-price': 12 });
    expect(Object.hasOwn(selection.variables, '')).toBe(false);
  });

  // [utest->req~search-params-var-proto-keys~1]
  it('leaves __proto__ keys out of a JSON value', () => {
    const { selectionFromSearchParams } = api();
    const value =
      '{"eu-price":9,"__proto__":{"isAdmin":true},"nested":{"__proto__":{"x":1},"k":2}}';
    const { selection } = selectionFromSearchParams(acme, [['var.priceByRegion', value]]);
    const priceByRegion = selection.variables.priceByRegion as Record<string, unknown>;
    expect(priceByRegion).toEqual({ 'eu-price': 9, nested: { k: 2 } });
    expect(Object.hasOwn(priceByRegion, '__proto__')).toBe(false);
    expect(Object.hasOwn(priceByRegion.nested as object, '__proto__')).toBe(false);
    expect(Object.hasOwn(Object.prototype, 'isAdmin')).toBe(false);
    expect(Object.hasOwn(Object.prototype, 'x')).toBe(false);
  });

  // [utest->req~search-params-var-proto-keys~1]
  it('leaves __proto__ keys out of objects inside an array', () => {
    const { selectionFromSearchParams } = api();
    const entries: Pair[] = [['var.seats', '[{"__proto__":{"x":1},"v":1}]']];
    const { selection } = selectionFromSearchParams(acme, entries);
    const seats = selection.variables.seats as Record<string, unknown>[];
    expect(seats).toEqual([{ v: 1 }]);
    expect(Object.hasOwn(seats[0]!, '__proto__')).toBe(false);
    expect(Object.hasOwn(Object.prototype, 'x')).toBe(false);
  });
});

describe('malformed and large input', () => {
  // [utest->req~search-params-read-no-throw~1]
  it('ignores entries that are not two strings', () => {
    const { selectionFromSearchParams } = api();
    const entries = [
      null,
      ['var.seats'],
      [1, 2],
      { 0: 'plan', 1: 'enterprise', length: 2 },
      ['var.', '3'],
      ['var.seats', '{'],
      ['plan', 'growth'],
    ];
    let result: ReadResult | undefined;
    expect(() => {
      result = selectionFromSearchParams(acme, entries as unknown as Iterable<Pair>);
    }).not.toThrow();
    expect(result!.selection.planId).toBe('growth');
    expect(result!.selection.variables.seats).toBe('{');
  });

  // [utest->req~search-params-var-length-limit~1]
  it('ignores twenty thousand nested brackets and reads 2048 code units', () => {
    const { selectionFromSearchParams } = api();
    const entries: Pair[] = [
      ['var.seats', '['.repeat(20000) + ']'.repeat(20000)],
      ['var.region', '"' + 'a'.repeat(2046) + '"'],
    ];
    let result: ReadResult | undefined;
    expect(() => {
      result = selectionFromSearchParams(acme, entries);
    }).not.toThrow();
    expect(result!.selection.variables.seats).toBe(5);
    expect(result!.selection.variables.region).toBe('a'.repeat(2046));
  });

  // [utest->req~search-params-var-length-limit~1]
  it('ignores a value of 2049 code units', () => {
    const { selectionFromSearchParams } = api();
    const entries: Pair[] = [
      ['var.region', '"' + 'a'.repeat(2047) + '"'],
      ['var.note', 'b'.repeat(2049)],
      ['var.memo', 'c'.repeat(2048)],
    ];
    const { selection } = selectionFromSearchParams(acme, entries);
    expect(selection.variables.region).toBe('eu');
    expect(Object.hasOwn(selection.variables, 'note')).toBe(false);
    expect(selection.variables.memo).toBe('c'.repeat(2048));
  });

  // [utest->req~search-params-var-depth-limit~1]
  it('ignores a value nested nine levels and reads eight', () => {
    const { selectionFromSearchParams } = api();
    const entries: Pair[] = [
      ['var.priceByRegion', '['.repeat(9) + '1' + ']'.repeat(9)],
      ['var.seats', '['.repeat(8) + '1' + ']'.repeat(8)],
    ];
    const { selection } = selectionFromSearchParams(acme, entries);
    expect(selection.variables.priceByRegion).toEqual({ 'eu-price': 8, 'us-price': 10 });
    expect(selection.variables.seats).toEqual([[[[[[[[1]]]]]]]]);
  });

  const depths: [string, string, boolean][] = [
    ['nine objects', '{"a":'.repeat(9) + '1' + '}'.repeat(9), false],
    ['eight objects', '{"a":'.repeat(8) + '1' + '}'.repeat(8), true],
    ['nine arrays, the last one empty', '['.repeat(9) + ']'.repeat(9), false],
    ['eight arrays, the last one empty', '['.repeat(8) + ']'.repeat(8), true],
  ];
  for (const [name, value, read] of depths) {
    // [utest->req~search-params-var-depth-limit~1]
    it(`${read ? 'reads' : 'ignores'} a value of ${name}`, () => {
      const { selectionFromSearchParams } = api();
      const { selection } = selectionFromSearchParams(acme, [['var.region', value]]);
      expect(selection.variables.region).toEqual(read ? JSON.parse(value) : 'eu');
    });
  }

  // [utest->req~search-params-var-depth-limit~1]
  it('ignores a path of nine segments and reads eight', () => {
    const { selectionFromSearchParams } = api();
    const entries: Pair[] = [
      ['var.a.b.c.d.e.f.g.h.i', '1'],
      ['var.k.b.c.d.e.f.g.h', '1'],
    ];
    const { selection } = selectionFromSearchParams(acme, entries);
    expect(Object.hasOwn(selection.variables, 'a')).toBe(false);
    expect(selection.variables.k).toEqual({ b: { c: { d: { e: { f: { g: { h: 1 } } } } } } });
  });

  // [utest->req~search-params-entry-limit~1]
  it('reads the hundredth entry', () => {
    const { selectionFromSearchParams } = api();
    const entries: Pair[] = [
      ...Array.from({ length: 99 }, (): Pair => ['utm_source', 'mail']),
      ['plan', 'growth'],
    ];
    expect(selectionFromSearchParams(acme, entries).selection.planId).toBe('growth');
  });

  // [utest->req~search-params-entry-limit~1]
  it('ignores the entry after one hundred entries', () => {
    const { selectionFromSearchParams } = api();
    const entries: Pair[] = [
      ...Array.from({ length: 100 }, (): Pair => ['utm_source', 'mail']),
      ['plan', 'growth'],
    ];
    expect(selectionFromSearchParams(acme, entries).selection.planId).toBe('starter');
  });

  // [utest->req~search-params-entry-limit~1]
  it('stops an endless iterable after one hundred entries', () => {
    const { selectionFromSearchParams } = api();
    let pulls = 0;
    // throws instead of running forever, so a reader that does not stop fails
    function* endless(): Generator<Pair> {
      for (;;) {
        pulls += 1;
        if (pulls > 1000) throw new Error('the reader did not stop after 100 entries');
        yield ['utm_source', 'mail'];
      }
    }
    let result: ReadResult | undefined;
    expect(() => {
      result = selectionFromSearchParams(acme, endless());
    }).not.toThrow();
    expect(pulls).toBeLessThanOrEqual(100);
    expect(result!.selection.planId).toBe('starter');
  });
});

describe('diagnostics of unknown ids', () => {
  // [utest->req~search-params-diagnostic-id-length~2]
  it('cuts five thousand character ids to 64 code units', () => {
    const { selectionFromSearchParams } = api();
    const entries: Pair[] = [
      ['plan', 'x'.repeat(5000)],
      ['addon', 'y'.repeat(5000)],
    ];
    const { diagnostics } = selectionFromSearchParams(acme, entries);
    expect(codesOf(diagnostics)).toEqual([
      'PR_SELECTION_UNKNOWN_PLAN',
      'PR_SELECTION_UNKNOWN_ADDON',
    ]);
    const [plan, addOn] = diagnostics;
    expect(plan!.message).toContain('x'.repeat(64));
    expect(plan!.message).not.toContain('x'.repeat(65));
    expect(plan!.path ?? '').not.toContain('x'.repeat(65));
    expect(addOn!.path).toBe('selection.addOns.' + 'y'.repeat(64));
    expect(addOn!.message).not.toContain('y'.repeat(65));
  });

  // [utest->req~search-params-diagnostic-id-length~2]
  it('cuts a five thousand character billing id to 64 code units', () => {
    const { selectionFromSearchParams } = api();
    const entries: Pair[] = [['billing', 'v'.repeat(5000)]];
    const { selection, diagnostics } = selectionFromSearchParams(acme, entries);
    expect(codesOf(diagnostics)).toEqual(['PR_SELECTION_UNKNOWN_BILLING_PERIOD']);
    expect(diagnostics[0]!.message).toContain('v'.repeat(64));
    expect(diagnostics[0]!.message).not.toContain('v'.repeat(65));
    expect(diagnostics[0]!.path ?? '').not.toContain('v'.repeat(65));
    expect(selection.billingPeriod).toBe('monthly');
  });

  // [utest->req~search-params-diagnostic-id-length~2]
  it('never cuts a surrogate pair in half', () => {
    const { selectionFromSearchParams } = api();
    const entries: Pair[] = [
      ['addon', 'z'.repeat(63) + '😀tail'],
      ['addon', 'w'.repeat(64) + '😀'],
    ];
    const { diagnostics } = selectionFromSearchParams(acme, entries);
    expect(codesOf(diagnostics)).toEqual([
      'PR_SELECTION_UNKNOWN_ADDON',
      'PR_SELECTION_UNKNOWN_ADDON',
    ]);
    expect(diagnostics.map((item) => item.path)).toEqual([
      'selection.addOns.' + 'z'.repeat(63),
      'selection.addOns.' + 'w'.repeat(64),
    ]);
    for (const item of diagnostics) {
      expect(item.message).not.toContain('\uD83D');
      expect(item.path).not.toContain('\uD83D');
    }
  });

  // [utest->req~search-params-diagnostic-id-length~2]
  it('keeps an id of exactly 64 code units that ends in a high surrogate', () => {
    const { selectionFromSearchParams } = api();
    const id = 'q'.repeat(63) + '\uD83D';
    const { diagnostics } = selectionFromSearchParams(acme, [['addon', id]]);
    expect(codesOf(diagnostics)).toEqual(['PR_SELECTION_UNKNOWN_ADDON']);
    expect(diagnostics[0]!.path).toBe('selection.addOns.' + id);
  });

  // [utest->req~search-params-diagnostic-id-length~2]
  it('matches a long id in full', () => {
    const { selectionFromSearchParams } = api();
    const a64 = 'a'.repeat(64);
    const b70 = 'b'.repeat(70);
    const extended = acmeSource.replace(
      '\ncustom:',
      `\n  ${a64}:\n    price: 1\n  ${b70}:\n    price: 1\ncustom:`,
    );
    const pricing = parsePricingYaml(extended).value!;
    const entries: Pair[] = [
      ['plan', 'growth'],
      ['addon', a64 + 'c'],
      ['addon', b70],
    ];
    const { selection, diagnostics } = selectionFromSearchParams(pricing, entries);
    expect(selection.addOns).toEqual({ [b70]: { selected: true, quantity: 1 } });
    expect(codesOf(diagnostics)).toEqual(['PR_SELECTION_UNKNOWN_ADDON']);
    expect(diagnostics[0]!.path).toBe('selection.addOns.' + a64);
  });

  // [utest->req~search-params-unknown-ids~1]
  it('warns about a legacy plan, a weekly billing and a ghost add-on', () => {
    const { selectionFromSearchParams } = api();
    const entries: Pair[] = [
      ['plan', 'legacy'],
      ['billing', 'weekly'],
      ['addon', 'ghost'],
    ];
    const { selection, diagnostics } = selectionFromSearchParams(acme, entries);
    expect(codesOf(diagnostics)).toEqual([
      'PR_SELECTION_UNKNOWN_PLAN',
      'PR_SELECTION_UNKNOWN_BILLING_PERIOD',
      'PR_SELECTION_UNKNOWN_ADDON',
    ]);
    expect(diagnostics.every((item) => item.severity === 'warning')).toBe(true);
    expect(selection.planId).toBe('starter');
    expect(selection.billingPeriod).toBe('monthly');
  });

  // [utest->req~search-params-unknown-ids~1]
  it('warns about ids named like prototype properties', () => {
    const { selectionFromSearchParams } = api();
    const before = Object.getOwnPropertyNames(Object.prototype);
    const entries: Pair[] = [
      ['plan', '__proto__'],
      ['billing', 'constructor'],
      ['addon', '__proto__'],
      ['addon', 'constructor'],
    ];
    const { selection, diagnostics } = selectionFromSearchParams(acme, entries);
    expect(codesOf(diagnostics)).toEqual([
      'PR_SELECTION_UNKNOWN_PLAN',
      'PR_SELECTION_UNKNOWN_BILLING_PERIOD',
      'PR_SELECTION_UNKNOWN_ADDON',
      'PR_SELECTION_UNKNOWN_ADDON',
    ]);
    expect(diagnostics.every((item) => item.severity === 'warning')).toBe(true);
    expect(diagnostics.slice(2).map((item) => item.path)).toEqual([
      'selection.addOns.__proto__',
      'selection.addOns.constructor',
    ]);
    expect(selection.planId).toBe('starter');
    expect(selection.billingPeriod).toBe('monthly');
    expect(selection.addOns).toEqual({});
    expect(Object.getOwnPropertyNames(Object.prototype)).toEqual(before);
    expect(({} as { constructor: unknown }).constructor).toBe(Object);
  });
});

describe('prefix', () => {
  // [utest->req~search-params-prefix~1]
  it('writes every key with the prefix', () => {
    const { selectionToSearchParams } = api();
    const selection: PricingSelection = {
      ...createDefaultSelection(acme),
      planId: 'growth',
      addOns: { extraStorage: { selected: true, quantity: 2 } },
    };
    const pairs = selectionToSearchParams(selection, { prefix: 'pr-' });
    expect(pairs[0]).toEqual(['pr-plan', 'growth']);
    expect(pairs).toContainEqual(['pr-billing', 'monthly']);
    expect(pairs).toContainEqual(['pr-addon', 'extraStorage:2']);
    expect(pairs).toContainEqual(['pr-var.seats', '5']);
    expect(pairs.every(([key]) => key.startsWith('pr-'))).toBe(true);
  });

  // [utest->req~search-params-prefix~1]
  it('reads only the keys with the prefix', () => {
    const { selectionFromSearchParams } = api();
    const entries: Pair[] = [
      ['plan', 'enterprise'],
      ['var.seats', '9'],
      ['pr-plan', 'growth'],
    ];
    const { selection, diagnostics } = selectionFromSearchParams(acme, entries, { prefix: 'pr-' });
    expect(selection.planId).toBe('growth');
    expect(selection.variables.seats).toBe(5);
    expect(diagnostics).toEqual([]);
  });

  // [utest->req~search-params-prefix~1]
  it('ignores prefixed keys without the prefix option', () => {
    const { selectionFromSearchParams } = api();
    const { selection } = selectionFromSearchParams(acme, [['pr-plan', 'growth']]);
    expect(selection.planId).toBe('starter');
  });
});

describe('round trip', () => {
  for (const options of [undefined, { prefix: 'pr-' }]) {
    // [utest->req~search-params-round-trip~2]
    it(`round-trips the acme selection with options ${JSON.stringify(options)}`, () => {
      const { selectionToSearchParams, selectionFromSearchParams } = api();
      const defaults = createDefaultSelection(acme);
      const selection = reconcileSelection(acme, {
        ...defaults,
        planId: 'enterprise',
        billingPeriod: 'yearly',
        variables: { ...defaults.variables, seats: 30, region: 'us' },
        addOns: {
          extraStorage: { selected: true, quantity: 4 },
          prioritySuccess: { selected: true, quantity: 1 },
        },
      }).selection;
      const pairs = selectionToSearchParams(selection, options);
      expect(pairs.length).toBeLessThanOrEqual(100);
      const result = selectionFromSearchParams(acme, pairs, options);
      expect(result.selection.planId).toBe('enterprise');
      expect(result.selection.billingPeriod).toBe('yearly');
      expect(result.selection.variables).toEqual(selection.variables);
      expect(selectedQuantities(result.selection)).toEqual(selectedQuantities(selection));
      expect(selectedQuantities(result.selection)).toEqual({ extraStorage: 4, prioritySuccess: 1 });
      expect(result.diagnostics).toEqual([]);
    });
  }

  const variableRows: [string, () => NormalizedPricing, Record<string, unknown>][] = [
    [
      'acme',
      () => acme,
      {
        seats: 30,
        prioritySupport: true,
        region: 'us',
        priceByRegion: { 'eu-price': 8, 'us-price': 12 },
      },
    ],
    ['tiers', () => tiers, { tiers: [4, 5, 6] }],
  ];
  for (const [name, pricingOf, variables] of variableRows) {
    // [utest->req~search-params-round-trip-variables~1]
    it(`round-trips the URL-safe variables of ${name}`, () => {
      const { selectionToSearchParams, selectionFromSearchParams } = api();
      const pricing = pricingOf();
      const selection: PricingSelection = {
        ...createDefaultSelection(pricing),
        variables: structuredClone(variables),
      };
      const pairs = selectionToSearchParams(selection);
      const result = selectionFromSearchParams(pricing, pairs);
      expect(result.selection.variables).toEqual(variables);
      expect(result.diagnostics).toEqual([]);
    });
  }
});

describe('DOM-free signatures', () => {
  // [utest->req~search-params-no-dom~1]
  it('reads a URLSearchParams and writes pairs a URLSearchParams accepts', () => {
    const { selectionToSearchParams, selectionFromSearchParams } = api();
    const { selection } = selectionFromSearchParams(acme, new URLSearchParams('plan=growth'));
    expect(selection.planId).toBe('growth');
    const pairs = selectionToSearchParams(selection);
    expect(Array.isArray(pairs)).toBe(true);
    expect(new URLSearchParams(pairs).get('plan')).toBe('growth');
  });

  // [utest->req~search-params-no-dom~1]
  it('names no DOM type in src/core/search-params.ts', async () => {
    api();
    const url = new URL('../../src/core/search-params.ts', import.meta.url);
    let source = '';
    try {
      source = await readFile(fileURLToPath(url), 'utf8');
    } catch {
      source = '';
    }
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).toContain('selectionFromSearchParams');
    expect(code).toContain('selectionToSearchParams');
    const domTypes = /\b(?:URLSearchParams|URL|Location|Window|Document|History)\b/;
    const domElements = /\b(?:HTMLElement|Element|EventTarget)\b/;
    const domGlobals = /\b(?:window|document|location|history|navigator)\s*\./;
    expect(code).not.toMatch(domTypes);
    expect(code).not.toMatch(domElements);
    expect(code).not.toMatch(domGlobals);
  });
});
