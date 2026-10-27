import { expect, test } from '@playwright/test';
import { openRenderer } from './helpers/spectra.js';

// A loader that rejects puts the element in the error state: the reader sees one sentence and the
// retry button, the codes stay in a closed details, and retry loads again. The stand-in version is
// tests/unit/error-state.test.ts.
// [utest->req~error-state-human-message~1]

type ErrorElement = HTMLElement & {
  src?: string;
  loadPricing?: () => Promise<string | undefined>;
  updateComplete: Promise<unknown>;
};
type ErrorWindow = typeof window & { errorLoads?: number };

test.beforeEach(async ({ page }) => {
  await openRenderer(page, { width: 1280, height: 800 });
  // The loader rejects on its first call and returns the pricing on the next ones.
  await page.evaluate(() => {
    const target = window as ErrorWindow;
    const source = (document.querySelector('pricing-renderer') as { yaml?: string }).yaml;
    const renderer = document.createElement('pricing-renderer') as ErrorElement;
    renderer.id = 'failing';
    renderer.src = 'https://example.com/pricing.yml';
    target.errorLoads = 0;
    renderer.loadPricing = () => {
      target.errorLoads = (target.errorLoads ?? 0) + 1;
      return target.errorLoads === 1
        ? Promise.reject(new Error('Network down'))
        : Promise.resolve(source);
    };
    document.body.append(renderer);
  });
});

test('a rejected loader shows one sentence with the codes in a closed details', async ({
  page,
}) => {
  const error = page.locator('#failing .pr-error');
  await expect(error).toBeVisible();
  await expect(error.locator('h2')).toHaveText('The pricing could not be rendered.');
  await expect(error.locator('> p')).toHaveText('The pricing source could not be loaded.');
  const details = error.locator('details[data-pr-part="diagnostics"]');
  await expect(details).toHaveCount(1);
  await expect(details).not.toHaveAttribute('open', /.*/);
  await expect(details.locator('summary')).toHaveText('Technical details');
  // closed: the code is in the DOM but not visible
  await expect(details).toContainText('PR_SOURCE_LOAD_FAILED');
  await expect(details.locator('li')).not.toBeVisible();
  await expect(error.getByText('PR_SOURCE_LOAD_FAILED')).not.toBeVisible();
  await expect(error.getByRole('button', { name: 'Retry' })).toBeVisible();

  await details.locator('summary').click();
  await expect(details.locator('li')).toContainText('Network down');
});

test('retry loads the pricing again', async ({ page }) => {
  await expect(page.locator('#failing .pr-error')).toBeVisible();
  await page.locator('#failing').getByRole('button', { name: 'Retry' }).click();
  await expect(page.locator('#failing .pr-plan-card')).toHaveCount(3);
  await expect(page.locator('#failing .pr-error')).toHaveCount(0);
  expect(await page.evaluate(() => (window as ErrorWindow).errorLoads)).toBe(2);
});
