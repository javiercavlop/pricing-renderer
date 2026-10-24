import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createPricingViewModel } from '../../src/core/index.js';
import type { PricingViewModel } from '../../src/core/index.js';
import { renderAfterPlans } from '../../src/element/pricing-renderer-element.js';
import type { RenderActions, RenderState } from '../../src/element/renderers.js';
import { parsePricingYaml } from '../../src/yaml/index.js';

async function loadViewModel(): Promise<PricingViewModel> {
  const path = fileURLToPath(new URL('../fixtures/acme-pricing.yml', import.meta.url));
  const pricing = parsePricingYaml(await readFile(path, 'utf8')).value!;
  return createPricingViewModel(pricing);
}

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
  planId: string | undefined,
  compact = false,
): RenderState {
  const selection = { ...viewModel.resolved.selection };
  if (planId === undefined) delete selection.planId;
  else selection.planId = planId;
  return {
    viewModel,
    selection,
    compact,
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

const summaryMarker = 'data-pr-part="summary"';
const comparisonMarker = 'data-pr-part="comparison"';

// [utest->req~sticky-summary-position~1]
describe('summary position after the plans', () => {
  it('puts the summary before the comparison when a plan is selected and there are no add-ons', async () => {
    const base = await loadViewModel();
    const viewModel = { ...base, addOns: [] };
    const text = flatten(renderAfterPlans(stateFor(viewModel, viewModel.plans[0]!.id)));
    expect(text.split(summaryMarker)).toHaveLength(2);
    expect(text).toContain('class="pr-flow"');
    expect(text.indexOf(comparisonMarker)).toBeGreaterThan(-1);
    expect(text.indexOf(summaryMarker)).toBeGreaterThan(-1);
    expect(text.indexOf(summaryMarker)).toBeLessThan(text.indexOf(comparisonMarker));
  });

  it('keeps the summary last, outside the flow, in the compact layout', async () => {
    const base = await loadViewModel();
    const viewModel = { ...base, addOns: [] };
    const text = flatten(renderAfterPlans(stateFor(viewModel, viewModel.plans[0]!.id, true)));
    expect(text.split(summaryMarker)).toHaveLength(2);
    expect(text.indexOf(summaryMarker)).toBeGreaterThan(text.indexOf('</div>'));
    expect(text.indexOf(summaryMarker)).toBeGreaterThan(text.indexOf(comparisonMarker));
  });

  it('keeps the summary last when the container is narrower than 840px (layout table)', async () => {
    const base = await loadViewModel();
    const viewModel = { ...base, addOns: [] };
    const state = stateFor(viewModel, viewModel.plans[0]!.id, false);
    const text = flatten(renderAfterPlans(state, false));
    expect(text.split(summaryMarker)).toHaveLength(2);
    expect(text.indexOf(summaryMarker)).toBeGreaterThan(text.indexOf(comparisonMarker));
    expect(text.indexOf(summaryMarker)).toBeGreaterThan(text.indexOf('</div>'));
  });

  it('keeps the summary last when no plan is selected', async () => {
    const base = await loadViewModel();
    const viewModel = { ...base, addOns: [] };
    const text = flatten(renderAfterPlans(stateFor(viewModel, undefined)));
    expect(text.split(summaryMarker)).toHaveLength(2);
    expect(text.indexOf(comparisonMarker)).toBeGreaterThan(-1);
    expect(text.indexOf(summaryMarker)).toBeGreaterThan(text.indexOf(comparisonMarker));
  });

  it('renders the summary once, inside the add-ons, when the pricing has add-ons', async () => {
    const viewModel = await loadViewModel();
    expect(viewModel.addOns.length).toBeGreaterThan(0);
    const text = flatten(renderAfterPlans(stateFor(viewModel, viewModel.plans[0]!.id)));
    expect(text.split(summaryMarker)).toHaveLength(2);
    expect(text.indexOf(comparisonMarker)).toBeGreaterThan(-1);
    expect(text.indexOf(summaryMarker)).toBeGreaterThan(text.indexOf('data-pr-part="add-ons"'));
    expect(text.indexOf('data-pr-part="add-ons"')).toBeGreaterThan(text.indexOf(comparisonMarker));
  });
});
