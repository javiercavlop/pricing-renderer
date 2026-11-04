import {
  applySelectionChange,
  applySelectionInput,
  cloneValue,
  compareSelections,
  createPriceStabilizer,
  createPricingViewModel,
  deepEqual,
  mergeSelection,
  planSelectionChange,
  reconcileSelection,
  selectionInEffect,
  selectionWithAddOnQuantity,
  selectionWithVariable,
} from '../core/index.js';
import type {
  ApplySelectionInputResult,
  ExpressionOptions,
  MessageCatalog,
  NormalizedPricing,
  PendingAddOnChange,
  PricingMode,
  PricingPresentation,
  PricingSelection,
  PricingViewModel,
  PricingVisibility,
  ResolvedPricing,
  SelectionComparison,
  SelectionRelation,
  ViewModelOptions,
} from '../core/index.js';
import { planRelation } from '../core/plan-relation.js';
import { deriveCurrentContext } from '../element/current-selection.js';
import type { CurrentContext } from '../element/current-selection.js';

/** What `onSelectionChange` receives: the next selection and its stabilized prices. */
export interface SelectionStoreChange {
  selection: PricingSelection;
  resolved: ResolvedPricing;
}

/** The resolved options of `usePricingSelection`, already merged by the hook. */
export interface SelectionStoreOptions {
  selection?: PricingSelection | undefined;
  onSelectionChange?: ((detail: SelectionStoreChange) => void) | undefined;
  defaultSelection?: Partial<PricingSelection> | undefined;
  currentSelection?: Partial<PricingSelection> | undefined;
  locale?: string | undefined;
  mode?: PricingMode | undefined;
  visibility?: PricingVisibility | undefined;
  messages?: MessageCatalog | undefined;
  presentation?: PricingPresentation | undefined;
  expressionOptions?: ExpressionOptions | undefined;
  variablesEnabled?: boolean | undefined;
}

/** Every field is `undefined` while the store has no pricing. */
export interface SelectionStoreSnapshot {
  selection: PricingSelection | undefined;
  viewModel: PricingViewModel | undefined;
  resolved: ResolvedPricing | undefined;
  pending: PendingAddOnChange | undefined;
  current: CurrentContext | undefined;
}

export interface SelectionStore {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => SelectionStoreSnapshot;
  setInput: (pricing: NormalizedPricing | undefined, options: SelectionStoreOptions) => void;
  selectPlan: (planId: string) => void;
  toggleAddOn: (addOnId: string, selected: boolean) => void;
  setVariable: (path: string, value: unknown) => void;
  setAddOnQuantity: (addOnId: string, quantity: number) => void;
  setBillingPeriod: (billingPeriodId: string) => void;
  resetVariables: () => void;
  confirm: () => void;
  cancel: () => void;
  apply: (input: Partial<PricingSelection>) => ApplySelectionInputResult | undefined;
  relationOf: (planId: string) => SelectionRelation | undefined;
  compareWithCurrent: () => SelectionComparison | undefined;
}

interface BuiltFrom {
  pricing: NormalizedPricing;
  held: PricingSelection;
  pending: PendingAddOnChange | undefined;
  rest: Omit<SelectionStoreOptions, 'onSelectionChange'>;
}

function emptySnapshot(): SelectionStoreSnapshot {
  return {
    selection: undefined,
    viewModel: undefined,
    resolved: undefined,
    pending: undefined,
    current: undefined,
  };
}

function viewModelOptions(options: SelectionStoreOptions): ViewModelOptions {
  return {
    ...(options.locale !== undefined ? { locale: options.locale } : {}),
    ...(options.mode !== undefined ? { mode: options.mode } : {}),
    ...(options.visibility !== undefined ? { visibility: options.visibility } : {}),
    ...(options.messages ? { messages: options.messages } : {}),
    ...(options.presentation ? { presentation: options.presentation } : {}),
    ...(options.expressionOptions ? { expression: options.expressionOptions } : {}),
  };
}

function withoutCallback(options: SelectionStoreOptions): BuiltFrom['rest'] {
  const rest = { ...options };
  delete rest.onSelectionChange;
  return rest;
}

/**
 * The framework-free store behind `usePricingSelection`: one per hook instance, with its own
 * price stabilizer. `getSnapshot` gives the identical object until the state changes.
 */
export function createSelectionStore(): SelectionStore {
  // [impl->req~react-no-module-state~1] the stabilizer belongs to this store, never to the module
  const stabilizer = createPriceStabilizer();
  const listeners = new Set<() => void>();
  let pricing: NormalizedPricing | undefined;
  let options: SelectionStoreOptions = {};
  // the selection of an uncontrolled store; unused while `options.selection` is defined
  let internal: PricingSelection | undefined;
  let pending: PendingAddOnChange | undefined;
  let snapshot: SelectionStoreSnapshot = emptySnapshot();
  let builtFrom: BuiltFrom | undefined;

  // [impl->req~use-pricing-selection-controlled~1] [impl->req~use-pricing-selection-uncontrolled~1]
  const heldSelection = (): PricingSelection | undefined => options.selection ?? internal;

  // the not reconciled selection in effect (design D1)
  const inEffect = (current: NormalizedPricing, held: PricingSelection): PricingSelection =>
    selectionInEffect(current, held, {
      ...(options.variablesEnabled !== undefined
        ? { variablesEnabled: options.variablesEnabled }
        : {}),
    });

  // The pricing and the selection in effect for an action, or undefined while there is no pricing.
  const target = (): { pricing: NormalizedPricing; selection: PricingSelection } | undefined => {
    const held = heldSelection();
    if (!pricing || !held) return undefined;
    return { pricing, selection: inEffect(pricing, held) };
  };

  // Rebuilds the snapshot when an input differs (structural compare); true when it was replaced.
  const refresh = (): boolean => {
    const held = heldSelection();
    if (!pricing || !held) {
      builtFrom = undefined;
      if (snapshot.selection === undefined) return false;
      snapshot = emptySnapshot();
      return true;
    }
    const rest = withoutCallback(options);
    if (
      builtFrom &&
      Object.is(builtFrom.pricing, pricing) &&
      deepEqual(builtFrom.held, held) &&
      deepEqual(builtFrom.pending, pending) &&
      deepEqual(builtFrom.rest, rest)
    ) {
      return false;
    }
    // a copy, so an in-place change of the held object by the host is seen by the next compare
    builtFrom = { pricing, held: cloneValue(held), pending, rest };
    const selection = reconcileSelection(pricing, inEffect(pricing, held)).selection;
    const viewModel = stabilizer.stabilize(
      createPricingViewModel(pricing, selection, viewModelOptions(options)),
    );
    snapshot = {
      selection,
      viewModel,
      resolved: viewModel.resolved,
      pending,
      current: deriveCurrentContext(pricing, options.currentSelection),
    };
    return true;
  };

  // A change that yields a new snapshot calls every listener once.
  const publish = (): void => {
    if (!refresh()) return;
    for (const listener of [...listeners]) listener();
  };

  // [impl->req~use-pricing-selection-notify~1]
  // Holds the next selection when uncontrolled, then reports it, also when it equals the previous.
  const commit = (next: PricingSelection): void => {
    if (!pricing) return;
    const { onSelectionChange } = options;
    const selection = reconcileSelection(pricing, next).selection;
    if (options.selection === undefined) internal = selection;
    const { resolved } = stabilizer.stabilize(
      createPricingViewModel(pricing, selection, viewModelOptions(options)),
    );
    publish();
    onSelectionChange?.({ selection, resolved });
  };

  const setInput = (
    nextPricing: NormalizedPricing | undefined,
    nextOptions: SelectionStoreOptions,
  ): void => {
    options = nextOptions;
    // [impl->req~use-pricing-selection-pricing-change~1]
    if (!Object.is(nextPricing, pricing)) {
      pricing = nextPricing;
      stabilizer.reset();
      pending = undefined;
      internal = nextPricing
        ? reconcileSelection(nextPricing, mergeSelection(nextPricing, options.defaultSelection))
            .selection
        : undefined;
    }
    refresh();
  };

  // [impl->req~use-pricing-selection-changes~1] [impl->req~use-pricing-selection-pending~1]
  const selectPlan = (planId: string): void => {
    const state = target();
    if (!state) return;
    const change = planSelectionChange(state.pricing, state.selection, { type: 'plan', planId });
    if (change.kind === 'apply') {
      commit(change.selection);
      return;
    }
    pending = change.pending;
    publish();
  };

  const toggleAddOn = (addOnId: string, selected: boolean): void => {
    const state = target();
    if (!state) return;
    const change = planSelectionChange(state.pricing, state.selection, {
      type: 'addOn',
      addOnId,
      selected,
    });
    if (change.kind === 'apply') {
      commit(change.selection);
      return;
    }
    pending = change.pending;
    publish();
  };

  const setVariable = (path: string, value: unknown): void => {
    const state = target();
    if (!state) return;
    commit(selectionWithVariable(state.selection, path, value));
  };

  const setAddOnQuantity = (addOnId: string, quantity: number): void => {
    const state = target();
    if (!state) return;
    commit(selectionWithAddOnQuantity(state.pricing, state.selection, addOnId, quantity));
  };

  const setBillingPeriod = (billingPeriodId: string): void => {
    const state = target();
    if (!state) return;
    commit({ ...state.selection, billingPeriod: billingPeriodId });
  };

  const resetVariables = (): void => {
    const state = target();
    if (!state) return;
    commit({ ...state.selection, variables: cloneValue(state.pricing.variables) });
  };

  // [impl->req~use-pricing-selection-confirm-input~1]
  // The selection in effect is read now, not when the change became pending.
  const confirm = (): void => {
    const state = target();
    if (!state || !pending) return;
    const change = pending;
    pending = undefined;
    commit(applySelectionChange(state.pricing, state.selection, change));
  };

  const cancel = (): void => {
    if (!pricing || !pending) return;
    pending = undefined;
    publish();
  };

  // [impl->req~use-pricing-selection-apply~1]
  const apply = (input: Partial<PricingSelection>): ApplySelectionInputResult | undefined => {
    const state = target();
    if (!state) return undefined;
    const current = reconcileSelection(state.pricing, state.selection).selection;
    const result = applySelectionInput(state.pricing, current, input);
    pending = undefined;
    commit(result.selection);
    return result;
  };

  // [impl->req~use-pricing-selection-current~1]
  const relationOf = (planId: string): SelectionRelation | undefined => {
    const { current } = snapshot;
    if (!pricing || !current) return undefined;
    return planRelation(pricing, current.planId, planId);
  };

  // [impl->req~use-pricing-selection-compare~1]
  const compareWithCurrent = (): SelectionComparison | undefined => {
    const { current, selection } = snapshot;
    const currentSelection = options.currentSelection;
    if (!pricing || !current || !selection || !currentSelection) return undefined;
    return compareSelections({
      before: { pricing, selection: currentSelection },
      after: { pricing, selection },
      ...(options.expressionOptions ? { expression: options.expressionOptions } : {}),
    });
  };

  return {
    subscribe(listener) {
      // a wrapper per call, so the same function subscribed twice is removed one at a time
      const entry = (): void => listener();
      listeners.add(entry);
      return () => {
        listeners.delete(entry);
      };
    },
    getSnapshot: () => snapshot,
    setInput,
    selectPlan,
    toggleAddOn,
    setVariable,
    setAddOnQuantity,
    setBillingPeriod,
    resetVariables,
    confirm,
    cancel,
    apply,
    relationOf,
    compareWithCurrent,
  };
}
