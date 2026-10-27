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
  acme,
  addOn,
  cmp,
} from './helpers/compare-fixtures.js';

const ids = (list: Array<{ id: string }>): string[] => list.map((entry) => entry.id);

describe('compareSelections plan', () => {
  // [utest->req~compare-plan~1]
  it('names both plans for Growth to Enterprise', () => {
    const r = cmp(Side(acme, C()), Side(acme, ENT()));
    expect(r.plan).toStrictEqual({
      before: { id: 'growth', name: 'Growth', known: true },
      after: { id: 'enterprise', name: 'Enterprise', known: true },
      changed: true,
    });
  });

  // [utest->req~compare-plan~1]
  it('gives an unknown plan no name', () => {
    const r = cmp(Side(acme, C()), Side(acme, { planId: 'legacy' }));
    expect(r.plan.after).toStrictEqual({ id: 'legacy', known: false });
    expect(r.plan.changed).toBe(true);
  });

  // [utest->req~compare-plan~1]
  it('reports an unchanged plan', () => {
    const r = cmp(Side(acme, C()), Side(acme, CY3()));
    expect(r.plan.changed).toBe(false);
  });
});

describe('compareSelections relation', () => {
  // [utest->req~compare-relation-current~1]
  it('is current for the same contract, with every list empty but unchanged', () => {
    const r = cmp(Side(acme, C()), Side(acme, C()));
    expect(r.relation).toBe('current');
    expect(r.price.difference).toBe(0);
    expect(r.addOns.added).toEqual([]);
    expect(r.addOns.removedByUser).toEqual([]);
    expect(r.addOns.removedByReconciliation).toEqual([]);
    expect(r.addOns.quantityChanged).toEqual([]);
    expect(r.features.gained).toEqual([]);
    expect(r.features.lost).toEqual([]);
    expect(r.features.changed).toEqual([]);
    expect(r.usageLimits.changed).toEqual([]);
    expect(r.addOns.unchanged).toEqual(['extraStorage', 'prioritySuccess']);
    expect(r.features.unchanged).toEqual(['projects', 'collaboration', 'auditLog', 'customRoles']);
    expect(r.usageLimits.unchanged).toEqual(['storage']);
  });

  // [utest->req~compare-relation-current~1]
  it('is current when the after input only selects an add-on that reconciliation removes', () => {
    const before = Side(acme, { planId: 'starter' });
    const after = Side(acme, { planId: 'starter', addOns: { extraStorage: addOn(2) } });
    const r = cmp(before, after);
    expect(r.relation).toBe('current');
    expect(r.addOns).toEqual({
      added: [],
      removedByUser: [],
      removedByReconciliation: [],
      quantityChanged: [],
      unchanged: [],
    });
  });

  // [utest->req~compare-relation-current~1]
  it('is not current for the same plan and billing in another pricing version', () => {
    const r = cmp(Side(V1, M2()), Side(V2, M2()));
    expect(r.version.changed).toBe(true);
    expect(r.plan.changed).toBe(false);
    expect(r.relation).toBe('change');
  });

  // [utest->req~compare-relation-current~1]
  it('is not current when the billed quantity of an add-on differs', () => {
    const addOns = { extraStorage: addOn(3), prioritySuccess: addOn(1) };
    const r = cmp(Side(acme, C()), Side(acme, { planId: 'growth', addOns }));
    expect(r.addOns.quantityChanged).toHaveLength(1);
    expect(r.relation).toBe('change');
  });

  // [utest->req~compare-relation-current~1]
  it('is not current when one add-on is dropped', () => {
    const dropped = { planId: 'growth', addOns: { extraStorage: addOn(2) } };
    const r = cmp(Side(acme, C()), Side(acme, dropped));
    expect(ids(r.addOns.removedByUser)).toEqual(['prioritySuccess']);
    expect(r.relation).toBe('change');
  });

  // [utest->req~compare-relation-plan-order~1]
  it('calls Growth to Enterprise an upgrade although it costs less', () => {
    const r = cmp(Side(acme, C()), Side(acme, ENT()));
    expect(r.relation).toBe('upgrade');
    expect(r.price.difference).toBe(-5);
  });

  // [utest->req~compare-relation-plan-order~1]
  it('calls Growth to Starter a downgrade', () => {
    const r = cmp(Side(acme, C()), Side(acme, START()));
    expect(r.relation).toBe('downgrade');
  });

  // [utest->req~compare-relation-plan-order~1]
  it('compares plans across versions in the after pricing order', () => {
    const r = cmp(Side(V1, M2()), Side(V2, DIP()));
    expect(r.relation).toBe('upgrade');
  });

  // [utest->req~compare-relation-change~1]
  it('is change for the same plan with another billing period', () => {
    const r = cmp(Side(acme, C()), Side(acme, CY3()));
    expect(r.relation).toBe('change');
  });

  // [utest->req~compare-relation-change~1]
  it('is change for the same plan with another variable', () => {
    const edit = { ...C(), variables: { seats: 6 } };
    const r = cmp(Side(acme, C()), Side(acme, edit));
    expect(r.relation).toBe('change');
  });

  // [utest->req~compare-relation-change~1]
  it('is change when a plan is unknown', () => {
    const r = cmp(Side(acme, C()), Side(acme, { planId: 'legacy' }));
    expect(r.relation).toBe('change');
  });

  // [utest->req~compare-relation-change~1]
  it('is change when the before plan is not in the after version', () => {
    const withoutBasic = { ...V2, plans: V2.plans.filter((plan) => plan.id !== 'basic') };
    const r = cmp(Side(V1, { planId: 'basic' }), Side(withoutBasic, { planId: 'pro' }));
    expect(r.relation).toBe('change');
  });
});

describe('compareSelections add-ons', () => {
  // [utest->req~compare-addons-added~1]
  it('lists an add-on that exists only in the new version', () => {
    const r = cmp(Side(V1, M2()), Side(V2, DIP()));
    expect(r.addOns.added).toStrictEqual([
      { id: 'dedicatedIp', name: 'Dedicated Ip', quantity: 1, presence: 'after-only' },
    ]);
  });

  // [utest->req~compare-addons-added~1]
  it('lists Compliance when moving to Enterprise', () => {
    const r = cmp(Side(acme, C()), Side(acme, QUOTE()));
    expect(r.addOns.added).toStrictEqual([
      { id: 'compliance', name: 'Compliance', quantity: 1, presence: 'both' },
    ]);
  });

  // [utest->req~compare-addons-removed-by-user~1]
  it('lists Priority Success dropped for Compliance', () => {
    const r = cmp(Side(acme, C()), Side(acme, QUOTE()));
    expect(r.addOns.removedByUser).toStrictEqual([
      { id: 'prioritySuccess', name: 'Priority Success', quantity: 1, presence: 'both' },
    ]);
  });

  // [utest->req~compare-addons-removed-by-reconciliation~1]
  it('lists the add-ons that Starter does not offer', () => {
    const r = cmp(Side(acme, C()), Side(acme, START()));
    expect(r.addOns.removedByReconciliation).toStrictEqual([
      {
        id: 'extraStorage',
        name: 'Extra Storage',
        quantity: 2,
        presence: 'both',
        reason: 'unavailable-for-plan',
      },
      {
        id: 'prioritySuccess',
        name: 'Priority Success',
        quantity: 1,
        presence: 'both',
        reason: 'unavailable-for-plan',
      },
    ]);
    expect(r.addOns.removedByUser).toEqual([]);
  });

  // [utest->req~compare-addons-removed-by-reconciliation~1]
  it('tells an unavailable add-on from a dependent one', () => {
    const both = { dedicatedIp: addOn(1), ipWarmup: addOn(1) };
    const before = Side(V2, { planId: 'pro', addOns: both });
    const after = Side(V2, { planId: 'basic', addOns: both });
    const r = cmp(before, after);
    const pairs = r.addOns.removedByReconciliation.map((entry) => [entry.id, entry.reason]);
    expect(pairs).toEqual([
      ['dedicatedIp', 'unavailable-for-plan'],
      ['ipWarmup', 'dependency-removed'],
    ]);
    expect(r.relation).toBe('downgrade');
    expect(r.price.before.subtotal).toBe(53);
    expect(r.price.after.subtotal).toBe(12);
    expect(r.price.difference).toBe(-41);
  });

  // [utest->req~compare-addons-removed-by-reconciliation~1]
  it('reports an add-on that the after version does not offer', () => {
    const r = cmp(Side(V2, DIP()), Side(V1, DIP()));
    expect(r.addOns.removedByReconciliation).toStrictEqual([
      {
        id: 'dedicatedIp',
        name: 'Dedicated Ip',
        quantity: 1,
        presence: 'before-only',
        reason: 'not-in-version',
      },
    ]);
    expect(r.price.after.requiresQuote).toBe(false);
    expect(r.price.after.subtotal).toBe(30);
  });

  // [utest->req~compare-addons-quantity~1]
  it('lists two to three storage packs', () => {
    const r = cmp(Side(acme, C()), Side(acme, CY3()));
    expect(r.addOns.quantityChanged).toStrictEqual([
      { id: 'extraStorage', name: 'Extra Storage', before: 2, after: 3, delta: 1 },
    ]);
  });

  // [utest->req~compare-addons-quantity~1]
  it('compares the billed quantity above the maximum', () => {
    const addOns = { extraStorage: addOn(25), prioritySuccess: addOn(1) };
    const r = cmp(Side(acme, C()), Side(acme, { planId: 'growth', addOns }));
    const entry = r.addOns.quantityChanged.find((change) => change.id === 'extraStorage');
    expect(entry?.after).toBe(10);
    expect(entry?.delta).toBe(8);
  });

  // [utest->req~compare-addons-unchanged~1]
  it('keeps Priority Success unchanged when only the billing period changes', () => {
    const r = cmp(Side(acme, C()), Side(acme, CY3()));
    expect(r.addOns.unchanged).toEqual(['prioritySuccess']);
  });

  // [utest->req~compare-item-presence~1]
  it('sets presence on add-on entries across versions', () => {
    const r = cmp(Side(V1, M2()), Side(V2, DIP()));
    const added = r.addOns.added.find((entry) => entry.id === 'dedicatedIp');
    const removed = r.addOns.removedByUser.find((entry) => entry.id === 'extraEmails');
    expect(added?.presence).toBe('after-only');
    expect(removed?.presence).toBe('both');
  });

  // [utest->req~compare-order~1]
  it('puts the ids that only the before pricing defines after the others', () => {
    const addOns = { ipWarmup: addOn(1), dedicatedIp: addOn(1), extraEmails: addOn(1) };
    const r = cmp(Side(V2, { planId: 'pro', addOns }), Side(V1, { planId: 'pro' }));
    expect(ids(r.addOns.removedByUser)).toEqual(['extraEmails', 'dedicatedIp', 'ipWarmup']);
  });

  // [utest->req~compare-order~1]
  it('gives the same result whatever the key order of the input', () => {
    const reversed = {
      planId: 'growth',
      addOns: { prioritySuccess: addOn(1), extraStorage: addOn(2) },
    };
    const first = cmp(Side(acme, C()), Side(acme, START()));
    const second = cmp(Side(acme, C()), Side(acme, START()));
    const third = cmp(Side(acme, reversed), Side(acme, START()));
    expect(second).toEqual(first);
    expect(third).toEqual(first);
  });
});

describe('compareSelections selections', () => {
  // [utest->req~compare-selections-output~1]
  it('returns the reconciled after selection for a downgrade', () => {
    const r = cmp(Side(acme, C()), Side(acme, START()));
    expect(r.selections.after.planId).toBe('starter');
    expect(r.selections.after.billingPeriod).toBe('monthly');
    expect(r.selections.after.addOns).toStrictEqual({
      extraStorage: { selected: false, quantity: 2 },
      prioritySuccess: { selected: false, quantity: 1 },
    });
  });

  // [utest->req~compare-selections-output~1]
  it('keeps billed quantities and drops an unknown add-on', () => {
    const edit = { planId: 'growth', addOns: { ghost: addOn(1), extraStorage: addOn(25) } };
    const r = cmp(Side(acme, C()), Side(acme, edit));
    expect(r.selections.after.addOns).toStrictEqual({
      extraStorage: { selected: true, quantity: 10 },
    });
  });
});
