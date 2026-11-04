import { beforeAll, describe, expect, it, vi } from 'vitest';

const recorded = vi.hoisted(() => ({
  props: [] as Record<string, unknown>[],
  options: [] as Record<string, unknown>[],
  entries: undefined as unknown[] | undefined,
  portals: [] as { node: unknown; key: unknown }[],
  // Each value given to the entries state setter; an updater function is applied to the seeded
  // entries first.
  sets: [] as unknown[][],
  refs: [] as unknown[],
}));

// The state of the wrapper only changes after an effect, which a server render never runs: the
// test seeds the entries state directly and records what the setter receives.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const setEntries = (next: unknown): void => {
    recorded.sets.push(
      typeof next === 'function'
        ? (next as (previous: unknown[]) => unknown[])(recorded.entries ?? [])
        : (next as unknown[]),
    );
  };
  return {
    ...actual,
    useState: (init: unknown) =>
      Array.isArray(init) && recorded.entries !== undefined
        ? [recorded.entries, setEntries]
        : (actual.useState as (value: unknown) => unknown)(init),
  };
});

vi.mock('react-dom', () => ({
  createPortal: (_children: unknown, node: unknown, key: unknown) => {
    recorded.portals.push({ node, key });
    return null;
  },
}));

// A forwardRef stand-in, so the test also sees the ref callback the wrapper passes to the element.
vi.mock('@lit/react', async () => {
  const { forwardRef } = await import('react');
  return {
    createComponent: (options: Record<string, unknown>) => {
      recorded.options.push(options);
      return forwardRef((props: Record<string, unknown>, ref) => {
        recorded.props.push(props);
        recorded.refs.push(ref);
        return null;
      });
    },
  };
});

type SlotNamesOf = (props: Record<string, unknown>) => unknown;
let slotNamesOf: SlotNamesOf | undefined;
beforeAll(async () => {
  const mod = (await import('../../src/react/slots.js').catch(() => ({}))) as {
    slotNamesOf?: SlotNamesOf;
  };
  slotNamesOf = mod.slotNamesOf;
});

async function render(props: Record<string, unknown>): Promise<Record<string, unknown>> {
  expect(slotNamesOf).toBeTypeOf('function');
  const { PricingRenderer } = await import('../../src/react/index.js');
  const { createElement } = await import('react');
  const { renderToString } = await import('react-dom/server');
  renderToString(createElement(PricingRenderer, props as never));
  const last = recorded.props.at(-1);
  expect(last).toBeDefined();
  return last!;
}

// [utest->req~react-render-props-slots~1]
describe('PricingRenderer slots prop', () => {
  it('sets slots from the render props given as functions, then undefined', async () => {
    const fn = () => null;
    const withProps = await render({ yaml: 'name: x', renderError: fn, renderPlanCta: fn });
    expect(withProps.slots).toEqual(['plan-cta', 'error']);
    const without = await render({ yaml: 'name: x' });
    expect(without.slots).toBeUndefined();
  });

  it('names all four slots in order', async () => {
    const fn = () => null;
    const all = await render({
      yaml: 'name: x',
      renderError: fn,
      renderLoading: fn,
      renderSummaryActions: fn,
      renderPlanCta: fn,
    });
    expect(all.slots).toEqual(['plan-cta', 'summary-actions', 'loading', 'error']);
  });
});

// [utest->req~react-slots-attach-read~1]
describe('PricingRenderer slot events', () => {
  it('listens for pricing-slots-change through the events map', async () => {
    await render({ yaml: 'name: x' });
    const events = recorded.options.map((o) => Object.values((o.events ?? {}) as object)).flat();
    expect(events).toContain('pricing-slots-change');
  });

  it('keeps onSlotsChange attached without render props', async () => {
    const withFn = await render({ yaml: 'name: x', renderError: () => null });
    expect(withFn.onSlotsChange).toBeTypeOf('function');
    const without = await render({ yaml: 'name: x' });
    expect(without.slots).toBeUndefined();
    expect(without.onSlotsChange).toBeTypeOf('function');
  });
});

// [utest->req~react-slot-portals~2]
describe('PricingRenderer portals', () => {
  it('renders into connected nodes only and only for render props that are functions', async () => {
    const live = { isConnected: true };
    const gone = { isConnected: false };
    const loading = { isConnected: true };
    recorded.entries = [
      { slot: 'error', node: live, key: 'slot:error', context: {} },
      { slot: 'error', node: gone, key: 'slot:error', context: {} },
      { slot: 'loading', node: loading, key: 'slot:loading' },
    ];
    recorded.portals.length = 0;
    try {
      await render({ yaml: 'name: x', renderError: () => null, renderLoading: 'x' });
      expect(recorded.portals).toEqual([{ node: live, key: 'slot:error' }]);
      // Slots removed, the element re-renders and detaches the node, then the prop returns: the
      // stale entry gets no portal.
      recorded.portals.length = 0;
      await render({ yaml: 'name: x' });
      expect(recorded.portals).toEqual([]);
      live.isConnected = false;
      await render({ yaml: 'name: x', renderError: () => null });
      expect(recorded.portals).toEqual([]);
    } finally {
      recorded.entries = undefined;
    }
  });

  it('replaces the entries on an event, dropping a still-connected node the event omits', async () => {
    const owner: Record<string, unknown> = {
      triggerPlanAction: () => undefined,
      reload: () => undefined,
      resolvedState: undefined,
    };
    const slotNode = (slot: string) => ({
      isConnected: true,
      dataset: { prSlot: slot },
      parentElement: { closest: () => owner },
    });
    const kept = slotNode('loading');
    const omitted = slotNode('error');
    recorded.entries = [
      { slot: 'error', node: omitted, key: 'slot:error', context: {} },
      { slot: 'loading', node: kept, key: 'slot:loading' },
    ];
    recorded.sets.length = 0;
    try {
      await render({ yaml: 'name: x', renderError: () => null, renderLoading: () => null });
      const onSlotsChange = recorded.props.at(-1)?.onSlotsChange as (event: unknown) => void;
      expect(onSlotsChange).toBeTypeOf('function');
      const ref = recorded.refs.at(-1);
      expect(ref).toBeTypeOf('function');
      (ref as (node: unknown) => void)(owner);

      onSlotsChange({ target: owner, detail: { nodes: [kept] } });
      expect(recorded.sets).toHaveLength(1);
      const [entries] = recorded.sets;
      expect(entries).toHaveLength(1);
      expect(entries![0]).toMatchObject({ slot: 'loading', node: kept, key: 'slot:loading' });
      expect(entries!.some((entry) => (entry as { node: unknown }).node === omitted)).toBe(false);

      onSlotsChange({ target: owner, detail: { nodes: [] } });
      expect(recorded.sets).toHaveLength(2);
      expect(recorded.sets[1]).toEqual([]);
    } finally {
      recorded.entries = undefined;
    }
  });
});
