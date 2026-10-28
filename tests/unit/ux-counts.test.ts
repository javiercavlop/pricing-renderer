import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createPricingViewModel, unwrapValue } from '../../src/core/index.js';
import type { NormalizedAddOn, PricingViewModel } from '../../src/core/index.js';
import { isAddOnOnlyRow } from '../../src/core/view-model.js';
import { parsePricingYaml } from '../../src/yaml/index.js';

// Same value as ADDON_VISIBLE_CAP in src/element/renderers.ts: the narrow cap of visible cards.
const NARROW_CAP = 8;

const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));

interface UxCounts {
  fixture: string;
  plans: number;
  addOns: number;
  rows: number;
  groups: number;
  rowsAboveNarrowCapInGroups: number;
  groupsAboveNarrowCap: number;
  addOnOnlyRows: number;
  addOnOnlyRowsMisleading: number;
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

function countFixture(fixture: string): UxCounts {
  const parsed = parsePricingYaml(readFileSync(join(repoRoot, fixture), 'utf8'));
  if (!parsed.value) throw new Error(`Cannot parse ${fixture}`);
  const viewModel: PricingViewModel = createPricingViewModel(parsed.value);
  const planId = viewModel.resolved.selection.planId;
  const rows = viewModel.comparisonGroups.flatMap((group) => group.rows);

  // A marker is misleading when no add-on that provides the row can be bought on the selected plan.
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
    rowsAboveNarrowCapInGroups: groupSizes.reduce((sum, n) => sum + Math.max(0, n - NARROW_CAP), 0),
    groupsAboveNarrowCap: count(groupSizes, (n) => n > NARROW_CAP),
    addOnOnlyRows: markerRows.length,
    addOnOnlyRowsMisleading: misleading.length,
    planDescriptionsMissing: count(plans, (plan) => isBlank(plan.description)),
    planDescriptionsFiller: count(plans, (plan) => isFiller(plan.description, plan.name)),
    addOnDescriptionsMissing: count(addOns, (addOn) => isBlank(addOn.description)),
    addOnDescriptionsFiller: count(addOns, (addOn) => isFiller(addOn.description, addOn.name)),
    addOnsNotAvailableForSelectedPlan: count(addOns, (addOn) => !availableForPlan(addOn, planId)),
  };
}

const fixtures = listFixtures();
const counts = fixtures.map(countFixture);

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
      expect(item.groupsAboveNarrowCap, label).toBeLessThanOrEqual(item.groups);
      expect(item.rowsAboveNarrowCapInGroups, label).toBeLessThanOrEqual(item.rows);
      const planText = item.planDescriptionsMissing + item.planDescriptionsFiller;
      const addOnText = item.addOnDescriptionsMissing + item.addOnDescriptionsFiller;
      expect(planText, label).toBeLessThanOrEqual(item.plans);
      expect(addOnText, label).toBeLessThanOrEqual(item.addOns);
      expect(item.addOnsNotAvailableForSelectedPlan, label).toBeLessThanOrEqual(item.addOns);
    }
  });

  it('is deterministic', () => {
    expect(fixtures.map(countFixture)).toEqual(counts);
  });
});
