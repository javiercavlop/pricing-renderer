import { expect, test, type Page } from '@playwright/test';

// Hydration order of <pricing-renderer> (PR 91, R1-REV-002). The page is
// examples/vanilla/react-slots.html in mode=hydrate-late: the server HTML is set, then hydrateRoot
// runs at a point `hydrate` picks (after the element's first update, in a later task, or inside
// flushSync), with the element defined before or after the server HTML is set (`define`).

type Define = 'before' | 'after';
type Hydrate = 'update' | 'task' | 'sync';

const DEFINES: Define[] = ['before', 'after'];
const HYDRATES: Hydrate[] = ['update', 'task', 'sync'];
const ORDERINGS = DEFINES.flatMap((define) => HYDRATES.map((hydrate) => ({ define, hydrate })));

type LateStore = {
  __recoverable?: string[];
  __lateHost?: Element | null;
  __lateBefore?: { childCount: number; innerHTML: string };
  __lateCommits?: number;
  __lateHydrateCalled?: boolean;
  __lateDefinedAtHtml?: boolean;
};

// The wrapper makes the host opaque to React's hydration, so every order is clean: no recoverable
// error and the host node is kept, whether the element rendered its light DOM before React
// hydrated or not. The harness uses all four render props (default slots).
const EXPECTED_RECOVERABLE: Record<`${Define}/${Hydrate}`, number> = {
  'before/update': 0,
  'before/task': 0,
  'before/sync': 0,
  'after/update': 0,
  'after/task': 0,
  'after/sync': 0,
};

const RADIOS = '#root input[type="radio"][name$="-plan"]';
const CTAS = '#root [data-testid^="cta-"]';
const SUMMARY = '#root [data-testid="summary"]';

async function open(page: Page, define: Define, hydrate: Hydrate): Promise<void> {
  await page.goto(`/react-slots.html?mode=hydrate-late&define=${define}&hydrate=${hydrate}`);
}

test.describe('hydration order of the element and React', () => {
  for (const { define, hydrate } of ORDERINGS) {
    test(`define ${define}, hydrate ${hydrate}: the final DOM is complete`, async ({ page }) => {
      await open(page, define, hydrate);
      await expect(page.locator(RADIOS)).toHaveCount(3);
      await expect(page.locator('#root pricing-renderer')).toHaveCount(1);
      await expect(page.locator(CTAS)).toHaveCount(3);
      await expect(page.locator(SUMMARY)).toHaveCount(1);

      const expected = EXPECTED_RECOVERABLE[`${define}/${hydrate}`];

      // hydrateRoot has run and the sibling probe has committed.
      await page.waitForFunction(() => {
        const store = window as unknown as LateStore;
        return store.__lateHydrateCalled === true && (store.__lateCommits ?? 0) >= 1;
      });
      // React reports a recoverable error during that commit: wait for it, bounded.
      if (expected > 0) {
        await page.waitForFunction(
          () => ((window as unknown as LateStore).__recoverable ?? []).length > 0,
          undefined,
          { timeout: 5000 },
        );
      }
      // With 0 expected errors there is no signal to wait for; a short settle after the commit
      // lets a late error show up, so a regression is still caught.
      await page.waitForTimeout(100);

      const seen = await page.evaluate(() => {
        const store = window as unknown as LateStore;
        return {
          recoverable: store.__recoverable ?? [],
          hostKept: document.querySelector('pricing-renderer') === store.__lateHost,
          beforeChildCount: store.__lateBefore?.childCount,
          definedAtHtml: store.__lateDefinedAtHtml,
        };
      });

      // Preconditions of the hazard; they hold before and after the wrapper fix, so a green row
      // means 'fixed', not 'the harness stopped reproducing the order'.
      expect(seen.definedAtHtml).toBe(define === 'before');
      if (hydrate === 'sync') {
        expect(seen.beforeChildCount).toBe(0);
      } else {
        expect(seen.beforeChildCount).toBeGreaterThan(0);
      }

      expect(seen.recoverable).toHaveLength(expected);
      if (expected > 0) {
        expect(seen.recoverable[0]).toContain('Hydration failed');
      }
      // The host node is regenerated exactly when React reported the mismatch.
      expect(seen.hostKept).toBe(expected === 0);
    });
  }

  test('define before, hydrate task, no render props: clean hydration, host kept', async ({
    page,
  }) => {
    await page.goto('/react-slots.html?mode=hydrate-late&define=before&hydrate=task&slots=none');
    await expect(page.locator(RADIOS)).toHaveCount(3);
    await expect(page.locator('#root pricing-renderer')).toHaveCount(1);
    await page.waitForFunction(() => {
      const store = window as unknown as LateStore;
      return store.__lateHydrateCalled === true && (store.__lateCommits ?? 0) >= 1;
    });
    await page.waitForTimeout(100);

    const seen = await page.evaluate(() => {
      const store = window as unknown as LateStore;
      return {
        recoverable: store.__recoverable ?? [],
        hostKept: document.querySelector('pricing-renderer') === store.__lateHost,
        beforeChildCount: store.__lateBefore?.childCount,
        definedAtHtml: store.__lateDefinedAtHtml,
      };
    });
    // The element rendered before React hydrated, as in the rows above.
    expect(seen.definedAtHtml).toBe(true);
    expect(seen.beforeChildCount).toBeGreaterThan(0);
    expect(seen.recoverable).toHaveLength(0);
    expect(seen.hostKept).toBe(true);
  });
});
