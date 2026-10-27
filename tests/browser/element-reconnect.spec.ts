import { expect, test, type Page } from '@playwright/test';
import { openRenderer } from './helpers/spectra.js';

// Moving the element to another parent disconnects and reconnects it. During a slow src load the
// disconnect aborted the load, so the reconnect must start it again and observe the size again. The
// stand-in version is tests/unit/element-reconnect.test.ts.
// [utest->req~element-reconnect-resumes~1]

type ReconnectElement = HTMLElement & {
  src?: string;
  loadPricing?: (request: { signal: AbortSignal }) => Promise<string | undefined>;
  updateComplete: Promise<unknown>;
};
type ReconnectWindow = typeof window & {
  slowPending?: (() => void)[];
  slowSignals?: AbortSignal[];
};

// Two parents next to each other: the renderer starts in `first` and is moved to `second`.
async function addSlowRenderer(page: Page): Promise<void> {
  await page.evaluate(() => {
    const target = window as ReconnectWindow;
    const source = (document.querySelector('pricing-renderer') as { yaml?: string }).yaml;
    for (const id of ['first', 'second']) {
      const parent = document.createElement('div');
      parent.id = id;
      document.body.append(parent);
    }
    const renderer = document.createElement('pricing-renderer') as ReconnectElement;
    renderer.id = 'slow';
    renderer.src = 'https://example.com/pricing.yml';
    target.slowPending = [];
    target.slowSignals = [];
    renderer.loadPricing = ({ signal }) => {
      target.slowSignals!.push(signal);
      return new Promise((resolve) => target.slowPending!.push(() => resolve(source)));
    };
    document.getElementById('first')!.append(renderer);
  });
  await page.waitForFunction(() => ((window as ReconnectWindow).slowPending?.length ?? 0) >= 1);
}

test('an element moved during a slow src load leaves the skeleton', async ({ page }) => {
  await openRenderer(page, { width: 1440, height: 900 });
  await addSlowRenderer(page);
  await expect(page.locator('#slow .pr-skeleton')).not.toHaveCount(0);

  await page.evaluate(() => {
    document.getElementById('second')!.append(document.getElementById('slow')!);
  });
  // the disconnect aborted the first load and the reconnect asks the loader again
  await page.waitForFunction(() => (window as ReconnectWindow).slowSignals!.length >= 2);
  const aborted = await page.evaluate(() => (window as ReconnectWindow).slowSignals![0]!.aborted);
  expect(aborted).toBe(true);

  await page.evaluate(() => {
    for (const resolve of (window as ReconnectWindow).slowPending!.splice(0)) resolve();
  });
  await expect(page.locator('#slow .pr-skeleton')).toHaveCount(0);
  await expect(page.locator('#slow .pr-plan-card')).not.toHaveCount(0);
});

test('the layout follows the size after the move', async ({ page }) => {
  await openRenderer(page, { width: 1440, height: 900 });
  await addSlowRenderer(page);
  await page.evaluate(() => {
    document.getElementById('second')!.style.width = '1100px';
    document.getElementById('second')!.append(document.getElementById('slow')!);
  });
  await page.waitForFunction(() => (window as ReconnectWindow).slowSignals!.length >= 2);
  await page.evaluate(() => {
    for (const resolve of (window as ReconnectWindow).slowPending!.splice(0)) resolve();
  });
  await expect(page.locator('#slow .pr-plan-card')).not.toHaveCount(0);
  await expect(page.locator('#slow .pr-comparison-table')).toHaveCount(1);
  await expect(page.locator('#slow .pr-compact-comparison')).toHaveCount(0);

  await page.evaluate(() => {
    document.getElementById('second')!.style.width = '500px';
  });
  await expect(page.locator('#slow .pr-compact-comparison')).toHaveCount(1);
  await expect(page.locator('#slow .pr-comparison-table')).toHaveCount(0);
});
