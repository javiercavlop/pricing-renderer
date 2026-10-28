import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadPricingFromUrl } from '../../src/yaml/index.js';
import type { LoadedPricingResult } from '../../src/yaml/index.js';

const URL_SOURCE = 'https://pricing.example.com/pricing.yml';

const validYaml = `
syntaxVersion: "3.1"
saasName: Timeout pricing
plans:
  free:
    price: 0
`;

// Captured at module load, before any test installs fake timers: the unhandled-rejection probe
// needs one real turn of the event loop.
const realSetImmediate = globalThis.setImmediate;

const PENDING = Symbol('pending');

function neverSettles<T>(): Promise<T> {
  return new Promise<T>(() => {});
}

// Gives the microtasks of an abort path time to run, then races the call against an already
// resolved sentinel. A settled call wins the race; a pending one loses to PENDING. The test never
// awaits the call itself, so a loader that hangs on the base fails by assertion, not by timeout.
async function outcomeOf(
  call: Promise<LoadedPricingResult>,
): Promise<LoadedPricingResult | typeof PENDING> {
  for (let turn = 0; turn < 20; turn += 1) await Promise.resolve();
  return Promise.race([call, Promise.resolve(PENDING)]);
}

async function settled(call: Promise<LoadedPricingResult>): Promise<LoadedPricingResult> {
  const outcome = await outcomeOf(call);
  expect(outcome === PENDING ? 'pending' : 'settled', 'state of the load call').toBe('settled');
  return outcome as LoadedPricingResult;
}

function expectOnlyAborted(result: LoadedPricingResult): void {
  expect(result.ok).toBe(false);
  expect(result.diagnostics).toHaveLength(1);
  expect(result.diagnostics[0]).toMatchObject({
    code: 'PR_SOURCE_ABORTED',
    severity: 'error',
    path: '$',
  });
}

async function unhandledRejectionsDuring(run: () => Promise<void>): Promise<unknown[]> {
  const seen: unknown[] = [];
  const onUnhandled = (reason: unknown): void => {
    seen.push(reason);
  };
  process.on('unhandledRejection', onUnhandled);
  try {
    await run();
    await new Promise<void>((resolve) => realSetImmediate(() => resolve()));
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
  return seen;
}

// One chunk of 10 bytes, then nothing: the stream never enqueues again and never closes.
function stalledStream(cancel?: () => Promise<void>): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(10));
    },
    cancel,
  });
}

// [utest->req~load-timeout-covers-every-step~1]
describe('timeout and abort cover every load step', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('settles when a loader that ignores the signal and never settles outlives timeoutMs', async () => {
    const loadPricing = vi.fn(() => neverSettles<string>());
    const call = loadPricingFromUrl(URL_SOURCE, { timeoutMs: 1000, loadPricing });
    await vi.advanceTimersByTimeAsync(1001);
    expectOnlyAborted(await settled(call));
  });

  it('settles when the external signal aborts before the default timeout', async () => {
    const controller = new AbortController();
    const loadPricing = vi.fn(() => neverSettles<string>());
    const call = loadPricingFromUrl(URL_SOURCE, { signal: controller.signal, loadPricing });
    await vi.advanceTimersByTimeAsync(10);
    controller.abort();
    await vi.advanceTimersByTimeAsync(1);
    expectOnlyAborted(await settled(call));
  });

  it('fails a loadPricing call whose external signal is already aborted, without starting it', async () => {
    const controller = new AbortController();
    controller.abort();
    const loadPricing = vi.fn(async () => validYaml);
    const call = loadPricingFromUrl(URL_SOURCE, { signal: controller.signal, loadPricing });
    expectOnlyAborted(await settled(call));
    expect(loadPricing).not.toHaveBeenCalled();
  });

  it('fails a fetch call whose external signal is already aborted, without starting it', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchSpy = vi.fn(async () => new Response(validYaml));
    const call = loadPricingFromUrl(URL_SOURCE, {
      signal: controller.signal,
      fetch: fetchSpy as unknown as typeof fetch,
    });
    expectOnlyAborted(await settled(call));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('leaves no timer pending after an external abort', async () => {
    const controller = new AbortController();
    const loadPricing = vi.fn(() => neverSettles<string>());
    const call = loadPricingFromUrl(URL_SOURCE, {
      timeoutMs: 1000,
      signal: controller.signal,
      loadPricing,
    });
    await vi.advanceTimersByTimeAsync(10);
    controller.abort();
    await vi.advanceTimersByTimeAsync(1);
    expectOnlyAborted(await settled(call));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ignores a loader result that arrives after the timeout', async () => {
    const loadPricing = vi.fn(() => {
      return new Promise<string>((resolve) => {
        setTimeout(() => resolve(validYaml), 1500);
      });
    });
    const call = loadPricingFromUrl(URL_SOURCE, { timeoutMs: 1000, loadPricing });
    await vi.advanceTimersByTimeAsync(1001);
    expectOnlyAborted(await settled(call));
    await vi.advanceTimersByTimeAsync(999);
    expectOnlyAborted(await call);
  });

  it('leaves no unhandled rejection when a loader rejects after the timeout', async () => {
    const unhandled = await unhandledRejectionsDuring(async () => {
      const loadPricing = vi.fn(() => {
        return new Promise<string>((_resolve, reject) => {
          setTimeout(() => reject(new Error('late')), 1500);
        });
      });
      const call = loadPricingFromUrl(URL_SOURCE, { timeoutMs: 1000, loadPricing });
      await vi.advanceTimersByTimeAsync(1001);
      expectOnlyAborted(await settled(call));
      await vi.advanceTimersByTimeAsync(999);
      expectOnlyAborted(await call);
    });
    expect(unhandled).toEqual([]);
  });

  it('settles when the headers producer never settles, and does not call fetch', async () => {
    const fetchSpy = vi.fn(async () => new Response(validYaml));
    const call = loadPricingFromUrl(URL_SOURCE, {
      timeoutMs: 1000,
      headers: () => neverSettles<HeadersInit>(),
      fetch: fetchSpy as unknown as typeof fetch,
    });
    await vi.advanceTimersByTimeAsync(1001);
    expectOnlyAborted(await settled(call));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('settles when an injected fetch ignores the signal and never settles', async () => {
    const fetchSpy = vi.fn(() => neverSettles<Response>());
    const call = loadPricingFromUrl(URL_SOURCE, {
      timeoutMs: 1000,
      fetch: fetchSpy as unknown as typeof fetch,
    });
    await vi.advanceTimersByTimeAsync(1001);
    expectOnlyAborted(await settled(call));
  });

  it('settles when the body stream never ends', async () => {
    const fetchSpy = vi.fn(async () => new Response(stalledStream()));
    const call = loadPricingFromUrl(URL_SOURCE, {
      timeoutMs: 1000,
      fetch: fetchSpy as unknown as typeof fetch,
    });
    await vi.advanceTimersByTimeAsync(1001);
    expectOnlyAborted(await settled(call));
  });

  it('settles when the body cancel never settles', async () => {
    const cancel = vi.fn(() => neverSettles<void>());
    const fetchSpy = vi.fn(async () => new Response(stalledStream(cancel)));
    const call = loadPricingFromUrl(URL_SOURCE, {
      timeoutMs: 1000,
      fetch: fetchSpy as unknown as typeof fetch,
    });
    await vi.advanceTimersByTimeAsync(1001);
    expectOnlyAborted(await settled(call));
  });

  it('settles when the arrayBuffer() fallback never settles', async () => {
    const bodyless = {
      ok: true,
      status: 200,
      headers: new Headers(),
      body: null,
      arrayBuffer: () => neverSettles<ArrayBuffer>(),
    };
    const fetchSpy = vi.fn(async () => bodyless);
    const call = loadPricingFromUrl(URL_SOURCE, {
      timeoutMs: 1000,
      fetch: fetchSpy as unknown as typeof fetch,
    });
    await vi.advanceTimersByTimeAsync(1001);
    expectOnlyAborted(await settled(call));
  });

  it('keeps the result of a load that finishes in time, and leaves no timer pending', async () => {
    const loadPricing = vi.fn(() => {
      return new Promise<string>((resolve) => {
        setTimeout(() => resolve(validYaml), 100);
      });
    });
    const call = loadPricingFromUrl(URL_SOURCE, { timeoutMs: 1000, loadPricing });
    await vi.advanceTimersByTimeAsync(100);
    const result = await settled(call);
    expect(result.ok).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
