import { describe, expect, it } from 'vitest';

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
});
