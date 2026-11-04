import { expect, test, type Page } from '@playwright/test';

// Hydration order of <pricing-renderer> and <pricing-change-review> (PR 91, R1-REV-002). The page
// is examples/vanilla/react-slots.html in mode=hydrate-late: the server HTML is set, then
// hydrateRoot runs at a point `hydrate` picks (after the element's first update, in a later task,
// or inside flushSync), with the element defined before or after the server HTML is set
// (`define`). `wrapper=review` mounts <PricingChangeReview> and `wrapper=raw` a bare element.

type Define = 'before' | 'after';
type Hydrate = 'update' | 'task' | 'sync';

const DEFINES: Define[] = ['before', 'after'];
const HYDRATES: Hydrate[] = ['update', 'task', 'sync'];
const ORDERINGS = DEFINES.flatMap((define) => HYDRATES.map((hydrate) => ({ define, hydrate })));

type LateStore = {
  __recoverable?: string[];
  __lateHost?: Element | null;
  __lateConfirm?: Element | null;
  __lateBefore?: { childCount: number; innerHTML: string };
  __lateCommits?: number;
  __lateHydrateCalled?: boolean;
  __lateDefinedAtHtml?: boolean;
  __lateServerChildCount?: number;
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
const CONFIRM = '#root pricing-change-review [data-pr-part="review-confirm"]';

async function open(page: Page, define: Define, hydrate: Hydrate, extra = ''): Promise<void> {
  const query = `mode=hydrate-late&define=${define}&hydrate=${hydrate}${extra}`;
  await page.goto(`/react-slots.html?${query}`);
}

// hydrateRoot has run and the sibling probe has committed, then two frames have passed: React
// reports a recoverable error during that commit or the passive effects that follow it, so none is
// pending after this. With 0 expected errors there is no event to wait for; the frames are the
// signal that the work queued by the commit has run.
async function settle(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const store = window as unknown as LateStore;
    return store.__lateHydrateCalled === true && (store.__lateCommits ?? 0) >= 1;
  });
  await page.evaluate(
    () =>
      new Promise<void>((done) => {
        requestAnimationFrame(() => requestAnimationFrame(() => done()));
      }),
  );
}

async function readSeen(page: Page, tag = 'pricing-renderer', confirm = CONFIRM) {
  return page.evaluate(
    ({ tag, confirm }) => {
      const store = window as unknown as LateStore;
      const button = document.querySelector(confirm);
      return {
        recoverable: store.__recoverable ?? [],
        hostKept: document.querySelector(tag) === store.__lateHost,
        confirmKept: button !== null && button === store.__lateConfirm,
        beforeChildCount: store.__lateBefore?.childCount,
        serverChildCount: store.__lateServerChildCount,
        definedAtHtml: store.__lateDefinedAtHtml,
      };
    },
    { tag, confirm },
  );
}

test.describe('hydration order of the element and React', () => {
  for (const { define, hydrate } of ORDERINGS) {
    test(`define ${define}, hydrate ${hydrate}: the final DOM is complete`, async ({ page }) => {
      await open(page, define, hydrate);
      await settle(page);

      await expect(page.locator(RADIOS)).toHaveCount(3);
      await expect(page.locator('#root pricing-renderer')).toHaveCount(1);
      await expect(page.locator(CTAS)).toHaveCount(3);
      await expect(page.locator(SUMMARY)).toHaveCount(1);

      const seen = await readSeen(page);

      // Preconditions of the hazard; they hold before and after the wrapper fix, so a green row
      // means 'fixed', not 'the harness stopped reproducing the order'.
      expect(seen.definedAtHtml).toBe(define === 'before');
      // The server tag is empty: nothing could render into it before the assertion below.
      expect(seen.serverChildCount).toBe(0);
      if (hydrate === 'sync') {
        expect(seen.beforeChildCount).toBe(0);
      } else {
        expect(seen.beforeChildCount).toBeGreaterThan(0);
      }

      expect(seen.recoverable).toHaveLength(EXPECTED_RECOVERABLE[`${define}/${hydrate}`]);
      expect(seen.hostKept).toBe(true);
    });
  }

  test('define before, hydrate task, no render props: clean hydration, host kept', async ({
    page,
  }) => {
    await open(page, 'before', 'task', '&slots=none');
    await settle(page);
    await expect(page.locator(RADIOS)).toHaveCount(3);
    await expect(page.locator('#root pricing-renderer')).toHaveCount(1);

    const seen = await readSeen(page);
    // The element rendered before React hydrated, as in the rows above.
    expect(seen.definedAtHtml).toBe(true);
    expect(seen.serverChildCount).toBe(0);
    expect(seen.beforeChildCount).toBeGreaterThan(0);
    expect(seen.recoverable).toHaveLength(0);
    expect(seen.hostKept).toBe(true);
  });

  // The host's dangerouslySetInnerHTML object is one per component instance: a new object on each
  // render would make React 19 clear the element's light DOM on the first update after hydration.
  test('define before, hydrate task: updates after hydration keep the host and its light DOM', async ({
    page,
  }) => {
    // Six renders and their waits after one page load: slower than a row of the table.
    test.slow();
    await open(page, 'before', 'task');
    await settle(page);
    await expect(page.locator(RADIOS)).toHaveCount(3);
    await expect(page.locator(CTAS)).toHaveCount(3);
    await expect(page.locator(SUMMARY)).toHaveCount(1);
    expect((await readSeen(page)).beforeChildCount).toBeGreaterThan(0);

    // Render prop outputs leave and come back.
    await page.locator('#toggle-summary').click();
    await expect(page.locator(SUMMARY)).toHaveCount(0);
    await page.locator('#toggle-summary').click();
    await expect(page.locator(SUMMARY)).toHaveCount(1);

    await page.locator('#toggle-plan-cta').click();
    await expect(page.locator(CTAS)).toHaveCount(0);
    await page.locator('#toggle-plan-cta').click();
    await expect(page.locator(CTAS)).toHaveCount(3);

    // A prop of the renderer changes.
    await page.locator('#set-current').click();
    await expect(page.locator('#root [data-testid="cta-starter"]')).toHaveAttribute(
      'data-current',
      'true',
    );

    await settle(page);
    await expect(page.locator(RADIOS)).toHaveCount(3);
    await expect(page.locator(CTAS)).toHaveCount(3);
    await expect(page.locator(SUMMARY)).toHaveCount(1);
    await expect(page.locator('#root pricing-renderer')).toHaveCount(1);

    const seen = await readSeen(page);
    expect(seen.recoverable).toEqual([]);
    expect(seen.hostKept).toBe(true);
  });

  test('wrapper without opaque host props (bare element): one hydration error and a new host', async ({
    page,
  }) => {
    await open(page, 'before', 'task', '&wrapper=raw');
    await settle(page);

    const seen = await readSeen(page);
    // The same order the wrapper survives: the element rendered a light DOM (its error state, the
    // bare element has no source), then React hydrated an empty tag.
    expect(seen.definedAtHtml).toBe(true);
    expect(seen.serverChildCount).toBe(0);
    expect(seen.beforeChildCount).toBeGreaterThan(0);
    expect(seen.recoverable).toHaveLength(1);
    expect(seen.recoverable[0]).toContain('Hydration failed');
    expect(seen.hostKept).toBe(false);
  });

  test.describe('PricingChangeReview', () => {
    const REVIEW = 'pricing-change-review';

    test('define before, hydrate task: clean hydration, host and light DOM kept, update keeps both', async ({
      page,
    }) => {
      await open(page, 'before', 'task', '&wrapper=review');
      await settle(page);
      await expect(page.locator(CONFIRM)).toHaveCount(1);
      await expect(page.locator(CONFIRM)).toHaveAttribute('aria-busy', 'true');

      let seen = await readSeen(page, REVIEW);
      // The element had rendered its light DOM before React hydrated an empty server tag.
      expect(seen.definedAtHtml).toBe(true);
      expect(seen.serverChildCount).toBe(0);
      expect(seen.beforeChildCount).toBeGreaterThan(0);
      expect(seen.recoverable).toEqual([]);
      expect(seen.hostKept).toBe(true);
      expect(seen.confirmKept).toBe(true);

      // pending true -> false: the same host and the same button, now idle.
      await page.locator('#toggle-review-pending').click();
      await expect(page.locator(CONFIRM)).not.toHaveAttribute('aria-busy', /.*/);
      await settle(page);
      await expect(page.locator(CONFIRM)).toHaveCount(1);
      await expect(page.locator('#root pricing-change-review')).toHaveCount(1);

      seen = await readSeen(page, REVIEW);
      expect(seen.recoverable).toEqual([]);
      expect(seen.hostKept).toBe(true);
      expect(seen.confirmKept).toBe(true);
    });
  });
});
