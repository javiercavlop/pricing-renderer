// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { mergeSelection, normalizePricing, reconcileSelection } from '../../src/core/index.js';
import type { NormalizedPricing, PricingSelection } from '../../src/core/index.js';
import { parsePricingYaml } from '../../src/yaml/index.js';
import * as space from '../../src/space/index.js';
import {
  contractedVersion,
  currentUsageFromContract,
  selectionFromContract,
  subscriptionFromSelection,
} from '../../src/space/index.js';
import { selectionFromContract as exampleSelectionFromContract } from '../../examples/space-contract/map-contract.js';

interface JsonFile {
  exports: Record<string, unknown>;
  scripts: Record<string, string>;
  references: unknown[];
  compilerOptions: Record<string, string>;
}

const readText = (path: string) => readFile(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const readJson = async (path: string) => JSON.parse(await readText(path)) as JsonFile;

let acme: NormalizedPricing;
let mailerV2: NormalizedPricing;

beforeAll(async () => {
  acme = parsePricingYaml(await readText('../fixtures/acme-pricing.yml')).value!;
  mailerV2 = normalizePricing({
    syntaxVersion: '3.1',
    saasName: 'Mailer',
    version: '2.0',
    createdAt: '2026-01-01',
    currency: 'EUR',
    billing: { monthly: 1 },
    plans: { basic: { price: 12 }, pro: { price: 30 } },
    addOns: {
      extraEmails: {
        price: 5,
        subscriptionConstraints: { minQuantity: 1, maxQuantity: 10, quantityStep: 1 },
      },
    },
  } as never).value!;
});

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

// compareSelections does not exist yet: mergeSelection + reconcileSelection give the
// reconciled selection that comparison.selections.after will carry (the spec's stand-in note).
const after = (pricing: NormalizedPricing, selection: Partial<PricingSelection>) =>
  reconcileSelection(pricing, mergeSelection(pricing, selection)).selection;

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
});

describe('subscriptionFromSelection', () => {
  // [utest->req~space-subscription-body~1]
  it('builds the novation body for the Delivera contract', () => {
    const s = after(acme, selectionC('growth'));
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
    const s = after(acme, selectionC('starter'));
    expect(subscriptionFromSelection('acme', '2026.07', s)).toStrictEqual({
      contractedServices: { acme: '2026.07' },
      subscriptionPlans: { acme: 'starter' },
      subscriptionAddOns: { acme: {} },
    });
  });

  // [utest->req~space-subscription-version~1]
  it('keeps the dotted version as given', () => {
    const s = after(mailerV2, {
      planId: 'basic',
      addOns: { extraEmails: { selected: true, quantity: 2 } },
    });
    const body = subscriptionFromSelection('mailer', mailerV2.metadata.version!, s);
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
    expect(Object.keys(body.subscriptionAddOns.acme)).toEqual(['f', 'g']);
  });

  // [utest->req~space-roundtrip~1]
  it('round-trips an upgrade to Enterprise through selectionFromContract', () => {
    const s = after(acme, selectionC('enterprise'));
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
});

describe('currentUsageFromContract', () => {
  // [utest->req~space-current-usage~1]
  it('maps valid consumed values only', () => {
    const contract = usageContract();
    expect(currentUsageFromContract(contract, 'acme')).toStrictEqual({ storage: 150 });
    expect(currentUsageFromContract(contract, 'mailer')).toStrictEqual({ emails: 9 });
    expect(currentUsageFromContract(contract, 'other')).toStrictEqual({});
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
    body.subscriptionAddOns.acme.f = 99;
    body.contractedServices.acme = 'x';
    delete (body.subscriptionPlans as Record<string, string>).acme;

    expect(usage).toEqual(usageCopy);
    expect(versions).toEqual(versionsCopy);
    expect(selection).toEqual(selectionCopy);
  });
});
