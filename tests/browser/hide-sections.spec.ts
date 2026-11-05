import { expect, test, type Page } from '@playwright/test';
import { openDemo } from './helpers/change-flow.js';

// hideSections (add-react-headless). These are the scenarios that need a DOM;
// the others are in tests/unit/hide-sections-element.test.ts. A new element is a <pricing-renderer> with the
// pricing of the demo page (Acme), en-US and catalog mode, appended to document.body.

const parts = [
  'hero',
  'metadata',
  'billing',
  'variables',
  'plans',
  'comparison',
  'add-ons',
  'summary',
] as const;
const title = 'Simple pricing that scales with you';
const part = (name: string): string => `#extra [data-pr-part="${name}"]`;

type HideElement = HTMLElement & { yaml?: string; hideSections?: unknown };

// Appends the new element and waits until it is ready and rendered.
async function addRenderer(page: Page, attribute?: string): Promise<void> {
  await page.evaluate(async (attribute) => {
    const source = (document.querySelector('pricing-renderer') as HideElement).yaml;
    const element = document.createElement('pricing-renderer') as HideElement & {
      updateComplete: Promise<unknown>;
    };
    element.id = 'extra';
    Object.assign(element, { yaml: source, locale: 'en-US', mode: 'catalog' });
    if (attribute !== undefined) element.setAttribute('hide-sections', attribute);
    const ready = new Promise<void>((resolve) => {
      element.addEventListener('pricing-ready', () => resolve(), { once: true });
    });
    document.body.append(element);
    await ready;
    await element.updateComplete;
  }, attribute);
}

test.beforeEach(async ({ page }) => {
  await openDemo(page);
});

test('Attribute to property', async ({ page }) => {
  await addRenderer(page);
  const value = await page.evaluate(() => {
    const element = document.querySelector('#extra') as HideElement;
    element.setAttribute('hide-sections', ' hero  addOns ');
    return element.hideSections;
  });
  expect(value).toEqual(['hero', 'addOns']);
});

test.describe('accessible name without the hero', () => {
  test('Hero hidden', async ({ page }) => {
    await addRenderer(page, 'hero');
    await expect(page.locator(part('hero'))).toHaveCount(0);
    const shell = page.locator('#extra section.pr-shell');
    const labelId = await shell.getAttribute('aria-labelledby');
    expect(labelId).toBeTruthy();
    const heading = page.locator(`[id="${labelId}"]`);
    await expect(heading).toHaveCount(1);
    await expect(heading).toHaveJSProperty('tagName', 'H2');
    await expect(heading).toHaveClass(/(^|\s)pr-sr-only(\s|$)/);
    await expect(heading).toHaveText(title);
    await expect(shell).toHaveAccessibleName(title);
  });
});

test.describe('unknown section tokens', () => {
  test('Unknown and differently cased tokens', async ({ page }) => {
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') problems.push(message.text());
    });
    await addRenderer(page);
    const value = await page.evaluate(async () => {
      const element = document.querySelector('#extra') as HideElement & {
        updateComplete: Promise<unknown>;
      };
      element.setAttribute('hide-sections', 'hero footer Plans addons');
      await element.updateComplete;
      return element.hideSections;
    });
    expect(value).toEqual(['hero']);
    await expect(page.locator(part('hero'))).toHaveCount(0);
    for (const name of parts.filter((item) => item !== 'hero')) {
      await expect(page.locator(part(name))).toHaveCount(1);
    }
    expect(problems).toEqual([]);
  });
});
