import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { configurePricingRenderer } from '../../src/core/index.js';
import type { NormalizedPricing, PricingSelection } from '../../src/core/index.js';
import { PricingRendererContext } from '../../src/react/provider.js';
import { parsePricingYaml } from '../../src/yaml/index.js';

interface SyncEntry {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => unknown;
  getServerSnapshot?: () => unknown;
}

// The hook harness of design D7: hooks run as plain functions. State slots persist between calls,
// so calling the hook again is a re-render of the same component instance.
const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  contexts: new Map<object, unknown>(),
  sync: [] as SyncEntry[],
  layout: [] as (() => unknown)[],
  passive: [] as (() => unknown)[],
}));

vi.mock('react', () => {
  function slot<T>(init: () => T): T {
    const index = harness.cursor++;
    if (!(index in harness.slots)) harness.slots[index] = init();
    return harness.slots[index] as T;
  }
  const members = {
    createContext: (defaultValue: unknown) => ({ defaultValue }),
    useContext(context: { defaultValue: unknown }) {
      if (harness.contexts.has(context)) return harness.contexts.get(context);
      return context.defaultValue;
    },
    useState(init: unknown) {
      const create = () => (typeof init === 'function' ? (init as () => unknown)() : init);
      return [slot(create), () => {}];
    },
    useRef: (value: unknown) => slot(() => ({ current: value })),
    useMemo: (factory: () => unknown) => factory(),
    useCallback: (callback: unknown) => callback,
    useSyncExternalStore(
      subscribe: SyncEntry['subscribe'],
      getSnapshot: () => unknown,
      getServerSnapshot?: () => unknown,
    ) {
      harness.sync.push({ subscribe, getSnapshot, getServerSnapshot });
      return getSnapshot();
    },
    useEffect(callback: () => unknown) {
      harness.passive.push(callback);
    },
    useLayoutEffect(callback: () => unknown) {
      harness.layout.push(callback);
    },
    useId: () => 'id',
    forwardRef: (render: unknown) => render,
    createElement: () => null,
    Fragment: Symbol.for('react.fragment'),
  };
  return { ...members, default: members };
});

type Loose = Record<string, unknown>;
type UseSelection = (pricing: NormalizedPricing | undefined, options: Loose) => Loose;

interface ViewModelShape {
  locale: string;
  messages: Record<string, string>;
  presentation: { planBadges: Record<string, { label: string }[]> };
  resolved: { planPrices: Record<string, { kind: string }> };
}
interface Detail {
  selection: PricingSelection;
  resolved: unknown;
}
interface ApplyResult {
  selection: PricingSelection;
  diagnostics: { code: string }[];
}

const fixture = new URL('../fixtures/acme-pricing.yml', import.meta.url);
const acmeText = readFileSync(fileURLToPath(fixture), 'utf8');
const load = (): NormalizedPricing => parsePricingYaml(acmeText).value as NormalizedPricing;

let usePricingSelection: UseSelection;

// The module is read through a catch, so a missing file fails this assertion and not the import.
beforeAll(async () => {
  const mod = (await import('../../src/react/use-pricing-selection.js').catch(() => ({}))) as Loose;
  expect(mod.usePricingSelection).toBeTypeOf('function');
  usePricingSelection = mod.usePricingSelection as UseSelection;
});

beforeEach(() => {
  harness.slots.length = 0;
  harness.cursor = 0;
  harness.contexts.clear();
  harness.sync.length = 0;
  harness.layout.length = 0;
  harness.passive.length = 0;
  configurePricingRenderer();
});

afterEach(() => {
  configurePricingRenderer();
});

// One render of the component: the cursor restarts, so the slots of the first render are reused.
function render(pricing: NormalizedPricing | undefined, options: Loose = {}): Loose {
  expect(usePricingSelection).toBeTypeOf('function');
  harness.cursor = 0;
  return usePricingSelection(pricing, options);
}

function act<T>(state: Loose, name: string, ...args: unknown[]): T {
  expect(state[name], name).toBeTypeOf('function');
  return (state[name] as (...values: unknown[]) => T)(...args);
}

const selectionOf = (state: Loose): PricingSelection => state.selection as PricingSelection;
const viewModelOf = (state: Loose): ViewModelShape => state.viewModel as ViewModelShape;
const badge = (label: string) => [{ id: label, label, tone: 'accent' as const }];
const provide = (value: Loose | undefined): void => {
  harness.contexts.set(PricingRendererContext, value);
};
const detailOf = (spy: ReturnType<typeof vi.fn>): Detail => spy.mock.calls[0]![0] as Detail;

function selectedIds(state: Loose): string[] {
  const entries = Object.entries(selectionOf(state).addOns);
  const selected = entries.filter(([, entry]) => entry.selected);
  return selected.map(([id]) => id);
}

function badgeLabel(state: Loose, planId: string): string | undefined {
  return viewModelOf(state).presentation.planBadges[planId]?.[0]?.label;
}

// [utest->req~use-pricing-selection-uncontrolled~1] [utest->req~use-pricing-selection-state~1]
describe('usePricingSelection holds the selection between renders', () => {
  it('shows a plan change on the next render and notifies the subscribers once', () => {
    const acme = load();
    const first = render(acme);
    const listener = vi.fn();
    expect(harness.sync.length).toBeGreaterThan(0);
    harness.sync[0]!.subscribe(listener);
    act(first, 'selectPlan', 'growth');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(selectionOf(render(acme)).planId).toBe('growth');
  });

  it('gives the server snapshot of the client snapshot', () => {
    render(load());
    const entry = harness.sync[0]!;
    expect(entry.getServerSnapshot).toBeTypeOf('function');
    expect(Object.is(entry.getServerSnapshot!(), entry.getSnapshot())).toBe(true);
  });

  it('registers no effect and re-rendering notifies no subscriber', () => {
    const acme = load();
    const first = render(acme);
    const listener = vi.fn();
    const unsubscribe = harness.sync[0]!.subscribe(listener);
    const snapshot = harness.sync[0]!.getSnapshot();
    const second = render(acme);
    // The hook state lives in the store: no layout or passive effect is registered.
    expect(harness.layout).toHaveLength(0);
    expect(harness.passive).toHaveLength(0);
    expect(listener).not.toHaveBeenCalled();
    expect(Object.is(harness.sync[1]!.getSnapshot(), snapshot)).toBe(true);
    expect(Object.is(second.selection, first.selection)).toBe(true);
    unsubscribe();
  });
});

// [utest->req~use-pricing-selection-view-model~2]
describe('usePricingSelection snapshot stability', () => {
  const options = () => ({
    defaultSelection: { planId: 'growth' },
    messages: { 'cta.select': 'Choose' },
    presentation: { planBadges: { growth: badge('Instance') } },
  });

  it('returns the same view model for fresh but equal options', () => {
    const acme = load();
    const first = render(acme, options());
    const second = render(acme, options());
    expect(Object.is(second.viewModel, first.viewModel)).toBe(true);
    expect(Object.is(second.selection, first.selection)).toBe(true);
    expect(Object.is(second.resolved, first.resolved)).toBe(true);
  });

  it('builds a new view model when an option differs', () => {
    const acme = load();
    const first = render(acme, options());
    const second = render(acme, { ...options(), locale: 'es-ES' });
    expect(Object.is(second.viewModel, first.viewModel)).toBe(false);
    expect(viewModelOf(second).locale).toBe('es-ES');
  });

  it('returns the resolved field of the view model', () => {
    const state = render(load(), options());
    expect(Object.is(state.resolved, (state.viewModel as Loose).resolved)).toBe(true);
  });

  it('keeps a price for the same pricing and resets the stabilizer for a new one', () => {
    const rateText = acmeText.replace("price: '4 * #seats'", "price: 'rate() * #seats'");
    expect(rateText).not.toBe(acmeText);
    const loadRate = () => parsePricingYaml(rateText).value as NormalizedPricing;
    const kindOf = (state: Loose): string | undefined => {
      const planPrices = viewModelOf(state).resolved.planPrices;
      return planPrices.starter?.kind;
    };
    const withRate = { expressionOptions: { functions: { rate: () => 30 } } };
    const pricing = loadRate();
    expect(kindOf(render(pricing, withRate))).toBe('amount');
    expect(kindOf(render(pricing, { expressionOptions: {} }))).toBe('amount');
    expect(kindOf(render(loadRate(), { expressionOptions: {} }))).toBe('error');
  });
});

// [utest->req~use-pricing-selection-notify~1] [utest->req~use-pricing-selection-controlled~1]
describe('usePricingSelection reports changes', () => {
  it('calls the latest onSelectionChange with selection and resolved', () => {
    const acme = load();
    const stale = vi.fn();
    const latest = vi.fn();
    const first = render(acme, { onSelectionChange: stale });
    render(acme, { onSelectionChange: latest });
    act(first, 'selectPlan', 'growth');
    expect(stale).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledTimes(1);
    expect(detailOf(latest).selection.planId).toBe('growth');
    expect(detailOf(latest).resolved).toBeDefined();
  });

  it('keeps a controlled selection when the host ignores the change', () => {
    const acme = load();
    const selection = { ...selectionOf(render(acme)) };
    const onSelectionChange = vi.fn();
    const options = { selection, onSelectionChange };
    act(render(acme, options), 'selectPlan', 'growth');
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(detailOf(onSelectionChange).selection.planId).toBe('growth');
    expect(selectionOf(render(acme, options)).planId).toBe('starter');
  });
});

// [utest->req~use-pricing-selection-pending~1] [utest->req~use-pricing-selection-apply~1]
describe('usePricingSelection pending changes and apply', () => {
  const growth = { defaultSelection: { planId: 'growth' } };

  it('holds a dependency change as pending until confirm', () => {
    const acme = load();
    act(render(acme, growth), 'toggleAddOn', 'prioritySuccess', true);
    const pending = render(acme, growth);
    expect((pending.pending as { addIds: string[] }).addIds).toEqual(['extraStorage']);
    expect(selectedIds(pending)).toEqual([]);
    act(pending, 'confirm');
    const confirmed = render(acme, growth);
    expect(confirmed.pending).toBeUndefined();
    expect(selectedIds(confirmed).sort()).toEqual(['extraStorage', 'prioritySuccess']);
  });

  it('drops a pending change on cancel', () => {
    const acme = load();
    act(render(acme, growth), 'toggleAddOn', 'prioritySuccess', true);
    act(render(acme, growth), 'cancel');
    const state = render(acme, growth);
    expect(state.pending).toBeUndefined();
    expect(selectedIds(state)).toEqual([]);
  });

  it('applies a partial selection and drops the pending change', () => {
    const acme = load();
    act(render(acme, growth), 'toggleAddOn', 'prioritySuccess', true);
    const before = render(acme, growth);
    const result = act<ApplyResult | undefined>(before, 'apply', { billingPeriod: 'yearly' });
    expect(result?.selection.billingPeriod).toBe('yearly');
    const state = render(acme, growth);
    expect(state.pending).toBeUndefined();
    expect(selectionOf(state).billingPeriod).toBe('yearly');
  });

  it('reports an unknown plan and keeps the selection', () => {
    const acme = load();
    const state = render(acme, growth);
    const result = act<ApplyResult | undefined>(state, 'apply', { planId: 'legacy' });
    const codes = result?.diagnostics.map((diagnostic) => diagnostic.code);
    expect(codes).toEqual(['PR_SELECTION_UNKNOWN_PLAN']);
    expect(selectionOf(render(acme, growth)).planId).toBe('growth');
  });
});

// [utest->req~use-pricing-selection-pricing-change~1]
describe('usePricingSelection with a new pricing', () => {
  it('restarts from the default selection and drops pending', () => {
    const options = { defaultSelection: { planId: 'growth' } };
    const acme = load();
    act(render(acme, options), 'selectPlan', 'enterprise');
    act(render(acme, options), 'toggleAddOn', 'prioritySuccess', true);
    const held = render(acme, options);
    expect(selectionOf(held).planId).toBe('enterprise');
    expect(held.pending).toBeDefined();
    const restarted = render(load(), options);
    expect(selectionOf(restarted).planId).toBe('growth');
    expect(restarted.pending).toBeUndefined();
  });

  it('keeps the selection for the same pricing object', () => {
    const acme = load();
    act(render(acme), 'selectPlan', 'enterprise');
    expect(selectionOf(render(acme)).planId).toBe('enterprise');
  });
});

// [utest->req~use-pricing-selection-current~1] [utest->req~use-pricing-selection-compare~1]
describe('usePricingSelection current plan', () => {
  const options = {
    currentSelection: { planId: 'growth' },
    defaultSelection: { planId: 'enterprise' },
  };

  it('derives the current context and the plan relations', () => {
    const state = render(load(), options);
    expect((state.current as { planId: string }).planId).toBe('growth');
    expect(act(state, 'relationOf', 'enterprise')).toBe('upgrade');
    expect(act(state, 'relationOf', 'starter')).toBe('downgrade');
    expect(act(state, 'relationOf', 'growth')).toBe('current');
  });

  it('gives no current context and no comparison without currentSelection', () => {
    const state = render(load(), {});
    expect(state.current).toBeUndefined();
    expect(act(state, 'relationOf', 'growth')).toBeUndefined();
    expect(act(state, 'compareWithCurrent')).toBeUndefined();
  });

  it('compares the selection with the current one', () => {
    const state = render(load(), options);
    const comparison = act<{ relation: string } | undefined>(state, 'compareWithCurrent');
    expect(comparison?.relation).toBe('upgrade');
  });
});

// [utest->req~provider-config-precedence~1]
describe('usePricingSelection reads a hand-driven provider context', () => {
  const defaultSelection = { variables: { seats: 40 } };

  it('takes the config of the context value, then the instance option', () => {
    configurePricingRenderer({ locale: 'en-US' });
    provide({ config: { locale: 'es-ES', variablesEnabled: false } });
    const acme = load();
    const fromProvider = render(acme, { defaultSelection });
    expect(viewModelOf(fromProvider).locale).toBe('es-ES');
    expect(selectionOf(fromProvider).variables.seats).toBe(5);
    const instance = { defaultSelection, locale: 'fr-FR', variablesEnabled: true };
    const fromInstance = render(acme, instance);
    expect(viewModelOf(fromInstance).locale).toBe('fr-FR');
    expect(selectionOf(fromInstance).variables.seats).toBe(40);
  });

  it('follows a changed context value on the next render', () => {
    const acme = load();
    provide({ config: { locale: 'es-ES' } });
    expect(viewModelOf(render(acme)).locale).toBe('es-ES');
    provide({ config: { locale: 'de-DE' } });
    expect(viewModelOf(render(acme)).locale).toBe('de-DE');
    provide(undefined);
    expect(viewModelOf(render(acme)).locale).toBe('en-US');
  });

  it('falls back to the global configuration for a context value without config', () => {
    configurePricingRenderer({ locale: 'it-IT', variablesEnabled: false });
    provide({});
    const state = render(load(), { defaultSelection });
    expect(viewModelOf(state).locale).toBe('it-IT');
    expect(selectionOf(state).variables.seats).toBe(5);
  });
});

// [utest->req~provider-presentation-precedence~1]
describe('usePricingSelection presentation layers from a hand-driven context', () => {
  it('orders custom, global, provider config, provider and instance', () => {
    const global = badge('Global');
    configurePricingRenderer({
      presentation: { planBadges: { starter: global, growth: global, enterprise: global } },
    });
    const c = badge('Config');
    provide({
      config: { presentation: { planBadges: { growth: c, enterprise: c } } },
      presentation: { planBadges: { enterprise: badge('Provider') } },
    });
    const instance = { presentation: { planBadges: { starter: badge('Instance') } } };
    const state = render(load(), instance);
    expect(badgeLabel(state, 'starter')).toBe('Instance');
    expect(badgeLabel(state, 'growth')).toBe('Config');
    expect(badgeLabel(state, 'enterprise')).toBe('Provider');
  });

  it('keeps custom.pricingRenderer under every other layer', () => {
    provide({ presentation: { planBadges: { starter: badge('Provider') } } });
    const state = render(load(), {});
    expect(badgeLabel(state, 'starter')).toBe('Provider');
    expect(badgeLabel(state, 'growth')).toBe('Most popular');
  });
});

// [utest->req~provider-messages-merge~1]
describe('usePricingSelection messages from a hand-driven context', () => {
  it('replaces one key of the provider catalog and keeps the others', () => {
    provide({ messages: { 'summary.title': 'Your plan', 'cta.select': 'Pick' } });
    const state = render(load(), { messages: { 'cta.select': 'Choose' } });
    expect(viewModelOf(state).messages['cta.select']).toBe('Choose');
    expect(viewModelOf(state).messages['summary.title']).toBe('Your plan');
  });
});

// [utest->req~provider-nearest~1]
describe('usePricingSelection reads only the context value', () => {
  it('takes nothing from a value that holds messages only', () => {
    configurePricingRenderer({ locale: 'es-ES' });
    provide({ messages: { 'cta.select': 'Inner' } });
    const state = render(load(), {});
    expect(viewModelOf(state).locale).toBe('es-ES');
    expect(viewModelOf(state).messages['cta.select']).toBe('Inner');
  });
});

// [utest->req~provider-absent-global~1]
describe('usePricingSelection reads the global configuration at render time', () => {
  it('uses the configuration of each render', () => {
    const acme = load();
    const options = { defaultSelection: { variables: { seats: 40 } } };
    const first = render(acme, options);
    expect(viewModelOf(first).locale).toBe('en-US');
    expect(selectionOf(first).variables.seats).toBe(40);
    configurePricingRenderer({ locale: 'es-ES', variablesEnabled: false });
    const state = render(acme, options);
    expect(viewModelOf(state).locale).toBe('es-ES');
    expect(selectionOf(state).variables.seats).toBe(5);
  });
});
