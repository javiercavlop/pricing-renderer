import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';

// React render props (add-react-headless, P3-12b). These are the composition scenarios
// that need a browser. The page is examples/vanilla/react-slots.html, which
// mounts PricingRenderer with the Acme pricing and the render props the `mode` query selects; every
// render prop output carries a data-testid.

type Mode = 'all' | 'plan' | 'summary' | 'error' | 'error-yaml' | 'loading' | 'late' | 'hydrate';
type MountMode = Mode | 'current';

type Diagnostic = { code: string };
type ErrorContext = { version: number; diagnostics: Diagnostic[] };

type Store = {
  __mounts?: Record<string, number>;
  __unmounts?: Record<string, number>;
  __triggerResults?: boolean[];
  __ctaCalls?: { planId: string; selected: boolean; slotConnected: boolean }[];
  __diagnosticCodes?: string[];
  __probe?: Record<string, number>;
  __ref?: HTMLElement;
  __errorContexts?: ErrorContext[];
  __actions?: { actionId: string; planId: string }[];
  __recoverable?: string[];
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

async function open(page: Page, mode: MountMode): Promise<void> {
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

const errorContexts = (page: Page): Promise<ErrorContext[]> =>
  page.evaluate(() => (window as unknown as Store).__errorContexts ?? []);

async function lastErrorVersion(page: Page): Promise<number | undefined> {
  return (await errorContexts(page)).at(-1)?.version;
}

const refApplySelection = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const element = (window as unknown as Store).__ref as ResolvedElement;
    const result = element.applySelection({ planId: 'growth' }) as { applied: boolean };
    return result.applied;
  });

// Records the codes of the pricing-diagnostic events of the rendered element from now on.
const recordDiagnostics = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const store = window as unknown as Store;
    const codes: string[] = [];
    store.__diagnosticCodes = codes;
    store.__ref?.addEventListener('pricing-diagnostic', (event) => {
      const { diagnostics } = (event as CustomEvent<{ diagnostics: Diagnostic[] }>).detail;
      for (const entry of diagnostics) codes.push(entry.code);
    });
  });

const notReadyCount = async (page: Page): Promise<number> => {
  const codes = await page.evaluate(() => (window as unknown as Store).__diagnosticCodes ?? []);
  return codes.filter((code) => code === 'PR_SELECTION_NOT_READY').length;
};

// The return value of each ctx.trigger() call of the harness.
const triggerResults = (page: Page): Promise<boolean[]> =>
  page.evaluate(() => (window as unknown as Store).__triggerResults ?? []);

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

// Mounts and effect cleanups of the render prop outputs, by kind; the harness counts them because
// a portal into a detached node cannot be seen by a locator.
type Which = 'mounts' | 'unmounts';
const lifecycle = (page: Page, which: Which): Promise<Record<string, number>> =>
  page.evaluate((key) => {
    const store = window as unknown as Store;
    return { ...(key === 'mounts' ? store.__mounts : store.__unmounts) };
  }, which);

const unmounted = async (page: Page, kind: string): Promise<number> =>
  (await lifecycle(page, 'unmounts'))[kind] ?? 0;

const mounted = async (page: Page, kind: string): Promise<number> =>
  (await lifecycle(page, 'mounts'))[kind] ?? 0;

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
    // The loading node is both disconnected and no longer reported, so this does not tell the two
    // causes apart; the test below pins the unreported case on its own. The portal is unmounted
    // exactly once.
    await expect.poll(() => unmounted(page, 'loading')).toBe(1);
    expect(await mounted(page, 'loading')).toBe(1);
  });

  test('No portal into a connected node the element no longer reports', async ({ page }) => {
    await open(page, 'plan');
    for (const planId of PLAN_IDS) await expect(ctaOf(page, planId)).toBeVisible();
    expect(await unmounted(page, 'plan')).toBe(0);
    // Reports only the growth plan node, from the live DOM; the other nodes stay connected.
    const report = (kept: string[]): Promise<void> =>
      page.evaluate((ids) => {
        const element = document.querySelector('#root pricing-renderer')!;
        const nodes = [...document.querySelectorAll('#root [data-pr-slot]')].filter((node) =>
          ids.includes(node.getAttribute('data-plan-id') ?? ''),
        );
        element.dispatchEvent(new CustomEvent('pricing-slots-change', { detail: { nodes } }));
      }, kept);
    await report(['growth']);
    await expect.poll(() => unmounted(page, 'plan')).toBe(2);
    await expect(page.locator('#root [data-pr-slot="plan-cta"]')).toHaveCount(3);
    await expect(ctaOf(page, 'growth')).toBeVisible();
    await expect(ctaOf(page, 'starter')).toHaveCount(0);
    await expect(ctaOf(page, 'enterprise')).toHaveCount(0);
    // Reports every node again: the outputs come back, so the test ends clean.
    await report(PLAN_IDS);
    for (const planId of PLAN_IDS) await expect(ctaOf(page, planId)).toBeVisible();
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

  test('A removed render prop is unmounted, the plan nodes keep one CTA each', async ({ page }) => {
    await open(page, 'all');
    await expect(page.getByTestId('summary')).toBeVisible();
    for (const planId of PLAN_IDS) await expect(ctaOf(page, planId)).toBeVisible();
    expect(await unmounted(page, 'summary')).toBe(0);
    await page.locator('#toggle-summary').click();
    await expect.poll(() => unmounted(page, 'summary')).toBe(1);
    await expect(page.getByTestId('summary')).toHaveCount(0);
    expect(await unmounted(page, 'plan')).toBe(0);
    await expect(page.locator('#root [data-pr-slot="plan-cta"]')).toHaveCount(3);
    for (const planId of PLAN_IDS) {
      const buttons = slotOf(page, planId).locator('[data-testid^="cta-"]');
      await expect(buttons).toHaveCount(1);
      await expect(buttons).toHaveAttribute('data-plan-id', planId);
    }
    await expect(page.locator('#root [data-testid^="cta-"]')).toHaveCount(3);
  });

  test('Render prop off, plan picked, on again: no stale or detached call', async ({ page }) => {
    await open(page, 'plan');
    for (const planId of PLAN_IDS) await expect(ctaOf(page, planId)).toBeVisible();
    await page.locator('#toggle-plan-cta').click();
    await expect(page.locator('#root [data-pr-slot="plan-cta"]')).toHaveCount(0);
    await expect.poll(() => unmounted(page, 'plan')).toBe(3);
    await page.locator(radio('growth')).check({ force: true });
    await expect.poll(async () => (await elementState(page)).plan).toBe('growth');
    await page.evaluate(() => {
      (window as unknown as Store).__ctaCalls = [];
    });
    await page.locator('#toggle-plan-cta').click();
    for (const planId of PLAN_IDS) {
      const selected = String(planId === 'growth');
      await expect(ctaOf(page, planId)).toHaveAttribute('data-selected', selected);
      await expect(slotOf(page, planId).locator('[data-testid^="cta-"]')).toHaveCount(1);
    }
    const calls = await page.evaluate(() => (window as unknown as Store).__ctaCalls ?? []);
    expect(calls.length).toBeGreaterThanOrEqual(3);
    expect(calls.filter((call) => !call.slotConnected)).toEqual([]);
    expect(calls.filter((call) => call.selected !== (call.planId === 'growth'))).toEqual([]);
  });
});

test.describe('plan CTA render context', () => {
  test('Label, link and state of each plan', async ({ page }) => {
    await open(page, 'plan');
    // The harness renders a button for every plan, not a link; what is asserted is that each plan's
    // own slot holds its own label and href.
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
      await expect(cta).toHaveAttribute('data-current', 'false');
      await expect(cta).toHaveAttribute('data-pending', 'false');
      await expect(cta).toHaveAttribute('data-any-pending', 'false');
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
    await page.locator('#set-current').click();
    await expect(ctaOf(page, 'starter')).toHaveAttribute('data-current', 'true');
    await expect(ctaOf(page, 'starter')).toHaveAttribute('data-relation', 'current');
    await expect(ctaOf(page, 'starter')).toHaveAttribute('data-label', 'Current plan');
    await expect(ctaOf(page, 'growth')).toHaveAttribute('data-relation', 'upgrade');
    await expect(ctaOf(page, 'growth')).toHaveAttribute('data-label', 'Upgrade to Growth');
  });

  test('Current plan set at mount', async ({ page }) => {
    await open(page, 'current');
    await expect(ctaOf(page, 'starter')).toHaveAttribute('data-current', 'true');
    await expect(ctaOf(page, 'starter')).toHaveAttribute('data-relation', 'current');
    await expect(ctaOf(page, 'starter')).toHaveAttribute('data-label', 'Current plan');
    await expect(ctaOf(page, 'growth')).toHaveAttribute('data-relation', 'upgrade');
    await expect(ctaOf(page, 'growth')).toHaveAttribute('data-label', 'Upgrade to Growth');
  });

  test('Pending action: pending, any-pending and a refused trigger', async ({ page }) => {
    await open(page, 'plan');
    await expect(ctaOf(page, 'growth')).toBeVisible();
    await page.locator(radio('enterprise')).check({ force: true });
    await expect(ctaOf(page, 'enterprise')).toHaveAttribute('data-selected', 'true');
    await page.locator('#set-pending').click();
    await expect(ctaOf(page, 'growth')).toHaveAttribute('data-pending', 'true');
    await expect(ctaOf(page, 'growth')).toHaveAttribute('data-label', 'Start free trial');
    await expect(ctaOf(page, 'growth')).toHaveAttribute(
      'data-href',
      'https://example.com/signup?plan=growth',
    );
    await expect(ctaOf(page, 'enterprise')).toHaveAttribute('data-selected', 'true');
    await expect(ctaOf(page, 'enterprise')).toHaveAttribute('data-current', 'false');
    await expect(ctaOf(page, 'enterprise')).toHaveAttribute('data-relation', '');
    await expect(ctaOf(page, 'enterprise')).toHaveAttribute('data-pending', 'false');
    for (const planId of PLAN_IDS) {
      await expect(ctaOf(page, planId)).toHaveAttribute('data-any-pending', 'true');
    }
    await ctaOf(page, 'enterprise').click();
    // trigger() is refused while an action is pending: no pricing-action is dispatched.
    await expect(ctaOf(page, 'enterprise')).toHaveAttribute('data-any-pending', 'true');
    expect(await actions(page)).toEqual([]);
    await expect.poll(() => triggerResults(page)).toEqual([false]);
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
    await expect(summary).toHaveAttribute('data-pending', 'false');
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
    await expect(page.getByTestId('error')).toHaveAttribute('data-codes', /.+/);
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

  test('Refused applySelection in the error state', async ({ page }) => {
    await open(page, 'error-yaml');
    await expect(page.locator('#root [data-pr-slot="error"]')).toHaveCount(1);
    await expect.poll(() => errorContexts(page)).not.toEqual([]);
    const first = (await errorContexts(page))[0]?.diagnostics ?? [];
    expect(first[0]?.code).toBe('PR_YAML_PARSE_ERROR');
    await recordDiagnostics(page);
    expect(await refApplySelection(page)).toBe(false);
    await expect.poll(() => notReadyCount(page)).toBe(1);
    await page.locator('#rerender-error').click();
    await expect.poll(() => lastErrorVersion(page)).toBe(2);
    expect(await notReadyCount(page)).toBe(1);
    const recorded = await errorContexts(page);
    expect(recorded.at(-1)?.diagnostics).toEqual(first);
    const codes = recorded.flatMap((context) => context.diagnostics.map((entry) => entry.code));
    expect(codes).not.toContain('PR_SELECTION_NOT_READY');
  });
});

test.describe('slot nodes and state read on attach', () => {
  test('Render prop given after the first event', async ({ page }) => {
    await open(page, 'late');
    await expect(page.locator('#root .pr-plan-card')).toHaveCount(3);
    const summarySlot = page.locator('#root [data-pr-slot="summary-actions"]');
    await expect(summarySlot.getByTestId('summary')).toBeVisible();
    // No plan slot node is rendered without a plan CTA render prop, and no CTA output exists.
    await expect(page.locator('#root [data-testid^="cta-"]')).toHaveCount(0);
    await page.locator('#add-render-prop').click();
    for (const planId of PLAN_IDS) {
      await expect(ctaOf(page, planId)).toHaveText(/^Pick /);
      await expect(slotOf(page, planId).locator('[data-testid^="cta-"]')).toHaveCount(1);
    }
    await expect(summarySlot.getByTestId('summary')).toBeVisible();
    await expect(page.getByTestId('summary')).toHaveCount(1);
  });

  test('Summary state on attach', async ({ page }) => {
    await open(page, 'late');
    await expect(page.locator('#root .pr-plan-card')).toHaveCount(3);
    const summary = page.getByTestId('summary');
    await expect(summary).toHaveAttribute('data-plan', 'starter');
    const state = await elementState(page);
    await expect(summary).toHaveAttribute('data-subtotal', state.subtotal);
    // The whole context the render prop got equals the state the element reports.
    const reported = await page.evaluate(() => {
      const element = document.querySelector('#root pricing-renderer') as ResolvedElement;
      const { selection, resolved } = element.resolvedState!;
      return JSON.stringify({ selection, resolved });
    });
    const contexts = await page.evaluate(
      () => (window as unknown as { __summaryContexts?: string[] }).__summaryContexts ?? [],
    );
    expect(contexts.at(-1)).toBe(reported);
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

test.describe('render props wait for the client', () => {
  test('No render prop in the first client render, no hydration error', async ({ page }) => {
    await open(page, 'hydrate');
    // The portals fill after hydration.
    for (const planId of PLAN_IDS) {
      await expect(ctaOf(page, planId)).toBeVisible();
    }
    await expect(page.getByTestId('summary')).toBeVisible();
    // The sibling after the wrapper copied the counts in its first layout effect.
    const result = await page.evaluate(() => {
      const store = window as unknown as Store;
      return { probe: store.__probe, recoverable: store.__recoverable };
    });
    expect(result.probe).toEqual({ plan: 0, summary: 0, loading: 0, error: 0, rp: 0 });
    expect(result.recoverable).toEqual([]);
  });

  test('One CTA per plan after hydration', async ({ page }) => {
    await open(page, 'hydrate');
    for (const planId of PLAN_IDS) {
      await expect(slotOf(page, planId).locator('[data-testid^="cta-"]')).toHaveCount(1);
    }
    await expect(page.locator('#root [data-testid^="cta-"]')).toHaveCount(3);
  });
});
