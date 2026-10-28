import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openRenderer } from './helpers/spectra.js';

// [utest->req~host-dark-class~2] [utest->req~tokens-shadcn-overlay~2]
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

// The renderer paints no background of its own (base.css and the theme files leave it to the
// host), so the hero, the billing legend and the section headings are drawn on the demo page. The
// demo's theme switch sets data-theme on the root together with the renderer attribute
// (examples/vanilla/src/main.ts), so the page behind the renderer follows the theme.
async function setPageTheme(page: Page, theme: string): Promise<void> {
  await page.evaluate((theme) => {
    document.documentElement.dataset.theme = theme;
  }, theme);
  await setThemeAttribute(page, theme);
}

// CRP-B: a `.dark` ancestor darkens the renderer only with theme="auto". The system scheme is
// emulated as light, so auto is light unless the class is there.
test.describe('host .dark class', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
  });

  test('darkens a theme="auto" renderer and restores it when the class goes', async ({ page }) => {
    await openRenderer(page, viewport);
    await clearDemoTokens(page);
    await setThemeAttribute(page, 'auto');
    const lightSurface = await token(page, '--pr-color-surface');
    expect(lightSurface).not.toBe('#181820');
    expect(await colorScheme(page)).toBe('light');

    await setDarkClass(page, true);
    await settle(page);
    expect(await token(page, '--pr-color-surface')).toBe('#181820');
    expect(await token(page, '--pr-color-accent')).toBe('#9b8cff');
    expect(await colorScheme(page)).toBe('dark');

    await setDarkClass(page, false);
    await settle(page);
    expect(await token(page, '--pr-color-surface')).toBe(lightSurface);
    expect(await colorScheme(page)).toBe('light');
  });

  test('changes nothing with theme="light"', async ({ page }) => {
    await openRenderer(page, viewport);
    await clearDemoTokens(page);
    await setThemeAttribute(page, 'light');
    const lightSurface = await token(page, '--pr-color-surface');
    expect(lightSurface).not.toBe('#181820');

    await setDarkClass(page, true);
    await settle(page);
    expect(await page.locator('pricing-renderer').getAttribute('theme')).toBe('light');
    expect(await token(page, '--pr-color-surface')).toBe(lightSurface);
    expect(await token(page, '--pr-color-accent')).not.toBe('#9b8cff');
    expect(await colorScheme(page)).toBe('light');
  });

  test('keeps theme="dark" dark with and without the class', async ({ page }) => {
    await openRenderer(page, viewport);
    await clearDemoTokens(page);
    await setThemeAttribute(page, 'dark');
    expect(await token(page, '--pr-color-surface')).toBe('#181820');

    await setDarkClass(page, true);
    await settle(page);
    expect(await token(page, '--pr-color-surface')).toBe('#181820');
    expect(await colorScheme(page)).toBe('dark');

    await setDarkClass(page, false);
    await settle(page);
    expect(await token(page, '--pr-color-surface')).toBe('#181820');
    expect(await colorScheme(page)).toBe('dark');
  });

  // The screenshots are attached for review; there are no baselines.
  for (const width of [1440, 375]) {
    for (const theme of ['light', 'auto'] as const) {
      test(`attaches screenshots under an unrelated .dark ancestor with theme="${theme}" at ${width}px`, async ({
        page,
      }, testInfo) => {
        await openRenderer(page, { width, height: 900 });
        await clearDemoTokens(page);
        await setThemeAttribute(page, theme);
        for (const dark of [false, true]) {
          await page.evaluate((dark) => {
            const parent = (document.querySelector('pricing-renderer') as HTMLElement)
              .parentElement as HTMLElement;
            parent.classList.toggle('dark', dark);
          }, dark);
          await settle(page);
          const surface = await token(page, '--pr-color-surface');
          // theme="light" looks the same with and without the class; theme="auto" darkens.
          if (theme === 'auto' && dark) expect(surface, 'auto with .dark').toBe('#181820');
          else expect(surface, `${theme} ${dark ? 'with' : 'without'} .dark`).not.toBe('#181820');
          await testInfo.attach(
            `dark-ancestor-theme-${theme}-${dark ? 'with' : 'without'}-${width}`,
            { body: await page.locator('pricing-renderer').screenshot(), contentType: 'image/png' },
          );
        }
      });
    }
  }
});

const hostVariables =
  ':root{--primary:#ff0000;--primary-foreground:#ffffff;--card:#fafafa;--border:#dddddd;--radius:0.5rem}' +
  '.dark{--primary:#00ff00;--card:#101010}';

test.describe('shadcn overlay', () => {
  for (const where of ['first', 'last'] as const) {
    test(`follows the host variables with the overlay injected ${where}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await openRenderer(page, viewport);
      await clearDemoTokens(page);
      await injectCss(page, hostVariables, 'last');
      await injectCss(page, readStyles('tokens-shadcn.css'), where);
      await setThemeAttribute(page, 'auto');

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

  // Documented behaviour: the mapped colours follow the host for every theme value, the dark-only
  // values (color-scheme, status colours) only with theme="auto". A shadcn host that toggles
  // `.dark` must set theme="auto".
  test('with theme="light" the host .dark changes the mapped colours but not color-scheme or success', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await openRenderer(page, viewport);
    await clearDemoTokens(page);
    await injectCss(page, hostVariables, 'last');
    await injectCss(page, readStyles('tokens-shadcn.css'), 'last');
    await setThemeAttribute(page, 'light');
    await setDarkClass(page, true);
    await settle(page);

    expect(await token(page, '--pr-color-accent')).toBe('#00ff00');
    expect(await colorScheme(page)).toBe('light');
    expect(await token(page, '--pr-color-success')).toBe('#087f5b');
  });

  test('with theme="auto" under a system dark scheme and no .dark the status colours go dark but color-scheme stays light', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await openRenderer(page, viewport);
    await clearDemoTokens(page);
    await injectCss(page, hostVariables, 'last');
    await injectCss(page, readStyles('tokens-shadcn.css'), 'last');
    await setThemeAttribute(page, 'auto');
    await settle(page);

    expect(await token(page, '--pr-color-success')).toBe('#66d9ad');
    expect(await colorScheme(page)).toBe('light');
    expect(await token(page, '--pr-color-accent')).toBe('#ff0000');
  });
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
  const minimalTokens = {
    light: { text: '#111111', surface: '#ffffff' },
    dark: { text: '#f2f2f2', surface: '#121212' },
  } as const;
  for (const theme of ['light', 'dark'] as const) {
    test(`has no color-contrast violation in the ${theme} theme`, async ({ page }) => {
      // The reduced-motion rule shortens transitions, so axe never samples a half-way color.
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await openRenderer(page, viewport);
      await clearDemoTokens(page);
      await injectCss(page, readStyles('theme-minimal.css'), 'last');
      // Text outside the cards sits on the host page: with only the renderer attribute set, the
      // page stays light behind light text.
      await setPageTheme(page, theme);
      expect(await token(page, '--pr-color-text')).toBe(minimalTokens[theme].text);
      expect(await token(page, '--pr-color-surface')).toBe(minimalTokens[theme].surface);
      expect(await colorScheme(page)).toBe(theme);

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
