import { readFileSync } from 'node:fs';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// The hook harness of design D7: `react` is replaced by a stand-in so that `usePricingSource` runs
// as a plain function in node. `useState(init)` returns `[init(), () => {}]`, `useRef(v)` returns
// `{ current: v }`, `useMemo(f)` returns `f()`, `useCallback(f)` returns `f`,
// `useSyncExternalStore(subscribe, getSnapshot)` returns `getSnapshot()`, `useContext(context)`
// returns the value the test assigns to that context object (its default otherwise), and
// `useEffect` and `useLayoutEffect` record their callbacks in two lists that the test runs.
// `createContext(v)` returns a plain object holding `v`.
//
// Names the implementation uses, for the implementer: `usePricingSource` takes ONE argument object
// holding the source fields and the options, `{ pricing?, yaml?, src?, request?, loadPricing?,
// normalizeOptions? }`, and returns `{ status, pricing, diagnostics, reload }`. It reads the
// provider with `useContext(PricingRendererContext)` (internal export of `src/react/provider.ts`)
// and applies `filterProviderRequest(request, src, requestOrigins)` from that module. The scenarios
// that render with the real `react` are in `use-pricing-source.test.ts`.

type Loose = Record<string, unknown>;

const harness = vi.hoisted(() => ({
  effects: [] as Array<() => unknown>,
  layoutEffects: [] as Array<() => unknown>,
  contextValues: new Map<unknown, unknown>(),
}));

vi.mock('react', () => ({
  createContext: (defaultValue: unknown) => ({ defaultValue }),
  createElement: () => null,
  useContext: (context: { defaultValue: unknown }) => {
    if (harness.contextValues.has(context)) return harness.contextValues.get(context);
    return context.defaultValue;
  },
  useState: (init: unknown) => {
    const value = typeof init === 'function' ? (init as () => unknown)() : init;
    return [value, () => {}];
  },
  useRef: (current: unknown) => ({ current }),
  useMemo: (factory: () => unknown) => factory(),
  useCallback: (callback: unknown) => callback,
  useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => getSnapshot(),
  useEffect: (callback: () => unknown) => {
    harness.effects.push(callback);
  },
  useLayoutEffect: (callback: () => unknown) => {
    harness.layoutEffects.push(callback);
  },
}));

interface Snapshot {
  status: 'loading' | 'ready' | 'error';
  pricing: { metadata: { saasName: string } } | undefined;
  diagnostics: { code: string }[];
}

interface HookResult extends Snapshot {
  reload: () => void;
}

interface LoaderCall {
  url: string;
  signal: AbortSignal;
  request: {
    maxBytes?: number;
    timeoutMs?: number;
    credentials?: string;
    headers?: Record<string, string>;
  };
}

type Loader = (call: LoaderCall) => Promise<string>;

const modulePath = '../../src/react/use-pricing-source.js';
let mod: Loose = {};
let providerContext: object | undefined;

beforeAll(async () => {
  mod = (await import('../../src/react/use-pricing-source.js').catch(() => ({}))) as Loose;
  const provider = (await import('../../src/react/provider.js')) as Loose;
  providerContext = provider.PricingRendererContext as object;
});

beforeEach(() => {
  harness.effects.length = 0;
  harness.layoutEffects.length = 0;
  harness.contextValues.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const acmeYaml = readFileSync(new URL('../fixtures/acme-pricing.yml', import.meta.url), 'utf8');
const ACME_URL = 'https://example.com/acme.yml';
const settle = () => new Promise<void>((done) => setTimeout(done, 25));

function provide(value: Loose | undefined): void {
  expect(providerContext, 'PricingRendererContext of src/react/provider.ts').toBeDefined();
  harness.contextValues.set(providerContext, value);
}

function callHook(props: Loose): HookResult {
  expect(mod.usePricingSource, `${modulePath} usePricingSource`).toBeTypeOf('function');
  return (mod.usePricingSource as (props: Loose) => HookResult)(props);
}

// Runs the recorded effects, as a commit would, and returns their cleanups.
function runEffects(): Array<() => void> {
  const cleanups: Array<() => void> = [];
  for (const effect of [...harness.effects, ...harness.layoutEffects]) {
    const cleanup = effect();
    if (typeof cleanup === 'function') cleanups.push(cleanup as () => void);
  }
  return cleanups;
}

async function loadedCall(spy: { mock: { calls: [LoaderCall][] } }): Promise<LoaderCall> {
  await vi.waitFor(() => expect(spy.mock.calls.length).toBeGreaterThan(0));
  return spy.mock.calls[0]?.[0] as LoaderCall;
}

const providerRequest = {
  headers: { Authorization: 'Bearer t' },
  credentials: 'include' as const,
  timeoutMs: 5000,
};

describe('usePricingSource: provider bounds through the hook', () => {
  it('replaces provider bounds that are not usable by the defaults', async () => {
    const loadPricing = vi.fn<Loader>(async () => acmeYaml);
    provide({ loadPricing, request: { maxBytes: 0, timeoutMs: Number.POSITIVE_INFINITY } });
    callHook({ src: ACME_URL });
    runEffects();
    const call = await loadedCall(loadPricing);
    expect(call.request.maxBytes).toBe(2097152);
    expect(call.request.timeoutMs).toBe(15000);
  });

  it('replaces bounds of the instance request that are not usable', async () => {
    const loadPricing = vi.fn<Loader>(async () => acmeYaml);
    callHook({ src: ACME_URL, loadPricing, request: { maxBytes: -1, timeoutMs: 2147483648 } });
    runEffects();
    const call = await loadedCall(loadPricing);
    expect(call.request.maxBytes).toBe(2097152);
    expect(call.request.timeoutMs).toBe(15000);
  });
});

describe('usePricingSource: provider request and loader', () => {
  it('uses the instance request alone, so the provider timeout does not apply', async () => {
    const loadPricing = vi.fn<Loader>(async () => acmeYaml);
    provide({ loadPricing, request: { timeoutMs: 5000 } });
    callHook({ src: ACME_URL, request: { maxBytes: 4096 } });
    runEffects();
    await loadedCall(loadPricing);
    expect(loadPricing).toHaveBeenCalledTimes(1);
    const call = loadPricing.mock.calls[0]?.[0] as LoaderCall;
    expect(call.request.maxBytes).toBe(4096);
    expect(call.request.timeoutMs).toBe(15000);
  });

  it('uses the provider loader and request when the instance sets none', async () => {
    const loadPricing = vi.fn<Loader>(async () => acmeYaml);
    provide({ loadPricing, request: { timeoutMs: 5000, maxBytes: 4096 } });
    callHook({ src: ACME_URL });
    runEffects();
    const call = await loadedCall(loadPricing);
    expect(call.url).toBe(ACME_URL);
    expect(call.request.timeoutMs).toBe(5000);
    expect(call.request.maxBytes).toBe(4096);
  });

  it('lets an instance loadPricing replace the provider loadPricing', async () => {
    const providerLoader = vi.fn<Loader>(async () => acmeYaml);
    const own = vi.fn<Loader>(async () => acmeYaml);
    provide({ loadPricing: providerLoader });
    callHook({ src: ACME_URL, loadPricing: own });
    runEffects();
    await loadedCall(own);
    await settle();
    expect(own).toHaveBeenCalledTimes(1);
    expect(providerLoader).not.toHaveBeenCalled();
  });
});

describe('usePricingSource: provider request headers stay on allowed origins', () => {
  it('drops headers and credentials for a foreign origin', async () => {
    vi.stubGlobal('location', { origin: 'https://app.example.com' });
    const loadPricing = vi.fn<Loader>(async () => acmeYaml);
    provide({ loadPricing, request: providerRequest });
    callHook({ src: 'https://cdn.example.net/acme.yml' });
    runEffects();
    const call = await loadedCall(loadPricing);
    expect(call.request).not.toHaveProperty('headers');
    expect(call.request.credentials).toBe('omit');
    expect(call.request.timeoutMs).toBe(5000);
  });

  it('keeps headers and credentials for the page origin', async () => {
    vi.stubGlobal('location', { origin: 'https://app.example.com' });
    const loadPricing = vi.fn<Loader>(async () => acmeYaml);
    provide({ loadPricing, request: providerRequest });
    callHook({ src: 'https://app.example.com/acme.yml' });
    runEffects();
    const call = await loadedCall(loadPricing);
    expect(call.request.headers).toEqual({ Authorization: 'Bearer t' });
    expect(call.request.credentials).toBe('include');
  });

  it('keeps headers for a listed origin on a server', async () => {
    expect(globalThis.location).toBeUndefined();
    const loadPricing = vi.fn<Loader>(async () => acmeYaml);
    provide({
      loadPricing,
      request: providerRequest,
      requestOrigins: ['https://cdn.example.net'],
    });
    callHook({ src: 'https://cdn.example.net/acme.yml' });
    runEffects();
    const call = await loadedCall(loadPricing);
    expect(call.request.headers).toEqual({ Authorization: 'Bearer t' });
  });

  it('gives an unlisted origin no headers on a server', async () => {
    expect(globalThis.location).toBeUndefined();
    const loadPricing = vi.fn<Loader>(async () => acmeYaml);
    provide({
      loadPricing,
      request: providerRequest,
      requestOrigins: ['https://cdn.example.net'],
    });
    callHook({ src: 'https://app.example.com/acme.yml' });
    runEffects();
    const call = await loadedCall(loadPricing);
    expect(call.request).not.toHaveProperty('headers');
    expect(call.request.credentials).toBe('omit');
  });

  it('uses an instance request as given, also on a foreign origin', async () => {
    vi.stubGlobal('location', { origin: 'https://app.example.com' });
    const loadPricing = vi.fn<Loader>(async () => acmeYaml);
    provide({ loadPricing, request: providerRequest });
    const request = { headers: { 'X-Key': 'k' }, credentials: 'include' as const };
    callHook({ src: 'https://cdn.example.net/acme.yml', request });
    runEffects();
    const call = await loadedCall(loadPricing);
    expect(call.request.headers).toEqual({ 'X-Key': 'k' });
    expect(call.request.credentials).toBe('include');
  });
});

describe('usePricingSource: the load starts from an effect', () => {
  it('returns loading and calls no loader until the effects run', async () => {
    const loadPricing = vi.fn<Loader>(async () => acmeYaml);
    const result = callHook({ src: ACME_URL, loadPricing });
    expect(result.status).toBe('loading');
    expect(result.pricing).toBeUndefined();
    await settle();
    expect(loadPricing).not.toHaveBeenCalled();
    runEffects();
    await loadedCall(loadPricing);
    expect(loadPricing).toHaveBeenCalledTimes(1);
  });

  it('starts no load for an inline source when the effects run', async () => {
    const loadPricing = vi.fn<Loader>(async () => acmeYaml);
    const result = callHook({ yaml: acmeYaml, loadPricing });
    runEffects();
    await settle();
    expect(result.status).toBe('ready');
    expect(result.pricing?.metadata.saasName).toBe('Acme Cloud');
    expect(loadPricing).not.toHaveBeenCalled();
  });
});

describe('usePricingSource: inline sources resolve during the call', () => {
  it('returns ready for yaml and error for no source, with no effect run', () => {
    expect(callHook({ yaml: acmeYaml }).status).toBe('ready');
    const missing = callHook({});
    expect(missing.status).toBe('error');
    const codes = missing.diagnostics.map((diagnostic) => diagnostic.code);
    expect(codes).toEqual(['PR_SOURCE_MISSING']);
  });
});

describe('usePricingSource: the effect cleanup aborts the load', () => {
  it('aborts the signal of the load when the cleanup runs', async () => {
    const signals: AbortSignal[] = [];
    const loadPricing = vi.fn<Loader>(({ signal }) => {
      signals.push(signal);
      return new Promise<string>(() => {});
    });
    callHook({ src: ACME_URL, loadPricing });
    const cleanups = runEffects();
    await loadedCall(loadPricing);
    expect(signals[0]?.aborted).toBe(false);
    for (const cleanup of cleanups) cleanup();
    expect(signals[0]?.aborted).toBe(true);
  });
});

describe('usePricingSource: reload through the hook', () => {
  it('loads the source again and aborts the load in flight', async () => {
    const signals: AbortSignal[] = [];
    const loadPricing = vi.fn<Loader>(({ signal }) => {
      signals.push(signal);
      return new Promise<string>(() => {});
    });
    const result = callHook({ src: ACME_URL, loadPricing });
    expect(result.reload).toBeTypeOf('function');
    const cleanups = runEffects();
    await loadedCall(loadPricing);
    result.reload();
    expect(loadPricing).toHaveBeenCalledTimes(2);
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);
    for (const cleanup of cleanups) cleanup();
  });
});
