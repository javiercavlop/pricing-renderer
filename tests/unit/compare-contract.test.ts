// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  C,
  CY3,
  DIP,
  ENT,
  M2,
  QUOTE,
  START,
  Side,
  V1,
  V2,
  V2U,
  acme,
  addOn,
  cmp,
  legacySide,
} from './helpers/compare-fixtures.js';
import { compareSelections, resolvePricing } from '../../src/core/index.js';

const legacy = () => cmp(Side(acme, { planId: 'Growth' }), legacySide());

function notANumber() {
  return {
    before: Side(acme, C()),
    after: Side(acme, START()),
    currentUsage: { storage: Number.NaN, bandwidth: 3 },
  };
}

function withUsage(currentUsage: Record<string, number>) {
  return compareSelections({ before: Side(acme, C()), after: Side(acme, START()), currentUsage });
}

describe('compareSelections price', () => {
  // [utest->req~compare-price-sides~1]
  it('copies the breakdown of each side and tells a billing period change', () => {
    const r = cmp(Side(acme, C()), Side(acme, CY3()));
    expect(r.price.before).toStrictEqual(resolvePricing(acme, C()).breakdown);
    expect(r.price.before.subtotal).toBe(80);
    expect(r.price.after).toStrictEqual(resolvePricing(acme, r.selections.after).breakdown);
    expect(r.price.after.subtotal).toBe(68);
    expect(r.price.billingPeriodChanged).toBe(true);
  });

  // [utest->req~compare-price-difference~1]
  it('subtracts the subtotals when both are priced in the same currency', () => {
    const yearly = cmp(Side(acme, C()), Side(acme, CY3()));
    const versions = cmp(Side(V1, M2()), Side(V2, M2()));
    expect(yearly.price.difference).toBe(-12);
    expect(versions.price.difference).toBe(2);
    expect('differenceOmitted' in yearly.price).toBe(false);
    expect('differenceOmitted' in versions.price).toBe(false);
  });

  // [utest->req~compare-price-difference-omitted~1]
  it('leaves the difference out when a quote is needed', () => {
    const r = cmp(Side(acme, C()), Side(acme, QUOTE()));
    expect('difference' in r.price).toBe(false);
    expect(r.price.differenceOmitted).toBe('quote');
    expect(r.price.after.requiresQuote).toBe(true);
    expect(r.price.after.subtotal).toBe(50);
  });

  // [utest->req~compare-price-difference-omitted~1]
  it('names the quote when a quote is needed and the currencies differ', () => {
    expect(V2U.metadata.currency).not.toBe(V1.metadata.currency);
    const r = cmp(Side(V1, M2()), Side(V2U, { planId: 'ghost' }));
    expect(r.price.after.requiresQuote).toBe(true);
    expect('difference' in r.price).toBe(false);
    expect(r.price.differenceOmitted).toBe('quote');
  });

  // [utest->req~compare-price-difference-omitted~1]
  it('leaves the difference out when the currencies differ', () => {
    const r = cmp(Side(V1, M2()), Side(V2U, M2()));
    expect('difference' in r.price).toBe(false);
    expect(r.price.differenceOmitted).toBe('currency');
  });
});

describe('compareSelections version', () => {
  // [utest->req~compare-version~1]
  it('reports version 1.0 to 2.0', () => {
    const r = cmp(Side(V1, M2()), Side(V2, M2()));
    expect(r.version.before).toBe('1.0');
    expect(r.version.after).toBe('2.0');
    expect(r.version.changed).toBe(true);
  });

  // [utest->req~compare-version~1]
  it('reports the same version', () => {
    const { version } = cmp(Side(acme, C()), Side(acme, ENT()));
    expect(version.before).toBe('2026.07');
    expect(version.after).toBe('2026.07');
    expect(version.changed).toBe(false);
  });

  // [utest->req~compare-version~1]
  it('leaves a missing version out', () => {
    const unversioned = { ...acme, metadata: { ...acme.metadata } };
    delete unversioned.metadata.version;
    const { version } = cmp(Side(unversioned, C()), Side(unversioned, C()));
    expect('before' in version).toBe(false);
    expect('after' in version).toBe(false);
    expect(version.changed).toBe(false);
  });

  // [utest->req~compare-version-items~1]
  it('lists the ids that only one version defines', () => {
    const { version } = cmp(Side(V1, M2()), Side(V2, M2()));
    expect(version.onlyInBefore).toStrictEqual({
      plans: [],
      addOns: [],
      features: ['legacyExport'],
      usageLimits: [],
    });
    expect(version.onlyInAfter).toStrictEqual({
      plans: [],
      addOns: ['dedicatedIp', 'ipWarmup'],
      features: [],
      usageLimits: [],
    });
  });

  // [utest->req~compare-item-presence~1]
  it('marks a feature of the old version only', () => {
    const r = cmp(Side(V1, M2()), Side(V2, M2()));
    const legacyExport = r.features.lost.find((entry) => entry.id === 'legacyExport');
    expect(legacyExport?.presence).toBe('before-only');
  });

  // [utest->req~compare-item-presence~1]
  it('takes the name from the after pricing when it defines the id', () => {
    const renamed = {
      ...V2,
      usageLimits: V2.usageLimits.map((limit) => ({ ...limit, name: 'E-mails' })),
    };
    const r = cmp(Side(V1, M2()), Side(renamed, M2()));
    expect(r.usageLimits.changed[0]?.name).toBe('E-mails');
    expect(r.features.lost[0]?.name).toBe('Legacy Export');
  });
});

describe('compareSelections diagnostics', () => {
  // [utest->req~compare-unknown-plan~1]
  it('keeps a wrongly cased plan and warns', () => {
    const r = cmp(Side(acme, { planId: 'Growth' }), Side(acme, C()));
    expect(r.diagnostics).toHaveLength(1);
    expect(r.diagnostics[0]).toMatchObject({
      code: 'PR_COMPARE_UNKNOWN_PLAN',
      severity: 'warning',
      path: 'before.selection.planId',
    });
    expect(r.plan.before).toStrictEqual({ id: 'Growth', known: false });
    expect(r.price.before.requiresQuote).toBe(true);
  });

  // [utest->req~compare-unknown-billing~1]
  it('keeps an unknown billing period and warns', () => {
    const r = cmp(Side(acme, C()), Side(acme, { ...C(), billingPeriod: 'quarterly' }));
    expect(r.diagnostics).toHaveLength(1);
    expect(r.diagnostics[0]).toMatchObject({
      code: 'PR_COMPARE_UNKNOWN_BILLING_PERIOD',
      severity: 'warning',
      path: 'after.selection.billingPeriod',
    });
    expect('billingPeriod' in r.price.after).toBe(false);
    expect(r.price.after.subtotal).toBe(80);
    expect(r.price.billingPeriodChanged).toBe(true);
  });

  // [utest->req~compare-unknown-addon~1]
  it('drops a ghost add-on so that it does not require a quote', () => {
    const edit = { ...C(), addOns: { ...C().addOns, ghost: addOn(1) } };
    const r = cmp(Side(acme, C()), Side(acme, edit));
    expect(r.diagnostics).toHaveLength(1);
    expect(r.diagnostics[0]).toMatchObject({
      code: 'PR_COMPARE_UNKNOWN_ADDON',
      severity: 'warning',
      path: 'after.selection.addOns.ghost',
    });
    expect('ghost' in r.selections.after.addOns).toBe(false);
    expect(r.price.after.requiresQuote).toBe(false);
    expect(r.relation).toBe('current');
  });

  // [utest->req~compare-diagnostics-order~1]
  it('orders plan, billing period, add-on and dropped diagnostics', () => {
    const r = legacy();
    const pairs = r.diagnostics.map((entry) => [entry.code, entry.path]);
    expect(pairs).toEqual([
      ['PR_COMPARE_UNKNOWN_PLAN', 'before.selection.planId'],
      ['PR_COMPARE_UNKNOWN_PLAN', 'after.selection.planId'],
      ['PR_COMPARE_UNKNOWN_BILLING_PERIOD', 'after.selection.billingPeriod'],
      ['PR_COMPARE_UNKNOWN_ADDON', 'after.selection.addOns.ghost'],
      ['PR_COMPARE_ADDON_DROPPED', 'after.selection.addOns.extraStorage'],
    ]);
    expect(r.relation).toBe('change');
    expect(r.price.differenceOmitted).toBe('quote');
  });

  // [utest->req~compare-diagnostics-order~1]
  it('separates the removal reasons from the contract to an unknown plan', () => {
    const edit = { planId: 'legacy', addOns: { extraStorage: addOn(2) } };
    const r = cmp(Side(acme, C()), Side(acme, edit));
    const removed = r.addOns.removedByReconciliation.map((entry) => [entry.id, entry.reason]);
    expect(removed).toEqual([['extraStorage', 'unavailable-for-plan']]);
    expect(r.addOns.removedByUser.map((entry) => entry.id)).toEqual(['prioritySuccess']);
  });

  // [utest->req~compare-addon-dropped~1]
  it('reports an add-on that Starter drops', () => {
    const before = Side(acme, { planId: 'starter' });
    const after = Side(acme, { planId: 'starter', addOns: { extraStorage: addOn(2) } });
    const r = cmp(before, after);
    expect(r.diagnostics).toHaveLength(1);
    expect(r.diagnostics[0]).toMatchObject({
      code: 'PR_COMPARE_ADDON_DROPPED',
      severity: 'info',
      path: 'after.selection.addOns.extraStorage',
    });
  });

  // [utest->req~compare-usage-diagnostics~1]
  it('ignores and reports invalid and unknown usage entries in key order', () => {
    const r = compareSelections(notANumber());
    const triples = r.diagnostics.map((entry) => [entry.code, entry.severity, entry.path]);
    expect(triples).toEqual([
      ['PR_COMPARE_INVALID_USAGE', 'warning', 'currentUsage.storage'],
      ['PR_COMPARE_UNKNOWN_USAGE_LIMIT', 'info', 'currentUsage.bandwidth'],
    ]);
    expect(r.usageLimits.exceeded).toEqual([]);
    const storage = r.usageLimits.changed.find((entry) => entry.id === 'storage');
    expect('currentUsage' in storage!).toBe(false);
  });

  // [utest->req~compare-usage-diagnostics~1]
  it('rejects negative and infinite consumption', () => {
    const negative = withUsage({ storage: -1 });
    const infinite = withUsage({ storage: Number.POSITIVE_INFINITY });
    expect(negative.diagnostics.map((entry) => entry.code)).toEqual(['PR_COMPARE_INVALID_USAGE']);
    expect(infinite.diagnostics.map((entry) => entry.code)).toEqual(['PR_COMPARE_INVALID_USAGE']);
  });

  // [utest->req~compare-usage-diagnostics~1]
  it('checks an unknown id before an invalid value', () => {
    const r = withUsage({ bandwidth: Number.NaN });
    expect(r.diagnostics.map((entry) => entry.code)).toEqual(['PR_COMPARE_UNKNOWN_USAGE_LIMIT']);
  });
});

describe('compareSelections JSON and isolation', () => {
  function results() {
    return [
      cmp(Side(acme, C()), Side(acme, ENT())),
      cmp(Side(acme, C()), Side(acme, QUOTE())),
      legacy(),
      compareSelections({
        before: Side(V1, M2()),
        after: Side(V2, M2()),
        currentUsage: { emails: 1900 },
      }),
    ];
  }

  // [utest->req~compare-json~1]
  it('round-trips unlimited values, quotes, unknown ids and two versions', () => {
    for (const result of results()) {
      expect(JSON.parse(JSON.stringify(result))).toStrictEqual(result);
    }
  });

  // [utest->req~compare-json~1]
  it('stays JSON-safe for inputs that are not', () => {
    const edit = {
      planId: 'growth',
      billingPeriod: undefined,
      variables: { seats: 5, region: undefined },
      addOns: {
        compliance: { selected: false, quantity: Number.NaN },
        extraStorage: addOn(2),
      },
    };
    const r = cmp(Side(acme, C()), Side(acme, edit as never));
    expect(JSON.parse(JSON.stringify(r))).toStrictEqual(r);
    expect(r.selections.after.billingPeriod).toBe('monthly');
    expect(r.selections.after.addOns.compliance).toStrictEqual({ selected: false, quantity: 0 });
    expect(r.selections.after.variables.region).toBe('eu');
  });

  // [utest->req~compare-json~1]
  it('turns a negative zero into 0', () => {
    const compliance = { selected: false, quantity: -0 };
    const after = Side(acme, { planId: 'growth', addOns: { compliance } });
    const currentUsage = { storage: -0 };
    const r = compareSelections({ before: Side(acme, C()), after, currentUsage });
    expect(JSON.parse(JSON.stringify(r))).toStrictEqual(r);
    expect(Object.is(r.selections.after.addOns.compliance!.quantity, 0)).toBe(true);
    const change = r.usageLimits.changed.find((entry) => entry.id === 'storage');
    expect(Object.is(change?.currentUsage, 0)).toBe(true);
  });

  // [utest->req~compare-json~1]
  it('ignores a plan id or billing period that is not a string', () => {
    const edit = { planId: 5, billingPeriod: {} };
    const r = cmp(Side(acme, C()), Side(acme, edit as never));
    expect(r.diagnostics).toEqual([]);
    expect(r.selections.after.planId).toBe('starter');
    expect(r.selections.after.billingPeriod).toBe('monthly');
  });

  // [utest->req~compare-detached~1]
  it('shares no object with the input or another result', () => {
    const contract = C();
    const copy = JSON.parse(JSON.stringify(contract));
    const r1 = cmp(Side(acme, contract), Side(acme, ENT()));
    const r2 = cmp(Side(acme, contract), Side(acme, ENT()));
    r1.selections.after.addOns.extraStorage!.quantity = 99;
    r1.price.after.addOns[0]!.amount = 0;
    r1.price.before.billingPeriod!.label = 'Changed';
    r1.selections.before.variables.seats = 99;
    expect(r2).toStrictEqual(cmp(Side(acme, C()), Side(acme, ENT())));
    expect(acme.billing[0]!.label).toBe('Monthly');
    expect(contract).toStrictEqual(copy);
  });

  // [utest->req~compare-no-mutation~1]
  it('does not mutate its inputs', () => {
    const v1 = structuredClone(V1);
    const v2 = structuredClone(V2);
    const usage = notANumber();
    const usageCopy = structuredClone(usage);
    const legacyBefore = Side(acme, { planId: 'Growth' });
    const legacyAfter = legacySide();
    const legacyCopy = structuredClone([legacyBefore, legacyAfter]);
    compareSelections({ before: Side(V1, M2()), after: Side(V2, DIP()) });
    compareSelections(usage);
    compareSelections({ before: legacyBefore, after: legacyAfter });
    expect(V1).toStrictEqual(v1);
    expect(V2).toStrictEqual(v2);
    expect(usage).toStrictEqual(usageCopy);
    expect([legacyBefore, legacyAfter]).toStrictEqual(legacyCopy);
  });
});

describe('compareSelections without a DOM', () => {
  // [utest->req~compare-headless~1]
  it('runs in node and returns a downgrade', () => {
    expect(globalThis.document).toBeUndefined();
    expect(globalThis.customElements).toBeUndefined();
    const r = cmp(Side(acme, C()), Side(acme, START()));
    expect(r.relation).toBe('downgrade');
  });
});
