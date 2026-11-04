import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement, type ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import ts from 'typescript';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  configurePricingRenderer,
  createDefaultSelection,
  getMessages,
  getPricingRendererConfig,
} from '../../src/core/index.js';
import type { NormalizedPricing, PricingSelection } from '../../src/core/index.js';
import { PricingRendererProvider } from '../../src/react/provider.js';
import { parsePricingYaml } from '../../src/yaml/index.js';

type Loose = Record<string, unknown>;
type UseSelection = (pricing: NormalizedPricing | undefined, options: Loose) => Loose;

const fixture = new URL('../fixtures/acme-pricing.yml', import.meta.url);
const acmeText = readFileSync(fileURLToPath(fixture), 'utf8');
const rateText = acmeText.replace("price: '4 * #seats'", "price: 'rate() * #seats'");

function load(text: string): NormalizedPricing {
  return parsePricingYaml(text).value as NormalizedPricing;
}

const loadAcme = (): NormalizedPricing => load(acmeText);

let usePricingSelection: UseSelection;

// The module is read through a catch, so a missing file fails this assertion and not the import.
beforeAll(async () => {
  const mod = (await import('../../src/react/use-pricing-selection.js').catch(() => ({}))) as Loose;
  expect(mod.usePricingSelection).toBeTypeOf('function');
  usePricingSelection = mod.usePricingSelection as UseSelection;
});

beforeEach(() => {
  configurePricingRenderer();
});

afterEach(() => {
  configurePricingRenderer();
});

// Renders a probe component that calls `use` inside the providers (outermost first) with
// renderToString, and returns the markup and what the hook returned.
function renderProbe<T>(
  use: () => T,
  show: (value: T) => string,
  providers: Loose[],
): { html: string; value: T } {
  let captured: T | undefined;
  function Probe(): ReactElement {
    captured = use();
    return createElement('output', null, show(captured));
  }
  let tree: ReactElement = createElement(Probe);
  for (const props of [...providers].reverse()) {
    tree = createElement(PricingRendererProvider as never, props, tree) as ReactElement;
  }
  const html = renderToString(tree);
  return { html, value: captured as T };
}

function renderSelection(
  pricing: NormalizedPricing | undefined,
  options: Loose,
  providers: Loose[] = [],
  show: (state: Loose) => string = () => '',
): { html: string; state: Loose } {
  expect(usePricingSelection).toBeTypeOf('function');
  const use = (): Loose => usePricingSelection(pricing, options);
  const { html, value } = renderProbe(use, show, providers);
  return { html, state: value };
}

interface ViewModelShape {
  locale: string;
  mode: string;
  visibility: string;
  messages: Record<string, string>;
  presentation: { planBadges: Record<string, { label: string }[]> };
  resolved: { subtotal: number; planPrices: Record<string, { kind: string; amount?: number }> };
}

const viewModelOf = (state: Loose): ViewModelShape => state.viewModel as ViewModelShape;
const selectionOf = (state: Loose): PricingSelection => state.selection as PricingSelection;
const badge = (label: string) => [{ id: label, label, tone: 'accent' as const }];

function badgeLabel(state: Loose, planId: string): string | undefined {
  return viewModelOf(state).presentation.planBadges[planId]?.[0]?.label;
}

// [utest->req~use-pricing-selection-state~1]
describe('usePricingSelection state on the server', () => {
  it('renders the default selection of the pricing', () => {
    const acme = loadAcme();
    const show = (state: Loose): string => selectionOf(state).planId ?? '';
    const { html, state } = renderSelection(acme, {}, [], show);
    expect(html).toContain('starter');
    const defaults = createDefaultSelection(acme);
    expect(selectionOf(state)).toMatchObject({
      planId: defaults.planId,
      billingPeriod: defaults.billingPeriod,
      variables: defaults.variables,
    });
  });

  it('returns the actions and queries of the hook', () => {
    const { state } = renderSelection(loadAcme(), {});
    const members = [
      'selectPlan',
      'toggleAddOn',
      'setVariable',
      'setAddOnQuantity',
      'setBillingPeriod',
      'resetVariables',
      'confirm',
      'cancel',
      'apply',
      'relationOf',
      'compareWithCurrent',
    ];
    for (const name of members) expect(state[name], name).toBeTypeOf('function');
    expect(state.pending).toBeUndefined();
    expect(state.current).toBeUndefined();
  });

  it('has no selection and no view model without a pricing', () => {
    const options = { defaultSelection: { planId: 'growth' } };
    const show = (state: Loose): string => String(state.selection);
    const { html, state } = renderSelection(undefined, options, [], show);
    expect(html).toContain('undefined');
    expect(state.selection).toBeUndefined();
    expect(state.viewModel).toBeUndefined();
    expect(state.resolved).toBeUndefined();
    expect((state.apply as (input: Loose) => unknown)({ planId: 'growth' })).toBeUndefined();
  });

  it('renders String(selection) as undefined for empty options', () => {
    const show = (state: Loose): string => String(state.selection);
    const { html } = renderSelection(undefined, {}, [], show);
    expect(html).toContain('undefined');
  });

  it('takes the controlled selection in effect, not the default selection', () => {
    const acme = loadAcme();
    const base = createDefaultSelection(acme);
    const selection: PricingSelection = {
      ...base,
      planId: 'growth',
      variables: { ...base.variables, seats: 40 },
    };
    const controlled = {
      selection,
      defaultSelection: { planId: 'enterprise' },
      variablesEnabled: false,
    };
    const { state } = renderSelection(acme, controlled);
    expect(selectionOf(state).planId).toBe('growth');
    expect(selectionOf(state).variables.seats).toBe(5);
    const enabled = renderSelection(acme, { selection, variablesEnabled: true });
    expect(selectionOf(enabled.state).variables.seats).toBe(40);
  });

  it('starts from the merged default selection', () => {
    const defaultSelection = { planId: 'growth', billingPeriod: 'yearly' };
    const { state } = renderSelection(loadAcme(), { defaultSelection });
    expect(selectionOf(state).planId).toBe('growth');
    expect(selectionOf(state).billingPeriod).toBe('yearly');
  });
});

// [utest->req~use-pricing-selection-view-model~2]
describe('usePricingSelection view model', () => {
  it('passes locale, mode and visibility to the view model', () => {
    const options = { locale: 'es-ES', mode: 'catalog', visibility: 'all' };
    const { state } = renderSelection(loadAcme(), options);
    const viewModel = viewModelOf(state);
    expect((state.resolved as ViewModelShape['resolved']).subtotal).toBe(20);
    expect(viewModel.locale).toBe('es-ES');
    expect(viewModel.mode).toBe('catalog');
    expect(viewModel.visibility).toBe('all');
  });

  it('returns the resolved field of the view model', () => {
    const { state } = renderSelection(loadAcme(), {});
    expect(Object.is(state.resolved, viewModelOf(state).resolved)).toBe(true);
  });

  it('passes messages and presentation to the view model', () => {
    const options = {
      messages: { 'cta.select': 'Choose' },
      presentation: { planBadges: { starter: badge('Instance') } },
    };
    const { state } = renderSelection(loadAcme(), options);
    expect(viewModelOf(state).messages['cta.select']).toBe('Choose');
    expect(badgeLabel(state, 'starter')).toBe('Instance');
  });

  it('passes expressionOptions to the price evaluation', () => {
    expect(rateText).not.toBe(acmeText);
    const options = { expressionOptions: { functions: { rate: () => 30 } } };
    const { state } = renderSelection(load(rateText), options);
    const starter = viewModelOf(state).resolved.planPrices.starter;
    expect(starter?.kind).toBe('amount');
    expect(starter?.amount).toBe(150);
  });

  it('keeps no price across server renders', () => {
    expect(rateText).not.toBe(acmeText);
    const pricing = load(rateText);
    const kind = (state: Loose): string => viewModelOf(state).resolved.planPrices.starter!.kind;
    const withRate = { expressionOptions: { functions: { rate: () => 30 } } };
    const first = renderSelection(pricing, withRate, [], kind);
    expect(first.html).toContain('amount');
    const second = renderSelection(pricing, { expressionOptions: {} }, [], kind);
    expect(second.html).toContain('error');
    expect(second.html).not.toContain('amount');
  });
});

// Type-checks a TSX snippet with the strict options of tsconfig.base.json. The snippet is served
// from memory next to this file, so its relative imports resolve to src/** on disk.
function typeCheckSnippet(source: string): string[] {
  const snippetPath = fileURLToPath(new URL('./__selection_snippet__.tsx', import.meta.url));
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2021,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    jsx: ts.JsxEmit.React,
    strict: true,
    noUncheckedIndexedAccess: true,
    verbatimModuleSyntax: true,
    skipLibCheck: true,
    noEmit: true,
    types: [],
  };
  const host = ts.createCompilerHost(options);
  const { fileExists, readFile: readHostFile, getSourceFile } = host;
  host.fileExists = (fileName) => fileName === snippetPath || fileExists(fileName);
  host.readFile = (fileName) => (fileName === snippetPath ? source : readHostFile(fileName));
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreate) =>
    fileName === snippetPath
      ? ts.createSourceFile(fileName, source, languageVersion, true, ts.ScriptKind.TSX)
      : getSourceFile(fileName, languageVersion, onError, shouldCreate);
  const program = ts.createProgram([snippetPath], options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program, program.getSourceFile(snippetPath));
  return diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
}

const reviewHeader = `
  import * as React from 'react';
  import type { SelectionComparison } from '../../src/core/index.js';
  import { PricingChangeReview } from '../../src/react/index.js';
  declare const result: SelectionComparison;
`;

// [utest->req~use-pricing-selection-compare~1]
describe('usePricingSelection review types', () => {
  it('compiles PricingChangeReview with a SelectionComparison', () => {
    expect(usePricingSelection).toBeTypeOf('function');
    const element = 'export const element = <PricingChangeReview comparison={result} />;';
    expect(typeCheckSnippet(`${reviewHeader}\n${element}`)).toEqual([]);
  });

  it('rejects a comparison that is not a SelectionComparison', () => {
    expect(usePricingSelection).toBeTypeOf('function');
    const element = 'export const element = <PricingChangeReview comparison={42} />;';
    expect(typeCheckSnippet(`${reviewHeader}\n${element}`).length).toBeGreaterThan(0);
  });

  it('types compareWithCurrent as a comparison or undefined', () => {
    expect(usePricingSelection).toBeTypeOf('function');
    const source = `${reviewHeader}
      import type { NormalizedPricing } from '../../src/core/index.js';
      import { usePricingSelection } from '../../src/react/use-pricing-selection.js';
      declare const pricing: NormalizedPricing;
      export function Probe(): React.ReactElement | null {
        const selection = usePricingSelection(pricing, { currentSelection: { planId: 'growth' } });
        const comparison = selection.compareWithCurrent();
        return comparison ? <PricingChangeReview comparison={comparison} /> : null;
      }
    `;
    expect(typeCheckSnippet(source)).toEqual([]);
  });
});

// [utest->req~provider-config-precedence~1]
describe('usePricingSelection: provider config below instance options', () => {
  const config = { locale: 'es-ES', variablesEnabled: false };
  const defaultSelection = { variables: { seats: 40 } };

  it('takes locale and variablesEnabled from the provider config', () => {
    configurePricingRenderer({ locale: 'en-US' });
    const { state } = renderSelection(loadAcme(), { defaultSelection }, [{ config }]);
    expect(viewModelOf(state).locale).toBe('es-ES');
    expect(selectionOf(state).variables.seats).toBe(5);
  });

  it('lets the instance options win over the provider config', () => {
    configurePricingRenderer({ locale: 'en-US' });
    const options = { locale: 'fr-FR', variablesEnabled: true, defaultSelection };
    const { state } = renderSelection(loadAcme(), options, [{ config }]);
    expect(viewModelOf(state).locale).toBe('fr-FR');
    expect(selectionOf(state).variables.seats).toBe(40);
  });

  it('falls back to the global configuration for a key the provider config leaves out', () => {
    configurePricingRenderer({ locale: 'it-IT', variablesEnabled: false });
    const providers = [{ config: { pricingPath: '/catalog' } }];
    const { state } = renderSelection(loadAcme(), { defaultSelection }, providers);
    expect(viewModelOf(state).locale).toBe('it-IT');
    expect(selectionOf(state).variables.seats).toBe(5);
  });
});

// [utest->req~provider-presentation-precedence~1]
describe('usePricingSelection: presentation layers', () => {
  it('merges the provider presentation with the instance presentation', () => {
    const providers = [{ presentation: { planBadges: { growth: badge('Provider') } } }];
    const onStarter = { presentation: { planBadges: { starter: badge('Instance') } } };
    const { state } = renderSelection(loadAcme(), onStarter, providers);
    expect(badgeLabel(state, 'growth')).toBe('Provider');
    expect(badgeLabel(state, 'starter')).toBe('Instance');
    const onGrowth = { presentation: { planBadges: { growth: badge('Instance') } } };
    const over = renderSelection(loadAcme(), onGrowth, providers);
    expect(badgeLabel(over.state, 'growth')).toBe('Instance');
  });

  it('orders global, provider config and provider presentation', () => {
    const global = badge('Global');
    configurePricingRenderer({
      presentation: { planBadges: { starter: global, growth: global, enterprise: global } },
    });
    const c = badge('Config');
    const config = { presentation: { planBadges: { growth: c, enterprise: c } } };
    const presentation = { planBadges: { enterprise: badge('Provider') } };
    const { state } = renderSelection(loadAcme(), {}, [{ config, presentation }]);
    expect(badgeLabel(state, 'starter')).toBe('Global');
    expect(badgeLabel(state, 'growth')).toBe('Config');
    expect(badgeLabel(state, 'enterprise')).toBe('Provider');
  });

  it('keeps custom.pricingRenderer of the pricing as the lowest layer', () => {
    const plain = renderSelection(loadAcme(), {});
    expect(badgeLabel(plain.state, 'growth')).toBe('Most popular');
    configurePricingRenderer({ presentation: { planBadges: { growth: badge('Global') } } });
    const global = renderSelection(loadAcme(), {});
    expect(badgeLabel(global.state, 'growth')).toBe('Global');
    expect(badgeLabel(global.state, 'enterprise')).toBe('Built for scale');
  });
});

// [utest->req~provider-messages-merge~1]
describe('usePricingSelection: messages merge per key', () => {
  it('replaces one key of the provider catalog and keeps the others', () => {
    const catalog = { 'summary.title': 'Your plan', 'cta.select': 'Pick' };
    const options = { messages: { 'cta.select': 'Choose' } };
    const { state } = renderSelection(loadAcme(), options, [{ messages: catalog }]);
    const messages = viewModelOf(state).messages;
    expect(messages['cta.select']).toBe('Choose');
    expect(messages['summary.title']).toBe('Your plan');
  });

  it('uses the provider catalog when the instance sets none', () => {
    const providers = [{ messages: { 'cta.select': 'Pick' } }];
    const { state } = renderSelection(loadAcme(), {}, providers);
    expect(viewModelOf(state).messages['cta.select']).toBe('Pick');
  });
});

// [utest->req~provider-nearest~1]
describe('usePricingSelection: nearest provider wins', () => {
  it('does not take the config of an outer provider', () => {
    const outer = { config: { locale: 'es-ES' } };
    const inner = { messages: { 'cta.select': 'Inner' } };
    const { state } = renderSelection(loadAcme(), {}, [outer, inner]);
    expect(viewModelOf(state).locale).toBe('en-US');
    expect(viewModelOf(state).messages['cta.select']).toBe('Inner');
  });

  it('does not take the messages of an outer provider', () => {
    const outer = { messages: { 'summary.title': 'Outer title', 'cta.select': 'Outer' } };
    const inner = { messages: { 'cta.select': 'Inner' } };
    const { state } = renderSelection(loadAcme(), {}, [outer, inner]);
    const messages = viewModelOf(state).messages;
    expect(messages['cta.select']).toBe('Inner');
    expect(messages['summary.title']).toBe(getMessages('en-US')['summary.title']);
  });
});

// [utest->req~provider-no-global-write~1]
describe('usePricingSelection: provider keeps the global configuration', () => {
  it('leaves the global locale alone and gives a tree without a provider the global one', () => {
    const provider = createElement(PricingRendererProvider, { config: { locale: 'es-ES' } });
    renderToString(provider);
    expect(getPricingRendererConfig().locale).toBe('en-US');
    const withProvider = renderSelection(loadAcme(), {}, [{ config: { locale: 'es-ES' } }]);
    expect(viewModelOf(withProvider.state).locale).toBe('es-ES');
    expect(getPricingRendererConfig().locale).toBe('en-US');
    const bare = renderSelection(loadAcme(), {});
    expect(viewModelOf(bare.state).locale).toBe('en-US');
  });

  it('does not register the provider messages or presentation globally', () => {
    const before = structuredClone(getPricingRendererConfig());
    const provider = {
      messages: { 'cta.select': 'Pick' },
      presentation: { planBadges: { growth: badge('Provider') } },
    };
    renderSelection(loadAcme(), {}, [provider]);
    expect(getPricingRendererConfig()).toEqual(before);
    expect(getMessages('en-US')['cta.select']).not.toBe('Pick');
    const bare = renderSelection(loadAcme(), {});
    expect(viewModelOf(bare.state).messages['cta.select']).not.toBe('Pick');
    expect(badgeLabel(bare.state, 'growth')).toBe('Most popular');
  });
});

// [utest->req~provider-absent-global~1]
describe('usePricingSelection: global configuration without a provider', () => {
  const defaultSelection = { variables: { seats: 40 } };

  it('reads the global locale and variablesEnabled at render time', () => {
    configurePricingRenderer({ locale: 'es-ES', variablesEnabled: false });
    const { state } = renderSelection(loadAcme(), { defaultSelection });
    expect(viewModelOf(state).locale).toBe('es-ES');
    expect(selectionOf(state).variables.seats).toBe(5);
  });

  it('lets the option locale win over the global locale', () => {
    configurePricingRenderer({ locale: 'es-ES', variablesEnabled: false });
    const { state } = renderSelection(loadAcme(), { locale: 'fr-FR', defaultSelection });
    expect(viewModelOf(state).locale).toBe('fr-FR');
  });

  it('follows a later configurePricingRenderer call on the next render', () => {
    const first = renderSelection(loadAcme(), {});
    expect(viewModelOf(first.state).locale).toBe('en-US');
    configurePricingRenderer({ locale: 'es-ES' });
    const second = renderSelection(loadAcme(), {});
    expect(viewModelOf(second.state).locale).toBe('es-ES');
  });
});
