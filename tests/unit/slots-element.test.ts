// The element is built in the node environment (no DOM): its render() returns a lit template that
// is flattened to text, as in tests/unit/hide-sections-element.test.ts. The scenarios that need a
// DOM (node identity, setAttribute, user input, events from updated()) are in
// tests/browser/element-slots.spec.ts. The scenarios are those of
// openspec/changes/add-react-headless/specs/composition/spec.md.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { keyed } from 'lit/directives/keyed.js';
import { nothing } from 'lit';
import ts from 'typescript';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { PricingDiagnostic } from '../../src/core/index.js';

interface Host {
  yaml?: string;
  locale: string;
  ctaEnabled: boolean;
  slots?: unknown;
  currentSelection?: { planId?: string };
  pendingActionId?: string;
  triggerPlanAction?: (planId: string) => boolean;
  applySelection(selection: { planId: string }): unknown;
  reload(): Promise<void>;
  requestUpdate: () => void;
  dispatchEvent: (event: Event) => boolean;
  render(): unknown;
}

interface Built {
  element: Host;
  events: CustomEvent[];
}

const acmeYaml = readFileSync(
  fileURLToPath(new URL('../../tests/fixtures/acme-pricing.yml', import.meta.url)),
  'utf8',
);
const planIds = ['starter', 'growth', 'enterprise'];

let Element: new () => Host;

beforeAll(async () => {
  const loaded = (await import('../../src/element/pricing-renderer-element.js')) as unknown as {
    PricingRendererElement: new () => Host;
  };
  Element = loaded.PricingRendererElement;
  (Element as unknown as { finalize(): void }).finalize();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// A new element in the sense of the spec: built in node, with requestUpdate stubbed and
// dispatchEvent replaced by a recorder, showing Acme, loaded.
function create(setup: Partial<Host> = {}): Built {
  const element = new Element();
  const events: CustomEvent[] = [];
  element.requestUpdate = () => undefined;
  element.dispatchEvent = (event) => {
    events.push(event as CustomEvent);
    return true;
  };
  element.yaml = acmeYaml;
  element.locale = 'en-US';
  Object.assign(element, setup);
  return { element, events };
}

async function ready(setup: Partial<Host> = {}): Promise<Built> {
  const built = create(setup);
  await built.element.reload();
  return built;
}

type Walk = (value: unknown) => void;

interface DirectiveResult {
  _$litDirective$: unknown;
  values: unknown[];
}

function isDirectiveResult(value: unknown): value is DirectiveResult {
  return typeof value === 'object' && value !== null && '_$litDirective$' in value;
}

const keyedDirective = (keyed('k', 0) as unknown as DirectiveResult)._$litDirective$;
const isKeyedResult = (value: unknown): value is DirectiveResult =>
  isDirectiveResult(value) && value._$litDirective$ === keyedDirective;

// The value a directive result stands for: keyed(key, value) renders its value, any other directive
// its first value.
function unwrap(value: unknown): unknown {
  if (!isDirectiveResult(value)) return value;
  return unwrap(value.values[isKeyedResult(value) ? 1 : 0]);
}

const entities: Record<string, string> = { '&': 'amp', '"': 'quot', '<': 'lt', '>': 'gt' };
const characters: Record<string, string> = { amp: '&', quot: '"', lt: '<', gt: '>' };
const escapeAttribute = (text: string): string =>
  text.replace(/[&"<>]/g, (character) => `&${entities[character]};`);
const unescapeAttribute = (text: string): string =>
  text.replace(/&(amp|quot|lt|gt);/g, (_entity, name: string) => characters[name]!);

function textOf(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? String(value)
    : '';
}

// Flattens a lit template into markup text. A directive result is unwrapped, an attribute binding is
// quoted and escaped (and dropped for `nothing`), an event or property binding is dropped, and a
// boolean binding stays `?name` without a value, so a boolean where the spec asks for the attribute
// value 'true' fails a check.
function flatten(template: unknown): string {
  const value = unwrap(template);
  if (Array.isArray(value)) return value.map(flatten).join('');
  if (typeof value === 'object' && value !== null && 'strings' in value) {
    const { strings, values } = value as { strings: string[]; values: unknown[] };
    let out = '';
    strings.forEach((text, index) => {
      out += text;
      if (index >= values.length) return;
      const bound = unwrap(values[index]);
      const tag = out.slice(out.lastIndexOf('<'));
      const quoted = (tag.match(/"/g) ?? []).length % 2 === 1;
      const binding = /(\s)([?@.]?)([\w:.-]+)=$/.exec(out);
      if (!quoted && binding) {
        const [whole, space, prefix, name] = binding as unknown as [string, string, string, string];
        const head = out.slice(0, out.length - whole.length);
        if (prefix === '@' || prefix === '.' || bound === nothing) out = head;
        else if (prefix === '?') out = `${head}${space}?${name}`;
        else out = `${head}${space}${name}="${escapeAttribute(flatten(bound))}"`;
        return;
      }
      out += quoted ? escapeAttribute(flatten(bound)) : flatten(bound);
    });
    return out;
  }
  return textOf(value);
}

function walk(value: unknown, visit: Walk): void {
  visit(value);
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit);
  } else if (isDirectiveResult(value)) {
    for (const item of value.values) walk(item, visit);
  } else if (typeof value === 'object' && value !== null && 'values' in value) {
    for (const item of (value as { values: unknown[] }).values) walk(item, visit);
  }
}

const markup = (built: Built): string => flatten(built.element.render());
const partCount = (html: string, part: string): number =>
  html.split(`data-pr-part="${part}"`).length - 1;

interface SlotNode {
  name: string;
  attrs: Map<string, string>;
  empty: boolean;
  index: number;
}

function parseAttributes(text: string): Map<string, string> {
  const attrs = new Map<string, string>();
  for (const match of text.matchAll(/([^\s=/]+)(?:="([^"]*)")?/g)) {
    attrs.set(match[1]!, unescapeAttribute(match[2] ?? ''));
  }
  return attrs;
}

// Every div with a data-pr-slot attribute, in document order.
function slotNodes(html: string, name?: string): SlotNode[] {
  const nodes: SlotNode[] = [];
  for (const match of html.matchAll(/<div\b([^>]*)>/g)) {
    const attrs = parseAttributes(match[1] ?? '');
    const slot = attrs.get('data-pr-slot');
    if (slot === undefined || (name !== undefined && slot !== name)) continue;
    const rest = html.slice(match.index + match[0].length);
    nodes.push({ name: slot, attrs, empty: /^\s*<\/div\s*>/.test(rest), index: match.index });
  }
  return nodes;
}

const planSlots = (html: string): Record<string, SlotNode> =>
  Object.fromEntries(
    slotNodes(html, 'plan-cta').map((node) => [node.attrs.get('data-plan-id'), node]),
  );

// The tags open at a position of the markup, innermost last.
function openTags(html: string, index: number): { tag: string; attrs: Map<string, string> }[] {
  const voids = new Set(['br', 'hr', 'img', 'input', 'link', 'meta']);
  const stack: { tag: string; attrs: Map<string, string> }[] = [];
  for (const match of html.slice(0, index).matchAll(/<(\/?)([a-z][\w-]*)([^>]*)>/g)) {
    const [, closing, tag, rest] = match as unknown as [string, string, string, string];
    if (voids.has(tag) || rest.endsWith('/')) continue;
    if (closing) {
      const at = stack.map((item) => item.tag).lastIndexOf(tag);
      if (at >= 0) stack.length = at;
    } else {
      stack.push({ tag, attrs: parseAttributes(rest) });
    }
  }
  return stack;
}

const acmeLabel = 'Start free trial';
const growthHref = 'https://example.com/signup?plan=growth';

// [utest->req~slots-property~1]
describe('slots: the property', () => {
  it('is declared as a property without an attribute', () => {
    const declared = (
      Element as unknown as { elementProperties: Map<string, { attribute?: string | boolean }> }
    ).elementProperties.get('slots');
    expect(declared).toBeDefined();
    expect(declared?.attribute).toBe(false);
    const observed = (Element as unknown as { observedAttributes: string[] }).observedAttributes;
    expect(observed).not.toContain('slots');
  });

  it('is undefined on a new element', () => {
    expect(create().element.slots).toBeUndefined();
  });
});

// [utest->req~slots-default-markup~1]
describe('slots: markup without slots', () => {
  it('Empty and unknown lists render the markup of no property', async () => {
    const built = await ready();
    const stored = markup(built);
    expect(slotNodes(stored)).toEqual([]);
    expect(partCount(stored, 'cta')).toBe(3);
    for (const value of [[], ['footer']]) {
      built.element.slots = value;
      const html = markup(built);
      expect(html, JSON.stringify(value)).toBe(stored);
      expect(slotNodes(html)).toEqual([]);
      expect(partCount(html, 'cta')).toBe(3);
    }
  });

  it('Unknown names next to known ones', async () => {
    const html = markup(await ready({ slots: ['footer', 'plan-cta'] }));
    const ids = slotNodes(html, 'plan-cta').map((node) => node.attrs.get('data-plan-id'));
    expect(ids).toEqual(planIds);
    expect(slotNodes(html, 'footer')).toEqual([]);
  });
});

// [utest->req~slots-not-array~1]
describe('slots: a value that is not an array', () => {
  it('Null, string, number and array-like', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const warnings = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const built = await ready();
    const stored = markup(built);
    for (const value of [null, 'plan-cta', 3, { 0: 'plan-cta', length: 1 }]) {
      built.element.slots = value;
      const html = markup(built);
      expect(html, JSON.stringify(value)).toBe(stored);
      expect(slotNodes(html)).toEqual([]);
      expect(partCount(html, 'cta')).toBe(3);
    }
    expect(built.events.filter((event) => event.type === 'pricing-slots-change')).toEqual([]);
    expect(errors).not.toHaveBeenCalled();
    expect(warnings).not.toHaveBeenCalled();
  });
});

// [utest->req~slot-plan-cta~1]
describe('plan CTA slot nodes', () => {
  it('Three plan slots', async () => {
    const html = markup(await ready({ slots: ['plan-cta'] }));
    const nodes = slotNodes(html, 'plan-cta');
    expect(nodes.map((node) => node.attrs.get('data-plan-id'))).toEqual(planIds);
    for (const node of nodes) {
      expect(node.empty).toBe(true);
      expect(node.attrs.get('data-pr-part')).toBe('plan-cta-slot');
    }
    expect(partCount(html, 'cta')).toBe(0);
    const cards = html.split('data-pr-part="plan-card"').slice(1);
    expect(cards).toHaveLength(3);
    cards.forEach((card, index) => {
      expect(card).toContain(`data-plan-id="${planIds[index]}"`);
      const ids = slotNodes(card, 'plan-cta').map((node) => node.attrs.get('data-plan-id'));
      expect(ids).toEqual([planIds[index]]);
    });
  });

  it('CTAs disabled', async () => {
    const html = markup(await ready({ slots: ['plan-cta'], ctaEnabled: false }));
    expect(slotNodes(html, 'plan-cta')).toEqual([]);
    expect(partCount(html, 'cta')).toBe(0);
  });
});

// [utest->req~slot-plan-cta-keyed~1]
describe('plan slot nodes belong to one plan', () => {
  // Template-shape check only; the behavioural proof is tests/browser/element-slots.spec.ts.
  it('wraps each plan slot node in a keyed directive with the plan id', async () => {
    const template = (await ready({ slots: ['plan-cta'] })).element.render();
    const keys: unknown[] = [];
    walk(template, (value) => {
      if (isKeyedResult(value) && slotNodes(flatten(value.values[1]), 'plan-cta').length > 0) {
        keys.push(value.values[0]);
      }
    });
    expect(keys).toEqual(planIds);
  });

  it('adds no keyed directive without slots', async () => {
    const template = (await ready()).element.render();
    let keyedResults = 0;
    walk(template, (value) => {
      if (isKeyedResult(value)) keyedResults += 1;
    });
    expect(keyedResults).toBe(0);
  });
});

// [utest->req~slot-summary-actions~1]
describe('summary actions slot node', () => {
  it('With and without a current plan', async () => {
    const setups: Partial<Host>[] = [{}, { currentSelection: { planId: 'growth' } }];
    for (const setup of setups) {
      const html = markup(await ready({ slots: ['summary-actions'], ...setup }));
      const nodes = slotNodes(html, 'summary-actions');
      expect(nodes, JSON.stringify(setup)).toHaveLength(1);
      const node = nodes[0]!;
      expect(node.empty).toBe(true);
      expect(node.attrs.get('data-pr-part')).toBe('summary-actions-slot');
      const open = openTags(html, node.index);
      const classesOf = (item: { attrs: Map<string, string> }): string[] =>
        (item.attrs.get('class') ?? '').split(/\s+/);
      expect(open.some((item) => classesOf(item).includes('pr-summary'))).toBe(true);
      const live = open.filter((item) => {
        const value = item.attrs.get('aria-live');
        return value !== undefined && value !== 'off';
      });
      expect(live).toEqual([]);
      expect(partCount(html, 'summary-action')).toBe(0);
    }
  });
});

// [utest->req~slot-loading~1]
describe('loading slot node', () => {
  it('Before the first load', () => {
    const html = flatten(create({ slots: ['loading'] }).element.render());
    expect(html).toMatch(/<section\b[^>]*class="pr-shell pr-shell--loading"/);
    expect(html).toMatch(/<h2\b[^>]*class="pr-sr-only"/);
    const nodes = slotNodes(html, 'loading');
    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.empty).toBe(true);
    expect(nodes[0]?.attrs.get('data-pr-part')).toBe('loading-slot');
    expect(html).not.toContain('pr-skeleton');
  });

  it('keeps the skeleton without the slot', () => {
    const html = flatten(create().element.render());
    expect(html).toContain('pr-skeleton');
    expect(slotNodes(html)).toEqual([]);
  });
});

async function failedLoad(): Promise<{ html: string; built: Built }> {
  const built = await ready({ slots: ['error'], yaml: 'plans: [' });
  return { html: markup(built), built };
}

// [utest->req~slot-error~1]
describe('error slot node', () => {
  it('Invalid YAML', async () => {
    const { html } = await failedLoad();
    const section = /<section\b([^>]*)>([\s\S]*)<\/section\s*>/.exec(html);
    expect(section).not.toBeNull();
    const attrs = parseAttributes(section?.[1] ?? '');
    const classes = (attrs.get('class') ?? '').split(/\s+/);
    expect(classes).toEqual(expect.arrayContaining(['pr-shell', 'pr-error']));
    expect(attrs.get('role')).toBe('alert');
    const inner = (section?.[2] ?? '').trim();
    expect(inner).toMatch(/^<div\b[^>]*>\s*<\/div\s*>$/);
    const nodes = slotNodes(html, 'error');
    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.empty).toBe(true);
    expect(nodes[0]?.attrs.get('data-pr-part')).toBe('error-slot');
    expect(html).not.toContain('<h2');
    expect(partCount(html, 'diagnostics')).toBe(0);
    expect(html).not.toContain('<button');
  });
});

// [utest->req~slot-error-diagnostics~1]
describe('error slot node diagnostics', () => {
  it('Diagnostics of invalid YAML', async () => {
    const { html, built } = await failedLoad();
    const diagnosticEvent = built.events.find((event) => event.type === 'pricing-diagnostic');
    const detail = diagnosticEvent?.detail as { diagnostics: PricingDiagnostic[] } | undefined;
    expect(detail).toBeDefined();
    const text = slotNodes(html, 'error')[0]?.attrs.get('data-diagnostics');
    expect(text).toBeDefined();
    const expected = (detail?.diagnostics ?? []).map((item) => ({
      code: item.code,
      severity: item.severity,
      message: item.message,
      ...(item.path !== undefined ? { path: item.path } : {}),
    }));
    expect(text).toBe(JSON.stringify(expected));
    const parsed = JSON.parse(text ?? '[]') as Record<string, unknown>[];
    expect(parsed).toEqual(expected);
    expect(parsed[0]).toMatchObject({ code: 'PR_YAML_PARSE_ERROR', severity: 'error', path: '$' });
    const allowed = ['code', 'severity', 'message', 'path'];
    for (const entry of parsed) {
      expect(Object.keys(entry).filter((key) => !allowed.includes(key))).toEqual([]);
    }
  });
});

// [utest->req~slots-change-event~3]
describe('slots change event: no slots, no event', () => {
  it('records no pricing-slots-change after ready and a reload', async () => {
    const built = await ready();
    await built.element.reload();
    expect(built.events.filter((event) => event.type === 'pricing-slots-change')).toEqual([]);
  });
});

// [utest->req~slot-plan-cta-context~1]
describe('plan slot node context attributes', () => {
  it('Values follow the state', async () => {
    const built = await ready({ slots: ['plan-cta'] });
    const growth = planSlots(markup(built))['growth']?.attrs;
    expect(growth).toBeDefined();
    expect(growth?.get('data-plan-name')).toBe('Growth');
    expect(growth?.get('data-label')).toBe(acmeLabel);
    expect(growth?.get('data-href')).toBe(growthHref);
    expect(growth?.get('data-selected')).toBe('false');
    for (const name of ['data-relation', 'data-current', 'data-pending']) {
      expect(growth?.has(name), name).toBe(false);
    }
    built.element.applySelection({ planId: 'enterprise' });
    const html = markup(built);
    expect(planSlots(html)['enterprise']?.attrs.get('data-selected')).toBe('true');
    expect(planSlots(html)['growth']?.attrs.get('data-selected')).toBe('false');
    expect(html).not.toMatch(/\?data-(current|pending|any-pending)/);
  });

  it('Current plan and pending action', async () => {
    const html = markup(
      await ready({
        slots: ['plan-cta'],
        currentSelection: { planId: 'starter' },
        pendingActionId: 'start-growth',
      }),
    );
    const slots = planSlots(html);
    const starter = slots['starter']?.attrs;
    expect(starter?.get('data-current')).toBe('true');
    expect(starter?.get('data-relation')).toBe('current');
    expect(starter?.get('data-label')).toBe('Current plan');
    const growth = slots['growth']?.attrs;
    expect(growth?.get('data-relation')).toBe('upgrade');
    expect(growth?.get('data-label')).toBe('Upgrade to Growth');
    expect(growth?.get('data-pending')).toBe('true');
    expect(html).not.toMatch(/\?data-(current|pending|any-pending)/);
  });
});

// [utest->req~slot-summary-actions-context~1]
describe('summary slot node context attributes', () => {
  it('Relation and pending', async () => {
    const built = await ready({
      slots: ['summary-actions'],
      currentSelection: { planId: 'starter' },
      pendingActionId: 'start-growth',
    });
    built.element.applySelection({ planId: 'growth' });
    const html = markup(built);
    const attrs = slotNodes(html, 'summary-actions')[0]?.attrs;
    expect(attrs?.get('data-relation')).toBe('upgrade');
    expect(attrs?.get('data-pending')).toBe('true');
    expect(html).not.toMatch(/\?data-(relation|pending)/);
  });

  it('Neither', async () => {
    const html = markup(await ready({ slots: ['summary-actions'] }));
    const attrs = slotNodes(html, 'summary-actions')[0]?.attrs;
    expect(attrs).toBeDefined();
    expect(attrs?.has('data-relation')).toBe(false);
    expect(attrs?.has('data-pending')).toBe(false);
  });
});

// [utest->req~slot-plan-cta-any-pending~1]
describe('plan slot nodes report any pending action', () => {
  it('Pending plan action', async () => {
    const html = markup(await ready({ slots: ['plan-cta'], pendingActionId: 'start-growth' }));
    const slots = planSlots(html);
    for (const id of planIds) expect(slots[id]?.attrs.get('data-any-pending'), id).toBe('true');
    expect(slots['starter']?.attrs.has('data-pending')).toBe(false);
    expect(slots['growth']?.attrs.get('data-pending')).toBe('true');
    expect(slots['enterprise']?.attrs.has('data-pending')).toBe(false);
  });

  it('Nothing pending', async () => {
    const slots = planSlots(markup(await ready({ slots: ['plan-cta'] })));
    expect(Object.keys(slots)).toEqual(planIds);
    for (const id of planIds) expect(slots[id]?.attrs.has('data-any-pending'), id).toBe(false);
  });
});

// The click handler of the built-in CTA of each plan card, in document order.
function ctaHandlers(template: unknown): ((event: unknown) => unknown)[] {
  const handlers: ((event: unknown) => unknown)[] = [];
  walk(template, (value) => {
    if (typeof value !== 'object' || value === null || !('strings' in value)) return;
    const { strings, values } = value as { strings: string[]; values: unknown[] };
    if (!strings.join('').includes('data-pr-part="cta"')) return;
    const handler = values.find((item) => typeof item === 'function');
    if (typeof handler === 'function') handlers.push(handler as (event: unknown) => unknown);
  });
  return handlers;
}

// [utest->req~trigger-plan-action~1]
describe('triggerPlanAction', () => {
  it('Same detail as a click', async () => {
    const first = await ready({ currentSelection: { planId: 'growth' }, slots: ['plan-cta'] });
    const second = await ready({ currentSelection: { planId: 'growth' } });
    expect(first.element.triggerPlanAction).toBeTypeOf('function');
    const result = first.element.triggerPlanAction?.('enterprise');
    const handlers = ctaHandlers(second.element.render());
    expect(handlers).toHaveLength(3);
    handlers[2]?.({ preventDefault: () => undefined });
    expect(result).toBe(true);
    const actions = (built: Built): CustomEvent[] =>
      built.events.filter((event) => event.type === 'pricing-action');
    expect(actions(first)).toHaveLength(1);
    expect(actions(second)).toHaveLength(1);
    expect(actions(first)[0]?.detail).toEqual(actions(second)[0]?.detail);
    expect(actions(first)[0]?.detail).toMatchObject({
      planId: 'enterprise',
      relation: 'upgrade',
      source: 'plan',
    });
    expect(actions(first)[0]?.cancelable).toBe(true);
  });
});

// [utest->req~trigger-plan-action-guard~1]
describe('triggerPlanAction: ignored calls', () => {
  it('Four ignored calls', async () => {
    const cases: [Partial<Host>, string][] = [
      [{ pendingActionId: 'start-growth' }, 'growth'],
      [{ ctaEnabled: false }, 'growth'],
      [{}, 'legacy'],
      [{ currentSelection: { planId: 'growth' } }, 'growth'],
    ];
    for (const [setup, planId] of cases) {
      const built = await ready(setup);
      expect(built.element.triggerPlanAction, JSON.stringify(setup)).toBeTypeOf('function');
      expect(built.element.triggerPlanAction?.(planId), JSON.stringify(setup)).toBe(false);
      expect(built.events.filter((event) => event.type === 'pricing-action')).toEqual([]);
    }
  });
});

// Type-checks a TSX snippet with the strict options of tsconfig.base.json. The snippet is served
// from memory next to this file, so its relative imports resolve to src/** on disk.
function typeCheckSnippet(source: string): ts.Diagnostic[] {
  const snippetPath = fileURLToPath(new URL('./__slots_element_snippet__.tsx', import.meta.url));
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
  return ts.getPreEmitDiagnostics(program, program.getSourceFile(snippetPath));
}

const messages = (diagnostics: ts.Diagnostic[]): string[] =>
  diagnostics.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));

// [utest->req~composition-types-manifest~1]
describe('composition types and manifest', () => {
  const header = `
    import type {
      PricingErrorContext,
      PricingPlanCtaContext,
      PricingSlotName,
      PricingSlotsChangeDetail,
      PricingSummaryActionsContext,
    } from '../../src/react/index.js';
    import type {
      PricingSlotName as ElementSlotName,
      PricingSlotsChangeDetail as ElementSlotsChangeDetail,
    } from '../../src/element/index.js';
    declare const element: HTMLElement;
    export type Contexts = [PricingPlanCtaContext, PricingSummaryActionsContext, PricingErrorContext];
    export type ReactDetail = PricingSlotsChangeDetail;
    export const names: readonly ElementSlotName[] = ['plan-cta'] satisfies readonly PricingSlotName[];
    element.addEventListener('pricing-slots-change', (e) => {
      const detail: ElementSlotsChangeDetail = e.detail;
      return detail.nodes;
    });
  `;

  it('Types and event map type-check', () => {
    expect(messages(typeCheckSnippet(header))).toEqual([]);
  });

  it('rejects a name that is not a slot name', () => {
    const rejected = typeCheckSnippet(`${header}\nexport const bad: ElementSlotName = 'footer';`);
    expect(rejected.map((diagnostic) => diagnostic.code)).toContain(2322);
  });

  it('lists slots, triggerPlanAction and the event in custom-elements.json', () => {
    const manifest = JSON.parse(
      readFileSync(fileURLToPath(new URL('../../custom-elements.json', import.meta.url)), 'utf8'),
    ) as {
      modules: {
        declarations?: {
          name: string;
          members?: {
            kind: string;
            name: string;
            attribute?: string;
            return?: { type?: { text?: string } };
          }[];
          events?: { name: string; type?: { text?: string } }[];
        }[];
      }[];
    };
    const declaration = manifest.modules
      .flatMap((module) => module.declarations ?? [])
      .find((candidate) => candidate.name === 'PricingRendererElement');
    expect(declaration).toBeDefined();
    const field = declaration?.members?.find((m) => m.kind === 'field' && m.name === 'slots');
    expect(field).toBeDefined();
    expect(field?.attribute).toBeUndefined();
    const method = declaration?.members?.find(
      (m) => m.kind === 'method' && m.name === 'triggerPlanAction',
    );
    expect(method).toBeDefined();
    expect(method?.return?.type?.text).toBe('boolean');
    const event = declaration?.events?.find((item) => item.name === 'pricing-slots-change');
    expect(event).toBeDefined();
    expect(event?.type?.text).toBe('CustomEvent<PricingSlotsChangeDetail>');
  });
});
