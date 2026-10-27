import { expect, test, type Page } from '@playwright/test';
import { openRenderer } from './helpers/spectra.js';

// A src load in flight must be cancelled when reload() finds no source or more than one: the late
// result must not emit pricing-ready or replace the error. The unit test with the same name is
// tests/unit/element-stale-load.test.ts.
// [utest->req~reload-source-error-cancels-load~1]

type StaleElement = HTMLElement & {
  src?: string;
  pricing?: unknown;
  loadPricing?: (request: { signal: AbortSignal }) => Promise<string | undefined>;
  updateComplete: Promise<unknown>;
};
type StaleWindow = typeof window & {
  stalePending?: (() => void)[];
  staleSignals?: AbortSignal[];
  staleReady?: number;
};

// Adds a renderer whose src load stays pending until resolveStale, and counts its pricing-ready.
async function addPendingRenderer(page: Page): Promise<void> {
  await page.evaluate(() => {
    const target = window as StaleWindow;
    const source = (document.querySelector('pricing-renderer') as { yaml?: string }).yaml;
    const renderer = document.createElement('pricing-renderer') as StaleElement;
    renderer.id = 'stale';
    renderer.src = 'https://example.com/pricing.yml';
    target.stalePending = [];
    target.staleSignals = [];
    target.staleReady = 0;
    renderer.loadPricing = ({ signal }) => {
      target.staleSignals!.push(signal);
      return new Promise((resolve) => target.stalePending!.push(() => resolve(source)));
    };
    renderer.addEventListener('pricing-ready', () => {
      target.staleReady = (target.staleReady ?? 0) + 1;
    });
    document.body.append(renderer);
  });
  await page.waitForFunction(() => ((window as StaleWindow).stalePending?.length ?? 0) >= 1);
}

async function resolveStale(page: Page): Promise<void> {
  await page.evaluate(async () => {
    for (const resolve of (window as StaleWindow).stalePending!.splice(0)) resolve();
    const renderer = document.getElementById('stale') as StaleElement;
    for (let frame = 0; frame < 5; frame += 1) {
      await renderer.updateComplete;
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  });
}

test.beforeEach(async ({ page }) => {
  await openRenderer(page, { width: 1280, height: 800 });
  await addPendingRenderer(page);
});

test('removing src during a load aborts it and shows no pricing', async ({ page }) => {
  await page.evaluate(() => {
    (document.getElementById('stale') as StaleElement).src = undefined;
  });
  await expect
    .poll(() => page.evaluate(() => (window as StaleWindow).staleSignals![0]!.aborted))
    .toBe(true);
  await resolveStale(page);
  expect(await page.evaluate(() => (window as StaleWindow).staleReady)).toBe(0);
  await expect(page.locator('#stale .pr-plan-card')).toHaveCount(0);
});

test('adding a second source during a load aborts it', async ({ page }) => {
  await page.evaluate(() => {
    const renderer = document.getElementById('stale') as StaleElement;
    renderer.pricing = { syntaxVersion: '3.1', saasName: 'Conflict', plans: {} };
  });
  await expect
    .poll(() => page.evaluate(() => (window as StaleWindow).staleSignals![0]!.aborted))
    .toBe(true);
  await resolveStale(page);
  expect(await page.evaluate(() => (window as StaleWindow).staleReady)).toBe(0);
  await expect(page.locator('#stale .pr-plan-card')).toHaveCount(0);
});
