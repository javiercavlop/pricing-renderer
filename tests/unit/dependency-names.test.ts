import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createPricingViewModel } from '../../src/core/index.js';
import type { NormalizedAddOn, PricingViewModel } from '../../src/core/index.js';
import type { PendingAddOnChange } from '../../src/element/events.js';
import {
  renderAddOns,
  renderPendingDialog,
  type RenderActions,
  type RenderState,
} from '../../src/element/renderers.js';
import { parsePricingYaml } from '../../src/yaml/index.js';

async function loadViewModel(
  patch: (addOn: NormalizedAddOn) => NormalizedAddOn,
): Promise<PricingViewModel> {
  const path = fileURLToPath(new URL('../fixtures/acme-pricing.yml', import.meta.url));
  const pricing = parsePricingYaml(await readFile(path, 'utf8')).value!;
  const viewModel = createPricingViewModel(pricing);
  return { ...viewModel, addOns: viewModel.addOns.map(patch) };
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

function stateFor(viewModel: PricingViewModel, pending?: PendingAddOnChange): RenderState {
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
    ...(pending ? { pendingAddOnChange: pending } : {}),
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

const named = (addOn: NormalizedAddOn): NormalizedAddOn => {
  if (addOn.id === 'extraStorage') return { ...addOn, name: 'Storage packs' };
  if (addOn.id === 'compliance') return { ...addOn, name: 'Compliance suite' };
  return addOn;
};

describe('add-on names in dependencies', () => {
  it('shows names in Requires and Cannot be combined with on the card', async () => {
    const text = flatten(renderAddOns(stateFor(await loadViewModel(named))));
    expect(text).toContain('Requires Storage packs');
    expect(text).toContain('Cannot be combined with Compliance suite');
    // The ids still appear in attributes, so the negatives are limited to the phrases.
    expect(text).not.toContain('Requires extraStorage');
    expect(text).not.toContain('Cannot be combined with compliance');
  });

  it('humanizes an identifier that is not in the view model', async () => {
    const viewModel = await loadViewModel((addOn) =>
      addOn.id === 'prioritySuccess'
        ? { ...addOn, dependsOn: ['linkedStorage'], excludes: ['legacy-pack', 'extraStorage'] }
        : named(addOn),
    );
    const text = flatten(renderAddOns(stateFor(viewModel)));
    expect(text).toContain('Requires Linked Storage');
    expect(text).toContain('Cannot be combined with Legacy pack, Storage packs');
    expect(text).not.toContain('Requires linkedStorage');
    expect(text).not.toContain('Cannot be combined with legacy-pack');
  });

  it('shows names in Will add and Will remove in the confirmation dialog', async () => {
    const viewModel = await loadViewModel(named);
    const pending: PendingAddOnChange = {
      addOnId: 'prioritySuccess',
      select: true,
      addIds: ['extraStorage', 'prioritySuccess'],
      removeIds: ['compliance', 'ghostPack'],
    };
    const text = flatten(renderPendingDialog(stateFor(viewModel, pending)));
    expect(text).toContain('Will add: Storage packs, Priority Success');
    expect(text).toContain('Will remove: Compliance suite, Ghost Pack');
    expect(text).not.toContain('Will add: extraStorage');
    expect(text).not.toContain('Will remove: compliance');
  });
});
