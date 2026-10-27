import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// Type-checks a snippet with the strict options of tsconfig.base.json plus the DOM lib that
// HTMLElementEventMap needs. The snippet is served from memory next to this file, so its relative
// imports resolve to src/** on disk.
function typeCheckSnippet(source: string): ts.Diagnostic[] {
  const snippetPath = fileURLToPath(new URL('./__snippet__.ts', import.meta.url));
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2021,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    lib: ['lib.es2021.d.ts', 'lib.dom.d.ts'],
    jsx: ts.JsxEmit.ReactJSX,
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

const entries = [
  ['/define', '../../src/element/define.js'],
  ['/element', '../../src/element/index.js'],
  ['/react', '../../src/react/index.js'],
] as const;

describe('typed event map', { timeout: 30_000 }, () => {
  describe.each(entries)('through the %s entry', (_name, entry) => {
    const header = `
      import ${JSON.stringify(entry)};
      declare const el: HTMLElement;
    `;

    // [utest->req~typed-event-map~1]
    it('types the detail of every pricing event without a cast', () => {
      const diagnostics = typeCheckSnippet(`${header}
        el.addEventListener('pricing-ready', (e) => {
          const planCount: number = e.detail.pricing.plans.length;
          const count: number = e.detail.diagnostics.length;
          return [planCount, count, e.detail.selection, e.detail.resolved];
        });
        el.addEventListener('pricing-selection-change', (e) => [
          e.detail.selection,
          e.detail.resolved,
        ]);
        el.addEventListener('pricing-action', (e) => {
          const id: string = e.detail.actionId;
          const planId: string | undefined = e.detail.planId;
          return [id, planId, e.detail.selection];
        });
        el.addEventListener('pricing-diagnostic', (e) => {
          const count: number = e.detail.diagnostics.length;
          return count;
        });
      `);
      expect(messages(diagnostics)).toEqual([]);
    });

    // [utest->req~typed-event-map~1]
    it('reports a wrong detail field', () => {
      const diagnostics = typeCheckSnippet(`${header}
        el.addEventListener('pricing-action', (e) => e.detail.noSuchField);
      `);
      const found = messages(diagnostics);
      expect(found).toHaveLength(1);
      expect(found[0]).toContain('noSuchField');
    });

    // [utest->req~typed-event-map~1]
    it('reports a detail field of another event', () => {
      const diagnostics = typeCheckSnippet(`${header}
        el.addEventListener('pricing-diagnostic', (e) => e.detail.actionId);
      `);
      const found = messages(diagnostics);
      expect(found).toHaveLength(1);
      expect(found[0]).toContain('actionId');
    });
  });

  // [utest->req~typed-event-map~1]
  it('types a listener on the element returned by createElement', () => {
    const diagnostics = typeCheckSnippet(`
      import '../../src/element/index.js';
      const el = document.createElement('pricing-renderer');
      el.addEventListener('pricing-action', (e) => {
        e.preventDefault();
        return e.detail.actionId;
      });
    `);
    expect(messages(diagnostics)).toEqual([]);
  });
});
