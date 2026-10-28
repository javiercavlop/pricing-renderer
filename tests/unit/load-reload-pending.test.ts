// [utest->req~load-timeout-covers-every-step~1]
import { describe, expect, it, vi } from 'vitest';
import { loadPricingFromUrl } from '../../src/yaml/index.js';

const URL_SOURCE = 'https://pricing.example.com/pricing.yml';

const validYaml = `
syntaxVersion: "3.1"
saasName: Reload pricing
plans:
  free:
    price: 0
`;

function neverSettles<T>(): Promise<T> {
  return new Promise<T>(() => {});
}

describe('a load started while another is pending', () => {
  it('calls the loader in the same turn as the call', () => {
    const loadPricing = vi.fn(() => neverSettles<string>());
    void loadPricingFromUrl(URL_SOURCE, { loadPricing });
    expect(loadPricing).toHaveBeenCalledTimes(1);
  });

  it('calls fetch in the same turn as the call', () => {
    const fetchSpy = vi.fn(() => neverSettles<Response>());
    void loadPricingFromUrl(URL_SOURCE, { fetch: fetchSpy as unknown as typeof fetch });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('calls both loaders once when the first load is aborted before the second starts', () => {
    const firstLoader = vi.fn(() => neverSettles<string>());
    const secondLoader = vi.fn(() => neverSettles<string>());
    const first = new AbortController();
    void loadPricingFromUrl(URL_SOURCE, { loadPricing: firstLoader, signal: first.signal });
    first.abort();
    void loadPricingFromUrl(URL_SOURCE, { loadPricing: secondLoader });
    expect(firstLoader).toHaveBeenCalledTimes(1);
    expect(secondLoader).toHaveBeenCalledTimes(1);
  });

  it('still reports an abort that happens after the load started', async () => {
    const controller = new AbortController();
    const call = loadPricingFromUrl(URL_SOURCE, {
      loadPricing: () => neverSettles<string>(),
      signal: controller.signal,
    });
    controller.abort();
    const result = await call;
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.code).toBe('PR_SOURCE_ABORTED');
  });

  it('does not call the loader when the signal is already aborted', async () => {
    const loadPricing = vi.fn(async () => validYaml);
    const controller = new AbortController();
    controller.abort();
    const result = await loadPricingFromUrl(URL_SOURCE, {
      loadPricing,
      signal: controller.signal,
    });
    expect(result.diagnostics[0]?.code).toBe('PR_SOURCE_ABORTED');
    expect(loadPricing).not.toHaveBeenCalled();
  });
});
