// The renderer is called directly and its lit template is flattened to text (node environment, no
// DOM), so the attributes are read from the flattened markup.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nothing } from 'lit';
import { describe, expect, it } from 'vitest';
import { createPricingViewModel } from '../../src/core/index.js';
import type { PricingViewModel, VariableControl } from '../../src/core/index.js';
import { renderVariables } from '../../src/element/renderers.js';
import type { RenderActions, RenderState } from '../../src/element/renderers.js';
import { parsePricingYaml } from '../../src/yaml/index.js';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const acmeYaml = readFileSync(join(repoRoot, 'tests/fixtures/acme-pricing.yml'), 'utf8');

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

const base: PricingViewModel = (() => {
  const parsed = parsePricingYaml(acmeYaml);
  if (!parsed.value) throw new Error('Cannot parse the acme pricing');
  return createPricingViewModel(parsed.value);
})();

// The renderer reads only pricing.plans, resolved.diagnostics and variableControls.
function viewModelWith(controls: VariableControl[], invalid: boolean): PricingViewModel {
  if (!invalid) return { ...base, variableControls: controls };
  const pro = {
    id: 'pro',
    price: { kind: 'expression', dependencies: ['users'] },
  };
  return {
    ...base,
    variableControls: controls,
    pricing: { ...base.pricing, plans: [pro] },
    resolved: {
      ...base.resolved,
      diagnostics: [
        { severity: 'error', code: 'formula', message: 'bad', path: 'plans.pro.price' },
      ],
    },
  } as unknown as PricingViewModel;
}

function render(
  controls: VariableControl[],
  options: { idPrefix?: string; invalid?: boolean } = {},
): string {
  const viewModel = viewModelWith(controls, options.invalid ?? false);
  const state: RenderState = {
    viewModel,
    selection: viewModel.resolved.selection,
    compact: true,
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
    ...(options.idPrefix === undefined ? {} : { idPrefix: options.idPrefix }),
  };
  return flatten(renderVariables(state));
}

// Quoted and unquoted attribute values: lit bindings flatten without quotes.
function attribute(tag: string, name: string): string | undefined {
  const match = new RegExp(`(?<![\\w-])${name}=(?:"([^"]*)"|([^"\\s>]+))`).exec(tag);
  return match ? (match[1] ?? match[2] ?? '') : undefined;
}

function tags(text: string, names: string): string[] {
  return text.match(new RegExp(`<(?:${names})\\b[^>]*>`, 'g')) ?? [];
}

function allIds(text: string): string[] {
  return [...text.matchAll(/(?<![\w-])id=(?:"([^"]*)"|([^"\s>]+))/g)].map(
    (match) => match[1] ?? match[2] ?? '',
  );
}

// aria-describedby tokens of a tag: undefined when the attribute is absent or empty.
function describedby(tag: string): string | undefined {
  const value = attribute(tag, 'aria-describedby')?.trim();
  return value ? value : undefined;
}

function inputWithId(text: string, id: string): string {
  const found = tags(text, 'input|select').find((tag) => attribute(tag, 'id') === id);
  if (!found) throw new Error(`No control with id ${id}`);
  return found;
}

function elementWithId(text: string, id: string): string | undefined {
  const start = text.search(new RegExp(`id=(?:"${id}"|${id}(?=[\\s>]))`));
  return start < 0 ? undefined : text.slice(start);
}

const described = (path: string): Partial<VariableControl> => ({
  label: path,
  description: `Help for ${path}`,
});

const fiveControls: VariableControl[] = [
  { path: 'flag', type: 'boolean', ...described('flag') },
  {
    path: 'region',
    type: 'select',
    options: [
      { value: 'eu', label: 'EU' },
      { value: 'us', label: 'US' },
    ],
    ...described('region'),
  },
  { path: 'seats', type: 'slider', min: 1, max: 50, ...described('seats') },
  { path: 'users', type: 'number', ...described('users') },
  { path: 'team', type: 'text', ...described('team') },
];

const usersControl = (description?: string): VariableControl => ({
  path: 'users',
  type: 'number',
  label: 'users',
  ...(description === undefined ? {} : { description }),
});

// [utest->req~variable-field-describedby~1]
describe('variable field aria-describedby', () => {
  it('links the control of every type to its description', () => {
    const text = render(fiveControls, { idPrefix: 'pr-7' });
    expect(describedby(inputWithId(text, 'pr-7-variable-flag'))).toBe('pr-7-variable-flag-help');
    expect(describedby(inputWithId(text, 'pr-7-variable-region'))).toBe(
      'pr-7-variable-region-help',
    );
    expect(describedby(inputWithId(text, 'pr-7-variable-users'))).toBe('pr-7-variable-users-help');
    expect(describedby(inputWithId(text, 'pr-7-variable-team'))).toBe('pr-7-variable-team-help');
    for (const path of ['flag', 'region', 'seats', 'users', 'team']) {
      const help = elementWithId(text, `pr-7-variable-${path}-help`);
      expect(help, `${path} help element exists`).toBeDefined();
      expect(help!.slice(0, 200)).toContain(`Help for ${path}`);
    }
  });

  it('links both inputs of a slider', () => {
    const text = render(fiveControls, { idPrefix: 'pr-7' });
    const fields = text.split('class="pr-field');
    const field = fields.find((part) => part.includes('pr-7-variable-seats"'));
    expect(field, 'slider field').toBeDefined();
    const inputs = tags(field!, 'input');
    expect(inputs.length).toBe(2);
    expect(attribute(inputs[0]!, 'id')).toBe('pr-7-variable-seats');
    for (const input of inputs) expect(describedby(input)).toBe('pr-7-variable-seats-help');
  });

  it('adds nothing without a description when the field is valid', () => {
    const text = render([usersControl()], { idPrefix: 'pr-7' });
    expect(describedby(inputWithId(text, 'pr-7-variable-users'))).toBeUndefined();
    expect(allIds(text)).not.toContain('pr-7-variable-users-help');
    expect(allIds(text)).not.toContain('pr-7-variable-users-error');
  });

  it('lists the description then the error of an invalid field', () => {
    const text = render([usersControl('Help for users')], { idPrefix: 'pr-7', invalid: true });
    expect(allIds(text)).toContain('pr-7-variable-users-error');
    expect(describedby(inputWithId(text, 'pr-7-variable-users'))).toBe(
      'pr-7-variable-users-help pr-7-variable-users-error',
    );
  });

  it('lists only the error of an invalid field without a description', () => {
    const text = render([usersControl()], { idPrefix: 'pr-7', invalid: true });
    expect(describedby(inputWithId(text, 'pr-7-variable-users'))).toBe('pr-7-variable-users-error');
  });

  it('resolves every reference inside the same output', () => {
    const outputs = [
      render(fiveControls, { idPrefix: 'pr-7' }),
      render([usersControl()], { idPrefix: 'pr-7' }),
      render([usersControl('Help for users')], { idPrefix: 'pr-7', invalid: true }),
      render([usersControl()], { idPrefix: 'pr-7', invalid: true }),
    ];
    let checked = 0;
    for (const text of outputs) {
      const present = new Set(allIds(text));
      for (const tag of tags(text, 'input|select')) {
        for (const token of (describedby(tag) ?? '').split(/\s+/).filter(Boolean)) {
          checked += 1;
          expect(present.has(token), `${token} resolves`).toBe(true);
        }
      }
    }
    expect(checked).toBeGreaterThan(8);
  });

  it('works without an instance prefix', () => {
    const text = render([usersControl('Help for users')]);
    expect(describedby(inputWithId(text, 'pr-variable-users'))).toBe('pr-variable-users-help');
    expect(allIds(text)).toContain('pr-variable-users-help');
  });
});
