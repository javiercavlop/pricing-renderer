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

async function cardNames(cards: Locator): Promise<string[]> {
  return (await cards.locator('h4').allTextContents()).map((name) => name.trim());
}

async function activeInsideRenderer(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const renderer = document.querySelector('pricing-renderer');
    return !!renderer && !!document.activeElement && renderer.contains(document.activeElement);
  });
}

// [utest->req~reveal-focus-visible~1] The target shows a focus ring (:focus-visible and a solid
// outline) and is the only rendered row or card made programmatically focusable.
async function expectVisibleFocus(page: Page, target: Locator): Promise<void> {
  const style = await target.evaluate((element) => ({
    focusVisible: element.matches(':focus-visible'),
    outlineStyle: getComputedStyle(element).outlineStyle,
  }));
  expect(style.focusVisible, 'the target should match :focus-visible').toBe(true);
  expect(style.outlineStyle).toBe('solid');
  await expect(
    page.locator(`pricing-renderer :is(${rowPart}, ${cardPart})[tabindex="-1"]`),
  ).toHaveCount(1);
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

    const namesBefore = await cardNames(cards);
    expect(namesBefore).toHaveLength(addOnCap);

    await activate(page, button);
    await expect(cards).toHaveCount(18);

    const names = await cardNames(cards);
    const target = cards.nth(addOnCap);
    await expect(target).toBeFocused();
    expect(await activeInsideRenderer(page)).toBe(true);
    expect(names.slice(0, addOnCap)).toEqual(namesBefore);
    expect(namesBefore).not.toContain(names[addOnCap]);
    expect((await target.locator('h4').textContent())?.trim()).toBe(names[addOnCap]);

    await expectVisibleFocus(page, target);
    await expectTabStaysOnPage(page, target);
  });

  test('add-ons: with a card beyond the cap selected, focus lands on the first card not visible before (okta, 1440x900)', async ({
    page,
  }) => {
    await loadPricing(page, 'okta', { width: 1440, height: 900 });
    const cards = page.locator(`pricing-renderer ${cardPart}`);
    const showButton = page
      .locator('pricing-renderer .pr-addon-main')
      .getByRole('button', { name: showMore });

    // Learn the add-on order from a first reveal, then load the pricing again to reset it.
    await activate(page, showButton);
    await expect(cards).toHaveCount(18);
    const ids = await cards.evaluateAll((list) =>
      list.map((card) => (card as HTMLElement).dataset.addOnId ?? ''),
    );
    const names = await cardNames(cards);
    expect(await applyPricing(page, readFixture('okta'))).toBe('ready');
    await expect(cards).toHaveCount(addOnCap);

    // Select the add-on at index 9 through the search, which lists it beyond the cap, then clear it.
    const selectedIndex = addOnCap + 1;
    const search = page.locator(
      'pricing-renderer [data-pr-part="addon-toolbar"] input[type="search"]',
    );
    await search.fill(names[selectedIndex]!);
    const selectedCard = page.locator(`pricing-renderer [data-add-on-id="${ids[selectedIndex]}"]`);
    await selectedCard.locator('input[type="checkbox"]').check();
    await expect(selectedCard).toHaveAttribute('data-selected', 'true');
    await search.fill('');

    // The selected card is visible next to the first eight, so it sits at position 8 before the reveal.
    await expect(cards).toHaveCount(addOnCap + 1);
    const visibleBefore = await cards.evaluateAll((list) =>
      list.map((card) => (card as HTMLElement).dataset.addOnId ?? ''),
    );
    expect(visibleBefore).toContain(ids[selectedIndex]);
    const firstNew = ids.find((id) => !visibleBefore.includes(id))!;
    expect(firstNew).toBe(ids[addOnCap]);

    await activate(page, showButton);
    await expect(cards).toHaveCount(18);

    const target = page.locator(`pricing-renderer [data-add-on-id="${firstNew}"]`);
    await expect(target).toBeFocused();
    expect(await activeInsideRenderer(page)).toBe(true);
    await expectVisibleFocus(page, target);
    await expectTabStaysOnPage(page, target);
  });

  for (const layout of layouts) {
    test(`comparison ${layout.name}: focus lands on the first newly shown row (clickup, ${layout.viewport.width}x${layout.viewport.height})`, async ({
      page,
    }) => {
      await loadPricing(page, 'clickup', layout.viewport);
      // clickup starts with only the differences, which leaves its first group (General, 136 rows)
      // under the cap. With the filter off the group is expanded and shows 30 rows and "Show 106 more".
      await page.getByRole('checkbox', { name: 'Only differences' }).uncheck();

      const group = page.locator(layout.group).first();
      await expect(group.locator(rowPart)).toHaveCount(rowCap);
      const button = group.getByRole('button', { name: showMore });
      await expect(button).toBeVisible();

      await activate(page, button);
      await expect(group.locator(rowPart)).not.toHaveCount(rowCap);

      const target = group.locator(rowPart).nth(rowCap);
      await expect(target).toBeFocused();
      expect(await activeInsideRenderer(page)).toBe(true);

      await expectVisibleFocus(page, target);
      await expectTabStaysOnPage(page, target);
    });
  }
});
