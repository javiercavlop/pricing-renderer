'use client';

import { useContext, useState, useSyncExternalStore } from 'react';
import { getPricingRendererConfig, mergePresentationOptions } from '../core/index.js';
import type { NormalizedPricing } from '../core/index.js';
import { PricingRendererContext, type PricingRendererContextValue } from './provider.js';
import { createSelectionStore } from './selection-store.js';
import type {
  SelectionStore,
  SelectionStoreChange,
  SelectionStoreOptions,
  SelectionStoreSnapshot,
} from './selection-store.js';

/** The options of `usePricingSelection`: the instance layer, above the provider and the global one. */
export type UsePricingSelectionOptions = SelectionStoreOptions;

/** What `onSelectionChange` of `usePricingSelection` receives. */
export type UsePricingSelectionChange = SelectionStoreChange;

/** The snapshot fields and the stable actions and queries of `usePricingSelection`. */
export type UsePricingSelectionResult = SelectionStoreSnapshot &
  Omit<SelectionStore, 'subscribe' | 'getSnapshot' | 'setInput'>;

// Instance option, then the nearest provider, then the global configuration read at render time;
// `custom.pricingRenderer` is the lowest presentation layer and the view model applies it.
function resolveOptions(
  options: UsePricingSelectionOptions,
  provider: PricingRendererContextValue | undefined,
): SelectionStoreOptions {
  const global = getPricingRendererConfig();
  const presentation = mergePresentationOptions(
    mergePresentationOptions(
      mergePresentationOptions(global.presentation, provider?.config?.presentation),
      provider?.presentation,
    ),
    options.presentation,
  );
  const messages =
    provider?.messages === undefined
      ? options.messages
      : { ...provider.messages, ...options.messages };
  return {
    ...options,
    locale: options.locale ?? provider?.config?.locale ?? global.locale,
    variablesEnabled:
      options.variablesEnabled ?? provider?.config?.variablesEnabled ?? global.variablesEnabled,
    messages,
    presentation,
  };
}

// A thin layer over a store of its own: the store gets its input during render, and
// `useSyncExternalStore` reads the cached snapshot, on the server too.
export function usePricingSelection(
  pricing: NormalizedPricing | undefined,
  options: UsePricingSelectionOptions = {},
): UsePricingSelectionResult {
  const [store] = useState(createSelectionStore);
  const provider = useContext(PricingRendererContext);
  store.setInput(pricing, resolveOptions(options, provider));
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return {
    ...snapshot,
    selectPlan: store.selectPlan,
    toggleAddOn: store.toggleAddOn,
    setVariable: store.setVariable,
    setAddOnQuantity: store.setAddOnQuantity,
    setBillingPeriod: store.setBillingPeriod,
    resetVariables: store.resetVariables,
    confirm: store.confirm,
    cancel: store.cancel,
    apply: store.apply,
    relationOf: store.relationOf,
    compareWithCurrent: store.compareWithCurrent,
  };
}
