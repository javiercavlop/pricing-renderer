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

// The plan CTA in its <button> form (.pr-button styles both forms). In the demo pricing
// (tests/fixtures/acme-pricing.yml) the Starter CTA has no href, so it is the first CTA and a
// button; Growth and Enterprise are links (renderPlanCta in src/element/renderers.ts).
const cta = "button[data-pr-part='cta']";

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

// The largest offset the test sets; the scroll target leaves room for it.
const largestStickyTop = 64;

// Scrolls the page so the toolbar is stuck in the middle of its containing block (the comparison
// section), with room for the largest offset, and returns its top in the viewport. The scroll
// target comes from the static position of the toolbar (position: static for one layout read; it
// takes the same space in flow), so each call scrolls to the same place. The rect of a stuck
// toolbar is not its static position: reading it made every call scroll further, until the end of
// the section pushed the toolbar up.
async function stuckToolbarTop(page: Page): Promise<number> {
  const scroll = await page.evaluate(
    ({ selector, largest }) => {
      const element = document.querySelector(selector) as HTMLElement;
      const section = element.parentElement as HTMLElement;
      element.style.position = 'static';
      const top = element.getBoundingClientRect().top + window.scrollY;
      element.style.position = '';
      const height = element.getBoundingClientRect().height;
      const marginEnd = parseFloat(getComputedStyle(element).marginBlockEnd);
      const sectionStyle = getComputedStyle(section);
      const sectionEnd =
        section.getBoundingClientRect().bottom +
        window.scrollY -
        parseFloat(sectionStyle.paddingBlockEnd) -
        parseFloat(sectionStyle.borderBlockEndWidth);
      // How far the top of the toolbar can move below its static top before the section ends.
      const travel = sectionEnd - marginEnd - height - top;
      const target = Math.ceil(top + Math.max(0, travel - largest) / 2);
      window.scrollTo({ top: target, behavior: 'instant' });
      return { top, travel };
    },
    { selector: toolbar, largest: largestStickyTop },
  );
  await settle(page);
  // A page too short to reach the target still measures right while the toolbar is past its
  // static top and the offset fits before the section ends.
  const past = (await page.evaluate(() => window.scrollY)) - scroll.top;
  expect(past, 'the page scrolls past the static top of the toolbar').toBeGreaterThanOrEqual(0);
  expect(past, 'the offset fits before the section ends').toBeLessThanOrEqual(
    scroll.travel - largestStickyTop,
  );
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
    // The add-on confirmation dialog opens through the private pending change, as in
    // element-instance-ids.spec.ts. No public flow opens it reliably: the dialog only shows for an
    // add-on with a dependency or an exclusion, and the demo pricing does not guarantee one.
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
    expect(opened, 'the demo pricing has an add-on to open the dialog with').toBe(true);
    await expect(page.locator('pricing-renderer .pr-dialog-backdrop')).toBeAttached();

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

  // [utest->req~table-size-tokens~1]
  test('--pr-table-max-height changes the max-height of the table scroll box', async ({ page }) => {
    test.setTimeout(60_000);
    await openClickup(page);
    const maxHeight = () =>
      page.evaluate(() => {
        const element = document.querySelector('pricing-renderer .pr-table-scroll') as Element;
        return getComputedStyle(element).maxHeight;
      });

    expect(await maxHeight(), 'unset keeps 80dvh of a 900px viewport').toBe('720px');
    await setRendererToken(page, '--pr-table-max-height', '300px');
    expect(await maxHeight()).toBe('300px');
  });

  // [utest->req~token-fallbacks~1]
  test('without a host token the defaults are unchanged', async ({ page }) => {
    await openRenderer(page, { width: 1440, height: 900 });
    await clearDemoButtonFont(page);
    await setRendererToken(page, 'font-size', '16px');
    expect(await computed(page, '.pr-hero__title', 'fontWeight')).toBe('780');
    expect(await computed(page, 'pricing-renderer', 'lineHeight')).toBe('24px');
    expect(await computed(page, '.pr-price__amount', 'fontWeight')).toBe('790');
    expect(await computed(page, '.pr-plan-card__top h4', 'fontWeight')).toBe('700');
    expect(await computed(page, cta, 'fontWeight')).toBe('750');
  });

  // [utest->req~line-height-token~1]
  test('--pr-line-height sets the line height of the root', async ({ page }) => {
    await openRenderer(page, { width: 1440, height: 900 });
    await hostRule(page, 'pricing-renderer { font-size: 16px; --pr-line-height: 1.7; }');
    expect(await computed(page, 'pricing-renderer', 'lineHeight')).toBe('27.2px');
  });

  // [utest->req~font-weight-tokens~1]
  test('--pr-font-weight-bold unifies the bold group', async ({ page }) => {
    await openRenderer(page, { width: 1440, height: 900 });
    await clearDemoButtonFont(page);
    const weights = () =>
      Promise.all([
        computed(page, '.pr-hero__title', 'fontWeight'),
        computed(page, '.pr-price__amount', 'fontWeight'),
        computed(page, '.pr-plan-card__top h4', 'fontWeight'),
        computed(page, cta, 'fontWeight'),
      ]);
    expect(await weights(), 'without the host rule').toEqual(['780', '790', '700', '750']);

    await hostRule(page, 'pricing-renderer { --pr-font-weight-bold: 600; }');
    expect(await weights(), 'with --pr-font-weight-bold: 600').toEqual([
      '600',
      '600',
      '600',
      '600',
    ]);
  });

  // [utest->req~font-family-tokens~1]
  test.describe('font family tokens', () => {
    test('unset tokens inherit the host font', async ({ page }) => {
      await openRenderer(page, { width: 1440, height: 900 });
      await clearDemoTokens(page);
      await hostRule(page, 'body { font-family: Verdana, sans-serif; }');
      const expected = 'Verdana, sans-serif';
      expect(await computed(page, 'pricing-renderer', 'fontFamily')).toBe(expected);
      expect(await computed(page, '.pr-hero__title', 'fontFamily')).toBe(expected);
      expect(await computed(page, '.pr-plan-card__top h4', 'fontFamily')).toBe(expected);
    });

    test('body and display fonts', async ({ page }) => {
      await openRenderer(page, { width: 1440, height: 900 });
      await clearDemoTokens(page);
      await hostRule(
        page,
        `pricing-renderer { --pr-font-family: Georgia, serif; --pr-font-family-display: 'Courier New', monospace; }`,
      );
      expect(await computed(page, '.pr-plan-card', 'fontFamily')).toBe('Georgia, serif');
      const display = '"Courier New", monospace';
      for (const selector of [
        '.pr-hero__title',
        "[data-pr-part='plans'] .pr-section__heading h3",
        '.pr-plan-card__top h4',
        '.pr-price__amount',
      ]) {
        expect(await computed(page, selector, 'fontFamily'), selector).toBe(display);
      }
    });

    test('the display font falls back to the body font', async ({ page }) => {
      await openRenderer(page, { width: 1440, height: 900 });
      await clearDemoTokens(page);
      await hostRule(page, 'pricing-renderer { --pr-font-family: Georgia, serif; }');
      expect(await computed(page, '.pr-hero__title', 'fontFamily')).toBe('Georgia, serif');
    });
  });
});

// The demo page declares --pr-font-family and --pr-color-accent on `.demo-browser pricing-renderer`
// in an unlayered rule that outranks a host rule on `pricing-renderer`. The font scenarios start
// from a page without a --pr-* token, so the demo declarations are removed (as in
// theme-files.spec.ts); layer blocks keep the tokens of the package styles.
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
  await settle(page);
}

// The demo page resets `button, select { font: inherit; }` in an unlayered rule
// (examples/vanilla/src/page.css). Unlayered declarations outrank the layered package styles, so
// the CTA button inherits the 400 of its card instead of the .pr-button weight of base.css (the
// cascade host-reset.spec.ts shows for the background). The weight scenarios start from a page
// without that host reset, so its font declaration is removed; layer blocks are left as they are.
async function clearDemoButtonFont(page: Page): Promise<void> {
  await page.evaluate(() => {
    const clear = (rules: CSSRuleList): void => {
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSLayerBlockRule) continue;
        if (rule instanceof CSSStyleRule) {
          const selectors = rule.selectorText.split(',').map((selector) => selector.trim());
          if (selectors.includes('button')) rule.style.removeProperty('font');
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
  await settle(page);
}

// Injects an unlayered host rule and waits for the styles to apply.
async function hostRule(page: Page, content: string): Promise<void> {
  await page.addStyleTag({ content });
  await settle(page);
}

// A computed style property of the first element that matches the selector.
async function computed(
  page: Page,
  selector: string,
  property: 'fontWeight' | 'fontFamily' | 'lineHeight',
): Promise<string> {
  return page.evaluate(
    ({ selector, property }) => {
      const element = document.querySelector(
        selector === 'pricing-renderer' ? selector : `pricing-renderer ${selector}`,
      ) as Element;
      return getComputedStyle(element)[property];
    },
    { selector, property },
  );
}
