import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createPricingViewModel, mergePresentationOptions } from '../../src/core/index.js';
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

type Labels = Record<string, Record<string, { one: string; other: string }>>;

interface Sources {
  custom?: Labels;
  element?: Labels;
}

// Renders one comparison row whose only cell holds `value`. `custom` goes into the pricing's
// custom.pricingRenderer block and `element` into the presentation option of the view model.
async function renderCell(
  value: unknown,
  unit: string,
  locale: string,
  sources: Sources = {},
): Promise<string> {
  const file = fileURLToPath(new URL('../fixtures/acme-pricing.yml', import.meta.url));
  const parsed = parsePricingYaml(await readFile(file, 'utf8')).value!;
  const pricing = sources.custom
    ? {
        ...parsed,
        custom: {
          ...parsed.custom,
          pricingRenderer: { unitLabels: sources.custom },
        },
      }
    : parsed;
  const presentation = sources.element ? { unitLabels: sources.element } : undefined;
  const base = createPricingViewModel(pricing, undefined, {
    locale,
    ...(presentation ? { presentation } : {}),
  });
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

const runs: Labels = { '*': { execution: { one: 'run', other: 'runs' } } };
const jobs: Labels = { '*': { execution: { one: 'job', other: 'jobs' } } };

describe('unitLabels in rendered values', () => {
  it('U15 renders the label from custom.pricingRenderer.unitLabels', async () => {
    const text = await renderCell(3, 'execution', 'en-US', { custom: runs });
    expect(text).toContain('>3 runs<');
    expect(text).not.toContain('executions');
    expect(await renderCell(1, 'execution', 'en-US', { custom: runs })).toContain('>1 run<');
  });

  it('U15 renders the label for a unit the built-ins leave alone', async () => {
    const custom: Labels = { '*': { 'user/month': { one: 'user', other: 'users' } } };
    const text = await renderCell(3, 'user/month', 'en-US', { custom });
    expect(text).toContain('>3 users<');
  });

  it('U16 renders the label from the element presentation option', async () => {
    const text = await renderCell(3, 'execution', 'en-US', { element: runs });
    expect(text).toContain('>3 runs<');
    expect(text).not.toContain('executions');
  });

  it('U17 the element option overrides the pricing block per unit', async () => {
    const text = await renderCell(3, 'execution', 'en-US', { custom: runs, element: jobs });
    expect(text).toContain('>3 jobs<');
    expect(text).not.toContain('runs');

    const other: Labels = { '*': { seat: { one: 'seat', other: 'chairs' } } };
    const kept = await renderCell(3, 'execution', 'en-US', { custom: runs, element: other });
    expect(kept).toContain('>3 runs<');
  });

  it('U17 the full chain: element over project config over the pricing block', async () => {
    const pricingBlock: Labels = {
      '*': {
        execution: { one: 'block run', other: 'block runs' },
        seat: { one: 'block seat', other: 'block seats' },
      },
    };
    const project: Labels = {
      '*': {
        execution: { one: 'project run', other: 'project runs' },
        seat: { one: 'project seat', other: 'project seats' },
      },
    };
    const element: Labels = { '*': { execution: { one: 'job', other: 'jobs' } } };
    const presentation = mergePresentationOptions({ unitLabels: project }, { unitLabels: element });
    const text = await renderCell(3, 'execution', 'en-US', {
      custom: pricingBlock,
      element: presentation.unitLabels as Labels,
    });
    expect(text).toContain('>3 jobs<');
    const seat = await renderCell(3, 'seat', 'en-US', {
      custom: pricingBlock,
      element: presentation.unitLabels as Labels,
    });
    expect(seat).toContain('>3 project seats<');
  });

  it('U18 follows the locale of the view model', async () => {
    const element: Labels = {
      '*': { execution: { one: 'run', other: 'runs' } },
      es: { execution: { one: 'ejecución', other: 'ejecuciones' } },
    };
    expect(await renderCell(3, 'execution', 'es-MX', { element })).toContain('>3 ejecuciones<');
    expect(await renderCell(1, 'execution', 'es-MX', { element })).toContain('>1 ejecución<');
    expect(await renderCell(3, 'execution', 'en-US', { element })).toContain('>3 runs<');
  });

  it('U19 without unitLabels the rendered text is unchanged', async () => {
    expect(await renderCell(3, 'execution', 'en-US')).toContain('>3 executions<');
    expect(await renderCell(1, 'execution', 'en-US')).toContain('>1 execution<');
    expect(await renderCell(3, 'execution', 'es')).toContain('>3 execution<');
    expect(await renderCell(3, 'user/month', 'en-US')).toContain('>3 user/month<');
  });
});
