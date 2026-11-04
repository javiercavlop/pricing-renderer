import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// loneLastCard (tests/fixtures/stress/metrics.ts) tells the UX stress spec when the plan grid ends
// with a single card. The module is imported dynamically so a missing file is an assertion failure,
// not a load error.

const specifier = '../fixtures/stress/metrics.js';
const metricsPath = new URL('../fixtures/stress/metrics.ts', import.meta.url);

type LoneLastCard = (gridColumns: number, cardsPerRow: number[]) => boolean;

async function load(): Promise<LoneLastCard> {
  expect(existsSync(metricsPath), 'tests/fixtures/stress/metrics.ts should exist').toBe(true);
  const module = (await import(/* @vite-ignore */ specifier)) as { loneLastCard?: unknown };
  expect(typeof module.loneLastCard, 'loneLastCard should be a function').toBe('function');
  return module.loneLastCard as LoneLastCard;
}

describe('UX stress metrics', () => {
  it('exports loneLastCard', async () => {
    await load();
  });

  describe('loneLastCard', () => {
    it('is never true with one column', async () => {
      const loneLastCard = await load();
      expect(loneLastCard(1, [1, 1, 1, 1])).toBe(false);
    });

    it('is false for one column with one card', async () => {
      const loneLastCard = await load();
      expect(loneLastCard(1, [1])).toBe(false);
    });

    it('is true with several columns and a last row of one card', async () => {
      const loneLastCard = await load();
      expect(loneLastCard(3, [3, 1])).toBe(true);
      expect(loneLastCard(4, [4, 4, 1])).toBe(true);
    });

    it('is false when the last row holds several cards', async () => {
      const loneLastCard = await load();
      expect(loneLastCard(3, [3, 2])).toBe(false);
      expect(loneLastCard(3, [3, 3])).toBe(false);
    });

    it('is false with several columns and a single row of one card', async () => {
      const loneLastCard = await load();
      expect(loneLastCard(3, [1])).toBe(false);
    });

    it('is false when a one-card row is not the last row', async () => {
      const loneLastCard = await load();
      expect(loneLastCard(3, [1, 3])).toBe(false);
    });

    it('is false without a grid', async () => {
      const loneLastCard = await load();
      expect(loneLastCard(0, [1, 1])).toBe(false);
    });

    it('is false for empty input', async () => {
      const loneLastCard = await load();
      expect(loneLastCard(3, [])).toBe(false);
    });
  });

  describe('countCellsFullyInside', () => {
    const scroller = { left: 0, right: 400 };

    it('counts cells inside the scroller box', async () => {
      const { countCellsFullyInside } = await import('../fixtures/stress/metrics.js');
      const cells = [
        { left: 0, right: 150 },
        { left: 150, right: 300 },
        { left: 300, right: 450 },
      ];
      expect(countCellsFullyInside(cells, scroller)).toBe(2);
    });

    it('absorbs sub-pixel overshoot and ignores cells without width', async () => {
      const { countCellsFullyInside } = await import('../fixtures/stress/metrics.js');
      expect(countCellsFullyInside([{ left: -0.5, right: 400.5 }], scroller)).toBe(1);
      expect(countCellsFullyInside([{ left: 10, right: 10 }], scroller)).toBe(0);
      expect(countCellsFullyInside([], scroller)).toBe(0);
    });
  });

  describe('addOnRowSpreads', () => {
    it('groups cards by top and gives the height spread of each row', async () => {
      const { addOnRowSpreads } = await import('../fixtures/stress/metrics.js');
      const rows = addOnRowSpreads([
        { top: 500.2, height: 200 },
        { top: 100.4, height: 180 },
        { top: 100, height: 181.5 },
        { top: 500, height: 200 },
        { top: 500, height: 200 },
      ]);
      expect(rows).toEqual([
        { top: 100, cards: 2, spread: 1.5 },
        { top: 500, cards: 3, spread: 0 },
      ]);
    });

    it('returns no rows without cards', async () => {
      const { addOnRowSpreads } = await import('../fixtures/stress/metrics.js');
      expect(addOnRowSpreads([])).toEqual([]);
    });
  });

  describe('intersectsViewport', () => {
    it('is true for boxes that overlap the viewport, partly or fully', async () => {
      const { intersectsViewport } = await import('../fixtures/stress/metrics.js');
      expect(intersectsViewport({ top: 100, bottom: 300 }, 800)).toBe(true);
      expect(intersectsViewport({ top: -50, bottom: 10 }, 800)).toBe(true);
      expect(intersectsViewport({ top: 790, bottom: 900 }, 800)).toBe(true);
    });

    it('is false above, below or for an empty box', async () => {
      const { intersectsViewport } = await import('../fixtures/stress/metrics.js');
      expect(intersectsViewport({ top: -200, bottom: 0 }, 800)).toBe(false);
      expect(intersectsViewport({ top: 800, bottom: 900 }, 800)).toBe(false);
      expect(intersectsViewport({ top: 100, bottom: 100 }, 800)).toBe(false);
    });
  });
});
