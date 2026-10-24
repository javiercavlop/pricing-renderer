import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createPricingViewModel } from '../../src/core/index.js';
import type { PricingViewModel } from '../../src/core/index.js';
import {
  renderComparison,
  type RenderActions,
  type RenderState,
} from '../../src/element/renderers.js';
import { parsePricingYaml } from '../../src/yaml/index.js';

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

function stateFor(viewModel: PricingViewModel): RenderState {
  return {
    viewModel,
    selection: viewModel.resolved.selection,
    compact: false,
    search: '',
    onlyDifferences: false,
    selectionEnabled: true,
    ctaEnabled: true,
    variablesEnabled: true,
    expandedGroups: new Set(viewModel.comparisonGroups.map((group) => group.id)),
    revealedGroups: new Set(viewModel.comparisonGroups.map((group) => group.id)),
    breakdownOpen: false,
    breakdownId: 'breakdown',
    actions,
  };
}

// Flattens a lit template (strings and values, nested templates and arrays) into plain text.
// Vitest runs in node without a DOM, so the template is read instead of rendered.
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

async function load(path: string, locale?: string): Promise<PricingViewModel> {
  const file = fileURLToPath(new URL(path, import.meta.url));
  const pricing = parsePricingYaml(await readFile(file, 'utf8')).value!;
  return createPricingViewModel(pricing, undefined, locale ? { locale } : {});
}

// Renders one comparison row whose only cell holds `value`, with the given unit and locale.
async function renderCell(value: unknown, unit: string, locale: string): Promise<string> {
  const base = await load('../fixtures/acme-pricing.yml', locale);
  const row = base.comparisonGroups[0]!.rows[0]!;
  const viewModel: PricingViewModel = {
    ...base,
    comparisonGroups: [
      {
        ...base.comparisonGroups[0]!,
        rows: [
          { ...row, unit, values: row.values.map((cell) => ({ ...cell, value, raw: value })) },
        ],
      },
    ],
  };
  return flatten(renderComparison(stateFor(viewModel)));
}

describe('plural units in rendered values', () => {
  it('pluralizes a count above one in English', async () => {
    const text = await renderCell(3, 'execution', 'en-US');
    expect(text).toContain('>3 executions<');
    expect(text).not.toContain('3 execution<');
  });

  it('pluralizes a count above one in Spanish', async () => {
    const text = await renderCell(3, 'licencia', 'es-ES');
    expect(text).toContain('>3 licencias<');
    expect((await renderCell(1, 'licencia', 'es-ES')).includes('>1 licencia<')).toBe(true);
  });

  it('keeps the singular for exactly one', async () => {
    const text = await renderCell(1, 'execution', 'en-US');
    expect(text).toContain('>1 execution<');
    expect(text).not.toContain('executions');
  });

  it('leaves a compound unit unchanged', async () => {
    const text = await renderCell(3, 'user/month', 'en-US');
    expect(text).toContain('>3 user/month<');
  });

  it('renders text values without a unit change', async () => {
    const text = await renderCell('unlimited', 'execution', 'en-US');
    expect(text).not.toContain('executions');
  });
});

describe('plural units on SPECTRA pricings', () => {
  const files = [
    'github/2024.yml',
    'box/2024.yml',
    'dropbox/2024.yml',
    'buffer/2024.yml',
    'postman/2024.yml',
  ];
  // A count from 2 to 9 followed by a lowercase singular word that a plural would end in s.
  const singular = /pr-value">[2-9] [a-z]+(?<!s)</g;

  it.each(files)('renders no singular unit after a count in %s', async (file) => {
    const viewModel = await load(`../fixtures/spectra/${file}`);
    const text = flatten(renderComparison(stateFor(viewModel)));
    expect(text).toContain('pr-value');
    expect(text.match(singular) ?? []).toEqual([]);
  });
});
