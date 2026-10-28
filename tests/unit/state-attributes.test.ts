import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createPricingViewModel } from '../../src/core/index.js';
import type { PricingViewModel } from '../../src/core/index.js';
import { renderAddOns, renderPlans } from '../../src/element/renderers.js';
import type { RenderActions, RenderState } from '../../src/element/renderers.js';
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

// Flattens a lit template (strings and values, nested templates and arrays) into plain text.
// `nothing` and functions flatten to the empty string, so an omitted attribute reads as empty.
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

// The acme fixture, with the enterprise CTA declared secondary. Starter has no kind (default).
const acmeSource = readFileSync(new URL('../fixtures/acme-pricing.yml', import.meta.url), 'utf8');
const ENTERPRISE_CTA = '        planId: enterprise\n';
const source = acmeSource.replace(ENTERPRISE_CTA, `${ENTERPRISE_CTA}        kind: secondary\n`);

function loadViewModel(): PricingViewModel {
  const parsed = parsePricingYaml(source);
  if (!parsed.value) throw new Error('Cannot parse the acme fixture');
  return createPricingViewModel(parsed.value);
}

function stateFor(overrides: Partial<RenderState> = {}): RenderState {
  const viewModel = loadViewModel();
  const all = new Set(viewModel.comparisonGroups.map((group) => group.id));
  return {
    viewModel,
    selection: { ...viewModel.resolved.selection, planId: 'growth' },
    compact: false,
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

interface Card {
  id: string;
  /** The opening tag of the card, `class` included. */
  tag: string;
  /** The whole rendered card. */
  text: string;
}

function cardsOf(text: string, part: string, idAttribute: string): Card[] {
  return text
    .split('<article')
    .slice(1)
    .filter((chunk) => chunk.includes(`data-pr-part="${part}"`))
    .map((chunk) => {
      const tag = chunk.slice(0, chunk.indexOf('>'));
      return { id: attribute(tag, idAttribute) ?? '', tag, text: chunk };
    });
}

// The value of an attribute in an opening tag; an omitted lit binding leaves an empty value.
function attribute(tag: string, name: string): string | undefined {
  const match = new RegExp(`${name}=(?:"([^"]*)"|'([^']*)'|([^\\s>"']*))`).exec(tag);
  const value = match?.[1] ?? match?.[2] ?? match?.[3];
  return value === '' ? undefined : value;
}

const planCards = (state: RenderState): Card[] =>
  cardsOf(flatten(renderPlans(state)), 'plan-card', 'data-plan-id');
const addOnCards = (state: RenderState): Card[] =>
  cardsOf(flatten(renderAddOns(state)), 'add-on-card', 'data-add-on-id');

const classesOf = (card: Card): string[] => (attribute(card.tag, 'class') ?? '').split(/\s+/);

function ctaTags(card: Card): string[] {
  return [...card.text.matchAll(/<(?:a|button)\b[^>]*data-pr-part="cta"[^>]*>/g)].map(
    (match) => match[0],
  );
}

function classOf(tag: string): string {
  const match = /class=(?:"([^"]*)"|([^\s>]*))/.exec(tag);
  return match?.[1] ?? match?.[2] ?? '';
}

// [utest->req~state-featured~1]
describe('data-featured on plan cards', () => {
  it('is present on every plan card as true or false', () => {
    const cards = planCards(stateFor());
    expect(cards.map((card) => card.id)).toEqual(['starter', 'growth', 'enterprise']);
    for (const card of cards) {
      expect(['true', 'false'], card.id).toContain(attribute(card.tag, 'data-featured'));
    }
  });

  it('is true exactly when the card has the is-featured class', () => {
    const cards = planCards(stateFor());
    for (const card of cards) {
      const featured = classesOf(card).includes('is-featured');
      expect(attribute(card.tag, 'data-featured'), card.id).toBe(String(featured));
    }
    const byId = Object.fromEntries(
      cards.map((card) => [card.id, attribute(card.tag, 'data-featured')]),
    );
    // growth carries a badge with emphasize; enterprise a badge without it; starter none
    expect(byId).toEqual({ starter: 'false', growth: 'true', enterprise: 'false' });
  });
});

// [utest->req~state-available~1]
describe('data-available on add-on cards', () => {
  it('matches the is-unavailable class on every add-on card', () => {
    const cards = addOnCards(stateFor());
    expect(cards.map((card) => card.id).sort()).toEqual([
      'compliance',
      'extraStorage',
      'prioritySuccess',
    ]);
    for (const card of cards) {
      const unavailable = classesOf(card).includes('is-unavailable');
      expect(attribute(card.tag, 'data-available'), card.id).toBe(String(!unavailable));
    }
  });

  it('is false for an add-on the selected plan does not offer', () => {
    const cards = addOnCards(stateFor());
    const byId = Object.fromEntries(
      cards.map((card) => [card.id, attribute(card.tag, 'data-available')]),
    );
    expect(byId).toEqual({ extraStorage: 'true', compliance: 'false', prioritySuccess: 'true' });
  });

  it('is not written on plan cards', () => {
    for (const card of planCards(stateFor())) {
      expect(card.tag, card.id).not.toContain('data-available');
    }
  });
});

// [utest->req~state-kind~1]
describe('data-kind on plan CTAs', () => {
  it('is on the link and on the button form, from cta.kind', () => {
    const byPlan = Object.fromEntries(
      planCards(stateFor()).map((card) => [card.id, ctaTags(card)]),
    );
    // starter has no href (a button), growth and enterprise have one (a link)
    expect(byPlan.starter).toHaveLength(1);
    expect(byPlan.starter?.[0]).toMatch(/^<button\b/);
    expect(byPlan.growth?.[0]).toMatch(/^<a\b/);
    expect(byPlan.enterprise?.[0]).toMatch(/^<a\b/);
    expect(attribute(byPlan.starter?.[0] ?? '', 'data-kind')).toBe('primary');
    expect(attribute(byPlan.growth?.[0] ?? '', 'data-kind')).toBe('primary');
    expect(attribute(byPlan.enterprise?.[0] ?? '', 'data-kind')).toBe('secondary');
  });

  it('agrees with the button variant class and is set on every CTA', () => {
    for (const card of planCards(stateFor())) {
      const tags = ctaTags(card);
      expect(tags.length, card.id).toBeGreaterThan(0);
      for (const tag of tags) {
        const kind = attribute(tag, 'data-kind');
        expect(['primary', 'secondary'], card.id).toContain(kind);
        expect(classOf(tag), card.id).toContain(`pr-button--${kind}`);
      }
    }
  });

  it('is still set on the disabled button of the current plan', () => {
    const state = stateFor({ currentPlanId: 'growth' });
    const growth = planCards(state).find((card) => card.id === 'growth');
    const tags = growth ? ctaTags(growth) : [];
    expect(tags).toHaveLength(1);
    expect(tags[0]).toMatch(/^<button\b/);
    expect(attribute(tags[0] ?? '', 'data-kind')).toBe('primary');
  });
});

// [utest->req~state-current~1]
describe('data-current guard', () => {
  const state = (): RenderState =>
    stateFor({ currentPlanId: 'growth', currentAddOnIds: new Set(['extraStorage']) });

  it('stays on the current plan card only', () => {
    for (const card of planCards(state())) {
      expect(attribute(card.tag, 'data-current'), card.id).toBe(
        card.id === 'growth' ? 'true' : undefined,
      );
    }
  });

  it('stays on the current add-on card only', () => {
    for (const card of addOnCards(state())) {
      expect(attribute(card.tag, 'data-current'), card.id).toBe(
        card.id === 'extraStorage' ? 'true' : undefined,
      );
    }
  });

  it('leaves data-selected unchanged', () => {
    const plans = planCards(state());
    expect(plans.map((card) => attribute(card.tag, 'data-selected'))).toEqual([
      'false',
      'true',
      'false',
    ]);
    const addOns = addOnCards(state());
    expect(addOns.map((card) => attribute(card.tag, 'data-selected'))).toEqual(
      addOns.map(() => 'false'),
    );
  });

  it('writes no data-current without a current selection', () => {
    for (const card of [...planCards(stateFor()), ...addOnCards(stateFor())]) {
      expect(attribute(card.tag, 'data-current'), card.id).toBeUndefined();
    }
  });
});
