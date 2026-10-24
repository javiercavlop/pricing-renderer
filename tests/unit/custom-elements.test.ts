import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { PricingRendererElement } from '../../src/react/index.js';

type ManifestMember = {
  kind: string;
  name: string;
  readonly?: boolean;
  type?: { text: string };
  parameters?: { name: string; type?: { text: string } }[];
  return?: { type?: { text: string } };
};
type ManifestEvent = { name: string; description?: string };
type Declaration = { name: string; members?: ManifestMember[]; events?: ManifestEvent[] };

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

describe('load API in the custom elements manifest', () => {
  // [utest->req~custom-elements-lists-load-api~1]
  it('lists applySelection, resolvedState and the event descriptions', async () => {
    const declaration = await rendererDeclaration();
    const members = declaration.members ?? [];
    const method = members.find(
      (member) => member.kind === 'method' && member.name === 'applySelection',
    );
    expect(method).toBeDefined();
    expect(method?.parameters).toHaveLength(1);
    expect(method?.parameters?.[0]?.name).toBe('selection');
    expect(method?.parameters?.[0]?.type?.text).toBe('Partial<PricingSelection>');
    expect(method?.return?.type?.text).toBe('ApplySelectionResult');

    const field = members.find(
      (member) => member.kind === 'field' && member.name === 'resolvedState',
    );
    expect(field).toBeDefined();
    expect(field?.type?.text).toBe('PricingSelectionChangeDetail | undefined');
    expect(field?.readonly).toBe(true);

    const events = declaration.events ?? [];
    const ready = events.find((event) => event.name === 'pricing-ready');
    expect(ready?.description).toContain('selection');
    expect(ready?.description).toContain('resolved');
    const diagnostic = events.find((event) => event.name === 'pricing-diagnostic');
    expect(diagnostic?.description).toContain('applySelection');
  });
});

describe('load API types and exports', () => {
  // [utest->req~react-ref-load-api~1]
  it('exposes applySelection and the resolvedState getter on the React element class', () => {
    const prototype = PricingRendererElement.prototype as unknown as Record<string, unknown>;
    expect(typeof prototype.applySelection).toBe('function');
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'resolvedState');
    expect(typeof descriptor?.get).toBe('function');
  });

  // [utest->req~ready-detail-required-fields~1]
  it('requires selection and resolved in PricingReadyDetail', () => {
    const header = `
      import type { NormalizedPricing, PricingSelection, ResolvedPricing } from '../../src/core/index.js';
      import type { PricingReadyDetail } from '../../src/element/index.js';
      declare const pricing: NormalizedPricing;
      declare const selection: PricingSelection;
      declare const resolved: ResolvedPricing;
    `;
    const missing = typeCheckSnippet(
      `${header}\nexport const detail: PricingReadyDetail = { pricing, diagnostics: [] };`,
    );
    const missingText = messages(missing).join('\n');
    expect(missing.length).toBeGreaterThan(0);
    expect(missingText).toContain('selection');
    expect(missingText).toContain('resolved');
    expect(missingText).toMatch(/missing/i);

    const complete = typeCheckSnippet(
      `${header}\nexport const detail: PricingReadyDetail = { pricing, diagnostics: [], selection, resolved };`,
    );
    expect(messages(complete)).toEqual([]);
  });

  // [utest->req~apply-selection-result-type~1]
  it('declares ApplySelectionResult as a union discriminated by applied', () => {
    const header = `
      import type { PricingSelection, ResolvedPricing } from '../../src/core/index.js';
      import type { ApplySelectionResult } from '../../src/element/index.js';
      declare const result: ApplySelectionResult;
    `;
    const narrowed = typeCheckSnippet(`${header}
      if (result.applied) {
        const selection: PricingSelection = result.selection;
        const resolved: ResolvedPricing = result.resolved;
        void selection;
        void resolved;
      } else {
        const removed: [] = result.removedAddOnIds;
        void removed;
      }
    `);
    expect(messages(narrowed)).toEqual([]);

    const unnarrowed = typeCheckSnippet(`${header}
      const selection: PricingSelection = result.selection;
      void selection;
    `);
    expect(unnarrowed.length).toBeGreaterThan(0);
    // TS2322: not assignable (and not, for instance, a missing export)
    expect(unnarrowed.map((diagnostic) => diagnostic.code)).toContain(2322);
  });

  // [utest->req~react-reexports-result-type~1]
  it('re-exports ApplySelectionResult from the React entry point', () => {
    const diagnostics = typeCheckSnippet(`
      import type { ApplySelectionResult as FromReact } from '../../src/react/index.js';
      import type { ApplySelectionResult as FromElement } from '../../src/element/index.js';
      declare const fromReact: FromReact;
      declare const fromElement: FromElement;
      export const toElement: FromElement = fromReact;
      export const toReact: FromReact = fromElement;
    `);
    expect(messages(diagnostics)).toEqual([]);
  });
});
