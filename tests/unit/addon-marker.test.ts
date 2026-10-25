import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import * as core from '../../src/core/index.js';
import { createPricingViewModel, getMessages } from '../../src/core/index.js';
import type {
  PricingComparisonRow,
  PricingViewModel,
  ViewModelOptions,
} from '../../src/core/index.js';
import { isAddOnOnlyRow } from '../../src/core/view-model.js';
import { renderAddOns, renderComparison, renderPlans } from '../../src/element/renderers.js';
import type { RenderActions, RenderState } from '../../src/element/renderers.js';
import { parsePricingYaml } from '../../src/yaml/index.js';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const fixturesRoot = join(repoRoot, 'tests/fixtures/spectra');

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

function stateFor(viewModel: PricingViewModel, compact = false): RenderState {
  const all = new Set(viewModel.comparisonGroups.map((group) => group.id));
  return {
    viewModel,
    selection: viewModel.resolved.selection,
    compact,
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

function viewModelFromYaml(
  yaml: string,
  options: ViewModelOptions = {},
  locale?: string,
): PricingViewModel {
  const parsed = parsePricingYaml(yaml);
  if (!parsed.value) {
    throw new Error(`Cannot parse the pricing: ${JSON.stringify(parsed.diagnostics)}`);
  }
  const viewModel = createPricingViewModel(parsed.value, undefined, options);
  return locale ? { ...viewModel, messages: getMessages(locale) } : viewModel;
}

function rowsOf(viewModel: PricingViewModel): PricingComparisonRow[] {
  return viewModel.comparisonGroups.flatMap((group) => group.rows);
}

function rowById(viewModel: PricingViewModel, id: string): PricingComparisonRow {
  const row = rowsOf(viewModel).find((candidate) => candidate.id === id);
  if (!row) throw new Error(`No row ${id}`);
  return row;
}

// Both layouts mark every comparison row with this attribute; the first chunk is the preamble.
function rowChunks(text: string): string[] {
  return text.split('data-pr-part="comparison-row"').slice(1);
}

function chunkFor(text: string, name: string): string {
  const chunk = rowChunks(text).find((candidate) => candidate.includes(name));
  if (!chunk) throw new Error(`No rendered row ${name}`);
  return chunk;
}

function count(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

const MARKER = /pr-value--addon/g;
const EXCLUDED = /pr-value--excluded/g;

const INLINE = `
syntaxVersion: '3.1'
saasName: Marker Co
version: '2026.01'
createdAt: '2026-01-01'
currency: EUR
features:
  alpha:
    name: Row Alpha
    tag: Group
    valueType: BOOLEAN
    defaultValue: false
  bravo:
    name: Row Bravo
    tag: Group
    valueType: BOOLEAN
    defaultValue: false
  charlie:
    name: Row Charlie
    tag: Group
    valueType: BOOLEAN
    defaultValue: false
  delta:
    name: Row Delta
    tag: Group
    valueType: BOOLEAN
    defaultValue: false
  echo:
    name: Row Echo
    tag: Group
    valueType: BOOLEAN
    defaultValue: false
  echoPlain:
    name: Row Zulu
    tag: Group
    valueType: BOOLEAN
    defaultValue: false
  foxtrot:
    name: Row Foxtrot
    tag: Group
    valueType: BOOLEAN
    defaultValue: false
  golf:
    name: Row Golf
    tag: Group
    valueType: BOOLEAN
    defaultValue: false
usageLimits:
  hotel:
    name: Row Hotel
    tag: Usage
    type: renewable
    period: monthly
    valueType: NUMERIC
    defaultValue: null
    unit: GB
  india:
    name: Row India
    tag: Usage
    type: renewable
    period: monthly
    valueType: NUMERIC
    defaultValue: null
    unit: GB
  juliet:
    name: Row Juliet
    tag: Usage
    type: renewable
    period: monthly
    valueType: NUMERIC
    defaultValue: null
    unit: GB
plans:
  one:
    name: Plan One
    price: 10
    unit: month
    features:
      bravo:
        value: true
      charlie:
        value: true
  two:
    name: Plan Two
    price: 20
    unit: month
    features:
      charlie:
        value: false
addOns:
  booster:
    name: Booster
    availableFor:
      - one
      - two
    price: 5
    unit: month
    features:
      alpha:
        value: true
      bravo:
        value: true
      echo:
        value: false
      echoPlain: false
      golf:
        value: null
    usageLimits:
      hotel:
        value: 100
    usageLimitsExtensions:
      india:
        value: 5
  secret:
    name: Secret
    private: true
    availableFor:
      - one
      - two
    price: 7
    unit: month
    features:
      foxtrot:
        value: true
`;

const ADD_ON_ONLY = ['alpha', 'hotel', 'india'];
const NOT_ADD_ON_ONLY = [
  'bravo',
  'charlie',
  'delta',
  'echo',
  'echoPlain',
  'foxtrot',
  'golf',
  'juliet',
];

describe('isAddOnOnlyRow', () => {
  const viewModel = viewModelFromYaml(INLINE);

  it('parses the inline pricing with two public plans and the public add-on only', () => {
    expect(viewModel.plans.map((plan) => plan.id)).toEqual(['one', 'two']);
    expect(viewModel.addOns.map((addOn) => addOn.id)).toEqual(['booster']);
    expect(rowsOf(viewModel)).toHaveLength(ADD_ON_ONLY.length + NOT_ADD_ON_ONLY.length);
  });

  it('is true for a feature, usage limit and extension only an add-on provides', () => {
    for (const id of ADD_ON_ONLY) {
      expect(isAddOnOnlyRow(viewModel, rowById(viewModel, id)), id).toBe(true);
    }
    expect(rowById(viewModel, 'alpha').kind).toBe('feature');
    expect(rowById(viewModel, 'hotel').kind).toBe('usage-limit');
    expect(rowById(viewModel, 'india').kind).toBe('usage-limit');
  });

  it('is false for rows a plan includes or nobody provides', () => {
    for (const id of NOT_ADD_ON_ONLY) {
      expect(isAddOnOnlyRow(viewModel, rowById(viewModel, id)), id).toBe(false);
    }
  });

  it('is false for a row where one plan is true and another false', () => {
    const row = rowById(viewModel, 'charlie');
    expect(row.values.map((cell) => cell.value)).toEqual([true, false]);
    expect(isAddOnOnlyRow(viewModel, row)).toBe(false);
  });

  it('is false for a row provided by a plan and an add-on', () => {
    const row = rowById(viewModel, 'bravo');
    expect(row.values.map((cell) => cell.value)).toEqual([true, false]);
    expect(isAddOnOnlyRow(viewModel, row)).toBe(false);
  });

  it('ignores an add-on whose value is false (wrapped or plain) or null', () => {
    expect(isAddOnOnlyRow(viewModel, rowById(viewModel, 'echo'))).toBe(false);
    expect(isAddOnOnlyRow(viewModel, rowById(viewModel, 'echoPlain'))).toBe(false);
    expect(isAddOnOnlyRow(viewModel, rowById(viewModel, 'golf'))).toBe(false);
  });

  it('hides a private add-on unless the visibility is all', () => {
    expect(isAddOnOnlyRow(viewModel, rowById(viewModel, 'foxtrot'))).toBe(false);
    const everything = viewModelFromYaml(INLINE, { visibility: 'all' });
    expect(everything.addOns.map((addOn) => addOn.id)).toEqual(['booster', 'secret']);
    expect(isAddOnOnlyRow(everything, rowById(everything, 'foxtrot'))).toBe(true);
  });
});

describe('add-on only marker in the comparison', () => {
  const viewModel = viewModelFromYaml(INLINE);

  for (const compact of [false, true]) {
    const layout = compact ? 'compact' : 'table';

    it(`marks every plan cell of an add-on-only row (${layout})`, () => {
      const text = flatten(renderComparison(stateFor(viewModel, compact)));
      for (const name of ['Row Alpha', 'Row Hotel', 'Row India']) {
        const chunk = chunkFor(text, name);
        expect(count(chunk, MARKER), name).toBe(viewModel.plans.length);
        expect(count(chunk, /class="pr-value pr-value--addon"/g), name).toBe(2);
        expect(count(chunk, /aria-hidden="true">\s*Add-on\s*<\/span/g), name).toBe(2);
        expect(count(chunk, /pr-sr-only">\s*Available as add-on\s*<\/span/g), name).toBe(2);
        expect(chunk, name).not.toContain('pr-value--excluded');
        expect(chunk, name).not.toContain('Not included');
        expect(chunk, name).not.toContain('—');
      }
    });

    it(`keeps the em dash in every other empty cell (${layout})`, () => {
      const text = flatten(renderComparison(stateFor(viewModel, compact)));
      const expectedDashes: Record<string, number> = {
        'Row Bravo': 1,
        'Row Charlie': 1,
        'Row Delta': 2,
        'Row Echo': 2,
        'Row Zulu': 2,
        'Row Foxtrot': 2,
        'Row Golf': 2,
        'Row Juliet': 2,
      };
      for (const [name, dashes] of Object.entries(expectedDashes)) {
        const chunk = chunkFor(text, name);
        expect(count(chunk, EXCLUDED), name).toBe(dashes);
        expect(count(chunk, /Not included/g), name).toBe(dashes);
        expect(count(chunk, MARKER), name).toBe(0);
      }
    });

    it(`renders exactly three marker rows and no other marker (${layout})`, () => {
      const text = flatten(renderComparison(stateFor(viewModel, compact)));
      expect(count(text, MARKER)).toBe(ADD_ON_ONLY.length * viewModel.plans.length);
    });

    it(`marks the private add-on row when the visibility is all (${layout})`, () => {
      const everything = viewModelFromYaml(INLINE, { visibility: 'all' });
      const text = flatten(renderComparison(stateFor(everything, compact)));
      expect(count(chunkFor(text, 'Row Foxtrot'), MARKER)).toBe(everything.plans.length);
    });
  }

  it('localizes the marker with the es catalog', () => {
    const spanish = viewModelFromYaml(INLINE, {}, 'es');
    const text = flatten(renderComparison(stateFor(spanish)));
    const chunk = chunkFor(text, 'Row Alpha');
    expect(count(chunk, /aria-hidden="true">\s*Complemento\s*<\/span/g)).toBe(2);
    expect(count(chunk, /pr-sr-only">\s*Disponible como complemento\s*<\/span/g)).toBe(2);
    expect(chunk).not.toContain('Add-on');
  });

  it('does not mark the demo pricing, which has no add-on-only row', () => {
    const source = readFileSync(join(repoRoot, 'tests/fixtures/acme-pricing.yml'), 'utf8');
    const acme = viewModelFromYaml(source);
    expect(rowsOf(acme).filter((row) => isAddOnOnlyRow(acme, row))).toHaveLength(0);
    for (const compact of [false, true]) {
      expect(flatten(renderComparison(stateFor(acme, compact)))).not.toContain('pr-value--addon');
    }
  });
});

describe('i18n keys', () => {
  it('defines the English texts', () => {
    const messages = getMessages('en-US');
    expect(messages['pricing.addOnOnly']).toBe('Add-on');
    expect(messages['pricing.addOnOnlySr']).toBe('Available as add-on');
  });

  it('defines the Spanish texts', () => {
    const messages = getMessages('es');
    expect(messages['pricing.addOnOnly']).toBe('Complemento');
    expect(messages['pricing.addOnOnlySr']).toBe('Disponible como complemento');
  });
});

describe('no public API change', () => {
  it('does not re-export isAddOnOnlyRow from the core entry point', () => {
    expect('isAddOnOnlyRow' in core).toBe(false);
    const entry = readFileSync(join(repoRoot, 'src/core/index.ts'), 'utf8');
    expect(entry).not.toContain('isAddOnOnlyRow');
  });

  it('exports isAddOnOnlyRow from the view model module', () => {
    expect(typeof isAddOnOnlyRow).toBe('function');
  });

  it('keeps the comparison row shape', () => {
    const allowed = 'id kind name description category unit docUrl values raw'.split(' ');
    for (const row of rowsOf(viewModelFromYaml(INLINE))) {
      const extra = Object.keys(row).filter((key) => !allowed.includes(key));
      expect(extra, row.id).toEqual([]);
    }
  });

  for (const compact of [false, true]) {
    it(`renders the marker with no extra attribute (compact=${compact})`, () => {
      const viewModel = viewModelFromYaml(INLINE);
      const text = flatten(renderComparison(stateFor(viewModel, compact)));
      const chunk = chunkFor(text, 'Row Alpha');
      const exact =
        /<span class="pr-value pr-value--addon"\s*><span aria-hidden="true">\s*Add-on\s*<\/span\s*><span class="pr-sr-only">\s*Available as add-on\s*<\/span\s*><\/span\s*>/g;
      expect(count(chunk, exact)).toBe(2);
    });
  }

  it('leaves the add-on effects unchanged', () => {
    const viewModel = viewModelFromYaml(INLINE);
    const text = flatten(renderAddOns(stateFor(viewModel)));
    expect(text).not.toContain('pr-value--addon');
    expect(count(text, EXCLUDED)).toBe(3);
  });

  it('leaves the plan cards unchanged', () => {
    const viewModel = viewModelFromYaml(INLINE);
    expect(flatten(renderPlans(stateFor(viewModel)))).not.toContain('pr-value--addon');
  });
});

// Relative luminance and contrast ratio as defined by WCAG 2.
type Rgb = [number, number, number];

function themeColor(css: string, name: string): Rgb {
  const match = new RegExp(`${name}:\\s*#([0-9a-fA-F]{6})\\b`).exec(css);
  if (!match) throw new Error(`Missing ${name}`);
  const value = match[1]!;
  return [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16)) as Rgb;
}

function luminance(color: Rgb): number {
  const [r, g, b] = color.map((component) => {
    const scaled = component / 255;
    return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(first: Rgb, second: Rgb): number {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light! + 0.05) / (dark! + 0.05);
}

// color-mix(in srgb, accent 11%, surface): per-channel linear mix of the sRGB components.
function mix(accent: Rgb, surface: Rgb, share: number): Rgb {
  const channels = accent.map((component, index) => {
    return component * share + surface[index]! * (1 - share);
  });
  return channels as Rgb;
}

const BADGE = 'color-mix(in srgb, var(--pr-color-accent) 11%, var(--pr-color-surface-raised))';

describe('marker styles', () => {
  const css = readFileSync(join(repoRoot, 'src/styles/base.css'), 'utf8');
  const theme = readFileSync(join(repoRoot, 'src/styles/theme.css'), 'utf8');

  it('defines .pr-value--addon with the accent badge look', () => {
    const rule = /\.pr-value--addon\s*\{([^}]*)\}/.exec(css);
    expect(rule).not.toBeNull();
    const body = rule![1]!.replace(/\s+/g, ' ');
    expect(body).toMatch(/(?:^|[ ;])color:\s*var\(--pr-color-link\)/);
    expect(body).toMatch(/background(?:-color)?: color-mix/);
    expect(body).toContain(BADGE);
    expect(body).toMatch(/white-space:\s*nowrap/);
  });

  it('computes contrast with a known pair', () => {
    expect(contrast([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
  });

  const darkStart = theme.indexOf("[theme='dark']");
  const autoStart = theme.indexOf('@media (prefers-color-scheme: dark)');
  const themes: Record<string, string> = {
    light: theme.slice(0, darkStart),
    dark: theme.slice(darkStart, autoStart),
    auto: theme.slice(autoStart),
  };

  it('finds the three theme sections in theme.css', () => {
    expect(darkStart).toBeGreaterThan(0);
    expect(autoStart).toBeGreaterThan(darkStart);
  });

  for (const [name, section] of Object.entries(themes)) {
    it(`has a text contrast of at least 4.5:1 in the ${name} theme`, () => {
      const background = mix(
        themeColor(section, '--pr-color-accent'),
        themeColor(section, '--pr-color-surface-raised'),
        0.11,
      );
      const ratio = contrast(themeColor(section, '--pr-color-link'), background);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  }
});

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

// Reference implementation of the definition, as the SPECTRA metrics count it.
function referenceAddOnOnly(viewModel: PricingViewModel, row: PricingComparisonRow): boolean {
  const provides = viewModel.addOns.some((addOn) => {
    if (row.kind === 'feature') return !isEmptyCell(unwrap(addOn.features[row.id]));
    return (
      !isEmptyCell(unwrap(addOn.usageLimits[row.id])) ||
      !isEmptyCell(unwrap(addOn.usageLimitsExtensions[row.id]))
    );
  });
  return row.values.every((cell) => isEmptyCell(cell.value)) && provides;
}

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

const METRICS = 'docs/agent-work/visual-review-spectra/metrics.json';

interface MetricsFile {
  pricings: Array<{ fixture: string; addOnOnlyRows: number }>;
}

interface FixtureResult {
  fixture: string;
  saas: string;
  plans: number;
  reference: number;
  detected: number;
  markedTable: number;
  markedCompact: number;
  markersPerMarkedRow: number[];
}

describe('SPECTRA fixtures', () => {
  let results: FixtureResult[] = [];
  let expected = new Map<string, number>();

  beforeAll(() => {
    const source = readFileSync(join(repoRoot, METRICS), 'utf8');
    const metrics = JSON.parse(source) as MetricsFile;
    expected = new Map(metrics.pricings.map((item) => [item.fixture, item.addOnOnlyRows]));
    results = listFixtures().map((fixture) => {
      const viewModel = viewModelFromYaml(readFileSync(join(repoRoot, fixture), 'utf8'));
      const rows = rowsOf(viewModel);
      const marked = (compact: boolean): string[] => {
        const text = flatten(renderComparison(stateFor(viewModel, compact)));
        return rowChunks(text).filter((chunk) => chunk.includes('pr-value--addon'));
      };
      const table = marked(false);
      const compact = marked(true);
      return {
        fixture,
        saas: fixture.split('/')[3]!,
        plans: viewModel.plans.length,
        reference: rows.filter((row) => referenceAddOnOnly(viewModel, row)).length,
        detected: rows.filter((row) => isAddOnOnlyRow(viewModel, row)).length,
        markedTable: table.length,
        markedCompact: compact.length,
        markersPerMarkedRow: [...table, ...compact].map((chunk) => count(chunk, MARKER)),
      };
    });
  });

  const withoutOkta = (): FixtureResult[] => results.filter((item) => item.saas !== 'okta');
  const sum = (values: number[]): number => values.reduce((total, value) => total + value, 0);

  it('loads the 37 fixtures of the metrics', () => {
    expect(results).toHaveLength(37);
    expect(expected.size).toBe(37);
  });

  it('counts 166 add-on-only rows without Okta, as metrics.json does', () => {
    expect(sum(withoutOkta().map((item) => item.reference))).toBe(166);
    expect(sum(withoutOkta().map((item) => expected.get(item.fixture)!))).toBe(166);
    expect(sum(withoutOkta().map((item) => item.detected))).toBe(166);
  });

  it('detects the same rows as the metrics in every fixture', () => {
    for (const item of withoutOkta()) {
      expect(item.detected, item.fixture).toBe(expected.get(item.fixture));
    }
  });

  it('renders the marker in as many rows as metrics.json counts, in both layouts', () => {
    for (const item of withoutOkta()) {
      expect(item.markedTable, `${item.fixture} table`).toBe(expected.get(item.fixture));
      expect(item.markedCompact, `${item.fixture} compact`).toBe(expected.get(item.fixture));
    }
    expect(sum(withoutOkta().map((item) => item.markedTable))).toBe(166);
    expect(sum(withoutOkta().map((item) => item.markedCompact))).toBe(166);
  });

  it('renders one marker per plan in every marked row', () => {
    for (const item of withoutOkta()) {
      expect(item.plans, item.fixture).toBeGreaterThan(0);
    }
    const plansByCount = new Map(withoutOkta().map((item) => [item.fixture, item.plans]));
    for (const item of withoutOkta().filter((candidate) => candidate.markedTable > 0)) {
      const perRow = item.markersPerMarkedRow;
      expect(perRow.length, item.fixture).toBe(item.markedTable + item.markedCompact);
      expect(new Set(perRow), item.fixture).toEqual(new Set([plansByCount.get(item.fixture)]));
    }
  });

  it('has the per-fixture counts of the report', () => {
    const perSaas: Record<string, number> = {
      github: 32,
      salesforce: 44,
      mailchimp: 16,
      postman: 14,
      zoom: 13,
      tableau: 10,
    };
    for (const [saas, rows] of Object.entries(perSaas)) {
      const items = results.filter((item) => item.saas === saas);
      expect(items.length, saas).toBeGreaterThan(0);
      expect(sum(items.map((item) => item.markedTable)), `${saas} table`).toBe(rows);
      expect(sum(items.map((item) => item.markedCompact)), `${saas} compact`).toBe(rows);
    }
  });

  it('renders no marker for Okta, which has no plans', () => {
    const okta = results.filter((item) => item.saas === 'okta');
    expect(okta.length).toBeGreaterThan(0);
    for (const item of okta) {
      expect(item.plans, item.fixture).toBe(0);
      expect(item.markedTable, item.fixture).toBe(0);
      expect(item.markedCompact, item.fixture).toBe(0);
    }
  });
});
