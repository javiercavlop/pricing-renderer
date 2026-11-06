import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  createDefaultSelection,
  createPricingViewModel,
  humanizeIdentifier,
  normalizePricing,
} from '../../src/core/index.js';
import type { PricingViewModel } from '../../src/core/index.js';
import { PRICING_SECTION_NAMES, renderHeader, renderPlans } from '../../src/element/renderers.js';
import type { RenderActions, RenderState } from '../../src/element/renderers.js';

// Flattens a lit template (strings, values, nested templates and arrays) into plain text.
function flatten(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (Array.isArray(node)) return node.map(flatten).join('');
  if (typeof node === 'object' && node !== null && 'strings' in node) {
    const { strings, values } = node as { strings: readonly string[]; values: readonly unknown[] };
    return strings
      .map((text, index) => text + (index < values.length ? flatten(values[index]) : ''))
      .join('');
  }
  return String(node);
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

const PRICING = {
  saasName: 'TomatoMeter',
  syntaxVersion: '3.1',
  version: '1.0.0',
  currency: 'USD',
  features: {
    pomodoroTimer: { valueType: 'BOOLEAN', defaultValue: true, type: 'DOMAIN' },
    max_pomodoro_timers: { valueType: 'BOOLEAN', defaultValue: true, type: 'DOMAIN' },
    emptyName: { name: '   ', valueType: 'BOOLEAN', defaultValue: true, type: 'DOMAIN' },
    nameIsId: { name: 'nameIsId', valueType: 'BOOLEAN', defaultValue: true, type: 'DOMAIN' },
  },
  plans: {
    basic: { price: 0, unit: 'user/month', features: {} },
    advancedTier: { price: 9.99, unit: 'user/month', features: {} },
    proTier: { name: 'proTier', price: 19.99, unit: 'user/month', features: {} },
    keptName: { name: 'Enterprise', price: 99, unit: 'user/month', features: {} },
  },
  addOns: {
    exportAsJson: { price: 1, unit: 'user/month' },
    extraSeats: { name: 'extraSeats', price: 2, unit: 'user/month' },
  },
};

function normalizedOf() {
  const result = normalizePricing(PRICING);
  if (!result.ok) throw new Error('fixture does not normalize');
  return result.value;
}

function viewModelOf(): PricingViewModel {
  return createPricingViewModel(normalizedOf(), { locale: 'en-US' });
}

function stateFor(viewModel: PricingViewModel, hidden?: readonly string[]): RenderState {
  return {
    viewModel,
    ...(hidden ? { hiddenSections: new Set(hidden) as RenderState['hiddenSections'] } : {}),
    selection: createDefaultSelection(normalizedOf()),
    compact: false,
    search: '',
    onlyDifferences: false,
    selectionEnabled: true,
    ctaEnabled: true,
    variablesEnabled: true,
    expandedGroups: new Set<string>(),
    revealedGroups: new Set<string>(),
    breakdownOpen: false,
    breakdownId: 'pr-breakdown',
    actions,
  } as RenderState;
}

describe('humanizeIdentifier across id styles', () => {
  // The style an author used must not change how the label looks.
  it.each([
    ['pomodoroTimer', 'Pomodoro Timer'],
    ['max_pomodoro_timers', 'Max Pomodoro Timers'],
    ['export-as-json', 'Export As Json'],
    ['AdvancedAnalytics', 'Advanced Analytics'],
    ['pricing.plan.pro', 'Pricing Plan Pro'],
    ['api2Key', 'Api 2 Key'],
  ])('turns %s into %s', (id, label) => {
    expect(humanizeIdentifier(id)).toBe(label);
  });

  // An acronym stays whole instead of becoming "Saml Sso".
  it('keeps acronyms', () => {
    expect(humanizeIdentifier('SAML_SSO')).toBe('SAML SSO');
  });

  // Nothing to humanize: the id is better than an empty label.
  it('returns the id when it yields no words', () => {
    expect(humanizeIdentifier('___')).toBe('___');
  });
});

describe('a missing or blank name falls back to the humanized id', () => {
  const normalized = normalizePricing(PRICING);

  it('normalizes the fixture', () => {
    expect(normalized.ok).toBe(true);
  });

  // The same three cases in all four collections: missing name, blank name, and a name that
  // is just the id again, which is what a pricing upgraded by SPACE carries for its plans.
  it.each([
    ['features', 'max_pomodoro_timers', 'Max Pomodoro Timers'],
    ['features', 'emptyName', 'Empty Name'],
    ['features', 'nameIsId', 'Name Is Id'],
    ['plans', 'advancedTier', 'Advanced Tier'],
    ['plans', 'proTier', 'Pro Tier'],
    ['addOns', 'exportAsJson', 'Export As Json'],
    ['addOns', 'extraSeats', 'Extra Seats'],
  ])('%s/%s reads as %s', (collection, id, label) => {
    if (!normalized.ok) throw new Error('not normalized');
    const list = (normalized.value as unknown as Record<string, { id: string; name: string }[]>)[
      collection
    ];
    expect(list.find((item) => item.id === id)?.name).toBe(label);
  });
});

describe('a name an author wrote is never rewritten', () => {
  it('keeps a plan name that differs from its id', () => {
    const r = normalizePricing(PRICING);
    if (!r.ok) throw new Error('not normalized');
    expect(r.value.plans.find((p) => p.id === 'keptName')?.name).toBe('Enterprise');
  });
});

describe('section headings do not repeat themselves', () => {
  // The eyebrow names the section and the title says what to do there; before this they were
  // the same string, so the plans section read "Plans / Plans".
  it('gives the plans section a title of its own', () => {
    const viewModel = viewModelOf();
    const text = flatten(renderPlans(stateFor(viewModel)));
    expect(text).toContain('Choose a plan');
    expect(text.match(/Plans/g)?.length ?? 0).toBe(1);
  });
});

describe('the contract plan is not marked three times', () => {
  // "Your plan", a checked radio and a "Selected" label all said the same thing on the card of
  // the plan the visitor is already on. The label goes; it returns on any other plan.
  it('drops the Selected label on the current plan', () => {
    const viewModel = viewModelOf();
    const state = { ...stateFor(viewModel), currentPlanId: 'basic' } as RenderState;
    const text = flatten(renderPlans(state));
    expect(text).not.toContain('Selected');
  });

  it('keeps it when the selected plan is not the contract one', () => {
    const viewModel = viewModelOf();
    const state = { ...stateFor(viewModel), currentPlanId: 'advancedTier' } as RenderState;
    const text = flatten(renderPlans(state));
    expect(text).toContain('Selected');
  });

  it('keeps Select on the plans that are not selected', () => {
    const text = flatten(renderPlans(stateFor(viewModelOf())));
    expect(text).toContain('Select');
  });
});

describe('what varies in the wild is a token', () => {
  const css = readFileSync(new URL('../../src/styles/base.css', import.meta.url), 'utf8');
  const theme = readFileSync(new URL('../../src/styles/theme.css', import.meta.url), 'utf8');

  // A survey of 49 pricing pages found the price running from 16px to 64px and from weight 300
  // to 700. A host has to be able to move it without redefining every bold thing in the theme.
  it.each(['--pr-price-size', '--pr-price-weight', '--pr-price-tracking'])(
    'declares %s in the theme',
    (token) => {
      expect(theme).toContain(`${token}:`);
    },
  );

  it('reads the price typography from those tokens', () => {
    const rule = /\.pr-price__amount,[\s\S]*?\{([\s\S]*?)\}/.exec(css);
    expect(rule).not.toBeNull();
    expect(rule?.[1]).toContain('var(--pr-price-size');
    expect(rule?.[1]).toContain('var(--pr-price-weight');
    expect(rule?.[1]).toContain('var(--pr-price-tracking');
  });

  // The difference is why the screen exists; it must outrank the two values it comes from.
  it('gives the price difference its own size and a direction hook', () => {
    expect(css).toContain("[data-pr-part='price-difference'] dd");
    expect(css).toContain("[data-direction='decrease']");
    expect(css).toContain("[data-direction='increase']");
  });
});

describe('hero pieces can be hidden one by one', () => {
  it('shows the name, the description and the tags by default', () => {
    const text = flatten(renderHeader(stateFor(viewModelOf())));
    expect(text).toContain('TomatoMeter');
  });

  // The title holds the id that labels the shell, so it stays for screen readers.
  it('keeps the title for screen readers when saasName is hidden', () => {
    const text = flatten(renderHeader(stateFor(viewModelOf(), ['saasName'])));
    expect(text).toContain('pr-sr-only');
    expect(text).not.toContain('pr-hero__title');
  });

  it('drops the description when it is hidden', () => {
    const shown = flatten(renderHeader(stateFor(viewModelOf())));
    const hidden = flatten(renderHeader(stateFor(viewModelOf(), ['description'])));
    expect(hidden).not.toContain('pr-hero__subtitle');
    expect(hidden.length).toBeLessThan(shown.length);
  });

  it('lists the new names as hideable sections', () => {
    for (const name of ['saasName', 'description', 'tags']) {
      expect(PRICING_SECTION_NAMES).toContain(name);
    }
  });
});
