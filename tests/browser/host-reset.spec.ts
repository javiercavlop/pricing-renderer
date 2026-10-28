import { expect, test } from '@playwright/test';
import { openRenderer } from './helpers/spectra.js';

// A Tailwind-preflight-like global reset in the host page (docs/design-systems.md). The reset is
// unlayered, so it outranks the layered renderer styles. The host also adds the documented fix for
// the primary button; the checks prove that the call to action stays usable with both in place.

test.beforeEach(({ browserName }) => {
  test.skip(browserName !== 'chromium', 'The host reset checks run in chromium only.');
});

const hostReset = `
  *, ::before, ::after { box-sizing: border-box; }
  * { margin: 0; }
  button { background: transparent; }
  h1, h2, h3, h4, h5, h6 { font-size: inherit; font-weight: inherit; }
  img { display: block; }
  pricing-renderer [data-pr-part='cta'][data-kind='primary'] {
    background-color: var(--pr-color-accent);
  }
`;

for (const width of [375, 1440]) {
  test(`the plan CTA and the page layout survive a host reset at ${width}px`, async ({
    page,
  }, testInfo) => {
    await openRenderer(page, { width, height: 900 });
    await page.addStyleTag({ content: hostReset });
    await page.evaluate(async () => {
      for (let frame = 0; frame < 3; frame += 1) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    });

    const cta = page.locator('pricing-renderer [data-pr-part="cta"][data-kind="primary"]').first();
    await expect(cta).toBeVisible();
    const background = await cta.evaluate((element) => {
      const style = getComputedStyle(element);
      return { color: style.backgroundColor, image: style.backgroundImage };
    });
    expect(
      background.color !== 'rgba(0, 0, 0, 0)' && background.color !== 'transparent',
      `the primary CTA background is ${background.color}`,
    ).toBe(true);

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
