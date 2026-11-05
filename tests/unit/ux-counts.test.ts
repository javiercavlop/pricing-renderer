import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createPricingViewModel, unwrapValue } from '../../src/core/index.js';
import type { NormalizedAddOn, PricingViewModel } from '../../src/core/index.js';
import type { PricingComparisonRow, PricingUnitLabels } from '../../src/core/types.js';
import { formatUnit } from '../../src/core/units.js';
import { isAddOnOnlyRow } from '../../src/core/view-model.js';
import { renderComparison } from '../../src/element/renderers.js';
import type { RenderActions, RenderState } from '../../src/element/renderers.js';
import { parsePricingYaml } from '../../src/yaml/index.js';
import { buildStressYaml, findStressFixture, stressFixtures } from '../fixtures/stress/build.js';

// 8 is a proposed threshold for the narrow layout, not a renderer value. (ADDON_VISIBLE_CAP in
// src/element/renderers.ts is also 8, but it caps add-on cards, not comparison rows.)
const COMPARISON_ROWS_PROPOSED_CAP = 8;
// The only real cap on comparison rows: group.rows.slice(0, 30) in src/element/renderers.ts.
const RENDERER_ROWS_CAP = 30;

const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));

interface UxCounts {
  fixture: string;
  plans: number;
  addOns: number;
  rows: number;
  groups: number;
  rowsAboveProposedCapInGroups: number;
  groupsAboveProposedCap: number;
  rowsAboveRendererCapInGroups: number;
  addOnOnlyRows: number;
  addOnOnlyRowsMisleading: number;
  addOnMarkerCellsMisleading: number;
  planDescriptionsMissing: number;
  planDescriptionsFiller: number;
  addOnDescriptionsMissing: number;
  addOnDescriptionsFiller: number;
  addOnsNotAvailableForSelectedPlan: number;
  // (a) units of numeric comparison cells. "Cells" are numeric cells of rows with a unit; "units"
  // are the distinct units of those cells, classified once each (see classifyUnit).
  numericUnitCells: number;
  singularCandidateCells: number;
  singularCandidateCellsChangedAt0: number;
  singularCandidateCellsChangedAt1: number;
  singularCandidateCellsChangedAt5: number;
  singularCandidateCellsUnchangedAtActualCount: number;
  unitsDistinct: number;
  unitsSingularCandidate: number;
  unitsLeftSlash: number;
  unitsLeftUpper: number;
  unitsLeftDigitOrSpace: number;
  unitsLeftTrailingS: number;
  unitsLeftOtherChars: number;
  unitsOverridden: number;
  // Singular candidates that stay as written under locale 'es'. Not part of the 'en' partition.
  unitsLeftNonEnglish: number;
  // (b) rows that mix empty and filled plan cells where an add-on provides the row, and all cells
  // rendered with the add-on marker.
  mixedRowsProvidedByAddOn: number;
  addOnMarkerCellsTotal: number;
  // (c) row descriptions. Plan and add-on descriptions keep their own fields above. The length
  // fields cover described rows only (neither missing nor filler), trimmed; the median is the
  // lower median, and 0 for an empty set.
  rowDescriptionsMissing: number;
  rowDescriptionsFiller: number;
  rowDescriptionsDescribed: number;
  rowDescriptionLengthMax: number;
  rowDescriptionLengthMedian: number;
}

function listFixtures(): string[] {
  const found = ['tests/fixtures/acme-pricing.yml'];
  const base = join(repoRoot, 'tests/fixtures/spectra');
  for (const entry of readdirSync(base, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    for (const file of readdirSync(join(base, entry.name))) {
      if (file.endsWith('.yml')) found.push(`tests/fixtures/spectra/${entry.name}/${file}`);
    }
  }
  return found.sort();
}

function isBlank(text: string | undefined): boolean {
  return text === undefined || text.trim() === '';
}

function isFiller(text: string | undefined, name: string): boolean {
  return !isBlank(text) && text!.trim().toLowerCase() === name.trim().toLowerCase();
}

function availableForPlan(addOn: NormalizedAddOn, planId: string | undefined): boolean {
  return addOn.availableFor.length === 0 || (!!planId && addOn.availableFor.includes(planId));
}

function providesRow(addOn: NormalizedAddOn, row: { id: string; kind: string }): boolean {
  const filled = (value: unknown): boolean => {
    const inner = unwrapValue(value);
    return inner !== false && inner !== null && inner !== undefined;
  };
  if (row.kind === 'feature') return filled(addOn.features[row.id]);
  return filled(addOn.usageLimits[row.id]) || filled(addOn.usageLimitsExtensions[row.id]);
}

function isEmptyCell(cell: { value: unknown }): boolean {
  const inner = unwrapValue(cell.value);
  return inner === false || inner === null || inner === undefined;
}

// Lower median, so it stays an integer for integer input. 0 for an empty set.
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)]!;
}

// ---- (a) units -------------------------------------------------------------------------------

type UnitReason =
  | 'override'
  | 'slash'
  | 'upper'
  | 'digitOrSpace'
  | 'trailingS'
  | 'otherChars'
  | 'singularCandidate';

// The override lookup restated from the documented order: exact tag, base language, then '*'; the
// later key wins. It does not call into src/core/units.ts.
function overrideFor(labels: PricingUnitLabels | undefined, unit: string, locale: string) {
  if (!labels) return undefined;
  for (const scope of [locale.toLowerCase(), locale.toLowerCase().split('-')[0]!, '*']) {
    const keys = Object.keys(labels).filter(
      (key) => key.replace(/_/g, '-').toLowerCase() === scope,
    );
    for (const key of keys.reverse()) {
      const units = labels[key];
      if (!units || !Object.prototype.hasOwnProperty.call(units, unit)) continue;
      const entry = units[unit] as { one?: unknown; other?: unknown } | undefined;
      const valid = (text: unknown) => typeof text === 'string' && text.trim() !== '';
      if (entry && valid(entry.one) && valid(entry.other)) return entry;
    }
  }
  return undefined;
}

// Why a unit is, or is not, expected to pluralize in English. Written from the documented rules,
// not from the code path of formatUnit; every unit gets exactly one reason (first match wins).
function classifyUnit(unit: string, labels: PricingUnitLabels | undefined): UnitReason {
  if (overrideFor(labels, unit, 'en')) return 'override';
  if (unit.includes('/')) return 'slash';
  if (/\p{Lu}/u.test(unit)) return 'upper';
  if (/[\s\d]/.test(unit)) return 'digitOrSpace';
  if (unit.endsWith('s')) return 'trailingS';
  if (!/^[a-z]+$/.test(unit)) return 'otherChars';
  return 'singularCandidate';
}

type UnitCounts = Pick<
  UxCounts,
  | 'numericUnitCells'
  | 'singularCandidateCells'
  | 'singularCandidateCellsChangedAt0'
  | 'singularCandidateCellsChangedAt1'
  | 'singularCandidateCellsChangedAt5'
  | 'singularCandidateCellsUnchangedAtActualCount'
  | 'unitsDistinct'
  | 'unitsSingularCandidate'
  | 'unitsLeftSlash'
  | 'unitsLeftUpper'
  | 'unitsLeftDigitOrSpace'
  | 'unitsLeftTrailingS'
  | 'unitsLeftOtherChars'
  | 'unitsOverridden'
  | 'unitsLeftNonEnglish'
>;

// Counts the units of numeric comparison cells and cross-checks formatUnit against classifyUnit.
// violations lists every disagreement; the invariants test expects none.
function auditUnits(viewModel: PricingViewModel): { counts: UnitCounts; violations: string[] } {
  const labels = viewModel.presentation.unitLabels;
  const cells = viewModel.comparisonGroups
    .flatMap((group) => group.rows)
    .flatMap((row) =>
      row.unit
        ? row.values.flatMap((cell) =>
            typeof cell.value === 'number' && Number.isFinite(cell.value)
              ? [{ unit: row.unit!, value: cell.value }]
              : [],
          )
        : [],
    );
  const reasons = new Map<string, UnitReason>();
  for (const { unit } of cells) reasons.set(unit, classifyUnit(unit, labels));
  const reasonOf = (unit: string): UnitReason => reasons.get(unit)!;
  const format = (unit: string, count: number, locale = 'en'): string =>
    formatUnit(unit, count, locale, labels);

  const violations: string[] = [];
  for (const [unit, reason] of reasons) {
    const note = (text: string): number => violations.push(`${unit} (${reason}): ${text}`);
    if (reason === 'override') {
      const entry = overrideFor(labels, unit, 'en')!;
      if (format(unit, 1) !== entry.one) note('override one expected at 1');
      if (format(unit, 0) !== entry.other) note('override other expected at 0');
      if (format(unit, 5) !== entry.other) note('override other expected at 5');
      continue;
    }
    if (format(unit, 1) !== unit) note('changed at 1');
    for (const count of [0, 5]) {
      const out = format(unit, count);
      if (reason !== 'singularCandidate') {
        if (out !== unit) note(`changed at ${count} to ${out}`);
      } else if (out === unit || !out.startsWith(unit.slice(0, -1))) {
        note(`not pluralized at ${count}: ${out}`);
      }
    }
    if (reason === 'singularCandidate' && !overrideFor(labels, unit, 'es')) {
      if (format(unit, 5, 'es') !== unit) note('changed under es');
    }
  }

  const unitsWith = (reason: UnitReason): number =>
    [...reasons.values()].filter((item) => item === reason).length;
  const candidates = cells.filter(({ unit }) => reasonOf(unit) === 'singularCandidate');
  const changedAt = (count: number): number =>
    candidates.filter(({ unit }) => format(unit, count) !== unit).length;
  const candidateUnits = [...reasons].filter(([, reason]) => reason === 'singularCandidate');
  const counts: UnitCounts = {
    numericUnitCells: cells.length,
    singularCandidateCells: candidates.length,
    singularCandidateCellsChangedAt0: changedAt(0),
    singularCandidateCellsChangedAt1: changedAt(1),
    singularCandidateCellsChangedAt5: changedAt(5),
    singularCandidateCellsUnchangedAtActualCount: candidates.filter(
      ({ unit, value }) => Math.abs(value) !== 1 && format(unit, value) === unit,
    ).length,
    unitsDistinct: reasons.size,
    unitsSingularCandidate: candidateUnits.length,
    unitsLeftSlash: unitsWith('slash'),
    unitsLeftUpper: unitsWith('upper'),
    unitsLeftDigitOrSpace: unitsWith('digitOrSpace'),
    unitsLeftTrailingS: unitsWith('trailingS'),
    unitsLeftOtherChars: unitsWith('otherChars'),
    unitsOverridden: unitsWith('override'),
    unitsLeftNonEnglish: candidateUnits.filter(
      ([unit]) => !overrideFor(labels, unit, 'es') && format(unit, 5, 'es') === unit,
    ).length,
  };
  return { counts, violations };
}

// ---- (c) row descriptions --------------------------------------------------------------------

// Mirrors rowDescription in src/element/renderers.ts: a blank description or one that only repeats
// the row name (trim + lowercase) is not rendered.
type RowDescriptionCounts = Pick<
  UxCounts,
  | 'rowDescriptionsMissing'
  | 'rowDescriptionsFiller'
  | 'rowDescriptionsDescribed'
  | 'rowDescriptionLengthMax'
  | 'rowDescriptionLengthMedian'
>;

function rowDescriptionCounts(rows: PricingComparisonRow[]): RowDescriptionCounts {
  const lengths: number[] = [];
  let missing = 0;
  let filler = 0;
  for (const row of rows) {
    if (isBlank(row.description)) missing += 1;
    else if (isFiller(row.description, row.name)) filler += 1;
    else lengths.push(row.description!.trim().length);
  }
  return {
    rowDescriptionsMissing: missing,
    rowDescriptionsFiller: filler,
    rowDescriptionsDescribed: lengths.length,
    rowDescriptionLengthMax: Math.max(0, ...lengths),
    rowDescriptionLengthMedian: median(lengths),
  };
}

// ---- TOTAL line ------------------------------------------------------------------------------

// Numeric fields are summed, except these: a sum of maxima or medians means nothing.
type Reducer = (items: UxCounts[]) => number;

const totalReducers: Partial<Record<keyof UxCounts, Reducer>> = {
  rowDescriptionLengthMax: (items) => Math.max(0, ...items.map((i) => i.rowDescriptionLengthMax)),
  // Median of the per-fixture medians, over fixtures that have a described row.
  rowDescriptionLengthMedian: (items) => {
    const withText = items.filter((i) => i.rowDescriptionsDescribed > 0);
    return median(withText.map((i) => i.rowDescriptionLengthMedian));
  },
};

function sumOf(key: keyof UxCounts): Reducer {
  return (items) => items.reduce((sum, item) => sum + (item[key] as number), 0);
}

function totalOf(items: UxCounts[]): Record<string, number | string> {
  const total: Record<string, number | string> = { fixture: 'TOTAL', fixtures: items.length };
  const keys = Object.keys(items[0] ?? {}) as (keyof UxCounts)[];
  for (const key of keys) {
    if (key === 'fixture') continue;
    total[key] = (totalReducers[key] ?? sumOf(key))(items);
  }
  return total;
}

const noop = (): void => undefined;
const actions: RenderActions = {
  selectPlan: noop,
  selectBilling: noop,
  updateVariable: noop,
  resetVariables: noop,
  toggleAddOn: noop,
  updateAddOnQuantity: noop,
  triggerAction: () => false,
  updateSearch: noop,
  updateOnlyDifferences: noop,
  toggleGroup: noop,
  setAllGroups: noop,
  revealGroup: noop,
  confirmAddOnChange: noop,
  cancelAddOnChange: noop,
  toggleBreakdown: noop,
};

function tableState(viewModel: PricingViewModel): RenderState {
  const all = new Set(viewModel.comparisonGroups.map((group) => group.id));
  return {
    viewModel,
    selection: viewModel.resolved.selection,
    compact: false,
    search: '',
    onlyDifferences: false,
    selectionEnabled: true,
    ctaEnabled: true,
    variablesEnabled: true,
    expandedGroups: all,
    revealedGroups: all,
    breakdownOpen: false,
    breakdownId: 'breakdown',
    actions,
  };
}

// Flattens a lit template (strings and values, nested templates and arrays) into plain text.
function flatten(template: unknown): string {
  if (Array.isArray(template)) return template.map(flatten).join('');
  if (typeof template === 'string' || typeof template === 'number') return String(template);
  if (typeof template === 'object' && template !== null && 'strings' in template) {
    const { strings, values } = template as { strings: string[]; values: unknown[] };
    return strings
      .map((text, index) => text + (index < values.length ? flatten(values[index]) : ''))
      .join('');
  }
  return '';
}

// Table-layout cells that show the "Add-on" marker (total), and those among them in a plan column
// where no add-on providing the row can be bought (misleading). Rows and rendered row chunks pair
// by position: every group is revealed.
function markerCells(viewModel: PricingViewModel): { total: number; misleading: number } {
  if (viewModel.plans.length === 0) return { total: 0, misleading: 0 };
  const rows = viewModel.comparisonGroups.flatMap((group) => group.rows);
  const chunks = flatten(renderComparison(tableState(viewModel)))
    .split('data-pr-part="comparison-row"')
    .slice(1);
  if (chunks.length !== rows.length) {
    throw new Error(`Rendered ${chunks.length} rows for ${rows.length} view-model rows`);
  }
  let total = 0;
  let misleading = 0;
  rows.forEach((row, position) => {
    const cells = chunks[position]!.split('<td').slice(1);
    row.values.forEach((cell, index) => {
      if (!cells[index]?.includes('pr-value--addon')) return;
      total += 1;
      const buyable = viewModel.addOns.some(
        (addOn) => providesRow(addOn, row) && availableForPlan(addOn, cell.planId),
      );
      if (!buyable) misleading += 1;
    });
  });
  return { total, misleading };
}

function rowsOver(groupSizes: number[], cap: number): number {
  return groupSizes.reduce((sum, n) => sum + Math.max(0, n - cap), 0);
}

interface Source {
  label: string;
  load: () => string;
}

function fileSource(fixture: string): Source {
  return { label: fixture, load: () => readFileSync(join(repoRoot, fixture), 'utf8') };
}

function buildViewModel(source: Source): PricingViewModel {
  const parsed = parsePricingYaml(source.load());
  if (!parsed.value) throw new Error(`Cannot parse ${source.label}`);
  return createPricingViewModel(parsed.value);
}

function countFixture(source: Source, viewModel = buildViewModel(source)): UxCounts {
  const fixture = source.label;
  const planId = viewModel.resolved.selection.planId;
  const rows = viewModel.comparisonGroups.flatMap((group) => group.rows);

  // A data property: add-on-only rows where no providing add-on can be bought on the selected plan,
  // that is, the rows the old R3 rule marked wrongly at the selected plan. It does not depend on how
  // the renderer draws the marker, so it stays above 0. The rendered cells are counted by
  // addOnMarkerCellsMisleading.
  const markerRows = rows.filter((row) => isAddOnOnlyRow(viewModel, row));
  const buyable = (row: { id: string; kind: string }): boolean =>
    viewModel.addOns.some((addOn) => providesRow(addOn, row) && availableForPlan(addOn, planId));
  const misleading = markerRows.filter((row) => !buyable(row));

  const { plans, addOns, comparisonGroups } = viewModel;
  const groupSizes = comparisonGroups.map((group) => group.rows.length);
  const count = <T>(items: T[], test: (item: T) => boolean): number => items.filter(test).length;
  const markers = markerCells(viewModel);
  // Not add-on-only (so not every cell is empty), but at least one empty and one filled plan cell,
  // and some add-on provides the row: the empty cells render '—' although an add-on fills the row.
  const mixedRows = rows.filter(
    (row) =>
      !isAddOnOnlyRow(viewModel, row) &&
      row.values.some(isEmptyCell) &&
      !row.values.every(isEmptyCell) &&
      viewModel.addOns.some((addOn) => providesRow(addOn, row)),
  );

  return {
    fixture,
    plans: plans.length,
    addOns: addOns.length,
    rows: rows.length,
    groups: groupSizes.length,
    rowsAboveProposedCapInGroups: rowsOver(groupSizes, COMPARISON_ROWS_PROPOSED_CAP),
    groupsAboveProposedCap: count(groupSizes, (n) => n > COMPARISON_ROWS_PROPOSED_CAP),
    rowsAboveRendererCapInGroups: rowsOver(groupSizes, RENDERER_ROWS_CAP),
    addOnOnlyRows: markerRows.length,
    addOnOnlyRowsMisleading: misleading.length,
    addOnMarkerCellsMisleading: markers.misleading,
    planDescriptionsMissing: count(plans, (plan) => isBlank(plan.description)),
    planDescriptionsFiller: count(plans, (plan) => isFiller(plan.description, plan.name)),
    addOnDescriptionsMissing: count(addOns, (addOn) => isBlank(addOn.description)),
    addOnDescriptionsFiller: count(addOns, (addOn) => isFiller(addOn.description, addOn.name)),
    addOnsNotAvailableForSelectedPlan: count(addOns, (addOn) => !availableForPlan(addOn, planId)),
    ...auditUnits(viewModel).counts,
    mixedRowsProvidedByAddOn: mixedRows.length,
    addOnMarkerCellsTotal: markers.total,
    ...rowDescriptionCounts(rows),
  };
}

const fileSources = listFixtures().map(fileSource);
const stressSources: Source[] = stressFixtures.map((fixture) => ({
  label: `stress:${fixture.id}`,
  load: () => buildStressYaml(findStressFixture(fixture.id)),
}));
const sources = [...fileSources, ...stressSources];
const fixtures = sources.map((source) => source.label);
const counts = sources.map((source) => countFixture(source));

function countsFor(label: string): UxCounts {
  const found = counts.find((item) => item.fixture === label);
  if (!found) throw new Error(`No counts for ${label}`);
  return found;
}

describe('UX-2 unit-level counts', () => {
  it('prints one UX_COUNTS line per committed fixture', () => {
    expect(fixtures.length).toBeGreaterThan(1);
    for (const item of counts) console.info(`UX_COUNTS ${JSON.stringify(item)}`);
    console.info(`UX_COUNTS ${JSON.stringify(totalOf(counts))}`);
    expect(counts).toHaveLength(fixtures.length);
  });

  it('keeps every count a non-negative integer', () => {
    for (const item of counts) {
      for (const [key, value] of Object.entries(item)) {
        if (key === 'fixture') continue;
        expect(Number.isInteger(value), `${item.fixture} ${key}`).toBe(true);
        expect(value as number, `${item.fixture} ${key}`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('keeps the totals consistent', () => {
    for (const item of counts) {
      const label = item.fixture;
      expect(item.addOnOnlyRowsMisleading, label).toBeLessThanOrEqual(item.addOnOnlyRows);
      expect(item.addOnOnlyRows, label).toBeLessThanOrEqual(item.rows);
      expect(item.groupsAboveProposedCap, label).toBeLessThanOrEqual(item.groups);
      expect(item.rowsAboveProposedCapInGroups, label).toBeLessThanOrEqual(item.rows);
      expect(item.rowsAboveRendererCapInGroups, label).toBeLessThanOrEqual(
        item.rowsAboveProposedCapInGroups,
      );
      const planText = item.planDescriptionsMissing + item.planDescriptionsFiller;
      const addOnText = item.addOnDescriptionsMissing + item.addOnDescriptionsFiller;
      expect(planText, label).toBeLessThanOrEqual(item.plans);
      expect(addOnText, label).toBeLessThanOrEqual(item.addOns);
      expect(item.addOnsNotAvailableForSelectedPlan, label).toBeLessThanOrEqual(item.addOns);

      // (b) mixed rows exclude add-on-only rows; markers appear in add-on-only rows only, at most
      // one per plan. There is no lower bound: a marker needs a buyable providing add-on.
      expect(item.mixedRowsProvidedByAddOn + item.addOnOnlyRows, label).toBeLessThanOrEqual(
        item.rows,
      );
      expect(item.addOnMarkerCellsMisleading, label).toBeLessThanOrEqual(
        item.addOnMarkerCellsTotal,
      );
      expect(item.addOnMarkerCellsTotal, label).toBeLessThanOrEqual(
        item.addOnOnlyRows * item.plans,
      );

      // (c) every row is missing, filler or described.
      expect(
        item.rowDescriptionsMissing + item.rowDescriptionsFiller + item.rowDescriptionsDescribed,
        label,
      ).toBe(item.rows);
      expect(item.rowDescriptionLengthMax, label).toBeGreaterThanOrEqual(
        item.rowDescriptionLengthMedian,
      );
      expect(item.rowDescriptionLengthMedian, label).toBeGreaterThanOrEqual(0);
      if (item.rowDescriptionsDescribed === 0) expect(item.rowDescriptionLengthMax, label).toBe(0);

      // (a) the reasons partition the distinct units; candidates are a subset of the cells.
      expect(
        item.unitsSingularCandidate +
          item.unitsLeftSlash +
          item.unitsLeftUpper +
          item.unitsLeftDigitOrSpace +
          item.unitsLeftTrailingS +
          item.unitsLeftOtherChars +
          item.unitsOverridden,
        label,
      ).toBe(item.unitsDistinct);
      expect(item.unitsDistinct, label).toBeLessThanOrEqual(item.numericUnitCells);
      expect(item.singularCandidateCells, label).toBeLessThanOrEqual(item.numericUnitCells);
      expect(item.unitsLeftNonEnglish, label).toBeLessThanOrEqual(item.unitsSingularCandidate);
      // Singular candidates pluralize at 0 and 5, stay at 1, and never stay at another count.
      expect(item.singularCandidateCellsChangedAt0, label).toBe(item.singularCandidateCells);
      expect(item.singularCandidateCellsChangedAt5, label).toBe(item.singularCandidateCells);
      expect(item.singularCandidateCellsChangedAt1, label).toBe(0);
      expect(item.singularCandidateCellsUnchangedAtActualCount, label).toBe(0);
    }
  });

  it('agrees with formatUnit for every distinct unit of every fixture', () => {
    for (const source of sources) {
      expect(auditUnits(buildViewModel(source)).violations, source.label).toEqual([]);
    }
  });

  it('keeps the maximum and median out of the sum in the TOTAL line', () => {
    const base = counts[0]!;
    const item = (
      rowDescriptionsDescribed: number,
      rowDescriptionLengthMax: number,
      rowDescriptionLengthMedian: number,
    ): UxCounts => ({
      ...base,
      rows: 4,
      rowDescriptionsDescribed,
      rowDescriptionLengthMax,
      rowDescriptionLengthMedian,
    });
    const total = totalOf([item(3, 10, 4), item(0, 0, 0), item(2, 20, 8), item(1, 7, 6)]);
    expect(total.rows).toBe(16);
    expect(total.rowDescriptionsDescribed).toBe(6);
    expect(total.rowDescriptionLengthMax).toBe(20);
    expect(total.rowDescriptionLengthMedian).toBe(6);
    expect(totalOf([item(0, 0, 0)]).rowDescriptionLengthMedian).toBe(0);
  });

  it('is deterministic', () => {
    expect(sources.map((source) => countFixture(source))).toEqual(counts);
  }, 60_000);

  it('renders no add-on marker cell in a plan that cannot buy a providing add-on', () => {
    for (const item of counts) {
      expect(item.addOnMarkerCellsMisleading, item.fixture).toBe(0);
    }
  });

  it('counts the acme fixture as known values', () => {
    const acme = countsFor('tests/fixtures/acme-pricing.yml');
    expect({ plans: acme.plans, addOns: acme.addOns, rows: acme.rows }).toEqual({
      plans: 3,
      addOns: 3,
      rows: 5,
    });
  });

  it('backs every add-on marker row with a providing add-on that agrees with the view model', () => {
    for (const source of sources) {
      const viewModel = buildViewModel(source);
      const rows = viewModel.comparisonGroups.flatMap((group) => group.rows);
      const markerRows = rows.filter((row) => isAddOnOnlyRow(viewModel, row));
      const provided = (row: { id: string; kind: string }): boolean =>
        viewModel.addOns.some((addOn) => providesRow(addOn, row));
      for (const row of markerRows) {
        expect(provided(row), `${source.label} ${row.id}`).toBe(true);
      }
      // Independent definition: every plan cell empty and some add-on provides the row.
      const expected = rows.filter((row) => row.values.every(isEmptyCell) && provided(row));
      const actualIds = markerRows.map((row) => row.id);
      expect(actualIds, source.label).toEqual(expected.map((row) => row.id));
    }
  });

  it('counts units, mixed rows and row descriptions on a hand-built pricing', () => {
    const described = {
      mixed: 'A mixed row that an add-on completes.',
      seats: 'How many people can join each workspace.',
      calls: 'API calls per month.',
      projects: 'Active projects.',
    };
    const usage = (name: string, unit: string, description?: string): string =>
      [
        `  ${name}:`,
        `    name: ${name[0]!.toUpperCase()}${name.slice(1)}`,
        ...(description ? [`    description: ${description}`] : []),
        '    valueType: NUMERIC',
        '    defaultValue: 1',
        `    unit: ${unit}`,
      ].join('\n');
    const planUsage = (plan: string): string =>
      ['seats', 'storage', 'transfer', 'calls', 'projects', 'cards']
        .map((id) => `      ${id}:\n        value: ${plan === 'small' ? 3 : 10}`)
        .join('\n');
    const feature = (id: string, name: string, description?: string): string =>
      [
        `  ${id}:`,
        `    name: ${name}`,
        ...(description ? [`    description: ${description}`] : []),
        '    valueType: BOOLEAN',
        '    defaultValue: false',
      ].join('\n');
    const yaml = `syntaxVersion: '3.1'
saasName: Known Counts
version: '1'
createdAt: '2026-11-04'
currency: EUR
features:
${feature('shared', 'Shared docs', 'shared DOCS ')}
${feature('mixed', 'Mixed', described.mixed)}
${feature('bare', 'Bare')}
${feature('extra', 'Extra')}
usageLimits:
${usage('seats', 'seat', described.seats)}
${usage('storage', 'GB')}
${usage('transfer', 'pack/month', 'Transfer')}
${usage('calls', 'calls', described.calls)}
${usage('projects', 'project', described.projects)}
${usage('cards', 'gift card')}
plans:
  small:
    price: 5
    unit: month
    features:
      shared:
        value: true
      mixed:
        value: true
      bare:
        value: true
    usageLimits:
${planUsage('small')}
  large:
    price: 9
    unit: month
    features:
      shared:
        value: true
      bare:
        value: true
    usageLimits:
${planUsage('large')}
addOns:
  helper:
    price: 3
    unit: month
    features:
      mixed:
        value: true
      extra:
        value: true
custom:
  pricingRenderer:
    unitLabels:
      en:
        project:
          one: project
          other: projects
`;
    const viewModel = createPricingViewModel(parsePricingYaml(yaml).value!);
    const item = countFixture({ label: 'known', load: () => yaml }, viewModel);
    const lengths = Object.values(described).map((text) => text.length);
    expect(item).toMatchObject({
      plans: 2,
      addOns: 1,
      rows: 10,
      // rows: shared (filler), bare/storage/cards/extra (missing), transfer (filler), four described
      rowDescriptionsMissing: 4,
      rowDescriptionsFiller: 2,
      rowDescriptionsDescribed: 4,
      rowDescriptionLengthMax: Math.max(...lengths),
      rowDescriptionLengthMedian: [...lengths].sort((a, b) => a - b)[1],
      // mixed is filled in small only; extra is add-on-only (shown with the marker in both plans)
      mixedRowsProvidedByAddOn: 1,
      addOnOnlyRows: 1,
      addOnMarkerCellsTotal: 2,
      addOnMarkerCellsMisleading: 0,
      // six units, twelve numeric cells; seat is the only singular candidate
      numericUnitCells: 12,
      unitsDistinct: 6,
      unitsSingularCandidate: 1,
      unitsLeftUpper: 1,
      unitsLeftSlash: 1,
      unitsLeftTrailingS: 1,
      unitsLeftDigitOrSpace: 1,
      unitsOverridden: 1,
      unitsLeftOtherChars: 0,
      unitsLeftNonEnglish: 1,
      singularCandidateCells: 2,
      singularCandidateCellsChangedAt0: 2,
      singularCandidateCellsChangedAt1: 0,
      singularCandidateCellsChangedAt5: 2,
      singularCandidateCellsUnchangedAtActualCount: 0,
    });
    expect(formatUnit('seat', 0, 'en')).toBe('seats');
    expect(formatUnit('seat', 1, 'en')).toBe('seat');
    expect(formatUnit('seat', 5, 'en')).toBe('seats');
    expect(auditUnits(viewModel).violations).toEqual([]);
  });

  it('counts the stress fixtures as built', () => {
    expect(stressSources).not.toHaveLength(0);
    for (const fixture of stressFixtures) {
      const item = countsFor(`stress:${fixture.id}`);
      expect(item.plans, fixture.id).toBe(fixture.counts.plans);
      expect(item.addOns, fixture.id).toBe(fixture.counts.addOns);
      expect(item.rows, fixture.id).toBe(fixture.counts.features + fixture.counts.usageLimits);
    }
  });
});
