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
