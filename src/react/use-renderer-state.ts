import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import type { NormalizedPricing, PricingSelection, ResolvedPricing } from '../core/index.js';
import type {
  ApplySelectionResult,
  PricingReadyDetail,
  PricingSelectionChangeDetail,
} from '../element/events.js';

/** What `usePricingRendererState` returns: the last state the element announced. */
export interface RendererState {
  pricing: NormalizedPricing;
  selection: PricingSelection;
  resolved: ResolvedPricing;
  applySelection: (input: Partial<PricingSelection>) => ApplySelectionResult | undefined;
}

export interface RendererStateStore {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => RendererState | undefined;
  getServerSnapshot: () => RendererState | undefined;
  attach: (target: EventTarget | null) => void;
  detach: () => void;
  applySelection: (input: Partial<PricingSelection>) => ApplySelectionResult | undefined;
}

type SelectionTarget = EventTarget & {
  applySelection?: (input: Partial<PricingSelection>) => ApplySelectionResult;
};

// [impl->req~react-no-module-state~1] every piece of state below belongs to one store instance
// [impl->req~renderer-state-events~1] [impl->req~renderer-state-cached-snapshot~1]
// [impl->req~renderer-state-server-snapshot~1] [impl->req~renderer-state-ref-change~1]
// [impl->req~renderer-state-early-listen~1] [impl->req~renderer-state-apply~1]
export function createRendererStateStore(): RendererStateStore {
  const listeners = new Set<() => void>();
  let target: SelectionTarget | undefined;
  let snapshot: RendererState | undefined;

  const notify = (): void => {
    for (const listener of [...listeners]) listener();
  };

  const applySelection = (input: Partial<PricingSelection>): ApplySelectionResult | undefined => {
    if (!target || typeof target.applySelection !== 'function') return undefined;
    const result = target.applySelection(input);
    if (result.applied && snapshot) {
      snapshot = {
        pricing: snapshot.pricing,
        selection: result.selection,
        resolved: result.resolved,
        applySelection,
      };
      notify();
    }
    return result;
  };

  const onReady = (event: Event): void => {
    const detail = (event as CustomEvent<PricingReadyDetail>).detail;
    snapshot = {
      pricing: detail.pricing,
      selection: detail.selection,
      resolved: detail.resolved,
      applySelection,
    };
    notify();
  };

  const onChange = (event: Event): void => {
    // A change before any pricing-ready since the last attach has no pricing to go with it.
    if (!snapshot) return;
    const detail = (event as CustomEvent<PricingSelectionChangeDetail>).detail;
    snapshot = {
      pricing: snapshot.pricing,
      selection: detail.selection,
      resolved: detail.resolved,
      applySelection,
    };
    notify();
  };

  const detach = (): void => {
    if (target) {
      target.removeEventListener('pricing-ready', onReady);
      target.removeEventListener('pricing-selection-change', onChange);
      target = undefined;
    }
    if (snapshot) {
      snapshot = undefined;
      notify();
    }
  };

  const attach = (next: EventTarget | null): void => {
    if (next === null) {
      detach();
      return;
    }
    if (next === target) return;
    detach();
    target = next;
    next.addEventListener('pricing-ready', onReady);
    next.addEventListener('pricing-selection-change', onChange);
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
    getServerSnapshot: () => undefined,
    attach,
    detach,
    applySelection,
  };
}

// [impl->req~renderer-state-early-listen~1] the client check is evaluated once, at module load,
// so the hook order stays the same on every render of a process (design.md D7)
const useClientLayoutEffect = typeof document !== 'undefined' ? useLayoutEffect : useEffect;

// [impl->req~renderer-state-early-listen~1] [impl->req~renderer-state-server-snapshot~1]
// [impl->req~renderer-state-ref-change~1]
export function usePricingRendererState(ref: {
  readonly current: EventTarget | null;
}): RendererState | undefined {
  const [store] = useState(createRendererStateStore);
  // No dependency list: the ref is read on each commit and the listeners move when it changed.
  useClientLayoutEffect(() => {
    store.attach(ref.current);
  });
  useClientLayoutEffect(() => () => store.detach(), [store]);
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}
