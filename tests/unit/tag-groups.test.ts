import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createPricingViewModel, enUS, esES } from '../../src/core/index.js';
import type { PricingComparisonGroup, PricingViewModel } from '../../src/core/index.js';
import { renderComparison } from '../../src/element/renderers.js';
import type { RenderActions, RenderState } from '../../src/element/renderers.js';
import { parsePricingYaml } from '../../src/yaml/index.js';

// SPECTRA item 9 (docs/agent-work/spectra-item9-tags/spec.md): comparison groups follow the
// declared tags. `kind` is read through a loose view, so a missing field fails by assertion.

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

function count(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

function kindOf(group: PricingComparisonGroup): unknown {
  return (group as unknown as { kind?: unknown }).kind;
}

function build(
  yaml: string,
  options: { locale?: string; messages?: Record<string, string> } = {},
): PricingViewModel {
  const parsed = parsePricingYaml(yaml);
  if (!parsed.value) throw new Error(`Cannot parse the pricing: ${JSON.stringify(parsed)}`);
  return createPricingViewModel(parsed.value, undefined, options);
}

function fixtureYaml(relative: string): string {
  return readFileSync(join(repoRoot, relative), 'utf8');
}

const CLICKUP = 'tests/fixtures/spectra/clickup/2024.yml';
const ZOOM = 'tests/fixtures/spectra/zoom/2024.yml';
const SHOPIFY = 'tests/fixtures/spectra/shopify/2022.yml';
const ZENHUB = 'tests/fixtures/spectra/zenhub/2024.yml';
const ACME = 'tests/fixtures/acme-pricing.yml';

interface Item {
  id: string;
  tag?: string;
}

// The rendered rows in declaration order (features, then usage limits) with their declared tag.
function renderedItems(viewModel: PricingViewModel): Item[] {
  const items = [...viewModel.pricing.features, ...viewModel.pricing.usageLimits]
    .filter((item) => item.render !== 'disabled')
    .map((item): Item => {
      const raw = item.raw.tag;
      const declared = typeof raw === 'string' && raw.trim() !== '';
      return declared ? { id: item.id, tag: item.tag } : { id: item.id };
    });
  return items;
}

interface Expected {
  id: string;
  kind: string;
  rows: string[];
}

// The groups the spec asks for, computed from the data.
function expectedGroups(viewModel: PricingViewModel): Expected[] {
  const items = renderedItems(viewModel);
  const tagged = items.filter((item) => item.tag !== undefined);
  if (tagged.length === 0) {
    return items.length === 0
      ? []
      : [{ id: 'pr-untagged', kind: 'untagged', rows: items.map((item) => item.id) }];
  }
  const groups = new Map<string, Expected>();
  for (const item of tagged) {
    const tag = item.tag!;
    const group = groups.get(tag) ?? { id: tag, kind: 'tag', rows: [] };
    group.rows.push(item.id);
    groups.set(tag, group);
  }
  const rest = items.filter((item) => item.tag === undefined).map((item) => item.id);
  return [
    ...groups.values(),
    ...(rest.length > 0 ? [{ id: 'pr-other-features', kind: 'other-features', rows: rest }] : []),
  ];
}

function actualGroups(viewModel: PricingViewModel): Expected[] {
  return viewModel.comparisonGroups.map((group) => ({
    id: group.id,
    kind: String(kindOf(group)),
    rows: group.rows.map((row) => row.id),
  }));
}

function stateFor(viewModel: PricingViewModel, overrides: Partial<RenderState> = {}): RenderState {
  return {
    viewModel,
    selection: viewModel.resolved.selection,
    compact: false,
    search: '',
    onlyDifferences: false,
    selectionEnabled: true,
    ctaEnabled: true,
    variablesEnabled: true,
    expandedGroups: new Set(),
    revealedGroups: new Set(),
    breakdownOpen: false,
    breakdownId: 'breakdown',
    actions,
    ...overrides,
  };
}

function render(viewModel: PricingViewModel, overrides: Partial<RenderState> = {}): string {
  return flatten(renderComparison(stateFor(viewModel, overrides)));
}

// A tiny pricing: `features` and `usageLimits` map an id to its tag line (or none).
function tiny(features: Record<string, string | null>, limits: Record<string, string | null> = {}) {
  const block = (entries: Record<string, string | null>, extra: string[]) =>
    Object.entries(entries).flatMap(([id, tag]) => [
      `  ${id}:`,
      ...(tag === null ? [] : [`    tag: ${tag}`]),
      ...extra,
    ]);
  return [
    "syntaxVersion: '3.1'",
    'saasName: Tiny Co',
    "version: '2026.01'",
    "createdAt: '2026-01-01'",
    'currency: EUR',
    'features:',
    ...block(features, ['    valueType: BOOLEAN', '    defaultValue: false']),
    ...(Object.keys(limits).length > 0
      ? [
          'usageLimits:',
          ...block(limits, [
            '    type: renewable',
            '    period: monthly',
            '    valueType: NUMERIC',
            '    defaultValue: 1',
          ]),
        ]
      : []),
    'plans:',
    '  one:',
    '    price: 10',
    '    unit: month',
    '',
  ].join('\n');
}

function ids(group: PricingComparisonGroup | undefined): string[] {
  return group?.rows.map((row) => row.id) ?? [];
}

describe('classification by declared tags', () => {
  // [utest->req~tag-groups-declared~1]
  it('does not count the default tags as declared', () => {
    const viewModel = build(fixtureYaml(CLICKUP));
    const rows = viewModel.comparisonGroups.flatMap((group) => group.rows);
    const categories = [...new Set(rows.map((row) => row.category))].sort();
    expect(categories).toEqual(['General', 'Usage limits']);
    expect(viewModel.comparisonGroups.map((group) => group.id)).toEqual(['pr-untagged']);
  });

  // [utest->req~tag-groups-declared~1]
  it('counts a declared tag named General', () => {
    const viewModel = build(tiny({ a: 'General', b: null }));
    expect(actualGroups(viewModel)).toEqual([
      { id: 'General', kind: 'tag', rows: ['a'] },
      { id: 'pr-other-features', kind: 'other-features', rows: ['b'] },
    ]);
  });

  // [utest->req~tag-groups-declared~1]
  it('does not count a blank tag', () => {
    const viewModel = build(tiny({ a: '"   "' }, { l: null }));
    expect(viewModel.comparisonGroups.map((group) => group.id)).toEqual(['pr-untagged']);
    expect(ids(viewModel.comparisonGroups[0])).toEqual(['a', 'l']);
  });
});

describe('one headerless group for an untagged pricing', () => {
  // [utest->req~tag-groups-none~1]
  it('gives ClickUp one group with features then usage limits', () => {
    const viewModel = build(fixtureYaml(CLICKUP));
    const groups = viewModel.comparisonGroups;
    expect(groups).toHaveLength(1);
    const group = groups[0]!;
    expect(group.id).toBe('pr-untagged');
    expect(kindOf(group)).toBe('untagged');
    expect(group.name).toBe('Features');
    const expected = [...viewModel.pricing.features, ...viewModel.pricing.usageLimits]
      .filter((item) => item.render !== 'disabled')
      .map((item) => item.id);
    expect(expected).toHaveLength(174);
    expect(ids(group)).toEqual(expected);
  });

  // [utest->req~tag-groups-none~1]
  // [utest->req~tag-groups-declared~1]
  // [utest->req~tag-groups-partial~1]
  it('follows the declared tags in every SPECTRA fixture', () => {
    const failures: string[] = [];
    let untagged = 0;
    for (const entry of readdirSync(fixturesRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const files = readdirSync(join(fixturesRoot, entry.name))
        .filter((file) => file.endsWith('.yml'))
        .sort();
      const file = files[files.length - 1];
      if (file === undefined) continue;
      const viewModel = build(fixtureYaml(`tests/fixtures/spectra/${entry.name}/${file}`));
      const expected = expectedGroups(viewModel);
      if (expected.length === 1 && expected[0]!.kind === 'untagged') untagged += 1;
      const actual = actualGroups(viewModel);
      if (JSON.stringify(actual) !== JSON.stringify(expected)) failures.push(entry.name);
    }
    expect(untagged).toBe(34);
    expect(failures).toEqual([]);
  });
});

describe('no group header for the headerless group', () => {
  // [utest->req~tag-groups-headerless~1]
  it('renders the ClickUp table without category rows', () => {
    const text = render(build(fixtureYaml(CLICKUP)));
    expect(count(text, /<tbody/g)).toBe(1);
    expect(count(text, /pr-category-row/g)).toBe(0);
    expect(count(text, /data-pr-part="comparison-row"/g)).toBeGreaterThan(0);
  });

  // [utest->req~tag-groups-headerless~1]
  it('renders the ClickUp compact layout without headings or toggles', () => {
    const text = render(build(fixtureYaml(CLICKUP)), { compact: true });
    expect(count(text, /<section class="pr-comparison-group"/g)).toBe(1);
    expect(count(text, /<h4/g)).toBe(0);
    expect(count(text, /aria-expanded/g)).toBe(0);
    expect(count(text, /class="pr-feature-card"/g)).toBeGreaterThan(0);
  });

  // [utest->req~tag-groups-headerless~1]
  it('keeps headers for the zoom groups, the last one Other features', () => {
    const viewModel = build(fixtureYaml(ZOOM));
    const table = render(viewModel);
    expect(count(table, /pr-category-row/g)).toBe(viewModel.comparisonGroups.length);
    expect(table).toContain('Other features');
    const compact = render(viewModel, { compact: true });
    expect(count(compact, /<h4/g)).toBe(viewModel.comparisonGroups.length);
  });
});

describe('the headerless group is always expanded', () => {
  // [utest->req~tag-groups-headerless-expanded~1]
  it('shows 30 rows and the remainder button without a click', () => {
    const text = render(build(fixtureYaml(CLICKUP)));
    expect(count(text, /data-pr-part="comparison-row"/g)).toBe(30);
    expect(text).toContain('Show 144 more');
  });

  // [utest->req~tag-groups-headerless-expanded~1]
  it('shows every row once the group is revealed', () => {
    const text = render(build(fixtureYaml(CLICKUP)), {
      compact: true,
      revealedGroups: new Set(['pr-untagged']),
    });
    expect(count(text, /class="pr-feature-card"/g)).toBe(174);
    expect(text).not.toMatch(/Show \d+ more/);
  });
});

describe('no Expand all / Collapse all for a headerless comparison', () => {
  // [utest->req~tag-groups-headerless-toolbar~1]
  it('keeps the ClickUp toolbar but drops both buttons', () => {
    const text = render(build(fixtureYaml(CLICKUP)));
    expect(text).toContain('data-pr-part="comparison-toolbar"');
    expect(text).toContain('type="search"');
    expect(text).toContain('<span aria-live="polite">');
    expect(text).not.toContain('Expand all');
    expect(text).not.toContain('Collapse all');
  });

  // [utest->req~tag-groups-headerless-toolbar~1]
  it('keeps both buttons for zoom', () => {
    const text = render(build(fixtureYaml(ZOOM)));
    expect(text).toContain('Expand all');
    expect(text).toContain('Collapse all');
  });
});

describe('Other features group for a partly tagged pricing', () => {
  // [utest->req~tag-groups-partial~1]
  it('puts the untagged zoom features then its usage limits in the last group', () => {
    const viewModel = build(fixtureYaml(ZOOM));
    const groups = viewModel.comparisonGroups;
    const last = groups[groups.length - 1]!;
    expect(last.id).toBe('pr-other-features');
    expect(kindOf(last)).toBe('other-features');
    expect(last.name).toBe('Other features');
    const untaggedFeatures = viewModel.pricing.features
      .filter((item) => item.render !== 'disabled' && typeof item.raw.tag !== 'string')
      .map((item) => item.id);
    const limits = viewModel.pricing.usageLimits
      .filter((item) => item.render !== 'disabled')
      .map((item) => item.id);
    expect(untaggedFeatures).toHaveLength(22);
    expect(limits).toHaveLength(8);
    expect(ids(last)).toEqual([...untaggedFeatures, ...limits]);
    expect(ids(last)).toHaveLength(30);
    const names = groups.map((group) => group.id);
    for (const unwanted of ['General', 'Usage limits', 'pr-usage-limits']) {
      expect(names).not.toContain(unwanted);
    }
    expect(groups.slice(0, -1).every((group) => kindOf(group) === 'tag')).toBe(true);
  });

  // [utest->req~tag-groups-partial~1]
  it.each([SHOPIFY, ZENHUB])('holds only the untagged usage limits for %s', (path) => {
    const viewModel = build(fixtureYaml(path));
    const groups = viewModel.comparisonGroups;
    const last = groups[groups.length - 1]!;
    expect(last.id).toBe('pr-other-features');
    expect(kindOf(last)).toBe('other-features');
    const limits = viewModel.pricing.usageLimits
      .filter((item) => item.render !== 'disabled')
      .map((item) => item.id);
    expect(ids(last)).toEqual(limits);
    expect(groups.map((group) => group.id)).not.toContain('Usage limits');
  });

  // [utest->req~tag-groups-partial~1]
  it('keeps a declared tag named like the special group separate', () => {
    const viewModel = build(tiny({ a: 'Other features', b: null }));
    expect(actualGroups(viewModel)).toEqual([
      { id: 'Other features', kind: 'tag', rows: ['a'] },
      { id: 'pr-other-features', kind: 'other-features', rows: ['b'] },
    ]);
  });

  // [utest->req~tag-groups-partial~1]
  it('names the last group in Spanish and keeps the tag names', () => {
    const viewModel = build(fixtureYaml(ZOOM), { locale: 'es-ES' });
    const groups = viewModel.comparisonGroups;
    expect(groups[groups.length - 1]!.name).toBe('Otras características');
    for (const group of groups.slice(0, -1)) expect(group.name).toBe(group.id);
  });
});

describe('fully tagged pricing unchanged', () => {
  // [utest->req~tag-groups-full-unchanged~1]
  it('keeps the acme groups, with kind tag', () => {
    const viewModel = build(fixtureYaml(ACME));
    expect(viewModel.comparisonGroups.map((group) => group.name)).toEqual([
      'Workspace',
      'Security',
      'Usage',
    ]);
    expect(viewModel.comparisonGroups.every((group) => kindOf(group) === 'tag')).toBe(true);
  });

  // [utest->req~tag-groups-full-unchanged~1]
  it('keeps headers in the acme table and compact layouts', () => {
    const viewModel = build(fixtureYaml(ACME));
    const all = new Set(viewModel.comparisonGroups.map((group) => group.id));
    const table = render(viewModel, { expandedGroups: all });
    expect(count(table, /<tbody/g)).toBe(3);
    expect(count(table, /pr-category-row/g)).toBe(3);
    const compact = render(viewModel, { compact: true, expandedGroups: all });
    expect(count(compact, /<h4/g)).toBe(3);
    expect(count(compact, /aria-expanded/g)).toBe(3);
  });
});

describe('group marker on the public type', () => {
  // [utest->req~tag-groups-kind~1]
  it('renders a hand-built group without kind with a header', () => {
    const base = build(fixtureYaml(ACME));
    const row = base.comparisonGroups[0]!.rows[0]!;
    const viewModel: PricingViewModel = {
      ...base,
      comparisonGroups: [{ id: 'Custom', name: 'Custom', rows: [row] }],
    };
    const text = render(viewModel);
    expect(count(text, /pr-category-row/g)).toBe(1);
    expect(text).toContain('Custom');
  });

  // [utest->req~tag-groups-kind~1]
  it('marks the generated groups', () => {
    const kinds = (path: string) =>
      build(fixtureYaml(path)).comparisonGroups.map((group) => kindOf(group));
    expect(kinds(CLICKUP)).toEqual(['untagged']);
    expect(new Set(kinds(ACME))).toEqual(new Set(['tag']));
  });
});

describe('group names from the message catalog', () => {
  // [utest->req~tag-groups-i18n~1]
  it('has the catalog values', () => {
    expect(enUS['pricing.otherFeatures']).toBe('Other features');
    expect(esES['pricing.otherFeatures']).toBe('Otras características');
  });

  // [utest->req~tag-groups-i18n~1]
  it('takes the name from a host override', () => {
    const viewModel = build(fixtureYaml(ZOOM), { messages: { 'pricing.otherFeatures': 'More' } });
    const other = viewModel.comparisonGroups.find((group) => group.id === 'pr-other-features');
    expect(other?.name).toBe('More');
  });
});

describe('normalized data and row category compatible', () => {
  // [utest->req~tag-groups-compat~1]
  it('keeps the zoom tags and categories', () => {
    const parsed = parsePricingYaml(fixtureYaml(ZOOM));
    const normalized = parsed.value!;
    expect(normalized.features.find((item) => item.id === 'callOutDialIn')?.tag).toBe('General');
    expect(normalized.usageLimits.find((item) => item.id === 'maxParticipants')?.tag).toBe(
      'Usage limits',
    );
    const viewModel = createPricingViewModel(normalized);
    const rows = viewModel.comparisonGroups.flatMap((group) => group.rows);
    expect(rows.find((row) => row.id === 'callOutDialIn')?.category).toBe('General');
    expect(rows.find((row) => row.id === 'maxParticipants')?.category).toBe('Usage limits');
  });
});
