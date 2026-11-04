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

// KNOWN LIMITATION (docs/react.md, 'Known limitation: hydration of the element'). Lit renders the
// element's light DOM before React hydrates, so React reports a recoverable mismatch and
// regenerates the host node. Only hydration inside flushSync, before Lit's microtask, is clean.
// The measured harness uses all four render props (default slots).
// The follow-up change 'wrapper SSR hydration fix' flips the 1 entries to 0, and the host
// expectation to kept. Do not 'fix' this test, fix the wrapper.
//
// Measured on PR 91 (same in chromium, firefox and webkit, default slots). after/sync was
// measured by this spec in CI: 0 recoverable errors, host node kept, like before/sync, because
// Lit renders in a microtask after the definition.
const EXPECTED_RECOVERABLE: Record<`${Define}/${Hydrate}`, number> = {
  'before/update': 1,
  'before/task': 1,
  'before/sync': 0,
  'after/update': 1,
  'after/task': 1,
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
});
