import { expect, test, type Page } from '@playwright/test';
import { openRenderer } from './helpers/spectra.js';

// Opt-in density setting: compact has smaller plan-card padding and plan-grid gap, while the
// default, an unknown value and a removed attribute measure the same. The CSS text is checked by
// tests/unit/density.test.ts. Screenshots are attached for review; there are no baselines.

test.beforeEach(({ browserName }) => {
  test.skip(browserName !== 'chromium', 'The density checks run in chromium only.');
});

type Spacing = { padding: number; gap: number };

async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const renderer = document.querySelector('pricing-renderer') as HTMLElement & {
      updateComplete: Promise<unknown>;
    };
    await renderer.updateComplete;
    for (let frame = 0; frame < 3; frame += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  });
}

async function setAttribute(page: Page, value: string | null): Promise<void> {
  await page.evaluate((value) => {
    const renderer = document.querySelector('pricing-renderer') as HTMLElement;
    if (value === null) renderer.removeAttribute('density');
    else renderer.setAttribute('density', value);
  }, value);
  await settle(page);
}

async function measure(page: Page): Promise<Spacing> {
  return page.evaluate(() => {
    const card = document.querySelector('pricing-renderer .pr-plan-card') as Element;
    const grid = document.querySelector('pricing-renderer .pr-plan-grid') as Element;
    const cardStyle = getComputedStyle(card);
    const gridStyle = getComputedStyle(grid);
    return {
      padding: parseFloat(cardStyle.paddingTop) + parseFloat(cardStyle.paddingLeft),
      gap: parseFloat(gridStyle.rowGap) + parseFloat(gridStyle.columnGap),
    };
  });
}

// [utest->req~density-attribute~1] [utest->req~density-compact-tokens~1]
test.describe('density', () => {
  test('compact tightens the plan card padding and the plan grid gap', async ({ page }) => {
    await openRenderer(page, { width: 1440, height: 900 });
    const comfortable = await measure(page);
    expect(comfortable.padding).toBeGreaterThan(0);
    expect(comfortable.gap).toBeGreaterThan(0);

    await setAttribute(page, 'compact');
    const compact = await measure(page);
    expect(compact.padding, 'card padding').toBeLessThan(comfortable.padding);
    expect(compact.gap, 'grid gap').toBeLessThan(comfortable.gap);
  });

  // [utest->req~density-default-unchanged~1]
  test('default, an unknown value and a removed attribute measure the same', async ({ page }) => {
    await openRenderer(page, { width: 1440, height: 900 });
    const host = page.locator('pricing-renderer');
    await expect(host).not.toHaveAttribute('density', /.*/);
    await expect(host).not.toHaveAttribute('data-density', /.*/);
    const defaults = await measure(page);

    await setAttribute(page, 'comfortable');
    expect(await measure(page), 'comfortable').toEqual(defaults);

    await setAttribute(page, 'tight');
    expect(await measure(page), 'unknown value').toEqual(defaults);

    await setAttribute(page, 'compact');
    expect((await measure(page)).padding).toBeLessThan(defaults.padding);

    await setAttribute(page, null);
    expect(await measure(page), 'removed attribute').toEqual(defaults);
    await expect(host).not.toHaveAttribute('data-density', /.*/);
  });

  test('setting the property reflects density="compact" on the host', async ({ page }) => {
    await openRenderer(page, { width: 1440, height: 900 });
    await page.evaluate(async () => {
      const renderer = document.querySelector('pricing-renderer') as HTMLElement & {
        density: string;
        updateComplete: Promise<unknown>;
      };
      renderer.density = 'compact';
      await renderer.updateComplete;
    });
    await expect(page.locator('pricing-renderer')).toHaveAttribute('density', 'compact');
    await expect(page.locator('pricing-renderer')).not.toHaveAttribute('data-density', /.*/);
  });

  for (const width of [1440, 375]) {
    test(`attaches screenshots of both densities at ${width}px`, async ({ page }, testInfo) => {
      await openRenderer(page, { width, height: 900 });
      for (const density of ['comfortable', 'compact']) {
        await setAttribute(page, density);
        const body = await page.locator('pricing-renderer').screenshot();
        await testInfo.attach(`density-${density}-${width}`, {
          body,
          contentType: 'image/png',
        });
      }
    });
  }
});
