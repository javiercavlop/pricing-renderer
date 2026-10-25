import { describe, expect, it } from 'vitest';
import { createPricingViewModel, getMessages } from '../../src/core/index.js';
import type { PricingViewModel } from '../../src/core/index.js';
import { renderAddOns } from '../../src/element/renderers.js';
import type { RenderActions, RenderState } from '../../src/element/renderers.js';
import { parsePricingYaml } from '../../src/yaml/index.js';

// SPECTRA item 7 (docs/agent-work/spectra-item7-addon-grid/spec.md): the add-on filter mode, the cap
// of 8 cards, the show-more button, the search and the empty state. The new state fields and
// actions are reached through intersection types, so a missing one fails when the test runs and not
// when the file loads.

type FilterActions = RenderActions & {
  updateAddOnSearch?: (value: string) => void;
  revealAddOns?: () => void;
};

type FilterState = Omit<RenderState, 'actions'> & {
  actions: FilterActions;
  addOnSearch?: string;
  addOnsRevealed?: boolean;
  addOnFilterThreshold?: number;
};

const noop = (): void => undefined;
const baseActions: FilterActions = {
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
  selected: string[] = [],
  overrides: Partial<FilterState> = {},
): FilterState {
  const addOns = Object.fromEntries(selected.map((id) => [id, { selected: true, quantity: 1 }]));
  return {
    viewModel,
    selection: { ...viewModel.resolved.selection, planId: 'one', addOns },
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
    actions: baseActions,
    ...overrides,
  };
}

interface RepeatResult {
  values: unknown[];
}

const isDirectiveResult = (value: unknown): value is RepeatResult =>
  typeof value === 'object' && value !== null && '_$litDirective$' in value && 'values' in value;

// The items of a repeat() result as the rendered templates: values hold [items, keyFn, template]
// or [items, template].
function unwrapRepeat(result: RepeatResult): unknown[] {
  const [items, second, third] = result.values as [
    unknown[],
    unknown,
    ((item: unknown, index: number) => unknown) | undefined,
  ];
  const template = (typeof third === 'function' ? third : second) as (
    item: unknown,
    index: number,
  ) => unknown;
  return [...items].map((item, index) => template(item, index));
}

// Flattens a lit template (strings and values, nested templates and arrays) into plain text.
function flatten(template: unknown): string {
  if (isDirectiveResult(template)) return flatten(unwrapRepeat(template));
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

interface Handler {
  before: string;
  fn: (event?: unknown) => void;
}

// The event handlers of a template, each with the text rendered before it, so a test can find the
// handler of one element and call it (flatten drops functions).
function handlersOf(template: unknown): Handler[] {
  const found: Handler[] = [];
  let text = '';
  const walk = (node: unknown): void => {
    if (isDirectiveResult(node)) {
      walk(unwrapRepeat(node));
    } else if (Array.isArray(node)) {
      node.forEach(walk);
    } else if (typeof node === 'string' || typeof node === 'number') {
      text += String(node);
    } else if (typeof node === 'function') {
      found.push({ before: text, fn: node as Handler['fn'] });
    } else if (typeof node === 'object' && node !== null && 'strings' in node) {
      const { strings, values } = node as { strings: string[]; values: unknown[] };
      strings.forEach((part, index) => {
        text += part;
        if (index < values.length) walk(values[index]);
      });
    }
  };
  walk(template);
  return found;
}

function handlerFor(template: unknown, attribute: string, tag: string, hint = ''): Handler {
  const handler = handlersOf(template).find((candidate) => {
    if (!candidate.before.endsWith(`${attribute}=`)) return false;
    const open = candidate.before.slice(candidate.before.lastIndexOf('<'));
    return open.startsWith(`<${tag}`) && open.includes(hint);
  });
  expect(handler, `${attribute} handler on <${tag}> ${hint}`).toBeDefined();
  return handler ?? { before: '', fn: noop };
}

function count(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

interface AddOnSpec {
  name?: string;
  description?: string;
}

// A pricing with `total` add-ons a01, a02, ...; `special` overrides single add-ons by id.
function syntheticYaml(total: number, special: Record<string, AddOnSpec> = {}): string {
  const lines: string[] = [
    "syntaxVersion: '3.1'",
    'saasName: Synthetic Co',
    "version: '2026.01'",
    "createdAt: '2026-01-01'",
    'currency: EUR',
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
  for (let index = 1; index <= total; index += 1) {
    const id = `a${String(index).padStart(2, '0')}`;
    const spec = special[id] ?? {};
    lines.push(
      `  ${id}:`,
      `    name: ${spec.name ?? `Module ${id}`}`,
      `    description: ${spec.description ?? `Generic module ${id}`}`,
      '    price: 5',
      '    unit: month',
    );
  }
  return `${lines.join('\n')}\n`;
}

const SPECIAL: Record<string, AddOnSpec> = {
  a05: { name: 'Enterprise sso' },
  a07: { description: 'Adds SSO support' },
  a12: { name: 'Twelfth' },
};

function synthetic(total = 18, locale?: string): PricingViewModel {
  const parsed = parsePricingYaml(syntheticYaml(total, SPECIAL));
  if (!parsed.value) {
    throw new Error(`Cannot parse the pricing: ${JSON.stringify(parsed.diagnostics)}`);
  }
  const viewModel = createPricingViewModel(parsed.value);
  return locale ? { ...viewModel, messages: getMessages(locale) } : viewModel;
}

const render = (
  viewModel: PricingViewModel,
  selected: string[] = [],
  overrides: Partial<FilterState> = {},
): string => flatten(renderAddOns(stateFor(viewModel, selected, overrides) as RenderState));

// The ids of the rendered cards, in order.
function idsOf(text: string): string[] {
  return [...text.matchAll(/data-pr-part="add-on-card"[^>]*?data-add-on-id="?([\w-]+)/g)].map(
    (match) => match[1]!,
  );
}

// The toolbar markup, from its marker to the start of the grid.
function toolbarOf(text: string): string {
  const start = text.indexOf('data-pr-part="addon-toolbar"');
  expect(start, 'the add-on toolbar is rendered').toBeGreaterThanOrEqual(0);
  return text.slice(start, text.indexOf('pr-addon-grid', start));
}

function counterOf(text: string): [number, number] {
  const toolbar = toolbarOf(text);
  const live = /<span aria-live="polite">([^<]*)<\/span>/.exec(toolbar);
  const match = /(\d+) (?:of|de) (\d+)/.exec(live?.[1] ?? '');
  expect(match, `a counter in ${toolbar}`).not.toBeNull();
  if (!match) return [-1, -1];
  return [Number(match[1]), Number(match[2])];
}

const showMore = (text: string): RegExpExecArray | null =>
  /<button[^>]*pr-button--quiet[^>]*>\s*([^<]*?)\s*<\/button>/.exec(text);

const moreLabel = (text: string): string | undefined => showMore(text)?.[1];

const first = (total: number): string[] =>
  Array.from({ length: total }, (_, index) => `a${String(index + 1).padStart(2, '0')}`);

// [utest->req~addon-grid-filter~1]
describe('filter mode markup', () => {
  const text = render(synthetic());

  it('wraps the toolbar and the grid in pr-addon-main, before the summary', () => {
    const main = text.indexOf('<div class="pr-addon-main">');
    const toolbar = text.indexOf('data-pr-part="addon-toolbar"');
    const grid = text.indexOf('pr-addon-grid');
    const summary = text.indexOf('data-pr-part="summary"');
    expect(main).toBeGreaterThan(text.indexOf('pr-addon-layout'));
    expect(toolbar).toBeGreaterThan(main);
    expect(grid).toBeGreaterThan(toolbar);
    expect(summary).toBeGreaterThan(grid);
  });

  it('renders the toolbar with its own class, not the comparison toolbar class', () => {
    expect(text).toContain('<div class="pr-addon-toolbar" data-pr-part="addon-toolbar">');
    expect(toolbarOf(text)).not.toContain('pr-comparison-toolbar');
  });

  it('renders a search input with the add-on label and placeholder', () => {
    const toolbar = toolbarOf(text);
    expect(toolbar).toContain('<label class="pr-search">');
    expect(toolbar).toContain('<input');
    expect(toolbar).toMatch(/type="?search"?/);
    expect(toolbar).toMatch(/placeholder="?Search add-ons"?/);
    expect(toolbar).toMatch(/<span class="pr-sr-only">\s*Search add-ons\s*<\/span>/);
  });

  it('prints the counter in a polite live region', () => {
    expect(counterOf(text)).toEqual([8, 18]);
    expect(toolbarOf(text)).toMatch(/<span aria-live="polite">\s*8 of 18 items\s*<\/span>/);
  });

  it('keeps the grid dense', () => {
    expect(text).toContain('pr-addon-grid--dense');
  });
});

// [utest->req~addon-grid-cap~1]
describe('cap of 8 cards', () => {
  it('renders the first 8 add-ons and a show-more button', () => {
    const text = render(synthetic());
    expect(idsOf(text)).toEqual(first(8));
    expect(moreLabel(text)).toBe('Show 10 more');
  });

  it('adds every selected add-on after the cap, in the original order', () => {
    const text = render(synthetic(), ['a12']);
    expect(idsOf(text)).toEqual([...first(8), 'a12']);
    expect(moreLabel(text)).toBe('Show 9 more');
    expect(counterOf(text)).toEqual([9, 18]);
  });

  it('does not count a selected add-on inside the cap twice', () => {
    const text = render(synthetic(), ['a03', 'a18', 'a10']);
    expect(idsOf(text)).toEqual([...first(8), 'a10', 'a18']);
    expect(moreLabel(text)).toBe('Show 8 more');
  });

  it('shows no button when nothing is hidden', () => {
    const text = render(synthetic(14), ['a09', 'a10', 'a11', 'a12', 'a13', 'a14']);
    expect(idsOf(text)).toEqual(first(14));
    expect(showMore(text)).toBeNull();
    expect(counterOf(text)).toEqual([14, 14]);
  });

  it('renders every add-on and no button once revealed', () => {
    const text = render(synthetic(), [], { addOnsRevealed: true });
    expect(idsOf(text)).toEqual(first(18));
    expect(showMore(text)).toBeNull();
    expect(counterOf(text)).toEqual([18, 18]);
    expect(toolbarOf(text)).toContain('Search add-ons');
  });

  it('calls revealAddOns from the button', () => {
    const reveal = { calls: 0 };
    const actions: FilterActions = {
      ...baseActions,
      revealAddOns: () => {
        reveal.calls += 1;
      },
    };
    const template = renderAddOns(stateFor(synthetic(), [], { actions }) as RenderState);
    handlerFor(template, '@click', 'button', 'pr-button--quiet').fn();
    expect(reveal.calls).toBe(1);
  });

  it('hands the typed text to updateAddOnSearch', () => {
    const seen: string[] = [];
    const actions: FilterActions = {
      ...baseActions,
      updateAddOnSearch: (value) => seen.push(value),
    };
    const template = renderAddOns(stateFor(synthetic(), [], { actions }) as RenderState);
    handlerFor(template, '@input', 'input').fn({
      target: { value: 'sso' },
      currentTarget: { value: 'sso' },
    });
    expect(seen).toEqual(['sso']);
  });

  it('keeps the show-more button below the grid', () => {
    const text = render(synthetic());
    expect(text.indexOf('pr-button--quiet')).toBeGreaterThan(text.lastIndexOf('add-on-card'));
  });
});

// The repeat() results found in a template tree.
function repeatsOf(node: unknown, found: RepeatResult[] = []): RepeatResult[] {
  if (isDirectiveResult(node)) {
    found.push(node);
  } else if (Array.isArray(node)) {
    node.forEach((child) => repeatsOf(child, found));
  } else if (typeof node === 'object' && node !== null && 'values' in node) {
    (node as RepeatResult).values.forEach((child) => repeatsOf(child, found));
  }
  return found;
}

// [utest->req~addon-grid-cap~1]
describe('keyed rendering', () => {
  const keysOf = (overrides: Partial<FilterState> = {}, selected: string[] = []): unknown[] => {
    const state = stateFor(synthetic(), selected, overrides) as RenderState;
    const grids = repeatsOf(renderAddOns(state));
    expect(grids).toHaveLength(1);
    const [items, keyFn] = grids[0]!.values as [{ id: string }[], (item: { id: string }) => string];
    return items.map((item) => keyFn(item));
  };

  it('keys the visible cards by add-on id, in order', () => {
    expect(keysOf()).toEqual(first(8));
    expect(keysOf({ addOnsRevealed: true })).toEqual(first(18));
    expect(keysOf({ addOnSearch: 'sso' })).toEqual(['a05', 'a07']);
    expect(keysOf({}, ['a12'])).toEqual([...first(8), 'a12']);
  });

  it('keeps the plain list below the filter threshold', () => {
    const state = stateFor(synthetic(8), [], {}) as RenderState;
    expect(repeatsOf(renderAddOns(state))).toHaveLength(0);
  });
});

// [utest->req~addon-grid-cap~1]
describe('search', () => {
  it('matches the name and the description, trimmed and case-insensitive', () => {
    for (const addOnSearch of ['SSO', 'sso', ' SSO ', '\tSso\n']) {
      const text = render(synthetic(), [], { addOnSearch });
      expect(idsOf(text), JSON.stringify(addOnSearch)).toEqual(['a05', 'a07']);
      expect(showMore(text), JSON.stringify(addOnSearch)).toBeNull();
      expect(counterOf(text), JSON.stringify(addOnSearch)).toEqual([2, 18]);
    }
  });

  it('matches the name alone', () => {
    expect(idsOf(render(synthetic(), [], { addOnSearch: 'enterprise' }))).toEqual(['a05']);
  });

  it('matches the description alone', () => {
    expect(idsOf(render(synthetic(), [], { addOnSearch: 'adds' }))).toEqual(['a07']);
  });

  it('renders every match, beyond the cap, without the button', () => {
    const text = render(synthetic(), [], { addOnSearch: 'module' });
    expect(idsOf(text)).toEqual(first(18));
    expect(showMore(text)).toBeNull();
  });

  it('adds the selected add-ons to the matches, in the original order', () => {
    const text = render(synthetic(), ['a12'], { addOnSearch: ' SSO ' });
    expect(idsOf(text)).toEqual(['a05', 'a07', 'a12']);
    expect(showMore(text)).toBeNull();
    expect(counterOf(text)).toEqual([3, 18]);
  });

  it('never hides a selected add-on that does not match', () => {
    const text = render(synthetic(), ['a12'], { addOnSearch: 'zzzz-no-match' });
    expect(idsOf(text)).toEqual(['a12']);
    expect(text).not.toContain('addon-empty');
    expect(showMore(text)).toBeNull();
    expect(counterOf(text)).toEqual([1, 18]);
  });

  it('ignores a blank search like an empty one', () => {
    const text = render(synthetic(), [], { addOnSearch: '   ' });
    expect(idsOf(text)).toEqual(first(8));
    expect(moreLabel(text)).toBe('Show 10 more');
  });

  it('shows the matches of a search even when the add-ons are revealed', () => {
    const text = render(synthetic(), [], { addOnSearch: 'sso', addOnsRevealed: true });
    expect(idsOf(text)).toEqual(['a05', 'a07']);
  });

  it('is ignored outside filter mode', () => {
    const text = render(synthetic(12), [], { addOnSearch: 'sso' });
    expect(idsOf(text)).toEqual(first(12));
    expect(text).not.toContain('data-pr-part="addon-toolbar"');
    expect(text).not.toContain('addon-empty');
    expect(showMore(text)).toBeNull();
    const small = render(synthetic(5), [], { addOnSearch: 'zzzz-no-match' });
    expect(idsOf(small)).toEqual(first(5));
    expect(small).not.toContain('addon-empty');
  });

  it('is ignored when the threshold turns the filter off', () => {
    const text = render(synthetic(), [], { addOnSearch: 'zzzz', addOnFilterThreshold: 20 });
    expect(idsOf(text)).toEqual(first(18));
    expect(text).not.toContain('addon-toolbar');
  });
});

// [utest->req~addon-grid-cap~1]
describe('empty state', () => {
  const text = render(synthetic(), [], { addOnSearch: 'zzzz-no-match' });

  it('renders the empty paragraph and no card', () => {
    expect(idsOf(text)).toEqual([]);
    expect(text).toMatch(
      /<p class="pr-empty" role="status" data-pr-part="addon-empty">\s*No matching items\s*<\/p>/,
    );
    expect(count(text, /data-pr-part="addon-empty"/g)).toBe(1);
  });

  it('keeps the toolbar and counts zero cards', () => {
    expect(text).toContain('data-pr-part="addon-toolbar"');
    expect(counterOf(text)).toEqual([0, 18]);
  });

  it('renders no show-more button', () => {
    expect(showMore(text)).toBeNull();
  });

  it('keeps the summary in the layout', () => {
    expect(text).toContain('data-pr-part="summary"');
  });
});

// [utest->req~addon-grid-filter~1]
describe('es locale', () => {
  it('translates the toolbar, the counter and the button', () => {
    const text = render(synthetic(18, 'es'));
    const toolbar = toolbarOf(text);
    expect(toolbar).toMatch(/placeholder="?Buscar complementos"?/);
    expect(toolbar).toMatch(/<span class="pr-sr-only">\s*Buscar complementos\s*<\/span>/);
    expect(toolbar).toMatch(/<span aria-live="polite">\s*8 de 18 elementos\s*<\/span>/);
    expect(moreLabel(text)).toBe('Mostrar 10 más');
    expect(text).not.toContain('Search add-ons');
  });

  it('translates the empty state', () => {
    const text = render(synthetic(18, 'es'), [], { addOnSearch: 'zzzz-no-match' });
    expect(text).toMatch(/data-pr-part="addon-empty"[^>]*>\s*Sin resultados\s*<\/p>/);
    expect(toolbarOf(text)).toMatch(/0 de 18 elementos/);
  });
});
