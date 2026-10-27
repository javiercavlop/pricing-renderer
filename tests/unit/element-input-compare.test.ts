// The Lit hasChanged of pricing, request and normalizeOptions is read from the element class, and the
// compare it uses (src/element/same-input.ts) is tested directly.
import { beforeAll, describe, expect, it } from 'vitest';

type SameInput = typeof import('../../src/element/same-input.js');

// Loaded in beforeAll, so a missing module shows as a failed expectation in each test.
let compare: SameInput | undefined;
beforeAll(async () => {
  compare = await import('../../src/element/same-input.js').catch(() => undefined);
});

function sameInput(left: unknown, right: unknown): boolean {
  expect(compare, 'src/element/same-input.ts should export sameInput').toBeDefined();
  return compare!.sameInput(left, right);
}

function inputChanged(value: unknown, previous: unknown): boolean {
  expect(compare, 'src/element/same-input.ts should export inputChanged').toBeDefined();
  return compare!.inputChanged(value, previous);
}

type Options = { hasChanged?: (value: unknown, previous: unknown) => boolean };

async function propertyOptions(name: string): Promise<Options | undefined> {
  const loaded: unknown = await import('../../src/element/pricing-renderer-element.js');
  const Element = (
    loaded as {
      PricingRendererElement: { finalize(): void; elementProperties: Map<string, Options> };
    }
  ).PricingRendererElement;
  Element.finalize();
  return Element.elementProperties.get(name);
}

class Box {
  constructor(readonly value: number) {}
}

// [utest->req~element-input-structural-compare~1]
describe('sameInput', () => {
  it('compares primitives with Object.is', () => {
    expect(sameInput(1, 1)).toBe(true);
    expect(sameInput('a', 'a')).toBe(true);
    expect(sameInput(1, 2)).toBe(false);
    expect(sameInput(undefined, null)).toBe(false);
    expect(sameInput(Number.NaN, Number.NaN)).toBe(true);
    expect(sameInput(0, -0)).toBe(false);
    expect(sameInput({}, undefined)).toBe(false);
    expect(sameInput(undefined, {})).toBe(false);
  });

  it('compares arrays and plain objects by content, deeply', () => {
    expect(sameInput({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(sameInput({ a: [1, { b: 2 }] }, { a: [1, { b: 3 }] })).toBe(false);
    expect(sameInput([1, 2], [1, 2, 3])).toBe(false);
    expect(sameInput({ a: 1 }, { a: 1, b: undefined })).toBe(false);
    expect(sameInput({ a: undefined }, { b: undefined })).toBe(false);
    expect(sameInput([1], { 0: 1 })).toBe(false);
  });

  it('treats a null-prototype object as plain', () => {
    const left = Object.assign(Object.create(null) as object, { a: 1 });
    const right = Object.assign(Object.create(null) as object, { a: 1 });
    expect(sameInput(left, right)).toBe(true);
    expect(sameInput(left, { a: 1 })).toBe(true);
  });

  it('compares functions by identity', () => {
    const fn = (): void => undefined;
    expect(sameInput(fn, fn)).toBe(true);
    expect(sameInput(fn, (): void => undefined)).toBe(false);
    expect(sameInput({ headers: fn }, { headers: fn })).toBe(true);
    expect(sameInput({ headers: fn }, { headers: (): void => undefined })).toBe(false);
  });

  it('compares class instances by identity', () => {
    const one = new Headers({ a: '1' });
    expect(sameInput(one, one)).toBe(true);
    expect(sameInput(new Headers({ a: '1' }), new Headers({ a: '1' }))).toBe(false);
    const left = { headers: new Headers({ a: '1' }) };
    const right = { headers: new Headers({ a: '2' }) };
    expect(sameInput(left, right)).toBe(false);
    expect(sameInput(new Box(1), new Box(1))).toBe(false);
    const signal = new AbortController().signal;
    expect(sameInput({ signal }, { signal })).toBe(true);
    expect(sameInput(new AbortController().signal, new AbortController().signal)).toBe(false);
    expect(sameInput(new Date(0), new Date(0))).toBe(false);
  });

  it('does not loop on cycles', () => {
    const left: Record<string, unknown> = { a: 1 };
    left.self = left;
    const right: Record<string, unknown> = { a: 1 };
    right.self = right;
    expect(sameInput(left, left)).toBe(true);
    expect(() => sameInput(left, right)).not.toThrow();
  });
});

describe('hasChanged of the loading inputs', () => {
  it.each(['pricing', 'request', 'normalizeOptions'])(
    '%s does not change for a structurally equal value',
    async (name) => {
      const options = await propertyOptions(name);
      expect(options?.hasChanged).toBeTypeOf('function');
      const changed = options!.hasChanged!;
      expect(changed({ a: [1, 2] }, { a: [1, 2] })).toBe(false);
      expect(changed({ a: [1, 2] }, { a: [1, 3] })).toBe(true);
      expect(changed(undefined, { a: 1 })).toBe(true);
      expect(changed({ a: 1 }, undefined)).toBe(true);
      expect(changed(undefined, undefined)).toBe(false);
    },
  );

  it('request changes when a header object or a signal is replaced', async () => {
    const changed = (await propertyOptions('request'))!.hasChanged!;
    const first = { headers: new Headers({ a: '1' }) };
    const second = { headers: new Headers({ a: '1' }) };
    expect(changed(first, second)).toBe(true);
    const signal = new AbortController().signal;
    expect(changed({ signal }, { signal })).toBe(false);
    const headers = (): Record<string, string> => ({});
    expect(changed({ headers }, { headers })).toBe(false);
    expect(changed({ headers }, { headers: () => ({}) })).toBe(true);
  });

  it('normalizeOptions changes when a value inside is replaced', async () => {
    const changed = (await propertyOptions('normalizeOptions'))!.hasChanged!;
    expect(changed({ strict: true }, { strict: true })).toBe(false);
    expect(changed({ strict: true }, { strict: false })).toBe(true);
  });

  it.each(['loadPricing', 'yaml', 'src'])('%s keeps the identity compare', async (name) => {
    // no custom hasChanged: Lit falls back to its identity compare
    expect((await propertyOptions(name))?.hasChanged).toBeUndefined();
  });

  it('reload() still loads with an equal request', async () => {
    const loaded: unknown = await import('../../src/element/pricing-renderer-element.js');
    const Element = (
      loaded as {
        PricingRendererElement: new () => {
          src?: string;
          request?: unknown;
          loadPricing?: () => Promise<unknown>;
          reload(): Promise<void>;
          requestUpdate: () => void;
          dispatchEvent: () => boolean;
        };
      }
    ).PricingRendererElement;
    const element = new Element();
    element.requestUpdate = () => undefined;
    element.dispatchEvent = () => true;
    let calls = 0;
    element.src = 'https://example.com/pricing.yml';
    element.request = { credentials: 'omit' };
    element.loadPricing = async () => {
      calls += 1;
      return { syntaxVersion: '3.1', saasName: 'Equal', plans: {} };
    };
    await element.reload();
    element.request = { credentials: 'omit' };
    await element.reload();
    expect(calls).toBe(2);
  });

  it('inputChanged is the negation of sameInput', () => {
    expect(inputChanged({ a: 1 }, { a: 1 })).toBe(false);
    expect(inputChanged({ a: 1 }, { a: 2 })).toBe(true);
  });
});
