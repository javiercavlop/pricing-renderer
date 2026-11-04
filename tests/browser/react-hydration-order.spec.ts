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
  __lateBefore?: { childCount: number; innerHTML: string };
  __lateCommits?: number;
  __lateHost?: Element | null;
};

const RADIOS = '#root input[type="radio"][name$="-plan"]';
const CTAS = '#root [data-testid^="cta-"]';
const SUMMARY = '#root [data-testid="summary"]';

async function open(page: Page, define: Define, hydrate: Hydrate, slots?: 'none'): Promise<void> {
  const extra = slots === undefined ? '' : `&slots=${slots}`;
  const query = `mode=hydrate-late&define=${define}&hydrate=${hydrate}${extra}`;
  await page.goto(`/react-slots.html?${query}`);
}

test.describe('hydration order of the element and React', () => {
  for (const { define, hydrate } of ORDERINGS) {
    test(`define ${define}, hydrate ${hydrate}: the final DOM is complete`, async ({ page }) => {
      await open(page, define, hydrate);
      await expect(page.locator(RADIOS)).toHaveCount(3);
      await expect(page.locator('#root pricing-renderer')).toHaveCount(1);
      await expect(page.locator(CTAS)).toHaveCount(3);
      await expect(page.locator(SUMMARY)).toHaveCount(1);
    });
  }

  // Temporary: it prints the facts of every ordering in the CI log by failing on purpose. The lead
  // replaces it by assertions after reading the CI output.
  test('probe: facts per ordering', async ({ page }) => {
    test.setTimeout(180_000);
    const facts: Record<string, unknown>[] = [];
    for (const slots of ['default', 'none'] as const) {
      for (const { define, hydrate } of ORDERINGS) {
        await open(page, define, hydrate, slots === 'none' ? 'none' : undefined);
        // Bounded, so an ordering that never renders is recorded with radios: 0.
        await page.waitForSelector(RADIOS, { timeout: 8_000 }).catch(() => undefined);
        await page.waitForTimeout(500);
        const seen = await page.evaluate(() => {
          const store = window as unknown as LateStore;
          return {
            recoverable: store.__recoverable ?? [],
            childCountBefore: store.__lateBefore?.childCount,
            commits: store.__lateCommits,
            hostKept: document.querySelector('pricing-renderer') === store.__lateHost,
          };
        });
        const { recoverable, ...rest } = seen;
        const row = {
          define,
          hydrate,
          slots,
          ...rest,
          radios: await page.locator(RADIOS).count(),
          ctas: await page.locator(CTAS).count(),
          actions: await page.locator(SUMMARY).count(),
          recoverableCount: recoverable.length,
          recoverableTail: recoverable.map((message) =>
            message.slice(-260).replace(/\r?\n/g, ' | '),
          ),
        };
        console.log('PROBE-ROW ' + JSON.stringify(row));
        facts.push(row);
      }
    }
    throw new Error('PROBE ' + JSON.stringify(facts));
  });
});
