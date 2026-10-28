import { expect, test, type Page } from '@playwright/test';
import { applyPricing, openRenderer, readFixture } from './helpers/spectra.js';

// Optional design tokens of base.css (phase 1a, docs/agent-work/phase1a-design-system/intake.md):
// a host sets --pr-sticky-top, --pr-plan-columns, --pr-z-dialog and --pr-table-min-width and the
// computed styles follow; unset, the defaults stay. The CSS text is checked by
// tests/unit/design-tokens.test.ts.

test.beforeEach(({ browserName }) => {
  test.skip(browserName !== 'chromium', 'The design token checks run in chromium only.');
});

const toolbar = '.pr-comparison-toolbar';

// A pricing with a comparison toolbar and table (the same fixture the shorter-page spec uses).
async function openClickup(page: Page): Promise<void> {
  await openRenderer(page, { width: 1440, height: 900 });
  const state = await applyPricing(page, readFixture('clickup'), 'en', 'light');
  expect(state, 'the pricing should reach the ready state').toBe('ready');
  await expect(page.locator(toolbar)).toBeAttached();
  await releaseScrollContainers(page);
}

// The demo wraps the renderer in `.demo-workbench { overflow: hidden }`, which makes it the scroll
// container of the sticky toolbar. A host page without such a clip is what the token is for.
async function releaseScrollContainers(page: Page): Promise<void> {
  await page.evaluate(() => {
    const renderer = document.querySelector('pricing-renderer') as HTMLElement;
    for (
      let element = renderer.parentElement;
      element && element !== document.body && element !== document.documentElement;
      element = element.parentElement
    ) {
      const style = getComputedStyle(element);
      const clipped = (value: string) => value !== 'visible' && value !== 'clip';
      if (clipped(style.overflowX) || clipped(style.overflowY)) {
        element.style.overflow = 'visible';
      }
    }
  });
  await settle(page);
}

async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    for (let frame = 0; frame < 3; frame += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  });
}

// Scrolls well past the top of the toolbar, so it is stuck, and returns its top in the viewport.
async function stuckToolbarTop(page: Page): Promise<number> {
  await page.evaluate((selector) => {
    const element = document.querySelector(selector) as HTMLElement;
    const top = element.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + 300, behavior: 'instant' });
  }, toolbar);
  await settle(page);
  return page.evaluate((selector) => {
    const element = document.querySelector(selector) as HTMLElement;
    return element.getBoundingClientRect().top;
  }, toolbar);
}

async function setRootToken(page: Page, name: string, value: string | null): Promise<void> {
  await page.evaluate(
    ({ name, value }) => {
      if (value === null) document.documentElement.style.removeProperty(name);
      else document.documentElement.style.setProperty(name, value);
    },
    { name, value },
  );
  await settle(page);
}

async function setRendererToken(page: Page, name: string, value: string | null): Promise<void> {
  await page.evaluate(
    ({ name, value }) => {
      const renderer = document.querySelector('pricing-renderer') as HTMLElement;
      if (value === null) renderer.style.removeProperty(name);
      else renderer.style.setProperty(name, value);
    },
    { name, value },
  );
  await settle(page);
}

test.describe('optional design tokens', () => {
  // [utest->req~sticky-top-token~1]
  test('--pr-sticky-top on the document moves the sticky comparison toolbar', async ({ page }) => {
    test.setTimeout(60_000);
    await openClickup(page);

    expect(await stuckToolbarTop(page), 'unset keeps 0').toBeCloseTo(0, 0);

    await setRootToken(page, '--pr-sticky-top', '64px');
    expect(await stuckToolbarTop(page), 'a host offset of 64px').toBeCloseTo(64, 0);

    await setRootToken(page, '--pr-sticky-top', null);
    expect(await stuckToolbarTop(page), 'removed again').toBeCloseTo(0, 0);
  });

  // [utest->req~plan-columns-token~1]
  test('--pr-plan-columns on the element sets the plan columns at 1440', async ({ page }) => {
    await openRenderer(page, { width: 1440, height: 900 });
    const columns = () =>
      page.evaluate(() => {
        const grid = document.querySelector('pricing-renderer .pr-plan-grid') as Element;
        return getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;
      });

    const fallback = await columns();
    expect(fallback, 'three plans fill more than two default columns').toBeGreaterThan(2);

    await setRendererToken(page, '--pr-plan-columns', 'repeat(2, minmax(0, 1fr))');
    expect(await columns()).toBe(2);

    await setRendererToken(page, '--pr-plan-columns', null);
    expect(await columns(), 'unset leaves the default count').toBe(fallback);
  });

  // [utest->req~dialog-z-token~1]
  test('--pr-z-dialog changes the z-index of the dialog backdrop', async ({ page }) => {
    await openRenderer(page, { width: 1280, height: 800 });
    // The add-on confirmation dialog opens through the pending change, as in
    // element-instance-ids.spec.ts.
    const opened = await page.evaluate(async () => {
      const renderer = document.querySelector('pricing-renderer') as HTMLElement & {
        _pendingAddOnChange?: { addIds: string[]; removeIds: string[] };
        requestUpdate(): void;
        updateComplete: Promise<unknown>;
      };
      const addOnId = renderer.querySelector<HTMLElement>('[data-add-on-id]')?.dataset.addOnId;
      if (!addOnId) return false;
      renderer._pendingAddOnChange = { addIds: [addOnId], removeIds: [] };
      renderer.requestUpdate();
      await renderer.updateComplete;
      return true;
    });
    test.skip(!opened, 'The demo pricing has no add-on to open the dialog with.');

    const zIndex = () =>
      page.evaluate(() => {
        const backdrop = document.querySelector('pricing-renderer .pr-dialog-backdrop') as Element;
        return getComputedStyle(backdrop).zIndex;
      });
    expect(await zIndex(), 'unset keeps 1000').toBe('1000');
    await setRendererToken(page, '--pr-z-dialog', '2000');
    expect(await zIndex()).toBe('2000');
  });

  // [utest->req~table-size-tokens~1]
  test('--pr-table-min-width changes the comparison table min-width', async ({ page }) => {
    test.setTimeout(60_000);
    await openClickup(page);
    const table = '.pr-comparison-table';
    await expect(page.locator(table)).toBeAttached();
    const minWidth = () =>
      page.evaluate((selector) => {
        const element = document.querySelector(selector) as Element;
        return getComputedStyle(element).minWidth;
      }, table);

    expect(await minWidth(), 'unset keeps 720px').toBe('720px');
    await setRendererToken(page, '--pr-table-min-width', '900px');
    expect(await minWidth()).toBe('900px');
  });
});
