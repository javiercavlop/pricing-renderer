import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

const recorded = vi.hoisted(() => ({ props: [] as Record<string, unknown>[] }));

vi.mock('@lit/react', () => ({
  createComponent: () => (props: Record<string, unknown>) => {
    recorded.props.push(props);
    return null;
  },
}));

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

describe('React adapter props for the toolbar and add-on filter', () => {
  const header = `
    import * as React from 'react';
    import type { IPricingLike } from '../../src/core/index.js';
    import { PricingRenderer } from '../../src/react/index.js';
    declare const pricing: IPricingLike;
  `;

  it('accepts onlyDifferences, toolbarThreshold and addOnFilterThreshold', () => {
    const diagnostics = typeCheckSnippet(
      `${header}\nexport const element = React.createElement(PricingRenderer, { pricing, onlyDifferences: false, toolbarThreshold: 10, addOnFilterThreshold: 3 });`,
    );
    expect(messages(diagnostics)).toEqual([]);
  });

  it('rejects values of the wrong type', () => {
    const diagnostics = typeCheckSnippet(
      `${header}\nexport const element = React.createElement(PricingRenderer, { pricing, toolbarThreshold: 'x', addOnFilterThreshold: 'y', onlyDifferences: 'z' });`,
    );
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(messages(diagnostics).join('\n')).toMatch(/not assignable/);
  });

  it('forwards the three props to the underlying component unchanged', async () => {
    const { PricingRenderer } = await import('../../src/react/index.js');
    const render = (
      PricingRenderer as unknown as {
        render: (props: Record<string, unknown>, ref: unknown) => unknown;
      }
    ).render;
    // forwardRef's render returns an element of the stub; the stub runs when it is invoked.
    const element = render(
      { yaml: 'name: x', onlyDifferences: false, toolbarThreshold: 10, addOnFilterThreshold: 3 },
      null,
    ) as { type: (props: Record<string, unknown>) => unknown; props: Record<string, unknown> };
    element.type(element.props);
    expect(recorded.props.at(-1)).toMatchObject({
      onlyDifferences: false,
      toolbarThreshold: 10,
      addOnFilterThreshold: 3,
    });
  });
});
