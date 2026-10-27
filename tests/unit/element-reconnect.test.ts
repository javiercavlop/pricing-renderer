// connectedCallback needs a DOM, so the step it runs after a reconnect (_resumeAfterReconnect) and the
// first-update step (firstUpdated) are called on an element built in node with stand-ins. The move of
// a real element is covered by tests/browser/element-reconnect.spec.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface Host {
  src?: string;
  pricing?: unknown;
  loadPricing?: (request: { signal: AbortSignal }) => Promise<unknown>;
  reload: () => Promise<void>;
  requestUpdate: () => void;
  dispatchEvent: (event: Event) => boolean;
  getBoundingClientRect: () => { width: number };
  firstUpdated: () => void;
  _resumeAfterReconnect: () => void;
  _compact: boolean;
  _wide: boolean;
  _status: string;
}

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  observed: unknown[] = [];
  disconnected = false;
  constructor(readonly callback: (entries: { contentRect: { width: number } }[]) => void) {
    FakeResizeObserver.instances.push(this);
  }
  observe(target: unknown): void {
    this.observed.push(target);
  }
  disconnect(): void {
    this.disconnected = true;
  }
}

const pricing = {
  syntaxVersion: '3.1',
  version: '1',
  createdAt: '2026-01-01',
  currency: 'EUR',
  saasName: 'Reconnect',
  plans: { basic: { price: 10 } },
};

let width = 1000;

async function build(): Promise<Host> {
  const loaded: unknown = await import('../../src/element/pricing-renderer-element.js');
  const Element = (loaded as { PricingRendererElement: new () => Host }).PricingRendererElement;
  const element = new Element();
  element.requestUpdate = () => undefined;
  element.dispatchEvent = () => true;
  element.getBoundingClientRect = () => ({ width });
  return element;
}

function slowSource(element: Host): { signals: AbortSignal[]; release: () => void } {
  const signals: AbortSignal[] = [];
  const waiting: (() => void)[] = [];
  element.src = 'https://example.com/pricing.yml';
  element.loadPricing = ({ signal }) => {
    signals.push(signal);
    return new Promise((resolve) => waiting.push(() => resolve(pricing)));
  };
  return { signals, release: () => waiting.splice(0).forEach((resolve) => resolve()) };
}

const flush = async (): Promise<void> => {
  for (let turn = 0; turn < 5; turn += 1) await Promise.resolve();
};

beforeEach(() => {
  FakeResizeObserver.instances = [];
  width = 1000;
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// [utest->req~element-reconnect-resumes~1]
describe('reconnecting an element that has updated', () => {
  it('first update observes the size, measures once and starts the first load', async () => {
    const element = await build();
    const { signals } = slowSource(element);
    element.firstUpdated();
    await flush();
    expect(FakeResizeObserver.instances).toHaveLength(1);
    expect(FakeResizeObserver.instances[0]!.observed).toEqual([element]);
    expect(element._compact).toBe(false);
    expect(signals).toHaveLength(1);
  });

  it('creates a new observer, measures the width and reloads while the status is loading', async () => {
    const element = await build();
    const events: string[] = [];
    element.dispatchEvent = (event) => events.push(event.type) > 0;
    const { signals, release } = slowSource(element);
    element.firstUpdated();
    await flush();
    expect(element._status).toBe('loading');

    // moved into a narrow parent: the disconnect had stopped the observer and aborted the load
    width = 500;
    element._resumeAfterReconnect();
    await flush();

    expect(FakeResizeObserver.instances).toHaveLength(2);
    expect(FakeResizeObserver.instances[0]!.disconnected).toBe(true);
    expect(FakeResizeObserver.instances[1]!.observed).toEqual([element]);
    expect(element._compact).toBe(true);
    expect(element._wide).toBe(false);
    expect(signals).toHaveLength(2);
    expect(signals[0]!.aborted).toBe(true);
    expect(signals[1]!.aborted).toBe(false);

    release();
    await flush();
    expect(element._status).toBe('ready');
    expect(events.filter((type) => type === 'pricing-ready')).toHaveLength(1);
  });

  it('switches the layout when the element is resized after the reconnect', async () => {
    const element = await build();
    slowSource(element);
    element.firstUpdated();
    width = 500;
    element._resumeAfterReconnect();
    expect(element._compact).toBe(true);
    FakeResizeObserver.instances[1]!.callback([{ contentRect: { width: 1200 } }]);
    expect(element._compact).toBe(false);
    expect(element._wide).toBe(true);
  });

  it.each(['ready', 'error', 'idle'])('does not reload an element in status %s', async (status) => {
    const element = await build();
    element.firstUpdated();
    await flush();
    const reload = vi.fn(async () => undefined);
    element.reload = reload;
    element._status = status;
    element._resumeAfterReconnect();
    expect(reload).not.toHaveBeenCalled();
    expect(FakeResizeObserver.instances).toHaveLength(2);
  });

  it('keeps a ready pricing ready across a reconnect', async () => {
    const element = await build();
    element.pricing = pricing;
    element.firstUpdated();
    await flush();
    expect(element._status).toBe('ready');
    element._resumeAfterReconnect();
    await flush();
    expect(element._status).toBe('ready');
  });
});
