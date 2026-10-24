import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  normalizeAddOnQuantity,
  normalizePricing,
  reconcileSelection,
  resolvePricing as resolveCore,
} from '../../src/core/index.js';
import type {
  AddOnSelection,
  NormalizedPricing,
  PriceBreakdown,
  PriceBreakdownLine,
  PricingSelection,
  ResolvedPricing,
} from '../../src/core/index.js';
import { parsePricingYaml } from '../../src/yaml/index.js';

async function readFixture(relative: string): Promise<string> {
  return readFile(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
}

async function loadFixture(relative: string): Promise<NormalizedPricing> {
  return parsePricingYaml(await readFixture(relative)).value!;
}

let acme: NormalizedPricing;
let zoom: NormalizedPricing;
let slack: NormalizedPricing;

beforeAll(async () => {
  acme = await loadFixture('../fixtures/acme-pricing.yml');
  zoom = await loadFixture('../fixtures/spectra/zoom/2024.yml');
  slack = await loadFixture('../fixtures/spectra/slack/2024.yml');
});

// resolvePricing that fails with a clear assertion when the result has no breakdown.
function resolvePricing(
  pricing: NormalizedPricing,
  selection?: Partial<PricingSelection>,
): ResolvedPricing {
  const resolved = resolveCore(pricing, selection);
  expect(resolved.breakdown, 'resolved.breakdown').toBeDefined();
  return resolved;
}

// Selections of the spec (Definitions). Functions, so that no test shares or mutates an input.
const selectionC = (): Partial<PricingSelection> => ({
  planId: 'growth',
  addOns: {
    extraStorage: { selected: true, quantity: 2 },
    prioritySuccess: { selected: true, quantity: 1 },
  },
});

const selectionCY = (): Partial<PricingSelection> => ({
  ...selectionC(),
  billingPeriod: 'yearly',
});

const selectionE = (): Partial<PricingSelection> => ({
  planId: 'enterprise',
  addOns: {
    extraStorage: { selected: true, quantity: 3 },
    compliance: { selected: true, quantity: 1 },
  },
});

const selectionX = (): Partial<PricingSelection> => ({
  planId: 'growth',
  variables: { seats: 'not-a-number' },
  addOns: {
    extraStorage: { selected: true, quantity: 1 },
    prioritySuccess: { selected: true, quantity: 1 },
  },
});

const selectionZA = (): Partial<PricingSelection> => ({
  planId: 'PRO',
  billingPeriod: 'annual',
  addOns: {
    extraCloudRecordingStorage: { selected: true, quantity: 3 },
    audioConferencing: { selected: true, quantity: 1 },
    premierSupport: { selected: true, quantity: 1 },
  },
});

// keys deliberately in reverse declaration order
const selectionZM = (): Partial<PricingSelection> => ({
  planId: 'PRO',
  addOns: {
    zoomWhiteboard: { selected: true, quantity: 1 },
    zoomClipsPlus: { selected: true, quantity: 1 },
    zoomScheduler: { selected: true, quantity: 1 },
  },
});

const selectionS1 = (): Partial<PricingSelection> => ({
  planId: 'PRO',
  addOns: {
    slackAI: { selected: true, quantity: 1 },
    premiumWorkflowOverageCost: { selected: true, quantity: 1000 },
  },
});

const selectionS2 = (): Partial<PricingSelection> => ({
  planId: 'ENTERPRISE_GRID',
  addOns: { premiumWorkflowOverageCost: { selected: true, quantity: 10 } },
});

const ghostEntry = (): AddOnSelection => ({ selected: true, quantity: 1 });

const quarterly = (): Partial<PricingSelection> => ({
  planId: 'growth',
  billingPeriod: 'quarterly',
});

const breakdownOf = (
  pricing: NormalizedPricing,
  selection?: Partial<PricingSelection>,
): PriceBreakdown => resolvePricing(pricing, selection).breakdown;

const lineIds = (breakdown: PriceBreakdown): string[] => breakdown.addOns.map((line) => line.id);

function addOnLine(breakdown: PriceBreakdown, id: string): PriceBreakdownLine {
  const line = breakdown.addOns.find((candidate) => candidate.id === id);
  expect(line, `add-on line ${id}`).toBeDefined();
  return line!;
}

// The line amount fold of the spec: the plan amount (0 without one), then each add-on amount.
function lineAmountFold(breakdown: PriceBreakdown): number {
  let total = breakdown.plan?.amount ?? 0;
  for (const line of breakdown.addOns) {
    if (line.amount !== undefined) total += line.amount;
  }
  return total;
}

const contractBreakdownYearly = () => ({
  currency: 'EUR',
  billingPeriod: { id: 'yearly', label: 'Yearly', multiplier: 0.8 },
  plan: {
    kind: 'plan',
    id: 'growth',
    name: 'Growth',
    quantity: 1,
    unitAmount: 45,
    billingMultiplier: 0.8,
    amount: 36,
    requiresQuote: false,
  },
  addOns: [
    {
      kind: 'addOn',
      id: 'extraStorage',
      name: 'Extra Storage',
      quantity: 2,
      unitAmount: 5,
      billingMultiplier: 0.8,
      amount: 8,
      requiresQuote: false,
    },
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
  ],
  subtotal: 64,
  requiresQuote: false,
});

describe('spec arithmetic (independent of the implementation)', () => {
  it('holds for the acme yearly amounts', () => {
    expect(45 * 0.8).toBe(36);
    expect(20 * 0.8).toBe(16);
    expect(40 * 0.8).toBe(32);
    expect(5 * 0.8).toBe(4);
    expect(25 * 0.8).toBe(20);
    expect(5 * 0.8 * 2).toBe(8);
    expect(36 + 8 + 20).toBe(64);
  });

  it('holds for the Slack and Zoom decimal amounts', () => {
    expect(0.05 * 1 * 1000).toBe(50);
    expect(8.75 + 50).toBe(58.75);
    expect(0.05 * 1 * 10).toBe(0.5);
    expect(15.99 * 0.83).toBeCloseTo(13.2717, 9);
    expect(40 * 0.83 * 3).toBeCloseTo(99.6, 9);
    expect(100 * 0.83 * 1).toBeCloseTo(83, 9);
    expect(15.99 * 0.83 + 40 * 0.83 * 3 + 100 * 0.83 * 1).toBeCloseTo(195.8717, 9);
    expect(15.99 + 5.49 + 6.59 + 2.49).toBeCloseTo(30.56, 9);
  });

  it('shows that the sum of the four Zoom amounts depends on the order', () => {
    // the declaration-order fold of ZM and the fold with the last two add-ons swapped differ
    // in the last binary digit; the fold in the reverse key order of ZM gives the same double
    // as the declaration order, so ZM alone cannot tell the two orders apart
    const declaration = 15.99 + 5.49 + 6.59 + 2.49;
    const swapped = 15.99 + 5.49 + 2.49 + 6.59;
    expect(declaration).toBe(30.560000000000002);
    expect(swapped).toBe(30.56);
    expect(15.99 + 2.49 + 6.59 + 5.49).toBe(declaration);
  });
});

describe('breakdown field', () => {
  // [utest->req~breakdown-field~1]
  it('describes the acme defaults', () => {
    expect(breakdownOf(acme)).toStrictEqual({
      currency: 'EUR',
      billingPeriod: { id: 'monthly', label: 'Monthly', multiplier: 1 },
      plan: {
        kind: 'plan',
        id: 'starter',
        name: 'Starter',
        quantity: 1,
        unitAmount: 20,
        billingMultiplier: 1,
        amount: 20,
        requiresQuote: false,
      },
      addOns: [],
      subtotal: 20,
      requiresQuote: false,
    });
  });

  // [utest->req~breakdown-field~1]
  it('describes the contract billed yearly', () => {
    expect(breakdownOf(acme, selectionCY())).toStrictEqual(contractBreakdownYearly());
  });

  // [utest->req~breakdown-field~1]
  it('is present in the result of every call', () => {
    for (const selection of [undefined, selectionC(), selectionE(), selectionX(), {}]) {
      const resolved = resolvePricing(acme, selection);
      expect(resolved.breakdown).toBeDefined();
      expect(typeof resolved.breakdown.subtotal).toBe('number');
    }
    expect(resolvePricing(zoom, selectionZA()).breakdown).toBeDefined();
    expect(resolvePricing(slack, selectionS1()).breakdown).toBeDefined();
  });
});

describe('breakdown currency', () => {
  // [utest->req~breakdown-currency~1]
  it('copies the currency of the pricing metadata (EUR and USD)', () => {
    expect(breakdownOf(acme, selectionCY()).currency).toBe('EUR');
    expect(breakdownOf(zoom, selectionZA()).currency).toBe('USD');
    expect(breakdownOf(acme, selectionCY()).currency).toBe(acme.metadata.currency);
    expect(breakdownOf(zoom, selectionZA()).currency).toBe(zoom.metadata.currency);
  });
});

describe('breakdown billing period', () => {
  // [utest->req~breakdown-billing-period~1]
  it('copies the billing period of the selection (yearly, annual and the synthetic base)', () => {
    expect(breakdownOf(acme, selectionCY()).billingPeriod).toStrictEqual({
      id: 'yearly',
      label: 'Yearly',
      multiplier: 0.8,
    });
    expect(breakdownOf(zoom, selectionZA()).billingPeriod).toStrictEqual({
      id: 'annual',
      label: 'Annual',
      multiplier: 0.83,
    });
    expect(breakdownOf(slack, selectionS1()).billingPeriod).toStrictEqual({
      id: 'base',
      label: 'Base',
      multiplier: 1,
    });
  });
});

describe('breakdown with an unknown billing period', () => {
  // [utest->req~breakdown-unknown-billing-period~1]
  it('has no billingPeriod key and bills every line with multiplier 1', () => {
    const breakdown = breakdownOf(acme, quarterly());
    expect('billingPeriod' in breakdown).toBe(false);
    expect(breakdown.plan!.billingMultiplier).toBe(1);
    expect(breakdown.plan!.amount).toBe(45);
    expect(breakdown.subtotal).toBe(45);
  });

  // [utest->req~breakdown-unknown-billing-period~1]
  it('gives add-on lines multiplier 1 too', () => {
    const breakdown = breakdownOf(acme, { ...selectionC(), billingPeriod: 'quarterly' });
    expect('billingPeriod' in breakdown).toBe(false);
    expect(breakdown.addOns.map((line) => line.billingMultiplier)).toEqual([1, 1]);
    expect(breakdown.subtotal).toBe(80);
  });
});

describe('breakdown plan line', () => {
  // [utest->req~breakdown-plan-line~1]
  it('describes Growth billed yearly', () => {
    const resolved = resolvePricing(acme, selectionCY());
    expect(resolved.breakdown.plan).toStrictEqual({
      kind: 'plan',
      id: 'growth',
      name: 'Growth',
      quantity: 1,
      unitAmount: 45,
      billingMultiplier: 0.8,
      amount: 36,
      requiresQuote: false,
    });
    const price = resolved.planPrices.growth;
    expect(price?.kind).toBe('amount');
    expect(resolved.breakdown.plan!.amount).toBe(price?.kind === 'amount' ? price.amount : -1);
  });

  // [utest->req~breakdown-plan-line~1]
  it('describes Zoom PRO billed annually', () => {
    const resolved = resolvePricing(zoom, selectionZA());
    const plan = resolved.breakdown.plan!;
    expect(plan.kind).toBe('plan');
    expect(plan.id).toBe('PRO');
    expect(plan.name).toBe('PRO');
    expect(plan.quantity).toBe(1);
    expect(plan.unitAmount).toBe(15.99);
    expect(plan.billingMultiplier).toBe(0.83);
    const price = resolved.planPrices.PRO;
    expect(price?.kind).toBe('amount');
    expect(plan.amount).toBe(price?.kind === 'amount' ? price.amount : -1);
    expect(plan.amount).toBeCloseTo(13.2717, 9);
  });
});

describe('breakdown without a known plan', () => {
  // [utest->req~breakdown-no-plan-line~1]
  it.each([
    ['a plan id that is not in the pricing', { planId: 'legacy' }],
    ['an undefined plan id', { planId: undefined }],
  ])('has no plan key for %s', (_name, selection) => {
    const resolved = resolvePricing(acme, selection);
    expect('plan' in resolved.breakdown).toBe(false);
    expect(resolved.breakdown.addOns).toEqual([]);
    expect(resolved.breakdown.subtotal).toBe(0);
    expect(resolved.breakdown.requiresQuote).toBe(true);
  });
});

describe('breakdown add-on lines', () => {
  // [utest->req~breakdown-addon-lines~1]
  it('has one add-on line for each selected add-on of the contract', () => {
    const breakdown = breakdownOf(acme, selectionC());
    expect(lineIds(breakdown)).toEqual(['extraStorage', 'prioritySuccess']);
    expect(breakdown.addOns.every((line) => line.kind === 'addOn')).toBe(true);
  });

  // [utest->req~breakdown-addon-lines~1]
  it('leaves out an add-on removed by reconciliation', () => {
    const breakdown = breakdownOf(acme, {
      planId: 'starter',
      addOns: { extraStorage: { selected: true, quantity: 2 } },
    });
    expect(breakdown.addOns).toEqual([]);
    expect(breakdown.subtotal).toBe(20);
    expect(breakdown.requiresQuote).toBe(false);
  });

  // [utest->req~breakdown-addon-lines~1]
  it('leaves out the dependents of a removed add-on', () => {
    const breakdown = breakdownOf(acme, {
      planId: 'starter',
      addOns: {
        extraStorage: { selected: true, quantity: 2 },
        prioritySuccess: { selected: true, quantity: 1 },
      },
    });
    expect(breakdown.addOns).toEqual([]);
    expect(breakdown.subtotal).toBe(20);
  });

  // [utest->req~breakdown-addon-lines~1]
  it('leaves out an unselected entry', () => {
    const breakdown = breakdownOf(acme, {
      planId: 'growth',
      addOns: { extraStorage: { selected: false, quantity: 3 } },
    });
    expect(breakdown.addOns).toEqual([]);
    expect(breakdown.subtotal).toBe(45);
  });

  // [utest->req~breakdown-addon-lines~1]
  it('leaves out an id that is not in the pricing', () => {
    const breakdown = breakdownOf(acme, {
      planId: 'growth',
      addOns: { ghost: { selected: true, quantity: 1 } },
    });
    expect(breakdown.addOns).toEqual([]);
    expect(breakdown.subtotal).toBe(45);
  });
});

describe('breakdown add-on line order', () => {
  // [utest->req~breakdown-addon-order~1]
  it('follows the declaration order when a dependent is selected first (acme)', () => {
    const breakdown = breakdownOf(acme, {
      planId: 'growth',
      addOns: {
        prioritySuccess: { selected: true, quantity: 1 },
        extraStorage: { selected: true, quantity: 2 },
      },
    });
    expect(lineIds(breakdown)).toEqual(['extraStorage', 'prioritySuccess']);
  });

  // [utest->req~breakdown-addon-order~1]
  it('follows the declaration order for keys in reverse order (Zoom)', () => {
    const breakdown = breakdownOf(zoom, selectionZM());
    expect(lineIds(breakdown)).toEqual(['zoomScheduler', 'zoomClipsPlus', 'zoomWhiteboard']);
  });
});

describe('breakdown add-on line quantity', () => {
  // [utest->req~breakdown-addon-quantity~1]
  it('bills a quantity above the maximum as the maximum and zero as the minimum', () => {
    const above = breakdownOf(acme, {
      planId: 'growth',
      addOns: { extraStorage: { selected: true, quantity: 25 } },
    });
    expect(addOnLine(above, 'extraStorage')).toMatchObject({ quantity: 10, amount: 50 });
    const zero = breakdownOf(acme, {
      planId: 'growth',
      addOns: { extraStorage: { selected: true, quantity: 0 } },
    });
    expect(addOnLine(zero, 'extraStorage')).toMatchObject({ quantity: 1, amount: 5 });
  });

  // [utest->req~breakdown-addon-quantity~1]
  it('uses 1 without constraints and the quantity itself without a maximum', () => {
    expect(addOnLine(breakdownOf(acme, selectionE()), 'compliance').quantity).toBe(1);
    const overage = addOnLine(breakdownOf(slack, selectionS1()), 'premiumWorkflowOverageCost');
    expect(overage.quantity).toBe(1000);
  });

  // [utest->req~breakdown-addon-quantity~1]
  it('bills an add-on with minimum 0 selected at 0 as quantity 0 and amount 0', () => {
    const pricing = normalizePricing({
      syntaxVersion: '3.1',
      saasName: 'Zero',
      version: '1',
      createdAt: '2026-01-01',
      currency: 'EUR',
      plans: { base: { price: 10 } },
      addOns: {
        seats: { price: 2, subscriptionConstraints: { minQuantity: 0, quantityStep: 1 } },
      },
    }).value!;
    const resolved = resolvePricing(pricing, {
      planId: 'base',
      addOns: { seats: { selected: true, quantity: 0 } },
    });
    const line = addOnLine(resolved.breakdown, 'seats');
    expect(line.quantity).toBe(0);
    expect(line.amount).toBe(0);
    expect(resolved.breakdown.subtotal).toBe(resolved.breakdown.plan!.amount);
    expect(resolved.subtotal).toBe(10);
    // addOnPrices keeps pricing a quantity of 0 as 1
    expect(resolved.addOnPrices.seats).toMatchObject({ kind: 'amount', quantity: 1, amount: 2 });
  });
});

describe('breakdown priced line', () => {
  // [utest->req~breakdown-priced-line~1]
  it('multiplies left to right on Zoom billed annually', () => {
    const resolved = resolvePricing(zoom, selectionZA());
    const storage = addOnLine(resolved.breakdown, 'extraCloudRecordingStorage');
    expect(storage.unitAmount).toBe(40);
    expect(storage.quantity).toBe(3);
    expect(storage.billingMultiplier).toBe(0.83);
    expect(storage.requiresQuote).toBe(false);
    expect('label' in storage).toBe(false);
    expect(storage.amount).toBe(40 * 0.83 * 3);
    expect(storage.amount).toBeCloseTo(99.6, 9);

    const audio = addOnLine(resolved.breakdown, 'audioConferencing');
    const audioPrice = resolved.addOnPrices.audioConferencing;
    expect(audio.unitAmount).toBe(100);
    expect(audio.quantity).toBe(1);
    expect(audio.amount).toBe(audioPrice?.kind === 'amount' ? audioPrice.amount : -1);
    expect(audio.amount).toBeCloseTo(83, 9);
  });

  // [utest->req~breakdown-priced-line~1]
  it('describes the Slack overage line', () => {
    const overage = addOnLine(breakdownOf(slack, selectionS1()), 'premiumWorkflowOverageCost');
    expect(overage.unitAmount).toBe(0.05);
    expect(overage.quantity).toBe(1000);
    expect(overage.billingMultiplier).toBe(1);
    expect(overage.amount).toBe(50);
  });

  // [utest->req~breakdown-priced-line~1]
  it('has the amount of the matching price of every priced line', () => {
    const resolved = resolvePricing(zoom, selectionZA());
    const plan = resolved.breakdown.plan!;
    expect(plan.amount).toBe(plan.unitAmount! * plan.billingMultiplier * plan.quantity);
    for (const line of resolved.breakdown.addOns) {
      if (line.amount === undefined) continue;
      expect(line.amount).toBe(line.unitAmount! * line.billingMultiplier * line.quantity);
      const price = resolved.addOnPrices[line.id];
      expect(price?.kind === 'amount' ? price.amount : -1).toBe(line.amount);
    }
  });
});

describe('breakdown label line', () => {
  // [utest->req~breakdown-label-line~1]
  it('describes Compliance on Enterprise', () => {
    const breakdown = breakdownOf(acme, selectionE());
    expect(lineIds(breakdown)).toEqual(['extraStorage', 'compliance']);
    expect(addOnLine(breakdown, 'compliance')).toStrictEqual({
      kind: 'addOn',
      id: 'compliance',
      name: 'Compliance',
      quantity: 1,
      billingMultiplier: 1,
      requiresQuote: true,
      label: 'Contact sales',
    });
    expect(breakdown.subtotal).toBe(55);
    expect(breakdown.requiresQuote).toBe(true);
  });

  // [utest->req~breakdown-label-line~1]
  it('describes the Slack add-on label', () => {
    const breakdown = breakdownOf(slack, selectionS1());
    const ai = addOnLine(breakdown, 'slackAI');
    expect(ai.requiresQuote).toBe(true);
    expect(ai.label).toBe('Contact Sales');
    expect(ai.quantity).toBe(1);
    expect('unitAmount' in ai).toBe(false);
    expect('amount' in ai).toBe(false);
    expect(breakdown.subtotal).toBe(58.75);
    expect(breakdown.requiresQuote).toBe(true);
  });

  // [utest->req~breakdown-label-line~1]
  it('describes the Slack plan label', () => {
    const breakdown = breakdownOf(slack, selectionS2());
    const plan = breakdown.plan!;
    expect(plan.id).toBe('ENTERPRISE_GRID');
    expect(plan.requiresQuote).toBe(true);
    expect(plan.label).toBe('Contact Sales');
    expect('unitAmount' in plan).toBe(false);
    expect('amount' in plan).toBe(false);
    expect(breakdown.subtotal).toBe(0.5);
  });

  // [utest->req~breakdown-label-line~1]
  it('describes the Zoom support add-on', () => {
    const breakdown = breakdownOf(zoom, selectionZA());
    expect(lineIds(breakdown)).toEqual([
      'extraCloudRecordingStorage',
      'audioConferencing',
      'premierSupport',
    ]);
    const support = addOnLine(breakdown, 'premierSupport');
    expect(support.requiresQuote).toBe(true);
    expect(support.label).toBe('Contact us');
  });
});

describe('breakdown expression error line', () => {
  // [utest->req~breakdown-error-line~1]
  it('has no amount, unit amount or label when seats are not a number', () => {
    const resolved = resolvePricing(acme, selectionX());
    expect(resolved.breakdown.plan).toStrictEqual({
      kind: 'plan',
      id: 'growth',
      name: 'Growth',
      quantity: 1,
      billingMultiplier: 1,
      requiresQuote: true,
    });
    expect(addOnLine(resolved.breakdown, 'prioritySuccess')).toStrictEqual({
      kind: 'addOn',
      id: 'prioritySuccess',
      name: 'Priority Success',
      quantity: 1,
      billingMultiplier: 1,
      requiresQuote: true,
    });
    expect(addOnLine(resolved.breakdown, 'extraStorage').amount).toBe(5);
    expect(resolved.breakdown.subtotal).toBe(5);
    expect(resolved.breakdown.requiresQuote).toBe(true);
    const paths = resolved.diagnostics
      .filter((diagnostic) => diagnostic.code === 'PR_EXPRESSION_RESOLUTION_FAILED')
      .map((diagnostic) => diagnostic.path);
    expect(paths).toContain('plans.growth.price');
    expect(paths).toContain('addOns.prioritySuccess.price');
  });

  // The spec scenario says "two PR_EXPRESSION_RESOLUTION_FAILED entries", but the Starter plan
  // ('4 * #seats') and the Enterprise plan ('... * #seats') fail with the same variable, so
  // resolvePricing reports one entry per failing price: four in total (spec defect).
  // [utest->req~breakdown-error-line~1]
  it('reports one failed-expression diagnostic for every price that fails', () => {
    const paths = resolveCore(acme, selectionX())
      .diagnostics.filter((diagnostic) => diagnostic.code === 'PR_EXPRESSION_RESOLUTION_FAILED')
      .map((diagnostic) => diagnostic.path);
    expect(paths).toEqual([
      'plans.starter.price',
      'plans.growth.price',
      'plans.enterprise.price',
      'addOns.prioritySuccess.price',
    ]);
  });

  // [utest->req~breakdown-error-line~1]
  it('has no amount, unit amount or label for a quote pricing that never resolves', () => {
    const quote = normalizePricing({
      syntaxVersion: '3.1',
      saasName: 'Plain',
      version: '1',
      createdAt: '2026-01-01',
      currency: 'EUR',
      variables: { rate: 'n/a' },
      plans: { base: { price: '#rate * 2' } },
    }).value!;
    const breakdown = breakdownOf(quote);
    expect(breakdown.plan).toStrictEqual({
      kind: 'plan',
      id: 'base',
      name: 'Base',
      quantity: 1,
      billingMultiplier: 1,
      requiresQuote: true,
    });
    expect(breakdown.subtotal).toBe(0);
    expect(breakdown.requiresQuote).toBe(true);
  });
});

describe('breakdown summation order', () => {
  // [utest->req~breakdown-subtotal-order~1]
  it('sums the plan and then the add-ons in declaration order (Zoom, reverse keys)', () => {
    const resolved = resolvePricing(zoom, selectionZM());
    const [l0, l1, l2] = resolved.breakdown.addOns;
    const folded = resolved.breakdown.plan!.amount! + l0!.amount! + l1!.amount! + l2!.amount!;
    expect(resolved.subtotal).toBe(folded);
    expect(resolved.subtotal).toBeCloseTo(30.56, 9);
  });

  // [utest->req~breakdown-subtotal-order~1]
  it('differs from the sum in another order of the same lines (Zoom)', () => {
    const resolved = resolvePricing(zoom, selectionZM());
    const [l0, l1, l2] = resolved.breakdown.addOns;
    const swapped = resolved.breakdown.plan!.amount! + l0!.amount! + l2!.amount! + l1!.amount!;
    expect(resolved.subtotal).not.toBe(swapped);
    expect(resolved.subtotal).toBeCloseTo(swapped, 9);
  });

  // [utest->req~breakdown-subtotal-order~1]
  it('sums in declaration order, not in the key order of the selection (Zoom)', () => {
    // in the key order scheduler, whiteboard, clips the key-order sum is 30.56
    const resolved = resolvePricing(zoom, {
      planId: 'PRO',
      addOns: {
        zoomScheduler: { selected: true, quantity: 1 },
        zoomWhiteboard: { selected: true, quantity: 1 },
        zoomClipsPlus: { selected: true, quantity: 1 },
      },
    });
    expect(resolved.subtotal).toBe(30.560000000000002);
    expect(resolved.breakdown.subtotal).toBe(30.560000000000002);
  });

  // [utest->req~breakdown-subtotal-order~1]
  it('skips quote lines in the sum (Zoom annual)', () => {
    const resolved = resolvePricing(zoom, selectionZA());
    const [l0, l1] = resolved.breakdown.addOns;
    const folded = resolved.breakdown.plan!.amount! + l0!.amount! + l1!.amount!;
    expect(resolved.subtotal).toBe(folded);
    expect(resolved.subtotal).toBeCloseTo(195.8717, 9);
  });

  // [utest->req~breakdown-subtotal-order~1]
  it('keeps exact sums exact', () => {
    expect(resolvePricing(acme, selectionCY()).subtotal).toBe(64);
    expect(resolvePricing(acme, selectionE()).subtotal).toBe(55);
    expect(resolvePricing(slack, selectionS1()).subtotal).toBe(58.75);
  });

  // [utest->req~breakdown-subtotal-order~1]
  it('gives the same subtotal whatever the key order of the selection', () => {
    const forward = resolvePricing(zoom, selectionZM());
    const reversed = resolvePricing(zoom, {
      planId: 'PRO',
      addOns: {
        zoomScheduler: { selected: true, quantity: 1 },
        zoomClipsPlus: { selected: true, quantity: 1 },
        zoomWhiteboard: { selected: true, quantity: 1 },
      },
    });
    expect(forward.subtotal).toBe(reversed.subtotal);
    expect(forward.breakdown).toStrictEqual(reversed.breakdown);
  });
});

describe('breakdown subtotal and quote state', () => {
  // [utest->req~breakdown-subtotal-equals~1]
  it('equals the subtotal on the acme scenarios', () => {
    for (const selection of [undefined, selectionC(), selectionCY(), selectionE(), selectionX()]) {
      const resolved = resolvePricing(acme, selection);
      expect(Object.is(resolved.breakdown.subtotal, resolved.subtotal)).toBe(true);
    }
  });

  // [utest->req~breakdown-requires-quote~1]
  it('requires a quote exactly when a line needs one (acme values)', () => {
    const cases: [string, Partial<PricingSelection> | undefined, boolean][] = [
      ['defaults', undefined, false],
      ['C', selectionC(), false],
      ['E', selectionE(), true],
      ['X', selectionX(), true],
      ['legacy plan', { planId: 'legacy' }, true],
      ['unknown add-on', { planId: 'growth', addOns: { ghost: ghostEntry() } }, true],
    ];
    for (const [name, selection, expected] of cases) {
      const resolved = resolvePricing(acme, selection);
      expect(resolved.breakdown.requiresQuote, name).toBe(expected);
      expect(resolved.breakdown.requiresQuote, name).toBe(resolved.requiresQuote);
    }
  });
});

interface SpectraCase {
  fixture: string;
  planId: string;
  billingPeriod: string;
  order: 'declaration' | 'reverse';
  pricing: NormalizedPricing;
  selection: PricingSelection;
  resolved: ResolvedPricing;
}

interface NamedPricing {
  name: string;
  pricing: NormalizedPricing;
}

async function loadSpectraFixtures(): Promise<NamedPricing[]> {
  const root = fileURLToPath(new URL('../fixtures/spectra/', import.meta.url));
  const entries = await readdir(root, { recursive: true });
  const files = entries.filter((entry) => entry.endsWith('.yml'));
  files.sort();
  const fixtures: NamedPricing[] = [{ name: 'acme', pricing: acme }];
  for (const file of files) {
    const result = parsePricingYaml(await readFixture(`../fixtures/spectra/${file}`));
    if (result.ok && result.value) fixtures.push({ name: file, pricing: result.value });
  }
  return fixtures;
}

function everyAddOnSelected(
  pricing: NormalizedPricing,
  order: SpectraCase['order'],
): Record<string, AddOnSelection> {
  const addOns = order === 'declaration' ? pricing.addOns : [...pricing.addOns].reverse();
  return Object.fromEntries(
    addOns.map((addOn) => [
      addOn.id,
      { selected: true, quantity: addOn.subscriptionConstraints?.minQuantity ?? 1 },
    ]),
  );
}

describe('breakdown over every SPECTRA fixture', () => {
  let cases: SpectraCase[] = [];

  beforeAll(async () => {
    cases = [];
    for (const { name, pricing } of await loadSpectraFixtures()) {
      for (const plan of pricing.plans) {
        for (const period of pricing.billing) {
          // the reverse key order checks that the sum does not depend on the selection's keys
          for (const order of ['declaration', 'reverse'] as const) {
            const selection: PricingSelection = {
              planId: plan.id,
              billingPeriod: period.id,
              variables: structuredClone(pricing.variables),
              addOns: everyAddOnSelected(pricing, order),
            };
            cases.push({
              fixture: name,
              planId: plan.id,
              billingPeriod: period.id,
              order,
              pricing,
              selection,
              resolved: resolveCore(pricing, selection),
            });
          }
        }
      }
    }
  });

  const label = (c: SpectraCase) => `${c.fixture} ${c.planId} ${c.billingPeriod} ${c.order}`;

  const expectBreakdowns = () => {
    expect(cases.filter((c) => c.resolved.breakdown === undefined)).toHaveLength(0);
  };

  it('covers the acme, Zoom and Slack fixtures and many others', () => {
    const fixtures = new Set(cases.map((c) => c.fixture));
    expect(fixtures.has('acme')).toBe(true);
    expect(fixtures.has('zoom/2024.yml')).toBe(true);
    expect(fixtures.has('slack/2024.yml')).toBe(true);
    expect(fixtures.size).toBeGreaterThan(10);
  });

  // [utest->req~breakdown-subtotal-equals~1]
  it('has a breakdown subtotal that is Object.is equal to the subtotal', () => {
    expectBreakdowns();
    const mismatches = cases
      .filter((c) => !Object.is(c.resolved.breakdown.subtotal, c.resolved.subtotal))
      .map(label);
    expect(mismatches).toEqual([]);
    expect(cases.length).toBeGreaterThan(0);
  });

  // [utest->req~breakdown-subtotal-equals~1] [utest->req~breakdown-subtotal-order~1]
  it('has a subtotal that is the line amount fold of the breakdown', () => {
    expectBreakdowns();
    const mismatches = cases
      .filter((c) => !Object.is(lineAmountFold(c.resolved.breakdown), c.resolved.subtotal))
      .map(label);
    expect(mismatches).toEqual([]);
    for (const c of cases) {
      expect(lineAmountFold(c.resolved.breakdown), label(c)).toBe(c.resolved.subtotal);
    }
  });

  // [utest->req~breakdown-requires-quote~1]
  it('has a breakdown quote state equal to the quote state', () => {
    expectBreakdowns();
    const mismatches = cases
      .filter((c) => c.resolved.breakdown.requiresQuote !== c.resolved.requiresQuote)
      .map(label);
    expect(mismatches).toEqual([]);
    expect(cases.length).toBeGreaterThan(0);
  });

  // [utest->req~breakdown-requires-quote~1]
  it('requires a quote when the plan is absent or a quote, or an add-on is a quote', () => {
    expectBreakdowns();
    const mismatches = cases
      .filter((c) => {
        const { plan, addOns } = c.resolved.breakdown;
        const expected =
          plan === undefined || plan.requiresQuote || addOns.some((line) => line.requiresQuote);
        return expected !== c.resolved.requiresQuote;
      })
      .map(label);
    expect(mismatches).toEqual([]);
  });

  // [utest->req~breakdown-addon-lines~1] [utest->req~breakdown-addon-order~1]
  it('has a line for each add-on selected after reconciliation, in declaration order', () => {
    expectBreakdowns();
    const mismatches = cases
      .filter((c) => {
        const reconciled = reconcileSelection(c.pricing, c.selection).selection;
        const expected = c.pricing.addOns
          .filter((addOn) => reconciled.addOns[addOn.id]?.selected)
          .map((addOn) => addOn.id);
        return lineIds(c.resolved.breakdown).join() !== expected.join();
      })
      .map(label);
    expect(mismatches).toEqual([]);
  });

  // [utest->req~breakdown-addon-quantity~1]
  it('bills each add-on line with the normalized quantity', () => {
    expectBreakdowns();
    const billed = (c: SpectraCase, line: PriceBreakdownLine): number =>
      normalizeAddOnQuantity(c.pricing, line.id, c.selection.addOns[line.id]);
    const mismatches = cases
      .filter((c) => c.resolved.breakdown.addOns.some((line) => line.quantity !== billed(c, line)))
      .map(label);
    expect(mismatches).toEqual([]);
  });
});

describe('JSON-safe breakdown', () => {
  function undefinedKeys(value: unknown, path = 'breakdown'): string[] {
    if (Array.isArray(value)) {
      return value.flatMap((item, index) => undefinedKeys(item, `${path}[${index}]`));
    }
    if (value === null || typeof value !== 'object') return [];
    return Object.entries(value).flatMap(([key, item]) =>
      item === undefined ? [`${path}.${key}`] : undefinedKeys(item, `${path}.${key}`),
    );
  }

  const cases: [string, () => PriceBreakdown][] = [
    ['CY on acme', () => breakdownOf(acme, selectionCY())],
    ['E on acme', () => breakdownOf(acme, selectionE())],
    ['X on acme', () => breakdownOf(acme, selectionX())],
    ['quarterly on acme', () => breakdownOf(acme, quarterly())],
    ['S2 on Slack', () => breakdownOf(slack, selectionS2())],
    ['a legacy plan on acme', () => breakdownOf(acme, { planId: 'legacy' })],
  ];

  // [utest->req~breakdown-json~1]
  it.each(cases)('reproduces %s through JSON.stringify and JSON.parse', (_name, build) => {
    const breakdown = build();
    expect(JSON.parse(JSON.stringify(breakdown))).toStrictEqual(breakdown);
  });

  // [utest->req~breakdown-json~1]
  it.each(cases)('has no key with the value undefined for %s', (_name, build) => {
    const breakdown = build();
    expect(breakdown).toBeDefined();
    expect(undefinedKeys(breakdown)).toEqual([]);
  });
});

describe('detached breakdown', () => {
  function collectObjects(value: unknown, into = new Set<object>()): Set<object> {
    if (value === null || typeof value !== 'object' || into.has(value)) return into;
    into.add(value);
    for (const item of Object.values(value)) collectObjects(item, into);
    return into;
  }

  // [utest->req~breakdown-detached~1]
  it('does not change the inputs when a result is mutated', () => {
    const selection = selectionCY();
    const selectionCopy = structuredClone(selection);
    const first = resolvePricing(acme, selection);
    first.breakdown.billingPeriod!.label = 'Changed';
    first.breakdown.addOns[0]!.quantity = 99;
    first.breakdown.addOns.push({
      kind: 'addOn',
      id: 'ghost',
      name: 'Ghost',
      quantity: 1,
      billingMultiplier: 1,
      requiresQuote: true,
    });
    expect(first.breakdown.billingPeriod).not.toBe(acme.billing[1]);
    expect(acme.billing[1]!.label).toBe('Yearly');
    expect(selection).toStrictEqual(selectionCopy);
    expect(resolvePricing(acme, selectionCY()).breakdown).toStrictEqual(contractBreakdownYearly());
  });

  // [utest->req~breakdown-detached~1]
  it('shares no object with the pricing, the selection or another result', () => {
    const selection = selectionCY();
    const first = resolvePricing(acme, selection);
    const second = resolvePricing(acme, selection);
    const shared = new Set<object>();
    collectObjects(acme, shared);
    collectObjects(selection, shared);
    collectObjects(second.breakdown, shared);
    const own = collectObjects(first.breakdown);
    expect(own.size).toBeGreaterThan(1);
    expect([...own].filter((object) => shared.has(object))).toEqual([]);
  });

  // [utest->req~breakdown-detached~1]
  it('does not share the billing period copy with the pricing (Zoom and Slack)', () => {
    const zoomBreakdown = breakdownOf(zoom, selectionZA());
    expect(zoomBreakdown.billingPeriod).toBeDefined();
    expect(zoom.billing).not.toContain(zoomBreakdown.billingPeriod);
    const slackBreakdown = breakdownOf(slack, selectionS1());
    expect(slackBreakdown.billingPeriod).toBeDefined();
    expect(slack.billing).not.toContain(slackBreakdown.billingPeriod);
  });
});
