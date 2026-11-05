import { expect, test, type Page } from '@playwright/test';

// usePricingRendererState (add-react-headless, P3-12b): the end-to-end race of
// req~renderer-state-early-listen~1 with a real element and a real commit. The page is
// examples/vanilla/react-slots.html?mode=state, where a component calls the hook with a ref to the
// PricingRenderer rendered in the same render.

const radio = (planId: string): string =>
  `#root input[type="radio"][name$="-plan"][value="${planId}"]`;

const open = (page: Page): Promise<void> => page.goto('/react-slots.html?mode=state');

test.describe('renderer state listens from the commit', () => {
  test('The first pricing-ready reaches the snapshot', async ({ page }) => {
    await open(page);
    // The element fires pricing-ready once; no later event may be needed to show the name.
    await expect(page.getByTestId('state-name')).toHaveText('Acme Cloud');
    await expect(page.getByTestId('state-plan')).toHaveText('starter');
  });

  test('The snapshot follows a user plan selection', async ({ page }) => {
    await open(page);
    await expect(page.getByTestId('state-name')).toHaveText('Acme Cloud');
    await page.locator(radio('growth')).check({ force: true });
    await expect(page.getByTestId('state-plan')).toHaveText('growth');
    await page.locator(radio('enterprise')).check({ force: true });
    await expect(page.getByTestId('state-plan')).toHaveText('enterprise');
    await expect(page.getByTestId('state-name')).toHaveText('Acme Cloud');
  });
});
