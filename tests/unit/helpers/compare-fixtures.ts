import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compareSelections, normalizePricing } from '../../../src/core/index.js';
import type {
  NormalizedPricing,
  PricingSelection,
  SelectionComparison,
  SelectionComparisonSide,
} from '../../../src/core/index.js';
import { parsePricingYaml } from '../../../src/yaml/index.js';

type Raw = Record<string, unknown>;

const acmePath = fileURLToPath(new URL('../../fixtures/acme-pricing.yml', import.meta.url));

function normalize(raw: Raw): NormalizedPricing {
  return normalizePricing(raw as never).value!;
}

export function loadAcme(): NormalizedPricing {
  return parsePricingYaml(readFileSync(acmePath, 'utf8')).value!;
}

function mailerBase(): Raw {
  return {
    syntaxVersion: '3.1',
    saasName: 'Mailer',
    version: '1.0',
    createdAt: '2026-01-01',
    currency: 'EUR',
    billing: { monthly: 1 },
    features: {
      api: { valueType: 'BOOLEAN', defaultValue: false },
      legacyExport: { valueType: 'BOOLEAN', defaultValue: false },
    },
    usageLimits: { emails: { valueType: 'NUMERIC', defaultValue: 0, unit: 'email' } },
    plans: {
      basic: {
        price: 10,
        features: { api: { value: true }, legacyExport: { value: true } },
        usageLimits: { emails: { value: 1000 } },
      },
      pro: {
        price: 30,
        features: { api: { value: true }, legacyExport: { value: true } },
        usageLimits: { emails: { value: 10000 } },
      },
    },
    addOns: {
      extraEmails: {
        price: 5,
        usageLimitsExtensions: { emails: { value: 500 } },
        subscriptionConstraints: { minQuantity: 1, maxQuantity: 10, quantityStep: 1 },
      },
    },
  };
}

function mailerV2Raw(): Raw {
  const raw = mailerBase();
  const plans = raw.plans as Record<string, Raw>;
  delete (raw.features as Raw).legacyExport;
  for (const plan of Object.values(plans)) delete (plan.features as Raw).legacyExport;
  plans.basic = {
    ...plans.basic,
    price: 12,
    usageLimits: { emails: { value: 800 } },
  };
  return {
    ...raw,
    version: '2.0',
    addOns: {
      ...(raw.addOns as Raw),
      dedicatedIp: { availableFor: ['pro'], price: 20 },
      ipWarmup: { price: 3, dependsOn: ['dedicatedIp'] },
    },
  };
}

export function makeV1(): NormalizedPricing {
  return normalize(mailerBase());
}

export function makeV2(): NormalizedPricing {
  return normalize(mailerV2Raw());
}

export function makeV2U(): NormalizedPricing {
  return normalize({ ...mailerV2Raw(), currency: 'USD' });
}

/** F: a pricing for feature and usage-limit overrides. `change` edits the raw document. */
export function makeF(change?: (raw: Raw) => void): NormalizedPricing {
  const raw: Raw = {
    syntaxVersion: '3.1',
    saasName: 'Flex',
    version: '1',
    createdAt: '2026-01-01',
    currency: 'EUR',
    features: { sso: { valueType: 'BOOLEAN', defaultValue: false } },
    usageLimits: { seats: { valueType: 'NUMERIC', defaultValue: 3, unit: 'seat' } },
    plans: {
      base: { price: 10, usageLimits: { seats: { value: 5 } } },
      team: {
        price: 20,
        features: { sso: { value: null } },
        usageLimits: { seats: { value: null } },
      },
    },
    addOns: {
      ssoPack: { price: 5, features: { sso: { value: true } } },
      seatPack: {
        price: 2,
        usageLimitsExtensions: { seats: { value: 5 } },
        subscriptionConstraints: { minQuantity: 1, maxQuantity: 20, quantityStep: 1 },
      },
      unlimitedSeats: { price: 50, usageLimits: { seats: { value: Number.POSITIVE_INFINITY } } },
    },
  };
  if (change) change(raw);
  return normalize(raw);
}

export const acme = loadAcme();
export const V1 = makeV1();
export const V2 = makeV2();
export const V2U = makeV2U();
export const F = makeF();

export function Side(
  pricing: NormalizedPricing,
  selection: Partial<PricingSelection>,
): SelectionComparisonSide {
  return { pricing, selection };
}

export function cmp(
  before: SelectionComparisonSide,
  after: SelectionComparisonSide,
): SelectionComparison {
  return compareSelections({ before, after });
}

export function addOn(quantity: number, selected = true) {
  return { selected, quantity };
}

export function C() {
  return {
    planId: 'growth',
    addOns: { extraStorage: addOn(2), prioritySuccess: addOn(1) },
  };
}

export function ENT() {
  return { ...C(), planId: 'enterprise' };
}

export function START() {
  return { ...C(), planId: 'starter' };
}

export function CY3() {
  return {
    planId: 'growth',
    billingPeriod: 'yearly',
    addOns: { extraStorage: addOn(3), prioritySuccess: addOn(1) },
  };
}

export function QUOTE() {
  return {
    planId: 'enterprise',
    addOns: { extraStorage: addOn(2), compliance: addOn(1) },
  };
}

export function M2() {
  return { planId: 'basic', addOns: { extraEmails: addOn(2) } };
}

export function DIP() {
  return { planId: 'pro', addOns: { dedicatedIp: addOn(1) } };
}

/** The after side of the scenario "Legacy plan, quarterly billing and a ghost add-on". */
export function legacySide() {
  return Side(acme, {
    planId: 'legacy',
    billingPeriod: 'quarterly',
    addOns: { ghost: addOn(1), extraStorage: addOn(2) },
  });
}
