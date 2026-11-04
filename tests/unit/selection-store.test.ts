import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { compareSelections, createDefaultSelection } from '../../src/core/index.js';
import type {
  ApplySelectionInputResult,
  NormalizedPricing,
  PendingAddOnChange,
  PricingSelection,
  ResolvedPricing,
  SelectionComparison,
  SelectionRelation,
} from '../../src/core/index.js';
import { parsePricingYaml } from '../../src/yaml/index.js';

// Names the implementation uses (design D7, "Store API"), for the implementer:
//
// - `src/react/selection-store.ts` exports `createSelectionStore()`, which returns a store with
//   `subscribe`, `getSnapshot`, `setInput(pricing, options)`, the actions `selectPlan`,
//   `toggleAddOn`, `setVariable`, `setAddOnQuantity`, `setBillingPeriod`, `resetVariables`,
//   `confirm`, `cancel`, `apply`, and the queries `relationOf` and `compareWithCurrent`.
// - `getSnapshot()` is `{ selection, viewModel, resolved, pending, current }`, the identical object
//   until the state changes, every field `undefined` while `pricing` is `undefined`.
// - `setInput` is a render-time call: it updates the snapshot and calls no listener.
// - A change that yields a new snapshot calls every listener once. A member that produces a next
//   selection calls `options.onSelectionChange` once, also for an equal selection, which keeps the
//   snapshot object and notifies nobody.
// - The actions keep their identity for the life of the store.

type Loose = Record<string, unknown>;

interface ChangeDetail {
  selection: PricingSelection;
  resolved: ResolvedPricing;
}

interface Snapshot {
  selection: PricingSelection | undefined;
  viewModel: { resolved: ResolvedPricing } | undefined;
  resolved: ResolvedPricing | undefined;
  pending: PendingAddOnChange | undefined;
  current: { planId: string; addOnIds: ReadonlySet<string> } | undefined;
}

interface Store {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => Snapshot;
  setInput: (pricing: NormalizedPricing | undefined, options: Loose) => void;
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

const actionNames = [
  'selectPlan',
  'toggleAddOn',
  'setVariable',
  'setAddOnQuantity',
  'setBillingPeriod',
  'resetVariables',
  'confirm',
  'cancel',
  'apply',
  'relationOf',
  'compareWithCurrent',
] as const;

const storePath = '../../src/react/selection-store.js';

let storeModule: Loose = {};
let acmeText = '';
let acme: NormalizedPricing;
let acme2: NormalizedPricing;
let rated1: NormalizedPricing;
let rated2: NormalizedPricing;

function parse(text: string): NormalizedPricing {
  const result = parsePricingYaml(text);
  expect(result.value, JSON.stringify(result.diagnostics)).toBeDefined();
  return result.value as NormalizedPricing;
}

beforeAll(async () => {
  // the scan below reads src/react as text; the cache is reset before the only import of a module
  vi.resetModules();
  storeModule = (await import('../../src/react/selection-store.js').catch(() => ({}))) as Loose;
  acmeText = readFileSync(
    fileURLToPath(new URL('../fixtures/acme-pricing.yml', import.meta.url)),
    'utf8',
  );
  acme = parse(acmeText);
  acme2 = parse(acmeText);
  const rated = acmeText.replace("price: '4 * #seats'", "price: 'rate() * #seats'");
  expect(rated).not.toBe(acmeText);
  rated1 = parse(rated);
  rated2 = parse(rated);
});

// A store with no input yet. The function is asserted before its first call.
function createStore(): Store {
  expect(storeModule.createSelectionStore, `${storePath} createSelectionStore`).toBeTypeOf(
    'function',
  );
  return (storeModule.createSelectionStore as () => Store)();
}

function newStore(pricing: NormalizedPricing | undefined, options: Loose = {}): Store {
  const store = createStore();
  store.setInput(pricing, options);
  return store;
}

function selectionOf(store: Store): PricingSelection {
  const { selection } = store.getSnapshot();
  expect(selection).toBeDefined();
  return selection as PricingSelection;
}

function pendingOf(store: Store): PendingAddOnChange {
  const { pending } = store.getSnapshot();
  expect(pending).toBeDefined();
  return pending as PendingAddOnChange;
}

function selectedAddOns(selection: PricingSelection): string[] {
  return Object.entries(selection.addOns)
    .filter(([, state]) => state.selected)
    .map(([id]) => id);
}

function spy(): ReturnType<typeof vi.fn<(detail: ChangeDetail) => void>> {
  return vi.fn<(detail: ChangeDetail) => void>();
}

function reported(onChange: ReturnType<typeof spy>, index = 0): ChangeDetail {
  const call = onChange.mock.calls[index];
  expect(call, `onSelectionChange call ${index}`).toBeDefined();
  return (call as [ChangeDetail])[0];
}

function starterKind(store: Store): string | undefined {
  return store.getSnapshot().viewModel?.resolved.planPrices.starter?.kind;
}

// [utest->req~use-pricing-selection-changes~1]
describe('changes go through the core', () => {
  it('limits a quantity above the maximum', () => {
    const store = newStore(acme, { defaultSelection: { planId: 'growth' } });
    store.setAddOnQuantity('extraStorage', 40);
    expect(selectionOf(store).addOns.extraStorage).toEqual({ selected: true, quantity: 10 });
  });

  it('works on the unreconciled controlled selection', () => {
    const selection: PricingSelection = {
      ...createDefaultSelection(acme),
      planId: 'starter',
      addOns: {
        extraStorage: { selected: true, quantity: 1 },
        prioritySuccess: { selected: true, quantity: 1 },
      },
    };
    const store = newStore(acme, { selection });
    store.toggleAddOn('extraStorage', false);
    expect(pendingOf(store).removeIds).toEqual(['prioritySuccess']);
  });

  it('sets a variable and the billing period', () => {
    const store = newStore(acme, {});
    store.setVariable('seats', 12);
    store.setBillingPeriod('yearly');
    const selection = selectionOf(store);
    expect(selection.variables.seats).toBe(12);
    expect(selection.billingPeriod).toBe('yearly');
  });

  it('resets the variables to the pricing values and keeps the rest', () => {
    const store = newStore(acme, {});
    store.setVariable('seats', 12);
    store.setBillingPeriod('yearly');
    store.resetVariables();
    const selection = selectionOf(store);
    expect(selection.variables).toEqual(acme.variables);
    expect(selection.billingPeriod).toBe('yearly');
  });

  it('does nothing while there is no pricing', () => {
    const store = newStore(undefined, {});
    const listener = vi.fn();
    store.subscribe(listener);
    store.selectPlan('growth');
    store.toggleAddOn('extraStorage', true);
    store.setVariable('seats', 12);
    store.setAddOnQuantity('extraStorage', 2);
    store.setBillingPeriod('yearly');
    store.resetVariables();
    store.confirm();
    store.cancel();
    expect(store.apply({ planId: 'growth' })).toBeUndefined();
    expect(store.relationOf('growth')).toBeUndefined();
    expect(store.compareWithCurrent()).toBeUndefined();
    expect(listener).not.toHaveBeenCalled();
    expect(store.getSnapshot()).toEqual({
      selection: undefined,
      viewModel: undefined,
      resolved: undefined,
      pending: undefined,
      current: undefined,
    });
  });
});

// [utest->req~use-pricing-selection-notify~1]
describe('selection changes are reported', () => {
  it('reports a plan change at once', () => {
    const onSelectionChange = spy();
    const store = newStore(acme, { onSelectionChange });
    store.selectPlan('growth');
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(reported(onSelectionChange).selection.planId).toBe('growth');
    expect(reported(onSelectionChange).resolved).toEqual(store.getSnapshot().resolved);
  });

  it('reports a variable change', () => {
    const onSelectionChange = spy();
    const store = newStore(acme, { onSelectionChange });
    store.selectPlan('growth');
    onSelectionChange.mockClear();
    store.setVariable('seats', 12);
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(reported(onSelectionChange).selection.variables.seats).toBe(12);
  });

  it('reports an equal selection and keeps the snapshot', () => {
    const onSelectionChange = spy();
    const store = newStore(acme, { onSelectionChange });
    const listener = vi.fn();
    store.subscribe(listener);
    const before = store.getSnapshot();
    expect(before.selection?.planId).toBe('starter');
    store.selectPlan('starter');
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(reported(onSelectionChange).selection.planId).toBe('starter');
    expect(Object.is(store.getSnapshot(), before)).toBe(true);
    expect(listener).not.toHaveBeenCalled();
  });

  it('reports a confirmed change once and the pending step none', () => {
    const onSelectionChange = spy();
    const store = newStore(acme, {
      defaultSelection: { planId: 'growth' },
      onSelectionChange,
    });
    store.toggleAddOn('prioritySuccess', true);
    expect(onSelectionChange).not.toHaveBeenCalled();
    store.confirm();
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(selectedAddOns(reported(onSelectionChange).selection).sort()).toEqual([
      'extraStorage',
      'prioritySuccess',
    ]);
  });

  it('reports an applied selection', () => {
    const onSelectionChange = spy();
    const store = newStore(acme, { onSelectionChange });
    store.apply({ planId: 'enterprise' });
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(reported(onSelectionChange).selection.planId).toBe('enterprise');
  });

  it('notifies each listener once for a change and none for a render-time input', () => {
    const store = newStore(acme, {});
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    const before = store.getSnapshot();
    store.setInput(acme, { locale: 'es-ES', mode: 'catalog' });
    expect(listener).not.toHaveBeenCalled();
    const afterInput = store.getSnapshot();
    expect(Object.is(afterInput, before)).toBe(false);
    expect(afterInput.viewModel).toMatchObject({ locale: 'es-ES', mode: 'catalog' });
    store.selectPlan('growth');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(Object.is(store.getSnapshot(), afterInput)).toBe(false);
    unsubscribe();
    store.selectPlan('enterprise');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('keeps the snapshot for an equal input and between changes', () => {
    const store = newStore(acme, { defaultSelection: { planId: 'growth' }, locale: 'es-ES' });
    const first = store.getSnapshot();
    expect(Object.is(store.getSnapshot(), first)).toBe(true);
    store.setInput(acme, { defaultSelection: { planId: 'growth' }, locale: 'es-ES' });
    expect(Object.is(store.getSnapshot(), first)).toBe(true);
  });

  it('keeps the identity of every action for the life of the store', () => {
    const store = newStore(acme, {});
    const bound = actionNames.map((name) => store[name]);
    store.setInput(acme2, { locale: 'es-ES' });
    store.selectPlan('growth');
    store.toggleAddOn('prioritySuccess', true);
    actionNames.forEach((name, index) => {
      expect(Object.is(store[name], bound[index]), name).toBe(true);
    });
  });

  it('does not share the snapshot between two stores', () => {
    const one = newStore(acme, {});
    const other = newStore(acme, {});
    one.selectPlan('growth');
    expect(selectionOf(other).planId).toBe('starter');
  });
});

// [utest->req~use-pricing-selection-controlled~1]
describe('controlled selection is never stored', () => {
  it('reports the change and keeps the controlled selection when the host ignores it', () => {
    const onSelectionChange = spy();
    const store = newStore(acme, { selection: createDefaultSelection(acme), onSelectionChange });
    store.selectPlan('growth');
    expect(reported(onSelectionChange).selection.planId).toBe('growth');
    expect(selectionOf(store).planId).toBe('starter');
  });

  it('returns the applied result and keeps the controlled selection', () => {
    const onSelectionChange = spy();
    const store = newStore(acme, { selection: createDefaultSelection(acme), onSelectionChange });
    onSelectionChange.mockClear();
    const result = store.apply({ planId: 'growth' });
    expect(result?.selection.planId).toBe('growth');
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(reported(onSelectionChange).selection.planId).toBe('growth');
    expect(selectionOf(store).planId).toBe('starter');
  });

  it('follows the selection the host passes next', () => {
    const store = newStore(acme, { selection: createDefaultSelection(acme) });
    store.setInput(acme, { selection: { ...createDefaultSelection(acme), planId: 'enterprise' } });
    expect(selectionOf(store).planId).toBe('enterprise');
  });
});

// [utest->req~use-pricing-selection-uncontrolled~1]
describe('uncontrolled selection is held', () => {
  it('keeps a plan change', () => {
    const store = newStore(acme, {});
    store.selectPlan('growth');
    expect(selectionOf(store).planId).toBe('growth');
  });

  it('starts from the default selection merged into the defaults', () => {
    const store = newStore(acme, { defaultSelection: { planId: 'enterprise' } });
    expect(selectionOf(store).planId).toBe('enterprise');
    expect(selectionOf(store).billingPeriod).toBe('monthly');
  });
});

// [utest->req~use-pricing-selection-pricing-change~1]
describe('a new pricing restarts the selection', () => {
  it('sets the default selection again and drops the pending change', () => {
    const store = newStore(acme, { defaultSelection: { planId: 'growth' } });
    store.selectPlan('enterprise');
    store.toggleAddOn('prioritySuccess', true);
    expect(pendingOf(store).addIds).toEqual(['extraStorage']);
    store.setInput(acme2, { defaultSelection: { planId: 'growth' } });
    expect(selectionOf(store).planId).toBe('growth');
    expect(store.getSnapshot().pending).toBeUndefined();
  });

  it('keeps the selection and the pending change for the same pricing object', () => {
    const store = newStore(acme, { defaultSelection: { planId: 'growth' } });
    store.selectPlan('enterprise');
    store.toggleAddOn('prioritySuccess', true);
    store.setInput(acme, { defaultSelection: { planId: 'growth' } });
    expect(selectionOf(store).planId).toBe('enterprise');
    expect(pendingOf(store).addIds).toEqual(['extraStorage']);
  });

  it('resets the price stabilizer when the pricing object changes', () => {
    const rate = { expressionOptions: { functions: { rate: () => 30 } } };
    const store = newStore(rated1, rate);
    expect(starterKind(store)).toBe('amount');
    store.setInput(rated2, { expressionOptions: {} });
    expect(starterKind(store)).toBe('error');
  });

  it('keeps the stabilizer for the same pricing object', () => {
    const rate = { expressionOptions: { functions: { rate: () => 30 } } };
    const store = newStore(rated1, rate);
    expect(starterKind(store)).toBe('amount');
    store.setInput(rated1, { expressionOptions: {} });
    expect(starterKind(store)).toBe('amount');
  });

  it('gives each store its own stabilizer', () => {
    const rate = { expressionOptions: { functions: { rate: () => 30 } } };
    const withRate = newStore(rated1, rate);
    expect(starterKind(withRate)).toBe('amount');
    const without = newStore(rated1, { expressionOptions: {} });
    expect(starterKind(without)).toBe('error');
  });

  it('exposes the stabilized resolved prices of the view model', () => {
    const store = newStore(acme, { locale: 'es-ES', mode: 'catalog', visibility: 'all' });
    const snapshot = store.getSnapshot();
    expect(Object.is(snapshot.resolved, snapshot.viewModel?.resolved)).toBe(true);
    expect(snapshot.resolved?.subtotal).toBe(20);
  });
});

// [utest->req~use-pricing-selection-pending~1]
describe('pending change, confirm and cancel', () => {
  it('confirms a dependency', () => {
    const store = newStore(acme, { defaultSelection: { planId: 'growth' } });
    store.toggleAddOn('prioritySuccess', true);
    expect(pendingOf(store).addIds).toEqual(['extraStorage']);
    expect(selectedAddOns(selectionOf(store))).toEqual([]);
    store.confirm();
    expect(store.getSnapshot().pending).toBeUndefined();
    expect(selectedAddOns(selectionOf(store)).sort()).toEqual(['extraStorage', 'prioritySuccess']);
  });

  it('drops the pending change on cancel and keeps the selection', () => {
    const store = newStore(acme, { defaultSelection: { planId: 'growth' } });
    store.toggleAddOn('prioritySuccess', true);
    expect(pendingOf(store)).toBeDefined();
    store.cancel();
    expect(store.getSnapshot().pending).toBeUndefined();
    expect(selectedAddOns(selectionOf(store))).toEqual([]);
  });

  it('keeps a plan change that removes add-ons pending until it is confirmed', () => {
    const store = newStore(acme, { defaultSelection: { planId: 'enterprise' } });
    store.toggleAddOn('compliance', true);
    expect(store.getSnapshot().pending).toBeUndefined();
    store.selectPlan('starter');
    expect(pendingOf(store)).toMatchObject({ planId: 'starter', removeIds: ['compliance'] });
    expect(selectionOf(store).planId).toBe('enterprise');
    store.confirm();
    expect(selectionOf(store).planId).toBe('starter');
    expect(selectedAddOns(selectionOf(store))).toEqual([]);
  });

  it('notifies the listener once when the change becomes pending', () => {
    const store = newStore(acme, { defaultSelection: { planId: 'growth' } });
    const listener = vi.fn();
    store.subscribe(listener);
    store.toggleAddOn('prioritySuccess', true);
    expect(listener).toHaveBeenCalledTimes(1);
    store.cancel();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

// [utest->req~use-pricing-selection-confirm-input~1]
describe('confirm reads the selection at confirm time', () => {
  it('confirms on the controlled selection that changed while pending', () => {
    const onSelectionChange = spy();
    const base = createDefaultSelection(acme);
    const s1: PricingSelection = { ...base, planId: 'growth', billingPeriod: 'monthly' };
    const s2: PricingSelection = { ...s1, billingPeriod: 'yearly' };
    const store = newStore(acme, { selection: s1, onSelectionChange });
    store.toggleAddOn('prioritySuccess', true);
    expect(pendingOf(store).addIds).toEqual(['extraStorage']);
    store.setInput(acme, { selection: s2, onSelectionChange });
    store.confirm();
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    const { selection } = reported(onSelectionChange);
    expect(selection.billingPeriod).toBe('yearly');
    expect(selectedAddOns(selection).sort()).toEqual(['extraStorage', 'prioritySuccess']);
  });

  it('does nothing without a pending change', () => {
    const onSelectionChange = spy();
    const store = newStore(acme, { onSelectionChange });
    const listener = vi.fn();
    store.subscribe(listener);
    const before = store.getSnapshot();
    store.confirm();
    expect(onSelectionChange).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
    expect(Object.is(store.getSnapshot(), before)).toBe(true);
  });
});

// [utest->req~use-pricing-selection-apply~1]
describe('apply a partial selection', () => {
  it('keeps the plan and reports an unknown plan', () => {
    const store = newStore(acme, { defaultSelection: { planId: 'growth' } });
    const result = store.apply({ planId: 'legacy' });
    expect(result?.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      'PR_SELECTION_UNKNOWN_PLAN',
    ]);
    expect(selectionOf(store).planId).toBe('growth');
  });

  it('drops a pending change', () => {
    const store = newStore(acme, { defaultSelection: { planId: 'growth' } });
    store.toggleAddOn('prioritySuccess', true);
    expect(pendingOf(store)).toBeDefined();
    store.apply({ billingPeriod: 'yearly' });
    expect(store.getSnapshot().pending).toBeUndefined();
    expect(selectionOf(store).billingPeriod).toBe('yearly');
    expect(selectedAddOns(selectionOf(store))).toEqual([]);
    const listener = vi.fn();
    store.subscribe(listener);
    const before = store.getSnapshot();
    store.confirm();
    expect(listener).not.toHaveBeenCalled();
    expect(Object.is(store.getSnapshot(), before)).toBe(true);
  });

  it('returns the result of the core function and holds its selection', () => {
    const store = newStore(acme, { defaultSelection: { planId: 'growth' } });
    const result = store.apply({
      planId: 'enterprise',
      addOns: { extraStorage: { selected: true, quantity: 3 } },
    });
    expect(result?.selection.planId).toBe('enterprise');
    expect(result?.removedAddOnIds).toEqual([]);
    expect(selectionOf(store)).toEqual(result?.selection);
    expect(selectionOf(store).addOns.extraStorage).toEqual({ selected: true, quantity: 3 });
  });
});

// [utest->req~use-pricing-selection-current~1]
describe('current plan and relations', () => {
  it('reads the relation of every plan for a customer on growth', () => {
    const store = newStore(acme, { currentSelection: { planId: 'growth' } });
    expect(store.relationOf('enterprise')).toBe('upgrade');
    expect(store.relationOf('starter')).toBe('downgrade');
    expect(store.relationOf('growth')).toBe('current');
    expect(store.getSnapshot().current?.planId).toBe('growth');
  });

  it('derives the current add-on ids as the element does', () => {
    const store = newStore(acme, {
      currentSelection: {
        planId: 'growth',
        addOns: {
          extraStorage: { selected: true, quantity: 2 },
          compliance: { selected: true, quantity: 1 },
          unknownAddOn: { selected: true, quantity: 1 },
        },
      },
    });
    const current = store.getSnapshot().current;
    expect(current?.planId).toBe('growth');
    expect([...(current?.addOnIds ?? [])]).toEqual(['extraStorage']);
  });

  it('has no current context without a known current plan', () => {
    for (const options of [{}, { currentSelection: { planId: 'legacy' } }]) {
      const store = newStore(acme, options);
      expect(store.getSnapshot().current).toBeUndefined();
      expect(store.relationOf('growth')).toBeUndefined();
    }
  });
});

// [utest->req~use-pricing-selection-compare~1]
describe('review from the hooks', () => {
  it('compares the selection with the current one', () => {
    const store = newStore(acme, {
      currentSelection: { planId: 'growth' },
      defaultSelection: { planId: 'enterprise' },
    });
    const review = store.compareWithCurrent();
    expect(review?.relation).toBe('upgrade');
    expect(review).toEqual(
      compareSelections({
        before: { pricing: acme, selection: { planId: 'growth' } },
        after: { pricing: acme, selection: selectionOf(store) },
      }),
    );
  });

  it('compares with the expression options of the input', () => {
    const expressionOptions = { functions: { rate: () => 30 } };
    const base = {
      currentSelection: { planId: 'growth' },
      defaultSelection: { planId: 'starter' },
    };
    const store = newStore(rated1, { ...base, expressionOptions });
    const review = store.compareWithCurrent();
    expect(review).toEqual(
      compareSelections({
        before: { pricing: rated1, selection: { planId: 'growth' } },
        after: { pricing: rated1, selection: selectionOf(store) },
        expression: expressionOptions,
      }),
    );
    const without = newStore(rated1, base).compareWithCurrent();
    expect(without).toEqual(
      compareSelections({
        before: { pricing: rated1, selection: { planId: 'growth' } },
        after: { pricing: rated1, selection: selectionOf(store) },
      }),
    );
    expect(review).not.toEqual(without);
  });

  it('gives undefined without a current context', () => {
    const store = newStore(acme, {});
    expect(store.compareWithCurrent()).toBeUndefined();
  });
});

// [utest->req~use-pricing-selection-pending~1]
describe('a pending change does not survive a direct commit', () => {
  function withPending(): Store {
    const store = newStore(acme, { defaultSelection: { planId: 'growth' } });
    store.toggleAddOn('prioritySuccess', true);
    pendingOf(store);
    return store;
  }

  it('drops it when the billing period changes', () => {
    const store = withPending();
    store.setBillingPeriod('yearly');
    expect(store.getSnapshot().pending).toBeUndefined();
    expect(selectionOf(store).billingPeriod).toBe('yearly');
  });

  it('drops it when a variable or a quantity changes', () => {
    const variable = withPending();
    variable.setVariable('seats', 12);
    expect(variable.getSnapshot().pending).toBeUndefined();
    const quantity = withPending();
    quantity.setAddOnQuantity('extraStorage', 2);
    expect(quantity.getSnapshot().pending).toBeUndefined();
  });

  it('drops it when a plan change applies at once', () => {
    const store = withPending();
    store.selectPlan('enterprise');
    expect(selectionOf(store).planId).toBe('enterprise');
    expect(store.getSnapshot().pending).toBeUndefined();
  });
});

// [utest->req~use-pricing-selection-notify~1]
describe('an add-on that the pricing does not have', () => {
  it('reports the unchanged selection once and sets no pending change', () => {
    const onSelectionChange = spy();
    const store = newStore(acme, { onSelectionChange });
    const before = store.getSnapshot();
    const listener = vi.fn();
    store.subscribe(listener);
    store.toggleAddOn('ghost', true);
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(reported(onSelectionChange).selection).toEqual(before.selection);
    expect(store.getSnapshot().pending).toBeUndefined();
    expect(Object.is(store.getSnapshot(), before)).toBe(true);
    expect(listener).not.toHaveBeenCalled();
  });

  it('reports it once and drops a pending change that was waiting', () => {
    const onSelectionChange = spy();
    const store = newStore(acme, { defaultSelection: { planId: 'growth' }, onSelectionChange });
    store.toggleAddOn('prioritySuccess', true);
    pendingOf(store);
    const before = selectionOf(store);
    store.toggleAddOn('ghost', true);
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(reported(onSelectionChange).selection).toEqual(before);
    expect(store.getSnapshot().pending).toBeUndefined();
    expect(selectionOf(store)).toEqual(before);
  });
});

// [utest->req~use-pricing-selection-controlled~1] [utest->req~use-pricing-selection-uncontrolled~1]
describe('a store that goes from controlled to uncontrolled', () => {
  it('keeps no selection of its own while controlled and holds the next ones after', () => {
    const onSelectionChange = spy();
    const controlled: PricingSelection = { ...createDefaultSelection(acme), planId: 'growth' };
    const store = newStore(acme, { selection: controlled, onSelectionChange });
    store.selectPlan('enterprise');
    expect(reported(onSelectionChange).selection.planId).toBe('enterprise');
    expect(selectionOf(store).planId).toBe('growth');

    store.setInput(acme, { onSelectionChange });
    // nothing was held while controlled, so the store has its own selection from the start
    expect(selectionOf(store).planId).toBe('starter');
    onSelectionChange.mockClear();
    store.selectPlan('enterprise');
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(reported(onSelectionChange).selection.planId).toBe('enterprise');
    expect(selectionOf(store).planId).toBe('enterprise');
  });

  it('follows a controlled selection again after it held its own', () => {
    const store = newStore(acme, {});
    store.selectPlan('growth');
    const controlled: PricingSelection = { ...createDefaultSelection(acme), planId: 'enterprise' };
    store.setInput(acme, { selection: controlled });
    expect(selectionOf(store).planId).toBe('enterprise');
    store.setInput(acme, {});
    expect(selectionOf(store).planId).toBe('growth');
  });
});

// [utest->req~use-pricing-selection-pricing-change~1]
describe('the same pricing object keeps the selection', () => {
  it('does not restart the selection or report when other options change', () => {
    const onSelectionChange = spy();
    const store = newStore(acme, { onSelectionChange });
    store.selectPlan('growth');
    onSelectionChange.mockClear();
    store.setInput(acme, { onSelectionChange, locale: 'es-ES' });
    expect(selectionOf(store).planId).toBe('growth');
    expect(onSelectionChange).not.toHaveBeenCalled();
  });
});

// [utest->req~use-pricing-selection-view-model~2]
describe('the resolved prices of the snapshot', () => {
  it('keeps the identical object for an equal selection and replaces it for a price change', () => {
    const store = newStore(acme, {});
    const first = store.getSnapshot().resolved;
    store.selectPlan('starter');
    expect(Object.is(store.getSnapshot().resolved, first)).toBe(true);
    store.setVariable('seats', 12);
    const changed = store.getSnapshot().resolved;
    expect(Object.is(changed, first)).toBe(false);
    expect(changed?.subtotal).not.toBe(first?.subtotal);
    expect(Object.is(changed, store.getSnapshot().viewModel?.resolved)).toBe(true);
  });
});

// A scan of module scope, with the TypeScript compiler API, over the text of every module under
// src/react. It imports no src/react module.
const reactRoot = fileURLToPath(new URL('../../src/react/', import.meta.url));

function listSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listSources(path);
    return /\.ts$/.test(entry.name) ? [path] : [];
  });
}

type ImportedNames = Map<string, string>;

// What `text` holds at module top level outside the allow-list of req~react-no-module-state~1,
// one line per statement; an empty list means the module passes.
function scanModuleScope(file: string, text: string): string[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const named: Record<string, ImportedNames> = { react: new Map(), '@lit/react': new Map() };
  const reactNamespaces = new Set<string>();
  const constNames = new Set<string>();

  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const clause = statement.importClause;
      const names = named[statement.moduleSpecifier.text];
      const bindings = clause?.namedBindings;
      if (!clause || clause.isTypeOnly || !bindings) continue;
      if (ts.isNamespaceImport(bindings) && statement.moduleSpecifier.text === 'react') {
        reactNamespaces.add(bindings.name.text);
      }
      if (names && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          if (!element.isTypeOnly) {
            names.set(element.name.text, (element.propertyName ?? element.name).text);
          }
        }
      }
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) constNames.add(declaration.name.text);
      }
    }
  }

  // The module and the imported name a callee stands for, or undefined.
  const importedCallee = (
    callee: ts.Expression,
  ): { module: 'react' | '@lit/react'; name: string } | undefined => {
    if (ts.isIdentifier(callee)) {
      for (const module of ['react', '@lit/react'] as const) {
        const name = named[module]?.get(callee.text);
        if (name !== undefined) return { module, name };
      }
    }
    if (
      ts.isPropertyAccessExpression(callee) &&
      ts.isIdentifier(callee.expression) &&
      reactNamespaces.has(callee.expression.text)
    ) {
      return { module: 'react', name: callee.name.text };
    }
    return undefined;
  };

  const holdsCall = (node: ts.Node): boolean =>
    ts.isCallExpression(node) ||
    ts.isNewExpression(node) ||
    ts.isTaggedTemplateExpression(node) ||
    ts.forEachChild(node, (child) => holdsCall(child) || undefined) === true;

  const allowedCall = (call: ts.CallExpression): boolean => {
    const callee = importedCallee(call.expression);
    if (callee?.module === '@lit/react') return callee.name === 'createComponent';
    if (callee?.name === 'forwardRef') return true;
    if (callee?.name === 'createContext') return !call.arguments.some(holdsCall);
    return false;
  };

  const importedFromReact = (node: ts.Expression, name: string): boolean =>
    ts.isIdentifier(node) && named.react?.get(node.text) === name;

  const isClientCheck = (declaration: ts.VariableDeclaration): boolean => {
    const init = declaration.initializer;
    if (!ts.isIdentifier(declaration.name) || declaration.name.text !== 'useClientLayoutEffect') {
      return false;
    }
    if (!init || !ts.isConditionalExpression(init)) return false;
    const { condition } = init;
    const statement = declaration.parent.parent;
    const exported =
      ts.isVariableStatement(statement) &&
      ts.getModifiers(statement)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (exported) return false;
    return (
      ts.isBinaryExpression(condition) &&
      condition.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken &&
      ts.isTypeOfExpression(condition.left) &&
      ts.isIdentifier(condition.left.expression) &&
      condition.left.expression.text === 'document' &&
      ts.isStringLiteral(condition.right) &&
      condition.right.text === 'undefined' &&
      importedFromReact(init.whenTrue, 'useLayoutEffect') &&
      importedFromReact(init.whenFalse, 'useEffect') &&
      declaration.parent.declarations.length === 1
    );
  };

  const isDisplayName = (statement: ts.ExpressionStatement): boolean => {
    const { expression } = statement;
    return (
      ts.isBinaryExpression(expression) &&
      expression.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(expression.left) &&
      expression.left.name.text === 'displayName' &&
      ts.isIdentifier(expression.left.expression) &&
      constNames.has(expression.left.expression.text) &&
      ts.isStringLiteral(expression.right)
    );
  };

  const inPrologue = (index: number): boolean =>
    source.statements
      .slice(0, index)
      .every((prev) => ts.isExpressionStatement(prev) && ts.isStringLiteral(prev.expression));

  const allowedStatement = (statement: ts.Statement, index: number): boolean => {
    if (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) return true;
    if (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) return true;
    if (ts.isFunctionDeclaration(statement)) {
      return !ts.getModifiers(statement)?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
    }
    if (ts.isExpressionStatement(statement)) {
      const { expression } = statement;
      if (ts.isStringLiteral(expression)) {
        return expression.text === 'use client' && inPrologue(index);
      }
      return isDisplayName(statement);
    }
    if (ts.isVariableStatement(statement)) {
      const list = statement.declarationList;
      if ((list.flags & ts.NodeFlags.Const) === 0) return false;
      return list.declarations.every((declaration) => {
        const init = declaration.initializer;
        if (!ts.isIdentifier(declaration.name) || !init) return false;
        if (ts.isFunctionExpression(init) || ts.isArrowFunction(init)) return true;
        if (isClientCheck(declaration)) return true;
        return ts.isCallExpression(init) && allowedCall(init);
      });
    }
    return false;
  };

  return source.statements
    .filter((statement, index) => !allowedStatement(statement, index))
    .map((statement) => `${file}: ${statement.getText(source).split('\n')[0]}`);
}

// [utest->req~react-no-module-state~1]
describe('no shared state at module scope', () => {
  it('passes the allow-list scan for every module under src/react', () => {
    const files = listSources(reactRoot);
    const names = files.map((file) => file.replace(reactRoot, ''));
    expect(names).toEqual(expect.arrayContaining(['index.ts', 'headless.ts', 'provider.ts']));
    const outside = files.flatMap((file) =>
      scanModuleScope(file.replace(reactRoot, ''), readFileSync(file, 'utf8')),
    );
    expect(outside).toEqual([]);
  });

  it('keeps the base index module inside the allow-list', () => {
    const file = join(reactRoot, 'index.ts');
    expect(existsSync(file)).toBe(true);
    expect(scanModuleScope('index.ts', readFileSync(file, 'utf8'))).toEqual([]);
  });

  const header = [
    "'use client';",
    "import { createContext, forwardRef, useEffect, useLayoutEffect } from 'react';",
    "import * as React from 'react';",
    "import { createComponent } from '@lit/react';",
    "import { createSelectionStore } from './selection-store.js';",
    "import { register } from './register.js';",
    'const PricingRenderer = forwardRef(() => null);',
  ].join('\n');

  const accepted = [
    "export { a } from './a.js';",
    "export * from './a.js';",
    "export type { T } from './t.js';",
    'export type X = number;',
    'interface I { a: string }',
    'function f() { return new Map(); }',
    'export function g() { return createSelectionStore(); }',
    "import './side-effect.js';",
    'const f = () => new Map();',
    'export const h = function () { return register(); };',
    'const C = createContext<number | undefined>(undefined);',
    'const K = createContext({ a: [1, 2], b: null });',
    'const R = React.forwardRef(() => null);',
    "const L = createComponent({ tagName: 'x', react: React });",
    "PricingRenderer.displayName = 'PricingRenderer';",
    "const useClientLayoutEffect = typeof document !== 'undefined' ? useLayoutEffect : useEffect;",
  ];

  it('accepts the header and each allowed form', () => {
    expect(scanModuleScope('header.ts', header)).toEqual([]);
    for (const text of accepted) {
      expect(scanModuleScope('ok.ts', `${header}\n${text}`), text).toEqual([]);
    }
  });

  // The module texts of the scenario "Statements outside the allow-list", then further carriers
  // of state. Each is appended to the header, so only the text itself can fail the scan.
  const rejected = [
    'export default {}',
    'class A {}',
    'enum E { A }',
    'namespace N {}',
    'let x = 1',
    'var y = 1',
    'const m = new Map()',
    'const n = 1',
    'const c = createContext(new Map())',
    'const s = createSelectionStore()',
    'PricingRenderer.cache = {}',
    'register()',
    // further carriers of state
    'export default function f() {}',
    'export = PricingRenderer',
    'const c = createContext(register())',
    'const c = createContext(0), n = 1',
    'const { a } = forwardRef(() => null)',
    "Other.displayName = 'Other'",
    'PricingRenderer.displayName = register()',
    "const useClientLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect",
    'export const cache = {}',
    'export const list = []',
    'const w = new WeakMap()',
    'const c = createContext(tag`x`)',
    "export const useClientLayoutEffect = typeof document !== 'undefined' ? useLayoutEffect : useEffect",
    "'use client'",
  ];

  it.each(rejected)('rejects the module text %s', (text) => {
    const outside = scanModuleScope('bad.ts', `${header}\n${text}`);
    expect(outside, text).not.toEqual([]);
    expect(outside.join('\n')).toContain('bad.ts');
  });

  it('rejects a createContext or forwardRef that is not imported from react', () => {
    const other = "import { createContext } from 'other';\nconst c = createContext(0);";
    expect(scanModuleScope('bad.ts', other)).not.toEqual([]);
    const missing = 'const c = createContext(0);';
    expect(scanModuleScope('bad.ts', missing)).not.toEqual([]);
    const ref = "import { forwardRef } from 'other';\nconst R = forwardRef(() => null);";
    expect(scanModuleScope('bad.ts', ref)).not.toEqual([]);
  });
});
