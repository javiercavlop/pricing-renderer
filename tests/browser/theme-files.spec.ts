import AxeBuilder from '@axe-core/playwright';
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

// The demo page declares --pr-* tokens in an unlayered rule, which beats every layered theme file.
// Removing them leaves the theme files as the only source of the tokens. Layer blocks are skipped:
// the default theme and base.css live in layers and keep the tokens the theme files do not set.
async function clearDemoTokens(page: Page): Promise<void> {
  await page.evaluate(() => {
    const clear = (rules: CSSRuleList): void => {
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSLayerBlockRule) continue;
        if (rule instanceof CSSStyleRule) {
          const names = Array.from(rule.style).filter((name) => name.startsWith('--pr-'));
          for (const name of names) rule.style.removeProperty(name);
        }
        const nested = (rule as CSSGroupingRule).cssRules;
        if (nested) clear(nested);
      }
    };
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        clear(sheet.cssRules);
      } catch {
        // A cross-origin sheet cannot be read.
      }
    }
  });
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

async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const renderer = document.querySelector('pricing-renderer') as HTMLElement & {
      updateComplete: Promise<unknown>;
    };
    await renderer.updateComplete;
    for (let frame = 0; frame < 3; frame += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  });
}

async function setThemeAttribute(page: Page, theme: string): Promise<void> {
  await page.evaluate((theme) => {
    document.querySelector('pricing-renderer')?.setAttribute('theme', theme);
  }, theme);
  await settle(page);
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

  test('ancestor wins over theme="light" on the element', async ({ page }) => {
    await openRenderer(page, viewport);
    await clearDemoTokens(page);
    await setThemeAttribute(page, 'light');
    expect(await token(page, '--pr-color-surface'), 'light before the class').not.toBe('#181820');

    await setDarkClass(page, true);
    await settle(page);
    expect(await page.locator('pricing-renderer').getAttribute('theme')).toBe('light');
    expect(await token(page, '--pr-color-surface')).toBe('#181820');
    expect(await token(page, '--pr-color-accent')).toBe('#9b8cff');
    expect(await colorScheme(page)).toBe('dark');
  });

  // CRP-B: an unrelated `.dark` ancestor darkens the renderer even with theme="light". The
  // screenshots are attached for review; there are no baselines.
  for (const width of [1440, 375]) {
    test(`attaches screenshots under an unrelated .dark ancestor at ${width}px`, async ({
      page,
    }, testInfo) => {
      await openRenderer(page, { width, height: 900 });
      await setThemeAttribute(page, 'light');
      for (const dark of [false, true]) {
        await page.evaluate((dark) => {
          const parent = (document.querySelector('pricing-renderer') as HTMLElement)
            .parentElement as HTMLElement;
          parent.classList.toggle('dark', dark);
        }, dark);
        await settle(page);
        const surface = await token(page, '--pr-color-surface');
        if (dark) expect(surface, 'with .dark').toBe('#181820');
        else expect(surface, 'without .dark').not.toBe('#181820');
        await testInfo.attach(`dark-ancestor-theme-light-${dark ? 'with' : 'without'}-${width}`, {
          body: await page.locator('pricing-renderer').screenshot(),
          contentType: 'image/png',
        });
      }
    });
  }
});

const hostVariables =
  ':root{--primary:#ff0000;--primary-foreground:#ffffff;--card:#fafafa;--border:#dddddd;--radius:0.5rem}' +
  '.dark{--primary:#00ff00;--card:#101010}';

test.describe('shadcn overlay', () => {
  for (const where of ['first', 'last'] as const) {
    test(`follows the host variables with the overlay injected ${where}`, async ({ page }) => {
      await openRenderer(page, viewport);
      await clearDemoTokens(page);
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
      expect(await token(page, '--pr-color-success')).toBe('#66d9ad');
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
    await clearDemoTokens(page);
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

  // [utest->req~theme-minimal-contrast~1]
  for (const theme of ['light', 'dark']) {
    test(`has no color-contrast violation in the ${theme} theme`, async ({ page }) => {
      // The reduced-motion rule shortens transitions, so axe never samples a half-way color.
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await openRenderer(page, viewport);
      await clearDemoTokens(page);
      await injectCss(page, readStyles('theme-minimal.css'), 'last');
      await setThemeAttribute(page, theme);

      const results = await new AxeBuilder({ page })
        .include('pricing-renderer')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      const contrast = results.violations.filter((violation) => violation.id === 'color-contrast');
      expect(
        contrast.map((violation) => violation.nodes.map((node) => node.target.join(' '))),
      ).toEqual([]);
    });
  }
});
