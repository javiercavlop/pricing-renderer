import { describe, expect, it } from 'vitest';
import { createPricingViewModel } from '../../src/core/index.js';
import { parsePricingYaml } from '../../src/yaml/index.js';
import {
  buildStressYaml,
  stressFixtures,
  type StressCounts,
  type StressShape,
} from '../fixtures/stress/build.js';

// The synthetic stress pricings of tests/fixtures/stress parse with the renderer's own parser and
// have the counts the UX stress spec (tests/browser/ux-stress.spec.ts) relies on.

// The extreme each shape reproduces, as the owner request declares it. Counts that the request does
// not fix are left out and only checked against the builder.
const declared: Record<StressShape, Partial<StressCounts>> = {
  okta: { plans: 0, features: 140, addOns: 18 },
  zoom: { features: 143, addOns: 16 },
  clickup: { features: 136, usageLimits: 38 },
  webflow: { plans: 15 },
  salesforce: { addOns: 14 },
  github: { addOns: 14 },
};

describe('UX stress fixtures', () => {
  it('covers every shape in both currencies and both billing periods', () => {
    expect(stressFixtures).toHaveLength(24);
    expect(new Set(stressFixtures.map((fixture) => fixture.id)).size).toBe(24);
    for (const shape of Object.keys(declared)) {
      const own = stressFixtures.filter((fixture) => fixture.shape === shape);
      const variants = own.map((fixture) => `${fixture.currency}/${fixture.period}`).sort();
      expect(variants, shape).toEqual(['EUR/annual', 'EUR/monthly', 'USD/annual', 'USD/monthly']);
    }
  });

  it('builds the same document every time', () => {
    for (const fixture of stressFixtures) {
      expect(buildStressYaml(fixture), fixture.id).toBe(buildStressYaml(fixture));
    }
  });

  for (const fixture of stressFixtures) {
    describe(fixture.id, () => {
      const source = buildStressYaml(fixture);
      const parsed = parsePricingYaml(source);

      it('parses without errors', () => {
        expect(parsed.ok).toBe(true);
        expect(parsed.value).toBeDefined();
        // A pricing without plans is the only expected warning.
        const codes = parsed.diagnostics.map((item) => item.code);
        expect(codes).toEqual(fixture.counts.plans === 0 ? ['PR_PLANS_EMPTY'] : []);
      });

      it('has the declared counts', () => {
        const pricing = parsed.value!;
        expect({
          plans: pricing.plans.length,
          features: pricing.features.length,
          usageLimits: pricing.usageLimits.length,
          addOns: pricing.addOns.length,
        }).toEqual(fixture.counts);
        for (const [key, count] of Object.entries(declared[fixture.shape])) {
          expect(fixture.counts[key as keyof StressCounts], key).toBe(count);
        }
      });

      it('uses the declared currency and starts on the declared billing period', () => {
        const pricing = parsed.value!;
        expect(pricing.metadata.currency).toBe(fixture.currency);
        expect(pricing.billing.map((period) => period.id).sort()).toEqual(['annual', 'monthly']);
        const viewModel = createPricingViewModel(pricing);
        expect(viewModel.resolved.selection.billingPeriod).toBe(fixture.period);
      });

      it('has long realistic texts', () => {
        const pricing = parsed.value!;
        const longest = (texts: Array<string | undefined>) =>
          Math.max(...texts.map((text) => text?.length ?? 0));
        expect(longest(pricing.features.map((item) => item.description))).toBeGreaterThan(150);
        expect(longest(pricing.addOns.map((item) => item.description))).toBeGreaterThan(100);
        if (pricing.plans.length > 0) {
          expect(longest(pricing.plans.map((item) => item.description))).toBeGreaterThan(100);
        }
      });

      it('has consistent references and one comparison row per feature and usage limit', () => {
        const pricing = parsed.value!;
        const planIds = new Set(pricing.plans.map((plan) => plan.id));
        const addOnIds = new Set(pricing.addOns.map((addOn) => addOn.id));
        for (const addOn of pricing.addOns) {
          for (const id of addOn.availableFor) expect(planIds.has(id), id).toBe(true);
          for (const id of [...addOn.dependsOn, ...addOn.excludes]) {
            expect(addOnIds.has(id), id).toBe(true);
          }
        }
        const viewModel = createPricingViewModel(pricing);
        let rows = 0;
        for (const group of viewModel.comparisonGroups) rows += group.rows.length;
        expect(rows).toBe(fixture.counts.features + fixture.counts.usageLimits);
        expect(viewModel.plans).toHaveLength(fixture.counts.plans);
        expect(viewModel.addOns).toHaveLength(fixture.counts.addOns);
      });
    });
  }
});
