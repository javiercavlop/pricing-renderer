import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('pricing-renderer .pr-plan-card')).toHaveCount(3);
});

test('renders the professional commercial layout and emits complete CTA actions', async ({
  page,
}) => {
  await expect(
    page.getByRole('heading', { name: 'Simple pricing that scales with you' }),
  ).toBeVisible();
  const featuredPlan = page.locator('.pr-plan-card.is-featured');
  await expect(featuredPlan).toContainText('Growth');
  await expect(featuredPlan.locator('[data-pr-part="plan-badge"]')).toHaveText('Most popular');
  await expect(featuredPlan.locator('[data-pr-part="plan-inheritance"]')).toHaveText(
    'Everything in Starter, plus:',
  );
  await expect(featuredPlan.locator('[data-highlight-kind="feature"]')).toContainText('Audit Log');
  await expect(featuredPlan.locator('[data-highlight-kind="usage-limit"]')).toContainText(
    'Storage',
  );
  await expect(page.locator('.pr-summary')).toContainText('€20');

  await page.getByRole('link', { name: 'Start free trial' }).click();
  await expect(page.locator('#action-output')).toContainText('start-growth');
});

test('selects plans and add-ons from the full card with a clear visual state', async ({ page }) => {
  const renderer = page.locator('pricing-renderer');
  await expect(renderer).toHaveAttribute('pricing-path', '/pricing');

  const growth = page.locator('.pr-plan-card[data-plan-id="growth"]');
  await growth.getByRole('heading', { name: 'Growth' }).click();
  await expect(growth.getByRole('radio', { name: 'Choose Growth' })).toBeChecked();
  await expect(growth.locator('.pr-selection-control__label')).toHaveText('Selected');
  await expect(growth).toHaveAttribute('data-selected', 'true');

  const extraStorage = page.locator('.pr-addon-card').filter({ hasText: 'Extra Storage' });
  await extraStorage.getByRole('heading', { name: 'Extra Storage' }).click();
  await expect(extraStorage.getByRole('checkbox', { name: 'Remove Extra Storage' })).toBeChecked();
  await expect(extraStorage.locator('.pr-selection-control__label')).toHaveText('Added');
  await expect(extraStorage).toHaveAttribute('data-selected', 'true');

  const selectionTarget = await extraStorage.locator('.pr-selection-control').boundingBox();
  expect(selectionTarget?.height).toBeGreaterThanOrEqual(44);

  await extraStorage.locator('.pr-price').click();
  await expect(extraStorage.getByRole('checkbox', { name: 'Add Extra Storage' })).not.toBeChecked();
  await expect(extraStorage.locator('.pr-selection-control__label')).toHaveText('Add');
});

test('can disable selection, CTAs and variable editing through instance configuration', async ({
  page,
}) => {
  await page.evaluate(() => {
    const renderer = document.querySelector('pricing-renderer') as
      | (HTMLElement & {
          selection?: Record<string, unknown>;
          selectionEnabled: boolean;
          ctaEnabled: boolean;
          variablesEnabled: boolean;
        })
      | null;
    if (!renderer) throw new Error('Pricing renderer was not found.');
    renderer.selection = {
      planId: 'starter',
      billingPeriod: 'monthly',
      variables: { seats: 10, prioritySupport: false, region: 'eu' },
      addOns: {},
    };
    renderer.selectionEnabled = false;
    renderer.ctaEnabled = false;
    renderer.variablesEnabled = false;
  });

  const renderer = page.locator('pricing-renderer');
  await expect(renderer.locator('[data-pr-part="selection-control"]')).toHaveCount(0);
  await expect(renderer.locator('[data-pr-part="cta"]')).toHaveCount(0);
  await expect(renderer.locator('[data-pr-part="variables"]')).toHaveCount(0);
  await expect(renderer.locator('.pr-plan-card').first().locator('.pr-price')).toContainText('€20');

  await page.evaluate(() => {
    const renderer = document.querySelector('pricing-renderer') as
      | (HTMLElement & {
          selectionEnabled: boolean;
          ctaEnabled: boolean;
          variablesEnabled: boolean;
        })
      | null;
    if (!renderer) throw new Error('Pricing renderer was not found.');
    renderer.selectionEnabled = true;
    renderer.ctaEnabled = true;
    renderer.variablesEnabled = true;
  });

  await expect(renderer.locator('[data-pr-part="selection-control"]').first()).toBeVisible();
  await expect(renderer.locator('[data-pr-part="cta"]').first()).toBeVisible();
  await expect(renderer.locator('[data-pr-part="variables"]')).toBeVisible();
  await expect(renderer.locator('.pr-plan-card').first().locator('.pr-price')).toContainText('€40');
});

test('recalculates formulas, billing and multi-contract add-ons', async ({ page }) => {
  const seats = page.getByRole('slider', { name: 'Team seats' });
  await seats.fill('10');
  await expect(page.locator('.pr-plan-card').first().locator('.pr-price')).toContainText('€40');

  await page.getByRole('radio', { name: 'Choose Growth' }).check();
  await page.getByRole('radio', { name: /Yearly/ }).check();
  await expect(page.locator('.pr-plan-card').nth(1).locator('.pr-price')).toContainText('€72');

  const extraStorage = page.locator('.pr-addon-card').filter({ hasText: 'Extra Storage' });
  await extraStorage.getByRole('checkbox').check();
  await extraStorage.getByRole('button', { name: /Increase Extra Storage/ }).click();
  await expect(extraStorage.getByRole('spinbutton')).toHaveValue('2');
  await expect(page.locator('.pr-summary')).toContainText('€80');
});

test('keeps the last valid price when a variable makes an expression fail', async ({ page }) => {
  const starterPrice = page.locator('.pr-plan-card').first().locator('.pr-price');
  await expect(starterPrice).toContainText('€20');

  await page.evaluate(() => {
    const renderer = document.querySelector('pricing-renderer');
    renderer?.addEventListener('pricing-selection-change', (event) => {
      (window as typeof window & { latestSelection?: unknown }).latestSelection = (
        event as CustomEvent
      ).detail.selection;
    });
  });
  const seatsInput = page.getByRole('spinbutton', { name: 'Team seats' });
  await seatsInput.fill('6');
  await seatsInput.press('Tab');
  await expect(starterPrice).toContainText('€24');
  await page.evaluate(() => {
    const renderer = document.querySelector('pricing-renderer') as
      (HTMLElement & { selection?: Record<string, unknown> }) | null;
    const selection = (window as typeof window & { latestSelection?: Record<string, unknown> })
      .latestSelection;
    if (!renderer || !selection) throw new Error('Pricing selection was not captured.');
    renderer.selection = {
      ...selection,
      variables: {
        ...(selection.variables as Record<string, unknown>),
        seats: 'not-a-number',
      },
    };
  });

  await expect(page.locator('.pr-field.is-invalid')).not.toHaveCount(0);
  await expect(page.getByText('This value cannot produce a valid price.').first()).toBeVisible();
  await expect(starterPrice).toContainText('€24');
  await expect(page.getByRole('radio', { name: 'Choose Growth' })).toBeEnabled();
});

test('confirms guided add-on dependencies instead of mutating silently', async ({ page }) => {
  await page.getByRole('radio', { name: 'Choose Growth' }).check();
  const priority = page.locator('.pr-addon-card').filter({ hasText: 'Priority Success' });
  await priority.getByRole('checkbox').check();

  const dialog = page.getByRole('dialog', { name: 'Review configuration changes' });
  await expect(dialog).toContainText('extraStorage');
  await dialog.getByRole('button', { name: 'Apply changes' }).click();
  await expect(
    page.locator('.pr-addon-card').filter({ hasText: 'Extra Storage' }).getByRole('checkbox'),
  ).toBeChecked();
});

type CapturedDetail = {
  selection: {
    planId?: string;
    billingPeriod?: string;
    addOns: Record<string, { selected: boolean; quantity: number }>;
  };
  resolved: {
    subtotal: number;
    selection: { addOns: Record<string, { selected: boolean; quantity: number }> };
  };
};
type PlanChangeWindow = typeof window & {
  selectionEvents?: CapturedDetail[];
  actionEvents?: CapturedDetail[];
};
type PlanChangeElement = HTMLElement & {
  selection?: unknown;
  defaultSelection?: unknown;
  reload(): Promise<void>;
  _pendingAddOnChange?: unknown;
  _internalSelection?: { addOns: Record<string, { selected: boolean; quantity: number }> };
};

async function collectEvents(page: Page): Promise<void> {
  await page.evaluate(() => {
    const target = window as PlanChangeWindow;
    target.selectionEvents = [];
    target.actionEvents = [];
    const renderer = document.querySelector('pricing-renderer')!;
    renderer.addEventListener('pricing-selection-change', (event) => {
      target.selectionEvents!.push((event as CustomEvent<CapturedDetail>).detail);
    });
    renderer.addEventListener('pricing-action', (event) => {
      target.actionEvents!.push((event as CustomEvent<CapturedDetail>).detail);
    });
  });
}

const selectionEvents = (page: Page) =>
  page.evaluate(() => (window as PlanChangeWindow).selectionEvents ?? []);
const actionEvents = (page: Page) =>
  page.evaluate(() => (window as PlanChangeWindow).actionEvents ?? []);
const pendingChange = (page: Page) =>
  page.evaluate(
    () => (document.querySelector('pricing-renderer') as PlanChangeElement)._pendingAddOnChange,
  );

function planDialog(page: Page) {
  return page.getByRole('dialog', { name: 'Review configuration changes' });
}

async function selectGrowthWithExtraStorage(page: Page): Promise<void> {
  await page.getByRole('radio', { name: 'Choose Growth' }).check();
  await page
    .locator('.pr-addon-card')
    .filter({ hasText: 'Extra Storage' })
    .getByRole('checkbox')
    .check();
  await expect(page.locator('.pr-summary')).toContainText('€50');
}

async function setControlledSelection(page: Page, planId: string): Promise<void> {
  await page.evaluate((plan) => {
    const renderer = document.querySelector('pricing-renderer') as PlanChangeElement;
    renderer.selection = {
      planId: plan,
      billingPeriod: 'monthly',
      variables: { seats: 5, prioritySupport: false, region: 'eu' },
      addOns: { extraStorage: { selected: true, quantity: 1 } },
    };
  }, planId);
}

test('[utest->req~plan-change-immediate~1] applies a plan change without removals at once', async ({
  page,
}) => {
  await collectEvents(page);
  await page.getByRole('radio', { name: 'Choose Growth' }).check();
  await expect(page.getByRole('radio', { name: 'Choose Growth' })).toBeChecked();
  await page.evaluate(
    () =>
      (document.querySelector('pricing-renderer') as { updateComplete: Promise<unknown> })
        .updateComplete,
  );
  await expect(page.locator('.pr-dialog')).toHaveCount(0);
  const events = await selectionEvents(page);
  expect(events).toHaveLength(1);
  expect(events[0]?.selection.planId).toBe('growth');
});

test('[utest->req~plan-change-confirmation~1] asks before removing add-ons on a plan change', async ({
  page,
}) => {
  await page.getByRole('radio', { name: 'Choose Growth' }).check();
  const priority = page
    .locator('.pr-addon-card')
    .filter({ hasText: 'Priority Success' })
    .getByRole('checkbox');
  await priority.check();
  await planDialog(page).getByRole('button', { name: 'Apply changes' }).click();
  await expect(priority).toBeChecked();
  await collectEvents(page);

  await page.getByRole('radio', { name: 'Choose Starter' }).click();
  const dialog = planDialog(page);
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Will remove: extraStorage, prioritySuccess');
  expect(await selectionEvents(page)).toHaveLength(0);
});

test('[utest->req~pending-plan-change-shape~1] holds a plan-change PendingAddOnChange', async ({
  page,
}) => {
  await selectGrowthWithExtraStorage(page);
  await page.getByRole('radio', { name: 'Choose Starter' }).click();
  await expect(planDialog(page)).toBeVisible();
  expect(await pendingChange(page)).toEqual({
    addOnId: '',
    select: false,
    addIds: [],
    removeIds: ['extraStorage'],
    planId: 'starter',
  });
});

test('[utest->req~plan-change-apply~1] commits the plan and the removals in one event', async ({
  page,
}) => {
  await selectGrowthWithExtraStorage(page);
  await collectEvents(page);
  await page.getByRole('radio', { name: 'Choose Starter' }).click();
  await planDialog(page).getByRole('button', { name: 'Apply changes' }).click();
  await expect(planDialog(page)).toHaveCount(0);
  await expect(page.getByRole('radio', { name: 'Choose Starter' })).toBeChecked();
  await expect(page.locator('.pr-summary')).toContainText('€20');
  const events = await selectionEvents(page);
  expect(events).toHaveLength(1);
  expect(events[0]?.selection.planId).toBe('starter');
  expect(events[0]?.selection.addOns.extraStorage?.selected).toBe(false);
  expect(events[0]?.resolved.subtotal).toBe(20);
});

test('[utest->req~plan-change-cancel~1] keeps the previous plan on Cancel', async ({ page }) => {
  await selectGrowthWithExtraStorage(page);
  await collectEvents(page);
  const starter = page.getByRole('radio', { name: 'Choose Starter' });
  await starter.focus();
  await starter.click();
  await expect(planDialog(page)).toBeVisible();
  await planDialog(page).getByRole('button', { name: 'Cancel' }).click();
  await expect(planDialog(page)).toHaveCount(0);
  await expect(page.getByRole('radio', { name: 'Choose Growth' })).toBeChecked();
  await expect(starter).not.toBeChecked();
  await expect(
    page.locator('.pr-addon-card').filter({ hasText: 'Extra Storage' }).getByRole('checkbox'),
  ).toBeChecked();
  expect(await selectionEvents(page)).toHaveLength(0);
  await expect(starter).toBeFocused();
});

test('[utest->req~plan-change-cancel~1] keeps the previous plan on Escape', async ({ page }) => {
  await selectGrowthWithExtraStorage(page);
  await collectEvents(page);
  const starter = page.getByRole('radio', { name: 'Choose Starter' });
  await starter.focus();
  await starter.click();
  await expect(planDialog(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(planDialog(page)).toHaveCount(0);
  await expect(starter).toBeFocused();
  await expect(page.getByRole('radio', { name: 'Choose Growth' })).toBeChecked();
  await expect(page.getByRole('radio', { name: 'Choose Starter' })).not.toBeChecked();
  expect(await selectionEvents(page)).toHaveLength(0);
});

test('[utest->req~events-reconciled-selection~1] emits only reconciled selections from an invalid controlled selection', async ({
  page,
}) => {
  await setControlledSelection(page, 'starter');
  await collectEvents(page);
  await page.getByRole('radio', { name: /Yearly/ }).click();
  await page
    .locator('.pr-plan-card[data-plan-id="starter"]')
    .locator('[data-pr-part="cta"]')
    .click();
  const changes = await selectionEvents(page);
  const actions = await actionEvents(page);
  expect(changes).toHaveLength(1);
  expect(actions).toHaveLength(1);
  expect(changes[0]?.selection.addOns.extraStorage?.selected).toBe(false);
  expect(actions[0]?.selection.addOns.extraStorage?.selected).toBe(false);
  expect(actions[0]?.resolved.selection.addOns.extraStorage?.selected).toBe(false);
  expect(changes[0]?.selection.billingPeriod).toBe('yearly');
  const summary = await page.locator('.pr-summary').innerText();
  expect(summary).toContain(`€${actions[0]?.resolved.subtotal}`);
  expect(actions[0]?.resolved.selection).toEqual(actions[0]?.selection);
});

test('[utest->req~events-reconciled-selection~1] emits a reconciled action when selection is disabled', async ({
  page,
}) => {
  await setControlledSelection(page, 'starter');
  await page.evaluate(() => {
    const renderer = document.querySelector('pricing-renderer') as HTMLElement & {
      selectionEnabled: boolean;
    };
    renderer.selectionEnabled = false;
  });
  await expect(page.locator('pricing-renderer [data-pr-part="selection-control"]')).toHaveCount(0);
  await collectEvents(page);
  await page
    .locator('.pr-plan-card[data-plan-id="starter"]')
    .locator('[data-pr-part="cta"]')
    .click();
  const actions = await actionEvents(page);
  expect(actions).toHaveLength(1);
  expect(actions[0]?.selection.addOns.extraStorage?.selected).toBe(false);
  expect(actions[0]?.resolved.selection).toEqual(actions[0]?.selection);
  expect(actions[0]?.resolved.subtotal).toBe(20);
  await expect(page.locator('.pr-summary')).toContainText('€20');
});

test('[utest->req~plan-change-cancel~1] drops a pending plan change on reload', async ({
  page,
}) => {
  await selectGrowthWithExtraStorage(page);
  await page.getByRole('radio', { name: 'Choose Starter' }).click();
  await expect(planDialog(page)).toBeVisible();
  await page.evaluate(() =>
    (document.querySelector('pricing-renderer') as PlanChangeElement).reload(),
  );
  await expect(page.locator('.pr-dialog')).toHaveCount(0);
  expect(await pendingChange(page)).toBeUndefined();
  await expect(page.getByRole('radio', { name: 'Choose Starter' })).toBeChecked();
});

test('[utest->req~element-subtotal-excludes-removed~1] renders the Starter price for an invalid controlled selection', async ({
  page,
}) => {
  await setControlledSelection(page, 'starter');
  const summary = page.locator('.pr-summary');
  await expect(summary).toContainText('€20');
  await expect(summary).not.toContainText('€25');
});

test('[utest->req~default-selection-reconciled~1] reconciles defaultSelection silently on load', async ({
  page,
}) => {
  await collectEvents(page);
  await page.evaluate(async () => {
    const renderer = document.querySelector('pricing-renderer') as PlanChangeElement;
    renderer.defaultSelection = {
      planId: 'starter',
      addOns: { extraStorage: { selected: true, quantity: 2 } },
    };
    await renderer.reload();
  });
  await expect(page.locator('pricing-renderer .pr-plan-card')).toHaveCount(3);
  await expect(page.locator('.pr-dialog')).toHaveCount(0);
  expect(await selectionEvents(page)).toHaveLength(0);
  const internal = await page.evaluate(
    () =>
      (document.querySelector('pricing-renderer') as PlanChangeElement)._internalSelection?.addOns
        .extraStorage,
  );
  expect(internal).toEqual({ selected: false, quantity: 2 });
});

test('[utest->req~controlled-selection-untouched~1] never rewrites a controlled selection', async ({
  page,
}) => {
  await setControlledSelection(page, 'growth');
  await page.evaluate(() => {
    const renderer = document.querySelector('pricing-renderer') as PlanChangeElement;
    const target = window as typeof window & { hostSelection?: unknown; hostJson?: string };
    target.hostSelection = renderer.selection;
    target.hostJson = JSON.stringify(renderer.selection);
  });
  await collectEvents(page);
  await page.getByRole('radio', { name: 'Choose Starter' }).click();
  await planDialog(page).getByRole('button', { name: 'Apply changes' }).click();
  await expect(planDialog(page)).toHaveCount(0);
  const untouched = await page.evaluate(() => {
    const renderer = document.querySelector('pricing-renderer') as PlanChangeElement;
    const target = window as typeof window & { hostSelection?: unknown; hostJson?: string };
    return (
      renderer.selection === target.hostSelection &&
      JSON.stringify(renderer.selection) === target.hostJson
    );
  });
  expect(untouched).toBe(true);
  const events = await selectionEvents(page);
  expect(events).toHaveLength(1);
  expect(events[0]?.selection.planId).toBe('starter');
  expect(events[0]?.selection.addOns.extraStorage?.selected).toBe(false);
});

type LoadDiagnostic = {
  code: string;
  severity: string;
  path?: string;
  details?: Record<string, unknown>;
};
type LoadDetail = {
  selection: {
    planId?: string;
    billingPeriod?: string;
    variables: Record<string, unknown>;
    addOns: Record<string, { selected: boolean; quantity: number }>;
  };
  resolved: { subtotal: number };
};
type LoadApiResult = Partial<LoadDetail> & {
  applied: boolean;
  removedAddOnIds: string[];
  diagnostics: LoadDiagnostic[];
};
type LoadApiElement = HTMLElement & {
  yaml?: string;
  src?: string;
  pricing?: unknown;
  loadPricing?: unknown;
  selection?: unknown;
  defaultSelection?: unknown;
  variablesEnabled: boolean;
  updateComplete: Promise<unknown>;
  reload(): Promise<void>;
  applySelection(input: unknown): LoadApiResult;
  readonly resolvedState?: LoadDetail;
};
type LoadApiWindow = typeof window & {
  pendingLoads?: Record<string, (() => void)[]>;
  recorded?: Record<string, unknown[]>;
  hostValue?: unknown;
  listenerResult?: LoadApiResult;
};

const contractC = {
  planId: 'growth',
  addOns: {
    extraStorage: { selected: true, quantity: 2 },
    prioritySuccess: { selected: true, quantity: 1 },
  },
};
const downgradeInput = {
  planId: 'starter',
  addOns: { extraStorage: { selected: true, quantity: 2 } },
};
const defaultVariables = {
  seats: 5,
  prioritySupport: false,
  region: 'eu',
  priceByRegion: { 'eu-price': 8, 'us-price': 10 },
};

const applySelection = (page: Page, input: unknown) =>
  page.evaluate(
    (value) => (document.querySelector('pricing-renderer') as LoadApiElement).applySelection(value),
    input,
  );
const readResolvedState = (page: Page, selector = 'pricing-renderer') =>
  page.evaluate((css) => (document.querySelector(css) as LoadApiElement).resolvedState, selector);
const nextUpdate = (page: Page) =>
  page.evaluate(
    () => (document.querySelector('pricing-renderer') as LoadApiElement).updateComplete,
  );
const recorded = (page: Page, key: string) =>
  page.evaluate((name) => (window as LoadApiWindow).recorded?.[name] ?? [], key);

async function record(page: Page, selector: string, eventName: string, key: string) {
  await page.evaluate(
    ([css, type, name]) => {
      const target = window as LoadApiWindow;
      target.recorded ??= {};
      target.recorded[name!] = [];
      document.querySelector(css!)!.addEventListener(type!, (event) => {
        target.recorded![name!]!.push((event as CustomEvent).detail ?? true);
      });
    },
    [selector, eventName, key],
  );
}

async function setControlled(page: Page, planId: string, quantity: number, enabled = true) {
  await page.evaluate(
    ([plan, packs, variables, selected]) => {
      const renderer = document.querySelector('pricing-renderer') as LoadApiElement;
      renderer.selection = {
        planId: plan,
        billingPeriod: 'monthly',
        variables,
        addOns: { extraStorage: { selected, quantity: packs } },
      };
    },
    [planId, quantity, defaultVariables, enabled] as const,
  );
}

// Adds a second renderer whose first load stays pending until resolvePendingLoads.
async function addPendingRenderer(page: Page, id: string) {
  await page.evaluate((elementId) => {
    const target = window as LoadApiWindow;
    const source = (document.querySelector('pricing-renderer') as LoadApiElement).yaml;
    const renderer = document.createElement('pricing-renderer') as LoadApiElement;
    renderer.id = elementId;
    renderer.src = 'https://example.com/pricing.yml';
    target.pendingLoads ??= {};
    const pending: (() => void)[] = [];
    target.pendingLoads[elementId] = pending;
    renderer.loadPricing = () =>
      new Promise<string | undefined>((resolve) => pending.push(() => resolve(source)));
    document.body.append(renderer);
  }, id);
  await page.waitForFunction(
    (elementId) => ((window as LoadApiWindow).pendingLoads?.[elementId]?.length ?? 0) >= 1,
    id,
  );
}

async function resolvePendingLoads(page: Page, id: string) {
  await page.evaluate((elementId) => {
    for (const resolve of (window as LoadApiWindow).pendingLoads![elementId]!.splice(0)) resolve();
  }, id);
  await page.waitForFunction(
    (elementId) =>
      (document.getElementById(elementId) as LoadApiElement).resolvedState !== undefined,
    id,
  );
}

// Reload in flight with an earlier pricing: set a new pending loadPricing and call reload().
async function startPendingReload(page: Page, id: string) {
  await page.evaluate(async (elementId) => {
    const target = window as LoadApiWindow;
    const renderer = document.getElementById(elementId) as LoadApiElement;
    const source = (document.querySelector('pricing-renderer') as LoadApiElement).yaml;
    const pending: (() => void)[] = [];
    target.pendingLoads![elementId] = pending;
    renderer.loadPricing = () =>
      new Promise<string | undefined>((resolve) => pending.push(() => resolve(source)));
    void renderer.reload();
    await renderer.updateComplete;
  }, id);
  await page.waitForFunction(
    (elementId) => ((window as LoadApiWindow).pendingLoads?.[elementId]?.length ?? 0) >= 2,
    id,
  );
}

const applyOn = (page: Page, id: string, input: unknown) =>
  page.evaluate(
    ([elementId, value]) =>
      (document.getElementById(elementId as string) as LoadApiElement).applySelection(value),
    [id, input] as const,
  );

async function addFailedRenderer(page: Page, id: string) {
  await page.evaluate(async (elementId) => {
    const renderer = document.createElement('pricing-renderer') as LoadApiElement;
    renderer.id = elementId;
    document.body.append(renderer);
    await renderer.updateComplete;
  }, id);
}

const growthRadio = (page: Page) => page.getByRole('radio', { name: 'Choose Growth' });
const addOnCheckbox = (page: Page, name: string) =>
  page.locator('.pr-addon-card').filter({ hasText: name }).getByRole('checkbox');

test('[utest->req~apply-selection-replaces~1] load API: applies the Delivera contract', async ({
  page,
}) => {
  await applySelection(page, contractC);
  await nextUpdate(page);
  await expect(growthRadio(page)).toBeChecked();
  await expect(addOnCheckbox(page, 'Extra Storage')).toBeChecked();
  await expect(addOnCheckbox(page, 'Priority Success')).toBeChecked();
  await expect(page.locator('.pr-summary')).toContainText('€80');
});

test('[utest->req~apply-selection-replaces~1] load API: replaces the selection instead of merging', async ({
  page,
}) => {
  await selectGrowthWithExtraStorage(page);
  await applySelection(page, { planId: 'enterprise' });
  await nextUpdate(page);
  await expect(page.getByRole('radio', { name: 'Choose Enterprise' })).toBeChecked();
  await expect(addOnCheckbox(page, 'Extra Storage')).not.toBeChecked();
  await expect(page.locator('.pr-summary')).toContainText('€40');
});

test('[utest->req~apply-selection-result~1] load API: returns the applied result', async ({
  page,
}) => {
  const outcome = await page.evaluate((input) => {
    const renderer = document.querySelector('pricing-renderer') as LoadApiElement;
    const result = renderer.applySelection(input);
    return { result, state: renderer.resolvedState };
  }, contractC);
  expect(outcome.result.applied).toBe(true);
  expect(outcome.result.resolved?.subtotal).toBe(80);
  expect(outcome.result.removedAddOnIds).toEqual([]);
  expect(outcome.result.diagnostics).toEqual([]);
  expect(outcome.result.selection).toEqual(outcome.state?.selection);
  expect(outcome.result.resolved).toEqual(outcome.state?.resolved);
});

test('[utest->req~apply-selection-result~1] load API: reports the removed add-on', async ({
  page,
}) => {
  const result = await applySelection(page, downgradeInput);
  expect(result.applied).toBe(true);
  expect(result.removedAddOnIds).toEqual(['extraStorage']);
  expect(result.resolved?.subtotal).toBe(20);
  expect(result.diagnostics).toHaveLength(1);
  expect(result.diagnostics[0]).toMatchObject({
    code: 'PR_SELECTION_ADDON_REMOVED',
    severity: 'info',
    path: 'selection.addOns.extraStorage',
  });
});

test('[utest->req~apply-selection-uses-selection-in-effect~1] load API: falls back to the selection in effect', async ({
  page,
}) => {
  await growthRadio(page).check();
  await page.getByRole('radio', { name: /Yearly/ }).check();
  const result = await applySelection(page, { planId: 'legacy', billingPeriod: 'quarterly' });
  expect(result.selection?.planId).toBe('growth');
  expect(result.selection?.billingPeriod).toBe('yearly');
  expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
    'PR_SELECTION_UNKNOWN_PLAN',
    'PR_SELECTION_UNKNOWN_BILLING_PERIOD',
  ]);
});

test('[utest->req~apply-selection-silent~1] load API: emits no pricing-selection-change', async ({
  page,
}) => {
  await collectEvents(page);
  await applySelection(page, contractC);
  await applySelection(page, downgradeInput);
  await nextUpdate(page);
  expect(await selectionEvents(page)).toHaveLength(0);
});

test('[utest->req~apply-selection-no-dialog~1] load API: removes add-ons without a dialog', async ({
  page,
}) => {
  await selectGrowthWithExtraStorage(page);
  await applySelection(page, {
    planId: 'starter',
    addOns: { extraStorage: { selected: true, quantity: 1 } },
  });
  await nextUpdate(page);
  await expect(page.locator('.pr-dialog')).toHaveCount(0);
  await expect(page.getByRole('radio', { name: 'Choose Starter' })).toBeChecked();
  await expect(addOnCheckbox(page, 'Extra Storage')).not.toBeChecked();
  await expect(page.locator('.pr-summary')).toContainText('€20');
});

test('[utest->req~apply-selection-discards-pending~1] load API: discards a pending change and restores focus', async ({
  page,
}) => {
  await selectGrowthWithExtraStorage(page);
  await collectEvents(page);
  const starter = page.getByRole('radio', { name: 'Choose Starter' });
  await starter.focus();
  await starter.click();
  await expect(planDialog(page)).toBeVisible();
  await expect(planDialog(page)).toContainText('Will remove: extraStorage');
  await applySelection(page, { planId: 'enterprise' });
  await nextUpdate(page);
  await expect(page.locator('.pr-dialog')).toHaveCount(0);
  await expect(page.getByRole('radio', { name: 'Choose Enterprise' })).toBeChecked();
  expect(await selectionEvents(page)).toHaveLength(0);
  await expect(starter).toBeFocused();
});

test('[utest->req~apply-selection-input-unmutated~1] load API: leaves the input untouched', async ({
  page,
}) => {
  const input = {
    planId: 'growth',
    addOns: {
      ghost: { selected: true, quantity: 1 },
      extraStorage: { selected: true, quantity: 25 },
    },
  };
  const after = await page.evaluate((value) => {
    const copy = structuredClone(value);
    (document.querySelector('pricing-renderer') as LoadApiElement).applySelection(value);
    return { value, copy };
  }, input);
  expect(after.value).toEqual(after.copy);
  expect(after.value).toEqual(input);
});

test('[utest->req~apply-selection-input-detached~1] load API: keeps no reference to the input', async ({
  page,
}) => {
  await page.evaluate((value) => {
    const input = structuredClone(value);
    (document.querySelector('pricing-renderer') as LoadApiElement).applySelection(input);
    input.planId = 'starter';
    input.addOns.extraStorage.quantity = 7;
  }, contractC);
  await nextUpdate(page);
  const state = await readResolvedState(page);
  expect(state?.selection.planId).toBe('growth');
  expect(state?.selection.addOns.extraStorage?.quantity).toBe(2);
  expect(state?.resolved.subtotal).toBe(80);
});

test('[utest->req~apply-selection-not-ready~1] load API: refuses while the first load is in flight', async ({
  page,
}) => {
  await addPendingRenderer(page, 'late');
  const result = await applyOn(page, 'late', contractC);
  expect(result.applied).toBe(false);
  expect(result.selection).toBeUndefined();
  expect(result.resolved).toBeUndefined();
  expect(result.removedAddOnIds).toEqual([]);
  expect(result.diagnostics).toHaveLength(1);
  expect(result.diagnostics[0]).toMatchObject({
    code: 'PR_SELECTION_NOT_READY',
    severity: 'error',
  });
  await resolvePendingLoads(page, 'late');
  const state = await readResolvedState(page, '#late');
  expect(state?.selection.planId).toBe('starter');
  expect(state?.resolved.subtotal).toBe(20);
});

test('[utest->req~apply-selection-not-ready~1] load API: refuses while a reload is in flight', async ({
  page,
}) => {
  await addPendingRenderer(page, 'late');
  await resolvePendingLoads(page, 'late');
  await startPendingReload(page, 'late');
  const result = await applyOn(page, 'late', contractC);
  expect(result.applied).toBe(false);
  expect(result.selection).toBeUndefined();
  expect(result.resolved).toBeUndefined();
  expect(result.diagnostics).toHaveLength(1);
  expect(result.diagnostics[0]).toMatchObject({
    code: 'PR_SELECTION_NOT_READY',
    severity: 'error',
  });
  await resolvePendingLoads(page, 'late');
  const state = await readResolvedState(page, '#late');
  expect(state?.selection.planId).toBe('starter');
  expect(state?.resolved.subtotal).toBe(20);
});

test('[utest->req~apply-selection-not-ready~1] load API: refuses after a failed first load', async ({
  page,
}) => {
  await addFailedRenderer(page, 'failed');
  const result = await applyOn(page, 'failed', contractC);
  expect(result.applied).toBe(false);
  expect(result.diagnostics).toHaveLength(1);
  expect(result.diagnostics[0]).toMatchObject({
    code: 'PR_SELECTION_NOT_READY',
    severity: 'error',
  });
});

test('[utest->req~apply-selection-not-ready~1] load API: applies after a failed reload that keeps the pricing', async ({
  page,
}) => {
  await record(page, 'pricing-renderer', 'pricing-diagnostic', 'conflict');
  await page.evaluate(async () => {
    const renderer = document.querySelector('pricing-renderer') as LoadApiElement;
    renderer.pricing = {};
    await renderer.updateComplete;
  });
  const conflicts = (await recorded(page, 'conflict')) as { diagnostics: LoadDiagnostic[] }[];
  expect(conflicts).toHaveLength(1);
  expect(conflicts[0]?.diagnostics[0]?.code).toBe('PR_SOURCE_CONFLICT');
  const result = await applySelection(page, contractC);
  expect(result.applied).toBe(true);
  expect(result.resolved?.subtotal).toBe(80);
});

test('[utest->req~apply-selection-controlled~1] load API: refuses in controlled mode', async ({
  page,
}) => {
  await setControlled(page, 'growth', 1);
  const outcome = await page.evaluate((input) => {
    const renderer = document.querySelector('pricing-renderer') as LoadApiElement;
    return { result: renderer.applySelection(input), state: renderer.resolvedState };
  }, contractC);
  expect(outcome.result.applied).toBe(false);
  expect(outcome.result.selection?.planId).toBe('growth');
  expect(outcome.result.resolved?.subtotal).toBe(50);
  expect(outcome.result.removedAddOnIds).toEqual([]);
  expect(outcome.result.diagnostics).toHaveLength(1);
  expect(outcome.result.diagnostics[0]).toMatchObject({
    code: 'PR_SELECTION_CONTROLLED',
    severity: 'error',
  });
  expect(outcome.result.selection).toEqual(outcome.state?.selection);
  expect(outcome.result.resolved).toEqual(outcome.state?.resolved);
});

test('[utest->req~apply-selection-refusal-keeps-state~1] load API: a controlled refusal stores nothing', async ({
  page,
}) => {
  await setControlled(page, 'growth', 1);
  const before = await page.evaluate(() => {
    const renderer = document.querySelector('pricing-renderer') as LoadApiElement;
    (window as LoadApiWindow).hostValue = renderer.selection;
    return JSON.stringify(renderer.selection);
  });
  await applySelection(page, contractC);
  const kept = await page.evaluate((json) => {
    const renderer = document.querySelector('pricing-renderer') as LoadApiElement;
    return (
      renderer.selection === (window as LoadApiWindow).hostValue &&
      JSON.stringify(renderer.selection) === json
    );
  }, before);
  expect(kept).toBe(true);
  await page.evaluate(async () => {
    const renderer = document.querySelector('pricing-renderer') as LoadApiElement;
    renderer.selection = undefined;
    await renderer.updateComplete;
  });
  const state = await readResolvedState(page);
  expect(state?.selection.planId).toBe('starter');
  expect(state?.selection.addOns).toEqual({});
  expect(state?.resolved.subtotal).toBe(20);
});

test('[utest->req~apply-selection-refusal-keeps-state~1] load API: a not-ready refusal stores nothing', async ({
  page,
}) => {
  await addPendingRenderer(page, 'late');
  await applyOn(page, 'late', contractC);
  await resolvePendingLoads(page, 'late');
  const state = await readResolvedState(page, '#late');
  expect(state?.selection.planId).toBe('starter');
  expect(state?.selection.addOns).toEqual({});
});

test('[utest->req~apply-selection-diagnostic-event~1] load API: dispatches one pricing-diagnostic event', async ({
  page,
}) => {
  await record(page, 'pricing-renderer', 'pricing-diagnostic', 'main');
  const result = await page.evaluate(() => {
    const renderer = document.querySelector('pricing-renderer') as LoadApiElement;
    const result = renderer.applySelection({ planId: 'legacy' });
    return { result, count: (window as LoadApiWindow).recorded!.main!.length };
  });
  expect(result.count).toBe(1);
  expect(result.result.diagnostics).toHaveLength(1);
  expect(result.result.diagnostics[0]).toMatchObject({
    code: 'PR_SELECTION_UNKNOWN_PLAN',
    severity: 'warning',
  });
  expect(await recorded(page, 'main')).toEqual([{ diagnostics: result.result.diagnostics }]);
});

test('[utest->req~apply-selection-diagnostic-event~1] load API: dispatches the refusal diagnostics', async ({
  page,
}) => {
  await setControlled(page, 'growth', 1);
  await record(page, 'pricing-renderer', 'pricing-diagnostic', 'controlled');
  const controlled = await applySelection(page, contractC);
  expect(controlled.diagnostics[0]?.code).toBe('PR_SELECTION_CONTROLLED');
  expect(await recorded(page, 'controlled')).toEqual([{ diagnostics: controlled.diagnostics }]);

  await addPendingRenderer(page, 'late');
  await record(page, '#late', 'pricing-diagnostic', 'late');
  const notReady = await applyOn(page, 'late', contractC);
  expect(notReady.diagnostics[0]?.code).toBe('PR_SELECTION_NOT_READY');
  expect(await recorded(page, 'late')).toEqual([{ diagnostics: notReady.diagnostics }]);
});

test('[utest->req~apply-selection-no-empty-diagnostic~1] load API: dispatches no event for an empty list', async ({
  page,
}) => {
  await record(page, 'pricing-renderer', 'pricing-diagnostic', 'main');
  const result = await applySelection(page, contractC);
  expect(result.diagnostics).toEqual([]);
  await nextUpdate(page);
  expect(await recorded(page, 'main')).toHaveLength(0);
});

test('[utest->req~apply-selection-diagnostics-not-rendered~1] load API: keeps the diagnostics out of the rendered list', async ({
  page,
}) => {
  const items = page.locator('[data-pr-part="diagnostics"] li');
  const before = await items.count();
  const result = await applySelection(page, {
    planId: 'legacy',
    addOns: { ghost: { selected: true, quantity: 1 } },
  });
  expect(result.diagnostics.length).toBeGreaterThan(0);
  await nextUpdate(page);
  await expect(items).toHaveCount(before);
  await expect(page.locator('pricing-renderer')).not.toContainText('PR_SELECTION_');
});

async function reloadAndWaitForReady(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const renderer = document.querySelector('pricing-renderer') as LoadApiElement;
    const ready = new Promise((resolve) =>
      renderer.addEventListener('pricing-ready', resolve, { once: true }),
    );
    void renderer.reload();
    await ready;
  });
}

test('[utest->req~apply-selection-reload-restarts~1] load API: a reload restarts from the default selection', async ({
  page,
}) => {
  await applySelection(page, contractC);
  await reloadAndWaitForReady(page);
  const state = await readResolvedState(page);
  expect(state?.selection.planId).toBe('starter');
  expect(state?.selection.addOns).toEqual({});
  expect(state?.resolved.subtotal).toBe(20);
  await expect(page.locator('.pr-summary')).toContainText('€20');
});

test('[utest->req~apply-selection-reload-restarts~1] load API: a reload restarts from defaultSelection', async ({
  page,
}) => {
  await page.evaluate(() => {
    (document.querySelector('pricing-renderer') as LoadApiElement).defaultSelection = {
      planId: 'growth',
    };
  });
  await applySelection(page, contractC);
  await reloadAndWaitForReady(page);
  const state = await readResolvedState(page);
  expect(state?.selection.planId).toBe('growth');
  expect(state?.selection.addOns).toEqual({});
  expect(state?.resolved.subtotal).toBe(45);
});

test('[utest->req~apply-selection-in-ready-listener~1] load API: keeps a selection applied from a pricing-ready listener', async ({
  page,
}) => {
  await collectEvents(page);
  await page.evaluate((input) => {
    const target = window as LoadApiWindow;
    const renderer = document.querySelector('pricing-renderer') as LoadApiElement;
    renderer.addEventListener(
      'pricing-ready',
      () => {
        target.listenerResult = renderer.applySelection(input);
      },
      { once: true },
    );
    void renderer.reload();
  }, contractC);
  await page.waitForFunction(() => (window as LoadApiWindow).listenerResult !== undefined);
  const listenerResult = await page.evaluate(() => (window as LoadApiWindow).listenerResult);
  expect(listenerResult?.applied).toBe(true);
  await expect(growthRadio(page)).toBeChecked();
  await expect(page.locator('.pr-summary')).toContainText('€80');
  expect((await readResolvedState(page))?.resolved.subtotal).toBe(80);
  expect(await selectionEvents(page)).toHaveLength(0);
});

test('[utest->req~resolved-state-not-ready~1] load API: has no resolvedState before the element is ready', async ({
  page,
}) => {
  await addPendingRenderer(page, 'first');
  expect(await readResolvedState(page, '#first')).toBeUndefined();
  await addPendingRenderer(page, 'again');
  await resolvePendingLoads(page, 'again');
  await startPendingReload(page, 'again');
  expect(await readResolvedState(page, '#again')).toBeUndefined();
  await addFailedRenderer(page, 'failed');
  expect(await readResolvedState(page, '#failed')).toBeUndefined();
});

test('[utest->req~resolved-state-snapshot~1] load API: reads the initial state', async ({
  page,
}) => {
  const state = await readResolvedState(page);
  expect(state?.selection).toEqual({
    planId: 'starter',
    billingPeriod: 'monthly',
    variables: defaultVariables,
    addOns: {},
  });
  expect(state?.resolved.subtotal).toBe(20);
  await expect(page.locator('.pr-summary')).toContainText('€20');
});

test('[utest->req~resolved-state-snapshot~1] load API: reads the state after user changes', async ({
  page,
}) => {
  await selectGrowthWithExtraStorage(page);
  const state = await readResolvedState(page);
  expect(state?.selection.planId).toBe('growth');
  expect(state?.selection.addOns.extraStorage).toEqual({ selected: true, quantity: 1 });
  expect(state?.resolved.subtotal).toBe(50);
  await expect(page.locator('.pr-summary')).toContainText('€50');
});

test('[utest->req~resolved-state-snapshot~1] load API: ignores variables while they are disabled', async ({
  page,
}) => {
  const applied = await applySelection(page, { planId: 'starter', variables: { seats: 12 } });
  expect(applied.resolved?.subtotal).toBe(48);
  await page.evaluate(() => {
    (document.querySelector('pricing-renderer') as LoadApiElement).variablesEnabled = false;
  });
  const state = await readResolvedState(page);
  expect(state?.selection.variables.seats).toBe(5);
  expect(state?.resolved.subtotal).toBe(20);
});

test('[utest->req~resolved-state-detached~1] load API: returns detached snapshots', async ({
  page,
}) => {
  const outcome = await page.evaluate(() => {
    const renderer = document.querySelector('pricing-renderer') as LoadApiElement;
    const a = renderer.resolvedState!;
    const b = renderer.resolvedState!;
    const distinct = {
      state: a !== b,
      selection: a.selection !== b.selection,
      addOns: a.selection.addOns !== b.selection.addOns,
      resolved: a.resolved !== b.resolved,
    };
    a.selection.planId = 'enterprise';
    a.resolved.subtotal = 0;
    return { distinct, third: renderer.resolvedState };
  });
  expect(outcome.distinct).toEqual({ state: true, selection: true, addOns: true, resolved: true });
  expect(outcome.third?.selection.planId).toBe('starter');
  expect(outcome.third?.resolved.subtotal).toBe(20);
  await expect(page.locator('.pr-summary')).toContainText('€20');
});

test('[utest->req~resolved-state-controlled~1] load API: reconciles the controlled selection', async ({
  page,
}) => {
  await setControlled(page, 'starter', 2);
  const outcome = await page.evaluate(() => {
    const renderer = document.querySelector('pricing-renderer') as LoadApiElement;
    return { state: renderer.resolvedState, host: renderer.selection as LoadDetail['selection'] };
  });
  expect(outcome.state?.selection.addOns.extraStorage).toEqual({ selected: false, quantity: 2 });
  expect(outcome.state?.resolved.subtotal).toBe(20);
  expect(outcome.host.addOns.extraStorage).toEqual({ selected: true, quantity: 2 });
});

test('[utest->req~resolved-state-read-only~1] load API: defines resolvedState as a getter only', async ({
  page,
}) => {
  const descriptor = await page.evaluate(() => {
    const element = customElements.get('pricing-renderer')!;
    const found = Object.getOwnPropertyDescriptor(element.prototype, 'resolvedState');
    return { get: typeof found?.get, set: typeof found?.set };
  });
  expect(descriptor).toEqual({ get: 'function', set: 'undefined' });
});

test('[utest->req~ready-detail-selection~1] load API: pricing-ready carries the selection', async ({
  page,
}) => {
  await page.evaluate(() => {
    const target = window as LoadApiWindow;
    const renderer = document.querySelector('pricing-renderer') as LoadApiElement;
    target.recorded = { ready: [] };
    renderer.addEventListener('pricing-ready', (event) => {
      target.recorded!.ready!.push({
        detail: (event as CustomEvent<LoadDetail>).detail,
        state: renderer.resolvedState,
      });
    });
  });
  await reloadAndWaitForReady(page);
  type Entry = { detail: LoadDetail; state: LoadDetail };
  const [first] = (await recorded(page, 'ready')) as Entry[];
  expect(first?.detail.selection).toEqual(first?.state.selection);
  expect(first?.detail.resolved).toEqual(first?.state.resolved);
  expect(first?.detail.selection.planId).toBe('starter');
  expect(first?.detail.resolved.subtotal).toBe(20);

  await page.evaluate((input) => {
    (document.querySelector('pricing-renderer') as LoadApiElement).defaultSelection = input;
  }, downgradeInput);
  await reloadAndWaitForReady(page);
  const second = ((await recorded(page, 'ready')) as Entry[])[1];
  expect(second?.detail.selection.addOns.extraStorage).toEqual({ selected: false, quantity: 2 });
  expect(second?.detail.resolved.subtotal).toBe(20);
});

test('quantity stepper input max is the largest grid value, not the raw maximum', async ({
  page,
}) => {
  // min 1, step 5, max 8: valid quantities are 1 and 6
  await page.evaluate(async () => {
    const renderer = document.createElement('pricing-renderer') as LoadApiElement;
    renderer.id = 'grid-renderer';
    renderer.yaml = [
      "syntaxVersion: '3.1'",
      'saasName: Grid',
      "version: '1'",
      'createdAt: 2026-01-01',
      'currency: EUR',
      'plans:',
      '  base:',
      '    price: 10',
      'addOns:',
      '  seats:',
      '    price: 2',
      '    subscriptionConstraints:',
      '      minQuantity: 1',
      '      quantityStep: 5',
      '      maxQuantity: 8',
    ].join('\n');
    renderer.selection = {
      planId: 'base',
      billingPeriod: 'monthly',
      variables: {},
      addOns: { seats: { selected: true, quantity: 1 } },
    };
    document.body.append(renderer);
    await renderer.updateComplete;
  });
  await expect(
    page.locator('#grid-renderer [data-pr-part="add-on-quantity"] input'),
  ).toHaveAttribute('max', '6');
});

test('quantity stepper shows the normalized quantity of a controlled selection', async ({
  page,
}) => {
  await collectEvents(page);
  await page.evaluate(
    ([variables]) => {
      (document.querySelector('pricing-renderer') as PlanChangeElement).selection = {
        planId: 'growth',
        billingPeriod: 'monthly',
        variables,
        addOns: { extraStorage: { selected: true, quantity: 25 } },
      };
    },
    [defaultVariables] as const,
  );
  const stepper = page.locator('[data-pr-part="add-on-quantity"]');
  await expect(stepper.locator('input')).toHaveValue('10');
  await stepper.locator('button').first().click();
  const events = await selectionEvents(page);
  expect(events.at(-1)?.selection.addOns.extraStorage?.quantity).toBe(9);
});

test('switches locale without changing source data', async ({ page }) => {
  await page.locator('#locale').selectOption('es-ES');
  await expect(page.getByRole('heading', { name: 'Comparar planes' })).toBeVisible();
  await expect(page.getByText('Periodo de facturación')).toBeVisible();
});

test('renders infinite usage limits as localized Unlimited labels', async ({ page }) => {
  await page.getByRole('radio', { name: 'Choose Enterprise' }).check();
  await page.getByRole('button', { name: 'Usage' }).click();
  await expect(page.getByText('Unlimited').first()).toBeVisible();

  await page.locator('#locale').selectOption('es-ES');
  await expect(page.getByText('Ilimitado').first()).toBeVisible();
});

test('has no serious accessibility violations', async ({ page }) => {
  const results = await new AxeBuilder({ page })
    .exclude('#action-output')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    results.violations.filter((violation) =>
      ['serious', 'critical'].includes(violation.impact ?? ''),
    ),
  ).toEqual([]);
});

for (const viewport of [
  { name: 'mobile-320', width: 320, height: 900 },
  { name: 'mobile-375', width: 375, height: 900 },
  { name: 'mobile-599', width: 599, height: 1000 },
  { name: 'tablet-600', width: 600, height: 1000 },
  { name: 'tablet-839', width: 839, height: 1000 },
  { name: 'table-840', width: 840, height: 1000 },
  { name: 'desktop-1024', width: 1024, height: 1000 },
  { name: 'desktop-1200', width: 1200, height: 1000 },
  { name: 'desktop-1440', width: 1440, height: 1000 },
]) {
  test(`is responsive at ${viewport.name}`, async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Visual baselines are generated once in Chromium.');
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.reload();
    await expect(page.locator('pricing-renderer .pr-plan-card')).toHaveCount(3);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await page.locator('pricing-renderer').scrollIntoViewIfNeeded();
    await expect(page).toHaveScreenshot(`${viewport.name}.png`, {
      fullPage: false,
      animations: 'disabled',
      maxDiffPixelRatio:
        viewport.name === 'desktop-1200'
          ? 0.03
          : // Ubuntu's glyph antialiasing affects about 2% of these text-dense screenshots.
            viewport.name === 'mobile-320' || viewport.name === 'mobile-375'
            ? 0.025
            : 0.015,
    });
  });
}

// Price breakdown (delivera-3-price-breakdown): element state, events and the disclosure panel.
type BreakdownLine = {
  kind: 'plan' | 'addOn';
  id: string;
  name: string;
  quantity: number;
  unitAmount?: number;
  billingMultiplier: number;
  amount?: number;
  requiresQuote: boolean;
  label?: string;
};
type Breakdown = {
  currency: string;
  billingPeriod?: { id: string; label: string; multiplier: number };
  plan?: BreakdownLine;
  addOns: BreakdownLine[];
  subtotal: number;
  requiresQuote: boolean;
};
type BreakdownResolved = { subtotal: number; requiresQuote: boolean; breakdown: Breakdown };
type BreakdownState = { resolved: BreakdownResolved };
type ThemedElement = LoadApiElement & { theme: string };
type FlagsElement = LoadApiElement & { selectionEnabled: boolean; ctaEnabled: boolean };
type ExpectedRow = { kind: 'plan' | 'addOn'; id: string; texts: string[] };

// The showcase renderer; renderers added by a test are appended to the body, outside <main>.
const DEMO = 'main pricing-renderer';

const contractCY = { ...contractC, billingPeriod: 'yearly' };
const contractE = {
  planId: 'enterprise',
  addOns: {
    extraStorage: { selected: true, quantity: 3 },
    compliance: { selected: true, quantity: 1 },
  },
};
const breakdownCY: Breakdown = {
  currency: 'EUR',
  billingPeriod: { id: 'yearly', label: 'Yearly', multiplier: 0.8 },
  plan: {
    kind: 'plan',
    id: 'growth',
    name: 'Growth',
    quantity: 1,
    unitAmount: 45,
    billingMultiplier: 0.8,
    amount: 36,
    requiresQuote: false,
  },
  addOns: [
    {
      kind: 'addOn',
      id: 'extraStorage',
      name: 'Extra Storage',
      quantity: 2,
      unitAmount: 5,
      billingMultiplier: 0.8,
      amount: 8,
      requiresQuote: false,
    },
    {
      kind: 'addOn',
      id: 'prioritySuccess',
      name: 'Priority Success',
      quantity: 1,
      unitAmount: 25,
      billingMultiplier: 0.8,
      amount: 20,
      requiresQuote: false,
    },
  ],
  subtotal: 64,
  requiresQuote: false,
};
const rowsCY: ExpectedRow[] = [
  { kind: 'plan', id: 'growth', texts: ['Growth', '€45 × 1 × 0.8 = €36'] },
  { kind: 'addOn', id: 'extraStorage', texts: ['Extra Storage', '€5 × 2 × 0.8 = €8'] },
  { kind: 'addOn', id: 'prioritySuccess', texts: ['Priority Success', '€25 × 1 × 0.8 = €20'] },
];

// Pricing P: one plan, no add-ons, no billing block. Pricing Q: the plan price never resolves.
const plainYaml = [
  "syntaxVersion: '3.1'",
  'saasName: Plain',
  "version: '1'",
  'createdAt: 2026-01-01',
  'currency: EUR',
  'plans:',
  '  base:',
  '    price: 10',
].join('\n');
const quoteYaml = [
  "syntaxVersion: '3.1'",
  'saasName: Quote',
  "version: '1'",
  'createdAt: 2026-01-01',
  'currency: EUR',
  'variables:',
  '  rate: n/a',
  'plans:',
  '  base:',
  "    price: '#rate * 2'",
].join('\n');

const summaryOf = (page: Page, host = DEMO) => page.locator(`${host} .pr-summary`);
const toggleOf = (page: Page, host = DEMO) =>
  summaryOf(page, host).locator('[data-pr-part="breakdown-toggle"]');
const panelOf = (page: Page, host = DEMO) => page.locator(`${host} [data-pr-part="breakdown"]`);
const rowsOf = (page: Page, host = DEMO) =>
  panelOf(page, host).locator('[data-pr-part="breakdown-line"]');
const liveOf = (page: Page, host = DEMO) => summaryOf(page, host).locator('[aria-live="polite"]');
const readBreakdownState = async (page: Page, selector = DEMO) =>
  (await readResolvedState(page, selector)) as unknown as BreakdownState;

async function addYamlRenderer(page: Page, id: string, yaml: string) {
  await page.evaluate(
    async ([elementId, source]) => {
      const renderer = document.createElement('pricing-renderer') as LoadApiElement;
      renderer.id = elementId;
      renderer.yaml = source;
      renderer.defaultSelection = { planId: 'base' };
      const ready = new Promise((resolve) =>
        renderer.addEventListener('pricing-ready', resolve, { once: true }),
      );
      document.body.append(renderer);
      await ready;
      await renderer.updateComplete;
    },
    [id, yaml] as const,
  );
}

async function expectPanel(page: Page, open: boolean, host = DEMO) {
  await expect(toggleOf(page, host)).toHaveAttribute('aria-expanded', String(open));
  if (open) {
    await expect(panelOf(page, host)).not.toHaveAttribute('hidden');
    return;
  }
  await expect(panelOf(page, host)).toHaveAttribute('hidden');
  await expect.poll(() => panelOf(page, host).evaluate((panel) => panel.childNodes.length)).toBe(0);
}

// The text of the panel without its rows: the currency, billing period and total part.
const panelTotals = (page: Page, host = DEMO) =>
  panelOf(page, host).evaluate((panel) => {
    const copy = panel.cloneNode(true) as HTMLElement;
    for (const row of copy.querySelectorAll('[data-pr-part="breakdown-line"]')) row.remove();
    return copy.textContent ?? '';
  });

async function openPanel(page: Page, host = DEMO) {
  await toggleOf(page, host).click();
  await expectPanel(page, true, host);
}

const rowKeys = (page: Page, host: string) =>
  rowsOf(page, host).evaluateAll((rows) =>
    rows.map((row) => [row.getAttribute('data-line-kind'), row.getAttribute('data-line-id')]),
  );

async function expectRows(page: Page, expected: ExpectedRow[], host = DEMO) {
  await expect.poll(() => rowKeys(page, host)).toEqual(expected.map((row) => [row.kind, row.id]));
  for (const [index, row] of expected.entries()) {
    for (const text of row.texts) await expect(rowsOf(page, host).nth(index)).toContainText(text);
  }
}

// The panel id of a renderer: how many elements of the document have it and whether the one found
// is inside that renderer.
const panelIdentity = (page: Page, css: string) =>
  page.evaluate((selector) => {
    const host = document.querySelector(selector);
    const button = host?.querySelector('[data-pr-part="breakdown-toggle"]');
    const id = button?.getAttribute('aria-controls') ?? '';
    const found = id ? document.querySelectorAll(`#${CSS.escape(id)}`) : [];
    return { id, count: found.length, inHost: found[0]?.closest('pricing-renderer') === host };
  }, css);

// Switches the theme and waits for the color transitions it starts to finish.
const setTheme = (page: Page, theme: string) =>
  page.evaluate(async (value) => {
    const renderer = document.querySelector('pricing-renderer') as ThemedElement;
    renderer.theme = value;
    await renderer.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await Promise.allSettled(document.getAnimations().map((animation) => animation.finished));
  }, theme);

test('[utest->req~breakdown-in-element~1] price breakdown: resolvedState and applySelection carry it', async ({
  page,
}) => {
  const result = (await applySelection(page, contractCY)) as unknown as BreakdownState;
  await nextUpdate(page);
  const state = await readBreakdownState(page);
  expect(result.resolved.breakdown).toStrictEqual(breakdownCY);
  expect(state.resolved.breakdown).toStrictEqual(breakdownCY);
  expect(state.resolved.breakdown.subtotal).toBe(state.resolved.subtotal);
  expect(state.resolved.breakdown.requiresQuote).toBe(state.resolved.requiresQuote);
  await expect(summaryOf(page)).toContainText('€64');
});

test('[utest->req~breakdown-in-element~1] price breakdown: events carry it', async ({ page }) => {
  await record(page, DEMO, 'pricing-ready', 'ready');
  await record(page, DEMO, 'pricing-selection-change', 'change');
  await record(page, DEMO, 'pricing-action', 'action');
  await reloadAndWaitForReady(page);
  await growthRadio(page).check();
  await page.getByRole('link', { name: 'Start free trial' }).click();
  await expect.poll(async () => (await recorded(page, 'action')).length).toBe(1);

  type Detail = { resolved: BreakdownResolved };
  const [ready] = (await recorded(page, 'ready')) as Detail[];
  expect(ready?.resolved.breakdown.plan?.id).toBe('starter');
  expect(ready?.resolved.breakdown.subtotal).toBe(20);
  const changes = (await recorded(page, 'change')) as Detail[];
  const actions = (await recorded(page, 'action')) as Detail[];
  for (const detail of [changes.at(-1), actions.at(-1)]) {
    expect(detail?.resolved.breakdown.plan?.id).toBe('growth');
    expect(detail?.resolved.breakdown.subtotal).toBe(45);
    expect(detail?.resolved.subtotal).toBe(45);
  }
});

test('[utest->req~breakdown-element-stabilized~1] price breakdown: keeps the last valid price of a failing expression', async ({
  page,
}) => {
  await page.evaluate(() => {
    const renderer = document.querySelector('pricing-renderer');
    renderer?.addEventListener('pricing-selection-change', (event) => {
      (window as typeof window & { latestSelection?: unknown }).latestSelection = (
        event as CustomEvent
      ).detail.selection;
    });
  });
  const seatsInput = page.getByRole('spinbutton', { name: 'Team seats' });
  await seatsInput.fill('6');
  await seatsInput.press('Tab');
  await expect(summaryOf(page)).toContainText('€24');
  await page.evaluate(() => {
    const renderer = document.querySelector('pricing-renderer') as
      (HTMLElement & { selection?: Record<string, unknown> }) | null;
    const selection = (window as typeof window & { latestSelection?: Record<string, unknown> })
      .latestSelection;
    if (!renderer || !selection) throw new Error('Pricing selection was not captured.');
    renderer.selection = {
      ...selection,
      variables: {
        ...(selection.variables as Record<string, unknown>),
        seats: 'not-a-number',
      },
    };
  });
  await expect(summaryOf(page)).toContainText('Requires quote');
  await expect(summaryOf(page)).toContainText('€24');

  const { resolved } = await readBreakdownState(page);
  expect(resolved.breakdown.plan).toStrictEqual({
    kind: 'plan',
    id: 'starter',
    name: 'Starter',
    quantity: 1,
    unitAmount: 24,
    billingMultiplier: 1,
    amount: 24,
    requiresQuote: false,
  });
  expect(resolved.breakdown.subtotal).toBe(24);
  expect(resolved.subtotal).toBe(24);
  expect(resolved.breakdown.requiresQuote).toBe(true);
  expect(resolved.requiresQuote).toBe(true);
});

test('[utest->req~summary-breakdown-toggle~1] price breakdown: toggle starts closed with an English name', async ({
  page,
}) => {
  const toggle = summaryOf(page).getByRole('button', {
    name: 'How is this calculated?',
    exact: true,
  });
  await expect(toggle).toHaveCount(1);
  await expect(toggle).toHaveAttribute('data-pr-part', 'breakdown-toggle');
  await expect(toggle).toHaveAttribute('type', 'button');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  const panel = await page.evaluate((css) => {
    const button = document.querySelector(`${css} [data-pr-part="breakdown-toggle"]`);
    const id = button?.getAttribute('aria-controls') ?? '';
    const found = id ? document.getElementById(id) : null;
    return {
      id,
      part: found?.getAttribute('data-pr-part'),
      hidden: found?.hasAttribute('hidden'),
      nodes: found?.childNodes.length,
    };
  }, DEMO);
  expect(panel.id).not.toBe('');
  expect(panel).toMatchObject({ part: 'breakdown', hidden: true, nodes: 0 });
});

test('[utest->req~summary-breakdown-toggle~1] price breakdown: toggle has a Spanish name', async ({
  page,
}) => {
  await page.locator('#locale').selectOption('es-ES');
  await expect(toggleOf(page)).toHaveCount(1);
  await expect(toggleOf(page)).toHaveAccessibleName('¿Cómo se calcula?');
});

test('[utest->req~summary-breakdown-toggle~1] price breakdown: toggle stays when the flags are off', async ({
  page,
}) => {
  await page.evaluate(() => {
    const renderer = document.querySelector('pricing-renderer') as FlagsElement;
    renderer.selectionEnabled = false;
    renderer.ctaEnabled = false;
    renderer.variablesEnabled = false;
  });
  await nextUpdate(page);
  await expect(page.locator('[data-pr-part="selection-control"]')).toHaveCount(0);
  await expect(toggleOf(page)).toBeVisible();
});

test('[utest->req~summary-breakdown-toggle~1] price breakdown: a pricing without add-ons has one toggle', async ({
  page,
}) => {
  await addYamlRenderer(page, 'plain', plainYaml);
  await expect(summaryOf(page, '#plain')).toContainText('€10');
  await expect(toggleOf(page, '#plain')).toHaveCount(1);
});

test('[utest->req~summary-breakdown-unique-ids~1] price breakdown: two renderers have distinct panel ids', async ({
  page,
}) => {
  await addYamlRenderer(page, 'plain', plainYaml);
  const demo = await panelIdentity(page, DEMO);
  const plain = await panelIdentity(page, '#plain');
  expect(demo.id).toBeTruthy();
  expect(plain.id).toBeTruthy();
  expect(demo.id).not.toBe(plain.id);
  expect(demo).toMatchObject({ count: 1, inHost: true });
  expect(plain).toMatchObject({ count: 1, inHost: true });
});

test('[utest->req~summary-breakdown-activate~1] price breakdown: a click opens and closes the panel', async ({
  page,
}) => {
  const toggle = toggleOf(page);
  await toggle.click();
  await expectPanel(page, true);
  await expect(page.locator(DEMO).getByRole('group', { name: 'Price breakdown' })).toBeVisible();
  await expect(toggle).toBeFocused();
  await toggle.click();
  await expectPanel(page, false);
});

test('[utest->req~summary-breakdown-activate~1] price breakdown: Enter and Space toggle the panel', async ({
  page,
}) => {
  const toggle = toggleOf(page);
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expectPanel(page, true);
  await expect(toggle).toBeFocused();
  await page.keyboard.press('Space');
  await expectPanel(page, false);
  await expect(toggle).toBeFocused();
});

test('[utest->req~summary-breakdown-lines~1] price breakdown: rows of a contract billed yearly', async ({
  page,
}) => {
  await applySelection(page, contractCY);
  await nextUpdate(page);
  await openPanel(page);
  await expectRows(page, rowsCY);
});

test('[utest->req~summary-breakdown-lines~1] price breakdown: rows of Enterprise with compliance', async ({
  page,
}) => {
  await applySelection(page, contractE);
  await nextUpdate(page);
  await openPanel(page);
  await expectRows(page, [
    { kind: 'plan', id: 'enterprise', texts: ['Enterprise', '€40 × 1 × 1 = €40'] },
    { kind: 'addOn', id: 'extraStorage', texts: ['Extra Storage', '€5 × 3 × 1 = €15'] },
    { kind: 'addOn', id: 'compliance', texts: ['Compliance', 'Contact sales'] },
  ]);
});

test('[utest->req~summary-breakdown-lines~1] price breakdown: a plan that never resolves requires a quote', async ({
  page,
}) => {
  await addYamlRenderer(page, 'quote', quoteYaml);
  await openPanel(page, '#quote');
  const row: ExpectedRow = { kind: 'plan', id: 'base', texts: ['Base', 'Requires quote'] };
  await expectRows(page, [row], '#quote');
});

test('[utest->req~summary-breakdown-totals~1] price breakdown: totals of a contract billed yearly', async ({
  page,
}) => {
  await applySelection(page, contractCY);
  await nextUpdate(page);
  await openPanel(page);
  const panel = panelOf(page);
  for (const text of ['Billing period', 'Yearly', 'Currency', 'EUR', 'Estimated total', '€64']) {
    await expect(panel).toContainText(text);
  }
});

test('[utest->req~summary-breakdown-totals~1] price breakdown: totals when a quote is required', async ({
  page,
}) => {
  await applySelection(page, contractE);
  await nextUpdate(page);
  await openPanel(page);
  const panel = panelOf(page);
  for (const text of ['Known subtotal', '€55', 'Requires quote']) {
    await expect(panel).toContainText(text);
  }
});

test('[utest->req~summary-breakdown-totals~1] price breakdown: no billing period row with one period', async ({
  page,
}) => {
  await addYamlRenderer(page, 'plain', plainYaml);
  await openPanel(page, '#plain');
  const panel = panelOf(page, '#plain');
  for (const text of ['Currency', 'EUR', 'Estimated total', '€10']) {
    await expect.poll(() => panelTotals(page, '#plain')).toContain(text);
  }
  await expect(panel).not.toContainText('Billing period');
});

test('[utest->req~summary-breakdown-escape~1] price breakdown: Escape on the toggle closes the panel', async ({
  page,
}) => {
  const toggle = toggleOf(page);
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expectPanel(page, true);
  await page.keyboard.press('Escape');
  await expectPanel(page, false);
  await expect(toggle).toBeFocused();
});

test('[utest->req~summary-breakdown-escape-scope~1] price breakdown: Escape on a plan radio leaves the panel open', async ({
  page,
}) => {
  await openPanel(page);
  await growthRadio(page).focus();
  await page.keyboard.press('Escape');
  await expectPanel(page, true);
});

test('[utest->req~summary-breakdown-escape-scope~1] price breakdown: Escape cancels the dialog and leaves the panel open', async ({
  page,
}) => {
  await selectGrowthWithExtraStorage(page);
  await openPanel(page);
  await page.getByRole('radio', { name: 'Choose Starter' }).click();
  await expect(planDialog(page)).toContainText('Will remove: extraStorage');
  await page.keyboard.press('Escape');
  await expect(page.locator('.pr-dialog')).toHaveCount(0);
  await expect(growthRadio(page)).toBeChecked();
  await expectPanel(page, true);
});

test('[utest->req~summary-breakdown-stays-open~1] price breakdown: stays open when the user picks Growth', async ({
  page,
}) => {
  await openPanel(page);
  await growthRadio(page).check();
  await expectPanel(page, true);
  await expectRows(page, [{ kind: 'plan', id: 'growth', texts: ['Growth', '€45 × 1 × 1 = €45'] }]);
  await expect.poll(() => panelTotals(page)).toContain('Estimated total');
  await expect.poll(() => panelTotals(page)).toContain('€45');
});

test('[utest->req~summary-breakdown-stays-open~1] price breakdown: stays open when the host applies a selection', async ({
  page,
}) => {
  await openPanel(page);
  await applySelection(page, contractCY);
  await nextUpdate(page);
  await expectPanel(page, true);
  await expectRows(page, rowsCY);
});

test('[utest->req~summary-breakdown-closes-on-load~1] price breakdown: closes when the pricing reloads', async ({
  page,
}) => {
  await openPanel(page);
  await reloadAndWaitForReady(page);
  await nextUpdate(page);
  await expectPanel(page, false);
});

test('[utest->req~summary-breakdown-not-live~1] price breakdown: toggle and panel are outside live regions', async ({
  page,
}) => {
  await applySelection(page, contractE);
  await nextUpdate(page);
  const liveAncestors = () =>
    page.evaluate((css) => {
      const live = '[aria-live]:not([aria-live="off"])';
      const host = document.querySelector(css)!;
      const button = host.querySelector('[data-pr-part="breakdown-toggle"]')!;
      const found = host.querySelector('[data-pr-part="breakdown"]')!;
      return {
        toggle: button.closest(live)?.tagName ?? null,
        panel: found.closest(live)?.tagName ?? null,
      };
    }, DEMO);
  expect(await liveAncestors()).toEqual({ toggle: null, panel: null });
  await openPanel(page);
  expect(await liveAncestors()).toEqual({ toggle: null, panel: null });
});

test('[utest->req~summary-live-region~1] price breakdown: one live region holds label, total and quote note', async ({
  page,
}) => {
  await expect(liveOf(page)).toHaveCount(1);
  await expect(liveOf(page)).toContainText('Estimated total');
  await expect(liveOf(page)).toContainText('€20');
  await applySelection(page, contractE);
  await nextUpdate(page);
  await expect(liveOf(page)).toHaveCount(1);
  for (const text of ['Known subtotal', '€55', 'Requires quote']) {
    await expect(liveOf(page)).toContainText(text);
  }
});

test('[utest->req~summary-live-region~1] price breakdown: opening the panel leaves the live text unchanged', async ({
  page,
}) => {
  await applySelection(page, contractE);
  await nextUpdate(page);
  await expect(liveOf(page)).toContainText('Requires quote');
  const before = await liveOf(page).evaluate((element) => element.textContent);
  await openPanel(page);
  const after = await liveOf(page).evaluate((element) => element.textContent);
  expect(after).toBe(before);
});

for (const viewport of [
  { width: 320, height: 900 },
  { width: 1440, height: 1000 },
]) {
  test(`[utest->req~summary-breakdown-closed-layout~1] price breakdown: the closed toggle keeps the layout at ${viewport.width} px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await expect(toggleOf(page)).toBeVisible();
    const measured = await page.evaluate(async (css) => {
      const frames = () =>
        new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const measure = () => ({
        summary: document.querySelector(`${css} .pr-summary`)!.getBoundingClientRect().height,
        element: document.querySelector(css)!.getBoundingClientRect().height,
      });
      await frames();
      const before = measure();
      const style = document.createElement('style');
      style.textContent =
        "pricing-renderer [data-pr-part='breakdown-toggle'] { display: none !important; }";
      document.head.append(style);
      await frames();
      const after = measure();
      const toggle = document.querySelector(`${css} [data-pr-part="breakdown-toggle"]`)!;
      const display = getComputedStyle(toggle).display;
      style.remove();
      return { before, after, display };
    }, DEMO);
    expect(measured.display).toBe('none');
    expect(Math.abs(measured.after.summary - measured.before.summary)).toBeLessThan(0.5);
    expect(Math.abs(measured.after.element - measured.before.element)).toBeLessThan(0.5);
  });
}

for (const viewport of [
  { width: 375, height: 900 },
  { width: 1440, height: 1000 },
]) {
  test(`[utest->req~summary-breakdown-target-size~1] price breakdown: the toggle has a 44 px pointer target at ${viewport.width} px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await summaryOf(page).scrollIntoViewIfNeeded();
    const box = await toggleOf(page).boundingBox();
    if (!box) throw new Error('The breakdown toggle has no box.');
    expect(box.width).toBeGreaterThanOrEqual(24);
    expect(box.height).toBeGreaterThanOrEqual(24);
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const hits = await page.evaluate(
      ([css, x, y]) => {
        const toggle = document.querySelector(`${css} [data-pr-part="breakdown-toggle"]`);
        const part = '[data-pr-part="breakdown-toggle"]';
        const offsets = { left: [-21, 0], right: [21, 0], top: [0, -21], bottom: [0, 21] };
        const result: Record<string, boolean> = {};
        for (const [side, [dx = 0, dy = 0]] of Object.entries(offsets)) {
          const hit = document.elementFromPoint(x + dx, y + dy);
          result[side] = hit?.closest(part) === toggle;
        }
        return result;
      },
      [DEMO, cx, cy] as const,
    );
    expect(hits).toEqual({ left: true, right: true, top: true, bottom: true });
    await page.mouse.click(cx + 21, cy);
    await expectPanel(page, true);
  });
}

test('[utest->req~summary-breakdown-axe~1] price breakdown: no serious violations with the panel open', async ({
  page,
}) => {
  await applySelection(page, contractE);
  await nextUpdate(page);
  await openPanel(page);
  const serious = async (scope?: string) => {
    const builder = new AxeBuilder({ page })
      .exclude('#action-output')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']);
    const results = await (scope ? builder.include(scope) : builder).analyze();
    return results.violations.filter((violation) =>
      ['serious', 'critical'].includes(violation.impact ?? ''),
    );
  };
  expect(await serious()).toEqual([]);
  await setTheme(page, 'dark');
  await expectPanel(page, true);
  // The dark step scans the summary only: the demo page keeps its light background while the
  // component switches to the dark tokens, so the rest of the page (which this change does not
  // touch) is not measured against a real dark surface. The summary paints its own surface
  // (--pr-color-surface at 95%, dark in this theme), so the contrast here is the real one.
  expect(await serious(`${DEMO} [data-pr-part="summary"]`)).toEqual([]);
});

for (const theme of ['light', 'dark']) {
  test(`[utest->req~summary-breakdown-icon-contrast~1] price breakdown: icon contrast is at least 3:1 in the ${theme} theme`, async ({
    page,
  }) => {
    await setTheme(page, theme);
    await expect(toggleOf(page)).toBeVisible();
    // Poll: the toggle color may still be transitioning right after the theme switch.
    await expect
      .poll(() =>
        page.evaluate((css) => {
          const rgb = (value: string) => {
            const probe = document.createElement('span');
            probe.style.color = value.trim();
            document.body.append(probe);
            const computed = getComputedStyle(probe).color;
            probe.remove();
            return (computed.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
          };
          const luminance = (channels: number[]) => {
            const [r = 0, g = 0, b = 0] = channels.map((channel) => {
              const value = channel / 255;
              return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
            });
            return 0.2126 * r + 0.7152 * g + 0.0722 * b;
          };
          const host = document.querySelector(css)!;
          const toggle = host.querySelector('[data-pr-part="breakdown-toggle"]')!;
          const surfaceValue = getComputedStyle(host).getPropertyValue('--pr-color-surface');
          const icon = luminance(rgb(getComputedStyle(toggle).color));
          const surface = luminance(rgb(surfaceValue));
          return (Math.max(icon, surface) + 0.05) / (Math.min(icon, surface) + 0.05);
        }, DEMO),
      )
      .toBeGreaterThanOrEqual(3);
  });
}

test('[utest->req~summary-breakdown-reduced-motion~1] price breakdown: no transitions or animations with reduced motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openPanel(page);
  const durations = await page.evaluate((css) => {
    const read = (element: Element | null) => {
      const style = getComputedStyle(element!);
      return { transition: style.transitionDuration, animation: style.animationDuration };
    };
    const host = document.querySelector(css)!;
    return {
      toggle: read(host.querySelector('[data-pr-part="breakdown-toggle"]')),
      panel: read(host.querySelector('[data-pr-part="breakdown"]')),
    };
  }, DEMO);
  const seconds = (list: string) =>
    list.split(',').map((value) => {
      const amount = Number.parseFloat(value);
      return value.trim().endsWith('ms') ? amount / 1000 : amount;
    });
  for (const element of [durations.toggle, durations.panel]) {
    for (const duration of [...seconds(element.transition), ...seconds(element.animation)]) {
      expect(duration).toBeLessThanOrEqual(0.00001 + 1e-12);
    }
  }
});
