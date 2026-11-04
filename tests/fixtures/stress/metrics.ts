// Pure helpers over the numbers the UX stress spec measures in the browser. They have no DOM
// dependency, so vitest checks them (tests/unit/ux-stress-metrics.test.ts) and the spec reuses them.

// True when the last row of the plan grid holds a single card while the grid has several columns
// and rows. One column stacks the cards, so a row of one card is the normal layout there.
export function loneLastCard(gridColumns: number, cardsPerRow: number[]): boolean {
  return gridColumns > 1 && cardsPerRow.length > 1 && cardsPerRow[cardsPerRow.length - 1] === 1;
}

export interface HorizontalBox {
  left: number;
  right: number;
}

// Counts the cells whose box lies fully inside the scroller box. `tolerance` (px) absorbs
// sub-pixel rounding at the edges. A cell without width is not counted (display:none).
export function countCellsFullyInside(
  cells: readonly HorizontalBox[],
  scroller: HorizontalBox,
  tolerance = 1,
): number {
  return cells.filter(
    (cell) =>
      cell.right - cell.left > 0 &&
      cell.left >= scroller.left - tolerance &&
      cell.right <= scroller.right + tolerance,
  ).length;
}

export interface AddOnRowSpread {
  top: number;
  cards: number;
  spread: number;
}

// Groups cards by their rounded top (one grid row each) and gives, per row, the card count and
// the height spread (tallest minus shortest, rounded to 0.01 px). Rows come sorted by top.
export function addOnRowSpreads(
  cards: readonly { top: number; height: number }[],
): AddOnRowSpread[] {
  const groups = new Map<number, number[]>();
  for (const card of cards) {
    const top = Math.round(card.top);
    groups.set(top, [...(groups.get(top) ?? []), card.height]);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([top, heights]) => ({
      top,
      cards: heights.length,
      spread: Math.round((Math.max(...heights) - Math.min(...heights)) * 100) / 100,
    }));
}

export interface VerticalBox {
  top: number;
  bottom: number;
}

// True when a sized box shares at least one pixel row with the viewport [0, viewportHeight].
export function intersectsViewport(box: VerticalBox, viewportHeight: number): boolean {
  return box.bottom > box.top && box.bottom > 0 && box.top < viewportHeight;
}
