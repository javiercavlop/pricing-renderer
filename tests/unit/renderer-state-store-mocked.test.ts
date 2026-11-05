import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Callback = () => void | (() => void);

// The hook harness of design.md D7: react is replaced by a stand-in that records the effects, and
// the hook is called as a plain function.
const recorded = vi.hoisted(() => ({
  layout: [] as (() => void | (() => void))[],
  passive: [] as (() => void | (() => void))[],
  subscribe: undefined as undefined | ((listener: () => void) => () => void),
  getServerSnapshot: undefined as undefined | (() => unknown),
}));

vi.mock('react', () => ({
  useState: (init: () => unknown) => [init(), () => {}],
  useRef: (value: unknown) => ({ current: value }),
  useMemo: (factory: () => unknown) => factory(),
  useCallback: (callback: unknown) => callback,
  useSyncExternalStore: (
    subscribe: (listener: () => void) => () => void,
    getSnapshot: () => unknown,
    getServerSnapshot?: () => unknown,
  ) => {
    recorded.subscribe = subscribe;
    recorded.getServerSnapshot = getServerSnapshot;
    return getSnapshot();
  },
  useLayoutEffect: (callback: Callback) => {
    recorded.layout.push(callback);
  },
  useEffect: (callback: Callback) => {
    recorded.passive.push(callback);
  },
}));

type Hook = (ref: { current: unknown }) => unknown;
type RendererStateModule = { usePricingRendererState?: Hook };

async function loadHook(): Promise<Hook> {
  vi.resetModules();
  const mod: RendererStateModule = await import('../../src/react/use-renderer-state.js').catch(
    () => ({}),
  );
  expect(mod.usePricingRendererState).toBeTypeOf('function');
  return mod.usePricingRendererState as Hook;
}

function targetWithSpies() {
  return { addEventListener: vi.fn(), removeEventListener: vi.fn() };
}

// Runs every recorded callback of a list and returns the cleanups that they gave back.
function run(list: Callback[]): (() => void)[] {
  const cleanups: (() => void)[] = [];
  for (const callback of list) {
    const cleanup = callback();
    if (typeof cleanup === 'function') cleanups.push(cleanup);
  }
  return cleanups;
}

beforeEach(() => {
  recorded.layout.length = 0;
  recorded.passive.length = 0;
  recorded.subscribe = undefined;
  recorded.getServerSnapshot = undefined;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('usePricingRendererState: attach from the layout effect', () => {
  it('attaches the listeners when only the layout callbacks run', async () => {
    vi.stubGlobal('document', {});
    const usePricingRendererState = await loadHook();
    const target = targetWithSpies();

    const state = usePricingRendererState({ current: target });

    expect(state).toBeUndefined();
    expect(recorded.subscribe).toBeTypeOf('function');
    expect(recorded.getServerSnapshot?.()).toBeUndefined();
    expect(target.addEventListener).not.toHaveBeenCalled();

    run(recorded.layout);

    const types = target.addEventListener.mock.calls.map((call) => call[0]);
    expect(types).toContain('pricing-ready');
    expect(types).toContain('pricing-selection-change');
    expect(recorded.passive).toHaveLength(0);
  });

  it('removes the listeners when the layout cleanup runs', async () => {
    vi.stubGlobal('document', {});
    const usePricingRendererState = await loadHook();
    const target = targetWithSpies();

    usePricingRendererState({ current: target });
    const cleanups = run(recorded.layout);
    expect(target.addEventListener).toHaveBeenCalled();
    expect(target.removeEventListener).not.toHaveBeenCalled();

    for (const cleanup of cleanups) cleanup();

    // Removal by removeEventListener, or by aborting a signal given to addEventListener.
    const removed = target.removeEventListener.mock.calls.map((call) => call[0]);
    const signals = target.addEventListener.mock.calls.map((call) => call[2]?.signal);
    const aborted = signals.length > 0 && signals.every((signal) => signal?.aborted === true);
    const removedBoth =
      removed.includes('pricing-ready') && removed.includes('pricing-selection-change');
    expect(aborted || removedBoth).toBe(true);
  });

  it('attaches nothing when the ref is empty', async () => {
    vi.stubGlobal('document', {});
    const usePricingRendererState = await loadHook();

    const state = usePricingRendererState({ current: null });
    expect(() => run(recorded.layout)).not.toThrow();

    expect(state).toBeUndefined();
  });

  it('records a passive effect and no layout effect without a document', async () => {
    vi.stubGlobal('document', undefined);
    const usePricingRendererState = await loadHook();
    const target = targetWithSpies();

    usePricingRendererState({ current: target });
    run(recorded.layout);

    expect(recorded.layout).toHaveLength(0);
    expect(recorded.passive.length).toBeGreaterThan(0);
    expect(target.addEventListener).not.toHaveBeenCalled();
  });
});
