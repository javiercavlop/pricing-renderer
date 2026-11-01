import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { beforeAll, describe, expect, it } from 'vitest';
import * as core from '../../src/core/index.js';
import type { PriceBreakdownLine, ResolvedPrice } from '../../src/core/index.js';

const functionNames = [
  'planSelectionChange',
  'applySelectionChange',
  'selectionWithVariable',
  'selectionWithAddOnQuantity',
  'selectionInEffect',
  'createPriceStabilizer',
] as const;

interface Vm {
  resolved: {
    planPrices: Record<string, ResolvedPrice>;
    addOnPrices: Record<string, ResolvedPrice>;
    subtotal: number;
    breakdown: { plan?: PriceBreakdownLine; addOns: PriceBreakdownLine[]; subtotal: number };
  };
}
interface Stabilizer {
  stabilize: (viewModel: Vm) => Vm;
  reset: () => void;
}

const createPriceStabilizer = () =>
  (core as unknown as { createPriceStabilizer: () => Stabilizer }).createPriceStabilizer();

beforeAll(() => {
  expect((core as Record<string, unknown>).createPriceStabilizer).toBeTypeOf('function');
});

const errorPrice: ResolvedPrice = {
  kind: 'error',
  message: 'Expression could not be resolved.',
  quantity: 1,
};
const starterAmount: ResolvedPrice = {
  kind: 'amount',
  amount: 20,
  baseAmount: 20,
  billingMultiplier: 1,
  quantity: 1,
};
const prioritySuccessAmount: ResolvedPrice = {
  kind: 'amount',
  amount: 20,
  baseAmount: 25,
  billingMultiplier: 0.8,
  quantity: 1,
};

function planLine(id: string, extra: Partial<PriceBreakdownLine> = {}): PriceBreakdownLine {
  return {
    kind: 'plan',
    id,
    name: id,
    quantity: 1,
    billingMultiplier: 1,
    requiresQuote: false,
    ...extra,
  };
}

function addOnLine(id: string, extra: Partial<PriceBreakdownLine> = {}): PriceBreakdownLine {
  return {
    kind: 'addOn',
    id,
    name: id,
    quantity: 1,
    billingMultiplier: 1,
    requiresQuote: false,
    ...extra,
  };
}

function viewModel(parts: {
  planPrices?: Record<string, ResolvedPrice>;
  addOnPrices?: Record<string, ResolvedPrice>;
  plan?: PriceBreakdownLine;
  addOns?: PriceBreakdownLine[];
}): Vm {
  return {
    resolved: {
      planPrices: parts.planPrices ?? {},
      addOnPrices: parts.addOnPrices ?? {},
      subtotal: -1,
      breakdown: { plan: parts.plan, addOns: parts.addOns ?? [], subtotal: -1 },
    },
  };
}

function keptStarter(): Stabilizer {
  const stabilizer = createPriceStabilizer();
  stabilizer.stabilize(viewModel({ planPrices: { starter: { ...starterAmount } } }));
  return stabilizer;
}

describe('last valid price', () => {
  // [utest->req~price-stabilizer-last-valid~1]
  it('keeps the plan price over an error', () => {
    const stabilizer = keptStarter();
    const result = stabilizer.stabilize(viewModel({ planPrices: { starter: { ...errorPrice } } }));
    expect(result.resolved.planPrices.starter).toEqual(starterAmount);
  });

  // [utest->req~price-stabilizer-last-valid~1]
  it('keeps the add-on price over an error', () => {
    const stabilizer = createPriceStabilizer();
    stabilizer.stabilize(
      viewModel({ addOnPrices: { prioritySuccess: { ...prioritySuccessAmount } } }),
    );
    const result = stabilizer.stabilize(
      viewModel({ addOnPrices: { prioritySuccess: { ...errorPrice } } }),
    );
    expect(result.resolved.addOnPrices.prioritySuccess).toEqual(prioritySuccessAmount);
  });

  // [utest->req~price-stabilizer-last-valid~1]
  it('does not replace an add-on label price', () => {
    const stabilizer = createPriceStabilizer();
    stabilizer.stabilize(
      viewModel({
        addOnPrices: {
          compliance: {
            kind: 'amount',
            amount: 30,
            baseAmount: 30,
            billingMultiplier: 1,
            quantity: 1,
          },
        },
      }),
    );
    const label: ResolvedPrice = { kind: 'label', label: 'Contact sales', quantity: 1 };
    const line = addOnLine('compliance', {
      name: 'Compliance',
      requiresQuote: true,
      label: 'Contact sales',
    });
    const result = stabilizer.stabilize(
      viewModel({ addOnPrices: { compliance: label }, addOns: [{ ...line }] }),
    );
    expect(result.resolved.addOnPrices.compliance).toEqual(label);
    expect(result.resolved.breakdown.addOns[0]).toEqual(line);
  });
});

describe('latest valid price', () => {
  const amountOf = (amount: number): ResolvedPrice => ({
    kind: 'amount',
    amount,
    baseAmount: amount,
    billingMultiplier: 1,
    quantity: 1,
  });

  // [utest->req~price-stabilizer-last-valid~1]
  it('keeps the newest plan price over an error', () => {
    const stabilizer = keptStarter();
    stabilizer.stabilize(viewModel({ planPrices: { starter: amountOf(30) } }));
    const result = stabilizer.stabilize(viewModel({ planPrices: { starter: { ...errorPrice } } }));
    expect(result.resolved.planPrices.starter).toEqual(amountOf(30));
  });

  // [utest->req~price-stabilizer-last-valid~1]
  it('keeps the newest add-on price over an error', () => {
    const stabilizer = createPriceStabilizer();
    stabilizer.stabilize(viewModel({ addOnPrices: { extraStorage: amountOf(20) } }));
    stabilizer.stabilize(viewModel({ addOnPrices: { extraStorage: amountOf(30) } }));
    const result = stabilizer.stabilize(
      viewModel({ addOnPrices: { extraStorage: { ...errorPrice } } }),
    );
    expect(result.resolved.addOnPrices.extraStorage).toEqual(amountOf(30));
  });

  // [utest->req~price-stabilizer-last-valid~1]
  it('keeps an error for ids that name Object.prototype members', () => {
    const result = createPriceStabilizer().stabilize(
      viewModel({
        planPrices: { constructor: { ...errorPrice } },
        addOnPrices: { toString: { ...errorPrice } },
      }),
    );
    expect(result.resolved.planPrices.constructor?.kind).toBe('error');
    expect(result.resolved.addOnPrices.toString?.kind).toBe('error');
  });
});

describe('records', () => {
  // [utest->req~price-stabilizer-records~1]
  it('records the prices of a call whose result is dropped', () => {
    const stabilizer = createPriceStabilizer();
    stabilizer.stabilize(
      viewModel({
        planPrices: {
          growth: { kind: 'amount', amount: 45, baseAmount: 45, billingMultiplier: 1, quantity: 1 },
        },
      }),
    );
    const result = stabilizer.stabilize(viewModel({ planPrices: { growth: { ...errorPrice } } }));
    const price = result.resolved.planPrices.growth;
    expect(price?.kind).toBe('amount');
    expect(price?.kind === 'amount' ? price.amount : undefined).toBe(45);
  });
});

describe('breakdown line', () => {
  // [utest->req~price-stabilizer-breakdown-line~1]
  it('gives the plan line the kept factors', () => {
    const stabilizer = keptStarter();
    const result = stabilizer.stabilize(
      viewModel({
        planPrices: { starter: { ...errorPrice } },
        plan: planLine('starter', { requiresQuote: true }),
      }),
    );
    expect(result.resolved.breakdown.plan).toMatchObject({
      quantity: 1,
      unitAmount: 20,
      billingMultiplier: 1,
      amount: 20,
      requiresQuote: false,
    });
  });

  // [utest->req~price-stabilizer-breakdown-line~1]
  it('gives the add-on line the kept factors and no label', () => {
    const stabilizer = createPriceStabilizer();
    stabilizer.stabilize(
      viewModel({ addOnPrices: { prioritySuccess: { ...prioritySuccessAmount } } }),
    );
    const result = stabilizer.stabilize(
      viewModel({
        addOnPrices: { prioritySuccess: { ...errorPrice } },
        addOns: [
          {
            kind: 'addOn',
            id: 'prioritySuccess',
            name: 'Priority Success',
            quantity: 1,
            billingMultiplier: 0.8,
            requiresQuote: true,
          },
        ],
      }),
    );
    expect(result.resolved.breakdown.addOns).toEqual([
      {
        kind: 'addOn',
        id: 'prioritySuccess',
        name: 'Priority Success',
        quantity: 1,
        unitAmount: 25,
        billingMultiplier: 0.8,
        amount: 20,
        requiresQuote: false,
      },
    ]);
    expect(Object.keys(result.resolved.breakdown.addOns[0]!)).not.toContain('label');
  });
});

describe('subtotal', () => {
  // [utest->req~price-stabilizer-subtotal~1]
  it('folds a kept plan line and a resolved add-on line', () => {
    const stabilizer = keptStarter();
    const result = stabilizer.stabilize(
      viewModel({
        planPrices: { starter: { ...errorPrice } },
        plan: planLine('starter'),
        addOns: [addOnLine('extraStorage', { amount: 5 })],
      }),
    );
    expect(result.resolved.subtotal).toBe(25);
    expect(result.resolved.breakdown.subtotal).toBe(25);
  });

  // [utest->req~price-stabilizer-subtotal~1]
  it('counts a missing plan line as 0', () => {
    const result = createPriceStabilizer().stabilize(
      viewModel({
        addOns: [addOnLine('extraStorage', { amount: 5 }), addOnLine('compliance')],
      }),
    );
    expect(result.resolved.subtotal).toBe(5);
    expect(result.resolved.breakdown.subtotal).toBe(5);
  });

  // [utest->req~price-stabilizer-subtotal~1]
  it('counts a plan line with no amount as 0 and keeps the error', () => {
    const result = createPriceStabilizer().stabilize(
      viewModel({
        planPrices: { growth: { ...errorPrice } },
        plan: planLine('growth', { requiresQuote: true }),
        addOns: [addOnLine('extraStorage', { amount: 5 })],
      }),
    );
    expect(result.resolved.planPrices.growth?.kind).toBe('error');
    expect(result.resolved.breakdown.plan?.amount).toBeUndefined();
    expect(result.resolved.breakdown.plan?.requiresQuote).toBe(true);
    expect(result.resolved.subtotal).toBe(5);
    expect(result.resolved.breakdown.subtotal).toBe(5);
  });
});

describe('reset', () => {
  // [utest->req~price-stabilizer-reset~1]
  it('forgets the kept prices', () => {
    const stabilizer = keptStarter();
    stabilizer.reset();
    const result = stabilizer.stabilize(viewModel({ planPrices: { starter: { ...errorPrice } } }));
    expect(result.resolved.planPrices.starter?.kind).toBe('error');
  });
});

function typeCheckSnippet(source: string): string[] {
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
  const diagnostics = ts.getPreEmitDiagnostics(program, program.getSourceFile(snippetPath));
  return diagnostics.map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n'));
}

describe('exports', () => {
  // [utest->req~selection-logic-exported~1]
  it('exports the six functions and the four types from the core entry', () => {
    for (const name of functionNames) {
      expect((core as Record<string, unknown>)[name], name).toBeTypeOf('function');
    }
    const diagnostics = typeCheckSnippet(`
      import type {
        PendingAddOnChange,
        PriceStabilizer,
        SelectionChangeIntent,
        SelectionChangeResult,
      } from '../../src/core/index.js';
      export type Probe = [
        PendingAddOnChange,
        PriceStabilizer,
        SelectionChangeIntent,
        SelectionChangeResult,
      ];
    `);
    expect(diagnostics).toEqual([]);
  }, 60_000);
});
