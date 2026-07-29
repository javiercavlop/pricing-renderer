import { describe, expect, it, vi } from 'vitest';
import { loadPricingFromUrl } from '../../src/yaml/index.js';

const minimalYaml = `
syntaxVersion: "3.1"
saasName: Remote pricing
plans:
  free:
    price: 0
`;

describe('remote pricing loading', () => {
  it('uses anonymous credentials by default and resolves asynchronous headers', async () => {
    const fetchMock = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      expect(init?.credentials).toBe('omit');
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer refreshed');
      return new Response(minimalYaml, {
        status: 200,
        headers: { 'content-type': 'text/yaml' },
      });
    });
    const result = await loadPricingFromUrl('https://example.com/pricing.yml', {
      headers: async () => ({ Authorization: 'Bearer refreshed' }),
      fetch: fetchMock as typeof fetch,
    });
    expect(result.ok).toBe(true);
    expect(result.value?.metadata.saasName).toBe('Remote pricing');
  });

  it('supports a private-source loader without exposing its auth contract', async () => {
    const loader = vi.fn(async ({ signal }) => {
      expect(signal.aborted).toBe(false);
      return minimalYaml;
    });
    const result = await loadPricingFromUrl('https://private.example.com/pricing.yml', {
      loadPricing: loader,
      headers: { Authorization: 'Bearer secret' },
    });
    expect(result.ok).toBe(true);
    expect(loader).toHaveBeenCalledOnce();
    expect(JSON.stringify(result.diagnostics)).not.toContain('secret');
  });

  it('rejects unsafe protocols and oversized bodies', async () => {
    const unsafe = await loadPricingFromUrl('file:///etc/passwd');
    expect(unsafe.diagnostics[0]?.code).toBe('PR_SOURCE_PROTOCOL_INVALID');

    const oversized = await loadPricingFromUrl('https://example.com/pricing.yml', {
      maxBytes: 10,
      fetch: vi.fn(async () => new Response(minimalYaml)) as typeof fetch,
    });
    expect(oversized.diagnostics[0]?.code).toBe('PR_SOURCE_TOO_LARGE');
  });
});
