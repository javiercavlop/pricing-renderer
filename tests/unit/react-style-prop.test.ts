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

// Type-checks a TSX snippet with the strict options of tsconfig.base.json. The snippet is served
// from memory next to this file, so its relative imports resolve to src/** on disk.
function typeCheckSnippet(source: string): ts.Diagnostic[] {
  const snippetPath = fileURLToPath(new URL('./__snippet__.tsx', import.meta.url));
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

const header = `
  import * as React from 'react';
  import { PricingRenderer } from '../../src/react/index.js';
  declare const s: string;
`;

const element = (attributes: string): string =>
  `${header}\nexport const element = <PricingRenderer yaml={s} ${attributes} />;`;

// [utest->req~react-style-prop~1]
describe('React style prop', () => {
  it('accepts custom properties with string or number values next to CSS properties', () => {
    const diagnostics = typeCheckSnippet(
      element(
        `style={{ '--pr-color-accent': '#f00', '--pr-space-4': 12, color: 'red' }} className="x"`,
      ),
    );
    expect(messages(diagnostics)).toEqual([]);
  });

  it('rejects a string style', () => {
    const diagnostics = typeCheckSnippet(element(`style="color: red"`));
    expect(diagnostics.length).toBeGreaterThan(0);
  });

  it('rejects a number style', () => {
    const diagnostics = typeCheckSnippet(element(`style={42}`));
    expect(diagnostics.length).toBeGreaterThan(0);
  });

  it('passes style and className to the underlying component unchanged', async () => {
    const { PricingRenderer } = await import('../../src/react/index.js');
    const renderFn = (
      PricingRenderer as unknown as {
        render: (props: Record<string, unknown>, ref: unknown) => unknown;
      }
    ).render;
    const style = { '--pr-color-accent': '#f00', '--pr-space-4': 12, color: 'red' };
    const rendered = renderFn({ yaml: 'name: x', style, className: 'x' }, null) as {
      type: (props: Record<string, unknown>) => unknown;
      props: Record<string, unknown>;
    };
    rendered.type(rendered.props);
    const last = recorded.props.at(-1);
    expect(last?.style).toEqual(style);
    expect(last?.className).toBe('x');
  });
});

// [utest->req~react-classname~1]
describe('React className prop', () => {
  it('accepts a string', () => {
    expect(messages(typeCheckSnippet(element(`className="x"`)))).toEqual([]);
  });

  it('rejects a non-string value', () => {
    expect(typeCheckSnippet(element(`className={42}`)).length).toBeGreaterThan(0);
  });
});
