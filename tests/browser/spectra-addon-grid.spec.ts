import { expect, test } from '@playwright/test';
import { applyPricing, openRenderer, readFixture, type Viewport } from './helpers/spectra.js';

// Spectra item 7 (docs/agent-work/spectra-item7-addon-grid/spec.md, criterion e): equal card height
// per grid row, the initial cap of 8 cards and the add-on search. Every test prints one
// SPECTRA_ADDON_GRID JSON line.
// [utest->req~addon-grid-equal-height~1] [utest->req~addon-grid-cap~1]
// [utest->req~addon-grid-filter~1] [utest->req~addon-grid-total-visible~1]

const viewports: Viewport[] = [
  { width: 1440, height: 900 },
  { width: 1024, height: 900 },
  { width: 375, height: 800 },
];

const dense = ['okta', 'zoom', 'salesforce', 'github', 'postman', 'userguiding'];
const filterMode = new Set(['okta', 'zoom', 'salesforce', 'github']);
const visibleCap = 8;

test.beforeEach(({ browserName }) => {
  test.skip(browserName !== 'chromium', 'The spectra checks run in chromium only.');
});

test.describe('spectra add-on grid', () => {
  for (const saas of dense) {
    for (const viewport of viewports) {
      test(`${saas} ${viewport.width}x${viewport.height}`, async ({ page }) => {
        test.setTimeout(60_000);
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await openRenderer(page, viewport);
        const yaml = readFixture(saas);
        const state = await applyPricing(page, yaml);
        expect(state).toBe('ready');

        const cards = page.locator('pricing-renderer .pr-addon-card');
        const initialCount = await cards.count();

        // Cards grouped by rounded top: the height spread of every row, disclosures closed.
        const rows = await page.evaluate(() => {
          const groups = new Map<number, number[]>();
          for (const card of document.querySelectorAll('pricing-renderer .pr-addon-card')) {
            const rect = card.getBoundingClientRect();
            const top = Math.round(rect.top + window.scrollY);
            groups.set(top, [...(groups.get(top) ?? []), rect.height]);
          }
          return [...groups.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([top, heights]) => ({
              top,
              cards: heights.length,
              spread: Math.round((Math.max(...heights) - Math.min(...heights)) * 100) / 100,
            }));
        });

        const isFilter = filterMode.has(saas);
        let searched: { term: string; count: number; found: boolean } | null = null;
        if (isFilter) {
          expect(initialCount).toBeLessThanOrEqual(visibleCap);

          // The name of the first add-on beyond the 8th, read from the revealed list.
          await page.locator('pricing-renderer .pr-addon-main button.pr-button--quiet').click();
          await expect(cards).not.toHaveCount(initialCount);
          const names = await page.locator('pricing-renderer .pr-addon-card h4').allTextContents();
          expect(names.length).toBeGreaterThan(visibleCap);
          const term = names[visibleCap].trim();

          // [utest->req~addon-grid-filter~1] Fill the search first, then a new load resets both the
          // revealed flag and the search.
          const search = page.locator(
            'pricing-renderer [data-pr-part="addon-toolbar"] input[type=search]',
          );
          await search.fill(term);
          await applyPricing(page, yaml);
          await expect(search).toHaveValue('');
          await expect(cards).toHaveCount(initialCount);

          await search.fill(term);
          const card = page.locator('pricing-renderer .pr-addon-card h4', { hasText: term });
          await expect(card.first()).toBeVisible();
          const count = await cards.count();
          searched = { term, count, found: true };
          expect(count).toBeGreaterThanOrEqual(1);
          expect(count).toBeLessThan(initialCount);
        }

        console.info(
          `SPECTRA_ADDON_GRID ${JSON.stringify({
            fixture: saas,
            viewport,
            filterMode: isFilter,
            initialCards: initialCount,
            rows,
            searched,
          })}`,
        );

        expect(initialCount).toBeGreaterThan(0);
        for (const row of rows) expect(row.spread, `row at ${row.top}`).toBeLessThanOrEqual(1);
        expect(errors).toEqual([]);
      });
    }
  }
});
