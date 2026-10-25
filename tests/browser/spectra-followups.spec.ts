import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  applyPricing,
  measureOverflow,
  openRenderer,
  probeReplacedText,
} from './helpers/spectra.js';

// Follow-ups of PR 46: long labels in tags and plan badges, and the token caps at >= 840px.
// The acme fixture has metadata tags, plans and plan badges (presentation.planBadges).
const acme = readFileSync(
  fileURLToPath(new URL('../fixtures/acme-pricing.yml', import.meta.url)),
  'utf8',
);

const rendererWidth = (page: Page): Promise<number> =>
  page.evaluate(() => {
    const renderer = document.querySelector('pricing-renderer');
    if (!renderer) throw new Error('pricing-renderer was not found.');
    return renderer.clientWidth;
  });

test.beforeEach(({ browserName }) => {
  test.skip(browserName !== 'chromium', 'The spectra checks run in chromium only.');
});

test.describe('spectra follow-ups', () => {
  // [utest->spectra-followups:AC1] One probe per fresh applyPricing: probes change the DOM.
  const pills = [
    { name: 'hero tag', selector: '.pr-tag', card: '[data-pr-part="hero"]' },
    { name: 'plan badge', selector: '[data-pr-part="plan-badge"]', card: '.pr-plan-card' },
  ];
  for (const pill of pills) {
    test(`long ${pill.name} wraps inside the renderer at 375x812`, async ({ page }) => {
      test.setTimeout(60_000);
      await openRenderer(page, { width: 375, height: 812 });
      expect(await applyPricing(page, acme)).toBe('ready');
      const probe = await probeReplacedText(page, pill.selector, pill.card);
      const overflow = await measureOverflow(page);
      expect(probe.found).toBe(true);
      expect(probe.lines).toBeGreaterThan(1);
      expect(probe.insideCard).toBe(true);
      expect(probe.insideRenderer).toBe(true);
      expect(overflow.examples).toEqual([]);
    });
  }

  // [utest->spectra-followups:AC2] .pr-content gets the capped padding and gap from 840px.
  for (const width of [1024, 1440]) {
    test(`token caps at ${width}px`, async ({ page }) => {
      await openRenderer(page, { width, height: 900 });
      expect(await applyPricing(page, acme)).toBe('ready');
      expect(await rendererWidth(page)).toBeGreaterThanOrEqual(840);
      const read = () =>
        page.evaluate(() => {
          const content = document.querySelector('pricing-renderer .pr-content');
          if (!content) throw new Error('.pr-content was not found.');
          const style = getComputedStyle(content);
          return { paddingTop: style.paddingTop, rowGap: style.rowGap };
        });
      expect(await read()).toEqual({ paddingTop: '16px', rowGap: '24px' });
      await page.evaluate(() => {
        const renderer = document.querySelector('pricing-renderer') as HTMLElement;
        renderer.style.setProperty('--pr-shell-padding', '8px');
        renderer.style.setProperty('--pr-space-section', '12px');
      });
      expect(await read()).toEqual({ paddingTop: '8px', rowGap: '12px' });
    });
  }

  // [utest->spectra-followups:AC2] The margin after the plans adds back what the gap cap removed.
  for (const width of [1024, 1440]) {
    test(`space after the plans at ${width}px`, async ({ page }) => {
      await openRenderer(page, { width, height: 900 });
      expect(await applyPricing(page, acme)).toBe('ready');
      expect(await rendererWidth(page)).toBeGreaterThanOrEqual(840);
      const marginAfterPlans = (): Promise<string | null> =>
        page.evaluate(() => {
          const plans = document.querySelector(
            'pricing-renderer .pr-content > [data-pr-part="plans"]',
          );
          const next = plans?.nextElementSibling;
          return next ? getComputedStyle(next).marginTop : null;
        });
      expect(await marginAfterPlans()).not.toBeNull();
      const setSection = (value: string) =>
        page.evaluate((section) => {
          const renderer = document.querySelector('pricing-renderer') as HTMLElement;
          renderer.style.setProperty('--pr-space-section', section);
        }, value);
      await setSection('40px');
      expect(await marginAfterPlans()).toBe('16px');
      await setSection('12px');
      expect(await marginAfterPlans()).toBe('0px');
    });
  }

  // [utest->spectra-followups:AC2] Below 840px the caps do not apply: the demo token (>= 40px) is kept.
  test('keeps the full section gap below 840px', async ({ page }) => {
    await openRenderer(page, { width: 800, height: 900 });
    expect(await applyPricing(page, acme)).toBe('ready');
    expect(await rendererWidth(page)).toBeLessThan(840);
    const rowGap = await page.evaluate(() => {
      const content = document.querySelector('pricing-renderer .pr-content');
      if (!content) throw new Error('.pr-content was not found.');
      return Number.parseFloat(getComputedStyle(content).rowGap);
    });
    expect(rowGap).toBeGreaterThan(24);
  });
});
