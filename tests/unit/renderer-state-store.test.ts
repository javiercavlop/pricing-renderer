import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createDefaultSelection, resolvePricing } from '../../src/core/index.js';
import type { NormalizedPricing, PricingSelection } from '../../src/core/index.js';
import { parsePricingYaml } from '../../src/yaml/index.js';

type Snapshot = {
  pricing: NormalizedPricing;
  selection: PricingSelection;
  resolved: unknown;
  applySelection: (input: Partial<PricingSelection>) => unknown;
};
type Store = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => Snapshot | undefined;
  getServerSnapshot: () => Snapshot | undefined;
  attach: (target: EventTarget | null) => void;
  detach: () => void;
  applySelection: (input: Partial<PricingSelection>) => unknown;
};
type RendererStateModule = {
  createRendererStateStore?: () => Store;
  usePricingRendererState?: (ref: { current: EventTarget | null }) => Snapshot | undefined;
};

// The module does not exist on the base of this change: the import falls back to an empty
// namespace so each test fails on an assertion, not on a module resolution error.
const mod: RendererStateModule = await import('../../src/react/use-renderer-state.js').catch(
  () => ({}),
);

function createStore(): Store {
  expect(mod.createRendererStateStore).toBeTypeOf('function');
  return (mod.createRendererStateStore as () => Store)();
}

const acme = parsePricingYaml(
  readFileSync(new URL('../fixtures/acme-pricing.yml', import.meta.url), 'utf8'),
).value as NormalizedPricing;

function selectionOf(planId: string): PricingSelection {
  return { ...createDefaultSelection(acme), planId };
}

function readyEvent(planId = 'starter'): Event {
  const selection = selectionOf(planId);
  return Object.assign(new Event('pricing-ready'), {
    detail: {
      pricing: acme,
      diagnostics: [],
      selection,
      resolved: resolvePricing(acme, selection),
    },
  });
}

function changeEvent(planId: string): Event {
  const selection = selectionOf(planId);
  return Object.assign(new Event('pricing-selection-change'), {
    detail: { selection, resolved: resolvePricing(acme, selection) },
  });
}

// [utest->req~renderer-state-events~1]
describe('renderer state store: element events', () => {
  it('follows pricing-ready and then pricing-selection-change', () => {
    const store = createStore();
    const target = new EventTarget();
    store.attach(target);
    expect(store.getSnapshot()).toBeUndefined();

    target.dispatchEvent(readyEvent('starter'));
    const afterReady = store.getSnapshot();
    expect(afterReady?.pricing.metadata.saasName).toBe('Acme Cloud');
    expect(afterReady?.selection.planId).toBe('starter');

    target.dispatchEvent(changeEvent('growth'));
    const afterChange = store.getSnapshot();
    expect(afterChange?.pricing.metadata.saasName).toBe('Acme Cloud');
    expect(afterChange?.pricing).toBe(afterReady?.pricing);
    expect(afterChange?.selection.planId).toBe('growth');
    expect(afterChange?.resolved).toEqual(resolvePricing(acme, selectionOf('growth')));
  });

  it('replaces the snapshot by a new object on each event', () => {
    const store = createStore();
    const target = new EventTarget();
    store.attach(target);
    target.dispatchEvent(readyEvent('starter'));
    const first = store.getSnapshot();
    target.dispatchEvent(readyEvent('starter'));
    const second = store.getSnapshot();
    expect(second).toBeDefined();
    expect(second).not.toBe(first);
    target.dispatchEvent(changeEvent('growth'));
    expect(store.getSnapshot()).not.toBe(second);
  });

  it('keeps the snapshot undefined for a pricing-selection-change before any pricing-ready', () => {
    const store = createStore();
    const target = new EventTarget();
    store.attach(target);
    target.dispatchEvent(changeEvent('growth'));
    expect(store.getSnapshot()).toBeUndefined();
    target.dispatchEvent(readyEvent('starter'));
    expect(store.getSnapshot()?.selection.planId).toBe('starter');
  });

  it('needs a pricing-ready seen since the last attach', () => {
    const store = createStore();
    const a = new EventTarget();
    const b = new EventTarget();
    store.attach(a);
    a.dispatchEvent(readyEvent('starter'));
    expect(store.getSnapshot()).toBeDefined();
    store.attach(b);
    b.dispatchEvent(changeEvent('growth'));
    expect(store.getSnapshot()).toBeUndefined();
  });

  it('calls each subscriber once per event', () => {
    const store = createStore();
    const target = new EventTarget();
    store.attach(target);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    target.dispatchEvent(readyEvent('starter'));
    expect(listener).toHaveBeenCalledTimes(1);
    target.dispatchEvent(changeEvent('growth'));
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    target.dispatchEvent(changeEvent('starter'));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('ignores events after detach and goes back to undefined', () => {
    const store = createStore();
    const target = new EventTarget();
    store.attach(target);
    target.dispatchEvent(readyEvent('starter'));
    expect(store.getSnapshot()).toBeDefined();
    store.detach();
    expect(store.getSnapshot()).toBeUndefined();
    target.dispatchEvent(readyEvent('growth'));
    expect(store.getSnapshot()).toBeUndefined();
  });

  it('keeps the snapshot when the same target is attached again', () => {
    const store = createStore();
    const target = new EventTarget();
    store.attach(target);
    target.dispatchEvent(readyEvent('starter'));
    const before = store.getSnapshot();
    store.attach(target);
    expect(store.getSnapshot()).toBe(before);
    target.dispatchEvent(changeEvent('growth'));
    expect(store.getSnapshot()?.selection.planId).toBe('growth');
  });
});

// [utest->req~renderer-state-cached-snapshot~1]
describe('renderer state store: cached snapshot', () => {
  it('returns the identical snapshot from repeated reads', () => {
    const store = createStore();
    const target = new EventTarget();
    store.attach(target);
    target.dispatchEvent(readyEvent('starter'));
    const first = store.getSnapshot();
    expect(first).toBeDefined();
    for (let i = 0; i < 100; i += 1) {
      expect(Object.is(store.getSnapshot(), first)).toBe(true);
    }
  });

  it('returns the identical undefined snapshot before any event', () => {
    const store = createStore();
    store.attach(new EventTarget());
    expect(store.getSnapshot()).toBeUndefined();
    expect(store.getSnapshot()).toBeUndefined();
  });
});

// [utest->req~renderer-state-server-snapshot~1]
describe('renderer state store: server snapshot', () => {
  it('returns undefined from getServerSnapshot', () => {
    const store = createStore();
    const target = new EventTarget();
    store.attach(target);
    target.dispatchEvent(readyEvent('starter'));
    expect(store.getServerSnapshot()).toBeUndefined();
  });

  it('renders undefined with react-dom/server and an empty ref', () => {
    expect(mod.usePricingRendererState).toBeTypeOf('function');
    const usePricingRendererState = mod.usePricingRendererState as NonNullable<
      RendererStateModule['usePricingRendererState']
    >;
    function Probe() {
      const ref = { current: null };
      return createElement('p', null, String(usePricingRendererState(ref)));
    }
    expect(renderToString(createElement(Probe))).toContain('undefined');
  });
});

// [utest->req~renderer-state-ref-change~1]
describe('renderer state store: new ref target', () => {
  it('moves the listeners from the old target to the new one', () => {
    const store = createStore();
    const a = new EventTarget();
    const b = new EventTarget();
    store.attach(a);
    store.attach(b);
    expect(store.getSnapshot()).toBeUndefined();

    a.dispatchEvent(changeEvent('growth'));
    a.dispatchEvent(readyEvent('growth'));
    expect(store.getSnapshot()).toBeUndefined();

    b.dispatchEvent(readyEvent('starter'));
    expect(store.getSnapshot()?.selection.planId).toBe('starter');
  });

  it('starts again from an undefined snapshot on the new target', () => {
    const store = createStore();
    const a = new EventTarget();
    const b = new EventTarget();
    store.attach(a);
    a.dispatchEvent(readyEvent('growth'));
    expect(store.getSnapshot()).toBeDefined();
    store.attach(b);
    expect(store.getSnapshot()).toBeUndefined();
  });

  it('treats attach(null) as detach', () => {
    const store = createStore();
    const target = new EventTarget();
    store.attach(target);
    target.dispatchEvent(readyEvent('starter'));
    store.attach(null);
    expect(store.getSnapshot()).toBeUndefined();
    target.dispatchEvent(readyEvent('growth'));
    expect(store.getSnapshot()).toBeUndefined();
  });
});

// [utest->req~renderer-state-early-listen~1]
describe('renderer state store: early listening', () => {
  it('receives a pricing-ready queued as a microtask after attach', async () => {
    const store = createStore();
    const target = new EventTarget();
    queueMicrotask(() => {
      target.dispatchEvent(readyEvent('starter'));
    });
    store.attach(target);
    expect(store.getSnapshot()).toBeUndefined();
    await Promise.resolve();
    expect(store.getSnapshot()?.pricing.metadata.saasName).toBe('Acme Cloud');
  });
});

type ApplyResult = {
  applied: boolean;
  selection: PricingSelection | undefined;
  resolved: unknown;
  removedAddOnIds: string[];
  diagnostics: unknown[];
};

// An element stand-in: an EventTarget with an `applySelection` that dispatches nothing.
function elementStandIn(initial: () => ApplyResult) {
  const target = new EventTarget() as EventTarget & {
    applySelection: ReturnType<typeof vi.fn>;
  };
  target.applySelection = vi.fn(initial);
  return target;
}

function appliedResult(planId: string): ApplyResult {
  const selection = selectionOf(planId);
  return {
    applied: true,
    selection,
    resolved: resolvePricing(acme, selection),
    removedAddOnIds: [],
    diagnostics: [],
  };
}

// [utest->req~renderer-state-apply~1]
describe('renderer state store: applySelection', () => {
  it('replaces the snapshot with the applied result and notifies once', () => {
    const store = createStore();
    const target = elementStandIn(() => appliedResult('enterprise'));
    store.attach(target);
    target.dispatchEvent(readyEvent('starter'));
    const listener = vi.fn();
    store.subscribe(listener);

    const snapshot = store.getSnapshot();
    expect(snapshot).toBeDefined();
    const result = (snapshot as Snapshot).applySelection({ planId: 'enterprise' });

    expect(target.applySelection).toHaveBeenCalledTimes(1);
    expect(target.applySelection).toHaveBeenCalledWith({ planId: 'enterprise' });
    expect((result as ApplyResult).applied).toBe(true);
    expect(store.getSnapshot()?.selection.planId).toBe('enterprise');
    expect(store.getSnapshot()?.pricing.metadata.saasName).toBe('Acme Cloud');
    expect(store.getSnapshot()).not.toBe(snapshot);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('keeps the snapshot when the element refuses the apply', () => {
    const store = createStore();
    const target = elementStandIn(() => appliedResult('enterprise'));
    store.attach(target);
    target.dispatchEvent(readyEvent('starter'));
    const refused: ApplyResult = {
      applied: false,
      selection: undefined,
      resolved: undefined,
      removedAddOnIds: [],
      diagnostics: [],
    };
    target.applySelection.mockImplementation(() => refused);
    const listener = vi.fn();
    store.subscribe(listener);
    const before = store.getSnapshot();

    const result = store.applySelection({ planId: 'growth' });

    expect(result).toBe(refused);
    expect(store.getSnapshot()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
  });

  it('returns undefined without an element', () => {
    const never = createStore();
    expect(never.applySelection({ planId: 'growth' })).toBeUndefined();

    const detached = createStore();
    const target = elementStandIn(() => appliedResult('growth'));
    detached.attach(target);
    detached.detach();
    expect(detached.applySelection({ planId: 'growth' })).toBeUndefined();
    expect(target.applySelection).not.toHaveBeenCalled();
  });
});
