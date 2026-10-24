import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

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

const breakdownHeader = `
  import type {
    NormalizedBillingPeriod,
    PriceBreakdown,
    PriceBreakdownLine,
    ResolvedPricing,
  } from '../../src/core/index.js';
  declare const line: PriceBreakdownLine;
  declare const breakdown: PriceBreakdown;
  declare const resolved: ResolvedPricing;
`;

const resolvedHeader = `
  import type { PricingDiagnostic, PricingSelection, ResolvedPricing } from '../../src/core/index.js';
  declare const selection: PricingSelection;
  declare const diagnostics: PricingDiagnostic[];
`;

describe('breakdown types', () => {
  // [utest->req~breakdown-types-exported~1]
  it('exports PriceBreakdownLine and PriceBreakdown with every field and its type', () => {
    const diagnostics = typeCheckSnippet(`${breakdownHeader}
      export const kind: 'plan' | 'addOn' = line.kind;
      export const id: string = line.id;
      export const name: string = line.name;
      export const quantity: number = line.quantity;
      export const unit: number | undefined = line.unitAmount;
      export const multiplier: number = line.billingMultiplier;
      export const amount: number | undefined = line.amount;
      export const quote: boolean = line.requiresQuote;
      export const label: string | undefined = line.label;
      export const currency: string = breakdown.currency;
      export const period: NormalizedBillingPeriod | undefined = breakdown.billingPeriod;
      export const plan: PriceBreakdownLine | undefined = breakdown.plan;
      export const addOns: PriceBreakdownLine[] = breakdown.addOns;
      export const subtotal: number = breakdown.subtotal;
      export const breakdownQuote: boolean = breakdown.requiresQuote;
      export const fromResolved: PriceBreakdown = resolved.breakdown;
    `);
    expect(messages(diagnostics)).toEqual([]);
  });

  // [utest->req~breakdown-types-exported~1]
  it('rejects a line kind that is neither plan nor addOn (TS2322)', () => {
    const diagnostics = typeCheckSnippet(`${breakdownHeader}
      export const kind: PriceBreakdownLine['kind'] = 'tier';
    `);
    expect(codes(diagnostics)).toEqual([2322]);
  });

  // [utest->req~breakdown-types-exported~1]
  it('keeps the optional fields optional and the others required', () => {
    const minimal = typeCheckSnippet(`${breakdownHeader}
      export const bare: PriceBreakdownLine = {
        kind: 'plan',
        id: 'a',
        name: 'A',
        quantity: 1,
        billingMultiplier: 1,
        requiresQuote: false,
      };
      export const empty: PriceBreakdown = {
        currency: 'EUR',
        addOns: [],
        subtotal: 0,
        requiresQuote: false,
      };
    `);
    expect(messages(minimal)).toEqual([]);

    const noQuantity = typeCheckSnippet(`${breakdownHeader}
      export const bad: PriceBreakdownLine = {
        kind: 'plan',
        id: 'a',
        name: 'A',
        billingMultiplier: 1,
        requiresQuote: false,
      };
    `);
    expect(messages(noQuantity).join('\n')).toMatch(/'quantity' is missing/);

    const noSubtotal = typeCheckSnippet(`${breakdownHeader}
      export const bad: PriceBreakdown = { currency: 'EUR', addOns: [], requiresQuote: false };
    `);
    expect(messages(noSubtotal).join('\n')).toMatch(/'subtotal' is missing/);
  });

  // [utest->req~breakdown-types-exported~1]
  it('types the optional fields as possibly undefined', () => {
    const diagnostics = typeCheckSnippet(`${breakdownHeader}
      export const unit: number = line.unitAmount;
    `);
    expect(codes(diagnostics)).toEqual([2322]);
  });

  // [utest->req~breakdown-field~1]
  it('types the breakdown of a resolvePricing result as PriceBreakdown', () => {
    const diagnostics = typeCheckSnippet(`
      import { resolvePricing } from '../../src/core/index.js';
      import type { NormalizedPricing, PriceBreakdown } from '../../src/core/index.js';
      declare const pricing: NormalizedPricing;
      export const breakdown: PriceBreakdown = resolvePricing(pricing).breakdown;
    `);
    expect(messages(diagnostics)).toEqual([]);
  });
});

describe('ResolvedPricing breakdown property', () => {
  // [utest->req~breakdown-required-field~1]
  it('reports a missing breakdown on a hand-built result and accepts one with it', () => {
    const missing = typeCheckSnippet(`${resolvedHeader}
      export const resolved: ResolvedPricing = {
        selection,
        planPrices: {},
        addOnPrices: {},
        subtotal: 0,
        requiresQuote: false,
        diagnostics,
      };
    `);
    const missingText = messages(missing).join('\n');
    expect(missing.length).toBeGreaterThan(0);
    expect(missingText).toMatch(/missing/i);
    expect(missingText).toContain('breakdown');
    expect(codes(missing)).toEqual([2741]);

    const complete = typeCheckSnippet(`${resolvedHeader}
      import type { PriceBreakdown } from '../../src/core/index.js';
      declare const breakdown: PriceBreakdown;
      export const resolved: ResolvedPricing = {
        selection,
        planPrices: {},
        addOnPrices: {},
        subtotal: 0,
        requiresQuote: false,
        diagnostics,
        breakdown,
      };
    `);
    expect(messages(complete)).toEqual([]);
  });
});
