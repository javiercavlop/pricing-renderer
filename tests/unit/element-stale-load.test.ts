// The element is built in the node environment with stand-ins for the DOM calls; the same flow in a
// real browser is covered by tests/browser/element-stale-load.spec.ts.
import { describe, expect, it } from 'vitest';

interface Loader {
  (request: { signal: AbortSignal }): Promise<unknown>;
}

interface Host {
  src?: string;
  yaml?: string;
  pricing?: unknown;
  loadPricing?: Loader;
  reload(): Promise<void>;
  requestUpdate: () => void;
  dispatchEvent: (event: Event) => boolean;
  // private state the load result sets
  _status: string;
  _diagnostics: { code: string }[];
}

const pricing = {
  syntaxVersion: '3.1',
  version: '1',
  createdAt: '2026-01-01',
  currency: 'EUR',
  saasName: 'Stale',
  plans: { basic: { price: 10 } },
};

async function build(): Promise<{ element: Host; events: string[] }> {
  const loaded: unknown = await import('../../src/element/pricing-renderer-element.js');
  const Element = (loaded as { PricingRendererElement: new () => Host }).PricingRendererElement;
  const element = new Element();
  const events: string[] = [];
  element.requestUpdate = () => undefined;
  element.dispatchEvent = (event) => {
    events.push(event.type);
    return true;
  };
  return { element, events };
}

// A loader that stays pending until `release` is called, and records the signal it was given.
function pendingLoader(): { loader: Loader; signals: AbortSignal[]; release: () => void } {
  const signals: AbortSignal[] = [];
  const waiting: (() => void)[] = [];
  const loader: Loader = ({ signal }) => {
    signals.push(signal);
    return new Promise((resolve) => waiting.push(() => resolve(pricing)));
  };
  return { loader, signals, release: () => waiting.splice(0).forEach((resolve) => resolve()) };
}

const flush = async (): Promise<void> => {
  for (let turn = 0; turn < 5; turn += 1) await Promise.resolve();
};

// [utest->req~reload-source-error-cancels-load~1]
describe('reload() with a source error while a src load is pending', () => {
  it('aborts the pending load and never emits pricing-ready when the source is missing', async () => {
    const { element, events } = await build();
    const { loader, signals, release } = pendingLoader();
    element.loadPricing = loader;
    element.src = 'https://example.com/pricing.yml';
    const first = element.reload();
    await flush();
    expect(signals).toHaveLength(1);
    expect(signals[0]!.aborted).toBe(false);

    element.src = undefined;
    await element.reload();
    expect(signals[0]!.aborted).toBe(true);
    expect(events).toContain('pricing-diagnostic');
    expect(element._status).toBe('error');
    expect(element._diagnostics[0]?.code).toBe('PR_SOURCE_MISSING');

    release();
    await first;
    await flush();
    expect(events).not.toContain('pricing-ready');
  });

  it('aborts the pending load and never emits pricing-ready when sources conflict', async () => {
    const { element, events } = await build();
    const { loader, signals, release } = pendingLoader();
    element.loadPricing = loader;
    element.src = 'https://example.com/pricing.yml';
    const first = element.reload();
    await flush();

    element.pricing = pricing;
    await element.reload();
    expect(signals[0]!.aborted).toBe(true);
    expect(element._status).toBe('error');
    expect(element._diagnostics[0]?.code).toBe('PR_SOURCE_CONFLICT');

    release();
    await first;
    await flush();
    expect(events).not.toContain('pricing-ready');
    expect(element._status).toBe('error');
  });

  it('still loads after the source error is fixed', async () => {
    const { element, events } = await build();
    await element.reload();
    expect(events).not.toContain('pricing-ready');
    element.pricing = pricing;
    await element.reload();
    expect(events).toContain('pricing-ready');
  });
});
