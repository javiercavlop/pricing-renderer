import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openRenderer } from './helpers/spectra.js';

// [utest->req~host-dark-class~1] [utest->req~tokens-shadcn-overlay~1]
// [utest->req~tokens-shadcn-mapping~1] [utest->req~theme-minimal-flat~1]
// The theme files are read from disk and injected into the demo, so the specs do not depend on how
// the demo imports its styles.

const stylesRoot = fileURLToPath(new URL('../../src/styles/', import.meta.url));
const readStyles = (name: string): string => readFileSync(`${stylesRoot}${name}`, 'utf8');

const viewport = { width: 1200, height: 900 };

test.beforeEach(({ browserName }) => {
  test.skip(browserName !== 'chromium', 'The theme file checks run in chromium only.');
});

async function injectCss(page: Page, content: string, where: 'first' | 'last'): Promise<void> {
  await page.evaluate(
    ({ content, where }) => {
      const style = document.createElement('style');
      style.dataset.themeFile = 'true';
      style.textContent = content;
      if (where === 'first') document.head.prepend(style);
      else document.head.append(style);
    },
    { content, where },
  );
}

async function token(page: Page, name: string): Promise<string> {
  return page.evaluate((name) => {
    const renderer = document.querySelector('pricing-renderer') as HTMLElement;
    return getComputedStyle(renderer).getPropertyValue(name).trim().toLowerCase();
  }, name);
}

async function colorScheme(page: Page): Promise<string> {
  return page.evaluate(() => {
    const renderer = document.querySelector('pricing-renderer') as HTMLElement;
    return getComputedStyle(renderer).colorScheme.trim();
  });
}

async function setDarkClass(page: Page, on: boolean): Promise<void> {
  await page.evaluate((on) => document.documentElement.classList.toggle('dark', on), on);
}

test.describe('host .dark class', () => {
  test('darkens the renderer and restores it when the class goes', async ({ page }) => {
    await openRenderer(page, viewport);
    const lightSurface = await token(page, '--pr-color-surface');
    expect(lightSurface).not.toBe('#181820');
    expect(await colorScheme(page)).toBe('light');

    await setDarkClass(page, true);
    expect(await token(page, '--pr-color-surface')).toBe('#181820');
    expect(await colorScheme(page)).toBe('dark');

    await setDarkClass(page, false);
    expect(await token(page, '--pr-color-surface')).toBe(lightSurface);
    expect(await colorScheme(page)).toBe('light');
  });
});

const hostVariables =
  ':root{--primary:#ff0000;--primary-foreground:#ffffff;--card:#fafafa;--border:#dddddd;--radius:0.5rem}' +
  '.dark{--primary:#00ff00;--card:#101010}';

test.describe('shadcn overlay', () => {
  for (const where of ['first', 'last'] as const) {
    test(`follows the host variables with the overlay injected ${where}`, async ({ page }) => {
      await openRenderer(page, viewport);
      await injectCss(page, hostVariables, 'last');
      await injectCss(page, readStyles('tokens-shadcn.css'), where);

      expect(await token(page, '--pr-color-accent')).toBe('#ff0000');
      expect(await token(page, '--pr-color-on-accent')).toBe('#ffffff');
      expect(await token(page, '--pr-color-surface')).toBe('#fafafa');
      expect(await token(page, '--pr-color-border')).toBe('#dddddd');
      expect(await token(page, '--pr-radius-lg')).toBe('0.5rem');
      expect(await token(page, '--pr-color-success')).toBe('#087f5b');
      expect(await colorScheme(page)).toBe('light');

      await setDarkClass(page, true);
      expect(await token(page, '--pr-color-accent')).toBe('#00ff00');
      expect(await token(page, '--pr-color-surface')).toBe('#101010');
      expect(await colorScheme(page)).toBe('dark');

      await setDarkClass(page, false);
      expect(await token(page, '--pr-color-accent')).toBe('#ff0000');
      expect(await token(page, '--pr-color-success')).toBe('#087f5b');
      expect(await colorScheme(page)).toBe('light');
    });
  }
});

test.describe('theme-minimal', () => {
  test('has no box shadow and borders in the text color', async ({ page }) => {
    await openRenderer(page, viewport);
    await injectCss(page, readStyles('theme-minimal.css'), 'last');

    const card = await page.evaluate(() => {
      const element = document.querySelector('pricing-renderer .pr-plan-card') as HTMLElement;
      const style = getComputedStyle(element);
      return {
        boxShadow: style.boxShadow,
        borderColor: style.borderTopColor,
        borderStyle: style.borderTopStyle,
        color: style.color,
      };
    });
    expect(card.boxShadow).toBe('none');
    expect(card.borderStyle).not.toBe('none');
    expect(card.borderColor).toBe(card.color);
    expect(await token(page, '--pr-shadow-sm')).toBe('none');
  });
});
