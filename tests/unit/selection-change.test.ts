import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import * as core from '../../src/core/index.js';
import { createDefaultSelection, normalizePricing } from '../../src/core/index.js';
import type { NormalizedPricing, PricingSelection } from '../../src/core/index.js';
import { parsePricingYaml } from '../../src/yaml/index.js';

interface Pending {
  addOnId: string;
  select: boolean;
  addIds: string[];
  removeIds: string[];
  planId?: string;
}
interface PlanIntent {
  type: 'plan';
  planId: string;
}
interface AddOnIntent {
  type: 'addOn';
  addOnId: string;
  selected: boolean;
}
type Intent = PlanIntent | AddOnIntent;
interface Applied {
  kind: 'apply';
  selection: PricingSelection;
}
interface Confirm {
  kind: 'confirm';
  pending: Pending;
}
type Result = Applied | Confirm;

// The functions are read from the namespace, so a missing export fails an assertion, not an import.
const api = core as unknown as {
  planSelectionChange: (p: NormalizedPricing, s: PricingSelection, i: Intent) => Result;
  applySelectionChange: (p: NormalizedPricing, s: PricingSelection, c: Pending) => PricingSelection;
  selectionWithVariable: (s: PricingSelection, path: string, value: unknown) => PricingSelection;
  selectionWithAddOnQuantity: (
    p: NormalizedPricing,
    s: PricingSelection,
    id: string,
    quantity: number,
  ) => PricingSelection;
  selectionInEffect: (
    p: NormalizedPricing,
    s: PricingSelection,
    o?: { variablesEnabled?: boolean },
  ) => PricingSelection;
};

let acme: NormalizedPricing;
let chain: NormalizedPricing;
let defaults: PricingSelection;

beforeAll(async () => {
  const url = new URL('../fixtures/acme-pricing.yml', import.meta.url);
  acme = parsePricingYaml(await readFile(fileURLToPath(url), 'utf8')).value!;
  const chainInput = {
    syntaxVersion: '3.1',
    saasName: 'Chain',
    currency: 'EUR',
    plans: { basic: { price: 10 } },
    addOns: {
      base: { price: 1 },
      middle: { price: 1, dependsOn: ['base'], excludes: ['legacy'] },
      top: { price: 1, dependsOn: ['middle'] },
      legacy: { price: 1 },
    },
  };
  chain = normalizePricing(chainInput as never).value!;
  defaults = createDefaultSelection(acme);
  expect(api.planSelectionChange).toBeTypeOf('function');
});

function selectionOf(
  pricing: NormalizedPricing,
  planId: string,
  selected: Record<string, number> = {},
): PricingSelection {
  const base = createDefaultSelection(pricing);
  const addOns = { ...base.addOns };
  for (const [id, quantity] of Object.entries(selected)) addOns[id] = { selected: true, quantity };
  return { ...base, planId, addOns };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

const addOnIntent = (addOnId: string, selected: boolean): Intent => ({
  type: 'addOn',
  addOnId,
  selected,
});

function confirmOf(result: Result): Pending {
  expect(result.kind).toBe('confirm');
  return (result as Confirm).pending;
}

describe('planSelectionChange', () => {
  it('applies a plan change without removals at once', () => {
    const result = api.planSelectionChange(acme, defaults, { type: 'plan', planId: 'growth' });
    expect(result.kind).toBe('apply');
    expect((result as { selection: PricingSelection }).selection.planId).toBe('growth');
  });

  it('makes a plan change that removes add-ons pending', () => {
    const selection = selectionOf(acme, 'growth', { extraStorage: 2, prioritySuccess: 1 });
    const result = api.planSelectionChange(acme, selection, { type: 'plan', planId: 'starter' });
    expect(result).toEqual({
      kind: 'confirm',
      pending: {
        addOnId: '',
        select: false,
        addIds: [],
        removeIds: ['extraStorage', 'prioritySuccess'],
        planId: 'starter',
      },
    });
  });

  it('adds the dependency of a selected add-on', () => {
    const result = api.planSelectionChange(
      acme,
      selectionOf(acme, 'growth'),
      addOnIntent('prioritySuccess', true),
    );
    expect(result).toEqual({
      kind: 'confirm',
      pending: {
        addOnId: 'prioritySuccess',
        select: true,
        addIds: ['extraStorage'],
        removeIds: [],
      },
    });
  });

  it('removes the add-on that the selected add-on excludes', () => {
    const selection = selectionOf(acme, 'enterprise', { extraStorage: 1, compliance: 1 });
    const pending = confirmOf(
      api.planSelectionChange(acme, selection, addOnIntent('prioritySuccess', true)),
    );
    expect(pending.addIds).toEqual([]);
    expect(pending.removeIds).toEqual(['compliance']);
  });

  it('removes the add-on whose excludes name the selected add-on', () => {
    const selection = selectionOf(acme, 'enterprise', { extraStorage: 1, prioritySuccess: 1 });
    const result = api.planSelectionChange(acme, selection, addOnIntent('compliance', true));
    expect(result).toEqual({
      kind: 'confirm',
      pending: { addOnId: 'compliance', select: true, addIds: [], removeIds: ['prioritySuccess'] },
    });
  });

  it('adds a two-level dependency chain', () => {
    const result = api.planSelectionChange(
      chain,
      selectionOf(chain, 'basic'),
      addOnIntent('top', true),
    );
    const pending = confirmOf(result);
    expect(pending.addOnId).toBe('top');
    expect(pending.select).toBe(true);
    expect([...pending.addIds].sort()).toEqual(['base', 'middle']);
    expect(pending.removeIds).toEqual([]);
  });

  it('removes the add-on that an added dependency excludes', () => {
    const pending = confirmOf(
      api.planSelectionChange(
        chain,
        selectionOf(chain, 'basic', { legacy: 1 }),
        addOnIntent('top', true),
      ),
    );
    expect([...pending.addIds].sort()).toEqual(['base', 'middle']);
    expect(pending.removeIds).toEqual(['legacy']);
  });

  it('removes the dependents of a deselected add-on', () => {
    const selection = selectionOf(acme, 'growth', { extraStorage: 1, prioritySuccess: 1 });
    const pending = confirmOf(
      api.planSelectionChange(acme, selection, addOnIntent('extraStorage', false)),
    );
    expect(pending.removeIds).toEqual(['prioritySuccess']);
  });

  it('removes only the selected dependents of a deselected add-on', () => {
    const selection = selectionOf(chain, 'basic', { base: 1, middle: 1 });
    const pending = confirmOf(
      api.planSelectionChange(chain, selection, addOnIntent('base', false)),
    );
    expect(pending.removeIds).toEqual(['middle']);
  });

  it('removes transitive dependents of a deselected add-on', () => {
    const selection = selectionOf(chain, 'basic', { base: 1, middle: 1, top: 1 });
    const pending = confirmOf(
      api.planSelectionChange(chain, selection, addOnIntent('base', false)),
    );
    expect(pending.addOnId).toBe('base');
    expect(pending.select).toBe(false);
    expect(pending.addIds).toEqual([]);
    expect([...pending.removeIds].sort()).toEqual(['middle', 'top']);
  });

  it('applies an add-on change without side effects at once', () => {
    const selection = selectionOf(acme, 'growth');
    const result = api.planSelectionChange(acme, selection, addOnIntent('extraStorage', true));
    expect(result.kind).toBe('apply');
    const applied = (result as { selection: PricingSelection }).selection;
    expect(applied.addOns.extraStorage).toEqual({ selected: true, quantity: 1 });
    expect(applied).toEqual(
      api.applySelectionChange(acme, selection, {
        addOnId: 'extraStorage',
        select: true,
        addIds: [],
        removeIds: [],
      }),
    );
  });

  it('applies the selection of an add-on whose dependency is already selected', () => {
    const selection = selectionOf(acme, 'growth', { extraStorage: 1 });
    const result = api.planSelectionChange(acme, selection, addOnIntent('prioritySuccess', true));
    expect(result.kind).toBe('apply');
    const applied = (result as Applied).selection;
    expect(applied.addOns.prioritySuccess).toEqual({ selected: true, quantity: 1 });
  });

  it('applies the deselection of an add-on that nothing depends on', () => {
    const selection = selectionOf(acme, 'growth', { extraStorage: 1 });
    const result = api.planSelectionChange(acme, selection, addOnIntent('extraStorage', false));
    expect(result.kind).toBe('apply');
    expect((result as Applied).selection.addOns.extraStorage?.selected).toBe(false);
  });

  it('changes nothing for an unknown add-on', () => {
    const result = api.planSelectionChange(acme, defaults, addOnIntent('ghost', true));
    expect(result.kind).toBe('apply');
    expect((result as { selection: PricingSelection }).selection).toEqual(defaults);
  });

  it('lists the removed add-ons in the order of the pricing', () => {
    const selection = selectionOf(acme, 'enterprise', { compliance: 1, extraStorage: 1 });
    const pending = confirmOf(
      api.planSelectionChange(acme, selection, { type: 'plan', planId: 'starter' }),
    );
    expect(pending.removeIds).toEqual(['extraStorage', 'compliance']);
  });

  const cycleOf = (addOns: Record<string, unknown>): NormalizedPricing =>
    normalizePricing({
      syntaxVersion: '3.1',
      saasName: 'Cycle',
      currency: 'EUR',
      plans: { basic: { price: 10 } },
      addOns,
    } as never).value!;
  const addIdsOf = (result: Result): string[] =>
    result.kind === 'confirm' ? result.pending.addIds : [];

  it('never lists the selected add-on among the dependencies of a cycle', () => {
    const cycle = cycleOf({
      a: { price: 1, dependsOn: ['b'] },
      b: { price: 1, dependsOn: ['a'] },
    });
    const selection = selectionOf(cycle, 'basic');
    const result = api.planSelectionChange(cycle, selection, addOnIntent('a', true));
    expect(addIdsOf(result)).toEqual(['b']);
  });

  it('never lists an add-on that depends on itself', () => {
    const cycle = cycleOf({ a: { price: 1, dependsOn: ['a'] } });
    const selection = selectionOf(cycle, 'basic');
    const result = api.planSelectionChange(cycle, selection, addOnIntent('a', true));
    expect(addIdsOf(result)).not.toContain('a');
  });
});

describe('applySelectionChange', () => {
  it('applies a confirmed dependency', () => {
    const next = api.applySelectionChange(acme, selectionOf(acme, 'growth'), {
      addOnId: 'prioritySuccess',
      select: true,
      addIds: ['extraStorage'],
      removeIds: [],
    });
    expect(next.addOns.prioritySuccess).toEqual({ selected: true, quantity: 1 });
    expect(next.addOns.extraStorage).toEqual({ selected: true, quantity: 1 });
  });

  it('applies a confirmed plan change and keeps the quantities', () => {
    const selection = selectionOf(acme, 'growth', { extraStorage: 2, prioritySuccess: 1 });
    const pending = confirmOf(
      api.planSelectionChange(acme, selection, { type: 'plan', planId: 'starter' }),
    );
    const next = api.applySelectionChange(acme, selection, pending);
    expect(next.planId).toBe('starter');
    expect(next.addOns.extraStorage).toEqual({ selected: false, quantity: 2 });
    expect(next.addOns.prioritySuccess).toEqual({ selected: false, quantity: 1 });
  });

  const quantityPricing = (constraints?: Record<string, unknown>): NormalizedPricing =>
    normalizePricing({
      syntaxVersion: '3.1',
      saasName: 'Quantity',
      currency: 'EUR',
      plans: { basic: { price: 10 } },
      addOns: {
        seat: {
          price: 1,
          ...(constraints ? { subscriptionConstraints: constraints } : {}),
        },
      },
    } as never).value!;
  const seatChange: Pending = { addOnId: 'seat', select: true, addIds: [], removeIds: [] };

  it('starts a new entry at the minimum quantity of the add-on', () => {
    const pricing = quantityPricing({ minQuantity: 3 });
    const selection = { ...createDefaultSelection(pricing), addOns: {} };
    const next = api.applySelectionChange(pricing, selection, seatChange);
    expect(next.addOns.seat).toEqual({ selected: true, quantity: 3 });
  });

  it('starts a new entry at quantity 1 without a minimum', () => {
    const pricing = quantityPricing();
    const selection = { ...createDefaultSelection(pricing), addOns: {} };
    const next = api.applySelectionChange(pricing, selection, seatChange);
    expect(next.addOns.seat).toEqual({ selected: true, quantity: 1 });
  });
});

describe('selection helpers', () => {
  it('sets a nested variable and keeps the others', () => {
    const next = api.selectionWithVariable(defaults, 'priceByRegion.us-price', 12);
    expect(next.variables.priceByRegion).toEqual({ 'eu-price': 8, 'us-price': 12 });
    expect(next.variables.seats).toBe(5);
  });

  describe('prototype paths', () => {
    afterEach(() => {
      delete (Object.prototype as Record<string, unknown>).polluted;
    });

    it('treats constructor and prototype as ordinary names', () => {
      let next: PricingSelection | undefined;
      try {
        expect(() => {
          next = api.selectionWithVariable(defaults, 'constructor.prototype.polluted', 1);
        }).not.toThrow();
        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
        const variables = next!.variables;
        expect(Object.hasOwn(variables, 'constructor')).toBe(true);
        expect(Object.getOwnPropertyDescriptor(variables, 'constructor')?.value).toEqual({
          prototype: { polluted: 1 },
        });
      } finally {
        delete (Object.prototype as Record<string, unknown>).polluted;
      }
    });

    it('updates an own variable named prototype', () => {
      const selection = { ...defaults, variables: { prototype: 1 } };
      const next = api.selectionWithVariable(selection, 'prototype', 2);
      expect(next.variables).toEqual({ prototype: 2 });
    });

    const paths = ['__proto__.polluted', 'a.__proto__.polluted'];
    for (const path of paths) {
      it(`refuses the path ${path}`, () => {
        let next: PricingSelection | undefined;
        try {
          expect(() => {
            next = api.selectionWithVariable(defaults, path, 1);
          }).not.toThrow();
          expect(({} as Record<string, unknown>).polluted).toBeUndefined();
          expect(next?.variables).toEqual(defaults.variables);
          const copy = structuredClone(defaults.variables);
          (core as unknown as { setAtPath: (t: unknown, p: string, v: unknown) => void }).setAtPath(
            copy,
            path,
            1,
          );
          expect(copy).toEqual(defaults.variables);
          expect(({} as Record<string, unknown>).polluted).toBeUndefined();
        } finally {
          delete (Object.prototype as Record<string, unknown>).polluted;
        }
      });
    }
  });

  describe('array index cap', () => {
    for (const path of ['a[4294967294]', 'list[1001]']) {
      it(`refuses the path ${path}`, () => {
        const started = performance.now();
        const next = api.selectionWithVariable(defaults, path, 1);
        expect(performance.now() - started).toBeLessThan(500);
        expect(next.variables).toEqual(defaults.variables);
        expect(next.variables).not.toHaveProperty(path.slice(0, path.indexOf('[')));
      });
    }

    it('still writes list[1000]', () => {
      const list = api.selectionWithVariable(defaults, 'list[1000]', 1).variables.list;
      expect(Array.isArray(list)).toBe(true);
      expect((list as unknown[])[1000]).toBe(1);
    });

    it('still writes list[0].x', () => {
      const next = api.selectionWithVariable(defaults, 'list[0].x', 1);
      expect(next.variables.list).toEqual([{ x: 1 }]);
    });

    for (const path of ['tiers.1e9', 'tiers.abc', 'tiers.-1', 'tiers.0x10']) {
      it(`refuses the non-canonical index ${path} on an existing array`, () => {
        const tiers: unknown[] = [];
        const selection = { ...defaults, variables: { tiers } };
        const next = api.selectionWithVariable(selection, path, 1);
        expect((next.variables.tiers as unknown[]).length).toBe(0);
        expect(next.variables).toEqual({ tiers: [] });
        expect(tiers.length).toBe(0);
      });
    }

    for (const path of ['tiers.01', 'tiers[00]']) {
      it(`refuses the leading-zero index ${path}`, () => {
        const selection = { ...defaults, variables: { tiers: [] as unknown[] } };
        const next = api.selectionWithVariable(selection, path, 1);
        expect((next.variables.tiers as unknown[]).length).toBe(0);
        expect(next.variables).toEqual({ tiers: [] });
      });
    }

    for (const path of ['x.01', 'x.0.01']) {
      it(`refuses the leading-zero index ${path} under a missing parent`, () => {
        const next = api.selectionWithVariable(defaults, path, 1);
        expect(next.variables).toEqual(defaults.variables);
      });
    }

    for (const path of ['tiers[1001]', 'tiers.4294967294']) {
      it(`refuses the new index ${path} on an existing array`, () => {
        const selection = { ...defaults, variables: { tiers: [] as unknown[] } };
        const next = api.selectionWithVariable(selection, path, 1);
        expect((next.variables.tiers as unknown[]).length).toBe(0);
        expect(next.variables).toEqual({ tiers: [] });
      });
    }

    it('writes the new index tiers[1000] on an existing array', () => {
      const selection = { ...defaults, variables: { tiers: [] as unknown[] } };
      const tiers = api.selectionWithVariable(selection, 'tiers[1000]', 1).variables
        .tiers as unknown[];
      expect(tiers[1000]).toBe(1);
    });

    it('overwrites an existing index above 1000 and refuses a different new one', () => {
      const tiers: unknown[] = [0];
      tiers[1500] = 1;
      const selection = { ...defaults, variables: { tiers } };
      const written = api.selectionWithVariable(selection, 'tiers[1500]', 2).variables
        .tiers as unknown[];
      expect(written[1500]).toBe(2);
      const refused = api.selectionWithVariable(selection, 'tiers[1600]', 2).variables
        .tiers as unknown[];
      expect(refused[1600]).toBeUndefined();
      expect(refused.length).toBe(1501);
      expect(refused[1500]).toBe(1);
    });
  });

  it('reads own properties only with getAtPath', () => {
    const getAtPath = (core as unknown as { getAtPath: (s: unknown, p: string) => unknown })
      .getAtPath;
    expect(getAtPath({ a: 1 }, 'constructor')).toBeUndefined();
    expect(getAtPath({ a: 1 }, 'toString')).toBeUndefined();
    expect(getAtPath({ a: 1 }, '__proto__')).toBeUndefined();
    expect(getAtPath({ a: 1 }, 'a')).toBe(1);
  });

  it('caps an add-on quantity at the maximum', () => {
    const next = api.selectionWithAddOnQuantity(acme, defaults, 'extraStorage', 40);
    expect(next.addOns.extraStorage).toEqual({ selected: true, quantity: 10 });
  });

  it('follows variablesEnabled', () => {
    const selection = api.selectionWithVariable(defaults, 'seats', 40);
    const off = api.selectionInEffect(acme, selection, { variablesEnabled: false });
    const on = api.selectionInEffect(acme, selection, { variablesEnabled: true });
    expect(off.variables.seats).toBe(5);
    expect(on.variables.seats).toBe(40);
    expect(off.variables).not.toBe(acme.variables);
    expect(on.variables).not.toBe(selection.variables);
  });

  it('keeps the variables of the selection by default', () => {
    const selection = api.selectionWithVariable(defaults, 'seats', 40);
    expect(api.selectionInEffect(acme, selection).variables.seats).toBe(40);
  });
});

describe('no mutation', () => {
  it('leaves frozen inputs unchanged', () => {
    const pricing = deepFreeze(structuredClone(acme));
    const selection = deepFreeze(
      structuredClone(selectionOf(acme, 'growth', { extraStorage: 2, prioritySuccess: 1 })),
    );
    const pending = deepFreeze<Pending>({
      addOnId: '',
      select: false,
      addIds: [],
      removeIds: ['extraStorage', 'prioritySuccess'],
      planId: 'starter',
    });
    const planIntent = deepFreeze<Intent>({ type: 'plan', planId: 'starter' });
    const addOn = deepFreeze<Intent>(addOnIntent('extraStorage', false));
    const applyIntent = deepFreeze<Intent>({ type: 'plan', planId: 'enterprise' });
    const withDependency = deepFreeze<Pending>({
      addOnId: 'prioritySuccess',
      select: true,
      addIds: ['extraStorage'],
      removeIds: [],
    });
    const all = { pricing, selection, pending, planIntent, addOn, applyIntent, withDependency };
    const copies = structuredClone(all);

    expect(() => {
      api.planSelectionChange(pricing, selection, planIntent);
      api.planSelectionChange(pricing, selection, addOn);
      api.planSelectionChange(pricing, selection, applyIntent);
      api.applySelectionChange(pricing, selection, pending);
      api.applySelectionChange(pricing, selection, withDependency);
      api.selectionWithVariable(selection, 'priceByRegion.us-price', 9);
      api.selectionWithAddOnQuantity(pricing, selection, 'extraStorage', 4);
      api.selectionInEffect(pricing, selection, { variablesEnabled: false });
      api.selectionInEffect(pricing, selection, { variablesEnabled: true });
    }).not.toThrow();
    expect(all).toEqual(copies);
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
  it('names one PendingAddOnChange type on the core and element entries', () => {
    expect(api.planSelectionChange).toBeTypeOf('function');
    const diagnostics = typeCheckSnippet(`
      import type { PendingAddOnChange as FromCore } from '../../src/core/index.js';
      import type { PendingAddOnChange as FromElement } from '../../src/element/index.js';
      export const toElement = (value: FromCore): FromElement => value;
      export const toCore = (value: FromElement): FromCore => value;
    `);
    expect(diagnostics).toEqual([]);
  }, 60_000);
});
