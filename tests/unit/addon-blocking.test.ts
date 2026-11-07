import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { blockingAddOnIds, createPricingViewModel } from '../../src/core/index.js';
import type { PricingSelection, PricingViewModel } from '../../src/core/index.js';
import { renderAddOns, type RenderActions, type RenderState } from '../../src/element/renderers.js';
import { parsePricingYaml } from '../../src/yaml/index.js';

// An add-on that cannot be combined with one the reader has already picked is shown as blocked,
// the way an add-on the plan does not offer already is: not selectable, and saying so on the card
// instead of waiting for a click to open a dialog. The quantity relation moved to the face of the
// card for the same reason — a dense grid hid it behind a disclosure.

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

function withAddOns(selection: PricingSelection, ids: string[]): PricingSelection {
  const addOns = { ...selection.addOns };
  for (const id of ids) addOns[id] = { ...addOns[id], selected: true };
  return { ...selection, addOns };
}

function stateFor(
  viewModel: PricingViewModel,
  selected: string[] = [],
  // compliance is only offered on enterprise, so the exclusion is the only thing left to decide
  planId: string | undefined = 'enterprise',
): RenderState {
  const base = withAddOns(viewModel.resolved.selection, selected);
  return {
    viewModel,
    selection: planId === undefined ? base : { ...base, planId },
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
  };
}

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

// the card of one add-on, cut out of the rendered grid
function cardOf(text: string, id: string): string {
  const start = text.indexOf(`data-add-on-id=${id}`);
  expect(start, id).toBeGreaterThan(-1);
  const next = text.indexOf('data-pr-part="add-on-card"', start + 1);
  return text.slice(start, next === -1 ? undefined : next);
}

describe('blockingAddOnIds', () => {
  it('names a selected add-on that the pricing excludes, in either direction', async () => {
    const { pricing, resolved } = await loadViewModel();
    // prioritySuccess declares excludes: [compliance]; the relation holds both ways
    expect(
      blockingAddOnIds(pricing, withAddOns(resolved.selection, ['compliance']), 'prioritySuccess'),
    ).toEqual(['compliance']);
    expect(
      blockingAddOnIds(pricing, withAddOns(resolved.selection, ['prioritySuccess']), 'compliance'),
    ).toEqual(['prioritySuccess']);
  });

  it('ignores an excluded add-on that is not selected', async () => {
    const { pricing, resolved } = await loadViewModel();
    expect(blockingAddOnIds(pricing, resolved.selection, 'prioritySuccess')).toEqual([]);
  });

  it('never reports an add-on as blocking itself, so it can be deselected', async () => {
    const { pricing, resolved } = await loadViewModel();
    const selection = withAddOns(resolved.selection, ['compliance', 'prioritySuccess']);
    expect(blockingAddOnIds(pricing, selection, 'compliance')).not.toContain('compliance');
  });

  it('returns nothing for an id the pricing does not define', async () => {
    const { pricing, resolved } = await loadViewModel();
    expect(blockingAddOnIds(pricing, resolved.selection, 'nope')).toEqual([]);
  });
});

describe('the card of a blocked add-on', () => {
  it('is selectable while nothing blocks it', async () => {
    const card = cardOf(flatten(renderAddOns(stateFor(await loadViewModel()))), 'prioritySuccess');
    expect(card).toContain('data-available=true');
    expect(card).not.toContain('Not available with');
  });

  it('turns unavailable and names what blocks it', async () => {
    const viewModel = await loadViewModel();
    const card = cardOf(
      flatten(renderAddOns(stateFor(viewModel, ['compliance']))),
      'prioritySuccess',
    );
    expect(card).toContain('data-available=false');
    expect(card).toContain('data-reason="excluded"');
    // the blocker by name, not the whole list of what this add-on excludes
    const compliance = viewModel.addOns.find((addOn) => addOn.id === 'compliance')!;
    expect(card).toContain(`Not available with ${compliance.name}`);
  });

  it('keeps the blocker itself operable', async () => {
    const card = cardOf(
      flatten(renderAddOns(stateFor(await loadViewModel(), ['compliance']))),
      'compliance',
    );
    expect(card).toContain('data-available=true');
    expect(card).not.toContain('data-reason="excluded"');
  });

  it('says the plan reason, not the exclusion, when both would apply', async () => {
    // on a plan that does not offer compliance, the plan is the reason the reader can act on
    const viewModel = await loadViewModel();
    const starter = viewModel.pricing.plans[0]!.id;
    const card = cardOf(
      flatten(renderAddOns(stateFor(viewModel, ['prioritySuccess'], starter))),
      'compliance',
    );
    expect(card).toContain('data-available=false');
    expect(card).toContain('data-reason="plan"');
    expect(card).not.toContain('data-reason="excluded"');
  });
});

describe('the quantity relation on the face of the card', () => {
  it('is on the card, not inside the details disclosure', async () => {
    const viewModel = await loadViewModel();
    const card = cardOf(flatten(renderAddOns(stateFor(viewModel))), 'extraStorage');
    const quantity = card.indexOf('Up to 10');
    expect(quantity).toBeGreaterThan(-1);
    const disclosure = card.indexOf('<details');
    // either there is no disclosure on this card, or the quantity comes before it
    expect(disclosure === -1 || quantity < disclosure).toBe(true);
  });

  it('survives the dense grid, where the prose is hidden behind the disclosure', async () => {
    const base = await loadViewModel();
    // more than ADDON_DENSE_THRESHOLD add-ons, so the grid renders dense
    const addOns = [...base.addOns];
    while (addOns.length <= 8) {
      const copy = { ...addOns[0]!, id: `${addOns[0]!.id}-${addOns.length}` };
      addOns.push(copy);
    }
    const text = flatten(renderAddOns(stateFor({ ...base, addOns })));
    expect(text).toContain('pr-addon-card--dense');
    expect(text).toContain('Up to 10');
  });
});
