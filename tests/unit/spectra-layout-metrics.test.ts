import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';
import { beforeAll, describe, expect, it } from 'vitest';
import { createPricingViewModel } from '../../src/core/index.js';
import type { PricingComparisonRow } from '../../src/core/index.js';
import { parsePricingYaml } from '../../src/yaml/index.js';

interface Longest {
  length: number;
  id: string;
}

interface GroupMetric {
  id: string;
  rows: number;
}

interface PricingMetrics {
  fixture: string;
  plans: number;
  addOns: number;
  rows: number;
  featureRows: number;
  usageLimitRows: number;
  groups: number;
  groupRows: GroupMetric[];
  longestGroup: GroupMetric;
  identicalInAllPlans: number;
  rowsAfterDifferencesOnly: number;
  addOnOnlyRows: number;
  addOnOnlyRowIds: string[];
  unitPluralCandidates: number;
  unitPluralExamples: string[];
  rowsWithoutDescription: number;
  rowsFillerDescription: number;
  plansWithoutDescription: number;
  plansFillerDescription: number;
  addOnsWithoutDescription: number;
  addOnsFillerDescription: number;
  longestRowName: Longest;
  longestDescription: Longest;
  longestStringCell: Longest;
  longestPlanName: Longest;
  longestAddOnName: Longest;
  plansMod3: number;
  plansMod2: number;
  orphanOn3Columns: boolean;
  orphanOn4Columns: boolean;
}

const fixturesRoot = fileURLToPath(new URL('../fixtures/spectra/', import.meta.url));
const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

function listFixtures(): string[] {
  const found: string[] = [];
  for (const saas of readdirSync(fixturesRoot, { withFileTypes: true })) {
    if (!saas.isDirectory()) continue;
    for (const file of readdirSync(join(fixturesRoot, saas.name))) {
      if (file.endsWith('.yml')) found.push(`tests/fixtures/spectra/${saas.name}/${file}`);
    }
  }
  return found.sort();
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, i) => deepEqual(item, right[i]));
  }
  if (left && right && typeof left === 'object' && typeof right === 'object') {
    const a = left as Record<string, unknown>;
    const b = right as Record<string, unknown>;
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((k) => deepEqual(a[k], b[k]));
  }
  return false;
}

// Same "empty" notion as renderValue: renders as an em dash.
function isEmptyCell(value: unknown): boolean {
  return value === false || value === null || value === undefined;
}

function unwrap(value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value) && 'value' in value) {
    return (value as { value: unknown }).value;
  }
  return value;
}

function isFiller(description: string | undefined, name: string): boolean {
  return (
    description !== undefined &&
    description.trim() !== '' &&
    description.trim().toLowerCase() === name.trim().toLowerCase()
  );
}

function isBlank(description: string | undefined): boolean {
  return description === undefined || description.trim() === '';
}

function longest(items: Array<{ id: string; text: string }>): Longest {
  let best: Longest = { length: 0, id: '' };
  for (const item of items) {
    if (item.text.length > best.length) best = { length: item.text.length, id: item.id };
  }
  return best;
}

function measure(fixture: string): PricingMetrics {
  const yaml = readFileSync(join(repoRoot, fixture), 'utf8');
  const parsed = parsePricingYaml(yaml);
  if (!parsed.value) throw new Error(`Cannot parse ${fixture}`);
  const viewModel = createPricingViewModel(parsed.value);

  const rows: PricingComparisonRow[] = viewModel.comparisonGroups.flatMap((group) => group.rows);
  const groupRows = viewModel.comparisonGroups.map((group) => ({
    id: group.id,
    rows: group.rows.length,
  }));
  let longestGroup: GroupMetric = { id: '', rows: 0 };
  for (const group of groupRows) if (group.rows > longestGroup.rows) longestGroup = group;

  const identical = rows.filter((row) => {
    const values = row.values.map((cell) => cell.value);
    return values.every((value) => deepEqual(value, values[0]));
  }).length;

  const addOnProvides = (row: PricingComparisonRow): boolean =>
    viewModel.addOns.some((addOn) => {
      if (row.kind === 'feature') {
        const value = unwrap(addOn.features[row.id]);
        return !isEmptyCell(value);
      }
      return (
        !isEmptyCell(unwrap(addOn.usageLimits[row.id])) ||
        !isEmptyCell(unwrap(addOn.usageLimitsExtensions[row.id]))
      );
    });
  const addOnOnly = rows.filter(
    (row) => row.values.every((cell) => isEmptyCell(cell.value)) && addOnProvides(row),
  );

  const unitRows: Array<{ row: PricingComparisonRow; example: string }> = [];
  for (const row of rows) {
    if (row.kind !== 'usage-limit' || !row.unit) continue;
    for (const cell of row.values) {
      if (typeof cell.value === 'number' && Number.isFinite(cell.value) && cell.value !== 1) {
        unitRows.push({
          row,
          example: `${row.id}: ${new Intl.NumberFormat('en-US').format(cell.value)} ${row.unit}`,
        });
        break;
      }
    }
  }

  const stringCells: Array<{ id: string; text: string }> = [];
  for (const row of rows) {
    for (const cell of row.values) {
      if (typeof cell.value === 'string') {
        stringCells.push({ id: `${row.id}@${cell.planId}`, text: cell.value });
      }
    }
  }

  const plans = viewModel.plans;
  const addOns = viewModel.addOns;

  return {
    fixture,
    plans: plans.length,
    addOns: addOns.length,
    rows: rows.length,
    featureRows: rows.filter((row) => row.kind === 'feature').length,
    usageLimitRows: rows.filter((row) => row.kind === 'usage-limit').length,
    groups: groupRows.length,
    groupRows,
    longestGroup,
    identicalInAllPlans: identical,
    rowsAfterDifferencesOnly: rows.length - identical,
    addOnOnlyRows: addOnOnly.length,
    addOnOnlyRowIds: addOnOnly.map((row) => row.id),
    unitPluralCandidates: unitRows.length,
    unitPluralExamples: unitRows.slice(0, 5).map((item) => item.example),
    rowsWithoutDescription: rows.filter((row) => isBlank(row.description)).length,
    rowsFillerDescription: rows.filter((row) => isFiller(row.description, row.name)).length,
    plansWithoutDescription: plans.filter((plan) => isBlank(plan.description)).length,
    plansFillerDescription: plans.filter((plan) => isFiller(plan.description, plan.name)).length,
    addOnsWithoutDescription: addOns.filter((addOn) => isBlank(addOn.description)).length,
    addOnsFillerDescription: addOns.filter((addOn) => isFiller(addOn.description, addOn.name))
      .length,
    longestRowName: longest(rows.map((row) => ({ id: row.id, text: row.name }))),
    longestDescription: longest([
      ...rows.map((row) => ({ id: `row:${row.id}`, text: row.description ?? '' })),
      ...plans.map((plan) => ({ id: `plan:${plan.id}`, text: plan.description ?? '' })),
      ...addOns.map((addOn) => ({ id: `addOn:${addOn.id}`, text: addOn.description ?? '' })),
    ]),
    longestStringCell: longest(stringCells),
    longestPlanName: longest(plans.map((plan) => ({ id: plan.id, text: plan.name }))),
    longestAddOnName: longest(addOns.map((addOn) => ({ id: addOn.id, text: addOn.name }))),
    plansMod3: plans.length % 3,
    plansMod2: plans.length % 2,
    orphanOn3Columns: plans.length > 1 && plans.length % 3 === 1,
    orphanOn4Columns: plans.length > 1 && plans.length % 4 === 1,
  };
}

function quantile(sorted: number[], q: number): number {
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (position - lower);
}

function summarize(metrics: PricingMetrics[]) {
  const totals = metrics.map((item) => item.rows).sort((a, b) => a - b);
  return {
    pricings: metrics.length,
    medianRows: quantile(totals, 0.5),
    firstQuartileRows: quantile(totals, 0.25),
    thirdQuartileRows: quantile(totals, 0.75),
    minRows: totals[0]!,
    maxRows: totals[totals.length - 1]!,
    over100Rows: totals.filter((total) => total > 100).length,
    withOneGroup: metrics.filter((item) => item.groups === 1).length,
    withTwoGroups: metrics.filter((item) => item.groups === 2).length,
    withOneOrTwoGroups: metrics.filter((item) => item.groups <= 2).length,
    orphanOn3Columns: metrics.filter((item) => item.orphanOn3Columns).length,
    orphanOn4Columns: metrics.filter((item) => item.orphanOn4Columns).length,
    orphanOn3Or4Columns: metrics.filter((item) => item.orphanOn3Columns || item.orphanOn4Columns)
      .length,
  };
}

describe('SPECTRA layout metrics', () => {
  let metrics: PricingMetrics[] = [];
  const byName = (saas: string): PricingMetrics =>
    metrics.find((item) => item.fixture.includes(`/${saas}/`))!;

  beforeAll(async () => {
    metrics = listFixtures().map(measure);
    const out = process.env.SPECTRA_METRICS_OUT;
    if (out) {
      const target = resolve(repoRoot, out);
      mkdirSync(dirname(target), { recursive: true });
      const document = { summary: summarize(metrics), pricings: metrics };
      // Formatted with the project's prettier configuration so the committed file is stable.
      const options = (await resolveConfig(target)) ?? {};
      const text = await format(JSON.stringify(document, null, 2), { ...options, parser: 'json' });
      writeFileSync(target, text);
    }
  });

  it('counts the rows of the parsed pricing that are not disabled', () => {
    expect(metrics).toHaveLength(37);
    for (const item of metrics) {
      const parsed = parsePricingYaml(readFileSync(join(repoRoot, item.fixture), 'utf8'));
      const pricing = parsed.value!;
      const rendered = (entries: Array<{ render: string }>): number =>
        entries.filter((entry) => entry.render !== 'disabled').length;
      expect(item.rows, item.fixture).toBe(
        rendered(pricing.features) + rendered(pricing.usageLimits),
      );
    }
  });

  it('reproduces the headline figures of the report', () => {
    const sum = (values: number[]): number => values.reduce((total, value) => total + value, 0);
    const withoutOkta = metrics.filter((item) => !item.fixture.includes('/okta/'));
    expect(sum(withoutOkta.map((item) => item.addOnOnlyRows))).toBe(166);
    expect(sum(metrics.map((item) => item.addOnOnlyRows))).toBe(307);
    expect(sum(metrics.map((item) => item.unitPluralCandidates))).toBe(255);
    const summary = summarize(metrics);
    expect(summary.orphanOn3Columns).toBe(17);
    expect(summary.orphanOn4Columns).toBe(5);
    expect(summary.orphanOn3Or4Columns).toBe(22);
  });

  // When the output variable is set, the file is regenerated first and the comparison is moot.
  it.skipIf(Boolean(process.env.SPECTRA_METRICS_OUT))('equals the committed metrics.json', () => {
    const committed = JSON.parse(
      readFileSync(join(repoRoot, 'docs/agent-work/visual-review-spectra/metrics.json'), 'utf8'),
    ) as unknown;
    const computed = JSON.parse(
      JSON.stringify({ summary: summarize(metrics), pricings: metrics }),
    ) as unknown;
    expect(committed).toEqual(computed);
  });

  it('reproduces the owner totals for the nine largest pricings', () => {
    const expected: Record<string, number> = {
      clickup: 174,
      zoom: 151,
      okta: 141,
      salesforce: 124,
      webflow: 118,
      postman: 112,
      canva: 106,
      dropbox: 103,
      deskera: 100,
    };
    for (const [saas, total] of Object.entries(expected)) {
      expect(byName(saas).rows, saas).toBe(total);
    }
    const largest = [...metrics]
      .sort((a, b) => b.rows - a.rows)
      .slice(0, 9)
      .map((item) => item.fixture.split('/')[3])
      .sort();
    expect(largest).toEqual(Object.keys(expected).sort());
    expect(metrics.filter((item) => item.rows >= 100)).toHaveLength(9);
    expect(byName('webflow').plans).toBe(15);
    expect(byName('okta').plans).toBe(0);
    expect(byName('okta').addOns).toBe(18);
  });

  it('states the median and the number of pricings with one or two groups', () => {
    const summary = summarize(metrics);
    expect(summary.medianRows).toBe(MEDIAN_ROWS);
    expect(summary.withOneOrTwoGroups).toBe(WITH_ONE_OR_TWO_GROUPS);
  });
});

// Measured values; the owner estimated a median of about 60 and "almost all" with 1-2 groups.
const MEDIAN_ROWS = 65;
const WITH_ONE_OR_TWO_GROUPS = 34;
