// Plan column rules of spectra item 8 (docs/agent-work/spectra-item8-grid/spec.md), shared by
// tests/browser/spectra-grid.spec.ts and tests/unit/plan-grid-columns.test.ts. Pure: it imports
// nothing, so vitest can load it.

// Maximum columns per container band from 840px; max is the width checked at the top of the band.
export const bands = [
  { name: '840-1039', min: 840, max: 1039, columns: 3 },
  { name: '1040-1279', min: 1040, max: 1279, columns: 4 },
  { name: '>=1280', min: 1280, max: 1600, columns: 4 },
] as const;

// Maximum columns for a container width: 1 below 600px, 2 from 600 to 839px, then the bands.
export function maxColumns(containerWidth: number): number {
  if (containerWidth < 600) return 1;
  const band = [...bands].reverse().find((candidate) => containerWidth >= candidate.min);
  return band ? band.columns : 2;
}

// Fewest rows, then the fullest last row, then the most columns, never a single card alone in the
// last of several rows; when every column count leaves one alone, the rule is waived (exempt).
export function expectedColumns(plans: number, max: number): number {
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

// Cards per row for a plan count at a container width.
export function expectedRows(plans: number, containerWidth: number): number[] {
  const max = maxColumns(containerWidth);
  // 1 or 2 plans sit in one row from 600px; the 600-839 band always uses 2 columns.
  const columns = max === 1 ? 1 : plans <= 2 ? plans : max === 2 ? 2 : expectedColumns(plans, max);
  const rows: number[] = [];
  for (let left = plans; left > 0; left -= columns) rows.push(Math.min(columns, left));
  return rows;
}

// Plan counts whose lone last card cannot be avoided in a band (see the spec).
export function exempt(plans: number, containerWidth: number): boolean {
  const max = maxColumns(containerWidth);
  if (max === 2) return true;
  if (max === 3) return plans === 7 || plans === 13;
  return plans === 13;
}
