import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import * as core from '../../src/core/index.js';

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

describe('compareSelections export', () => {
  // [utest->req~compare-selections-export~1]
  it('is a function of length 1 in the core entry point', () => {
    expect(typeof core.compareSelections).toBe('function');
    expect(core.compareSelections.length).toBe(1);
  });

  // [utest->req~compare-selections-export~1]
  it('exports the comparison types with their fields', () => {
    const diagnostics = typeCheckSnippet(`
      import type {
        ComparedValue,
        SelectionComparison,
        SelectionComparisonInput,
      } from '../../src/core/index.js';
      import { compareSelections } from '../../src/core/index.js';
      declare const input: SelectionComparisonInput;
      declare const comparison: SelectionComparison;
      export const result: SelectionComparison = compareSelections(input);
      export const relation: 'current' | 'upgrade' | 'downgrade' | 'change' = comparison.relation;
      export const difference: number | undefined = comparison.price.difference;
      export const after: ComparedValue = comparison.usageLimits.changed[0]!.after;
    `);
    expect(messages(diagnostics)).toEqual([]);
  });

  // [utest->req~compare-selections-export~1]
  it('rejects a relation outside the four values (TS2322)', () => {
    const diagnostics = typeCheckSnippet(`
      import type { SelectionRelation } from '../../src/core/index.js';
      export const relation: SelectionRelation = 'sidegrade';
    `);
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual([2322]);
  });
});
