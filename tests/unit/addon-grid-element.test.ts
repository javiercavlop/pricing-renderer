// Known coverage limits of this file:
// - The element is loaded in the node environment, so no render happens here. The reset of the
//   add-on search and of the revealed list on a new pricing is covered only in the browser spec
//   tests/browser/spectra-addon-grid.spec.ts.
import { describe, expect, it } from 'vitest';
import {
  addOnFilterThresholdOf,
  DEFAULT_ADDON_FILTER_THRESHOLD,
} from '../../src/element/renderers.js';

interface ElementClass {
  properties: Record<string, { attribute?: string | false; type?: unknown }>;
  new (): { addOnFilterThreshold: number };
}

async function loadElement(): Promise<ElementClass> {
  const loaded: unknown = await import('../../src/element/pricing-renderer-element.js');
  return (loaded as { PricingRendererElement: ElementClass }).PricingRendererElement;
}

// [utest->req~addon-grid-threshold-attribute~1]
describe('addOnFilterThreshold property', () => {
  it('maps the add-on-filter-threshold attribute to a number', async () => {
    const element = await loadElement();
    const entry = element.properties.addOnFilterThreshold;
    expect(entry?.attribute).toBe('add-on-filter-threshold');
    expect(entry?.type).toBe(Number);
  });

  it('defaults to 13 on a new element', async () => {
    const Element = await loadElement();
    expect(DEFAULT_ADDON_FILTER_THRESHOLD).toBe(13);
    expect(new Element().addOnFilterThreshold).toBe(13);
  });

  it('treats an invalid value as 13', async () => {
    const Element = await loadElement();
    const element = new Element();
    for (const invalid of [Number('abc'), Number.NaN, -1, -0.5, Infinity, undefined, null, 'abc']) {
      expect(addOnFilterThresholdOf(invalid), String(invalid)).toBe(13);
      (element as { addOnFilterThreshold: unknown }).addOnFilterThreshold = invalid;
      expect(addOnFilterThresholdOf(element.addOnFilterThreshold), String(invalid)).toBe(13);
    }
  });

  it('keeps a valid value, including 0', () => {
    expect(addOnFilterThresholdOf(0)).toBe(0);
    expect(addOnFilterThresholdOf(5)).toBe(5);
    expect(addOnFilterThresholdOf(99)).toBe(99);
  });
});

// [utest->req~addon-grid-cap~1]
describe('add-on cap state', () => {
  it('starts with the cap on, so the list is not revealed on a new element', async () => {
    const Element = await loadElement();
    const element = new Element() as unknown as { _addOnSearch: string; _addOnsRevealed: boolean };
    expect(element._addOnSearch).toBe('');
    expect(element._addOnsRevealed).toBe(false);
  });
});
