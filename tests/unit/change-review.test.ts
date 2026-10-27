import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// In node, the first import of lit sets globalThis.customElements to its own registry shim, and
// vi.resetModules does not reload lit. Importing it first fixes that global before any test, so
// each test sets the registry it needs (a stub, or none) and unstubs it afterwards.
import 'lit';
import { enUS, esES } from '../../src/core/index.js';

// The data contract of <pricing-change-review> (add-subscription-change-flow, phase E):
// registration, properties, types, the manifest and the package entries. The rendering, the events
// and the guards need a DOM: they are covered by tests/browser/change-review-data.spec.ts.

const tag = 'pricing-change-review';

interface RegistryStub {
  // the tags passed to define, in order
  calls: string[];
  classes: Map<string, unknown>;
}

// A registry whose define records tag names and whose get returns the recorded class. The tests
// import the modules after this call, with a fresh module graph.
function stubRegistry(initial: Record<string, unknown> = {}): RegistryStub {
  const classes = new Map<string, unknown>(Object.entries(initial));
  const calls: string[] = [];
  vi.stubGlobal('customElements', {
    define: (name: string, constructor: unknown) => {
      calls.push(name);
      classes.set(name, constructor);
    },
    get: (name: string) => classes.get(name),
  });
  return { calls, classes };
}

// Node without custom elements: globalThis.customElements is undefined.
function noRegistry(): void {
  vi.stubGlobal('customElements', undefined);
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

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

const readText = (path: string): Promise<string> =>
  readFile(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

describe('definition', () => {
  // [utest->req~review-element-defined~1]
  it('is a no-op in node, where there is no registry', async () => {
    noRegistry();
    expect(globalThis.customElements).toBeUndefined();
    await expect(import('../../src/element/define-change-review.js')).resolves.toBeDefined();
    const element = await import('../../src/element/index.js');
    expect(element.definePricingChangeReview()).toBe(element.PricingChangeReviewElement);
  });

  // [utest->req~review-element-defined~1]
  it('registers the class under the tag when the side-effect module is imported', async () => {
    const registry = stubRegistry();
    await import('../../src/element/define-change-review.js');
    const element = await import('../../src/element/index.js');
    expect(element.PRICING_CHANGE_REVIEW_TAG).toBe(tag);
    expect(registry.calls).toEqual([tag]);
    expect(registry.classes.get(tag)).toBe(element.PricingChangeReviewElement);
    expect(element.definePricingChangeReview()).toBe(element.PricingChangeReviewElement);
    expect(registry.calls).toEqual([tag]);
  });

  // [utest->req~review-define-separate~1]
  it('is not registered by define, the element index or the React entry point', async () => {
    const registry = stubRegistry();
    await import('../../src/element/define.js');
    await import('../../src/element/index.js');
    await import('../../src/react/index.js');
    expect(registry.calls).toEqual(['pricing-renderer']);
    expect(registry.classes.has(tag)).toBe(false);
  });

  // [utest->req~review-define-conflict~1]
  it('throws an error naming the tag when another class holds it', async () => {
    class Other {}
    const registry = stubRegistry({ [tag]: Other });
    const element = await import('../../src/element/index.js');
    expect(registry.calls).toEqual([]);
    expect(() => element.definePricingChangeReview()).toThrow(tag);
    expect(registry.classes.get(tag)).toBe(Other);
  });
});

describe('properties', () => {
  type PropertyOptions = { attribute?: string | false; type?: unknown; reflect?: boolean };

  interface ReviewClass {
    properties: Record<string, PropertyOptions>;
    new (): {
      comparison?: unknown;
      notices: string[];
      pending: boolean;
      error?: string;
      locale: string;
      messages?: unknown;
      confirmLabel?: string;
    };
  }

  async function loadClass(): Promise<ReviewClass> {
    const loaded: unknown = await import('../../src/element/index.js');
    return (loaded as { PricingChangeReviewElement: ReviewClass }).PricingChangeReviewElement;
  }

  // [utest->req~review-properties~1]
  it('declares the seven properties with their attributes', async () => {
    const { properties } = await loadClass();
    expect(Object.keys(properties).sort()).toEqual([
      'comparison',
      'confirmLabel',
      'error',
      'locale',
      'messages',
      'notices',
      'pending',
    ]);
    expect(properties.comparison).toEqual({ attribute: false });
    expect(properties.notices).toEqual({ attribute: false });
    expect(properties.messages).toEqual({ attribute: false });
    expect(properties.pending).toMatchObject({ type: Boolean, reflect: true });
    expect(properties.pending?.attribute).not.toBe(false);
    expect(properties.error).toMatchObject({ type: String });
    expect(properties.error?.attribute).not.toBe(false);
    expect(properties.locale).toMatchObject({ type: String });
    expect(properties.locale?.attribute).not.toBe(false);
    expect(properties.confirmLabel).toMatchObject({ type: String, attribute: 'confirm-label' });
  });

  // [utest->req~review-properties~1]
  it('starts with no comparison, no notices, not pending and en-US', async () => {
    const Element = await loadClass();
    const element = new Element();
    expect(element.comparison).toBeUndefined();
    expect(element.notices).toEqual([]);
    expect(element.pending).toBe(false);
    expect(element.locale).toBe('en-US');
    expect(element.error).toBeUndefined();
    expect(element.confirmLabel).toBeUndefined();
    expect(new Element().notices).not.toBe(element.notices);
  });

  // [utest->req~review-properties~1]
  it('types the seven properties', async () => {
    const header = `
      import type { MessageCatalog, SelectionComparison } from '../../src/core/index.js';
      import type { PricingChangeReviewElement } from '../../src/element/index.js';
      declare const element: PricingChangeReviewElement;
      declare const comparison: SelectionComparison;
      declare const catalog: MessageCatalog;
    `;
    const accepted = typeCheckSnippet(`${header}
      element.comparison = comparison;
      element.comparison = undefined;
      element.notices = ['a', 'b'];
      element.pending = true;
      element.error = 'Timeout';
      element.error = undefined;
      element.locale = 'es-ES';
      element.messages = catalog;
      element.confirmLabel = 'Pay now';
    `);
    expect(messages(accepted)).toEqual([]);
    const rejected = typeCheckSnippet(`${header}
      element.pending = 'yes';
      element.notices = 'a';
      element.confirmLabel = 42;
    `);
    expect(codes(rejected)).toEqual([2322, 2322, 2322]);
  });
});

describe('React wrapper', () => {
  async function loadReact() {
    const { createElement } = await import('react');
    const { renderToString } = await import('react-dom/server');
    const { PricingChangeReview } = await import('../../src/react/index.js');
    return { createElement, renderToString, PricingChangeReview };
  }

  // [utest->req~review-react~1]
  it('renders the tag on the server', async () => {
    noRegistry();
    const { createElement, renderToString, PricingChangeReview } = await loadReact();
    const html = renderToString(createElement(PricingChangeReview, { pending: true }));
    expect(html).toContain('<pricing-change-review');
  });

  // [utest->req~review-react~1]
  it('types the props and gives the confirm handler a PricingChangeConfirmEvent', () => {
    const header = `
      import * as React from 'react';
      import type { MessageCatalog, SelectionComparison } from '../../src/core/index.js';
      import { PricingChangeReview } from '../../src/react/index.js';
      declare const comparison: SelectionComparison;
      declare const catalog: MessageCatalog;
    `;
    const accepted = typeCheckSnippet(`${header}
      export const ok = React.createElement(PricingChangeReview, {
        comparison,
        notices: ['Billing starts on 1 Dec'],
        pending: false,
        error: 'Timeout',
        locale: 'es-ES',
        messages: catalog,
        confirmLabel: 'Pay now',
        className: 'review',
        id: 'review',
        onConfirm: (event) => event.detail.comparison.relation,
        onBack: (event) => event.detail.comparison.price.difference,
      });
    `);
    expect(messages(accepted)).toEqual([]);
    const rejected = typeCheckSnippet(`${header}
      export const bad = React.createElement(PricingChangeReview, { pending: 'yes' });
    `);
    expect(rejected.length).toBeGreaterThan(0);
  });

  // [utest->req~review-react-registers~1]
  it('registers the element when it renders where a registry exists', async () => {
    const registry = stubRegistry();
    const { createElement, renderToString, PricingChangeReview } = await loadReact();
    expect(registry.calls).not.toContain(tag);
    renderToString(createElement(PricingChangeReview, {}));
    expect(registry.calls.filter((name) => name === tag)).toEqual([tag]);
    renderToString(createElement(PricingChangeReview, {}));
    expect(registry.calls.filter((name) => name === tag)).toEqual([tag]);
  });
});

describe('event types', () => {
  const header = `
    import type { SelectionComparison } from '../../src/core/index.js';
    import type {
      PricingChangeBackDetail,
      PricingChangeBackEvent,
      PricingChangeConfirmDetail,
      PricingChangeConfirmEvent,
    } from '../../src/element/index.js';
    import type {
      PricingChangeBackDetail as ReactBackDetail,
      PricingChangeBackEvent as ReactBackEvent,
      PricingChangeConfirmDetail as ReactConfirmDetail,
      PricingChangeConfirmEvent as ReactConfirmEvent,
    } from '../../src/react/index.js';
    declare const confirm: PricingChangeConfirmEvent;
    declare const back: PricingChangeBackEvent;
    declare const reactConfirm: ReactConfirmEvent;
    declare const reactBack: ReactBackEvent;
  `;

  // [utest->req~review-event-types~1]
  it('exports the four types from the element and the React entry points', () => {
    const accepted = typeCheckSnippet(`${header}
      export const a: SelectionComparison = confirm.detail.comparison;
      export const b: SelectionComparison = back.detail.comparison;
      export const c: SelectionComparison = reactConfirm.detail.comparison;
      export const d: SelectionComparison = reactBack.detail.comparison;
      export const e: PricingChangeConfirmDetail = confirm.detail;
      export const f: PricingChangeBackDetail = back.detail;
      export const g: ReactConfirmDetail = confirm.detail;
      export const h: ReactBackDetail = reactBack.detail;
      export const i: PricingChangeConfirmEvent = reactConfirm;
      export const j: PricingChangeBackEvent = reactBack;
    `);
    expect(messages(accepted)).toEqual([]);
  });

  // [utest->req~review-event-types~1]
  it('requires a SelectionComparison in each detail', () => {
    const rejected = typeCheckSnippet(`${header}
      export const bad: PricingChangeConfirmDetail = { comparison: 'upgrade' };
      export const worse: PricingChangeBackDetail = {};
    `);
    expect(codes(rejected)).toEqual([2322, 2741]);
  });
});

describe('custom elements manifest', () => {
  type Member = { kind: string; name: string; type?: { text: string } };
  type Attribute = { name: string; fieldName?: string };
  type ManifestEvent = { name: string; type?: { text: string } };
  type Declaration = {
    name: string;
    tagName?: string;
    customElement?: boolean;
    members?: Member[];
    attributes?: Attribute[];
    events?: ManifestEvent[];
  };

  async function reviewDeclaration(): Promise<Declaration> {
    const manifest = JSON.parse(await readText('../../custom-elements.json')) as {
      modules: { declarations?: Declaration[] }[];
    };
    const declaration = manifest.modules
      .flatMap((module) => module.declarations ?? [])
      .find((candidate) => candidate.name === 'PricingChangeReviewElement');
    expect(declaration).toBeDefined();
    return declaration!;
  }

  // [utest->req~review-manifest~1]
  it('declares the tag, the seven fields and the two events', async () => {
    const declaration = await reviewDeclaration();
    expect(declaration.tagName).toBe(tag);
    expect(declaration.customElement).toBe(true);
    const fields = (declaration.members ?? [])
      .filter((member) => member.kind === 'field')
      .map((member) => member.name);
    expect(fields.sort()).toEqual([
      'comparison',
      'confirmLabel',
      'error',
      'locale',
      'messages',
      'notices',
      'pending',
    ]);
    const events = (declaration.events ?? []).map((event) => event.name);
    expect(events.sort()).toEqual(['pricing-change-back', 'pricing-change-confirm']);
  });

  // [utest->req~review-manifest~1]
  it('types the events and lists the attributes', async () => {
    const declaration = await reviewDeclaration();
    const typeOf = (name: string) =>
      (declaration.events ?? []).find((event) => event.name === name)?.type?.text;
    expect(typeOf('pricing-change-confirm')).toBe('CustomEvent<PricingChangeConfirmDetail>');
    expect(typeOf('pricing-change-back')).toBe('CustomEvent<PricingChangeBackDetail>');
    const attributes = declaration.attributes ?? [];
    for (const [name, fieldName] of [
      ['pending', 'pending'],
      ['error', 'error'],
      ['locale', 'locale'],
      ['confirm-label', 'confirmLabel'],
    ] as const) {
      expect(attributes).toContainEqual(expect.objectContaining({ name, fieldName }));
    }
  });
});

describe('package manifest', () => {
  type PackageJson = {
    exports: Record<string, unknown>;
    sideEffects: string[];
    scripts: Record<string, string>;
  };

  async function readPackage(): Promise<PackageJson> {
    return JSON.parse(await readText('../../package.json')) as PackageJson;
  }

  // [utest->req~review-define-subpath~1]
  it('exports ./define-change-review as a side-effect module', async () => {
    const pkg = await readPackage();
    expect(pkg.exports['./define-change-review']).toEqual({
      types: './dist/element/define-change-review.d.ts',
      default: './dist/element/define-change-review.js',
    });
    expect(pkg.sideEffects).toContain('./dist/element/define-change-review.js');
  });

  // [utest->req~review-define-subpath~1]
  it('checks the entry point with attw', async () => {
    const { scripts } = await readPackage();
    const script = scripts['package:check'] ?? '';
    expect(script).toContain('--entrypoints ');
    const entrypoints = script.split('--entrypoints ')[1]?.split(' ') ?? [];
    expect(entrypoints).toContain('./define-change-review');
    // the entry points of the other subpaths stay as they are
    expect(entrypoints).toEqual(expect.arrayContaining(['.', './element', './define', './react']));
  });
});

describe('messages', () => {
  // [utest->req~review-base-parts~1]
  it('defines the Confirm and Back texts in English and Spanish', () => {
    expect(enUS['pricing.reviewConfirm']).toBe('Confirm change');
    expect(enUS['pricing.reviewBack']).toBe('Back');
    expect(esES['pricing.reviewConfirm']).toBe('Confirmar cambio');
    expect(esES['pricing.reviewBack']).toBe('Volver');
  });
});
