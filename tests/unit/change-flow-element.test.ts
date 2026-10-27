import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { createPricingViewModel, enUS, esES, normalizePricing } from '../../src/core/index.js';
import type {
  NormalizedPricing,
  PricingCta,
  PricingSelection,
  PricingViewModel,
} from '../../src/core/index.js';
import {
  expandCtaHref,
  isPendingActionId,
  planCtaView,
  summaryActionState,
} from '../../src/element/cta.js';
import {
  currentSelectionDiagnostics,
  deriveCurrentContext,
} from '../../src/element/current-selection.js';
import { loadAcme } from './helpers/compare-fixtures.js';

// The element side of the current selection and the plan CTAs of add-subscription-change-flow
// (phase C): property declarations, types, messages, the manifest and the pure helpers. The
// rendering and the events are covered by tests/browser/current-selection.spec.ts and
// tests/browser/plan-cta.spec.ts (the node environment renders nothing).

type Raw = Record<string, unknown>;

interface ElementClass {
  properties: Record<string, { attribute?: string | false; type?: unknown }>;
  new (): { currentSelection?: unknown };
}

async function loadElement(): Promise<ElementClass> {
  const loaded: unknown = await import('../../src/element/pricing-renderer-element.js');
  return (loaded as { PricingRendererElement: ElementClass }).PricingRendererElement;
}

// Type-checks a snippet with the strict options of tsconfig.base.json. The snippet is served from
// memory next to this file, so its relative imports resolve to src/** on disk.
function typeCheckSnippet(source: string): ts.Diagnostic[] {
  const snippetPath = fileURLToPath(new URL('./__snippet__.ts', import.meta.url));
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2021,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
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
      ? ts.createSourceFile(fileName, source, languageVersion, true)
      : getSourceFile(fileName, languageVersion, onError, shouldCreate);
  const program = ts.createProgram([snippetPath], options, host);
  return ts.getPreEmitDiagnostics(program, program.getSourceFile(snippetPath));
}

const messages = (diagnostics: ts.Diagnostic[]): string[] =>
  diagnostics.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));

const codes = (diagnostics: ts.Diagnostic[]): number[] =>
  diagnostics.map((diagnostic) => diagnostic.code);

const C: Partial<PricingSelection> = {
  planId: 'growth',
  addOns: {
    extraStorage: { selected: true, quantity: 2 },
    prioritySuccess: { selected: true, quantity: 1 },
  },
};

const header = { syntaxVersion: '3.1', version: '1', createdAt: '2026-01-01', currency: 'EUR' };

function normalize(raw: Raw): NormalizedPricing {
  return normalizePricing({ ...header, ...raw } as never).value!;
}

const PV = normalize({
  saasName: 'Private',
  plans: { basic: { price: 10 }, legacy: { price: 15, private: true }, pro: { price: 30 } },
});
const PQ = normalize({
  saasName: 'Quote',
  plans: { basic: { price: 10 }, pro: { price: 30 }, enterprise: { price: 'Contact us' } },
});
const PS = normalize({
  saasName: 'Slash',
  plans: { 'pro plus/x': { price: 5 }, 'javascript:alert(1)': { price: 6 } },
});

function viewModelOf(
  pricing: NormalizedPricing,
  selection?: Partial<PricingSelection>,
  ctas?: Raw[],
): PricingViewModel {
  return createPricingViewModel(pricing, selection, {
    locale: 'en-US',
    ...(ctas ? { presentation: { ctas: ctas as unknown as PricingCta[] } } : {}),
  });
}

function planOf(viewModel: PricingViewModel, id: string): PricingViewModel['plans'][number] {
  return viewModel.plans.find((plan) => plan.id === id)!;
}

describe('property declarations', () => {
  // [utest->req~current-selection-property~1]
  it('declares currentSelection without an attribute', async () => {
    const Element = await loadElement();
    expect(Element.properties.currentSelection).toEqual({ attribute: false });
  });

  // [utest->req~cta-pending-property~1]
  it('declares pendingActionId with the attribute pending-action-id', async () => {
    const Element = await loadElement();
    expect(Element.properties.pendingActionId).toEqual({
      type: String,
      attribute: 'pending-action-id',
    });
  });

  // [utest->req~current-selection-detached~1]
  it('keeps a deep copy of the value it receives and leaves the value unmutated', async () => {
    const Element = await loadElement();
    const element = new Element();
    const input = { planId: 'growth', addOns: { extraStorage: { selected: true, quantity: 2 } } };
    const copy = structuredClone(input);
    element.currentSelection = input;
    expect(element.currentSelection).toEqual(copy);
    expect(element.currentSelection).not.toBe(input);
    input.planId = 'starter';
    input.addOns.extraStorage.quantity = 9;
    expect(element.currentSelection).toEqual(copy);
    element.currentSelection = undefined;
    expect(element.currentSelection).toBeUndefined();
  });
});

describe('types through the compiler API', () => {
  const elementHeader = `
    import type { PricingRendererElement } from '../../src/element/index.js';
    declare const element: PricingRendererElement;
  `;
  const reactHeader = `
    import * as React from 'react';
    import { PricingRenderer } from '../../src/react/index.js';
    declare const source: string;
  `;

  // [utest->req~current-selection-property~1]
  it('types the currentSelection property of the element', () => {
    const accepted = typeCheckSnippet(
      `${elementHeader}\nelement.currentSelection = { planId: 'growth' };\nelement.currentSelection = undefined;`,
    );
    expect(messages(accepted)).toEqual([]);
    // Partial<PricingSelection> is a weak type, so the compiler reports a number as TS2559 (no
    // properties in common) and a property of the wrong type as TS2322.
    const rejected = typeCheckSnippet(`${elementHeader}\nelement.currentSelection = 42;`);
    expect(codes(rejected)).toEqual([2559]);
    const wrongField = typeCheckSnippet(
      `${elementHeader}\nelement.currentSelection = { planId: 42 };`,
    );
    expect(codes(wrongField)).toEqual([2322]);
  });

  // [utest->req~cta-pending-react-manifest~1]
  it('types the pendingActionId property of the element', () => {
    const accepted = typeCheckSnippet(
      `${elementHeader}\nelement.pendingActionId = 'start-growth';\nelement.pendingActionId = undefined;`,
    );
    expect(messages(accepted)).toEqual([]);
    const rejected = typeCheckSnippet(`${elementHeader}\nelement.pendingActionId = 42;`);
    expect(codes(rejected)).toEqual([2322]);
  });

  // [utest->req~current-selection-react~1]
  it('types the currentSelection prop of PricingRenderer', () => {
    const accepted = typeCheckSnippet(
      `${reactHeader}\nexport const ok = React.createElement(PricingRenderer, { yaml: source, currentSelection: { planId: 'growth' } });`,
    );
    expect(messages(accepted)).toEqual([]);
    const rejected = typeCheckSnippet(
      `${reactHeader}\nexport const bad = React.createElement(PricingRenderer, { yaml: source, currentSelection: 42 });`,
    );
    expect(rejected.length).toBeGreaterThan(0);
  });

  // [utest->req~cta-pending-react-manifest~1]
  it('types the pendingActionId prop of PricingRenderer', () => {
    const accepted = typeCheckSnippet(
      `${reactHeader}\nexport const ok = React.createElement(PricingRenderer, { yaml: source, pendingActionId: 'start-growth' });`,
    );
    expect(messages(accepted)).toEqual([]);
    const rejected = typeCheckSnippet(
      `${reactHeader}\nexport const bad = React.createElement(PricingRenderer, { yaml: source, pendingActionId: 42 });`,
    );
    expect(rejected.length).toBeGreaterThan(0);
  });

  // [utest->req~cta-types~1]
  it('types PricingCta.labels and exports SelectionRelation from the core', () => {
    const header = `
      import type { PricingCta, PricingCtaLabels, SelectionRelation } from '../../src/core/index.js';
    `;
    const accepted = typeCheckSnippet(`${header}
      export const cta: PricingCta = {
        id: 'a',
        label: 'A',
        labels: { upgrade: 'Up', contactSales: 'Talk to us' },
      };
      export const labels: PricingCtaLabels = { upgrade: 'u', downgrade: 'd', current: 'c' };
      export const relation: SelectionRelation = 'upgrade';
    `);
    expect(messages(accepted)).toEqual([]);
    const rejected = typeCheckSnippet(`${header}
      export const cta: PricingCta = { id: 'a', label: 'A', labels: { sidegrade: 'Across' } };
    `);
    expect(rejected.length).toBeGreaterThan(0);
  });

  // [utest->req~cta-event-types~1]
  it('types relation and source of PricingActionDetail and re-exports SelectionRelation', () => {
    const header = `
      import type { PricingSelection, ResolvedPricing } from '../../src/core/index.js';
      import type { PricingActionDetail, SelectionRelation } from '../../src/react/index.js';
      import type { SelectionRelation as FromElement } from '../../src/element/index.js';
      declare const detail: PricingActionDetail;
      declare const selection: PricingSelection;
      declare const resolved: ResolvedPricing;
    `;
    const accepted = typeCheckSnippet(`${header}
      export const relation: SelectionRelation | undefined = detail.relation;
      export const source: 'plan' | 'summary' | undefined = detail.source;
      export const same: FromElement | undefined = detail.relation;
    `);
    expect(messages(accepted)).toEqual([]);
    const rejected = typeCheckSnippet(`${header}
      export const bad: PricingActionDetail = { actionId: 'a', selection, resolved, source: 'header' };
    `);
    expect(codes(rejected)).toEqual([2322]);
  });
});

describe('messages', () => {
  // [utest->req~current-selection-i18n~1]
  it('defines the current selection texts in English and Spanish', () => {
    expect(enUS['pricing.currentPlanBadge']).toBe('Your plan');
    expect(enUS['pricing.currentPlanCta']).toBe('Current plan');
    expect(enUS['pricing.upgradeTo']).toBe('Upgrade to {plan}');
    expect(enUS['pricing.downgradeTo']).toBe('Downgrade to {plan}');
    expect(enUS['pricing.currentAddOn']).toBe('Current');
    expect(esES['pricing.currentPlanBadge']).toBe('Tu plan');
    expect(esES['pricing.currentPlanCta']).toBe('Plan actual');
    expect(esES['pricing.upgradeTo']).toBe('Mejorar a {plan}');
    expect(esES['pricing.downgradeTo']).toBe('Bajar a {plan}');
    expect(esES['pricing.currentAddOn']).toBe('Actual');
  });

  // [utest->req~cta-i18n~1]
  it('defines the summary action and pending texts in English and Spanish', () => {
    expect(enUS['pricing.reviewChangeCta']).toBe('Review change ({total})');
    expect(enUS['pricing.pending']).toBe('Processing…');
    expect(esES['pricing.reviewChangeCta']).toBe('Revisar cambio ({total})');
    expect(esES['pricing.pending']).toBe('Procesando…');
  });
});

describe('custom elements manifest', () => {
  type Member = { kind: string; name: string; type?: { text: string } };
  type Attribute = { name: string; fieldName?: string };
  type Declaration = { name: string; members?: Member[]; attributes?: Attribute[] };

  async function rendererDeclaration(): Promise<Declaration> {
    const url = new URL('../../custom-elements.json', import.meta.url);
    const manifest = JSON.parse(await readFile(fileURLToPath(url), 'utf8')) as {
      modules: { declarations?: Declaration[] }[];
    };
    const declaration = manifest.modules
      .flatMap((module) => module.declarations ?? [])
      .find((candidate) => candidate.name === 'PricingRendererElement');
    expect(declaration).toBeDefined();
    return declaration!;
  }

  // [utest->req~current-selection-manifest~1]
  it('lists the currentSelection field', async () => {
    const { members = [] } = await rendererDeclaration();
    const field = members.find((member) => member.name === 'currentSelection');
    expect(field?.kind).toBe('field');
    expect(field?.type?.text).toBe('Partial<PricingSelection> | undefined');
  });

  // [utest->req~cta-pending-react-manifest~1]
  it('lists the pendingActionId field and its attribute', async () => {
    const { members = [], attributes = [] } = await rendererDeclaration();
    const field = members.find((member) => member.name === 'pendingActionId');
    expect(field?.kind).toBe('field');
    expect(field?.type?.text).toBe('string | undefined');
    expect(attributes).toContainEqual(
      expect.objectContaining({ name: 'pending-action-id', fieldName: 'pendingActionId' }),
    );
  });
});

describe('expandCtaHref', () => {
  // [utest->req~cta-href-template~1]
  it('replaces every {planId} with the encoded plan id', () => {
    expect(expandCtaHref('/checkout/{planId}?again={planId}', 'pro plus/x')).toBe(
      '/checkout/pro%20plus%2Fx?again=pro%20plus%2Fx',
    );
    expect(expandCtaHref('https://example.com/signup?plan={planId}', 'growth')).toBe(
      'https://example.com/signup?plan=growth',
    );
    expect(expandCtaHref('https://example.com/contact', 'growth')).toBe(
      'https://example.com/contact',
    );
    expect(expandCtaHref(undefined, 'growth')).toBeUndefined();
  });

  it('knows which control is the pending one', () => {
    expect(isPendingActionId('start-growth', 'start-growth')).toBe(true);
    expect(isPendingActionId('start-growth', 'start-starter')).toBe(false);
    expect(isPendingActionId(undefined, 'start-growth')).toBe(false);
  });
});

describe('planCtaView', () => {
  const acme = loadAcme();

  // [utest->req~current-selection-unknown-plan~1] [utest->req~cta-event-unchanged~1]
  it('keeps the 0.1.0 label and link without a current plan', () => {
    const viewModel = viewModelOf(acme);
    const starter = planCtaView(viewModel, planOf(viewModel, 'starter'), {});
    expect(starter).toMatchObject({ label: 'Start with Starter', disabled: false, pending: false });
    expect(starter.relation).toBeUndefined();
    const growth = planCtaView(viewModel, planOf(viewModel, 'growth'), {});
    expect(growth.href).toBe('https://example.com/signup?plan=growth');
    expect(growth.label).toBe('Start free trial');
  });

  // [utest->req~current-selection-plan-cta~1] [utest->req~current-selection-relation-labels~1]
  it('labels the plans around the current plan by relation', () => {
    const viewModel = viewModelOf(acme);
    const context = { currentPlanId: 'growth' };
    const starter = planCtaView(viewModel, planOf(viewModel, 'starter'), context);
    expect(starter).toMatchObject({ relation: 'downgrade', label: 'Downgrade to Starter' });
    const growth = planCtaView(viewModel, planOf(viewModel, 'growth'), context);
    expect(growth).toMatchObject({ relation: 'current', label: 'Current plan', disabled: true });
    expect(growth.href).toBeUndefined();
    const enterprise = planCtaView(viewModel, planOf(viewModel, 'enterprise'), context);
    expect(enterprise).toMatchObject({
      relation: 'upgrade',
      label: 'Upgrade to Enterprise',
      href: 'https://example.com/contact',
    });
  });

  // [utest->req~cta-relation-labels-config~1]
  it('uses the configured labels and ignores the ones that are not strings', () => {
    const ctas = [
      { id: 's', label: 'S', planId: 'starter', labels: { downgrade: 'Move to Starter' } },
      { id: 'g', label: 'G', planId: 'growth', labels: { current: 'Your current plan' } },
      { id: 'e', label: 'E', planId: 'enterprise', labels: { upgrade: 'Talk to us', x: 'y' } },
    ];
    const viewModel = viewModelOf(acme, undefined, ctas);
    const context = { currentPlanId: 'growth' };
    const label = (id: string): string =>
      planCtaView(viewModel, planOf(viewModel, id), context).label;
    expect(label('starter')).toBe('Move to Starter');
    expect(label('growth')).toBe('Your current plan');
    expect(label('enterprise')).toBe('Talk to us');

    const invalid = viewModelOf(acme, undefined, [
      { id: 's', label: 'S', planId: 'starter', labels: { downgrade: 42 } },
    ]);
    expect(planCtaView(invalid, planOf(invalid, 'starter'), context).label).toBe(
      'Downgrade to Starter',
    );
    expect(invalid.presentation.ctas?.[0]?.labels).toBeUndefined();
  });

  // [utest->req~cta-contact-sales~1]
  it('labels a plan without a price Contact sales', () => {
    const viewModel = viewModelOf(PQ);
    const context = { currentPlanId: 'basic' };
    expect(planCtaView(viewModel, planOf(viewModel, 'basic'), context).label).toBe('Current plan');
    expect(planCtaView(viewModel, planOf(viewModel, 'pro'), context).label).toBe('Upgrade to Pro');
    const enterprise = planCtaView(viewModel, planOf(viewModel, 'enterprise'), context);
    expect(enterprise).toMatchObject({ label: 'Contact sales', relation: 'upgrade' });

    const custom = viewModelOf(PQ, undefined, [
      { id: 'e', label: 'E', planId: 'enterprise', labels: { contactSales: 'Talk to us' } },
    ]);
    expect(planCtaView(custom, planOf(custom, 'enterprise'), context).label).toBe('Talk to us');
  });

  // [utest->req~current-selection-private-plan~1]
  it('labels the visible plans by the order of all plans, private ones included', () => {
    const viewModel = viewModelOf(PV);
    expect(viewModel.plans.map((plan) => plan.id)).toEqual(['basic', 'pro']);
    const context = { currentPlanId: 'legacy' };
    expect(planCtaView(viewModel, planOf(viewModel, 'basic'), context).label).toBe(
      'Downgrade to Basic',
    );
    expect(planCtaView(viewModel, planOf(viewModel, 'pro'), context).label).toBe('Upgrade to Pro');
  });

  // [utest->req~cta-pending-state~1] [utest->req~cta-pending-others~1]
  it('marks the pending control busy and every control aria-disabled', () => {
    const viewModel = viewModelOf(acme);
    const context = { pendingActionId: 'start-growth' };
    const growth = planCtaView(viewModel, planOf(viewModel, 'growth'), context);
    expect(growth).toMatchObject({ pending: true, ariaDisabled: true });
    const starter = planCtaView(viewModel, planOf(viewModel, 'starter'), context);
    expect(starter).toMatchObject({ pending: false, ariaDisabled: true });
    const idle = planCtaView(viewModel, planOf(viewModel, 'growth'), {});
    expect(idle).toMatchObject({ pending: false, ariaDisabled: false });
  });

  // [utest->req~cta-href-template-unsafe~1] [utest->req~cta-href-template~1]
  it('renders an expanded link as a button when it is not safe', () => {
    const viewModel = viewModelOf(PS, undefined, [
      { id: 'bad', label: 'Bad', planId: 'javascript:alert(1)', href: '{planId}' },
      { id: 'go', label: 'Go', planId: 'pro plus/x', href: '/checkout/{planId}' },
    ]);
    const bad = planCtaView(viewModel, planOf(viewModel, 'javascript:alert(1)'), {});
    expect(bad.href).toBeUndefined();
    expect(bad.label).toBe('Bad');
    const go = planCtaView(viewModel, planOf(viewModel, 'pro plus/x'), {});
    expect(go.href).toBe('/checkout/pro%20plus%2Fx');
    expect(go.eventHref).toBe('/checkout/pro%20plus%2Fx');
  });
});

describe('summaryActionState', () => {
  const acme = loadAcme();

  // [utest->req~cta-summary-action~1] [utest->req~cta-summary-action-current~1]
  it('reviews the change, disabled while nothing changes', () => {
    const viewModel = viewModelOf(acme, C);
    expect(summaryActionState(viewModel, 'current')).toEqual({
      actionId: 'review-change',
      label: 'Review change (€80)',
      relation: 'current',
      disabled: true,
    });
    expect(summaryActionState(viewModel, 'upgrade')).toMatchObject({ disabled: false });
  });

  // [utest->req~cta-summary-action-quote~1]
  it('asks for a quote when the selection requires one', () => {
    const viewModel = viewModelOf(PQ, { planId: 'enterprise' });
    expect(summaryActionState(viewModel, 'upgrade')).toEqual({
      actionId: 'contact-sales',
      label: 'Contact sales',
      relation: 'upgrade',
      disabled: false,
    });
  });
});

describe('current selection', () => {
  const acme = loadAcme();

  // [utest->req~current-selection-plan-mark~1] [utest->req~current-selection-addons~1]
  it('derives the plan and the reconciled add-ons', () => {
    const context = deriveCurrentContext(acme, C);
    expect(context?.planId).toBe('growth');
    expect([...context!.addOnIds].sort()).toEqual(['extraStorage', 'prioritySuccess']);
  });

  // [utest->req~current-selection-addons~1]
  it('drops the add-ons that reconciliation removes and ignores unknown ids', () => {
    const starter = deriveCurrentContext(acme, {
      planId: 'starter',
      addOns: { extraStorage: { selected: true, quantity: 2 } },
    });
    expect(starter?.planId).toBe('starter');
    expect(starter?.addOnIds.size).toBe(0);
    const ghost = deriveCurrentContext(acme, {
      planId: 'growth',
      addOns: {
        ghost: { selected: true, quantity: 1 },
        extraStorage: { selected: false, quantity: 1 },
      },
    });
    expect(ghost?.addOnIds.size).toBe(0);
  });

  // [utest->req~current-selection-unknown-plan~1] [utest->req~current-selection-unset~1]
  it('has no context without a known plan', () => {
    expect(deriveCurrentContext(acme, undefined)).toBeUndefined();
    expect(deriveCurrentContext(acme, {})).toBeUndefined();
    expect(deriveCurrentContext(acme, { planId: 'legacy' })).toBeUndefined();
    expect(
      deriveCurrentContext(acme, { addOns: { extraStorage: { selected: true, quantity: 3 } } }),
    ).toBeUndefined();
    expect(deriveCurrentContext(acme, 42 as never)).toBeUndefined();
  });

  // [utest->req~current-selection-private-plan~1]
  it('knows a private plan of the pricing', () => {
    expect(deriveCurrentContext(PV, { planId: 'legacy' })?.planId).toBe('legacy');
  });

  // [utest->req~current-selection-diagnostics~1]
  it('reports one warning per unknown plan or add-on id', () => {
    const diagnostics = currentSelectionDiagnostics(acme, {
      planId: 'legacy',
      addOns: {
        ghost: { selected: true, quantity: 1 },
        extraStorage: { selected: true, quantity: 1 },
      },
    });
    expect(diagnostics.map((item) => [item.code, item.severity, item.path])).toEqual([
      ['PR_CURRENT_SELECTION_UNKNOWN_PLAN', 'warning', 'currentSelection.planId'],
      ['PR_CURRENT_SELECTION_UNKNOWN_ADDON', 'warning', 'currentSelection.addOns.ghost'],
    ]);
    expect(currentSelectionDiagnostics(acme, C)).toEqual([]);
    expect(currentSelectionDiagnostics(acme, undefined)).toEqual([]);
    expect(currentSelectionDiagnostics(PV, { planId: 'legacy' })).toEqual([]);
  });
});
