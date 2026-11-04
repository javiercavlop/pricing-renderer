// The element is built in the node environment with stand-ins for the DOM calls of its add-on
// dialog path; the core rules are covered by tests/unit/selection-change.test.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PricingSelection } from '../../src/core/index.js';

interface PendingChange {
  addOnId: string;
  select: boolean;
  addIds: string[];
  removeIds: string[];
}

interface Host {
  pricing?: unknown;
  variablesEnabled?: unknown;
  reload(): Promise<void>;
  requestUpdate: () => void;
  dispatchEvent: (event: Event) => boolean;
  querySelector: (selector: string) => unknown;
  // private state and handlers of the add-on path
  _status: string;
  _internalSelection?: PricingSelection;
  _pendingAddOnChange?: PendingChange;
  _toggleAddOn: (addOnId: string, selected: boolean) => void;
  _confirmAddOnChange: () => void;
  _effectiveSelection: () => PricingSelection | undefined;
}

// top depends on middle, middle depends on base
const chain = {
  syntaxVersion: '3.1',
  version: '1',
  createdAt: '2026-01-01',
  currency: 'EUR',
  saasName: 'Chain',
  plans: { basic: { price: 10 } },
  addOns: {
    base: { price: 1 },
    middle: { price: 1, dependsOn: ['base'] },
    top: { price: 1, dependsOn: ['middle'] },
  },
};

const withVariables = {
  syntaxVersion: '3.1',
  version: '1',
  createdAt: '2026-01-01',
  currency: 'EUR',
  saasName: 'Variables',
  variables: { seats: 5 },
  plans: { basic: { price: 10 } },
};

async function ready(pricing: unknown): Promise<Host> {
  const loaded: unknown = await import('../../src/element/pricing-renderer-element.js');
  const Element = (loaded as { PricingRendererElement: new () => Host }).PricingRendererElement;
  const element = new Element();
  element.requestUpdate = () => undefined;
  element.dispatchEvent = () => true;
  element.querySelector = () => null;
  Object.defineProperty(element, 'ownerDocument', { value: { activeElement: null } });
  Object.defineProperty(element, 'updateComplete', { value: Promise.resolve(true) });
  element.pricing = pricing;
  await element.reload();
  expect(element._status).toBe('ready');
  return element;
}

beforeEach(() => {
  // the dialog path checks the focused element with instanceof HTMLElement
  vi.stubGlobal('HTMLElement', class {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// [utest->req~core-addon-select-change~1]
describe('selecting an add-on with a two-level dependsOn chain in the element', () => {
  it('asks to add the whole chain and selects it on confirm', async () => {
    const element = await ready(chain);
    for (const id of ['base', 'middle', 'top']) {
      expect(element._internalSelection?.addOns[id]?.selected ?? false).toBe(false);
    }

    element._toggleAddOn('top', true);
    const pending = element._pendingAddOnChange;
    expect(pending).toBeDefined();
    expect(pending?.addOnId).toBe('top');
    expect(pending?.select).toBe(true);
    expect([...(pending?.addIds ?? [])].sort()).toEqual(['base', 'middle']);
    expect(pending?.removeIds).toEqual([]);

    element._confirmAddOnChange();
    expect(element._pendingAddOnChange).toBeUndefined();
    for (const id of ['base', 'middle', 'top']) {
      expect(element._internalSelection?.addOns[id]?.selected, id).toBe(true);
    }
  });
});

// [utest->req~core-selection-in-effect~1]
describe('the selection in effect of the element follows variablesEnabled', () => {
  it.each([undefined, null, 0, ''])('uses the pricing variables for %j', async (value) => {
    const element = await ready(withVariables);
    element._internalSelection = { ...element._internalSelection!, variables: { seats: 40 } };
    element.variablesEnabled = value;
    expect(element._effectiveSelection()?.variables).toEqual({ seats: 5 });
  });

  it('uses the selection variables for true', async () => {
    const element = await ready(withVariables);
    element._internalSelection = { ...element._internalSelection!, variables: { seats: 40 } };
    element.variablesEnabled = true;
    expect(element._effectiveSelection()?.variables).toEqual({ seats: 40 });
  });
});
