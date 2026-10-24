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

async function load(relative: string): Promise<PricingViewModel> {
  const path = fileURLToPath(new URL(relative, import.meta.url));
  const pricing = parsePricingYaml(await readFile(path, 'utf8')).value!;
  return createPricingViewModel(pricing);
}

async function withDescriptions(
  descriptions: Record<number, string | undefined>,
): Promise<PricingViewModel> {
  const base = await load('../fixtures/acme-pricing.yml');
  let index = 0;
  return {
    ...base,
    comparisonGroups: base.comparisonGroups.map((group) => ({
      ...group,
      rows: group.rows.map((row) => {
        const description = descriptions[index++];
        const next = { ...row };
        delete next.description;
        return description === undefined ? next : { ...next, description };
      }),
    })),
  };
}

describe('empty or filler row descriptions', () => {
  it('renders a distinct description in both layouts', async () => {
    const viewModel = await withDescriptions({ 0: 'A useful explanation' });
    expect(flatten(renderComparison(stateFor(viewModel)))).toContain(
      '<small>A useful explanation</small>',
    );
    expect(flatten(renderComparison(stateFor(viewModel, true)))).toContain(
      '<p>A useful explanation</p>',
    );
  });

  it('skips empty and whitespace-only descriptions without empty nodes', async () => {
    const viewModel = await withDescriptions({ 0: '', 1: '   ' });
    for (const compact of [false, true]) {
      const text = flatten(renderComparison(stateFor(viewModel, compact)));
      expect(text).not.toMatch(/<small>\s*<\/small>/);
      expect(text).not.toMatch(/<p>\s*<\/p>/);
    }
  });

  it('skips a description equal to the name, ignoring case and outer spaces', async () => {
    const base = await load('../fixtures/acme-pricing.yml');
    const name = base.comparisonGroups[0]!.rows[0]!.name;
    const viewModel = await withDescriptions({ 0: `  ${name.toUpperCase()} ` });
    expect(flatten(renderComparison(stateFor(viewModel)))).not.toContain('<small>');
    expect(flatten(renderComparison(stateFor(viewModel, true)))).not.toMatch(
      new RegExp(`<p>\\s*${name}\\s*</p>`, 'i'),
    );
    expect(flatten(renderComparison(stateFor(viewModel)))).not.toContain('aria-describedby');
  });

  for (const file of ['canva', 'buffer']) {
    it(`does not repeat the name as a description in ${file}`, async () => {
      const viewModel = await load(`../fixtures/spectra/${file}/2024.yml`);
      const rows = viewModel.comparisonGroups.flatMap((group) => group.rows);
      const filler = rows.filter(
        (row) => row.description?.trim().toLowerCase() === row.name.trim().toLowerCase(),
      );
      expect(filler.length).toBeGreaterThan(0);
      const text = flatten(renderComparison(stateFor(viewModel)));
      const compactText = flatten(renderComparison(stateFor(viewModel, true)));
      for (const row of filler) {
        expect(text).not.toContain(`<small>${row.description}</small>`);
        expect(compactText).not.toContain(`<p>${row.description}</p>`);
      }
    });
  }
});
