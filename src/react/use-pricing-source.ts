'use client';

import { useContext, useEffect, useState, useSyncExternalStore } from 'react';
import type {
  IPricingLike,
  NormalizedPricing,
  NormalizePricingOptions,
  PricingDiagnostic,
  PricingResult,
} from '../core/index.js';
import { sameInput } from '../element/same-input.js';
import { loadPricingSource } from '../yaml/index.js';
import type { PricingLoader, PricingRequestOptions } from '../yaml/index.js';
import { filterProviderRequest, PricingRendererContext } from './provider.js';

export type PricingSourceStatus = 'loading' | 'ready' | 'error';

export interface PricingSourceSnapshot {
  readonly status: PricingSourceStatus;
  readonly pricing: NormalizedPricing | undefined;
  readonly diagnostics: PricingDiagnostic[];
}

export interface PricingSourceStoreInput {
  pricing?: IPricingLike | undefined;
  yaml?: string | undefined;
  src?: string | undefined;
}

export interface PricingSourceStoreOptions {
  request?: PricingRequestOptions | undefined;
  loadPricing?: PricingLoader | undefined;
  normalizeOptions?: NormalizePricingOptions | undefined;
}

export interface SourceStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): PricingSourceSnapshot;
  setInput(input: PricingSourceStoreInput, options: PricingSourceStoreOptions): void;
  readonly inputVersion: number;
  start(): void;
  stop(): void;
  reload(): void;
}

export type UsePricingSourceProps = PricingSourceStoreInput & PricingSourceStoreOptions;

export interface UsePricingSourceResult extends PricingSourceSnapshot {
  reload: () => void;
}

type SourceResult = PricingResult<NormalizedPricing>;
type Held = PricingSourceStoreInput & PricingSourceStoreOptions;

// [impl->req~load-source-request-bounds~1]
// A bound that is not usable falls back to its default, so a provider value of 0, NaN or Infinity
// cannot disable a limit. 2147483647 ms is the largest delay a timer honours.
function boundedRequest(request: PricingRequestOptions | undefined): PricingRequestOptions {
  const defaultMaxBytes = 2097152;
  const defaultTimeoutMs = 15000;
  const maxTimeoutMs = 2147483647;
  const maxBytes = request?.maxBytes;
  const timeoutMs = request?.timeoutMs;
  return {
    ...request,
    maxBytes:
      typeof maxBytes === 'number' && Number.isFinite(maxBytes) && maxBytes > 0
        ? maxBytes
        : defaultMaxBytes,
    timeoutMs:
      typeof timeoutMs === 'number' &&
      Number.isFinite(timeoutMs) &&
      timeoutMs > 0 &&
      timeoutMs <= maxTimeoutMs
        ? timeoutMs
        : defaultTimeoutMs,
  };
}

// [impl->req~use-pricing-source-stable~1]
// pricing, request and normalizeOptions compare by structure; yaml, src and loadPricing by identity.
function sameHeld(left: Held, right: Held): boolean {
  return (
    sameInput(left.pricing, right.pricing) &&
    left.yaml === right.yaml &&
    left.src === right.src &&
    left.loadPricing === right.loadPricing &&
    sameInput(left.request, right.request) &&
    sameInput(left.normalizeOptions, right.normalizeOptions)
  );
}

function isRemote(held: Held): boolean {
  return held.pricing === undefined && held.yaml === undefined && Boolean(held.src);
}

export function createSourceStore(): SourceStore {
  const listeners = new Set<() => void>();
  let snapshot: PricingSourceSnapshot = { status: 'loading', pricing: undefined, diagnostics: [] };
  let held: Held | undefined;
  let version = 0;
  // Counts the loads and the input changes; a load applies only if no one has counted since it began.
  let sequence = 0;
  let loadState: 'idle' | 'inflight' | 'settled' = 'idle';
  let controller: AbortController | undefined;
  // True between start() and stop(): only then does a load have a cleanup that aborts it.
  let active = false;

  function notify(): void {
    for (const listener of [...listeners]) listener();
  }

  // [impl->req~use-pricing-source-success~1]
  // [impl->req~use-pricing-source-failure-keeps-pricing~1]
  function resultSnapshot(result: SourceResult): PricingSourceSnapshot {
    if (result.value !== undefined) {
      return { status: 'ready', pricing: result.value, diagnostics: result.diagnostics };
    }
    return {
      status: snapshot.pricing === undefined ? 'error' : 'ready',
      pricing: snapshot.pricing,
      diagnostics: result.diagnostics,
    };
  }

  function loadingSnapshot(): PricingSourceSnapshot {
    return { status: 'loading', pricing: snapshot.pricing, diagnostics: [] };
  }

  function abortInFlight(): void {
    controller?.abort();
    controller = undefined;
  }

  function applyInline(current: Held): void {
    snapshot = resultSnapshot(
      loadPricingSource(
        { pricing: current.pricing, yaml: current.yaml, src: current.src },
        current.normalizeOptions ? { normalizeOptions: current.normalizeOptions } : {},
      ) as SourceResult,
    );
  }

  function load(current: Held): void {
    abortInFlight();
    sequence += 1;
    const token = sequence;
    const own = new AbortController();
    controller = own;
    loadState = 'inflight';
    const pending = loadPricingSource(
      { src: current.src },
      {
        request: boundedRequest(current.request),
        signal: own.signal,
        ...(current.loadPricing ? { loadPricing: current.loadPricing } : {}),
        ...(current.normalizeOptions ? { normalizeOptions: current.normalizeOptions } : {}),
      },
    );
    void Promise.resolve(pending).then((result) => {
      if (token !== sequence) return;
      controller = undefined;
      loadState = 'settled';
      snapshot = resultSnapshot(result);
      notify();
    });
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot() {
      return snapshot;
    },
    // [impl->req~use-pricing-source-render~1]
    // [impl->req~use-pricing-source-stale-load~1]
    setInput(input, options) {
      const next: Held = { ...input, ...options };
      if (held !== undefined && sameHeld(held, next)) return;
      held = next;
      version += 1;
      // The load in flight is stale at once; stop() still aborts it.
      sequence += 1;
      loadState = 'idle';
      if (isRemote(next)) snapshot = loadingSnapshot();
      else applyInline(next);
    },
    get inputVersion() {
      return version;
    },
    // [impl->req~use-pricing-source-src-effect~1]
    start() {
      active = true;
      if (held === undefined || !isRemote(held) || loadState !== 'idle') return;
      if (snapshot.status !== 'loading' || snapshot.diagnostics.length > 0) {
        snapshot = loadingSnapshot();
        notify();
      }
      load(held);
    },
    // [impl->req~use-pricing-source-abort~1]
    stop() {
      active = false;
      if (loadState === 'inflight') {
        sequence += 1;
        loadState = 'idle';
      }
      abortInFlight();
    },
    // [impl->req~use-pricing-source-reload~1]
    reload() {
      if (held === undefined) return;
      if (isRemote(held)) {
        if (!active) {
          // After stop() nothing aborts a new load: the next start() loads instead.
          sequence += 1;
          loadState = 'idle';
          return;
        }
        if (snapshot.status !== 'loading' || snapshot.diagnostics.length > 0) {
          snapshot = loadingSnapshot();
          notify();
        }
        load(held);
        return;
      }
      abortInFlight();
      sequence += 1;
      applyInline(held);
      notify();
    },
  };
}

function definedFields<T extends object>(fields: T): T {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as T;
}

// [impl->req~provider-request-loader~1]
// [impl->req~provider-request-origin~1]
export function usePricingSource(props: UsePricingSourceProps): UsePricingSourceResult {
  const provider = useContext(PricingRendererContext);
  const [store] = useState(createSourceStore);
  const { pricing, yaml, src, request, loadPricing, normalizeOptions } = props;
  store.setInput(
    definedFields({ pricing, yaml, src }),
    definedFields({
      request: request ?? filterProviderRequest(provider?.request, src, provider?.requestOrigins),
      loadPricing: loadPricing ?? provider?.loadPricing,
      normalizeOptions,
    }),
  );
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => {
    store.start();
    return () => {
      store.stop();
    };
  }, [store, store.inputVersion]);
  return { ...snapshot, reload: store.reload };
}
