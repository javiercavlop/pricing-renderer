import { expect, test } from '@playwright/test';
import { exempt, expectedRows } from './helpers/plan-columns.js';
import {
  applyPricing,
  fixtures,
  measureOverflow,
  measurePlanGrid,
  openRenderer,
  planCount,
  readFixture,
  type Viewport,
} from './helpers/spectra.js';

// Spectra item 8 (docs/agent-work/spectra-item8-grid/spec.md): balanced plan columns and the first
// CTA inside the first screen. Every test prints one SPECTRA_GRID JSON line.

const viewports: Viewport[] = [
  { width: 1440, height: 900 },
  { width: 1200, height: 800 },
  { width: 1024, height: 768 },
];

// A pricing without plans (okta: `plans: null`) has no grid and no CTA.
const withPlans = fixtures.filter((fixture) => planCount(fixture.saas) > 0);

test.beforeEach(({ browserName }) => {
  test.skip(browserName !== 'chromium', 'The spectra checks run in chromium only.');
});

test.describe('spectra plan grid', () => {
  for (const fixture of withPlans) {
    for (const viewport of viewports) {
      test(`${fixture.saas} ${viewport.width}x${viewport.height}`, async ({ page }) => {
        test.setTimeout(60_000);
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await openRenderer(page, viewport);
        const state = await applyPricing(page, readFixture(fixture.saas));
        const grid = await measurePlanGrid(page);
        const overflow = await measureOverflow(page);
        const expected = expectedRows(grid.planCardCount, grid.containerWidth);
        console.info(
          `SPECTRA_GRID ${JSON.stringify({
            fixture: fixture.saas,
            viewport,
            containerWidth: grid.containerWidth,
            plans: grid.planCardCount,
            cardsPerRow: grid.cardsPerRow,
            expectedCardsPerRow: expected,
            gridColumns: grid.gridColumns,
            cardWidths: grid.cardWidths,
            firstCtaVisible: grid.firstCtaVisible,
            firstCtaBottom: grid.firstCtaBottom,
            rendererTopAfterScroll: grid.rendererTopAfterScroll,
            minTargetHeight: grid.minTargetHeight,
            layoutBreakdown: grid.layoutBreakdown,
            overflow,
          })}`,
        );

        expect(state).toBe('ready');
        expect(grid.planCardCount).toBeGreaterThan(0);
        // [utest->spectra-item8:AC2]
        expect(grid.cardWidths?.min ?? 0).toBeGreaterThanOrEqual(220);
        // [utest->spectra-item8:AC5]
        expect(grid.cardsPerRow).toEqual(expected);
        const rows = grid.cardsPerRow;
        if (rows.length > 1 && rows[rows.length - 1] === 1) {
          expect(exempt(grid.planCardCount, grid.containerWidth)).toBe(true);
        }
        // [utest->spectra-item8:AC6] A hard gate at 1440x900 only; 1200x800 and 1024x768 are
        // printed above.
        if (viewport.width === 1440) {
          const layout = grid.layoutBreakdown;
          const message = [
            `first CTA not in view: viewport height ${layout.viewportHeight},`,
            `firstCtaBottom ${grid.firstCtaBottom}, rendererTopAfterScroll ${grid.rendererTopAfterScroll},`,
            `first card height ${layout.firstCardHeight}.`,
            `plan section ${layout.planSection}.`,
            `before plans (top+height): ${layout.beforePlans}.`,
            `first card children (top+height): ${layout.firstCardChildren}`,
          ].join(' ');
          expect(grid.firstCtaVisible, message).toBe(true);
        }
        // [utest->spectra-item8:AC7]
        expect(overflow.examples).toEqual([]);
        // [utest->spectra-item8:AC8]
        expect(grid.minTargetHeight ?? 44).toBeGreaterThanOrEqual(44);
        expect(errors).toEqual([]);
      });
    }
  }
});
