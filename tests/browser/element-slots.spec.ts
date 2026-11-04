import { expect, test, type Page } from '@playwright/test';
import { openDemo, planCta, PQ, setProps } from './helpers/change-flow.js';

// Element slots (add-react-headless, P3-11). The scenarios are those of
// openspec/changes/add-react-headless/specs/composition/spec.md that need a browser (listed in
// tasks.md, "Browser-only requirements"); the others are in tests/unit/element-slots.test.ts. A new
// element is a <pricing-renderer id="extra"> with the pricing of the demo page (Acme, en-US) and
// the given properties, appended to document.body.

type Raw = Record<string, unknown>;
type SlotElement = HTMLElement & {
  yaml?: string;
  updateComplete: Promise<unknown>;
  triggerPlanAction: (planId: string) => boolean;
};
type Store = {
  __slotEvents?: { nodes: HTMLElement[] }[];
  __kept?: HTMLElement;
  __details?: Record<string, unknown[]>;
};

const slotNode = (planId: string): string =>
  `#extra [data-pr-slot="plan-cta"][data-plan-id="${planId}"]`;
const radio = (planId: string): string =>
  `#extra input[type="radio"][name$="-plan"][value="${planId}"]`;
const summarySlot = '#extra [data-pr-slot="summary-actions"]';

// The source of the demo page, for elements that load it from a URL.
async function demoYaml(page: Page): Promise<string> {
  return page.evaluate(() => {
    const demo = document.querySelector('pricing-renderer') as SlotElement;
    return demo.yaml ?? '';
  });
}

// Appends the new element and records the pricing-slots-change events whose target is the element
// (the nodes of each, as a copy). Without `pricing` or `src` it gets the source of the demo page.
// With `wait`, it returns once the element is ready and rendered; otherwise after its first update.
async function mount(page: Page, props: Raw, wait = true, id = 'extra'): Promise<void> {
  await page.evaluate(
    async ({ props, wait, id }) => {
      const demo = document.querySelector('pricing-renderer') as SlotElement;
      const element = document.createElement('pricing-renderer') as SlotElement;
      element.id = id;
      const ownSource = 'pricing' in props || 'src' in props ? {} : { yaml: demo.yaml };
      Object.assign(element, { locale: 'en-US' }, ownSource, props);
      const events: { nodes: HTMLElement[] }[] = [];
      (window as unknown as Store).__slotEvents = events;
      element.addEventListener('pricing-slots-change', ((event: CustomEvent) => {
        if (event.target !== element) return;
        events.push({ nodes: [...(event.detail.nodes as HTMLElement[])] });
      }) as EventListener);
      const ready = new Promise<void>((resolve) => {
        element.addEventListener('pricing-ready', () => resolve(), { once: true });
      });
      document.body.append(element);
      if (wait) await ready;
      await element.updateComplete;
    },
    { props, wait, id },
  );
}

// The recorded events, each as the plan ids (or slot names) of its nodes.
async function recorded(page: Page): Promise<string[][]> {
  return page.evaluate(() =>
    ((window as unknown as Store).__slotEvents ?? []).map((event) =>
      event.nodes.map((node) => node.dataset.planId ?? node.dataset.prSlot ?? ''),
    ),
  );
}

const eventCount = async (page: Page): Promise<number> => (await recorded(page)).length;

// Whether event `b` lists the very nodes of event `a`, in the same order.
async function sameNodes(page: Page, a: number, b: number): Promise<boolean> {
  return page.evaluate(
    ({ a, b }) => {
      const events = (window as unknown as Store).__slotEvents ?? [];
      const first = events[a]?.nodes ?? [];
      const second = events[b]?.nodes ?? [];
      return first.length === second.length && first.every((node, i) => node === second[i]);
    },
    { a, b },
  );
}

async function setRaw(page: Page, props: Raw): Promise<void> {
  await setProps(page, props, '#extra');
}

test.beforeEach(async ({ page }) => {
  await openDemo(page);
});

// [utest->req~slots-property~1]
test.describe('slots property', () => {
  test('Attribute is not read', async ({ page }) => {
    await mount(page, {});
    const value = await page.evaluate(async () => {
      const element = document.querySelector('#extra') as SlotElement & { slots?: unknown };
      element.setAttribute('slots', 'plan-cta');
      await element.updateComplete;
      return typeof element.slots;
    });
    expect(value).toBe('undefined');
    await expect(page.locator('#extra [data-pr-slot]')).toHaveCount(0);
  });
});

// [utest->req~slot-plan-cta-keyed~1]
test.describe('plan slot nodes belong to one plan', () => {
  test('Pricing without the first plan', async ({ page }) => {
    await mount(page, { pricing: PQ, slots: ['plan-cta'] });
    await expect(page.locator('#extra [data-pr-slot="plan-cta"]')).toHaveCount(3);
    await page.evaluate(() => {
      const node = document.querySelector(
        '#extra [data-pr-slot="plan-cta"][data-plan-id="basic"]',
      ) as HTMLElement;
      const mark = document.createElement('span');
      mark.textContent = 'S';
      node.append(mark);
      (window as unknown as Store).__kept = node;
    });
    const plans = Object.fromEntries(
      Object.entries(PQ.plans as Raw).filter(([planId]) => planId !== 'basic'),
    );
    await setRaw(page, { pricing: { ...PQ, plans } });
    await expect(page.locator('#extra [data-pr-slot="plan-cta"]')).toHaveCount(2);
    const state = await page.evaluate(() => {
      const found = document.querySelectorAll<HTMLElement>('#extra [data-pr-slot="plan-cta"]');
      const nodes = [...found];
      const spans = [...document.querySelectorAll('span')];
      return {
        connected: (window as unknown as Store).__kept?.isConnected,
        planIds: nodes.map((node) => node.dataset.planId),
        marks: spans.filter((span) => span.textContent === 'S').length,
      };
    });
    expect(state.connected).toBe(false);
    expect(state.planIds).toEqual(['pro', 'enterprise']);
    expect(state.marks).toBe(0);
  });
});

// [utest->req~slot-summary-actions~1]
test.describe('summary actions slot node', () => {
  const cases: [string, Raw][] = [
    ['without a current plan', {}],
    ['with a current plan', { currentSelection: { planId: 'growth' } }],
  ];
  for (const [name, props] of cases) {
    test(`outside every live region, ${name}`, async ({ page }) => {
      await mount(page, { slots: ['summary-actions'], ...props });
      const inSummary = page.locator('#extra .pr-summary [data-pr-slot="summary-actions"]');
      await expect(inSummary).toHaveCount(1);
      await expect(page.locator('#extra [data-pr-part="summary-action"]')).toHaveCount(0);
      const liveAncestor = await page
        .locator(summarySlot)
        .evaluate((element) => element.closest('[aria-live]:not([aria-live="off"])'));
      expect(liveAncestor).toBeNull();
    });
  }
});

// [utest->req~slot-loading~1]
test.describe('loading slot node', () => {
  test('Slow source', async ({ page }) => {
    const src = 'https://pricing.example.test/acme.yml';
    const body = await demoYaml(page);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(src, async (route) => {
      await gate;
      await route.fulfill({
        status: 200,
        contentType: 'text/yaml',
        headers: { 'access-control-allow-origin': '*' },
        body,
      });
    });
    try {
      await mount(page, { slots: ['loading'], src }, false);
      const shell = page.locator('#extra .pr-shell--loading');
      await expect(shell).toHaveCount(1);
      const labelId = await shell.getAttribute('aria-labelledby');
      expect(labelId).toBeTruthy();
      await expect(page.locator(`[id="${labelId}"]`)).toHaveCount(1);
      await expect(shell.locator('[data-pr-slot="loading"]')).toHaveCount(1);
      await expect(page.locator('#extra .pr-skeleton')).toHaveCount(0);
    } finally {
      release();
    }
    await expect(page.locator('#extra [data-pr-part="plan-card"]')).toHaveCount(3);
    await expect(page.locator('#extra [data-pr-slot="loading"]')).toHaveCount(0);
  });
});

// [utest->req~slots-change-event~3]
test.describe('slots change event', () => {
  test('Ready, selection, removed', async ({ page }) => {
    await mount(page, { slots: ['plan-cta'] });
    await expect.poll(() => eventCount(page)).toBe(1);
    expect((await recorded(page))[0]).toEqual(['starter', 'growth', 'enterprise']);
    await page.locator(radio('enterprise')).check({ force: true });
    await expect.poll(() => eventCount(page)).toBe(2);
    expect((await recorded(page))[1]).toEqual(['starter', 'growth', 'enterprise']);
    expect(await sameNodes(page, 0, 1)).toBe(true);
    await setRaw(page, { slots: [] });
    await expect.poll(() => eventCount(page)).toBe(3);
    expect((await recorded(page))[2]).toEqual([]);
  });

  test('Update without a change', async ({ page }) => {
    await mount(page, { slots: ['plan-cta'] });
    await expect.poll(() => eventCount(page)).toBe(1);
    await setRaw(page, { slots: ['plan-cta'] });
    expect(await eventCount(page)).toBe(1);
  });

  test('Host node added to a slot node', async ({ page }) => {
    await mount(page, { slots: ['plan-cta'] });
    await expect.poll(() => eventCount(page)).toBe(1);
    await page.evaluate(() => {
      const growth = document.querySelector(
        '#extra [data-pr-slot="plan-cta"][data-plan-id="growth"]',
      ) as HTMLElement;
      const host = document.createElement('div');
      host.dataset.prSlot = 'plan-cta';
      host.dataset.planId = 'growth';
      growth.append(host);
    });
    await setRaw(page, { slots: ['plan-cta'] });
    expect(await eventCount(page)).toBe(1);
  });

  test('No slots, no event', async ({ page }) => {
    await mount(page, {});
    await page.evaluate(async () => {
      const element = document.querySelector('#extra') as SlotElement & { reload: () => unknown };
      await element.reload();
      await element.updateComplete;
    });
    expect(await eventCount(page)).toBe(0);
  });
});

// [utest->req~slots-change-event-own-nodes~1]
test.describe('slots change event lists own nodes only', () => {
  test('Nested renderer and host node', async ({ page }) => {
    await mount(page, { slots: ['plan-cta'] });
    await expect.poll(() => eventCount(page)).toBe(1);
    // The outer element's Enterprise radio is marked: a bare locator also matches the radios of
    // the nested element, which sits inside the outer element.
    await page.evaluate(async () => {
      const outer = document.querySelector('#extra') as SlotElement;
      const growth = outer.querySelector(
        '[data-pr-slot="plan-cta"][data-plan-id="growth"]',
      ) as HTMLElement;
      const host = document.createElement('div');
      host.dataset.prSlot = 'plan-cta';
      host.dataset.planId = 'growth';
      const nested = document.createElement('pricing-renderer') as SlotElement;
      Object.assign(nested, { yaml: outer.yaml, locale: 'en-US', slots: ['plan-cta'] });
      const ready = new Promise<void>((resolve) => {
        nested.addEventListener('pricing-ready', () => resolve(), { once: true });
      });
      growth.append(host, nested);
      await ready;
      await nested.updateComplete;
      const mine = [
        ...outer.querySelectorAll('input[type="radio"][name$="-plan"][value="enterprise"]'),
      ].filter((input) => input.closest('pricing-renderer') === outer);
      if (mine.length !== 1) throw new Error(`${mine.length} radios belong to the outer element.`);
      mine[0]?.setAttribute('data-outer-radio', '');
    });
    const before = await eventCount(page);
    await page.locator('input[data-outer-radio]').check({ force: true });
    await expect.poll(() => eventCount(page)).toBeGreaterThan(before);
    const events = await recorded(page);
    expect(events.at(-1)).toEqual(['starter', 'growth', 'enterprise']);
    const foreign = await page.evaluate(() => {
      const outer = document.querySelector('#extra') as HTMLElement;
      const events = (window as unknown as Store).__slotEvents ?? [];
      const nodes = events.flatMap((event) => event.nodes);
      const owner = (node: HTMLElement) =>
        node.parentElement?.closest('pricing-renderer, [data-pr-slot]');
      return nodes.filter((node) => owner(node) !== outer).length;
    });
    expect(foreign).toBe(0);
  });
});

// [utest->req~slots-change-event-summary~1]
test.describe('summary slot event on selection changes', () => {
  test('Selection changes, then nothing changes', async ({ page }) => {
    await mount(page, { slots: ['summary-actions'] });
    await expect.poll(() => eventCount(page)).toBe(1);
    await page.locator(radio('enterprise')).check({ force: true });
    await expect.poll(() => eventCount(page)).toBe(2);
    expect((await recorded(page))[1]).toEqual(['summary-actions']);
    await setRaw(page, { slots: ['summary-actions'] });
    expect(await eventCount(page)).toBe(2);
  });
});

// [utest->req~slot-plan-cta-context~1]
test.describe('plan slot node context attributes', () => {
  test('Values follow the state', async ({ page }) => {
    await mount(page, { slots: ['plan-cta'] });
    const growth = page.locator(slotNode('growth'));
    await expect(growth).toHaveAttribute('data-plan-name', 'Growth');
    await expect(growth).toHaveAttribute('data-label', 'Start free trial');
    await expect(growth).toHaveAttribute('data-href', 'https://example.com/signup?plan=growth');
    await expect(growth).toHaveAttribute('data-selected', 'false');
    for (const name of ['data-relation', 'data-current', 'data-pending']) {
      await expect(growth).not.toHaveAttribute(name, /.*/);
    }
    await page.locator(radio('enterprise')).check({ force: true });
    await expect(page.locator(slotNode('enterprise'))).toHaveAttribute('data-selected', 'true');
  });
});

// [utest->req~slot-summary-actions-context~1]
test.describe('summary slot node context attributes', () => {
  test('Relation and pending', async ({ page }) => {
    await mount(page, {
      slots: ['summary-actions'],
      currentSelection: { planId: 'starter' },
      pendingActionId: 'start-growth',
    });
    await page.locator(radio('growth')).check({ force: true });
    const node = page.locator(summarySlot);
    await expect(node).toHaveAttribute('data-relation', 'upgrade');
    await expect(node).toHaveAttribute('data-pending', 'true');
  });

  test('Neither', async ({ page }) => {
    await mount(page, { slots: ['summary-actions'] });
    const node = page.locator(summarySlot);
    await expect(node).toHaveCount(1);
    await expect(node).not.toHaveAttribute('data-relation', /.*/);
    await expect(node).not.toHaveAttribute('data-pending', /.*/);
  });
});

// [utest->req~trigger-plan-action~1]
test.describe('trigger a plan action', () => {
  test('Same detail as a click', async ({ page }) => {
    const current = { planId: 'growth' };
    await mount(page, { slots: ['plan-cta'], currentSelection: current });
    await mount(page, { currentSelection: current }, true, 'second');
    const returned = await page.evaluate(() => {
      const store = window as unknown as Store;
      const details: Record<string, unknown[]> = { first: [], second: [] };
      store.__details = details;
      const first = document.querySelector('#extra') as SlotElement;
      const second = document.querySelector('#second') as SlotElement;
      const record = (name: string, cancel: boolean) => (event: Event) => {
        if (cancel) event.preventDefault();
        details[name]?.push(JSON.parse(JSON.stringify((event as CustomEvent).detail)));
      };
      first.addEventListener('pricing-action', record('first', false));
      second.addEventListener('pricing-action', record('second', true));
      return first.triggerPlanAction('enterprise');
    });
    expect(returned).toBe(true);
    await planCta(page, 'enterprise', '#second').click();
    const details = await page.evaluate(() => (window as unknown as Store).__details ?? {});
    expect(details.first).toHaveLength(1);
    expect(details.second).toHaveLength(1);
    expect(details.first).toEqual(details.second);
    expect(details.first?.[0]).toMatchObject({ relation: 'upgrade', source: 'plan' });
  });
});
