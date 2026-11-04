import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import * as yamlEntry from '../../src/yaml/index.js';

type SourceResult = {
  ok: boolean;
  value?: { metadata: { saasName: string } };
  diagnostics: { code: string; severity: string; path?: string }[];
};
type Loader = (call: {
  url: string;
  signal: AbortSignal;
  request: { maxBytes?: number; timeoutMs?: number };
}) => Promise<string>;
type LoadPricingSource = (
  input: { pricing?: unknown; yaml?: string; src?: string },
  options?: { request?: { maxBytes?: number }; loadPricing?: Loader; signal?: AbortSignal },
) => SourceResult | Promise<SourceResult>;

const ns = yamlEntry as unknown as { loadPricingSource?: LoadPricingSource };

function loadPricingSource(...args: Parameters<LoadPricingSource>) {
  expect(ns.loadPricingSource).toBeTypeOf('function');
  return (ns.loadPricingSource as LoadPricingSource)(...args);
}

const acmeYaml = readFileSync(new URL('../fixtures/acme-pricing.yml', import.meta.url), 'utf8');
const ACME_URL = 'https://example.com/acme.yml';

function isPromise(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

// [utest->req~load-source-one-source~1]
describe('loadPricingSource: exactly one source', () => {
  it('returns a synchronous PR_SOURCE_MISSING for an empty src, without loading', () => {
    const loadPricing = vi.fn<Loader>(async () => acmeYaml);
    const result = loadPricingSource({ src: '' }, { loadPricing });
    expect(isPromise(result)).toBe(false);
    const failed = result as SourceResult;
    expect(failed.ok).toBe(false);
    expect(failed.value).toBeUndefined();
    expect(failed.diagnostics).toHaveLength(1);
    expect(failed.diagnostics[0]).toMatchObject({
      code: 'PR_SOURCE_MISSING',
      severity: 'error',
      path: '$',
    });
    expect(loadPricing).not.toHaveBeenCalled();
  });

  it('returns PR_SOURCE_MISSING for an empty input', () => {
    const result = loadPricingSource({}, {});
    expect(isPromise(result)).toBe(false);
    expect((result as SourceResult).diagnostics.map((d) => d.code)).toEqual(['PR_SOURCE_MISSING']);
  });

  it('returns a synchronous PR_SOURCE_CONFLICT for yaml and src, without loading', () => {
    const loadPricing = vi.fn<Loader>(async () => acmeYaml);
    const result = loadPricingSource(
      { yaml: 'x', src: 'https://example.com/p.yml' },
      { loadPricing },
    );
    expect(isPromise(result)).toBe(false);
    const failed = result as SourceResult;
    expect(failed.ok).toBe(false);
    expect(failed.diagnostics).toHaveLength(1);
    expect(failed.diagnostics[0]).toMatchObject({
      code: 'PR_SOURCE_CONFLICT',
      severity: 'error',
      path: '$',
    });
    expect(loadPricing).not.toHaveBeenCalled();
  });

  it('returns PR_SOURCE_CONFLICT for pricing and yaml, and for all three sources', () => {
    const loadPricing = vi.fn<Loader>(async () => acmeYaml);
    const both = loadPricingSource({ pricing: {}, yaml: acmeYaml }, { loadPricing });
    const all = loadPricingSource({ pricing: {}, yaml: acmeYaml, src: ACME_URL }, { loadPricing });
    for (const result of [both, all]) {
      expect(isPromise(result)).toBe(false);
      expect((result as SourceResult).diagnostics.map((d) => d.code)).toEqual([
        'PR_SOURCE_CONFLICT',
      ]);
    }
    expect(loadPricing).not.toHaveBeenCalled();
  });

  it('counts an empty yaml string as a defined source', () => {
    const result = loadPricingSource({ yaml: '', src: ACME_URL }, {});
    expect(isPromise(result)).toBe(false);
    expect((result as SourceResult).diagnostics.map((d) => d.code)).toEqual(['PR_SOURCE_CONFLICT']);
  });
});

// [utest->req~load-source-result~1]
describe('loadPricingSource: the one source', () => {
  it('returns a synchronous result for yaml and a promise for src', async () => {
    const loadPricing = vi.fn<Loader>(async () => acmeYaml);
    const controller = new AbortController();

    const inline = loadPricingSource({ yaml: acmeYaml });
    expect(isPromise(inline)).toBe(false);
    expect((inline as SourceResult).ok).toBe(true);
    expect((inline as SourceResult).value?.metadata.saasName).toBe('Acme Cloud');

    const remote = loadPricingSource({ src: ACME_URL }, { loadPricing, signal: controller.signal });
    expect(isPromise(remote)).toBe(true);
    const settled = await remote;
    expect(settled.value?.metadata.saasName).toBe('Acme Cloud');
    expect(loadPricing).toHaveBeenCalledTimes(1);
    const call = loadPricing.mock.calls[0]?.[0];
    expect(call?.url).toBe(ACME_URL);
    expect(call?.signal).toBeInstanceOf(AbortSignal);
  });

  it('gives the loader a signal that follows the signal of the options', async () => {
    let received: AbortSignal | undefined;
    const controller = new AbortController();
    const loadPricing = vi.fn<Loader>(async ({ signal }) => {
      received = signal;
      controller.abort();
      return acmeYaml;
    });
    await loadPricingSource({ src: ACME_URL }, { loadPricing, signal: controller.signal });
    expect(loadPricing).toHaveBeenCalledTimes(1);
    expect(received?.aborted).toBe(true);
  });

  it('returns a synchronous result for pricing', () => {
    const result = loadPricingSource({
      pricing: { syntaxVersion: '3.1', saasName: 'Inline', plans: { free: { price: 0 } } },
    });
    expect(isPromise(result)).toBe(false);
    expect((result as SourceResult).ok).toBe(true);
    expect((result as SourceResult).value?.metadata.saasName).toBe('Inline');
  });

  it('returns a synchronous failed result for invalid yaml', () => {
    const result = loadPricingSource({ yaml: 'a: [unclosed' });
    expect(isPromise(result)).toBe(false);
    expect((result as SourceResult).ok).toBe(false);
    expect((result as SourceResult).diagnostics.length).toBeGreaterThan(0);
  });

  it('passes request as given: maxBytes -1 reaches the loader and refuses the body', async () => {
    const loadPricing = vi.fn<Loader>(async () => acmeYaml);
    const result = await loadPricingSource(
      { src: ACME_URL },
      { loadPricing, request: { maxBytes: -1 } },
    );
    expect(loadPricing).toHaveBeenCalledTimes(1);
    expect(loadPricing.mock.calls[0]?.[0].request.maxBytes).toBe(-1);
    expect(result.value).toBeUndefined();
    expect(result.diagnostics.map((d) => d.code)).toContain('PR_SOURCE_TOO_LARGE');
  });
});

// The element's reload() passes request as given (design.md D5). Built in node with stubs, as
// tests/unit/error-state.test.ts does.
// [utest->req~load-source-result~1]
describe('element reload: request passed as given', () => {
  interface Host {
    src?: string;
    request?: { maxBytes?: number; timeoutMs?: number };
    loadPricing?: Loader;
    requestUpdate: () => void;
    dispatchEvent: (event: Event) => boolean;
    _applyLoadResult: (result: unknown) => void;
    reload(): Promise<void>;
  }

  it('gives the loader maxBytes -1 and timeoutMs NaN unchanged', async () => {
    const loaded: unknown = await import('../../src/element/pricing-renderer-element.js');
    const Element = (loaded as { PricingRendererElement: new () => Host }).PricingRendererElement;
    const element = new Element();
    element.requestUpdate = () => undefined;
    element.dispatchEvent = () => true;
    element._applyLoadResult = () => undefined;
    const loadPricing = vi.fn<Loader>(async () => acmeYaml);
    element.src = ACME_URL;
    element.request = { maxBytes: -1, timeoutMs: Number.NaN };
    element.loadPricing = loadPricing;
    await element.reload();
    expect(loadPricing).toHaveBeenCalledTimes(1);
    const request = loadPricing.mock.calls[0]?.[0].request;
    expect(request?.maxBytes).toBe(-1);
    expect(request?.timeoutMs).toBeNaN();
  });
});
