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
};

// KNOWN LIMITATION (docs/react.md, 'Order: element upgrade, hydration...'). Lit renders the
// element's light DOM before React hydrates, so React reports a recoverable mismatch and
// regenerates the host node. Only hydration inside flushSync, before Lit's microtask, is clean.
// The follow-up change 'wrapper SSR hydration fix' flips the 1 entries to 0, and the host
// expectation to kept. Do not 'fix' this test, fix the wrapper.
//
// Measured by CI probes on PR 91 (same in chromium, firefox and webkit, default slots).
// after/sync was not observed (the probe log was truncated): it is expected, to be confirmed by
// CI, to behave like before/sync, because Lit renders in a microtask after the definition.
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

      // hydrateRoot has run; a short settle lets React report its recoverable errors.
      await page.waitForFunction(
        () => (window as unknown as { __lateHydrateCalled?: boolean }).__lateHydrateCalled === true,
      );
      await page.waitForTimeout(300);

      const seen = await page.evaluate(() => {
        const store = window as unknown as LateStore;
        return {
          recoverable: store.__recoverable ?? [],
          hostKept: document.querySelector('pricing-renderer') === store.__lateHost,
        };
      });

      const expected = EXPECTED_RECOVERABLE[`${define}/${hydrate}`];
      expect(seen.recoverable).toHaveLength(expected);
      if (expected > 0) {
        expect(seen.recoverable[0]).toContain('Hydration failed');
      }
      // The host node is regenerated exactly when React reported the mismatch.
      expect(seen.hostKept).toBe(expected === 0);
    });
  }
});
