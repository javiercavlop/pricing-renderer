import { describe, expect, it } from 'vitest';
import { createPricingViewModel } from '../../src/core/index.js';
import type { PricingViewModel } from '../../src/core/index.js';
import * as renderers from '../../src/element/renderers.js';
import type { RenderActions, RenderState } from '../../src/element/renderers.js';
import { parsePricingYaml } from '../../src/yaml/index.js';

// SPECTRA item 2 (docs/agent-work/spectra-item2-shorter-page/spec.md): an invalid toolbar threshold
// falls back to 40. The new export is reached through a typed cast, so a missing export fails when
// the test runs and not when the file loads.

interface ThresholdApi {
  toolbarThresholdOf(value: unknown): number;
  resolveOnlyDifferences(
    viewModel: PricingViewModel,
    initial: boolean | undefined,
    toolbarThreshold?: number,
  ): boolean;
}

const api = renderers as unknown as typeof renderers & ThresholdApi;
const { renderComparison } = renderers;

type ThresholdState = RenderState & { toolbarThreshold?: number };

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
  overrides: Partial<ThresholdState> = {},
): ThresholdState {
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

// A pricing with `rows` boolean features in one group; the second plan includes every feature, so
// every row differs.
function syntheticYaml(rows: number): string {
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
  return [
    "syntaxVersion: '3.1'",
    'saasName: Synthetic Co',
    "version: '2026.01'",
    "createdAt: '2026-01-01'",
    'currency: EUR',
    'features:',
    ...features,
    'plans:',
    ...plan('one', 'Plan One', 10, sameAsDefault),
    ...plan('two', 'Plan Two', 20, included),
    '',
  ].join('\n');
}

function synthetic(rows: number): PricingViewModel {
  const parsed = parsePricingYaml(syntheticYaml(rows));
  if (!parsed.value) {
    throw new Error(`Cannot parse the pricing: ${JSON.stringify(parsed.diagnostics)}`);
  }
  return createPricingViewModel(parsed.value);
}

const TOOLBAR = 'data-pr-part="comparison-toolbar"';

const hasToolbar = (viewModel: PricingViewModel, overrides: Partial<ThresholdState> = {}) =>
  flatten(renderComparison(stateFor(viewModel, overrides))).includes(TOOLBAR);

// [utest->req~shorter-page-toolbar-threshold~1]
describe('toolbarThresholdOf', () => {
  it('falls back to 40 for anything but a finite number of 0 or more', () => {
    const invalid: unknown[] = [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      -1,
      -5,
      null,
      undefined,
      'abc',
    ];
    for (const value of invalid) {
      expect(api.toolbarThresholdOf(value), String(value)).toBe(40);
    }
  });

  it('keeps a finite number of 0 or more', () => {
    expect(api.toolbarThresholdOf(0)).toBe(0);
    expect(api.toolbarThresholdOf(40)).toBe(40);
    expect(api.toolbarThresholdOf(41)).toBe(41);
    expect(api.toolbarThresholdOf(200)).toBe(200);
  });
});

// [utest->req~shorter-page-toolbar-threshold~1]
describe('invalid thresholds in the state', () => {
  it('behave as 40 in renderComparison', () => {
    for (const toolbarThreshold of [Number.NaN, -5]) {
      const small = hasToolbar(synthetic(20), { toolbarThreshold });
      const large = hasToolbar(synthetic(41), { toolbarThreshold });
      expect(small, `${toolbarThreshold}, 20 rows`).toBe(false);
      expect(large, `${toolbarThreshold}, 41 rows`).toBe(true);
    }
  });

  it('behave as 40 in resolveOnlyDifferences', () => {
    expect(api.resolveOnlyDifferences(synthetic(150), undefined, Number.NaN)).toBe(true);
  });
});
