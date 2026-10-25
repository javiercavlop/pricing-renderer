import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { createPricingViewModel } from '../../src/core/index.js';
import type { PricingViewModel } from '../../src/core/index.js';
import { renderAddOns } from '../../src/element/renderers.js';
import type { RenderActions, RenderState } from '../../src/element/renderers.js';
import { parsePricingYaml } from '../../src/yaml/index.js';

// SPECTRA item 7 over the SPECTRA fixtures (latest year per SaaS), default options and nothing
// selected: which pricings are dense, which get the filter and how many cards render at first.

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const fixturesRoot = join(repoRoot, 'tests/fixtures/spectra');

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

function count(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

interface Result {
  saas: string;
  addOns: number;
  dense: boolean;
  filter: boolean;
  main: boolean;
  denseCards: number;
  cards: number;
  more: number | undefined;
  counter: string | undefined;
}

// The latest year of every SaaS, as tests/browser/helpers/spectra.ts picks them.
function loadViewModels(): Array<{ saas: string; viewModel: PricingViewModel }> {
  return readdirSync(fixturesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const years = readdirSync(join(fixturesRoot, entry.name))
        .filter((file) => file.endsWith('.yml'))
        .sort();
      return { saas: entry.name, file: years[years.length - 1] };
    })
    .filter((item): item is { saas: string; file: string } => item.file !== undefined)
    .sort((a, b) => a.saas.localeCompare(b.saas))
    .map(({ saas, file }) => {
      const parsed = parsePricingYaml(readFileSync(join(fixturesRoot, saas, file), 'utf8'));
      if (!parsed.value) throw new Error(`Cannot parse ${saas}/${file}`);
      return { saas, viewModel: createPricingViewModel(parsed.value) };
    });
}

function measure(saas: string, viewModel: PricingViewModel): Result {
  const text = flatten(renderAddOns(stateFor(viewModel)));
  const more = /<button[^>]*pr-button--quiet[^>]*>\s*Show (\d+) more\s*<\/button>/.exec(text);
  const toolbar = text.indexOf('data-pr-part="addon-toolbar"');
  const counter =
    toolbar < 0
      ? null
      : /<span aria-live="polite">\s*([^<]*?)\s*<\/span>/.exec(text.slice(toolbar));
  return {
    saas,
    addOns: viewModel.addOns.length,
    dense: text.includes('pr-addon-grid--dense'),
    filter: text.includes('data-pr-part="addon-toolbar"'),
    main: text.includes('pr-addon-main'),
    denseCards: count(text, /pr-addon-card--dense/g),
    cards: count(text, /data-pr-part="add-on-card"/g),
    more: more ? Number(more[1]) : undefined,
    counter: counter?.[1],
  };
}

// Add-on counts of the pricings that are dense (more than 8), from the spec.
const FILTER = ['github', 'okta', 'salesforce', 'zoom'];
const DENSE_ONLY = ['box', 'postman', 'userguiding'];

describe('SPECTRA fixtures add-on grid', () => {
  let results: Result[] = [];

  beforeAll(() => {
    results = loadViewModels().map(({ saas, viewModel }) => measure(saas, viewModel));
  });

  const byName = (saas: string): Result => {
    const found = results.find((item) => item.saas === saas);
    if (!found) throw new Error(`No fixture ${saas}`);
    return found;
  };

  it('loads the 37 fixtures', () => {
    expect(results).toHaveLength(37);
  });

  // [utest->req~addon-grid-dense-details~1]
  it('is dense exactly when there are more than 8 add-ons', () => {
    for (const item of results) {
      expect(item.dense, `${item.saas} (${item.addOns} add-ons)`).toBe(item.addOns > 8);
      expect(item.denseCards, item.saas).toBe(item.addOns > 8 ? item.cards : 0);
    }
  });

  // [utest->req~addon-grid-filter~1]
  it('has the filter exactly when there are more than 13 add-ons', () => {
    for (const item of results) {
      expect(item.filter, `${item.saas} (${item.addOns} add-ons)`).toBe(item.addOns > 13);
      expect(item.main, item.saas).toBe(item.addOns > 13);
    }
  });

  // [utest->req~addon-grid-cap~1]
  it('renders at most 8 cards at first, and every card without the filter', () => {
    for (const item of results) {
      const expected = item.addOns > 13 ? 8 : item.addOns;
      expect(item.cards, `${item.saas} (${item.addOns} add-ons)`).toBe(expected);
      expect(item.cards, item.saas).toBeLessThanOrEqual(item.filter ? 8 : item.addOns);
    }
  });

  // [utest->req~addon-grid-cap~1]
  it('offers a show-more button for the hidden add-ons only', () => {
    for (const item of results) {
      const hidden = item.addOns > 13 ? item.addOns - 8 : undefined;
      expect(item.more, item.saas).toBe(hidden);
    }
  });

  // [utest->req~addon-grid-filter~1]
  it('counts the rendered cards of the total in the filter pricings', () => {
    for (const item of results.filter((candidate) => candidate.filter)) {
      expect(item.counter, item.saas).toBe(`8 of ${item.addOns} items`);
    }
  });

  // [utest->req~addon-grid-filter~1]
  describe.each([
    ['okta', 18, 10],
    ['zoom', 16, 8],
    ['salesforce', 14, 6],
    ['github', 14, 6],
  ])('%s', (saas, addOns, hidden) => {
    it(`is dense with the filter, ${addOns} add-ons, 8 cards and show ${hidden} more`, () => {
      const item = byName(saas);
      expect(item.addOns).toBe(addOns);
      expect(item.dense).toBe(true);
      expect(item.filter).toBe(true);
      expect(item.cards).toBe(8);
      expect(item.more).toBe(hidden);
      expect(item.counter).toBe(`8 of ${addOns} items`);
    });
  });

  // [utest->req~addon-grid-filter~1]
  describe.each([
    ['postman', 12],
    ['userguiding', 11],
    ['box', 9],
  ])('%s', (saas, addOns) => {
    it(`is dense only, with every one of ${addOns} cards and no button`, () => {
      const item = byName(saas);
      expect(item.addOns).toBe(addOns);
      expect(item.dense).toBe(true);
      expect(item.filter).toBe(false);
      expect(item.main).toBe(false);
      expect(item.cards).toBe(addOns);
      expect(item.more).toBeUndefined();
      expect(item.counter).toBeUndefined();
    });
  });

  // [utest->req~addon-grid-no-look-change~1]
  it('leaves the other pricings with the plain grid', () => {
    const others = results.filter((item) => ![...FILTER, ...DENSE_ONLY].includes(item.saas));
    expect(others).toHaveLength(30);
    for (const item of others) {
      expect(item.addOns, item.saas).toBeLessThanOrEqual(8);
      expect(item.dense, item.saas).toBe(false);
      expect(item.filter, item.saas).toBe(false);
      expect(item.cards, item.saas).toBe(item.addOns);
      expect(item.more, item.saas).toBeUndefined();
    }
  });
});
