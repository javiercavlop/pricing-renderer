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
});
