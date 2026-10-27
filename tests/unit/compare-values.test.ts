import { describe, expect, it } from 'vitest';
import {
  C,
  CY3,
  ENT,
  F,
  M2,
  START,
  Side,
  V1,
  V2,
  acme,
  addOn,
  cmp,
  makeF,
} from './helpers/compare-fixtures.js';
import { compareSelections } from '../../src/core/index.js';
import type { SelectionComparison, SelectionComparisonSide } from '../../src/core/index.js';

type Raw = Record<string, unknown>;
type RawPlans = Record<string, { features?: Raw; usageLimits?: Raw }>;

const seats = (r: SelectionComparison) => r.usageLimits.changed.find((c) => c.id === 'seats');
const storage = (r: SelectionComparison) => r.usageLimits.changed.find((c) => c.id === 'storage');
const pack = (quantity: number) => ({ seatPack: addOn(quantity) });

/** F without a default for `seats` and without a `base` plan limit. */
function makeBare() {
  return makeF((raw) => {
    delete (raw.usageLimits as Record<string, Raw>).seats!.defaultValue;
    delete (raw.plans as RawPlans).base!.usageLimits;
  });
}

function withCurrentUsage(
  before: SelectionComparisonSide,
  after: SelectionComparisonSide,
  currentUsage: Record<string, number>,
) {
  return compareSelections({ before, after, currentUsage });
}

describe('compareSelections effective feature values', () => {
  // [utest->req~compare-effective-features~1]
  it('lets an add-on grant a feature', () => {
    const before = Side(F, { planId: 'base' });
    const after = Side(F, { planId: 'base', addOns: { ssoPack: addOn(1) } });
    expect(cmp(before, after).features.gained).toStrictEqual([
      {
        id: 'sso',
        name: 'Sso',
        before: { kind: 'boolean', value: false },
        after: { kind: 'boolean', value: true },
        presence: 'both',
      },
    ]);
  });

  // [utest->req~compare-effective-features~1]
  it('lets the plan value replace the default', () => {
    const r = cmp(Side(acme, C()), Side(acme, ENT()));
    expect(r.features.gained).toStrictEqual([
      {
        id: 'customRoles',
        name: 'Custom Roles',
        before: { kind: 'boolean', value: false },
        after: { kind: 'boolean', value: true },
        presence: 'both',
      },
    ]);
  });

  // [utest->req~compare-effective-features~1]
  it('uses the default for an unknown plan', () => {
    const r = cmp(Side(acme, { planId: 'legacy' }), Side(acme, C()));
    const gained = r.features.gained.map((entry) => entry.id);
    expect(gained).toEqual(['projects', 'collaboration', 'auditLog']);
  });
});

describe('compareSelections feature classes', () => {
  // [utest->req~compare-features~1]
  it('reports the audit log lost on Starter', () => {
    const r = cmp(Side(acme, C()), Side(acme, START()));
    expect(r.features.lost).toHaveLength(1);
    expect(r.features.lost[0]).toMatchObject({
      id: 'auditLog',
      before: { kind: 'boolean', value: true },
      after: { kind: 'boolean', value: false },
    });
    expect(r.features.unchanged).toEqual(['projects', 'collaboration', 'customRoles']);
  });

  // [utest->req~compare-features~1]
  it('reports a feature removed in the new version', () => {
    const r = cmp(Side(V1, M2()), Side(V2, M2()));
    expect(r.features.lost).toStrictEqual([
      {
        id: 'legacyExport',
        name: 'Legacy Export',
        before: { kind: 'boolean', value: true },
        after: { kind: 'none' },
        presence: 'before-only',
      },
    ]);
    expect(r.features.unchanged).toEqual(['api']);
  });

  // [utest->req~compare-features~1]
  it('treats null and false as no capability', () => {
    const r = cmp(Side(F, { planId: 'base' }), Side(F, { planId: 'team' }));
    expect(r.features.unchanged).toEqual(['sso']);
  });

  // [utest->req~compare-features~1]
  it('treats number 0 and text empty as no capability', () => {
    const zeroAndEmpty = makeF((raw) => {
      const plans = raw.plans as RawPlans;
      plans.base!.features = { sso: { value: 0 } };
      plans.team!.features = { sso: { value: '' } };
    });
    const r = cmp(Side(zeroAndEmpty, { planId: 'base' }), Side(zeroAndEmpty, { planId: 'team' }));
    expect(r.features.unchanged).toEqual(['sso']);
    expect(r.features.gained).toEqual([]);
    expect(r.features.lost).toEqual([]);
    expect(r.features.changed).toEqual([]);
    const teamSide = Side(zeroAndEmpty, { planId: 'team' });
    const back = cmp(teamSide, Side(zeroAndEmpty, { planId: 'base' }));
    expect(back.features.unchanged).toEqual(['sso']);
  });

  // [utest->req~compare-effective-features~1]
  it('applies two add-ons that define the same feature in declaration order', () => {
    const twoPacks = makeF((raw) => {
      const addOns = raw.addOns as Record<string, Raw>;
      addOns.ssoPlus = { price: 1, features: { sso: { value: 'plus' } } };
    });
    const selected = { ssoPlus: addOn(1), ssoPack: addOn(1) };
    const r = cmp(
      Side(twoPacks, { planId: 'base' }),
      Side(twoPacks, { planId: 'base', addOns: selected }),
    );
    expect(r.features.gained).toHaveLength(1);
    expect(r.features.gained[0]?.after).toStrictEqual({ kind: 'text', value: 'plus' });
    const onlyFirst = cmp(
      Side(twoPacks, { planId: 'base' }),
      Side(twoPacks, { planId: 'base', addOns: { ssoPack: addOn(1) } }),
    );
    expect(onlyFirst.features.gained[0]?.after).toStrictEqual({ kind: 'boolean', value: true });
  });

  // [utest->req~compare-features~1]
  it('puts a feature with two different capable values in changed', () => {
    const text = makeF((raw) => {
      const plans = raw.plans as RawPlans;
      plans.base!.features = { sso: { value: 'basic' } };
      plans.team!.features = { sso: { value: 'advanced' } };
    });
    const r = cmp(Side(text, { planId: 'base' }), Side(text, { planId: 'team' }));
    expect(r.features.changed).toStrictEqual([
      {
        id: 'sso',
        name: 'Sso',
        before: { kind: 'text', value: 'basic' },
        after: { kind: 'text', value: 'advanced' },
        presence: 'both',
      },
    ]);
  });
});

describe('compareSelections effective usage limits', () => {
  // [utest->req~compare-effective-limits~1]
  it('takes the plan values', () => {
    const r = cmp(Side(acme, { planId: 'starter' }), Side(acme, { planId: 'growth' }));
    expect(storage(r)?.before).toStrictEqual({ kind: 'number', value: 10 });
    expect(storage(r)?.after).toStrictEqual({ kind: 'number', value: 100 });
  });

  // [utest->req~compare-effective-limits~1]
  it('lets an add-on override the plan value', () => {
    const before = Side(F, { planId: 'base' });
    const after = Side(F, { planId: 'base', addOns: { unlimitedSeats: addOn(1) } });
    const r = cmp(before, after);
    expect(seats(r)?.before).toStrictEqual({ kind: 'number', value: 5 });
    expect(seats(r)?.after).toStrictEqual({ kind: 'unlimited' });
  });

  // [utest->req~compare-effective-limits~1]
  it('uses the default for an unknown plan', () => {
    const r = cmp(Side(F, { planId: 'legacy' }), Side(F, { planId: 'base' }));
    expect(seats(r)?.before).toStrictEqual({ kind: 'number', value: 3 });
  });
});

describe('compareSelections usage-limit extensions', () => {
  // [utest->req~compare-limit-extensions~1]
  it('extends the plan limit with the storage packs', () => {
    const r = cmp(Side(acme, C()), Side(acme, CY3()));
    expect(r.usageLimits.changed).toStrictEqual([
      {
        id: 'storage',
        name: 'Storage',
        unit: 'GB',
        before: { kind: 'number', value: 200 },
        after: { kind: 'number', value: 250 },
        delta: 50,
        direction: 'increased',
        presence: 'both',
      },
    ]);
  });

  // [utest->req~compare-limit-extensions~1]
  it('applies an extension, then an override in declaration order', () => {
    const base = Side(F, { planId: 'base' });
    const extended = Side(F, { planId: 'base', addOns: pack(3) });
    const first = cmp(base, extended);
    expect(seats(first)).toMatchObject({
      before: { kind: 'number', value: 5 },
      after: { kind: 'number', value: 20 },
      delta: 15,
    });
    const overridden = Side(F, {
      planId: 'base',
      addOns: { ...pack(3), unlimitedSeats: addOn(1) },
    });
    const second = cmp(extended, overridden);
    expect(seats(second)).toMatchObject({
      before: { kind: 'number', value: 20 },
      after: { kind: 'unlimited' },
    });
    expect('delta' in seats(second)!).toBe(false);
  });

  // [utest->req~compare-limit-extensions~1]
  it('keeps an unlimited plan limit unlimited', () => {
    const before = Side(F, { planId: 'team' });
    const after = Side(F, { planId: 'team', addOns: { seatPack: addOn(2) } });
    expect(cmp(before, after).usageLimits.unchanged).toEqual(['seats']);
  });

  // [utest->req~compare-limit-extensions~1]
  it('counts a missing limit as 0 before the extension', () => {
    const bare = makeBare();
    const before = Side(bare, { planId: 'base' });
    const after = Side(bare, { planId: 'base', addOns: pack(2) });
    const r = cmp(before, after);
    expect(seats(r)).toMatchObject({
      before: { kind: 'none' },
      after: { kind: 'number', value: 10 },
      direction: 'increased',
    });
    expect('delta' in seats(r)!).toBe(false);
  });
});

describe('compareSelections unlimited values', () => {
  // [utest->req~compare-limit-unlimited~1]
  it('shows Enterprise storage as unlimited', () => {
    const r = cmp(Side(acme, C()), Side(acme, ENT()));
    expect(r.usageLimits.changed).toStrictEqual([
      {
        id: 'storage',
        name: 'Storage',
        unit: 'GB',
        before: { kind: 'number', value: 200 },
        after: { kind: 'unlimited' },
        direction: 'increased',
        presence: 'both',
      },
    ]);
  });

  // [utest->req~compare-limit-unlimited~1]
  it('reads every unlimited spelling as unlimited', () => {
    const spellings = [null, '.inf', 'Infinity', 'unlimited', Number.POSITIVE_INFINITY];
    for (const spelling of spellings) {
      const pricing = makeF((raw) => {
        const plans = raw.plans as RawPlans;
        plans.team!.usageLimits = { seats: { value: spelling } };
      });
      const r = cmp(Side(pricing, { planId: 'base' }), Side(pricing, { planId: 'team' }));
      expect(r.usageLimits.changed).toHaveLength(1);
      expect(seats(r)?.after).toStrictEqual({ kind: 'unlimited' });
      expect(seats(r)?.direction).toBe('increased');
      expect('delta' in seats(r)!).toBe(false);
    }
  });
});

describe('compareSelections usage-limit changes', () => {
  // [utest->req~compare-limits~1]
  it('reports the storage decrease of a downgrade', () => {
    const r = cmp(Side(acme, C()), Side(acme, START()));
    expect(storage(r)).toMatchObject({
      before: { kind: 'number', value: 200 },
      after: { kind: 'number', value: 10 },
      delta: -190,
      direction: 'decreased',
    });
  });

  // [utest->req~compare-limits~1]
  it('reports a limit lowered in the new version', () => {
    const r = cmp(Side(V1, M2()), Side(V2, M2()));
    expect(r.usageLimits.changed).toStrictEqual([
      {
        id: 'emails',
        name: 'Emails',
        unit: 'email',
        before: { kind: 'number', value: 2000 },
        after: { kind: 'number', value: 1800 },
        delta: -200,
        direction: 'decreased',
        presence: 'both',
      },
    ]);
  });

  // [utest->req~compare-limits~1]
  it('uses direction changed for a text value', () => {
    const text = makeF((raw) => {
      const plans = raw.plans as RawPlans;
      plans.team!.usageLimits = { seats: { value: 'custom' } };
    });
    const r = cmp(Side(text, { planId: 'base' }), Side(text, { planId: 'team' }));
    expect(seats(r)).toMatchObject({
      after: { kind: 'text', value: 'custom' },
      direction: 'changed',
    });
    expect('delta' in seats(r)!).toBe(false);
  });
});

describe('compareSelections limit direction', () => {
  // [utest->req~compare-limits~1]
  it('orders unlimited above a number and a number above none', () => {
    const toUnlimited = cmp(Side(F, { planId: 'base' }), Side(F, { planId: 'team' }));
    expect(seats(toUnlimited)?.direction).toBe('increased');
    const fromUnlimited = cmp(Side(F, { planId: 'team' }), Side(F, { planId: 'base' }));
    expect(seats(fromUnlimited)).toMatchObject({
      before: { kind: 'unlimited' },
      after: { kind: 'number', value: 5 },
      direction: 'decreased',
    });
    expect('delta' in seats(fromUnlimited)!).toBe(false);
    const toNone = cmp(Side(F, { planId: 'base' }), Side(makeBare(), { planId: 'base' }));
    expect(seats(toNone)).toMatchObject({
      before: { kind: 'number', value: 5 },
      after: { kind: 'none' },
      direction: 'decreased',
    });
    expect('delta' in seats(toNone)!).toBe(false);
  });

  // [utest->req~compare-limits~1]
  it('uses direction changed for a boolean or json value', () => {
    for (const value of [true, { tier: 'gold' }]) {
      const pricing = makeF((raw) => {
        (raw.plans as RawPlans).team!.usageLimits = { seats: { value } };
      });
      const r = cmp(Side(pricing, { planId: 'base' }), Side(pricing, { planId: 'team' }));
      expect(seats(r)?.direction).toBe('changed');
      expect('delta' in seats(r)!).toBe(false);
    }
  });
});

describe('compareSelections current usage', () => {
  // [utest->req~compare-current-usage~1]
  it('flags a downgrade below consumption', () => {
    const r = withCurrentUsage(Side(acme, C()), Side(acme, START()), { storage: 150 });
    expect(r.usageLimits.exceeded).toEqual(['storage']);
  });

  // [utest->req~compare-current-usage~1]
  it('flags a new version below consumption', () => {
    const r = withCurrentUsage(Side(V1, M2()), Side(V2, M2()), { emails: 1900 });
    expect(r.usageLimits.exceeded).toEqual(['emails']);
  });

  // [utest->req~compare-current-usage~1] [utest->req~compare-current-usage-entry~1]
  it('does not flag a consumed amount equal to the after limit', () => {
    const r = withCurrentUsage(Side(acme, C()), Side(acme, START()), { storage: 10 });
    expect(r.usageLimits.exceeded).toEqual([]);
    expect(storage(r)?.currentUsage).toBe(10);
    expect('exceedsCurrentUsage' in storage(r)!).toBe(false);
  });

  // [utest->req~compare-current-usage~1] [utest->req~compare-current-usage-entry~1]
  it('flags a consumed amount one above the after limit', () => {
    const r = withCurrentUsage(Side(acme, C()), Side(acme, START()), { storage: 11 });
    expect(r.usageLimits.exceeded).toEqual(['storage']);
    expect(storage(r)?.currentUsage).toBe(11);
    expect(storage(r)?.exceedsCurrentUsage).toBe(true);
  });

  // [utest->req~compare-current-usage~1]
  it('reads the usage of an id that only one of the two pricings defines', () => {
    const withApi = makeF((raw) => {
      (raw.usageLimits as Record<string, Raw>).api = {
        valueType: 'NUMERIC',
        defaultValue: 0,
        unit: 'call',
      };
      (raw.plans as RawPlans).base!.usageLimits = { seats: { value: 5 }, api: { value: 100 } };
    });
    const withoutApi = Side(F, { planId: 'base' });
    const apiSide = Side(withApi, { planId: 'base' });
    const api = (r: SelectionComparison) =>
      r.usageLimits.changed.find((entry) => entry.id === 'api');

    const removed = withCurrentUsage(apiSide, withoutApi, { api: 5 });
    expect(removed.usageLimits.exceeded).toEqual(['api']);
    expect(api(removed)).toMatchObject({
      presence: 'before-only',
      after: { kind: 'none' },
      currentUsage: 5,
      exceedsCurrentUsage: true,
    });
    const fits = withCurrentUsage(withoutApi, apiSide, { api: 100 });
    const tooMuch = withCurrentUsage(withoutApi, apiSide, { api: 101 });
    expect(fits.usageLimits.exceeded).toEqual([]);
    expect(tooMuch.usageLimits.exceeded).toEqual(['api']);
    expect(api(fits)).toMatchObject({ presence: 'after-only', currentUsage: 100 });
  });

  // [utest->req~compare-current-usage~1]
  it('flags a limit that is unchanged and already exceeded', () => {
    const r = withCurrentUsage(Side(acme, C()), Side(acme, C()), { storage: 250 });
    expect(r.usageLimits.unchanged).toEqual(['storage']);
    expect(r.usageLimits.exceeded).toEqual(['storage']);
  });

  // [utest->req~compare-current-usage~1]
  it('does not flag unlimited or sufficient limits', () => {
    const toEnterprise = withCurrentUsage(Side(acme, C()), Side(acme, ENT()), { storage: 150 });
    const toYearly = withCurrentUsage(Side(acme, C()), Side(acme, CY3()), { storage: 150 });
    expect(toEnterprise.usageLimits.exceeded).toEqual([]);
    expect(toYearly.usageLimits.exceeded).toEqual([]);
  });

  // [utest->req~compare-current-usage~1]
  it('flags a consumed amount above 0 when the after value is none', () => {
    const before = Side(F, { planId: 'base' });
    const after = Side(makeBare(), { planId: 'base' });
    const consumed = withCurrentUsage(before, after, { seats: 1 });
    const none = withCurrentUsage(before, after, { seats: 0 });
    expect(consumed.usageLimits.exceeded).toEqual(['seats']);
    expect(none.usageLimits.exceeded).toEqual([]);
  });

  // [utest->req~compare-current-usage-entry~1]
  it('sets currentUsage and the flag on a flagged change', () => {
    const r = withCurrentUsage(Side(acme, C()), Side(acme, START()), { storage: 150 });
    expect(storage(r)?.currentUsage).toBe(150);
    expect(storage(r)?.exceedsCurrentUsage).toBe(true);
  });

  // [utest->req~compare-current-usage-entry~1]
  it('sets currentUsage without the flag on a change that fits', () => {
    for (const edit of [ENT(), CY3()]) {
      const r = withCurrentUsage(Side(acme, C()), Side(acme, edit), { storage: 150 });
      expect(storage(r)?.currentUsage).toBe(150);
      expect('exceedsCurrentUsage' in storage(r)!).toBe(false);
    }
  });
});
