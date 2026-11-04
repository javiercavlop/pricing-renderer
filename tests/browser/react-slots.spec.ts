import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';

// React render props (add-react-headless, P3-12b). The scenarios are those of
// openspec/changes/add-react-headless/specs/composition/spec.md that need a browser (listed in
// tasks.md, "Browser-only requirements"). The page is examples/vanilla/react-slots.html, which
// mounts PricingRenderer with the Acme pricing and the render props the `mode` query selects; every
// render prop output carries a data-testid. This spec has not been run in the authoring
// environment (no browser there).

type Mode = 'all' | 'plan' | 'summary' | 'none' | 'error' | 'loading' | 'late' | 'hydrate';

type Store = {
  __actions?: { actionId: string; planId: string }[];
  __recoverable?: string[];
  __renderCalls?: number;
  __renderHistory?: { value: number; slotNodes: number }[];
  __marks?: HTMLElement[];
};

type ResolvedElement = HTMLElement & {
  resolvedState?: { selection: { planId: string }; resolved: { subtotal: number } };
  applySelection: (selection: unknown) => unknown;
};

const PLAN_IDS = ['starter', 'growth', 'enterprise'];
const ACME = readFileSync(resolve('tests/fixtures/acme-pricing.yml'), 'utf8');

const slotOf = (page: Page, planId: string): Locator =>
  page.locator(`#root [data-pr-slot="plan-cta"][data-plan-id="${planId}"]`);
const ctaOf = (page: Page, planId: string): Locator =>
  slotOf(page, planId).getByTestId(`cta-${planId}`);
const radio = (planId: string): string =>
  `#root input[type="radio"][name$="-plan"][value="${planId}"]`;

async function open(page: Page, mode: Mode): Promise<void> {
  await page.goto(`/react-slots.html?mode=${mode}`);
}

// The source of mode=error answers 404.
const missing = (page: Page): Promise<void> =>
  page.route('**/missing-pricing.yml*', (route) => route.fulfill({ status: 404, body: '' }));

// Holds the request of mode=loading until the returned function is called.
async function gated(page: Page): Promise<() => void> {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((done) => {
    release = done;
  });
  await page.route('**/slow-pricing.yml*', async (route) => {
    await gate;
    await route.fulfill({ status: 200, contentType: 'text/yaml', body: ACME });
  });
  return release;
}

// Sets properties on the element after ready, as a host would; the wrapper does not render again.
const setOnElement = (page: Page, props: Record<string, unknown>): Promise<void> =>
  page.evaluate(async (props) => {
    const element = document.querySelector('#root pricing-renderer') as HTMLElement & {
      updateComplete: Promise<unknown>;
    };
    Object.assign(element, props);
    await element.updateComplete;
  }, props);

const actions = (page: Page): Promise<{ actionId: string; planId: string }[]> =>
  page.evaluate(() => (window as unknown as Store).__actions ?? []);

// The selection and resolved prices the element itself reports.
const elementState = (page: Page): Promise<{ plan: string; subtotal: string }> =>
  page.evaluate(() => {
    const element = document.querySelector('#root pricing-renderer') as ResolvedElement;
    const state = element.resolvedState;
    return {
      plan: state?.selection.planId ?? '',
      subtotal: String(state?.resolved.subtotal),
    };
  });

// Marks the slot nodes and what they hold, to prove later that nothing was remounted.
async function markNodes(page: Page): Promise<number> {
  return page.evaluate(() => {
    const store = window as unknown as Store;
    const nodes = [...document.querySelectorAll<HTMLElement>('#root [data-pr-slot]')];
    store.__marks = nodes.flatMap((node) => [node, ...(node.children as unknown as HTMLElement[])]);
    return store.__marks.length;
  });
}

// Whether every marked element is still connected and the slot nodes are still where they were.
const marksIntact = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const marks = (window as unknown as Store).__marks ?? [];
    return marks.length > 0 && marks.every((node) => node.isConnected);
  });

// [utest->req~react-slot-portals~1]
test.describe('React portals fill the slot nodes', () => {
  test('One plan CTA per plan slot node', async ({ page }) => {
    await open(page, 'all');
    for (const planId of PLAN_IDS) {
      await expect(slotOf(page, planId)).toHaveCount(1);
      await expect(slotOf(page, planId).locator('[data-testid^="cta-"]')).toHaveCount(1);
      await expect(ctaOf(page, planId)).toBeVisible();
    }
    await expect(ctaOf(page, 'growth')).toHaveText('Pick Growth');
    await expect(page.locator('#root [data-testid^="cta-"]')).toHaveCount(3);
  });

  test('Summary content is inside the summary slot node', async ({ page }) => {
    await open(page, 'all');
    const summary = page.locator('#root [data-pr-slot="summary-actions"]');
    await expect(summary).toHaveCount(1);
    await expect(summary.getByTestId('summary')).toHaveText('summary');
    await expect(page.getByTestId('summary')).toHaveCount(1);
  });

  test('Loading content is inside the loading slot node, then it goes away', async ({ page }) => {
    const release = await gated(page);
    await open(page, 'loading');
    try {
      const loading = page.locator('#root [data-pr-slot="loading"]');
      await expect(loading.getByTestId('loading')).toHaveText('Loading prices');
    } finally {
      release();
    }
    await expect(ctaOf(page, 'growth')).toBeVisible();
    await expect(page.getByTestId('loading')).toHaveCount(0);
    await expect(page.locator('#root [data-pr-slot="loading"]')).toHaveCount(0);
  });

  test('Error content is inside the error slot node', async ({ page }) => {
    await missing(page);
    await open(page, 'error');
    const error = page.locator('#root [data-pr-slot="error"]');
    await expect(error.getByTestId('error')).toBeVisible();
    await expect(error.getByTestId('error-reload')).toHaveText('Retry');
    await expect(page.getByTestId('error')).toHaveCount(1);
  });

  test('A selection change remounts nothing', async ({ page }) => {
    await open(page, 'all');
    await expect(ctaOf(page, 'enterprise')).toBeVisible();
    await expect(page.getByTestId('summary')).toBeVisible();
    expect(await markNodes(page)).toBeGreaterThanOrEqual(8);
    await page.locator(radio('enterprise')).check({ force: true });
    await expect(ctaOf(page, 'enterprise')).toHaveAttribute('data-selected', 'true');
    expect(await marksIntact(page)).toBe(true);
    for (const planId of PLAN_IDS) {
      await expect(slotOf(page, planId).locator('[data-testid^="cta-"]')).toHaveCount(1);
    }
  });
});

// [utest->req~react-plan-cta-context~2]
test.describe('plan CTA render context', () => {
  test('Label, link and state of each plan', async ({ page }) => {
    await open(page, 'plan');
    await expect(ctaOf(page, 'growth')).toHaveAttribute('data-label', 'Start free trial');
    await expect(ctaOf(page, 'growth')).toHaveAttribute(
      'data-href',
      'https://example.com/signup?plan=growth',
    );
    await expect(ctaOf(page, 'enterprise')).toHaveAttribute(
      'data-href',
      'https://example.com/contact',
    );
    await expect(ctaOf(page, 'starter')).toHaveAttribute('data-href', '');
    await expect(ctaOf(page, 'starter')).toHaveAttribute('data-selected', 'true');
    await expect(ctaOf(page, 'growth')).toHaveAttribute('data-selected', 'false');
    for (const planId of PLAN_IDS) {
      const cta = ctaOf(page, planId);
      await expect(cta).toHaveAttribute('data-current', '');
      await expect(cta).toHaveAttribute('data-pending', '');
      await expect(cta).toHaveAttribute('data-any-pending', '');
      await expect(cta).toHaveAttribute('data-relation', '');
    }
  });

  test('Selected follows the user choice', async ({ page }) => {
    await open(page, 'plan');
    await expect(ctaOf(page, 'starter')).toHaveAttribute('data-selected', 'true');
    await page.locator(radio('enterprise')).check({ force: true });
    await expect(ctaOf(page, 'enterprise')).toHaveAttribute('data-selected', 'true');
    await expect(ctaOf(page, 'starter')).toHaveAttribute('data-selected', 'false');
  });

  test('trigger() dispatches the plan action of that plan', async ({ page }) => {
    await open(page, 'plan');
    await ctaOf(page, 'growth').click();
    await expect
      .poll(() => actions(page))
      .toEqual([{ actionId: 'start-growth', planId: 'growth' }]);
    await ctaOf(page, 'enterprise').click();
    await expect
      .poll(() => actions(page))
      .toEqual([
        { actionId: 'start-growth', planId: 'growth' },
        { actionId: 'contact-enterprise', planId: 'enterprise' },
      ]);
  });

  test('Current plan set after ready', async ({ page }) => {
    await open(page, 'plan');
    await expect(ctaOf(page, 'growth')).toBeVisible();
    await setOnElement(page, { currentSelection: { planId: 'starter' } });
    await expect(ctaOf(page, 'starter')).toHaveAttribute('data-current', 'true');
    await expect(ctaOf(page, 'starter')).toHaveAttribute('data-relation', 'current');
    await expect(ctaOf(page, 'starter')).toHaveAttribute('data-label', 'Current plan');
    await expect(ctaOf(page, 'growth')).toHaveAttribute('data-relation', 'upgrade');
    await expect(ctaOf(page, 'growth')).toHaveAttribute('data-label', 'Upgrade to Growth');
  });

  test('Pending action: pending, any-pending and a refused trigger', async ({ page }) => {
    await open(page, 'plan');
    await expect(ctaOf(page, 'growth')).toBeVisible();
    await setOnElement(page, { pendingActionId: 'start-growth' });
    await expect(ctaOf(page, 'growth')).toHaveAttribute('data-pending', 'true');
    await expect(ctaOf(page, 'enterprise')).toHaveAttribute('data-pending', '');
    for (const planId of PLAN_IDS) {
      await expect(ctaOf(page, planId)).toHaveAttribute('data-any-pending', 'true');
    }
    await ctaOf(page, 'enterprise').click();
    // trigger() is refused while an action is pending: no pricing-action is dispatched.
    await setOnElement(page, { pendingActionId: undefined });
    await expect(ctaOf(page, 'enterprise')).toHaveAttribute('data-any-pending', '');
    expect(await actions(page)).toEqual([]);
  });

  test('After a selection change each portal stays on its plan', async ({ page }) => {
    await open(page, 'plan');
    await expect(ctaOf(page, 'starter')).toBeVisible();
    await page.locator(radio('growth')).check({ force: true });
    await expect(ctaOf(page, 'growth')).toHaveAttribute('data-selected', 'true');
    for (const planId of PLAN_IDS) {
      await expect(slotOf(page, planId).locator('[data-testid^="cta-"]')).toHaveCount(1);
    }
    await ctaOf(page, 'starter').click();
    await expect
      .poll(() => actions(page))
      .toEqual([{ actionId: 'start-starter', planId: 'starter' }]);
    await ctaOf(page, 'enterprise').click();
    await expect
      .poll(async () => (await actions(page)).map((action) => action.planId))
      .toEqual(['starter', 'enterprise']);
  });
});

// [utest->req~react-other-slot-contexts~1]
test.describe('summary, loading and error render contexts', () => {
  test('Summary follows the selection', async ({ page }) => {
    await open(page, 'summary');
    const summary = page.getByTestId('summary');
    await expect(summary).toHaveAttribute('data-plan', 'starter');
    const first = await elementState(page);
    await expect(summary).toHaveAttribute('data-subtotal', first.subtotal);
    await page.locator(radio('enterprise')).check({ force: true });
    await expect(summary).toHaveAttribute('data-plan', 'enterprise');
    const next = await elementState(page);
    expect(next.plan).toBe('enterprise');
    await expect(summary).toHaveAttribute('data-subtotal', next.subtotal);
    await expect(summary).toHaveAttribute('data-pending', '');
    await expect(summary).toHaveAttribute('data-relation', '');
  });

  test('reload() loads the source again', async ({ page }) => {
    let requests = 0;
    await page.route('**/missing-pricing.yml*', (route) => {
      requests += 1;
      return route.fulfill({ status: 404, body: '' });
    });
    await open(page, 'error');
    await expect(page.getByTestId('error')).toBeVisible();
    await expect.poll(() => requests).toBe(1);
    await page.getByTestId('error-reload').click();
    await expect.poll(() => requests).toBe(2);
    await expect(page.getByTestId('error')).toBeVisible();
  });

  test('Loading shows while the source is pending', async ({ page }) => {
    const release = await gated(page);
    await open(page, 'loading');
    try {
      await expect(page.getByTestId('loading')).toBeVisible();
      await expect(page.getByTestId('summary')).toHaveCount(0);
    } finally {
      release();
    }
    await expect(page.getByTestId('summary')).toBeVisible();
    await expect(page.getByTestId('loading')).toHaveCount(0);
  });
});

// [utest->req~react-error-diagnostics-source~1]
test.describe('error diagnostics come from the slot node', () => {
  const codesOfNode = (page: Page): Promise<string> =>
    page.evaluate(() => {
      const node = document.querySelector('#root [data-pr-slot="error"]');
      const parsed: unknown = JSON.parse(node?.getAttribute('data-diagnostics') ?? '[]');
      const list = Array.isArray(parsed) ? (parsed as { code: string }[]) : [];
      return list.map((entry) => entry.code).join(',');
    });

  test('data-codes equals the codes of the slot node', async ({ page }) => {
    await missing(page);
    await open(page, 'error');
    const error = page.getByTestId('error');
    await expect(error).toBeVisible();
    const codes = await codesOfNode(page);
    expect(codes).toContain('PR_SOURCE_HTTP_ERROR');
    await expect(error).toHaveAttribute('data-codes', codes);
  });

  // The harness has no control to render the wrapper again, so this checks the slot-node source
  // through the element's own update only.
  test('A refused applySelection adds no code', async ({ page }) => {
    await missing(page);
    await open(page, 'error');
    const error = page.getByTestId('error');
    await expect(error).toBeVisible();
    const before = await codesOfNode(page);
    const applied = await page.evaluate(async () => {
      const element = document.querySelector('#root pricing-renderer') as ResolvedElement;
      const result = element.applySelection({ planId: 'growth' }) as { applied: boolean };
      await (element as unknown as { updateComplete: Promise<unknown> }).updateComplete;
      return result.applied;
    });
    expect(applied).toBe(false);
    await expect(error).toHaveAttribute('data-codes', before);
    expect(await error.getAttribute('data-codes')).not.toContain('PR_SELECTION_NOT_READY');
  });
});

// [utest->req~react-slots-attach-read~1]
test.describe('slot nodes and state read on attach', () => {
  test('Render prop given after the first event', async ({ page }) => {
    await open(page, 'late');
    await expect(page.locator('#root .pr-plan-card')).toHaveCount(3);
    await expect(page.locator('#root [data-testid]')).toHaveCount(0);
    await page.locator('#add-render-prop').click();
    for (const planId of PLAN_IDS) {
      await expect(ctaOf(page, planId)).toHaveText(/^Pick /);
      await expect(slotOf(page, planId).locator('[data-testid^="cta-"]')).toHaveCount(1);
    }
    await expect(
      page.locator('#root [data-pr-slot="summary-actions"]').getByTestId('summary'),
    ).toBeVisible();
  });

  test('Summary state on attach', async ({ page }) => {
    await open(page, 'late');
    await expect(page.locator('#root .pr-plan-card')).toHaveCount(3);
    await page.locator('#add-render-prop').click();
    const summary = page.getByTestId('summary');
    await expect(summary).toHaveAttribute('data-plan', 'starter');
    const state = await elementState(page);
    await expect(summary).toHaveAttribute('data-subtotal', state.subtotal);
  });

  test('Summary context after a pick when given after ready', async ({ page }) => {
    await open(page, 'late');
    await expect(page.locator('#root .pr-plan-card')).toHaveCount(3);
    await page.locator('#add-render-prop').click();
    await page.locator(radio('growth')).check({ force: true });
    await expect(page.getByTestId('summary')).toHaveAttribute('data-plan', 'growth');
    const state = await elementState(page);
    await expect(page.getByTestId('summary')).toHaveAttribute('data-subtotal', state.subtotal);
  });
});

// [utest->req~react-slots-client-only~1]
test.describe('render props wait for the client', () => {
  test('No render prop in the first client render, no hydration error', async ({ page }) => {
    // Records every value the page assigns to __renderCalls and how many slot nodes existed then.
    await page.addInitScript(() => {
      const store = window as unknown as Store;
      const history: { value: number; slotNodes: number }[] = [];
      let current = 0;
      store.__renderHistory = history;
      Object.defineProperty(window, '__renderCalls', {
        configurable: true,
        get: () => current,
        set: (value: number) => {
          current = value;
          history.push({
            value,
            slotNodes: document.querySelectorAll('#root [data-pr-slot]').length,
          });
        },
      });
    });
    await open(page, 'hydrate');
    // The portals fill after hydration.
    for (const planId of PLAN_IDS) {
      await expect(ctaOf(page, planId)).toBeVisible();
    }
    await expect(page.getByTestId('summary')).toBeVisible();
    const result = await page.evaluate(() => {
      const store = window as unknown as Store;
      return {
        recoverable: store.__recoverable ?? [],
        calls: store.__renderCalls ?? -1,
        history: store.__renderHistory ?? [],
      };
    });
    expect(result.recoverable).toEqual([]);
    expect(result.calls).toBeGreaterThan(0);
    // Every render prop call happened with the slot nodes already in the document, none during the
    // server render or before the element rendered them.
    for (const entry of result.history) {
      if (entry.value > 0) expect(entry.slotNodes).toBeGreaterThan(0);
    }
    if (result.history.length > 0) expect(result.history[0]?.value).toBe(0);
  });

  test('One CTA per plan after hydration', async ({ page }) => {
    await open(page, 'hydrate');
    for (const planId of PLAN_IDS) {
      await expect(slotOf(page, planId).locator('[data-testid^="cta-"]')).toHaveCount(1);
    }
    await expect(page.locator('#root [data-testid^="cta-"]')).toHaveCount(3);
  });
});
