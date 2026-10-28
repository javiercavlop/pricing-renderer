import { expect, test, type Page } from '@playwright/test';
import { setProps } from './helpers/change-flow.js';
import { openRenderer } from './helpers/spectra.js';

// [utest->req~host-reset-spec~1]
// A Tailwind-preflight-like global reset in the host page (docs/design-systems.md). The reset is
// unlayered, so it outranks the layered renderer styles and wipes the background of the primary CTA
// in its <button> form. The fix rule of the docs restores it.

test.beforeEach(({ browserName }) => {
  test.skip(browserName !== 'chromium', 'The host reset checks run in chromium only.');
});

const presetReset = `button { background-color: transparent; background-image: none; }`;

const documentedFix = `
  pricing-renderer[data-pr-root] button[data-pr-part='cta'][data-kind='primary'] {
    background-color: var(--pr-color-accent);
    color: var(--pr-color-on-accent);
  }
`;

const primaryCta = "pricing-renderer button[data-pr-part='cta'][data-kind='primary']";

async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    for (let frame = 0; frame < 3; frame += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  });
}

// The demo sets --pr-color-accent on `.demo-browser pricing-renderer` in an unlayered rule, which
// would give the CTA the demo accent instead of the theme one the scenario names. Removing it
// leaves theme.css as the source of the token.
async function clearDemoAccent(page: Page): Promise<void> {
  await page.evaluate(() => {
    const clear = (rules: CSSRuleList): void => {
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSLayerBlockRule) continue;
        if (rule instanceof CSSStyleRule) rule.style.removeProperty('--pr-color-accent');
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

async function starterColors(page: Page): Promise<{ background: string; color: string }> {
  const cta = page
    .locator(
      `pricing-renderer [data-pr-part="plan-card"][data-plan-id="starter"] button[data-pr-part="cta"][data-kind="primary"]`,
    )
    .first();
  await expect(cta).toBeVisible();
  return cta.evaluate((element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, color: style.color };
  });
}

for (const width of [375, 1440]) {
  test(`a host button reset wipes the primary button CTA and the documented fix restores it at ${width}px`, async ({
    page,
  }, testInfo) => {
    await openRenderer(page, { width, height: 900 });
    await clearDemoAccent(page);
    await setProps(page, {
      presentation: {
        ctas: [{ id: 'start-starter', label: 'Start', planId: 'starter' }],
      },
    });
    await expect(page.locator(primaryCta).first()).toBeVisible();
    await settle(page);

    expect((await starterColors(page)).background, 'without the host style').toBe(
      'rgb(101, 88, 232)',
    );

    await page.addStyleTag({ content: presetReset });
    await settle(page);
    expect((await starterColors(page)).background, 'with the preflight-shaped reset').toBe(
      'rgba(0, 0, 0, 0)',
    );

    await page.addStyleTag({ content: documentedFix });
    await settle(page);
    const fixed = await starterColors(page);
    expect(fixed.background, 'with the documented fix').toBe('rgb(101, 88, 232)');
    expect(fixed.color).toBe('rgb(255, 255, 255)');

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(overflow.scrollWidth, 'no horizontal overflow of the document').toBeLessThanOrEqual(
      overflow.clientWidth,
    );

    await testInfo.attach(`host-reset-${width}`, {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png',
    });
  });
}
