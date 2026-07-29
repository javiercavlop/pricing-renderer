import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

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
  await expect(page.locator('.pr-plan-card.is-recommended')).toContainText('Growth');
  await expect(page.locator('.pr-summary')).toContainText('€20');

  await page.getByRole('link', { name: 'Start free trial' }).click();
  await expect(page.locator('#action-output')).toContainText('start-growth');
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

test('switches locale without changing source data', async ({ page }) => {
  await page.locator('#locale').selectOption('es-ES');
  await expect(page.getByRole('heading', { name: 'Comparar planes' })).toBeVisible();
  await expect(page.getByText('Periodo de facturación')).toBeVisible();
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
  { name: 'tablet-600', width: 600, height: 1000 },
  { name: 'table-840', width: 840, height: 1000 },
  { name: 'desktop-1200', width: 1200, height: 1000 },
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
    await expect(page).toHaveScreenshot(`${viewport.name}.png`, {
      fullPage: true,
      animations: 'disabled',
    });
  });
}
