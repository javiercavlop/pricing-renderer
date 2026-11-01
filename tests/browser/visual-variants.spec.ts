import { expect, test } from '@playwright/test';

// Dark and RTL screenshot baselines at 375 and 1440 px.
// Chromium-only, and only Linux baselines exist (no non-Linux ones), so a local macOS run fails the
// first time. The tolerances are copied from the loop in pricing-renderer.spec.ts.

// [utest->req~visual-baseline-dark~1] [utest->req~visual-baseline-rtl~1]
const cases = [
  { name: 'dark-375', variant: 'dark', width: 375, height: 900, maxDiffPixelRatio: 0.025 },
  { name: 'dark-1440', variant: 'dark', width: 1440, height: 1000, maxDiffPixelRatio: 0.015 },
  { name: 'rtl-375', variant: 'rtl', width: 375, height: 900, maxDiffPixelRatio: 0.025 },
  { name: 'rtl-1440', variant: 'rtl', width: 1440, height: 1000, maxDiffPixelRatio: 0.015 },
] as const;

for (const { name, variant, width, height, maxDiffPixelRatio } of cases) {
  test(`matches the ${variant} baseline at ${width}px`, async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Visual baselines are generated once in Chromium.');
    const cards = page.locator('pricing-renderer .pr-plan-card');
    await page.goto('/');
    await expect(cards).toHaveCount(3);
    // The system scheme is pinned so that only the variant changes.
    await page.emulateMedia({ colorScheme: 'light' });
    await page.setViewportSize({ width, height });
    await page.reload();
    await expect(cards).toHaveCount(3);

    if (variant === 'dark') {
      await page.getByLabel('Theme', { exact: true }).selectOption('dark');
    } else {
      await page.evaluate(() => {
        document.documentElement.dir = 'rtl';
      });
    }
    // Waits for the renderer update and the transitions the switch starts.
    await page.evaluate(async () => {
      const renderer = document.querySelector('pricing-renderer') as HTMLElement & {
        updateComplete?: Promise<unknown>;
      };
      await renderer.updateComplete;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await Promise.allSettled(document.getAnimations().map((animation) => animation.finished));
    });

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await page.locator('pricing-renderer').scrollIntoViewIfNeeded();
    await expect(page).toHaveScreenshot(`${name}.png`, {
      fullPage: false,
      animations: 'disabled',
      maxDiffPixelRatio,
    });
  });
}
