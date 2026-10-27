import { describe, expect, it, vi } from 'vitest';
import { loadPricingFromUrl } from '../../src/yaml/index.js';

const URL_SOURCE = 'https://private.example.com/pricing.yml';

const yamlWithNote = (note: string) => `
syntaxVersion: "3.1"
saasName: Loader pricing
plans:
  free:
    price: 0
# ${note}
`;

function yamlOfBytes(bytes: number): string {
  const size = new TextEncoder().encode(yamlWithNote('')).length;
  return yamlWithNote('a'.repeat(bytes - size));
}

// [utest->req~custom-loader-max-bytes~1]
describe('maxBytes for a custom loader', () => {
  it('measures a string result in UTF-8 bytes, not characters', async () => {
    const tooLarge = await loadPricingFromUrl(URL_SOURCE, {
      maxBytes: 10,
      loadPricing: async () => 'ééééé' + 'a',
    });
    expect(tooLarge.ok).toBe(false);
    expect(tooLarge.diagnostics).toHaveLength(1);
    expect(tooLarge.diagnostics[0]).toMatchObject({
      code: 'PR_SOURCE_TOO_LARGE',
      severity: 'error',
      path: '$',
    });

    const exact = await loadPricingFromUrl(URL_SOURCE, {
      maxBytes: 10,
      loadPricing: async () => 'ééééé',
    });
    expect(exact.diagnostics.map((item) => item.code)).not.toContain('PR_SOURCE_TOO_LARGE');
  });

  it('accepts a string of exactly maxBytes and rejects one byte more', async () => {
    const limit = 400;
    const exact = yamlOfBytes(limit);
    expect(new TextEncoder().encode(exact).length).toBe(limit);
    const ok = await loadPricingFromUrl(URL_SOURCE, {
      maxBytes: limit,
      loadPricing: async () => exact,
    });
    expect(ok.ok).toBe(true);

    const over = await loadPricingFromUrl(URL_SOURCE, {
      maxBytes: limit,
      loadPricing: async () => yamlOfBytes(limit + 1),
    });
    expect(over.ok).toBe(false);
    expect(over.diagnostics[0]?.code).toBe('PR_SOURCE_TOO_LARGE');
  });

  it('applies the 2 MiB default and does not measure object results', async () => {
    const limit = 2 * 1024 * 1024;
    const oversized = await loadPricingFromUrl(URL_SOURCE, {
      loadPricing: async () => 'a'.repeat(limit + 1),
    });
    expect(oversized.ok).toBe(false);
    expect(oversized.diagnostics[0]?.code).toBe('PR_SOURCE_TOO_LARGE');

    const object = await loadPricingFromUrl(URL_SOURCE, {
      maxBytes: 10,
      loadPricing: async () => ({
        syntaxVersion: '3.1',
        saasName: 'Loader pricing',
        plans: { free: { price: 0 } },
      }),
    });
    expect(object.ok).toBe(true);
    expect(object.diagnostics.map((item) => item.code)).not.toContain('PR_SOURCE_TOO_LARGE');
  });

  it('does not parse an oversized string', async () => {
    const loader = vi.fn(async () => ': [ not yaml '.repeat(10));
    const result = await loadPricingFromUrl(URL_SOURCE, { maxBytes: 5, loadPricing: loader });
    expect(result.diagnostics.map((item) => item.code)).toEqual(['PR_SOURCE_TOO_LARGE']);
  });
});
