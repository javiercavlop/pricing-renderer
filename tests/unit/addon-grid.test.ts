import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createPricingViewModel, getMessages } from '../../src/core/index.js';
import type { PricingViewModel } from '../../src/core/index.js';
import * as renderers from '../../src/element/renderers.js';
import type { RenderActions, RenderState } from '../../src/element/renderers.js';
import { parsePricingYaml } from '../../src/yaml/index.js';

// SPECTRA item 7 (docs/agent-work/spectra-item7-addon-grid/spec.md): dense add-on cards, the
// threshold exports and the unchanged look of small pricings. The new exports are reached through a
// typed cast and the new state fields through an intersection type, so a missing one fails when the
// test runs and not when the file loads.

interface AddOnGridApi {
  ADDON_DENSE_THRESHOLD: number;
  ADDON_VISIBLE_CAP: number;
  DEFAULT_ADDON_FILTER_THRESHOLD: number;
  addOnFilterThresholdOf(value: unknown): number;
}

const api = renderers as unknown as typeof renderers & AddOnGridApi;
const { renderAddOns } = renderers;

type GridState = RenderState & {
  addOnSearch?: string;
  addOnsRevealed?: boolean;
  addOnFilterThreshold?: number;
};

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
  overrides: Partial<GridState> = {},
  planId = 'one',
): GridState {
  return {
    viewModel,
    selection: { ...viewModel.resolved.selection, planId },
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

interface AddOnSpec {
  name?: string;
  description?: string;
  availableFor?: string[];
  dependsOn?: string[];
  excludes?: string[];
  constraints?: boolean;
  effect?: boolean;
}

// A pricing with `total` add-ons a01, a02, ...; `special` overrides single add-ons by id.
function syntheticYaml(total: number, special: Record<string, AddOnSpec> = {}): string {
  const lines: string[] = [
    "syntaxVersion: '3.1'",
    'saasName: Synthetic Co',
    "version: '2026.01'",
    "createdAt: '2026-01-01'",
    'currency: EUR',
    'features:',
    '  fx:',
    '    name: Feature FX',
    '    tag: General',
    '    valueType: BOOLEAN',
    '    defaultValue: false',
    'plans:',
    '  one:',
    '    name: Plan One',
    '    price: 10',
    '    unit: month',
    '  two:',
    '    name: Plan Two',
    '    price: 20',
    '    unit: month',
    'addOns:',
  ];
  const ids = Array.from({ length: total }, (_, index) => `a${String(index + 1).padStart(2, '0')}`);
  for (const id of ids) {
    const spec = special[id] ?? {};
    lines.push(`  ${id}:`, `    name: ${spec.name ?? `Module ${id}`}`);
    lines.push(`    description: ${spec.description ?? `Generic module ${id}`}`);
    if (spec.availableFor) {
      lines.push('    availableFor:', ...spec.availableFor.map((plan) => `      - ${plan}`));
    }
    if (spec.dependsOn) {
      lines.push('    dependsOn:', ...spec.dependsOn.map((other) => `      - ${other}`));
    }
    if (spec.excludes) {
      lines.push('    excludes:', ...spec.excludes.map((other) => `      - ${other}`));
    }
    if (spec.constraints) {
      lines.push(
        '    subscriptionConstraints:',
        '      minQuantity: 1',
        '      maxQuantity: 5',
        '      quantityStep: 1',
      );
    }
    lines.push('    price: 5', '    unit: month');
    if (spec.effect) lines.push('    features:', '      fx:', '        value: true');
  }
  return `${lines.join('\n')}\n`;
}

function synthetic(
  total: number,
  special: Record<string, AddOnSpec> = {},
  locale?: string,
): PricingViewModel {
  const parsed = parsePricingYaml(syntheticYaml(total, special));
  if (!parsed.value) {
    throw new Error(`Cannot parse the pricing: ${JSON.stringify(parsed.diagnostics)}`);
  }
  const viewModel = createPricingViewModel(parsed.value);
  return locale ? { ...viewModel, messages: getMessages(locale) } : viewModel;
}

const render = (viewModel: PricingViewModel, overrides: Partial<GridState> = {}, planId = 'one') =>
  flatten(renderAddOns(stateFor(viewModel, overrides, planId)));

const cardCount = (text: string): number => count(text, /data-pr-part="add-on-card"/g);
const TOOLBAR = 'data-pr-part="addon-toolbar"';

// The markup of one card: from its opening marker to the next card (or the end of the text).
function cardOf(text: string, id: string): string {
  const chunk = text
    .split('<article')
    .slice(1)
    .find((candidate) => new RegExp(`data-add-on-id="?${id}"?[\\s>]`).test(candidate));
  if (!chunk) throw new Error(`No rendered card ${id}`);
  return chunk;
}

function disclosureOf(card: string): string | undefined {
  const start = card.indexOf('<details class="pr-addon-effects"');
  if (start < 0) return undefined;
  return card.slice(start, card.indexOf('</details>', start));
}

describe('add-on threshold exports', () => {
  // [utest->req~addon-grid-dense-details~1]
  it('exports the dense threshold 8', () => {
    expect(api.ADDON_DENSE_THRESHOLD).toBe(8);
  });

  // [utest->req~addon-grid-cap~1]
  it('exports the visible cap 8', () => {
    expect(api.ADDON_VISIBLE_CAP).toBe(8);
  });

  // [utest->req~addon-grid-filter~1]
  it('exports the default filter threshold 13', () => {
    expect(api.DEFAULT_ADDON_FILTER_THRESHOLD).toBe(13);
  });
});

// [utest->req~addon-grid-threshold-attribute~1]
describe('addOnFilterThresholdOf', () => {
  it('keeps a finite number of 0 or more', () => {
    expect(api.addOnFilterThresholdOf(13)).toBe(13);
    expect(api.addOnFilterThresholdOf(0)).toBe(0);
    expect(api.addOnFilterThresholdOf(5)).toBe(5);
    expect(api.addOnFilterThresholdOf(20)).toBe(20);
  });

  it('falls back to 13 for anything else', () => {
    const invalid: unknown[] = [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      -1,
      -5,
      null,
      undefined,
      'abc',
      '20',
    ];
    for (const value of invalid) {
      expect(api.addOnFilterThresholdOf(value), String(value)).toBe(13);
    }
  });
});

// [utest->req~addon-grid-threshold-attribute~1]
describe('add-on filter threshold in the state', () => {
  const hasToolbar = (total: number, addOnFilterThreshold?: number): boolean =>
    render(synthetic(total), { addOnFilterThreshold }).includes(TOOLBAR);

  it('defaults to 13 when absent', () => {
    expect(hasToolbar(13)).toBe(false);
    expect(hasToolbar(14)).toBe(true);
  });

  it('turns the filter on from the first add-on with 0', () => {
    expect(hasToolbar(1, 0)).toBe(true);
    const text = render(synthetic(5), { addOnFilterThreshold: 0 });
    expect(text).toContain(TOOLBAR);
    expect(cardCount(text)).toBe(5);
    expect(text).not.toContain('pr-button--quiet');
  });

  it('turns the filter off above the add-on count', () => {
    expect(hasToolbar(18, 20)).toBe(false);
    expect(cardCount(render(synthetic(18), { addOnFilterThreshold: 20 }))).toBe(18);
    expect(hasToolbar(14, 14)).toBe(false);
    expect(hasToolbar(15, 14)).toBe(true);
  });

  it('behaves as 13 for an invalid value', () => {
    for (const threshold of [Number.NaN, -5, Number.POSITIVE_INFINITY]) {
      expect(hasToolbar(13, threshold), `${threshold}, 13`).toBe(false);
      expect(hasToolbar(14, threshold), `${threshold}, 14`).toBe(true);
    }
  });
});

// [utest->req~addon-grid-no-look-change~1]
describe('the demo pricing keeps its look', () => {
  const source = readFileSync(join(repoRoot, 'tests/fixtures/acme-pricing.yml'), 'utf8');
  const parsed = parsePricingYaml(source);
  const acme = createPricingViewModel(parsed.value!);
  const text = render(acme, {}, acme.plans[0]!.id);

  it('has 3 add-ons', () => {
    expect(acme.addOns).toHaveLength(3);
    expect(cardCount(text)).toBe(3);
  });

  it('renders the plain grid with plain cards', () => {
    expect(text).toContain('<div class="pr-addon-grid">');
    expect(text).not.toContain('pr-addon-grid--dense');
    expect(text).not.toContain('pr-addon-card--dense');
  });

  it('has no wrapper, toolbar, counter or show-more button', () => {
    expect(text).not.toContain('pr-addon-main');
    expect(text).not.toContain('pr-addon-toolbar');
    expect(text).not.toContain(TOOLBAR);
    expect(text).not.toContain('addon-empty');
    expect(text).not.toContain('pr-button--quiet');
    expect(text).not.toContain('pricing.moreDetails');
    expect(text).not.toContain('More details');
  });

  it('keeps the effects summary and the paragraphs in the always-visible area', () => {
    expect(text).toContain('<summary>What this add-on changes</summary>');
    expect(text).not.toContain('<summary>More details</summary>');
    const card = cardOf(text, 'prioritySuccess');
    const disclosure = disclosureOf(card);
    expect(disclosure).toBeUndefined();
    expect(card).toContain('Requires');
    const storage = cardOf(text, 'extraStorage');
    const effects = disclosureOf(storage)!;
    expect(effects).toContain('What this add-on changes');
    expect(effects).not.toContain('Available for');
    expect(storage.indexOf('Available for')).toBeLessThan(storage.indexOf('<details'));
  });

  it('keeps the summary a sibling of the add-on grid in the layout', () => {
    expect(text).toContain('pr-addon-layout');
    expect(text).not.toContain('pr-addon-main');
  });
});

describe('dense mode threshold', () => {
  // [utest->req~addon-grid-no-look-change~1]
  it('is off for 8 add-ons or fewer', () => {
    for (const total of [1, 5, 8]) {
      const text = render(synthetic(total));
      expect(text, `${total} add-ons`).not.toContain('pr-addon-grid--dense');
      expect(text, `${total} add-ons`).not.toContain('pr-addon-card--dense');
      expect(text, `${total} add-ons`).not.toContain(TOOLBAR);
    }
  });

  // [utest->req~addon-grid-dense-details~1]
  it('is on from 9 add-ons, with a dense card each', () => {
    for (const total of [9, 10]) {
      const text = render(synthetic(total));
      expect(text, `${total} add-ons`).toContain('pr-addon-grid--dense');
      expect(count(text, /pr-addon-card--dense/g), `${total} add-ons`).toBe(total);
      expect(cardCount(text), `${total} add-ons`).toBe(total);
    }
  });

  // [utest->req~addon-grid-filter~1]
  it('is dense only, without toolbar or wrapper, up to 13 add-ons', () => {
    const text = render(synthetic(13));
    expect(text).toContain('pr-addon-grid--dense');
    expect(text).not.toContain(TOOLBAR);
    expect(text).not.toContain('pr-addon-main');
    expect(cardCount(text)).toBe(13);
  });
});

// [utest->req~addon-grid-dense-details~1]
describe('dense details', () => {
  const special: Record<string, AddOnSpec> = {
    a02: { name: 'SSO login', availableFor: ['one'] },
    a03: { name: 'Locked', availableFor: ['two'] },
    a04: { name: 'Effectful', effect: true },
    a05: { name: 'Both', availableFor: ['one', 'two'], effect: true },
    a06: { name: 'Linked', dependsOn: ['a01'], excludes: ['a07'], constraints: true },
  };

  it('moves the dependency, exclusion and quantity paragraphs into the disclosure', () => {
    const text = render(synthetic(9, special));
    const card = cardOf(text, 'a06');
    const disclosure = disclosureOf(card);
    expect(disclosure).toBeDefined();
    expect(disclosure).toContain('<summary>More details</summary>');
    const paragraphs = ['Requires Module a01', 'Cannot be combined with Module a07', 'Quantity'];
    for (const paragraph of paragraphs) {
      expect(disclosure, paragraph).toContain(paragraph);
      expect(card.indexOf(paragraph), paragraph).toBeGreaterThan(card.indexOf('<details'));
      expect(count(card, new RegExp(paragraph, 'g')), paragraph).toBe(1);
    }
  });

  it('keeps those paragraphs visible below the dense threshold', () => {
    const card = cardOf(render(synthetic(8, special)), 'a06');
    expect(card).not.toContain('<details');
    expect(card).toContain('Requires Module a01');
    expect(card).toContain('Cannot be combined with Module a07');
  });

  it('moves the availability paragraph into the disclosure', () => {
    const text = render(synthetic(9, special));
    const card = cardOf(text, 'a02');
    expect(card).toContain('pr-addon-card--dense');
    const disclosure = disclosureOf(card);
    expect(disclosure).toBeDefined();
    expect(disclosure).toContain('<summary>More details</summary>');
    expect(disclosure).toContain('Available for Plan One');
    expect(card.indexOf('Available for')).toBeGreaterThan(card.indexOf('<details'));
    expect(count(card, /Available for/g)).toBe(1);
  });

  it('keeps the help element of the checkbox even when it is empty', () => {
    const text = render(synthetic(9, special));
    expect(text).toContain('aria-describedby="pr-addon-help-a02"');
    for (const id of ['a01', 'a02', 'a03', 'a04', 'a09']) {
      expect(cardOf(text, id), id).toContain(`id="pr-addon-help-${id}"`);
    }
  });

  it('renders no disclosure for a card without secondary content', () => {
    const text = render(synthetic(9, special));
    const plain = cardOf(text, 'a01');
    expect(plain).toContain('pr-addon-card--dense');
    expect(plain).not.toContain('pr-addon-effects');
    expect(plain).not.toContain('<details');
  });

  it('renders a disclosure for effects alone, summarised as more details', () => {
    const text = render(synthetic(9, special));
    const disclosure = disclosureOf(cardOf(text, 'a04'));
    expect(disclosure).toBeDefined();
    expect(disclosure).toContain('<summary>More details</summary>');
    expect(disclosure).toContain('Feature');
    expect(disclosure).not.toContain('What this add-on changes');
  });

  it('puts the paragraphs and the effects in one disclosure', () => {
    const text = render(synthetic(9, special));
    const card = cardOf(text, 'a05');
    expect(count(card, /<details/g)).toBe(1);
    const disclosure = disclosureOf(card)!;
    expect(disclosure).toContain('Available for Plan One, Plan Two');
    expect(disclosure).toContain('<dl>');
  });

  it('keeps the not available status outside the disclosure', () => {
    const text = render(synthetic(9, special));
    const card = cardOf(text, 'a03');
    const status = card.indexOf('Not available for the selected plan');
    expect(status).toBeGreaterThan(-1);
    const disclosure = disclosureOf(card)!;
    expect(disclosure).toBeDefined();
    expect(disclosure).not.toContain('Not available for the selected plan');
    expect(disclosure).toContain('Available for Plan Two');
    expect(status).toBeLessThan(card.indexOf('<details'));
  });

  it('reads Más detalles in Spanish', () => {
    const text = render(synthetic(9, special, 'es'));
    const disclosure = disclosureOf(cardOf(text, 'a02'))!;
    expect(disclosure).toContain('<summary>Más detalles</summary>');
    expect(disclosure).toContain('Disponible para Plan One');
    expect(text).not.toContain('More details');
  });

  it('defines the new texts in both catalogs', () => {
    expect(getMessages('en-US')['pricing.moreDetails']).toBe('More details');
    expect(getMessages('es')['pricing.moreDetails']).toBe('Más detalles');
    expect(getMessages('en-US')['pricing.searchAddOns']).toBe('Search add-ons');
    expect(getMessages('es')['pricing.searchAddOns']).toBe('Buscar complementos');
  });

  it('keeps the plain paragraphs visible below the dense threshold', () => {
    const text = render(synthetic(8, special));
    const card = cardOf(text, 'a02');
    expect(card).not.toContain('<details');
    expect(card).toContain('Available for Plan One');
  });
});

// [utest->req~addon-grid-total-visible~1]
describe('the summary', () => {
  it('is rendered once, outside the add-on wrapper, in filter mode', () => {
    const filtered = render(synthetic(18));
    const unfiltered = render(synthetic(18), { addOnFilterThreshold: 20 });
    const summary = (text: string): string => {
      const start = text.indexOf('<aside class="pr-summary"');
      return start < 0 ? '' : text.slice(start);
    };
    expect(count(filtered, /data-pr-part="summary"/g)).toBe(1);
    expect(summary(filtered)).not.toBe('');
    expect(summary(filtered)).toBe(summary(unfiltered));
    // The wrapper is closed before the summary starts: its divs balance.
    const main = filtered.indexOf('<div class="pr-addon-main">');
    expect(main).toBeGreaterThan(-1);
    const wrapped = filtered.slice(main, filtered.indexOf('<aside class="pr-summary"'));
    expect(count(wrapped, /<div[\s>]/g)).toBe(count(wrapped, /<\/div\s*>/g));
  });
});
