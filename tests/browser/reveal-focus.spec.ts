import { expect, test, type Locator, type Page } from '@playwright/test';
import { applyPricing, openRenderer, readFixture, type Viewport } from './helpers/spectra.js';

// Keyboard focus after "Show N more" (P-20261026-3): the button disappears when it is activated, so
// focus must move to the first newly shown comparison row or add-on card. Runs in every project.
// [utest->req~reveal-focus-comparison~1] [utest->req~reveal-focus-addons~1]
// [utest->req~reveal-focus-visible~1]

const showMore = /^Show \d+ more$/;
const rowPart = '[data-pr-part="comparison-row"]';
const cardPart = '[data-pr-part="add-on-card"]';
const rowCap = 30;
const addOnCap = 8;

type Layout = { name: string; viewport: Viewport; group: string };

const layouts: Layout[] = [
  { name: 'table', viewport: { width: 1440, height: 900 }, group: 'pricing-renderer tbody' },
  {
    name: 'compact',
    viewport: { width: 375, height: 800 },
    group: 'pricing-renderer .pr-comparison-group',
  },
];

async function loadPricing(page: Page, saas: string, viewport: Viewport): Promise<void> {
  test.setTimeout(60_000);
  await openRenderer(page, viewport);
  expect(await applyPricing(page, readFixture(saas))).toBe('ready');
}

// Focuses the button and presses Enter, as a keyboard user does.
async function activate(page: Page, button: Locator): Promise<void> {
  await button.focus();
  await expect(button).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(button).toHaveCount(0);
}

async function activeInsideRenderer(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const renderer = document.querySelector('pricing-renderer');
    return !!renderer && !!document.activeElement && renderer.contains(document.activeElement);
  });
}

// Tab must land on a control after the focused target (or inside it), never on <body>.
async function expectTabStaysOnPage(page: Page, target: Locator): Promise<void> {
  const handle = await target.elementHandle();
  expect(handle, 'the focus target should exist').not.toBeNull();
  await page.keyboard.press('Tab');
  const result = await handle!.evaluate((element) => {
    const active = document.activeElement;
    return {
      tag: active?.tagName ?? null,
      follows: !!active && active !== element && !!(element.compareDocumentPosition(active) & 20),
    };
  });
  expect(result.tag).not.toBe('BODY');
  expect(result.follows, 'Tab should move to the next focusable element after the target').toBe(
    true,
  );
}

test.describe('focus after Show N more', () => {
  test('add-ons: focus lands on the first newly shown card (okta, 1440x900)', async ({ page }) => {
    await loadPricing(page, 'okta', { width: 1440, height: 900 });
    const cards = page.locator(`pricing-renderer ${cardPart}`);
    await expect(cards).toHaveCount(addOnCap);
    const button = page
      .locator('pricing-renderer .pr-addon-main')
      .getByRole('button', { name: showMore });
    await expect(button).toHaveText('Show 10 more');

    await activate(page, button);
    await expect(cards).toHaveCount(18);

    const names = (await cards.locator('h4').allTextContents()).map((name) => name.trim());
    const target = cards.nth(addOnCap);
    await expect(target).toBeFocused();
    expect(await activeInsideRenderer(page)).toBe(true);
    expect((await target.locator('h4').textContent())?.trim()).toBe(names[addOnCap]);

    await expectTabStaysOnPage(page, target);
  });

  for (const layout of layouts) {
    test(`comparison ${layout.name}: focus lands on the first newly shown row (clickup, ${layout.viewport.width}x${layout.viewport.height})`, async ({
      page,
    }) => {
      await loadPricing(page, 'clickup', layout.viewport);
      const expandAll = page.getByRole('button', { name: 'Expand all' });
      if ((await expandAll.count()) > 0) await expandAll.click();

      const button = page
        .locator(`${layout.group} button.pr-button--quiet`)
        .filter({ hasText: showMore })
        .first();
      await expect(button).toBeVisible();
      const index = await button.evaluate(
        (element, selector) =>
          [...document.querySelectorAll(selector)].indexOf(
            element.closest(selector.split(' ').pop() ?? '') as Element,
          ),
        layout.group,
      );
      expect(index, 'the group of the button').toBeGreaterThanOrEqual(0);
      const group = page.locator(layout.group).nth(index);
      await expect(group.locator(rowPart)).toHaveCount(rowCap);

      await activate(page, button);
      await expect(group.locator(rowPart)).not.toHaveCount(rowCap);

      const target = group.locator(rowPart).nth(rowCap);
      await expect(target).toBeFocused();
      expect(await activeInsideRenderer(page)).toBe(true);

      await expectTabStaysOnPage(page, target);
    });
  }
});
