// Known coverage limits of this file:
// - Byte-identical demo markup is covered only by the existing visual baselines; the acme pricing
//   renders no toolbar or empty state here, so these tests cannot show that its markup is unchanged.
// - The element-level override and reset rules (checkbox override, reload, hidden toolbar) are
//   covered in the browser spec tests/browser/spectra-shorter-page.spec.ts.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createPricingViewModel, getMessages } from '../../src/core/index.js';
import type { PricingViewModel } from '../../src/core/index.js';
import * as renderers from '../../src/element/renderers.js';
import type { RenderActions, RenderState } from '../../src/element/renderers.js';
import { parsePricingYaml } from '../../src/yaml/index.js';

// SPECTRA item 2 (docs/agent-work/spectra-item2-shorter-page/spec.md). The new exports are reached
// through typed casts, so a missing export fails when the test runs and not when the file loads.

interface ShorterPageApi {
  DEFAULT_TOOLBAR_THRESHOLD: number;
  AUTO_DIFFERENCES_MIN_ROWS: number;
  comparisonRowTotal(viewModel: PricingViewModel): number;
  resolveOnlyDifferences(
    viewModel: PricingViewModel,
    initial: boolean | undefined,
    toolbarThreshold?: number,
  ): boolean;
}

interface ElementApi {
  onlyDifferencesConverter?: { fromAttribute(value: string | null): boolean | undefined };
}

const api = renderers as unknown as typeof renderers & ShorterPageApi;
const { renderComparison } = renderers;

type ShorterState = RenderState & { toolbarThreshold?: number };

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

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

function stateFor(
  viewModel: PricingViewModel,
  overrides: Partial<ShorterState> = {},
): ShorterState {
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
    ...overrides,
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

function viewModelFromYaml(yaml: string, locale?: string): PricingViewModel {
  const parsed = parsePricingYaml(yaml);
  if (!parsed.value) {
    throw new Error(`Cannot parse the pricing: ${JSON.stringify(parsed.diagnostics)}`);
  }
  const viewModel = createPricingViewModel(parsed.value);
  return locale ? { ...viewModel, messages: getMessages(locale) } : viewModel;
}

function fixture(relative: string, locale?: string): PricingViewModel {
  return viewModelFromYaml(readFileSync(join(repoRoot, relative), 'utf8'), locale);
}

const CLICKUP = 'tests/fixtures/spectra/clickup/2024.yml';
const OKTA = 'tests/fixtures/spectra/okta/2024.yml';
const ACME = 'tests/fixtures/acme-pricing.yml';

// A pricing with `rows` boolean features in one group. With `differ`, the second plan includes every
// feature, so every row differs; without it, every row has the same value in every plan.
function syntheticYaml(rows: number, plans = 2, differ = true): string {
  const ids = Array.from({ length: rows }, (_, index) => `f${String(index + 1).padStart(3, '0')}`);
  const features = ids.flatMap((id) => [
    `  ${id}:`,
    `    name: Row ${id}`,
    '    tag: General',
    '    valueType: BOOLEAN',
    '    defaultValue: false',
  ]);
  const plan = (id: string, name: string, price: number, values: string[]) => [
    `  ${id}:`,
    `    name: ${name}`,
    `    price: ${price}`,
    '    unit: month',
    '    features:',
    ...values,
  ];
  const sameAsDefault = ['      f001:', '        value: false'];
  const included = ids.flatMap((id) => [`      ${id}:`, '        value: true']);
  const planOne = plan('one', 'Plan One', 10, sameAsDefault);
  const planTwo = plan('two', 'Plan Two', 20, differ ? included : sameAsDefault);
  return [
    "syntaxVersion: '3.1'",
    'saasName: Synthetic Co',
    "version: '2026.01'",
    "createdAt: '2026-01-01'",
    'currency: EUR',
    'features:',
    ...features,
    'plans:',
    ...planOne,
    ...(plans >= 2 ? planTwo : []),
    '',
  ].join('\n');
}

function synthetic(rows: number, plans = 2, differ = true, locale?: string): PricingViewModel {
  return viewModelFromYaml(syntheticYaml(rows, plans, differ), locale);
}

function rowTotal(viewModel: PricingViewModel): number {
  return viewModel.comparisonGroups.reduce((total, group) => total + group.rows.length, 0);
}

function count(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

const TOOLBAR = 'data-pr-part="comparison-toolbar"';
const EMPTY = 'data-pr-part="comparison-empty"';
const ROW = /data-pr-part="comparison-row"/g;

function counterText(text: string): string {
  const matches = [...text.matchAll(/<span aria-live="polite">([^<]*)<\/span>/g)];
  expect(matches, 'one counter in the toolbar').toHaveLength(1);
  return matches[0]![1]!.replace(/\s+/g, ' ').trim();
}

function emptyTag(text: string): string {
  const match = /<p\b[^>]*data-pr-part="comparison-empty"[^>]*>/.exec(text);
  expect(match, 'the empty state element').not.toBeNull();
  return match![0];
}

describe('synthetic pricings', () => {
  it('parse with the expected rows and plans', () => {
    for (const rows of [20, 40, 41, 100, 101, 150]) {
      const viewModel = synthetic(rows);
      expect(rowTotal(viewModel), `${rows} rows`).toBe(rows);
      expect(viewModel.plans, `${rows} rows`).toHaveLength(2);
      expect(viewModel.comparisonGroups, `${rows} rows`).toHaveLength(1);
    }
    expect(synthetic(150, 1).plans).toHaveLength(1);
  });

  it('differ in every row, or in none', () => {
    const differing = synthetic(50);
    const identical = synthetic(50, 2, false);
    const differs = (viewModel: PricingViewModel) => {
      const rows = viewModel.comparisonGroups.flatMap((group) => group.rows);
      return rows.filter((row) => row.values[0]!.value !== row.values[1]!.value).length;
    };
    expect(differs(differing)).toBe(50);
    expect(differs(identical)).toBe(0);
  });
});

// [utest->req~shorter-page-auto-default~1]
describe('resolveOnlyDifferences', () => {
  it('exports the thresholds and the row total', () => {
    expect(api.AUTO_DIFFERENCES_MIN_ROWS).toBe(100);
    expect(api.DEFAULT_TOOLBAR_THRESHOLD).toBe(40);
    expect(api.comparisonRowTotal(synthetic(150))).toBe(150);
    expect(api.comparisonRowTotal(fixture(CLICKUP))).toBe(174);
  });

  it('lets an explicit value win', () => {
    expect(api.resolveOnlyDifferences(synthetic(150), false)).toBe(false);
    expect(api.resolveOnlyDifferences(synthetic(40), true)).toBe(true);
    expect(api.resolveOnlyDifferences(synthetic(150, 1), true)).toBe(true);
    expect(api.resolveOnlyDifferences(synthetic(150), false, 0)).toBe(false);
  });

  it('turns on only above 100 rows with at least 2 plans', () => {
    const expected: Array<[number, boolean]> = [
      [40, false],
      [41, false],
      [100, false],
      [101, true],
      [150, true],
    ];
    for (const [rows, on] of expected) {
      expect(api.resolveOnlyDifferences(synthetic(rows), undefined), `${rows} rows`).toBe(on);
    }
  });

  it('never turns on automatically with one plan', () => {
    expect(api.resolveOnlyDifferences(synthetic(150, 1), undefined)).toBe(false);
    expect(api.resolveOnlyDifferences(synthetic(150, 1), undefined, 0)).toBe(false);
  });

  it('stays off when the toolbar is hidden by the threshold', () => {
    const viewModel = synthetic(150);
    expect(api.resolveOnlyDifferences(viewModel, undefined, 200)).toBe(false);
    expect(api.resolveOnlyDifferences(viewModel, undefined, 150)).toBe(false);
    expect(api.resolveOnlyDifferences(viewModel, undefined, 149)).toBe(true);
    expect(api.resolveOnlyDifferences(viewModel, undefined, 40)).toBe(true);
    expect(api.resolveOnlyDifferences(synthetic(101), undefined, 101)).toBe(false);
  });

  it('is on for ClickUp and off for Okta, which has no plans', () => {
    expect(api.resolveOnlyDifferences(fixture(CLICKUP), undefined)).toBe(true);
    expect(api.resolveOnlyDifferences(fixture(OKTA), undefined)).toBe(false);
  });
});

// [utest->req~shorter-page-only-differences~1]
describe('onlyDifferencesConverter', () => {
  it('maps the attribute to a tri-state value', async () => {
    const loaded: unknown = await import('../../src/element/pricing-renderer-element.js');
    const converter = (loaded as ElementApi).onlyDifferencesConverter;
    const convert = (value: string | null) => converter!.fromAttribute(value);
    expect(convert(null)).toBeUndefined();
    expect(convert('false')).toBe(false);
    expect(convert('')).toBe(true);
    expect(convert('true')).toBe(true);
    expect(convert('anything')).toBe(true);
    expect(convert('x')).toBe(true);
  });
});

// [utest->req~shorter-page-toolbar-threshold~1]
describe('toolbar threshold', () => {
  const hasToolbar = (viewModel: PricingViewModel, overrides: Partial<ShorterState> = {}) =>
    flatten(renderComparison(stateFor(viewModel, overrides))).includes(TOOLBAR);

  it('keeps the default of 40 rows when the state has no threshold', () => {
    expect(hasToolbar(synthetic(40))).toBe(false);
    expect(hasToolbar(synthetic(41))).toBe(true);
  });

  it('renders the toolbar when the rows exceed a lower threshold', () => {
    expect(hasToolbar(synthetic(20), { toolbarThreshold: 10 })).toBe(true);
    expect(hasToolbar(synthetic(20), { toolbarThreshold: 19 })).toBe(true);
    expect(hasToolbar(synthetic(20), { toolbarThreshold: 20 })).toBe(false);
  });

  it('hides the toolbar when the rows do not exceed a higher threshold', () => {
    expect(hasToolbar(synthetic(150), { toolbarThreshold: 200 })).toBe(false);
    expect(hasToolbar(synthetic(150), { toolbarThreshold: 150 })).toBe(false);
    expect(hasToolbar(synthetic(150), { toolbarThreshold: 149 })).toBe(true);
  });

  for (const compact of [false, true]) {
    it(`applies the threshold in both layouts (compact=${compact})`, () => {
      expect(hasToolbar(synthetic(20), { compact, toolbarThreshold: 10 })).toBe(true);
      expect(hasToolbar(synthetic(150), { compact, toolbarThreshold: 200 })).toBe(false);
    });
  }
});

// [utest->req~shorter-page-counter~1]
describe('counter', () => {
  function firstGroupState(viewModel: PricingViewModel, compact = false): ShorterState {
    const first = viewModel.comparisonGroups[0]!;
    return stateFor(viewModel, {
      compact,
      expandedGroups: new Set([first.id]),
      revealedGroups: new Set(),
    });
  }

  function expectedShown(viewModel: PricingViewModel): number {
    return Math.min(30, viewModel.comparisonGroups[0]!.rows.length);
  }

  for (const compact of [false, true]) {
    it(`counts the rendered rows of the expanded first group (compact=${compact})`, () => {
      const viewModel = fixture(CLICKUP);
      const shown = expectedShown(viewModel);
      const text = flatten(renderComparison(firstGroupState(viewModel, compact)));
      expect(counterText(text)).toBe(`${shown} of 174 items`);
      expect(count(text, ROW)).toBe(shown);
    });
  }

  it('reads the Spanish catalog', () => {
    const viewModel = fixture(CLICKUP, 'es');
    const shown = expectedShown(viewModel);
    const text = flatten(renderComparison(firstGroupState(viewModel)));
    expect(counterText(text)).toBe(`${shown} de 174 elementos`);
  });

  it('counts every revealed row when all groups are expanded and revealed', () => {
    const viewModel = fixture(CLICKUP);
    const text = flatten(renderComparison(stateFor(viewModel)));
    expect(counterText(text)).toBe('174 of 174 items');
    expect(count(text, ROW)).toBe(174);
  });

  it('no longer renders the old counter text', () => {
    const english = flatten(renderComparison(firstGroupState(fixture(CLICKUP))));
    expect(english).not.toContain('items shown');
    const spanish = flatten(renderComparison(firstGroupState(fixture(CLICKUP, 'es'))));
    expect(spanish).not.toContain('elementos mostrados');
  });

  it('keeps pricing.rowsShown and adds pricing.rowsShownOf and pricing.noMatches', () => {
    const english = getMessages('en');
    const spanish = getMessages('es');
    expect(english['pricing.rowsShown']).toBeTruthy();
    expect(spanish['pricing.rowsShown']).toBeTruthy();
    expect(english['pricing.rowsShownOf']).toBe('{shown} of {total} items');
    expect(spanish['pricing.rowsShownOf']).toBe('{shown} de {total} elementos');
    expect(english['pricing.noMatches']).toBe('No matching items');
    expect(spanish['pricing.noMatches']).toBe('Sin resultados');
  });
});

// [utest->req~shorter-page-empty-state~1]
describe('empty state', () => {
  const noMatch = 'zzzz-no-such-row';

  function expectEmptyState(text: string, total: number, locale: 'en' | 'es' = 'en'): void {
    const tag = emptyTag(text);
    expect(tag).toContain('class="pr-empty"');
    expect(tag).toContain('role="status"');
    expect(text).toContain(locale === 'en' ? 'No matching items' : 'Sin resultados');
    expect(text).not.toContain('<table');
    expect(text).not.toContain('comparison-row');
    expect(text).not.toContain('pr-feature-card');
    expect(text).toContain(TOOLBAR);
    const counter = locale === 'en' ? `0 of ${total} items` : `0 de ${total} elementos`;
    expect(counterText(text)).toBe(counter);
  }

  for (const compact of [false, true]) {
    it(`renders a status message when the search matches nothing (compact=${compact})`, () => {
      const viewModel = fixture(CLICKUP);
      const text = flatten(renderComparison(stateFor(viewModel, { compact, search: noMatch })));
      expectEmptyState(text, 174);
      expect(text.indexOf(TOOLBAR)).toBeLessThan(text.indexOf(EMPTY));
    });

    it(`localizes the status message (compact=${compact})`, () => {
      const viewModel = fixture(CLICKUP, 'es');
      const text = flatten(renderComparison(stateFor(viewModel, { compact, search: noMatch })));
      expectEmptyState(text, 174, 'es');
    });

    it(`renders it when only differences hides every row (compact=${compact})`, () => {
      const state = stateFor(synthetic(50, 2, false), { compact, onlyDifferences: true });
      const text = flatten(renderComparison(state));
      expectEmptyState(text, 50);
    });

    it(`keeps the no-plans text for Okta (compact=${compact})`, () => {
      const viewModel = fixture(OKTA);
      for (const search of ['', noMatch]) {
        const text = flatten(renderComparison(stateFor(viewModel, { compact, search })));
        expect(text).toContain('There are no plans to compare.');
        expect(text).not.toContain(EMPTY);
        expect(text).not.toContain('No matching items');
      }
    });

    it(`does not render it when the search has matches (compact=${compact})`, () => {
      const viewModel = fixture(CLICKUP);
      const text = flatten(renderComparison(stateFor(viewModel, { compact, search: 'a' })));
      expect(text).not.toContain(EMPTY);
      expect(text).not.toContain('No matching items');
      expect(count(text, ROW)).toBeGreaterThan(0);
    });
  }
});

// [utest->req~shorter-page-no-look-change~1]
describe('demo pricing', () => {
  for (const compact of [false, true]) {
    it(`renders no toolbar and no empty state by default (compact=${compact})`, () => {
      const viewModel = fixture(ACME);
      expect(api.comparisonRowTotal(viewModel)).toBeLessThanOrEqual(40);
      const onlyDifferences = api.resolveOnlyDifferences(viewModel, undefined);
      expect(onlyDifferences).toBe(false);
      const text = flatten(renderComparison(stateFor(viewModel, { compact, onlyDifferences })));
      expect(text).not.toContain('comparison-toolbar');
      expect(text).not.toContain('comparison-empty');
      expect(count(text, ROW)).toBe(rowTotal(viewModel));
    });
  }
});
