import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { beforeAll, describe, expect, it } from 'vitest';

type Fn = (...args: unknown[]) => unknown;
type Slots = Partial<
  Record<
    | 'slotNamesOf'
    | 'currentSlotNodes'
    | 'acceptedSlotNodes'
    | 'planCtaContextOf'
    | 'summaryActionsContextOf'
    | 'errorContextOf'
    | 'errorDiagnosticsOf'
    | 'slotEntriesOf',
    Fn
  >
>;
type Context = Record<string, unknown>;

// src/react/slots.ts is not re-exported by any entry when the red check runs, so it is loaded by
// its own path; a missing module becomes an empty object and the first assertion fails.
let mod: Slots = {};
beforeAll(async () => {
  mod = (await import('../../src/react/slots.js').catch(() => ({}))) as Slots;
});

function fn<K extends keyof Slots>(name: K): Fn {
  const found = mod[name];
  expect(found).toBeTypeOf('function');
  return found as Fn;
}

type StandIn = Record<string, unknown>;

// A stand-in slot node whose parent element's `closest` returns `owner`.
function slotNode(
  dataset: Record<string, string>,
  owner: unknown,
  extra: { isConnected?: boolean; selectors?: string[] } = {},
): StandIn {
  return {
    isConnected: extra.isConnected ?? true,
    dataset,
    parentElement: {
      closest: (selector: string) => {
        extra.selectors?.push(selector);
        return owner;
      },
    },
  };
}

const planDataset = {
  prSlot: 'plan-cta',
  planId: 'growth',
  planName: 'Growth',
  label: 'Upgrade to Growth',
  href: 'https://example.com/signup?plan=growth',
  relation: 'upgrade',
  selected: 'false',
  pending: 'true',
};

const without = (dataset: Record<string, string>, key: string): Record<string, string> =>
  Object.fromEntries(Object.entries(dataset).filter(([name]) => name !== key));

const planNode = (dataset: Record<string, string>): StandIn => ({ isConnected: true, dataset });
const planContext = (node: StandIn, element: StandIn = {}): Context =>
  fn('planCtaContextOf')(element, node) as Context;

// [utest->req~react-render-props-slots~1]
describe('slotNamesOf', () => {
  it('lists the slot names of the render props given as functions, in a fixed order', () => {
    const slotNamesOf = fn('slotNamesOf');
    const f = () => null;
    expect(slotNamesOf({ renderError: f, renderPlanCta: f })).toEqual(['plan-cta', 'error']);
    expect(
      slotNamesOf({
        renderError: f,
        renderLoading: f,
        renderSummaryActions: f,
        renderPlanCta: f,
      }),
    ).toEqual(['plan-cta', 'summary-actions', 'loading', 'error']);
  });

  it('returns undefined for non-functions and for no props', () => {
    const slotNamesOf = fn('slotNamesOf');
    expect(slotNamesOf({ renderLoading: 'x', renderSummaryActions: undefined })).toBeUndefined();
    expect(slotNamesOf({})).toBeUndefined();
  });
});

// [utest->req~react-slots-attach-read~1]
describe('currentSlotNodes', () => {
  it('reads the [data-pr-slot] nodes that the element owns', () => {
    const currentSlotNodes = fn('currentSlotNodes');
    const selectors: string[] = [];
    const own: StandIn = {};
    const nested: StandIn = {};
    const p = slotNode({ prSlot: 'plan-cta', planId: 'starter' }, own);
    const q = slotNode({ prSlot: 'plan-cta', planId: 'growth' }, nested);
    const r = slotNode({ prSlot: 'summary-actions' }, own);
    own.querySelectorAll = (selector: string) => {
      selectors.push(selector);
      return [p, q, r];
    };
    expect(currentSlotNodes(own)).toEqual([p, r]);
    const result = currentSlotNodes(own) as unknown[];
    expect(result[0]).toBe(p);
    expect(result[1]).toBe(r);
    expect(selectors[0]).toBe('[data-pr-slot]');
  });
});

describe('acceptedSlotNodes', () => {
  const growth = { prSlot: 'plan-cta', planId: 'growth' };

  // [utest->req~react-slots-event-target~1]
  it('returns undefined for the event of another element', () => {
    const acceptedSlotNodes = fn('acceptedSlotNodes');
    const own: StandIn = {};
    const other: StandIn = {};
    const n = slotNode(growth, own);
    expect(acceptedSlotNodes(own, { target: other, detail: { nodes: [n] } })).toBeUndefined();
  });

  // [utest->req~react-slots-event-target~1]
  it('returns the nodes of its own event', () => {
    const acceptedSlotNodes = fn('acceptedSlotNodes');
    const own: StandIn = {};
    const n = slotNode(growth, own);
    const result = acceptedSlotNodes(own, { target: own, detail: { nodes: [n] } }) as unknown[];
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(n);
  });

  // [utest->req~react-slot-node-accept~2]
  it('leaves out foreign, detached and unknown nodes and keeps the order', () => {
    const acceptedSlotNodes = fn('acceptedSlotNodes');
    const own: StandIn = {};
    const other: StandIn = {};
    const starter = { prSlot: 'plan-cta', planId: 'starter' };
    const a = slotNode(starter, own);
    const b = slotNode(starter, other);
    const c = slotNode(starter, own, { isConnected: false });
    const d = slotNode({ prSlot: 'footer' }, own);
    const e = slotNode({ prSlot: 'plan-cta' }, own);
    const f = slotNode({ prSlot: 'summary-actions' }, own);
    const result = acceptedSlotNodes(own, {
      target: own,
      detail: { nodes: [b, a, c, d, e, f] },
    }) as unknown[];
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(a);
    expect(result[1]).toBe(f);
  });

  // [utest->req~react-slot-node-accept~2]
  it('leaves out an empty plan id', () => {
    const acceptedSlotNodes = fn('acceptedSlotNodes');
    const own: StandIn = {};
    const empty = slotNode({ prSlot: 'plan-cta', planId: '' }, own);
    expect(acceptedSlotNodes(own, { target: own, detail: { nodes: [empty] } })).toEqual([]);
  });

  // [utest->req~react-slot-node-accept~2]
  it('leaves out the slot nodes of a nested renderer and nodes without a parent', () => {
    const acceptedSlotNodes = fn('acceptedSlotNodes');
    const own: StandIn = {};
    const nested: StandIn = {};
    const selectors: string[] = [];
    const n = slotNode(growth, own);
    const g = slotNode(growth, nested, { selectors });
    const h: StandIn = { isConnected: true, dataset: growth, parentElement: null };
    const result = acceptedSlotNodes(own, {
      target: own,
      detail: { nodes: [g, h, n] },
    }) as unknown[];
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(n);
    expect(selectors).toContain('[data-pr-root], [data-pr-slot]');
  });

  // [utest->req~react-slot-node-accept~2]
  it('skips items that are not elements without throwing', () => {
    const acceptedSlotNodes = fn('acceptedSlotNodes');
    const own: StandIn = {};
    const textNode: StandIn = { nodeType: 3, isConnected: true };
    expect(
      acceptedSlotNodes(own, {
        target: own,
        detail: { nodes: [null, undefined, 'x', 1, textNode] },
      }),
    ).toEqual([]);
  });
});

describe('acceptedSlotNodes with a malformed event', () => {
  // [utest->req~react-slot-node-accept~2]
  it('returns an empty list for a null detail and for nodes that are not an array', () => {
    const acceptedSlotNodes = fn('acceptedSlotNodes');
    const own: StandIn = {};
    expect(acceptedSlotNodes(own, { target: own, detail: null })).toEqual([]);
    expect(acceptedSlotNodes(own, { target: own, detail: { nodes: 'x' } })).toEqual([]);
    expect(acceptedSlotNodes(own, { target: own, detail: {} })).toEqual([]);
  });
});

describe('slotEntriesOf keys', () => {
  // [utest->req~react-slot-portals~2]
  it('keeps plan keys and slot keys apart even for a plan id that looks like a slot key', () => {
    const slotEntriesOf = fn('slotEntriesOf');
    const plan = planNode({ prSlot: 'plan-cta', planId: 'slot:summary-actions' });
    const summary = planNode({ prSlot: 'summary-actions' });
    const entries = slotEntriesOf({}, [plan, summary], { selection: {}, resolved: {} }) as {
      key: string;
    }[];
    expect(entries.map((entry) => entry.key)).toEqual([
      'plan:slot:summary-actions',
      'slot:summary-actions',
    ]);
    expect(new Set(entries.map((entry) => entry.key)).size).toBe(2);
  });
});

describe('planCtaContextOf', () => {
  // [utest->req~react-plan-context-reader~1]
  it('reads the values of a plan node', () => {
    const context = planContext(planNode(planDataset));
    expect(context).toMatchObject({
      planId: 'growth',
      planName: 'Growth',
      label: 'Upgrade to Growth',
      href: 'https://example.com/signup?plan=growth',
      relation: 'upgrade',
      selected: false,
      current: false,
      pending: true,
    });
  });

  // [utest->req~react-plan-context-reader~1]
  it('reads true flags and ignores an unknown relation', () => {
    const base = { prSlot: 'plan-cta', planId: 'starter', planName: 'Starter', label: 'Go' };
    const flags = planContext(planNode({ ...base, selected: 'true', current: 'true' }));
    expect(flags).toMatchObject({ selected: true, current: true, pending: false });
    const withoutPending = without(planDataset, 'pending');
    const context = planContext(planNode({ ...withoutPending, relation: 'sideways' }));
    expect(context.relation).toBeUndefined();
    expect(context.pending).toBe(false);
  });

  // [utest->req~react-plan-context-any-pending~1]
  it('reads anyPending apart from pending', () => {
    const context = planContext(
      planNode({
        prSlot: 'plan-cta',
        planId: 'starter',
        planName: 'Starter',
        label: 'Get started',
        selected: 'true',
        anyPending: 'true',
      }),
    );
    expect(context.anyPending).toBe(true);
    expect(context.pending).toBe(false);
  });

  // [utest->req~react-plan-context-any-pending~1]
  it('reports nothing pending when the attributes are absent', () => {
    const withoutPending = without(planDataset, 'pending');
    const context = planContext(planNode({ ...withoutPending, relation: 'sideways' }));
    expect(context.anyPending).toBe(false);
  });

  // [utest->req~react-slot-href-safe~1]
  it('drops a script link and keeps the label', () => {
    const context = planContext(planNode({ ...planDataset, href: 'javascript:alert(1)' }));
    expect(context.href).toBeUndefined();
    expect(context.label).toBe('Upgrade to Growth');
  });

  // [utest->req~react-slot-href-safe~1]
  it('has no link without data-href', () => {
    expect(planContext(planNode(without(planDataset, 'href'))).href).toBeUndefined();
  });

  // [utest->req~react-plan-context-trigger~1]
  it('forwards trigger() to the element and returns its result', () => {
    const calls: unknown[][] = [];
    const element = {
      triggerPlanAction: (...args: unknown[]) => {
        calls.push(args);
        return false;
      },
    };
    const context = planContext(planNode({ prSlot: 'plan-cta', planId: 'enterprise' }), element);
    expect((context.trigger as Fn)()).toBe(false);
    expect(calls).toEqual([['enterprise']]);
  });
});

// [utest->req~react-summary-context-reader~1]
describe('summaryActionsContextOf', () => {
  const s = { planId: 'growth' };
  const r = { total: 1 };

  it('reads relation and pending from the node and the rest from the state', () => {
    const summaryActionsContextOf = fn('summaryActionsContextOf');
    const node = planNode({ prSlot: 'summary-actions', relation: 'upgrade', pending: 'true' });
    const context = summaryActionsContextOf(node, { selection: s, resolved: r }) as Context;
    expect(context).toEqual({ selection: s, resolved: r, relation: 'upgrade', pending: true });
    expect(context.selection).toBe(s);
    expect(context.resolved).toBe(r);
  });

  it('has no relation and is not pending without a current plan', () => {
    const summaryActionsContextOf = fn('summaryActionsContextOf');
    const node = planNode({ prSlot: 'summary-actions' });
    const context = summaryActionsContextOf(node, { selection: s, resolved: r }) as Context;
    expect(context.relation).toBeUndefined();
    expect(context.pending).toBe(false);
  });
});

// [utest->req~react-error-context-reload~1]
describe('errorContextOf', () => {
  it('returns the diagnostics and a reload that calls the element each time', () => {
    const errorContextOf = fn('errorContextOf');
    let count = 0;
    const element = {
      reload: () => {
        count += 1;
        return Promise.resolve();
      },
    };
    const d = [{ code: 'PR_SOURCE_HTTP_ERROR', severity: 'error', message: 'm' }];
    const context = errorContextOf(element, d) as Context;
    expect(context.diagnostics).toBe(d);
    (context.reload as Fn)();
    (context.reload as Fn)();
    expect(count).toBe(2);
  });
});

// [utest->req~react-error-diagnostics-reader~1]
describe('errorDiagnosticsOf', () => {
  it('keeps the valid entries and only their known fields', () => {
    const errorDiagnosticsOf = fn('errorDiagnosticsOf');
    const diagnostics =
      '[{"code":"PR_SOURCE_HTTP_ERROR","severity":"error","message":"Pricing request failed with HTTP 404.","extra":1},' +
      '{"code":1,"severity":"error","message":"m"},' +
      '{"code":"PR_YAML_PARSE_ERROR","severity":"fatal","message":"m"},' +
      '{"code":"PR_YAML_PARSE_ERROR","severity":"error","message":"m","path":"$"}]';
    expect(errorDiagnosticsOf(planNode({ prSlot: 'error', diagnostics }))).toEqual([
      {
        code: 'PR_SOURCE_HTTP_ERROR',
        severity: 'error',
        message: 'Pricing request failed with HTTP 404.',
      },
      { code: 'PR_YAML_PARSE_ERROR', severity: 'error', message: 'm', path: '$' },
    ]);
  });

  it('returns an empty array for a missing or malformed attribute', () => {
    const errorDiagnosticsOf = fn('errorDiagnosticsOf');
    for (const dataset of [
      { prSlot: 'error' },
      { prSlot: 'error', diagnostics: '{' },
      { prSlot: 'error', diagnostics: '{"code":"PR_YAML_PARSE_ERROR"}' },
    ]) {
      expect(errorDiagnosticsOf(planNode(dataset))).toEqual([]);
    }
  });
});

// [utest->req~react-slots-client-only~1]
describe('Server output', () => {
  it('renders the tag and calls no render prop', async () => {
    fn('slotNamesOf');
    const { PricingRenderer } = await import('../../src/react/index.js');
    const { createElement } = await import('react');
    const { renderToString } = await import('react-dom/server');
    const counts = { plan: 0, summary: 0, loading: 0, error: 0 };
    const html = renderToString(
      createElement(PricingRenderer, {
        yaml: 'name: x',
        renderPlanCta: () => {
          counts.plan += 1;
          return createElement('span', { 'data-rp': '' });
        },
        renderSummaryActions: () => {
          counts.summary += 1;
          return createElement('span', { 'data-rp': '' });
        },
        renderLoading: () => {
          counts.loading += 1;
          return createElement('span', { 'data-rp': '' });
        },
        renderError: () => {
          counts.error += 1;
          return createElement('span', { 'data-rp': '' });
        },
      }),
    );
    expect(html).toContain('<pricing-renderer');
    expect(html).not.toContain('data-rp');
    expect(counts).toEqual({ plan: 0, summary: 0, loading: 0, error: 0 });
  });
});

// Type-checks a snippet with the strict options of tsconfig.base.json. The snippet is served from
// memory next to this file, so its relative imports resolve to src/** on disk.
function typeCheckSnippet(source: string): ts.Diagnostic[] {
  const snippetPath = fileURLToPath(new URL('./__snippet__.ts', import.meta.url));
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2021,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    lib: ['lib.es2021.d.ts', 'lib.dom.d.ts'],
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

type ManifestMember = { kind: string; name: string; attribute?: string; return?: unknown };
type ManifestEvent = { name: string; type?: { text: string } };
type Declaration = { name: string; members?: ManifestMember[]; events?: ManifestEvent[] };

// [utest->req~composition-types-manifest~1]
describe('composition types and manifest (React entry)', () => {
  const snippet = `
    import type {
      PricingSlotName,
      PricingSlotsChangeDetail,
      PricingPlanCtaContext,
      PricingSummaryActionsContext,
      PricingErrorContext,
    } from '../../src/react/index.js';
    import type {
      PricingSlotName as ElementSlotName,
      PricingSlotsChangeDetail as ElementSlotsChangeDetail,
    } from '../../src/element/index.js';
    declare const element: HTMLElement;
    declare const contexts: [PricingPlanCtaContext, PricingSummaryActionsContext, PricingErrorContext];
    export const names: readonly ElementSlotName[] = ['plan-cta'] satisfies readonly PricingSlotName[];
    export const detail: PricingSlotsChangeDetail | undefined = undefined;
    export { contexts };
    element.addEventListener('pricing-slots-change', (e) => {
      const detail: ElementSlotsChangeDetail = e.detail;
      return detail.nodes;
    });
  `;

  it('type-checks the five types, the aliases and the event map', () => {
    expect(messages(typeCheckSnippet(snippet))).toEqual([]);
  });

  it('lists slots, triggerPlanAction and pricing-slots-change in the manifest', async () => {
    const url = new URL('../../custom-elements.json', import.meta.url);
    const manifest = JSON.parse(await readFile(fileURLToPath(url), 'utf8')) as {
      modules: { declarations?: Declaration[] }[];
    };
    const declaration = manifest.modules
      .flatMap((module) => module.declarations ?? [])
      .find((candidate) => candidate.name === 'PricingRendererElement');
    expect(declaration).toBeDefined();
    const members = declaration?.members ?? [];
    const slots = members.find((member) => member.kind === 'field' && member.name === 'slots');
    expect(slots).toBeDefined();
    expect(slots?.attribute).toBeUndefined();
    const trigger = members.find(
      (member) => member.kind === 'method' && member.name === 'triggerPlanAction',
    );
    expect(trigger).toBeDefined();
    expect(JSON.stringify(trigger?.return)).toContain('boolean');
    const event = (declaration?.events ?? []).find((e) => e.name === 'pricing-slots-change');
    expect(event?.type?.text).toBe('CustomEvent<PricingSlotsChangeDetail>');
  });
});
