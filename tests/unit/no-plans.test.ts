import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createPricingViewModel } from '../../src/core/index.js';
import type { PricingViewModel } from '../../src/core/index.js';
import { getMessages } from '../../src/core/i18n.js';
import {
  renderAddOns,
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

describe('pricing without plans', () => {
  it('has the shape the report describes', async () => {
    const viewModel = await load('../fixtures/spectra/okta/2024.yml');
    expect(viewModel.plans).toHaveLength(0);
    expect(viewModel.comparisonGroups.length).toBeGreaterThan(0);
    expect(viewModel.addOns.length).toBeGreaterThan(0);
  });

  for (const compact of [false, true]) {
    it(`renders a status text instead of the comparison (compact=${compact})`, async () => {
      const viewModel = await load('../fixtures/spectra/okta/2024.yml');
      const text = flatten(renderComparison(stateFor(viewModel, compact)));
      expect(text).not.toContain('<table');
      expect(text).not.toContain('comparison-row');
      expect(text).not.toContain('pr-feature-card');
      expect(text).toContain('There are no plans to compare.');
    });
  }

  it('localizes the status text', async () => {
    const viewModel = await load('../fixtures/spectra/okta/2024.yml');
    const spanish = { ...viewModel, messages: getMessages('es') };
    expect(flatten(renderComparison(stateFor(spanish)))).toContain('No hay planes que comparar.');
  });

  it('keeps the add-ons available', async () => {
    const viewModel = await load('../fixtures/spectra/okta/2024.yml');
    // the filter mode caps the cards at 8; a high threshold keeps one card per add-on
    const text = flatten(renderAddOns({ ...stateFor(viewModel), addOnFilterThreshold: 99 }));
    expect(text).toContain('add-on-card');
    expect(text.match(/data-pr-part="add-on-card"/g)).toHaveLength(viewModel.addOns.length);
  });

  it('does not change a pricing with plans', async () => {
    const viewModel = await load('../fixtures/acme-pricing.yml');
    expect(viewModel.plans.length).toBeGreaterThan(0);
    const text = flatten(renderComparison(stateFor(viewModel)));
    expect(text).toContain('<table');
    expect(text).toContain('comparison-row');
    expect(text).not.toContain('There are no plans to compare.');
    expect(flatten(renderComparison(stateFor(viewModel, true)))).toContain('pr-feature-card');
  });
});
