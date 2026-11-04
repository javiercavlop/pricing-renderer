import { beforeAll, describe, expect, it, vi } from 'vitest';

const recorded = vi.hoisted(() => ({
  props: [] as Record<string, unknown>[],
  options: [] as Record<string, unknown>[],
}));

vi.mock('@lit/react', () => ({
  createComponent: (options: Record<string, unknown>) => {
    recorded.options.push(options);
    return (props: Record<string, unknown>) => {
      recorded.props.push(props);
      return null;
    };
  },
}));

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
});
