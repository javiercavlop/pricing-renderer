import { expect, test, type Page } from '@playwright/test';
import { applyPricing, openRenderer, readFixture, type Viewport } from './helpers/spectra.js';

// SPECTRA item 2 (docs/agent-work/spectra-item2-shorter-page/spec.md): only differences is on by
// default for pricings over 100 rows with at least 2 plans, the toolbar threshold is configurable,
// the counter reads "{shown} of {total} items" and a search with no match shows an empty state.

const viewport: Viewport = { width: 1440, height: 900 };

// Phase 1 collapsed heights in screens (renderer height / viewport height) at 1440x900.
const baselines: Record<string, number> = {
  clickup: 4.54,
  zoom: 6.25,
  salesforce: 6.05,
  webflow: 8.82,
};

const toolbar = '.pr-comparison-toolbar';
const checkbox = `${toolbar} input[type="checkbox"]`;
const search = `${toolbar} input[type="search"]`;
const counter = `${toolbar} span[aria-live]`;
const rows = '[data-pr-part="comparison-row"]';

test.beforeEach(({ browserName }) => {
  test.skip(browserName !== 'chromium', 'The spectra checks run in chromium only.');
});

async function openPricing(page: Page, saas: string): Promise<void> {
  await openRenderer(page, viewport);
  const state = await applyPricing(page, readFixture(saas), 'en', 'light');
  expect(state, 'the pricing should reach the ready state').toBe('ready');
}

// Waits for the renderer to update and for two frames, so layout reads see the new state.
async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const renderer = document.querySelector('pricing-renderer') as HTMLElement & {
      updateComplete: Promise<unknown>;
    };
    await renderer.updateComplete;
    for (let frame = 0; frame < 2; frame += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  });
}

async function screens(page: Page): Promise<number> {
  return page.evaluate(() => {
    const renderer = document.querySelector('pricing-renderer') as HTMLElement;
    return renderer.getBoundingClientRect().height / window.innerHeight;
  });
}

async function setAttribute(page: Page, name: string, value: string): Promise<void> {
  await page.evaluate(
    ({ name, value }) => {
      document.querySelector('pricing-renderer')?.setAttribute(name, value);
    },
    { name, value },
  );
  await settle(page);
}

async function setOnlyDifferences(page: Page, value: boolean): Promise<void> {
  await page.evaluate((value) => {
    const renderer = document.querySelector('pricing-renderer') as HTMLElement & {
      onlyDifferences?: boolean;
    };
    renderer.onlyDifferences = value;
  }, value);
  await settle(page);
}

// The counter reads "{shown} of {total} items".
async function readCounter(page: Page): Promise<{ shown: number; total: number }> {
  const text = ((await page.locator(counter).textContent()) ?? '').trim();
  const match = /^(\d+) of (\d+) items$/.exec(text);
  expect(match, `counter text "${text}"`).not.toBeNull();
  return { shown: Number(match![1]), total: Number(match![2]) };
}

test.describe('spectra shorter page', () => {
  for (const [saas, baseline] of Object.entries(baselines)) {
    // [utest->req~shorter-page-auto-default~1] [utest->req~shorter-page-counter~1]
    test(`${saas} starts with only differences and is shorter`, async ({ page }) => {
      test.setTimeout(60_000);
      await openPricing(page, saas);
      await expect(page.locator(checkbox), 'only differences is on by default').toBeChecked();

      const counterText = ((await page.locator(counter).textContent()) ?? '').trim();
      expect(counterText).toMatch(/^\d+ of \d+ items$/);
      const shown = Number(counterText.split(' ')[0]);
      const rendered = await page.locator(rows).count();
      expect(shown, 'the counter counts the rendered rows').toBe(rendered);

      const defaultScreens = await screens(page);
      await page.evaluate(() => {
        const renderer = document.querySelector('pricing-renderer') as HTMLElement & {
          onlyDifferences?: boolean;
        };
        renderer.onlyDifferences = false;
      });
      await settle(page);
      await expect(page.locator(checkbox)).not.toBeChecked();
      const offScreens = await screens(page);

      const line = {
        saas,
        defaultScreens: Math.round(defaultScreens * 100) / 100,
        offScreens: Math.round(offScreens * 100) / 100,
        counter: counterText,
      };
      console.info(`SPECTRA_SHORTER ${JSON.stringify(line)}`);

      const pixel = 1 / viewport.height;
      expect(defaultScreens, 'default vs forced off').toBeLessThanOrEqual(offScreens + pixel);
      expect(defaultScreens, 'default vs phase 1 baseline').toBeLessThanOrEqual(baseline + 0.15);
      if (saas === 'clickup') {
        expect(defaultScreens, 'clickup fits in 5 screens').toBeLessThanOrEqual(5);
      }
    });
  }

  // [utest->req~shorter-page-empty-state~1]
  test('clickup shows an empty state when the search matches nothing', async ({ page }) => {
    test.setTimeout(60_000);
    await openPricing(page, 'clickup');
    await page.locator(search).fill('zzzz-no-such-row');
    await settle(page);
    const empty = page.locator('[data-pr-part="comparison-empty"]');
    await expect(empty).toBeVisible();
    await expect(empty).toHaveText(/No matching items/);
    await expect(page.locator(rows)).toHaveCount(0);
    await expect(page.locator(toolbar)).toBeVisible();
    await expect(page.locator(counter)).toHaveText('0 of 174 items');
  });

  // [utest->req~shorter-page-only-differences~1]
  test('notion starts unchecked and the empty attribute checks it', async ({ page }) => {
    test.setTimeout(60_000);
    await openPricing(page, 'notion');
    // 65 rows: the toolbar is shown, but the automatic default stays off.
    await expect(page.locator(checkbox)).not.toBeChecked();
    await setAttribute(page, 'only-differences', '');
    await expect(page.locator(checkbox)).toBeChecked();
  });

  // [utest->req~shorter-page-only-differences~1]
  test('only-differences="false" unchecks it on clickup', async ({ page }) => {
    test.setTimeout(60_000);
    await openPricing(page, 'clickup');
    await expect(page.locator(checkbox)).toBeChecked();
    await setAttribute(page, 'only-differences', 'false');
    await expect(page.locator(checkbox)).not.toBeChecked();
  });

  // [utest->req~shorter-page-toolbar-threshold~1]
  test('toolbar-threshold="200" removes the toolbar on clickup', async ({ page }) => {
    test.setTimeout(60_000);
    await openPricing(page, 'clickup');
    await expect(page.locator(toolbar)).toHaveCount(1);
    await setAttribute(page, 'toolbar-threshold', '200');
    await expect(page.locator(toolbar)).toHaveCount(0);
  });

  // [utest->req~shorter-page-toolbar-threshold~1]
  test('an invalid toolbar-threshold falls back to 40 on the demo page', async ({ page }) => {
    await openRenderer(page, viewport);
    await expect(page.locator(toolbar)).toHaveCount(0);
    // Honouring -5 or "abc" would show the toolbar on the demo pricing.
    for (const value of ['-5', 'abc', 'Infinity']) {
      await setAttribute(page, 'toolbar-threshold', value);
      await expect(page.locator(toolbar), `toolbar-threshold="${value}"`).toHaveCount(0);
    }
    // The demo pricing has 5 rows and the toolbar needs more rows than the threshold.
    await setAttribute(page, 'toolbar-threshold', '4');
    await expect(page.locator(toolbar)).toHaveCount(1);
  });

  // [utest->req~shorter-page-only-differences~1]
  test('the checkbox overrides the property until the next change', async ({ page }) => {
    test.setTimeout(60_000);
    await openPricing(page, 'clickup');
    await setOnlyDifferences(page, false);
    await expect(page.locator(checkbox)).not.toBeChecked();
    const before = await readCounter(page);

    await page.locator(checkbox).check();
    await settle(page);
    await expect(page.locator(checkbox)).toBeChecked();
    const checked = await readCounter(page);
    expect(checked.total, 'the total does not change').toBe(before.total);
    const rendered = await page.locator(rows).count();
    expect(checked.shown, 'the counter counts the rendered rows').toBe(rendered);

    await setAttribute(page, 'only-differences', '');
    await expect(page.locator(checkbox), 'the attribute wins over the override').toBeChecked();

    await page.locator(checkbox).uncheck();
    await settle(page);
    await expect(page.locator(checkbox)).not.toBeChecked();
    // Removing the attribute gives an automatic default of on for clickup: the override is gone.
    await page.evaluate(() => {
      document.querySelector('pricing-renderer')?.removeAttribute('only-differences');
    });
    await settle(page);
    await expect(page.locator(checkbox), 'the removed attribute drops the override').toBeChecked();

    await page.locator(checkbox).uncheck();
    await settle(page);
    await expect(page.locator(checkbox)).not.toBeChecked();
    await setOnlyDifferences(page, true);
    await expect(page.locator(checkbox), 'the property drops the override').toBeChecked();
    await page.locator(checkbox).uncheck();
    await settle(page);
    await setOnlyDifferences(page, false);
    await expect(page.locator(checkbox)).not.toBeChecked();
  });

  // [utest->req~shorter-page-only-differences~1]
  test('a reload drops the checkbox override', async ({ page }) => {
    test.setTimeout(60_000);
    await openPricing(page, 'clickup');
    await expect(page.locator(checkbox)).toBeChecked();
    await page.locator(checkbox).uncheck();
    await settle(page);
    await expect(page.locator(checkbox)).not.toBeChecked();
    const state = await applyPricing(page, readFixture('clickup'), 'en', 'light');
    expect(state, 'the same pricing reloads').toBe('ready');
    await expect(page.locator(checkbox)).toBeChecked();
  });

  // [utest->req~shorter-page-toolbar-threshold~1] [utest->req~shorter-page-empty-state~1]
  test('a hidden toolbar ignores the search text', async ({ page }) => {
    test.setTimeout(60_000);
    await openPricing(page, 'clickup');
    await page.locator(search).fill('zzzz-no-such-row');
    await settle(page);
    const empty = page.locator('[data-pr-part="comparison-empty"]');
    await expect(empty).toBeVisible();

    await setAttribute(page, 'toolbar-threshold', '500');
    await expect(page.locator(toolbar)).toHaveCount(0);
    await expect(empty).toHaveCount(0);
    expect(await page.locator(rows).count(), 'the rows are back').toBeGreaterThan(0);
  });

  // [utest->req~shorter-page-no-look-change~1]
  test('the demo pricing has no toolbar', async ({ page }) => {
    await openRenderer(page, viewport);
    await expect(page.locator('pricing-renderer [data-pr-part="comparison"]')).toHaveCount(1);
    await expect(page.locator(toolbar)).toHaveCount(0);
  });
});
