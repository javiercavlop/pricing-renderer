// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { PricingSelection } from '../../src/core/index.js';
import * as space from '../../src/space/index.js';
import {
  contractedVersion,
  currentUsageFromContract,
  selectionFromContract,
  subscriptionFromSelection,
} from '../../src/space/index.js';
import type { SpaceContractLike } from '../../src/space/index.js';
import { selectionFromContract as exampleSelectionFromContract } from '../../examples/space-contract/map-contract.js';
import type { SpaceContractLike as ExampleContractLike } from '../../examples/space-contract/map-contract.js';
import { C, ENT, M2, START, Side, V1, V2, acme, addOn, cmp } from './helpers/compare-fixtures.js';

interface JsonFile {
  exports: Record<string, unknown>;
  scripts: Record<string, string>;
  references: unknown[];
  compilerOptions: Record<string, string>;
}

const readText = (path: string) => readFile(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const readJson = async (path: string) => JSON.parse(await readText(path)) as JsonFile;

const contractC = () => ({
  subscriptionPlans: { acme: 'growth' },
  subscriptionAddOns: { acme: { extraStorage: 2, prioritySuccess: 1 } },
});

const selectionC = (planId: string): Partial<PricingSelection> => ({
  planId,
  addOns: {
    extraStorage: { selected: true, quantity: 2 },
    prioritySuccess: { selected: true, quantity: 1 },
  },
});

// The reconciled selection of the edit, as comparison.selections.after carries it.
const afterOf = (before: ReturnType<typeof Side>, after: ReturnType<typeof Side>) =>
  cmp(before, after).selections.after;

const usageContract = () => ({
  usageLevels: {
    acme: {
      storage: { consumed: 150, resetTimeStamp: '2026-11-01T00:00:00Z' },
      apiCalls: { consumed: Number.NaN },
      seats: { consumed: -1 },
      exports: {},
    },
    mailer: { emails: { consumed: 9 } },
  },
});

const oddSelection = () => ({
  planId: 'growth',
  addOns: {
    a: { selected: false, quantity: 2 },
    b: { selected: true, quantity: 0 },
    c: { selected: true, quantity: Number.NaN },
    d: { selected: true, quantity: Number.POSITIVE_INFINITY },
    e: { selected: true, quantity: -1 },
    f: { selected: true, quantity: 1.5 },
    g: { selected: true, quantity: 4 },
  },
});

// Lists the statements of a module that load code at run time, across lines: static imports
// without `type`, `export ... from` without `type`, dynamic import() and require().
function runtimeImports(source: string): string[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const patterns = [
    /^\s*import\b(?!\s+type\b)/gm,
    /^\s*export\s+(?:\*|\{[^}]*\})[^;]*?\bfrom\b/gm,
    /\bimport\s*\(/g,
    /\brequire\s*\(/g,
  ];
  return patterns.flatMap((pattern) => Array.from(code.matchAll(pattern), (m) => m[0].trim()));
}

describe('space subpath packaging', () => {
  // [utest->req~space-subpath-export~1]
  it('maps ./space in package.json', async () => {
    const pkg = await readJson('../../package.json');
    expect(pkg.exports['./space']).toStrictEqual({
      types: './dist/space/index.d.ts',
      default: './dist/space/index.js',
    });
  });

  // [utest->req~space-build~1]
  it('builds the subpath through its own tsconfig and checks it with attw', async () => {
    const root = await readJson('../../tsconfig.json');
    const project = await readJson('../../tsconfig.space.json');
    const pkg = await readJson('../../package.json');
    expect(root.references).toContainEqual({ path: './tsconfig.space.json' });
    expect(project.compilerOptions.rootDir).toBe('./src/space');
    expect(project.compilerOptions.outDir).toBe('./dist/space');
    expect(pkg.scripts['package:check']).toContain(
      '--entrypoints . ./yaml ./element ./define ./react ./space',
    );
  });

  // [utest->req~space-no-runtime-deps~1]
  it('imports only types', async () => {
    const source = await readText('../../src/space/index.ts');
    const lines = source
      .split('\n')
      .filter((line) => /^\s*import\b/.test(line) || /^\s*export\b.*\bfrom\b/.test(line));
    for (const line of lines) {
      expect(line).toMatch(/^\s*(import|export) type\b/);
    }
  });

  // [utest->req~space-no-runtime-deps~1]
  it('has no run-time import, multi-line or dynamic', async () => {
    const source = await readText('../../src/space/index.ts');
    expect(source).toMatch(/^import type\b/m);
    expect(runtimeImports(source)).toEqual([]);
  });

  // [utest->req~space-no-runtime-deps~1]
  it('finds run-time imports that a line scan misses', () => {
    const sample = [
      "import type {\n  A,\n} from './types.js';",
      "import {\n  b,\n} from './b.js';",
      "export {\n  c,\n} from './c.js';",
      "export type {\n  D,\n} from './d.js';",
      "const e = await import('./e.js');",
      "// import { f } from './f.js';",
    ].join('\n');
    expect(runtimeImports(sample)).toEqual(['import', 'export {\n  c,\n} from', 'import(']);
  });

  // [utest->req~space-no-runtime-deps~1]
  it('loads in node without DOM globals', () => {
    expect(typeof (globalThis as { document?: unknown }).document).toBe('undefined');
    expect(Object.keys(space).sort()).toEqual([
      'contractedVersion',
      'currentUsageFromContract',
      'selectionFromContract',
      'subscriptionFromSelection',
    ]);
  });
});

describe('selectionFromContract in the subpath', () => {
  // [utest->req~space-select-from-contract~1]
  it('maps the Delivera contract', () => {
    expect(selectionFromContract(contractC(), 'acme')).toEqual(selectionC('growth'));
  });

  // [utest->req~space-example-reexport~1]
  it('is the same function as the example re-export', () => {
    expect(exampleSelectionFromContract).toBe(selectionFromContract);
  });

  // [utest->req~space-example-reexport~1]
  it('re-exports the SpaceContractLike type from the subpath', async () => {
    const probe: ExampleContractLike = contractC();
    const same: SpaceContractLike = probe;
    expect(selectionFromContract(same, 'acme')).toEqual(selectionC('growth'));
    const example = await readText('../../examples/space-contract/map-contract.ts');
    expect(example).toMatch(
      /export type \{ SpaceContractLike \} from '\.\.\/\.\.\/src\/space\/index\.js';/,
    );
  });
});

describe('selectionFromContract with hostile keys', () => {
  // [utest->req~space-map-missing-service~1]
  it('finds no plan for a service key that names an inherited property', () => {
    const contract = { subscriptionPlans: { acme: 'growth' }, subscriptionAddOns: {} };
    for (const serviceKey of ['constructor', 'toString', 'hasOwnProperty', '__proto__']) {
      expect(selectionFromContract(contract, serviceKey)).toStrictEqual({});
    }
  });

  // [utest->req~space-map-plan~1] [utest->req~space-map-addons~1]
  it('reads an own __proto__ key of parsed JSON without changing a prototype', () => {
    const contract = JSON.parse(
      '{"subscriptionPlans":{"__proto__":"growth"},' +
        '"subscriptionAddOns":{"__proto__":{"__proto__":2,"extraStorage":1}}}',
    ) as SpaceContractLike;
    const result = selectionFromContract(contract, '__proto__');
    expect(result.planId).toBe('growth');
    const addOns = result.addOns!;
    expect(Object.getPrototypeOf(addOns)).toBe(Object.prototype);
    expect(Object.keys(addOns)).toEqual(['__proto__', 'extraStorage']);
    expect(Object.getOwnPropertyDescriptor(addOns, '__proto__')?.value).toEqual({
      selected: true,
      quantity: 2,
    });
    expect(addOns.extraStorage).toEqual({ selected: true, quantity: 1 });
    expect(({} as { selected?: boolean }).selected).toBeUndefined();
  });

  // [utest->req~space-map-plan~1]
  it('ignores a plan id that is not a string', () => {
    const contract = { subscriptionPlans: { acme: 5 } } as unknown as SpaceContractLike;
    expect(selectionFromContract(contract, 'acme')).toStrictEqual({});
  });
});

describe('subscriptionFromSelection', () => {
  // [utest->req~space-subscription-body~1]
  it('builds the novation body for the Delivera contract', () => {
    const s = afterOf(Side(acme, C()), Side(acme, C()));
    const body = subscriptionFromSelection('acme', '2026.07', s);
    expect(body).toStrictEqual({
      contractedServices: { acme: '2026.07' },
      subscriptionPlans: { acme: 'growth' },
      subscriptionAddOns: { acme: { extraStorage: 2, prioritySuccess: 1 } },
    });
    expect(Object.keys(body)).toEqual([
      'contractedServices',
      'subscriptionPlans',
      'subscriptionAddOns',
    ]);
  });

  // [utest->req~space-subscription-body~1]
  it('drops the add-ons removed by a downgrade to Starter', () => {
    const s = afterOf(Side(acme, C()), Side(acme, START()));
    expect(subscriptionFromSelection('acme', '2026.07', s)).toStrictEqual({
      contractedServices: { acme: '2026.07' },
      subscriptionPlans: { acme: 'starter' },
      subscriptionAddOns: { acme: {} },
    });
  });

  // [utest->req~space-subscription-addons~1]
  it('sends the billed quantity of an add-on above its maximum', () => {
    const addOns = { extraStorage: addOn(25), prioritySuccess: addOn(1) };
    const s = afterOf(Side(acme, C()), Side(acme, { planId: 'growth', addOns }));
    expect(s.addOns.extraStorage).toStrictEqual({ selected: true, quantity: 10 });
    const body = subscriptionFromSelection('acme', '2026.07', s);
    expect(body.subscriptionAddOns).toStrictEqual({
      acme: { extraStorage: 10, prioritySuccess: 1 },
    });
  });

  // [utest->req~space-subscription-version~1]
  it('keeps the dotted version as given', () => {
    const s = afterOf(Side(V1, M2()), Side(V2, M2()));
    const body = subscriptionFromSelection('mailer', V2.metadata.version!, s);
    expect(body.contractedServices).toStrictEqual({ mailer: '2.0' });
  });

  // [utest->req~space-subscription-plan~1]
  it('leaves subscriptionPlans empty without a plan', () => {
    const noPlan = subscriptionFromSelection('acme', '2026.07', {
      addOns: { extraStorage: { selected: true, quantity: 3 } },
    });
    const emptyPlan = subscriptionFromSelection('acme', '2026.07', { planId: '' });
    expect(noPlan.subscriptionPlans).toStrictEqual({});
    expect(emptyPlan.subscriptionPlans).toStrictEqual({});
    expect(noPlan.subscriptionAddOns).toStrictEqual({ acme: { extraStorage: 3 } });
  });

  // [utest->req~space-subscription-addons~1]
  it('keeps only selected add-ons with a finite quantity above 0, in key order', () => {
    const body = subscriptionFromSelection('acme', '1', oddSelection());
    expect(body.subscriptionAddOns).toStrictEqual({ acme: { f: 1.5, g: 4 } });
    expect(Object.keys(body.subscriptionAddOns.acme!)).toEqual(['f', 'g']);
  });

  // [utest->req~space-subscription-body~1]
  it('keeps a __proto__ service key and add-on name as own keys', () => {
    const selection = JSON.parse(
      '{"planId":"growth","addOns":{"__proto__":{"selected":true,"quantity":2}}}',
    ) as Parameters<typeof subscriptionFromSelection>[2];
    const body = subscriptionFromSelection('__proto__', '1', selection);
    expect(JSON.stringify(body)).toBe(
      '{"contractedServices":{"__proto__":"1"},"subscriptionPlans":{"__proto__":"growth"},' +
        '"subscriptionAddOns":{"__proto__":{"__proto__":2}}}',
    );
    expect(Object.getPrototypeOf(body.subscriptionPlans)).toBe(Object.prototype);
    expect(Object.keys(body.subscriptionPlans)).toEqual(['__proto__']);
  });

  // [utest->req~space-roundtrip~1]
  it('round-trips an upgrade to Enterprise through selectionFromContract', () => {
    const s = afterOf(Side(acme, C()), Side(acme, ENT()));
    const body = subscriptionFromSelection('acme', '2026.07', s);
    expect(selectionFromContract(body, 'acme')).toEqual({
      planId: 'enterprise',
      addOns: {
        extraStorage: { selected: true, quantity: 2 },
        prioritySuccess: { selected: true, quantity: 1 },
      },
    });
  });
});

describe('contractedVersion', () => {
  // [utest->req~space-contracted-version~1]
  it('turns the escaped separator back into a dot', () => {
    const contract = { contractedServices: { acme: '2026_07', mailer: '1.0' } };
    expect(contractedVersion(contract, 'acme')).toBe('2026.07');
    expect(contractedVersion(contract, 'mailer')).toBe('1.0');
    expect(contractedVersion(contract, 'other')).toBeUndefined();
    expect(contractedVersion({}, 'acme')).toBeUndefined();
  });

  // [utest->req~space-contracted-version~1]
  it('replaces every separator of the stored version', () => {
    const contract = { contractedServices: { acme: '2026_07_1_rc_2' } };
    expect(contractedVersion(contract, 'acme')).toBe('2026.07.1.rc.2');
  });

  // [utest->req~space-contracted-version~1]
  it('finds no version for a service key that names an inherited property', () => {
    const contract = { contractedServices: { acme: '1_0' } };
    for (const serviceKey of ['constructor', 'toString', '__proto__']) {
      expect(contractedVersion(contract, serviceKey)).toBeUndefined();
    }
  });
});

describe('currentUsageFromContract', () => {
  // [utest->req~space-current-usage~1]
  it('maps valid consumed values only', () => {
    const contract = usageContract();
    expect(currentUsageFromContract(contract, 'acme')).toStrictEqual({ storage: 150 });
    expect(currentUsageFromContract(contract, 'mailer')).toStrictEqual({ emails: 9 });
    expect(currentUsageFromContract(contract, 'other')).toStrictEqual({});
  });

  // [utest->req~space-current-usage~1]
  it('accepts a consumed amount of 0 and rejects Infinity', () => {
    const contract = {
      usageLevels: {
        acme: {
          idle: { consumed: 0 },
          endless: { consumed: Number.POSITIVE_INFINITY },
          text: { consumed: '5' as unknown as number },
        },
      },
    };
    expect(currentUsageFromContract(contract, 'acme')).toStrictEqual({ idle: 0 });
  });

  // [utest->req~space-current-usage~1]
  it('keeps an own __proto__ limit name as data', () => {
    const contract = JSON.parse(
      '{"usageLevels":{"acme":{"__proto__":{"consumed":4},"storage":{"consumed":1}}}}',
    ) as SpaceContractLike;
    const usage = currentUsageFromContract(contract, 'acme');
    expect(Object.getPrototypeOf(usage)).toBe(Object.prototype);
    expect(Object.keys(usage)).toEqual(['__proto__', 'storage']);
    expect(JSON.stringify(usage)).toBe('{"__proto__":4,"storage":1}');
  });
});

describe('space helpers and mutation', () => {
  // [utest->req~space-no-mutation~1]
  it('leaves the arguments unchanged', () => {
    const usage = usageContract();
    const usageCopy = structuredClone(usage);
    const versions = { contractedServices: { acme: '2026_07' } };
    const versionsCopy = structuredClone(versions);
    const selection = oddSelection();
    const selectionCopy = structuredClone(selection);

    const usageResult = currentUsageFromContract(usage, 'acme');
    usageResult.storage = 1;
    usageResult.extra = 2;
    const version = contractedVersion(versions, 'acme');
    expect(version).toBe('2026.07');
    const body = subscriptionFromSelection('acme', '1', selection);
    body.subscriptionAddOns.acme!.f = 99;
    body.contractedServices.acme = 'x';
    delete (body.subscriptionPlans as Record<string, string>).acme;

    expect(usage).toEqual(usageCopy);
    expect(versions).toEqual(versionsCopy);
    expect(selection).toEqual(selectionCopy);
  });
});
