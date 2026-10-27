// The element is built in the node environment (no DOM): its render() returns a lit template that
// is flattened to text. The same flow in a real browser is covered by
// tests/browser/element-instance-ids.spec.ts.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nothing } from 'lit';
import { describe, expect, it } from 'vitest';
import { createPricingViewModel } from '../../src/core/index.js';
import type { PricingViewModel } from '../../src/core/index.js';
import {
  renderAddOns,
  renderBilling,
  renderComparison,
  renderPlans,
  renderVariables,
} from '../../src/element/renderers.js';
import type { RenderActions, RenderState } from '../../src/element/renderers.js';
import { parsePricingYaml } from '../../src/yaml/index.js';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const acmeYaml = readFileSync(join(repoRoot, 'tests/fixtures/acme-pricing.yml'), 'utf8');

interface Host {
  yaml?: string;
  locale: string;
  loadingLabel?: string;
  reload(): Promise<void>;
  requestUpdate: () => void;
  dispatchEvent: (event: Event) => boolean;
  render(): unknown;
  // private state the render reads
  _expandedGroups: Set<string>;
  _pendingAddOnChange?: { addIds: string[]; removeIds: string[] };
  _compact: boolean;
}

async function build(): Promise<Host> {
  const loaded: unknown = await import('../../src/element/pricing-renderer-element.js');
  const Element = (loaded as { PricingRendererElement: new () => Host }).PricingRendererElement;
  const element = new Element();
  element.requestUpdate = () => undefined;
  element.dispatchEvent = () => true;
  return element;
}

// A loaded element showing the acme pricing with its default state: compact, one group open.
async function loaded(): Promise<Host> {
  const element = await build();
  element.yaml = acmeYaml;
  await element.reload();
  element._compact = true;
  return element;
}

// A ready element showing the acme pricing, every group open and the add-on dialog open, so every
// id the element can render is in the output.
async function ready(): Promise<Host> {
  const element = await loaded();
  const groups = viewModelFromYaml(acmeYaml).comparisonGroups;
  element._expandedGroups = new Set(groups.map((group) => group.id));
  element._pendingAddOnChange = { addIds: ['extraStorage'], removeIds: [] };
  return element;
}

// Flattens a lit template (strings and values, nested templates and arrays) into plain text.
// Values that carry no text (nothing, booleans, handlers, directives) are skipped; any other value
// throws, so an unexpected shape cannot hide an id from the checks.
function flatten(template: unknown): string {
  if (Array.isArray(template)) return template.map(flatten).join('');
  if (typeof template === 'string' || typeof template === 'number') return String(template);
  if (template === nothing || template === null || template === undefined) return '';
  if (typeof template === 'boolean' || typeof template === 'function') return '';
  if (typeof template === 'object') {
    if ('strings' in template && 'values' in template) {
      const { strings, values } = template as { strings: string[]; values: unknown[] };
      return strings
        .map((text, index) => text + (index < values.length ? flatten(values[index]) : ''))
        .join('');
    }
    if ('_$litDirective$' in template) return '';
  }
  throw new Error(`Cannot flatten ${String(template)}`);
}

// Quoted and unquoted attribute values: lit bindings flatten without quotes.
function attributeValues(text: string, names: string[]): string[] {
  const pattern = new RegExp(`(?<![\\w-])(?:${names.join('|')})=(?:"([^"]*)"|([^"\\s>]+))`, 'g');
  return [...text.matchAll(pattern)].flatMap((match) => (match[1] ?? match[2] ?? '').split(/\s+/));
}

const ids = (text: string): string[] => attributeValues(text, ['id']).filter(Boolean);
const references = (text: string): string[] =>
  attributeValues(text, ['aria-labelledby', 'aria-describedby', 'aria-controls', 'for']).filter(
    Boolean,
  );

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

function stateFor(viewModel: PricingViewModel, overrides: Partial<RenderState> = {}): RenderState {
  const all = new Set(viewModel.comparisonGroups.map((group) => group.id));
  return {
    viewModel,
    selection: viewModel.resolved.selection,
    compact: true,
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
    ...overrides,
  };
}

function viewModelFromYaml(yaml: string): PricingViewModel {
  const parsed = parsePricingYaml(yaml);
  if (!parsed.value) {
    throw new Error(`Cannot parse the pricing: ${JSON.stringify(parsed.diagnostics)}`);
  }
  return createPricingViewModel(parsed.value);
}

// [utest->req~element-instance-ids~1]
describe('two elements of the same pricing', () => {
  it('render no id twice in the combined output', async () => {
    const first = flatten((await ready()).render());
    const second = flatten((await ready()).render());
    const all = [...ids(first), ...ids(second)];
    expect(all.length).toBeGreaterThan(8);
    const duplicates = all.filter((id, index) => all.indexOf(id) !== index);
    expect(duplicates).toEqual([]);
  });

  it('give every id except the breakdown id the instance prefix', async () => {
    const text = flatten((await ready()).render());
    const prefix = /^pr-(\d+)-/.exec(ids(text).find((id) => id.endsWith('-title')) ?? '')?.[0];
    expect(prefix, 'the title id has an instance prefix').toBeDefined();
    for (const id of ids(text)) {
      if (id.startsWith('pr-breakdown-')) continue;
      expect(id.startsWith(prefix!), id).toBe(true);
    }
  });

  it('resolve every ARIA and for reference inside the same output', async () => {
    for (const element of [await ready(), await ready()]) {
      const text = flatten(element.render());
      const present = new Set(ids(text));
      const refs = references(text);
      expect(refs.length).toBeGreaterThan(5);
      for (const ref of refs) expect(present.has(ref), `${ref} resolves`).toBe(true);
    }
  });

  it('resolve every reference with the groups in their default state', async () => {
    for (const element of [await loaded(), await loaded()]) {
      const text = flatten(element.render());
      const present = new Set(ids(text));
      const groupIds = ids(text).filter((id) => /^pr-\d+-group-/.test(id));
      const total = viewModelFromYaml(acmeYaml).comparisonGroups.length;
      expect(groupIds.length, 'only the first group is open').toBeLessThan(total);
      for (const ref of references(text)) expect(present.has(ref), `${ref} resolves`).toBe(true);
    }
  });

  it('give each element its own radio group names', async () => {
    const names = async (): Promise<string[]> => {
      const text = flatten((await loaded()).render());
      return [...text.matchAll(/type="radio"\s+name=([^"\s>]+)/g)].map((match) => match[1]!);
    };
    const first = await names();
    const second = await names();
    expect(first.length).toBeGreaterThan(0);
    expect(first.every((name) => /^pr-\d+-(billing|plan)$/.test(name))).toBe(true);
    expect(first.filter((name) => second.includes(name))).toEqual([]);
  });

  it('use the instance prefix for the loading title', async () => {
    const first = await build();
    const second = await build();
    const text = [flatten(first.render()), flatten(second.render())];
    const titles = text.map((item) => ids(item).find((id) => id.endsWith('-loading-title')));
    expect(titles[0]).toMatch(/^pr-\d+-loading-title$/);
    expect(titles[1]).toMatch(/^pr-\d+-loading-title$/);
    expect(titles[0]).not.toBe(titles[1]);
    expect(references(text[0]!)).toContain(titles[0]);
  });

  it('label the dialog with its own title and description', async () => {
    const text = flatten((await ready()).render());
    const dialog = /<div[^>]*role="dialog"[^>]*>/.exec(text)?.[0] ?? '';
    const labelledby = /aria-labelledby="?([^"\s>]+)/.exec(dialog)?.[1];
    const describedby = /aria-describedby="?([^"\s>]+)/.exec(dialog)?.[1];
    expect(labelledby).toMatch(/^pr-\d+-dialog-title$/);
    expect(describedby).toMatch(/^pr-\d+-dialog-description$/);
    expect(ids(text)).toContain(labelledby);
    expect(ids(text)).toContain(describedby);
  });
});

// [utest->req~element-instance-ids~1]
describe('renderer output with an instance prefix', () => {
  it('sanitizes a group id with spaces', () => {
    const viewModel = viewModelFromYaml(
      acmeYaml.replaceAll('tag: Workspace', 'tag: Core Features'),
    );
    expect(viewModel.comparisonGroups.map((group) => group.id)).toContain('Core Features');
    const text = flatten(renderComparison(stateFor(viewModel, { idPrefix: 'pr-3' })));
    expect(attributeValues(text, ['aria-controls'])).toContain('pr-3-group-Core-Features');
    expect(ids(text)).toContain('pr-3-group-Core-Features');
    for (const id of ids(text)) expect(id, 'no id has a space').not.toMatch(/\s/);
  });

  it('leaves aria-controls out while a headed group is collapsed', () => {
    const viewModel = viewModelFromYaml(acmeYaml);
    const [first, ...rest] = viewModel.comparisonGroups;
    expect(rest.length).toBeGreaterThan(0);
    const text = flatten(
      renderComparison(
        stateFor(viewModel, { idPrefix: 'pr-3', expandedGroups: new Set([first!.id]) }),
      ),
    );
    const controls = attributeValues(text, ['aria-controls']);
    expect(controls).toEqual([`pr-3-group-${first!.id}`]);
    expect(ids(text)).toEqual(expect.arrayContaining(controls));
    const collapsed = flatten(
      renderComparison(stateFor(viewModel, { idPrefix: 'pr-3', expandedGroups: new Set() })),
    );
    expect(attributeValues(collapsed, ['aria-controls'])).toEqual([]);
  });

  it('names the radio groups with the instance prefix', () => {
    const viewModel = viewModelFromYaml(acmeYaml);
    const state = stateFor(viewModel, { idPrefix: 'pr-5' });
    const radioNames = (text: string): string[] =>
      [...text.matchAll(/type="radio"\s+name=([^"\s>]+)/g)].map((match) => match[1]!);
    expect(radioNames(flatten(renderBilling(state)))).toEqual(['pr-5-billing', 'pr-5-billing']);
    const plans = radioNames(flatten(renderPlans(state)));
    expect(plans.length).toBe(viewModel.pricing.plans.length);
    expect(new Set(plans)).toEqual(new Set(['pr-5-plan']));
    const plain = radioNames(flatten(renderPlans(stateFor(viewModel))));
    expect(new Set(plain)).toEqual(new Set(['pr-plan']));
  });

  it('sanitizes a variable path into the id', () => {
    const base = viewModelFromYaml(acmeYaml);
    const viewModel: PricingViewModel = {
      ...base,
      variableControls: [
        ...base.variableControls,
        { path: 'priceByRegion.eu price[0]', type: 'number', label: 'Regional price' },
      ],
    };
    const text = flatten(renderVariables(stateFor(viewModel, { idPrefix: 'pr-7' })));
    const found = ids(text).filter((id) => id !== 'pr-7-variables-title');
    expect(found.length).toBeGreaterThan(1);
    for (const id of found) expect(id, id).toMatch(/^pr-7-variable-[\w-]+$/);
    expect(found).toContain('pr-7-variable-priceByRegion-eu-price-0-');
  });

  it('sanitizes an add-on id with spaces into the help id', () => {
    const viewModel = viewModelFromYaml(acmeYaml.replaceAll('extraStorage', 'extra storage'));
    const text = flatten(renderAddOns(stateFor(viewModel, { idPrefix: 'pr-9' })));
    expect(ids(text)).toContain('pr-9-addon-help-extra-storage');
    for (const id of ids(text)) expect(id, 'no id has a space').not.toMatch(/\s/);
    const present = new Set(ids(text));
    for (const ref of references(text)) expect(present.has(ref), ref).toBe(true);
  });

  it('prefixes the variable ids and their help ids', () => {
    const viewModel = viewModelFromYaml(acmeYaml);
    const text = flatten(renderVariables(stateFor(viewModel, { idPrefix: 'pr-7' })));
    const found = ids(text);
    expect(found.length).toBeGreaterThan(0);
    for (const id of found) expect(id.startsWith('pr-7-variable'), id).toBe(true);
    const present = new Set(found);
    for (const ref of references(text)) expect(present.has(ref), ref).toBe(true);
  });
});

// [utest->req~element-instance-ids~1]
describe('renderer output without an instance prefix', () => {
  it('keeps the ids of today', () => {
    const viewModel = viewModelFromYaml(acmeYaml);
    const text = flatten(renderComparison(stateFor(viewModel)));
    expect(references(text)).toContain('pr-comparison-title');
    expect(ids(text)).toContain('pr-comparison-title');
    expect(ids(text)).toContain(`pr-group-${viewModel.comparisonGroups[0]!.id}`);
  });
});
