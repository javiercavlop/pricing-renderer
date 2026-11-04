import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { beforeAll, describe, expect, it, vi } from 'vitest';

// Names the implementation uses (design D7), for the implementer:
//
// - `src/react/use-pricing-source.ts` exports `createSourceStore()` and `usePricingSource(props)`.
//   Neither is exported from an entry yet; this test imports the module by its own path.
// - `usePricingSource` takes ONE argument object that holds the source fields and the options:
//   `{ pricing?, yaml?, src?, request?, loadPricing?, normalizeOptions? }`, as the scenarios call
//   it: `usePricingSource({ yaml: acmeYaml })` and `usePricingSource({ src, loadPricing })`. It
//   returns `{ status, pricing, diagnostics, reload }`.
// - The store takes the same fields split in two: `setInput(input, options)` with
//   `input` = `{ pricing?, yaml?, src? }` and `options` = `{ request?, loadPricing?,
//   normalizeOptions? }`. It has `subscribe`, `getSnapshot`, `inputVersion`, `start`, `stop` and
//   `reload`. The snapshot is `{ status: 'loading' | 'ready' | 'error', pricing, diagnostics }`.
// - `pricing` is a `NormalizedPricing`, so the scenarios' `pricing.saasName` is read here as
//   `pricing.metadata.saasName`.
// - The hook side of the provider scenarios (`PricingRendererContext`, `filterProviderRequest`,
//   the bounds through the hook) runs in `use-pricing-source-mocked.test.ts`, which needs `react`
//   mocked.

type Loose = Record<string, unknown>;

interface Snapshot {
  status: 'loading' | 'ready' | 'error';
  pricing: { metadata: { saasName: string } } | undefined;
  diagnostics: { code: string }[];
}

interface LoaderCall {
  url: string;
  signal: AbortSignal;
  request: { maxBytes?: number; timeoutMs?: number; credentials?: string };
}

type Loader = (call: LoaderCall) => Promise<string>;

interface Store {
  subscribe(listener: () => void): () => void;
  getSnapshot(): Snapshot;
  setInput(input: Loose, options: Loose): void;
  readonly inputVersion: number;
  start(): void;
  stop(): void;
  reload(): void;
}

interface HookResult extends Snapshot {
  reload: () => void;
}

const modulePath = '../../src/react/use-pricing-source.js';
let mod: Loose = {};

beforeAll(async () => {
  mod = (await import('../../src/react/use-pricing-source.js').catch(() => ({}))) as Loose;
});

function createStore(): Store {
  expect(mod.createSourceStore, `${modulePath} createSourceStore`).toBeTypeOf('function');
  return (mod.createSourceStore as () => Store)();
}

function hook(props: Loose): HookResult {
  expect(mod.usePricingSource, `${modulePath} usePricingSource`).toBeTypeOf('function');
  return (mod.usePricingSource as (props: Loose) => HookResult)(props);
}

const acmeYaml = readFileSync(new URL('../fixtures/acme-pricing.yml', import.meta.url), 'utf8');
const ACME_URL = 'https://example.com/acme.yml';
const inlinePricing = { syntaxVersion: '3.1', saasName: 'Inline', plans: { free: { price: 0 } } };

function yamlNamed(name: string): string {
  return acmeYaml.replace('saasName: Acme Cloud', `saasName: ${name}`);
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const tick = () => new Promise<void>((done) => setTimeout(done, 0));
const settle = () => new Promise<void>((done) => setTimeout(done, 25));

function nameOf(store: Store): string | undefined {
  return store.getSnapshot().pricing?.metadata.saasName;
}

function codesOf(store: Store): string[] {
  return store.getSnapshot().diagnostics.map((diagnostic) => diagnostic.code);
}

function requestOf(spy: { mock: { calls: [LoaderCall][] } }, index = 0): LoaderCall['request'] {
  return (spy.mock.calls[index]?.[0] as LoaderCall).request;
}

// Renders the hook in a component with renderToString and returns the markup of
// `status|saasName|diagnostic codes`.
function renderHook(props: Loose): string {
  function Probe() {
    const { status, pricing, diagnostics } = hook(props);
    const codes = diagnostics.map((diagnostic) => diagnostic.code).join(',');
    return createElement('p', null, `${status}|${pricing?.metadata.saasName}|${codes}`);
  }
  return renderToString(createElement(Probe));
}

// [utest->req~use-pricing-source-render~1]
describe('usePricingSource: inline sources resolve during render', () => {
  it('renders ready and the pricing name for yaml on the server', () => {
    const html = renderHook({ yaml: acmeYaml });
    expect(html).toContain('ready');
    expect(html).toContain('Acme Cloud');
  });

  it('renders ready for an inline pricing object', () => {
    const html = renderHook({ pricing: inlinePricing });
    expect(html).toContain('ready');
    expect(html).toContain('Inline');
  });

  it('renders error and PR_SOURCE_MISSING for no source', () => {
    const html = renderHook({});
    expect(html).toContain('error');
    expect(html).toContain('PR_SOURCE_MISSING');
    expect(html).not.toContain('ready');
  });

  it('renders error and PR_SOURCE_CONFLICT for two sources', () => {
    const html = renderHook({ yaml: acmeYaml, src: ACME_URL });
    expect(html).toContain('error');
    expect(html).toContain('PR_SOURCE_CONFLICT');
  });

  it('renders error and no pricing for invalid yaml', () => {
    const html = renderHook({ yaml: 'plans: [' });
    expect(html.startsWith('<p>error|undefined|')).toBe(true);
  });

  it('applies an inline source in the store without a start', () => {
    const store = createStore();
    store.setInput({ yaml: acmeYaml }, {});
    expect(store.getSnapshot().status).toBe('ready');
    expect(nameOf(store)).toBe('Acme Cloud');
    store.setInput({}, {});
    expect(store.getSnapshot().status).toBe('ready');
    expect(nameOf(store)).toBe('Acme Cloud');
    expect(codesOf(store)).toContain('PR_SOURCE_MISSING');
  });
});

// [utest->req~use-pricing-source-stable~1]
describe('usePricingSource: stable source inputs keep the result', () => {
  it('keeps the pricing object for a structurally equal inline pricing', () => {
    const store = createStore();
    const p1 = structuredClone(inlinePricing);
    const p2 = structuredClone(inlinePricing);
    expect(p2).not.toBe(p1);
    store.setInput({ pricing: p1 }, {});
    const first = store.getSnapshot().pricing;
    const version = store.inputVersion;
    store.setInput({ pricing: p2 }, {});
    const second = store.getSnapshot().pricing;
    expect(first).toBeDefined();
    expect(Object.is(first, second)).toBe(true);
    expect(store.inputVersion).toBe(version);
  });

  it('starts no new load for a fresh request equal to the held one', async () => {
    const loadPricing = vi.fn<Loader>(async () => acmeYaml);
    const store = createStore();
    store.setInput({ src: ACME_URL }, { request: { timeoutMs: 5000 }, loadPricing });
    store.start();
    await vi.waitFor(() => expect(store.getSnapshot().status).toBe('ready'));
    const loaded = store.getSnapshot();
    const version = store.inputVersion;
    store.setInput({ src: ACME_URL }, { request: { timeoutMs: 5000 }, loadPricing });
    store.start();
    await settle();
    expect(loadPricing).toHaveBeenCalledTimes(1);
    expect(store.inputVersion).toBe(version);
    expect(Object.is(store.getSnapshot().pricing, loaded.pricing)).toBe(true);
  });

  it('returns the identical snapshot between two changes', () => {
    const store = createStore();
    store.setInput({ yaml: acmeYaml }, {});
    const before = store.getSnapshot();
    expect(store.getSnapshot()).toBe(before);
    store.setInput({ yaml: acmeYaml }, {});
    expect(store.getSnapshot()).toBe(before);
  });

  it('takes a changed yaml, pricing or loader as a new input', () => {
    const store = createStore();
    const loadPricing = vi.fn<Loader>(async () => acmeYaml);
    store.setInput({ src: ACME_URL }, { loadPricing });
    const v1 = store.inputVersion;
    store.setInput({ src: ACME_URL }, { loadPricing: vi.fn<Loader>(async () => acmeYaml) });
    const v2 = store.inputVersion;
    expect(v2).toBeGreaterThan(v1);
    store.setInput({ yaml: acmeYaml }, {});
    const first = store.getSnapshot().pricing;
    const v3 = store.inputVersion;
    expect(v3).toBeGreaterThan(v2);
    store.setInput({ yaml: yamlNamed('Other') }, {});
    expect(nameOf(store)).toBe('Other');
    expect(store.getSnapshot().pricing).not.toBe(first);
    expect(store.inputVersion).toBeGreaterThan(v3);
  });

  it('takes a changed pricing structure as a new pricing object', () => {
    const store = createStore();
    store.setInput({ pricing: inlinePricing }, {});
    const first = store.getSnapshot().pricing;
    store.setInput({ pricing: { ...inlinePricing, saasName: 'Changed' } }, {});
    expect(nameOf(store)).toBe('Changed');
    expect(store.getSnapshot().pricing).not.toBe(first);
  });
});

// [utest->req~use-pricing-source-src-effect~1]
describe('usePricingSource: a URL source loads in an effect', () => {
  it('renders loading on the server and calls no loader', () => {
    const loadPricing = vi.fn<Loader>(async () => acmeYaml);
    const html = renderHook({ src: ACME_URL, loadPricing });
    expect(html).toContain('loading');
    expect(html).not.toContain('ready');
    expect(loadPricing).not.toHaveBeenCalled();
  });

  it('is loading with no pricing until start, then ready', async () => {
    const loadPricing = vi.fn<Loader>(async () => acmeYaml);
    const store = createStore();
    store.setInput({ src: ACME_URL }, { loadPricing });
    expect(store.getSnapshot().status).toBe('loading');
    expect(store.getSnapshot().pricing).toBeUndefined();
    await settle();
    expect(loadPricing).not.toHaveBeenCalled();
    store.start();
    await vi.waitFor(() => expect(store.getSnapshot().status).toBe('ready'));
    expect(nameOf(store)).toBe('Acme Cloud');
  });

  it('keeps the pricing of the last successful load while a new src loads', () => {
    const loadPricing = vi.fn<Loader>(async () => acmeYaml);
    const store = createStore();
    store.setInput({ yaml: acmeYaml }, {});
    store.setInput({ src: ACME_URL }, { loadPricing });
    expect(store.getSnapshot().status).toBe('loading');
    expect(nameOf(store)).toBe('Acme Cloud');
    expect(loadPricing).not.toHaveBeenCalled();
  });

  it('starts nothing for an inline input', async () => {
    const loadPricing = vi.fn<Loader>(async () => acmeYaml);
    const store = createStore();
    store.setInput({ yaml: acmeYaml }, { loadPricing });
    store.start();
    await settle();
    expect(loadPricing).not.toHaveBeenCalled();
    expect(store.getSnapshot().status).toBe('ready');
  });
});

// [utest->req~use-pricing-source-abort~1]
describe('usePricingSource: cleanup aborts the load', () => {
  it('aborts the first signal and applies the second load once (StrictMode)', async () => {
    const signals: AbortSignal[] = [];
    const loadPricing = vi.fn<Loader>(async ({ signal }) => {
      signals.push(signal);
      await tick();
      return acmeYaml;
    });
    const store = createStore();
    store.setInput({ src: ACME_URL }, { loadPricing });
    const seen: string[] = [];
    store.subscribe(() => seen.push(store.getSnapshot().status));
    store.start();
    store.stop();
    store.start();
    await vi.waitFor(() => expect(store.getSnapshot().status).toBe('ready'));
    await settle();
    expect(signals).toHaveLength(2);
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);
    expect(seen.filter((status) => status === 'ready')).toHaveLength(1);
    expect(nameOf(store)).toBe('Acme Cloud');
  });

  it('ignores the result of a load that stop() aborted', async () => {
    const gate = deferred<string>();
    const signals: AbortSignal[] = [];
    const loadPricing = vi.fn<Loader>(({ signal }) => {
      signals.push(signal);
      return gate.promise;
    });
    const store = createStore();
    store.setInput({ src: ACME_URL }, { loadPricing });
    store.start();
    store.stop();
    expect(signals[0]?.aborted).toBe(true);
    gate.resolve(acmeYaml);
    await settle();
    expect(store.getSnapshot().status).toBe('loading');
    expect(store.getSnapshot().pricing).toBeUndefined();
  });

  it('aborts the load of the old source when a new source replaces it', async () => {
    const signals: AbortSignal[] = [];
    const loadPricing = vi.fn<Loader>(async ({ url, signal }) => {
      signals.push(signal);
      await tick();
      return url.endsWith('b.yml') ? yamlNamed('Second') : yamlNamed('First');
    });
    const store = createStore();
    store.setInput({ src: 'https://example.com/a.yml' }, { loadPricing });
    store.start();
    store.setInput({ src: 'https://example.com/b.yml' }, { loadPricing });
    store.stop();
    store.start();
    await vi.waitFor(() => expect(store.getSnapshot().status).toBe('ready'));
    await settle();
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);
    expect(nameOf(store)).toBe('Second');
  });
});

// [utest->req~use-pricing-source-reload~1]
describe('usePricingSource: reload loads the current source again', () => {
  it('applies only the last load when the results arrive out of order', async () => {
    const gates: Deferred<string>[] = [deferred<string>(), deferred<string>()];
    const signals: AbortSignal[] = [];
    const loadPricing = vi.fn<Loader>(({ signal }) => {
      signals.push(signal);
      return (gates[signals.length - 1] as Deferred<string>).promise;
    });
    const store = createStore();
    store.setInput({ src: ACME_URL }, { loadPricing });
    store.start();
    expect(loadPricing).toHaveBeenCalledTimes(1);
    store.reload();
    expect(loadPricing).toHaveBeenCalledTimes(2);
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);
    gates[1]?.resolve(yamlNamed('Second'));
    await vi.waitFor(() => expect(store.getSnapshot().status).toBe('ready'));
    gates[0]?.resolve(yamlNamed('First'));
    await settle();
    expect(nameOf(store)).toBe('Second');
  });

  it('loads again after the first load settled', async () => {
    let name = 'First';
    const loadPricing = vi.fn<Loader>(async () => yamlNamed(name));
    const store = createStore();
    store.setInput({ src: ACME_URL }, { loadPricing });
    store.start();
    await vi.waitFor(() => expect(nameOf(store)).toBe('First'));
    name = 'Second';
    store.reload();
    await vi.waitFor(() => expect(nameOf(store)).toBe('Second'));
    expect(loadPricing).toHaveBeenCalledTimes(2);
  });

  it('applies an inline source again', () => {
    const store = createStore();
    store.setInput({ yaml: acmeYaml }, {});
    store.reload();
    expect(store.getSnapshot().status).toBe('ready');
    expect(nameOf(store)).toBe('Acme Cloud');
  });
});

// [utest->req~use-pricing-source-stale-load~1]
describe('usePricingSource: a changed source makes the load in flight stale', () => {
  it('ignores a URL result that settles after a switch to yaml, before stop()', async () => {
    const gate = deferred<string>();
    const loadPricing = vi.fn<Loader>(() => gate.promise);
    const store = createStore();
    store.setInput({ src: ACME_URL }, { loadPricing });
    store.start();
    store.setInput({ yaml: acmeYaml }, {});
    gate.resolve(yamlNamed('Remote'));
    await settle();
    expect(store.getSnapshot().status).toBe('ready');
    expect(nameOf(store)).toBe('Acme Cloud');
    store.stop();
    expect(nameOf(store)).toBe('Acme Cloud');
  });

  it('ignores the result of the old src after a switch to another src', async () => {
    const gates: Deferred<string>[] = [deferred<string>(), deferred<string>()];
    let calls = 0;
    const loadPricing = vi.fn<Loader>(() => (gates[calls++] as Deferred<string>).promise);
    const store = createStore();
    store.setInput({ src: 'https://example.com/a.yml' }, { loadPricing });
    store.start();
    store.setInput({ src: 'https://example.com/b.yml' }, { loadPricing });
    gates[0]?.resolve(yamlNamed('Old'));
    await settle();
    expect(store.getSnapshot().status).toBe('loading');
    expect(store.getSnapshot().pricing).toBeUndefined();
    store.stop();
    store.start();
    gates[1]?.resolve(yamlNamed('New'));
    await vi.waitFor(() => expect(store.getSnapshot().status).toBe('ready'));
    expect(nameOf(store)).toBe('New');
  });
});

// [utest->req~use-pricing-source-success~1]
describe('usePricingSource: a successful load', () => {
  it('is ready with the pricing after a URL load settles', async () => {
    const loadPricing = vi.fn<Loader>(async () => acmeYaml);
    const store = createStore();
    store.setInput({ src: ACME_URL }, { loadPricing });
    store.start();
    await vi.waitFor(() => expect(store.getSnapshot().status).toBe('ready'));
    expect(nameOf(store)).toBe('Acme Cloud');
    expect(loadPricing).toHaveBeenCalledTimes(1);
  });

  it('returns the diagnostics of the result and notifies the listener', async () => {
    const normalizeOptions = {
      syntaxAdapters: [
        {
          id: 'test-adapter',
          supports: (version: string) => version === '3.1',
          adapt: (pricing: unknown) => ({ ...(pricing as Loose), saasName: 'Adapted' }),
        },
      ],
    };
    const loadPricing = vi.fn<Loader>(async () => acmeYaml);
    const store = createStore();
    store.setInput({ src: ACME_URL }, { loadPricing, normalizeOptions });
    const listener = vi.fn();
    store.subscribe(listener);
    store.start();
    await vi.waitFor(() => expect(store.getSnapshot().status).toBe('ready'));
    expect(nameOf(store)).toBe('Adapted');
    expect(codesOf(store)).toContain('PR_VERSION_ADAPTED');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('stops notifying a listener that unsubscribed', async () => {
    const loadPricing = vi.fn<Loader>(async () => acmeYaml);
    const store = createStore();
    store.setInput({ src: ACME_URL }, { loadPricing });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    store.start();
    await vi.waitFor(() => expect(store.getSnapshot().status).toBe('ready'));
    expect(listener).not.toHaveBeenCalled();
  });
});

// [utest->req~use-pricing-source-failure-keeps-pricing~1]
describe('usePricingSource: a failed load keeps the last pricing', () => {
  it('stays ready with the pricing and PR_SOURCE_LOAD_FAILED after a failed reload', async () => {
    let fail = false;
    const loadPricing = vi.fn<Loader>(async () => {
      if (fail) throw new Error('network down');
      return acmeYaml;
    });
    const store = createStore();
    store.setInput({ src: ACME_URL }, { loadPricing });
    store.start();
    await vi.waitFor(() => expect(store.getSnapshot().status).toBe('ready'));
    fail = true;
    store.reload();
    await vi.waitFor(() => expect(codesOf(store)).toContain('PR_SOURCE_LOAD_FAILED'));
    expect(store.getSnapshot().status).toBe('ready');
    expect(nameOf(store)).toBe('Acme Cloud');
  });

  it('is error with no pricing when the first load fails', async () => {
    const loadPricing = vi.fn<Loader>(async () => {
      throw new Error('network down');
    });
    const store = createStore();
    store.setInput({ src: ACME_URL }, { loadPricing });
    store.start();
    await vi.waitFor(() => expect(store.getSnapshot().status).toBe('error'));
    expect(store.getSnapshot().pricing).toBeUndefined();
    expect(codesOf(store)).toContain('PR_SOURCE_LOAD_FAILED');
  });

  it('keeps the pricing of a valid yaml after an invalid one', () => {
    const store = createStore();
    store.setInput({ yaml: acmeYaml }, {});
    store.setInput({ yaml: 'plans: [' }, {});
    expect(store.getSnapshot().status).toBe('ready');
    expect(nameOf(store)).toBe('Acme Cloud');
    expect(store.getSnapshot().diagnostics.length).toBeGreaterThan(0);
    const fresh = createStore();
    fresh.setInput({ yaml: 'plans: [' }, {});
    expect(fresh.getSnapshot().status).toBe('error');
    expect(fresh.getSnapshot().pricing).toBeUndefined();
  });

  it('keeps the pricing when a later input holds two sources', () => {
    const store = createStore();
    store.setInput({ yaml: acmeYaml }, {});
    store.setInput({ yaml: acmeYaml, src: ACME_URL }, {});
    expect(store.getSnapshot().status).toBe('ready');
    expect(nameOf(store)).toBe('Acme Cloud');
    expect(codesOf(store)).toEqual(['PR_SOURCE_CONFLICT']);
  });
});

// [utest->req~load-source-request-bounds~1]
describe('createSourceStore: request bounds', () => {
  // A small document, so that it fits the 4096-byte limits some cases send.
  const smallYaml = JSON.stringify({ ...inlinePricing, saasName: 'Acme Cloud' });

  async function loadedRequest(request: Loose): Promise<LoaderCall['request']> {
    const loadPricing = vi.fn<Loader>(async () => smallYaml);
    const store = createStore();
    store.setInput({ src: ACME_URL }, { loadPricing, request });
    store.start();
    await vi.waitFor(() => expect(store.getSnapshot().status).toBe('ready'));
    expect(loadPricing).toHaveBeenCalledTimes(1);
    expect(nameOf(store)).toBe('Acme Cloud');
    return requestOf(loadPricing);
  }

  it('falls back to the defaults for an invalid maxBytes and timeoutMs', async () => {
    const request = await loadedRequest({ maxBytes: -1, timeoutMs: Number.NaN });
    expect(request.maxBytes).toBe(2097152);
    expect(request.timeoutMs).toBe(15000);
  });

  it('falls back for a zero size and a timeout above the timer limit', async () => {
    const request = await loadedRequest({ maxBytes: 0, timeoutMs: 2147483648 });
    expect(request.maxBytes).toBe(2097152);
    expect(request.timeoutMs).toBe(15000);
  });

  it('keeps a size and a timeout at the limits', async () => {
    const request = await loadedRequest({ maxBytes: 4096, timeoutMs: 2147483647 });
    expect(request.maxBytes).toBe(4096);
    expect(request.timeoutMs).toBe(2147483647);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'replaces maxBytes %s by the default and keeps a valid timeoutMs',
    async (maxBytes) => {
      const request = await loadedRequest({ maxBytes, timeoutMs: 5000 });
      expect(request.maxBytes).toBe(2097152);
      expect(request.timeoutMs).toBe(5000);
    },
  );

  it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY, 2147483648])(
    'replaces timeoutMs %s by the default and keeps a valid maxBytes',
    async (timeoutMs) => {
      const request = await loadedRequest({ maxBytes: 4096, timeoutMs });
      expect(request.maxBytes).toBe(4096);
      expect(request.timeoutMs).toBe(15000);
    },
  );
});
