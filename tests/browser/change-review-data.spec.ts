import { expect, test, type Locator } from '@playwright/test';
import { openDemo } from './helpers/change-flow.js';
import {
  addReview,
  backButton,
  confirmButton,
  R_CUR,
  R_ENT,
  R_START,
  recordReviewEvents,
  reviewEvents,
  setReview,
} from './helpers/change-review.js';

// The data contract of <pricing-change-review> (add-subscription-change-flow, phase E). The
// scenarios are those of openspec/changes/add-subscription-change-flow/specs/change-review/spec.md;
// the comparisons (R_ENT, R_START, R_CUR) are defined in its design.md and computed in
// tests/browser/helpers/change-review.ts. The unit tests of the registration, the types, the
// manifest and the package entries are in tests/unit/change-review.test.ts.

test.beforeEach(async ({ page }) => {
  await openDemo(page);
});

function isPending(review: Locator): Promise<boolean> {
  return review.evaluate((element) => (element as unknown as { pending: boolean }).pending);
}

// [utest->req~review-element-defined~1]
test('the demo page registers the review element', async ({ page }) => {
  const registered = await page.evaluate(() => {
    const constructor = customElements.get('pricing-change-review');
    const element = document.createElement('pricing-change-review');
    return {
      name: constructor?.name,
      upgraded: constructor !== undefined && element instanceof constructor,
    };
  });
  expect(registered).toEqual({ name: 'PricingChangeReviewElement', upgraded: true });
});

// [utest->req~review-properties~1]
test.describe('properties', () => {
  test('defaults and reflection of pending', async ({ page }) => {
    const review = await addReview(page);
    const defaults = await review.evaluate((element) => {
      const props = element as unknown as Record<string, unknown>;
      return {
        withoutComparison: props.comparison === undefined,
        notices: props.notices,
        pending: props.pending,
        locale: props.locale,
      };
    });
    expect(defaults).toEqual({
      withoutComparison: true,
      notices: [],
      pending: false,
      locale: 'en-US',
    });
    await expect(review).not.toHaveAttribute('pending', /.*/);
    await setReview(page, { pending: true });
    await expect(review).toHaveAttribute('pending', '');
    await setReview(page, { pending: false });
    await expect(review).not.toHaveAttribute('pending', /.*/);
  });

  test('error, locale and confirm-label are read from their attributes', async ({ page }) => {
    const review = await addReview(page, { comparison: R_ENT });
    await review.evaluate((element) => {
      element.setAttribute('error', 'Timeout');
      element.setAttribute('locale', 'es-ES');
      element.setAttribute('confirm-label', 'Pay now');
    });
    await expect(review.locator('[data-pr-part="review-error"]')).toContainText('Timeout');
    await expect(page.locator(confirmButton)).toHaveText('Pay now');
    await expect(page.locator(backButton)).toHaveText('Volver');
  });
});

// [utest->req~review-light-dom~1]
test('the review page renders into its own light DOM', async ({ page }) => {
  const review = await addReview(page, { comparison: R_ENT });
  expect(await review.evaluate((element) => element.shadowRoot)).toBeNull();
  await expect(review.locator('[data-pr-part="review-confirm"]')).toHaveCount(1);
});

// [utest->req~review-confirm-event~1]
test('Confirm dispatches one pricing-change-confirm with a deep copy', async ({ page }) => {
  await addReview(page, { comparison: R_ENT });
  await recordReviewEvents(page, 'pricing-change-confirm');
  await page.locator(confirmButton).click();
  const events = await reviewEvents(page, 'pricing-change-confirm');
  expect(events).toHaveLength(1);
  const [event] = events;
  expect(event).toMatchObject({ bubbles: true, composed: true, cancelable: true });
  expect(event?.detail.comparison).toEqual(event?.elementComparison);
  expect(event?.detail.comparison).toEqual(R_ENT);
  expect(event?.sameObject).toBe(false);
  expect(event?.sameNestedObject).toBe(false);
});

// [utest->req~review-confirm-pending~1]
test.describe('the default action of Confirm', () => {
  test('sets pending when the event is not canceled', async ({ page }) => {
    const review = await addReview(page, { comparison: R_ENT });
    await page.locator(confirmButton).click();
    expect(await isPending(review)).toBe(true);
    await expect(review).toHaveAttribute('pending', '');
  });

  test('leaves pending alone when the host cancels the event', async ({ page }) => {
    const review = await addReview(page, { comparison: R_ENT });
    await recordReviewEvents(page, 'pricing-change-confirm', { cancel: true });
    await page.locator(confirmButton).click();
    expect(await reviewEvents(page, 'pricing-change-confirm')).toHaveLength(1);
    expect(await isPending(review)).toBe(false);
    await expect(review).not.toHaveAttribute('pending', /.*/);
  });
});

// [utest->req~review-confirm-blocked~1]
test.describe('Confirm is blocked', () => {
  test('a second click while pending dispatches nothing', async ({ page }) => {
    await addReview(page, { comparison: R_ENT });
    await recordReviewEvents(page, 'pricing-change-confirm');
    await page.locator(confirmButton).click();
    await expect(page.locator(confirmButton)).toHaveAttribute('aria-disabled', 'true');
    await page.locator(confirmButton).click({ force: true });
    expect(await reviewEvents(page, 'pricing-change-confirm')).toHaveLength(1);
  });

  test('nothing to confirm when the comparison is current', async ({ page }) => {
    await addReview(page, { comparison: R_CUR });
    await recordReviewEvents(page, 'pricing-change-confirm');
    await page.locator(confirmButton).click({ force: true });
    expect(await reviewEvents(page, 'pricing-change-confirm')).toHaveLength(0);
    await expect(page.locator(confirmButton)).toHaveAttribute('aria-disabled', 'true');
  });

  test('a host that sets pending blocks the click too', async ({ page }) => {
    await addReview(page, { comparison: R_ENT, pending: true });
    await recordReviewEvents(page, 'pricing-change-confirm');
    await page.locator(confirmButton).click({ force: true });
    expect(await reviewEvents(page, 'pricing-change-confirm')).toHaveLength(0);
  });

  test('Confirm works again when pending is cleared', async ({ page }) => {
    await addReview(page, { comparison: R_ENT, pending: true });
    await recordReviewEvents(page, 'pricing-change-confirm');
    await setReview(page, { pending: false });
    await expect(page.locator(confirmButton)).not.toHaveAttribute('aria-disabled', /.*/);
    await page.locator(confirmButton).click();
    expect(await reviewEvents(page, 'pricing-change-confirm')).toHaveLength(1);
  });
});

// [utest->req~review-back-event~1]
test.describe('Back', () => {
  test('dispatches one pricing-change-back and leaves pending alone', async ({ page }) => {
    const review = await addReview(page, { comparison: R_ENT });
    await recordReviewEvents(page, 'pricing-change-back');
    await page.locator(backButton).click();
    const events = await reviewEvents(page, 'pricing-change-back');
    expect(events).toHaveLength(1);
    const [event] = events;
    expect(event).toMatchObject({ bubbles: true, composed: true, cancelable: true });
    expect(event?.detail.comparison).toEqual(event?.elementComparison);
    expect(event?.sameObject).toBe(false);
    expect(await isPending(review)).toBe(false);
  });

  test('still works while pending', async ({ page }) => {
    const review = await addReview(page, { comparison: R_ENT, pending: true });
    await recordReviewEvents(page, 'pricing-change-back');
    await page.locator(backButton).click();
    expect(await reviewEvents(page, 'pricing-change-back')).toHaveLength(1);
    expect(await isPending(review)).toBe(true);
  });
});

// [utest->req~review-text-only~1]
test('notices and the error are text, never markup', async ({ page }) => {
  const dialogs: string[] = [];
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.message());
    void dialog.dismiss();
  });
  const review = await addReview(page, {
    comparison: R_ENT,
    notices: ['<b>Billing</b> starts on 1 Dec'],
    error: '<img src=x onerror=alert(1)>',
  });
  const notice = review.locator('[data-pr-part="review-notices"] li');
  await expect(notice).toHaveCount(1);
  await expect(notice).toHaveText('<b>Billing</b> starts on 1 Dec');
  await expect(notice.locator('b')).toHaveCount(0);
  const error = review.locator('[data-pr-part="review-error"]');
  await expect(error).toContainText('<img src=x onerror=alert(1)>');
  await expect(error.locator('img')).toHaveCount(0);
  await page.waitForTimeout(100);
  expect(dialogs).toEqual([]);
});

// [utest->req~review-base-parts~1]
test.describe('base parts', () => {
  test('notices, error and the two buttons', async ({ page }) => {
    const review = await addReview(page, {
      comparison: R_ENT,
      notices: ['First', 'Second'],
      error: 'Timeout',
    });
    const confirm = review.locator('button[data-pr-part="review-confirm"]');
    const back = review.locator('button[data-pr-part="review-back"]');
    await expect(confirm).toHaveText('Confirm change');
    await expect(back).toHaveText('Back');
    const items = review.locator('[data-pr-part="review-notices"] li');
    await expect(items).toHaveCount(2);
    await expect(items).toHaveText(['First', 'Second']);
    await expect(review.locator('[data-pr-part="review-error"]')).toContainText('Timeout');
  });

  test('confirmLabel replaces the text of Confirm', async ({ page }) => {
    await addReview(page, { comparison: R_ENT, confirmLabel: 'Pay now' });
    await expect(page.locator(confirmButton)).toHaveText('Pay now');
    await expect(page.locator(backButton)).toHaveText('Back');
  });

  test('nothing to show', async ({ page }) => {
    const review = await addReview(page, { comparison: R_ENT, notices: [] });
    await expect(review.locator('[data-pr-part="review-confirm"]')).toHaveCount(1);
    await expect(review.locator('[data-pr-part="review-notices"]')).toHaveCount(0);
    await expect(review.locator('[data-pr-part="review-error"]')).toHaveCount(0);
    await setReview(page, { error: '' });
    await expect(review.locator('[data-pr-part="review-error"]')).toHaveCount(0);
  });

  test('no parts without a comparison', async ({ page }) => {
    const review = await addReview(page, { notices: ['First'], error: 'Timeout' });
    await expect(review.locator('[data-pr-part^="review-"]')).toHaveCount(0);
    await setReview(page, { comparison: R_START });
    await expect(review.locator('[data-pr-part="review-confirm"]')).toHaveCount(1);
  });
});
