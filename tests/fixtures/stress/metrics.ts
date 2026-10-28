// Pure helpers over the numbers the UX stress spec measures in the browser. They have no DOM
// dependency, so vitest checks them (tests/unit/ux-stress-metrics.test.ts) and the spec reuses them.

// True when the last row of the plan grid holds a single card while the grid has several columns
// and rows. One column stacks the cards, so a row of one card is the normal layout there.
export function loneLastCard(gridColumns: number, cardsPerRow: number[]): boolean {
  return gridColumns > 1 && cardsPerRow.length > 1 && cardsPerRow[cardsPerRow.length - 1] === 1;
}
