import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SSR-safe entrypoints', () => {
  it('imports the core without DOM globals', async () => {
    const core = await import('../../src/core/index.js');
    expect(core.normalizePricing).toBeTypeOf('function');
  });

  it('imports the React adapter without a customElements registry', async () => {
    expect(globalThis.customElements).toBeUndefined();
    const react = await import('../../src/react/index.js');
    expect(react.PricingRenderer).toBeTruthy();
  });

  // [utest->req~react-headless-entry~1]
  it('imports the headless React entry without defining an element', async () => {
    const define = vi.fn();
    vi.stubGlobal('customElements', { define, get: vi.fn() });
    const headless = (await import('../../src/react/headless.js').catch(() => ({}))) as Record<
      string,
      unknown
    >;
    expect(headless.PricingRendererProvider).toBeTypeOf('function');
    expect(define).not.toHaveBeenCalled();
  });

  // [utest->req~react-headless-entry~1]
  it('imports the headless React entry without a customElements registry', async () => {
    expect(globalThis.customElements).toBeUndefined();
    const headless = (await import('../../src/react/headless.js').catch(() => ({}))) as Record<
      string,
      unknown
    >;
    expect(headless.PricingRendererProvider).toBeTypeOf('function');
  });
});
