import { expect, test } from '@playwright/test';
import {
  applyPricing,
  fixtures,
  measureOverflow,
  measurePlanGrid,
  openRenderer,
  readFixture,
  type Viewport,
} from './helpers/spectra.js';

// Spectra item 8 (docs/agent-work/spectra-item8-grid/spec.md): balanced plan columns and the first
// CTA inside the first screen. Every test prints one SPECTRA_GRID JSON line.

const viewports: Viewport[] = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
];

// Okta has no plans, so it has no grid and no CTA.
const withPlans = fixtures.filter((fixture) => fixture.saas !== 'okta');

// Maximum columns by container width; the same bands are in tests/unit/plan-grid-columns.test.ts.
function maxColumns(containerWidth: number): number {
  if (containerWidth < 600) return 1;
  if (containerWidth < 840) return 2;
  if (containerWidth < 1040) return 3;
  return 4;
}

// Fewest rows, then the fullest last row, then the most columns, never a single card alone in the
// last of several rows; when every column count leaves one alone, the rule is waived (exempt).
function expectedColumns(plans: number, max: number): number {
  const options = [];
  for (let columns = Math.min(max, plans); columns >= 1; columns -= 1) {
    const rows = Math.ceil(plans / columns);
    const last = plans - (rows - 1) * columns;
    options.push({ columns, rows, last, lone: rows > 1 && last === 1 });
  }
  const allowed = options.some((option) => !option.lone)
    ? options.filter((option) => !option.lone)
    : options;
  allowed.sort((a, b) => a.rows - b.rows || b.last - a.last || b.columns - a.columns);
  return allowed[0].columns;
}

function expectedRows(plans: number, containerWidth: number): number[] {
  const max = maxColumns(containerWidth);
  // 1 or 2 plans sit in one row from 600px; the 600-839 band always uses 2 columns.
  const columns = max === 1 ? 1 : plans <= 2 ? plans : max === 2 ? 2 : expectedColumns(plans, max);
  const rows: number[] = [];
  for (let left = plans; left > 0; left -= columns) rows.push(Math.min(columns, left));
  return rows;
}

// Plan counts whose lone last card cannot be avoided in a band (see the spec).
function exempt(plans: number, containerWidth: number): boolean {
  const max = maxColumns(containerWidth);
  if (max === 2) return true;
  if (max === 3) return plans === 7 || plans === 13;
  return plans === 13;
}

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
        // [utest->spectra-item8:AC6] A hard gate at 1440x900 only; 1024x768 is printed above.
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
