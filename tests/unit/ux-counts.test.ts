import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createPricingViewModel, unwrapValue } from '../../src/core/index.js';
import type { NormalizedAddOn, PricingViewModel } from '../../src/core/index.js';
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

// Table-layout cells that show the "Add-on" marker in a plan column where no add-on providing the
// row can be bought. Rows and rendered row chunks pair by position: every group is revealed.
function markerCellsMisleading(viewModel: PricingViewModel): number {
  if (viewModel.plans.length === 0) return 0;
  const rows = viewModel.comparisonGroups.flatMap((group) => group.rows);
  const chunks = flatten(renderComparison(tableState(viewModel)))
    .split('data-pr-part="comparison-row"')
    .slice(1);
  if (chunks.length !== rows.length) {
    throw new Error(`Rendered ${chunks.length} rows for ${rows.length} view-model rows`);
  }
  let misleading = 0;
  rows.forEach((row, position) => {
    const cells = chunks[position]!.split('<td').slice(1);
    row.values.forEach((cell, index) => {
      if (!cells[index]?.includes('pr-value--addon')) return;
      const buyable = viewModel.addOns.some(
        (addOn) => providesRow(addOn, row) && availableForPlan(addOn, cell.planId),
      );
      if (!buyable) misleading += 1;
    });
  });
  return misleading;
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
    addOnMarkerCellsMisleading: markerCellsMisleading(viewModel),
    planDescriptionsMissing: count(plans, (plan) => isBlank(plan.description)),
    planDescriptionsFiller: count(plans, (plan) => isFiller(plan.description, plan.name)),
    addOnDescriptionsMissing: count(addOns, (addOn) => isBlank(addOn.description)),
    addOnDescriptionsFiller: count(addOns, (addOn) => isFiller(addOn.description, addOn.name)),
    addOnsNotAvailableForSelectedPlan: count(addOns, (addOn) => !availableForPlan(addOn, planId)),
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
    const totals: Record<string, number> = {};
    for (const item of counts) {
      for (const [key, value] of Object.entries(item)) {
        if (typeof value === 'number') totals[key] = (totals[key] ?? 0) + value;
      }
    }
    const total = { fixture: 'TOTAL', fixtures: counts.length, ...totals };
    console.info(`UX_COUNTS ${JSON.stringify(total)}`);
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
    }
  });

  it('is deterministic', () => {
    expect(sources.map((source) => countFixture(source))).toEqual(counts);
  }, 60_000);

  // [utest->req~addon-marker-per-plan-availability~1]
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
      const emptyCell = (cell: { value: unknown }): boolean => {
        const inner = unwrapValue(cell.value);
        return inner === false || inner === null || inner === undefined;
      };
      const expected = rows.filter((row) => row.values.every(emptyCell) && provided(row));
      const actualIds = markerRows.map((row) => row.id);
      expect(actualIds, source.label).toEqual(expected.map((row) => row.id));
    }
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
