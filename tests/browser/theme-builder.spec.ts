import { expect, test, type Page } from '@playwright/test';

// [utest->req~theme-builder-page~1]
// The theme builder page of the demo: live token edits, the export block and the presets.

test.beforeEach(({ browserName }) => {
  test.skip(browserName !== 'chromium', 'The theme builder checks run in chromium only.');
});

const primaryCta = 'pricing-renderer button[data-pr-part="cta"][data-kind="primary"]';

async function openBuilder(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/theme-builder.html');
  await expect(page.locator('pricing-renderer .pr-plan-card')).toHaveCount(3);
  await expect(page.locator(primaryCta).first()).toBeVisible();
}

function ctaBackground(page: Page): Promise<string> {
  const cta = page.locator(primaryCta).first();
  return cta.evaluate((node) => getComputedStyle(node).backgroundColor);
}

test('a token edit applies at once and appears in the export block', async ({ page }) => {
  await openBuilder(page);
  await expect(page.locator('#theme-preset')).toHaveValue('default');

  await expect(page.locator("select[data-token='--pr-font-family']")).toHaveCount(1);
  await page.locator("input[data-token='--pr-color-accent']").fill('#ff0000');

  await expect.poll(() => ctaBackground(page)).toBe('rgb(255, 0, 0)');
  const exported = await page.locator('#theme-export').inputValue();
  expect(exported.startsWith('pricing-renderer[data-pr-root] {')).toBe(true);
  expect(exported).toContain('--pr-color-accent: #ff0000;');
});

test('the minimal preset is flat, the shadcn preset follows --primary', async ({ page }) => {
  await openBuilder(page);

  await page.locator('#theme-preset').selectOption('minimal');
  const card = page.locator('pricing-renderer .pr-plan-card').first();
  const shadow = (): Promise<string> => card.evaluate((node) => getComputedStyle(node).boxShadow);
  await expect.poll(shadow).toBe('none');

  await page.locator('#theme-preset').selectOption('shadcn');
  // Resolve the page's --primary to the colour the browser computes for it.
  const primary = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.backgroundColor = 'var(--primary)';
    document.documentElement.append(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  });
  expect(primary).not.toBe('rgba(0, 0, 0, 0)');
  await expect.poll(() => ctaBackground(page)).toBe(primary);
});

test('the preview is the main landmark', async ({ page }) => {
  await openBuilder(page);
  await expect(page.locator('main pricing-renderer')).toHaveCount(1);
});
