import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import type { SelectionComparison } from '../../src/core/index.js';
import { openDemo } from './helpers/change-flow.js';
import {
  addReview,
  backButton,
  confirmButton,
  R_CUR,
  R_ENT,
  R_QUOTE,
  R_START,
  R_V12,
  recordReviewEvents,
  reviewEvents,
  setReview,
} from './helpers/change-review.js';

// The review UI of <pricing-change-review> (add-subscription-change-flow, phase F). The scenarios
// are those of openspec/changes/add-subscription-change-flow/specs/change-review/spec.md, the
// requirements marked [pending CRP]; the layout is the approved mock in
// docs/agent-work/phase2-subscription-change/review-mock/. The comparisons (R_ENT, R_START,
// R_CUR, R_QUOTE, R_V12) are defined in design.md and computed in helpers/change-review.ts.
// The data contract (events, guards, base parts) is in change-review-data.spec.ts.

test.beforeEach(async ({ page }) => {
  await openDemo(page);
});

const sections = '#review section[data-pr-part^="review-"]';

function section(page: Page, part: string): Locator {
  return page.locator(`#review [data-pr-part="${part}"]`);
}

function sectionParts(page: Page): Promise<string[]> {
  return page
    .locator(sections)
    .evaluateAll((elements) => elements.map((element) => element.getAttribute('data-pr-part')!));
}

// [utest->req~review-ui-structure~1]
test.describe('structure', () => {
  test('upgrade to Enterprise', async ({ page }) => {
    const review = await addReview(page, { comparison: R_ENT });
    expect(await sectionParts(page)).toEqual([
      'review-plan',
      'review-price',
      'review-features',
      'review-limits',
      'review-unchanged',
    ]);
    const root = review.locator('section[data-pr-part="change-review"]');
    await expect(root).toHaveCount(1);
    const title = root.locator('h2');
    await expect(title).toHaveText('Review your change');
    await expect(title).toHaveAttribute('tabindex', '-1');
    const titleId = await title.getAttribute('id');
    expect(titleId).toBeTruthy();
    await expect(root).toHaveAttribute('aria-labelledby', titleId!);
  });

  test('downgrade with notices', async ({ page }) => {
    await addReview(page, {
      comparison: R_START,
      notices: ['Your storage above 10 GB will be read-only.'],
    });
    expect(await sectionParts(page)).toEqual([
      'review-plan',
      'review-price',
      'review-add-ons',
      'review-features',
      'review-limits',
      'review-unchanged',
      'review-notices',
    ]);
    await expect(section(page, 'review-notices').locator('h3')).toHaveText('Before you confirm');
    await expect(section(page, 'review-notices').locator('li')).toHaveText([
      'Your storage above 10 GB will be read-only.',
    ]);
  });

  test('each section is labelled by its own h3, after the h2', async ({ page }) => {
    const review = await addReview(page, { comparison: R_START, notices: ['A notice'] });
    const labelled = await page.locator(sections).evaluateAll((elements) =>
      elements.map((element) => {
        const heading = element.querySelector(':scope > h3');
        return {
          hasHeading: heading !== null,
          labelledBy: element.getAttribute('aria-labelledby') === heading?.id && !!heading?.id,
          level: element.querySelectorAll('h1, h2, h4, h5, h6').length,
        };
      }),
    );
    expect(labelled).toHaveLength(7);
    for (const entry of labelled) {
      expect(entry).toEqual({ hasHeading: true, labelledBy: true, level: 0 });
    }
    await expect(review.locator('h2')).toHaveCount(1);
  });

  test('two review elements on the page keep their ids apart', async ({ page }) => {
    await addReview(page, { comparison: R_ENT });
    await page.evaluate(async (comparison) => {
      const other = document.createElement('pricing-change-review') as HTMLElement & {
        updateComplete: Promise<unknown>;
      };
      other.id = 'second';
      Object.assign(other, { comparison });
      document.body.append(other);
      await other.updateComplete;
    }, R_ENT);
    const ids = await page.evaluate(() =>
      [...document.querySelectorAll('pricing-change-review [id]')].map((element) => element.id),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('nothing changes: no sections, a note, Confirm blocked', async ({ page }) => {
    const review = await addReview(page, { comparison: R_CUR });
    await expect(review.locator('h2')).toHaveText('Review your change');
    expect(await sectionParts(page)).toEqual([]);
    await expect(review).toContainText('Your selection is the same as your current subscription.');
    await expect(page.locator(confirmButton)).toHaveAttribute('aria-disabled', 'true');
    await expect(page.locator(backButton)).not.toHaveAttribute('aria-disabled', /.*/);
  });

  test('notices of the host show even when nothing changes', async ({ page }) => {
    await addReview(page, { comparison: R_CUR, notices: ['Renews on 1 Dec'] });
    expect(await sectionParts(page)).toEqual(['review-notices']);
  });
});

// [utest->req~review-ui-plan~1]
test.describe('plan section', () => {
  test('upgrade and new version', async ({ page }) => {
    await addReview(page, { comparison: R_ENT });
    const plan = section(page, 'review-plan');
    await expect(plan).toContainText('Growth');
    await expect(plan).toContainText('Enterprise');
    await expect(plan).toContainText('Upgrade');
    await expect(plan).not.toContainText('Pricing version');
    await setReview(page, { comparison: R_V12 });
    await expect(plan).toContainText('Basic');
    await expect(plan).toContainText('Change');
    await expect(plan).toContainText('Pricing version 1.0 → 2.0');
  });

  test('downgrade', async ({ page }) => {
    await addReview(page, { comparison: R_START });
    const plan = section(page, 'review-plan');
    await expect(plan).toContainText('Growth');
    await expect(plan).toContainText('Starter');
    await expect(plan).toContainText('Downgrade');
  });

  test('the same plan is named once', async ({ page }) => {
    await addReview(page, { comparison: R_V12 });
    const text = (await section(page, 'review-plan').innerText()).replace(/\s+/g, ' ');
    expect(text.match(/Basic/g)).toHaveLength(1);
  });
});

// [utest->req~review-ui-price~1]
test.describe('price section', () => {
  test('cheaper upgrade', async ({ page }) => {
    await addReview(page, { comparison: R_ENT });
    const price = section(page, 'review-price');
    await expect(price.locator('h3')).toHaveText('Price');
    await expect(price).toContainText('Current price');
    await expect(price).toContainText('New price');
    await expect(price).toContainText('Difference');
    await expect(price).toContainText('€80');
    await expect(price).toContainText('€75');
    await expect(price).toContainText('-€5');
  });

  test('a dearer change has a plus sign', async ({ page }) => {
    await addReview(page, { comparison: R_V12 });
    const price = section(page, 'review-price');
    await expect(price).toContainText('€20');
    await expect(price).toContainText('€22');
    await expect(price).toContainText('+€2');
  });

  test('quote', async ({ page }) => {
    await addReview(page, { comparison: R_QUOTE });
    const price = section(page, 'review-price');
    await expect(price).toContainText(
      'The difference is not shown because part of the price requires a quote.',
    );
    await expect(price).toContainText('Requires quote');
    await expect(price).not.toContainText('Difference');
    await expect(price).not.toContainText(/[+-]€/);
  });

  test('a quote does not block Confirm', async ({ page }) => {
    await addReview(page, { comparison: R_QUOTE });
    await expect(page.locator(confirmButton)).not.toHaveAttribute('aria-disabled', /.*/);
  });

  test('currencies that differ', async ({ page }) => {
    const mixed = JSON.parse(JSON.stringify(R_ENT)) as SelectionComparison;
    delete mixed.price.difference;
    mixed.price.differenceOmitted = 'currency';
    mixed.price.after.currency = 'USD';
    await addReview(page, { comparison: mixed });
    const price = section(page, 'review-price');
    await expect(price).toContainText('The difference is not shown because the currencies differ.');
    await expect(price).toContainText('€80');
    await expect(price).toContainText('$75');
  });

  test('a changed billing period', async ({ page }) => {
    const yearly = JSON.parse(JSON.stringify(R_ENT)) as SelectionComparison;
    yearly.price.billingPeriodChanged = true;
    yearly.price.before.billingPeriod = { id: 'monthly', label: 'Monthly', multiplier: 1 };
    yearly.price.after.billingPeriod = { id: 'yearly', label: 'Yearly', multiplier: 0.8 };
    await addReview(page, { comparison: yearly });
    await expect(section(page, 'review-price')).toContainText('Billing period Monthly → Yearly');
  });
});

// [utest->req~review-ui-add-ons~1]
test.describe('add-ons section', () => {
  test('removed by the downgrade', async ({ page }) => {
    await addReview(page, { comparison: R_START });
    const items = section(page, 'review-add-ons').locator('li');
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText('Extra Storage');
    await expect(items.nth(1)).toContainText('Priority Success');
    for (const index of [0, 1]) {
      await expect(items.nth(index)).toContainText('Removed');
      await expect(items.nth(index)).toContainText('Not available with Starter');
    }
  });

  test('added, removed by the user and quantity changed', async ({ page }) => {
    const edited = JSON.parse(JSON.stringify(R_ENT)) as SelectionComparison;
    edited.addOns.added = [{ id: 'compliance', name: 'Compliance', quantity: 1, presence: 'both' }];
    edited.addOns.removedByUser = [
      { id: 'prioritySuccess', name: 'Priority Success', quantity: 1, presence: 'both' },
    ];
    edited.addOns.quantityChanged = [
      { id: 'extraStorage', name: 'Extra Storage', before: 2, after: 3, delta: 1 },
    ];
    await addReview(page, { comparison: edited });
    const items = section(page, 'review-add-ons').locator('li');
    await expect(items).toHaveCount(3);
    await expect(items.filter({ hasText: 'Compliance' })).toContainText('Added');
    const removed = items.filter({ hasText: 'Priority Success' });
    await expect(removed).toContainText('Removed');
    await expect(removed).not.toContainText('Not available');
    await expect(items.filter({ hasText: 'Extra Storage' })).toContainText('Quantity 2 → 3');
  });

  test('the text of each removal reason', async ({ page }) => {
    const edited = JSON.parse(JSON.stringify(R_START)) as SelectionComparison;
    const [first, second] = edited.addOns.removedByReconciliation;
    first!.reason = 'dependency-removed';
    second!.reason = 'not-in-version';
    await addReview(page, { comparison: edited });
    const items = section(page, 'review-add-ons').locator('li');
    await expect(items.nth(0)).toContainText('Requires an add-on that is removed');
    await expect(items.nth(1)).toContainText('Not offered in the new pricing');
  });

  test('no section when no add-on changes', async ({ page }) => {
    await addReview(page, { comparison: R_ENT });
    await expect(section(page, 'review-add-ons')).toHaveCount(0);
  });
});

// [utest->req~review-ui-features~1]
test.describe('features section', () => {
  test('audit log lost', async ({ page }) => {
    await addReview(page, { comparison: R_START });
    const items = section(page, 'review-features').locator('li');
    await expect(items).toHaveCount(1);
    await expect(items).toContainText('Audit Log');
    await expect(items).toContainText('Lost');
  });

  test('gained', async ({ page }) => {
    await addReview(page, { comparison: R_ENT });
    const items = section(page, 'review-features').locator('li');
    await expect(items).toHaveCount(1);
    await expect(items).toContainText('Custom Roles');
    await expect(items).toContainText('Gained');
  });

  test('changed shows the values before and after', async ({ page }) => {
    const edited = JSON.parse(JSON.stringify(R_ENT)) as SelectionComparison;
    edited.features.gained = [];
    edited.features.changed = [
      {
        id: 'support',
        name: 'Support hours',
        before: { kind: 'text', value: 'Business hours' },
        after: { kind: 'text', value: '24/7' },
        presence: 'both',
      },
    ];
    await addReview(page, { comparison: edited });
    const item = section(page, 'review-features').locator('li');
    await expect(item).toContainText('Support hours');
    await expect(item).toContainText('Changed');
    await expect(item).toContainText('Business hours → 24/7');
  });
});

// [utest->req~review-ui-limits~1]
test.describe('limits section', () => {
  test('storage below the current usage', async ({ page }) => {
    await addReview(page, { comparison: R_START });
    const limits = section(page, 'review-limits');
    await expect(limits.locator('h3')).toHaveText('Usage limits');
    await expect(limits).toContainText('Storage');
    await expect(limits).toContainText('200');
    await expect(limits).toContainText('10');
    await expect(limits).toContainText('Your current usage (150');
    await expect(limits).toContainText('is above the new limit.');
  });

  test('unlimited', async ({ page }) => {
    await addReview(page, { comparison: R_ENT });
    const limits = section(page, 'review-limits');
    await expect(limits).toContainText('Storage');
    await expect(limits).toContainText('200');
    await expect(limits).toContainText('Unlimited');
    await expect(limits).not.toContainText('is above the new limit.');
  });

  test('the warning is a note, not colour alone', async ({ page }) => {
    await addReview(page, { comparison: R_START });
    const note = section(page, 'review-limits').locator('[role="note"]');
    await expect(note).toHaveCount(1);
    await expect(note).toContainText('Your current usage');
  });
});

// [utest->req~review-ui-unchanged~1]
test('the unchanged summary counts add-ons, features and limits', async ({ page }) => {
  await addReview(page, { comparison: R_ENT });
  const unchanged = section(page, 'review-unchanged');
  await expect(unchanged.locator('h3')).toHaveText('Unchanged');
  await expect(unchanged).toContainText('2 add-ons, 3 features and 0 usage limits stay the same.');
});

// [utest->req~review-ui-status~1]
test.describe('pending status', () => {
  test('pending', async ({ page }) => {
    await addReview(page, { comparison: R_ENT });
    const status = section(page, 'review-status');
    await expect(status).toHaveAttribute('role', 'status');
    await expect(status).toHaveText('');
    await setReview(page, { pending: true });
    await expect(status).toHaveText('Applying your change…');
    await expect(page.locator(confirmButton)).toHaveAttribute('aria-busy', 'true');
    await expect(page.locator(confirmButton)).toHaveAttribute('aria-disabled', 'true');
  });

  test('not pending', async ({ page }) => {
    await addReview(page, { comparison: R_ENT, pending: true });
    await setReview(page, { pending: false });
    await expect(section(page, 'review-status')).toHaveText('');
    await expect(page.locator(confirmButton)).not.toHaveAttribute('aria-busy', /.*/);
    await expect(page.locator(confirmButton)).not.toHaveAttribute('aria-disabled', /.*/);
  });

  test('Back stays enabled while pending', async ({ page }) => {
    await addReview(page, { comparison: R_ENT, pending: true });
    await expect(page.locator(backButton)).not.toHaveAttribute('aria-disabled', /.*/);
    await expect(page.locator(backButton)).not.toHaveAttribute('disabled', /.*/);
  });
});

// [utest->req~review-ui-error~1]
test.describe('error region', () => {
  test('error', async ({ page }) => {
    await addReview(page, { comparison: R_ENT, pending: true });
    await setReview(page, { pending: false, error: 'Payment method declined' });
    const error = section(page, 'review-error');
    await expect(error).toHaveAttribute('role', 'alert');
    await expect(error).toContainText('The change could not be applied.');
    await expect(error).toContainText('Payment method declined');
  });

  test('cleared', async ({ page }) => {
    await addReview(page, { comparison: R_ENT, error: 'Timeout' });
    await setReview(page, { error: undefined });
    await expect(section(page, 'review-error')).toHaveCount(0);
  });
});

// [utest->req~review-ui-focus~1]
test.describe('focus on the review heading', () => {
  test('comparison shown', async ({ page }) => {
    await addReview(page);
    await setReview(page, { comparison: R_ENT });
    await expect(page.locator('#review h2')).toBeFocused();
  });

  test('another comparison', async ({ page }) => {
    await addReview(page, { comparison: R_ENT });
    await page.locator(backButton).focus();
    await setReview(page, { comparison: R_START });
    await expect(page.locator('#review h2')).toBeFocused();
  });

  test('other updates leave focus alone', async ({ page }) => {
    await addReview(page, { comparison: R_ENT });
    await page.locator(backButton).focus();
    await setReview(page, { notices: ['A notice'], pending: true });
    await expect(page.locator(backButton)).toBeFocused();
  });
});

// [utest->req~review-ui-focus-error~1]
test.describe('focus on Confirm after an error', () => {
  test('error shown', async ({ page }) => {
    await addReview(page, { comparison: R_ENT });
    await page.locator(confirmButton).click();
    await page.locator(backButton).focus();
    await setReview(page, { pending: false, error: 'Timeout' });
    await expect(page.locator(confirmButton)).toBeFocused();
  });

  test('a retry works after the error', async ({ page }) => {
    await addReview(page, { comparison: R_ENT });
    await recordReviewEvents(page, 'pricing-change-confirm');
    await page.locator(confirmButton).click();
    await setReview(page, { pending: false, error: 'Timeout' });
    await page.keyboard.press('Enter');
    expect(await reviewEvents(page, 'pricing-change-confirm')).toHaveLength(2);
  });
});

// [utest->req~review-ui-forced-colors~1]
test.describe('forced colors', () => {
  test('every section and both buttons keep a visible border', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    const review = await addReview(page, { comparison: R_START, notices: ['A notice'] });
    const borders = await review.evaluate((element) =>
      [...element.querySelectorAll('section'), ...element.querySelectorAll('button')].map(
        (target) => {
          const style = getComputedStyle(target);
          return {
            part: target.getAttribute('data-pr-part'),
            style: style.borderTopStyle,
            width: Number.parseFloat(style.borderTopWidth),
          };
        },
      ),
    );
    expect(borders.length).toBeGreaterThanOrEqual(10);
    for (const border of borders) {
      expect(border.style, String(border.part)).not.toBe('none');
      expect(border.width, String(border.part)).toBeGreaterThanOrEqual(1);
    }
  });

  test('a disabled Confirm is still told apart in text and attribute', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await addReview(page, { comparison: R_CUR });
    await expect(page.locator(confirmButton)).toHaveAttribute('aria-disabled', 'true');
    await expect(page.locator(confirmButton)).toHaveText('Confirm change');
  });
});

// [utest->req~review-ui-axe~1]
test.describe('accessibility', () => {
  async function seriousViolations(page: Page) {
    const results = await new AxeBuilder({ page })
      .include('#review')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    return results.violations.filter((violation) =>
      ['serious', 'critical'].includes(violation.impact ?? ''),
    );
  }

  const states: [string, Record<string, unknown>][] = [
    ['R_ENT', { comparison: R_ENT }],
    ['R_START', { comparison: R_START, notices: ['Your storage will be read-only.'] }],
    ['R_START while pending', { comparison: R_START, pending: true }],
    ['R_START with an error', { comparison: R_START, error: 'Timeout' }],
    ['R_QUOTE', { comparison: R_QUOTE }],
    ['R_CUR', { comparison: R_CUR }],
    ['R_V12', { comparison: R_V12 }],
  ];

  for (const [name, props] of states) {
    test(`no serious violation: ${name}`, async ({ page }) => {
      await addReview(page, props);
      expect(await seriousViolations(page)).toEqual([]);
    });
  }

  for (const theme of ['light', 'dark']) {
    test(`no serious violation in the ${theme} theme at 375 px`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 900 });
      const review = await addReview(page, { comparison: R_START, error: 'Timeout' });
      await review.evaluate((element, value) => element.setAttribute('theme', value), theme);
      expect(await seriousViolations(page)).toEqual([]);
    });
  }
});

// [utest->req~review-ui-structure~1]
test.describe('layout of the approved mock', () => {
  const widths: [number, number][] = [
    [320, 1],
    [375, 1],
    [599, 1],
    [600, 3],
    [1200, 3],
  ];

  for (const [width, columns] of widths) {
    test(`the price shows ${columns} column(s) in a ${width}px container`, async ({ page }) => {
      const review = await addReview(page, { comparison: R_ENT });
      await review.evaluate((element, value) => (element.style.width = `${value}px`), width);
      const tracks = await section(page, 'review-price')
        .locator('dl')
        .evaluate((list) => getComputedStyle(list).gridTemplateColumns.split(' ').length);
      expect(tracks).toBe(columns);
    });
  }

  test('the actions are sticky below 600px and in the flow from 600px', async ({ page }) => {
    const review = await addReview(page, { comparison: R_START });
    const position = () =>
      review
        .locator('[data-pr-part="change-actions"]')
        .evaluate((element) => getComputedStyle(element).position);
    await review.evaluate((element) => (element.style.width = '375px'));
    expect(await position()).toBe('sticky');
    await review.evaluate((element) => (element.style.width = '800px'));
    expect(await position()).not.toBe('sticky');
  });

  test('nothing overflows a 320px container', async ({ page }) => {
    const review = await addReview(page, {
      comparison: R_START,
      notices: ['A notice with averyveryverylongwordthatmustbreakinsteadofoverflowingthecontainer'],
      error: 'Timeout',
    });
    await review.evaluate((element) => (element.style.width = '320px'));
    const overflow = await review.evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('every control is at least 44px high', async ({ page }) => {
    await addReview(page, { comparison: R_ENT });
    for (const selector of [confirmButton, backButton]) {
      const box = await page.locator(selector).boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe('themes', () => {
  async function surfaceColor(page: Page, theme?: string): Promise<string> {
    const review = page.locator('#review');
    if (theme) {
      await review.evaluate((element, value) => element.setAttribute('theme', value), theme);
    }
    return section(page, 'review-plan').evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
  }

  test('dark theme changes the surfaces; the light theme is the default', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await addReview(page, { comparison: R_ENT });
    const light = await surfaceColor(page);
    const dark = await surfaceColor(page, 'dark');
    expect(dark).not.toBe(light);
    expect(light).toBe('rgb(255, 255, 255)');
  });

  test('auto follows the colour scheme of the system', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await addReview(page, { comparison: R_ENT });
    const dark = await surfaceColor(page, 'dark');
    expect(await surfaceColor(page, 'auto')).toBe(dark);
  });
});

// [utest->req~review-text-only~1]
test('plan and add-on names are text, never markup', async ({ page }) => {
  const dialogs: string[] = [];
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.message());
    void dialog.dismiss();
  });
  const hostile = JSON.parse(JSON.stringify(R_START)) as SelectionComparison;
  hostile.plan.before.name = '<u>Growth</u>';
  hostile.plan.after.name = '<i>Starter</i>';
  hostile.addOns.removedByReconciliation[0]!.name = '<img src=x onerror=alert(1)>';
  hostile.features.lost[0]!.name = '<b>Audit</b>';
  hostile.usageLimits.changed[0]!.name = '<svg onload=alert(2)>';
  hostile.usageLimits.changed[0]!.unit = '<s>GB</s>';
  const review = await addReview(page, { comparison: hostile });
  await expect(review).toContainText('<img src=x onerror=alert(1)>');
  await expect(review).toContainText('Not available with <i>Starter</i>');
  await expect(review.locator('u, i, img, b, svg, s')).toHaveCount(0);
  await page.waitForTimeout(100);
  expect(dialogs).toEqual([]);
});

// [utest->req~review-i18n~1]
test.describe('Spanish review', () => {
  test('headings and buttons', async ({ page }) => {
    const review = await addReview(page, { comparison: R_ENT, locale: 'es-ES' });
    await expect(review.locator('h2')).toHaveText('Revisa tu cambio');
    await expect(page.locator(confirmButton)).toHaveText('Confirmar cambio');
    await expect(page.locator(backButton)).toHaveText('Volver');
  });

  test('sections, values and the summary', async ({ page }) => {
    await addReview(page, { comparison: R_ENT, locale: 'es-ES' });
    await expect(section(page, 'review-plan')).toContainText('Mejora de plan');
    const price = section(page, 'review-price');
    await expect(price).toContainText('Precio actual');
    await expect(price).toContainText('Precio nuevo');
    await expect(price).toContainText('Diferencia');
    await expect(price).toContainText('80');
    await expect(price).toContainText('€');
    await expect(section(page, 'review-limits')).toContainText('Ilimitado');
    await expect(section(page, 'review-unchanged')).toContainText(
      '2 complementos, 3 características y 0 límites de uso no cambian.',
    );
  });

  test('pending, error, quote and nothing to change', async ({ page }) => {
    const review = await addReview(page, {
      comparison: R_QUOTE,
      locale: 'es-ES',
      pending: true,
    });
    await expect(section(page, 'review-status')).toHaveText('Aplicando tu cambio…');
    await expect(section(page, 'review-price')).toContainText(
      'No se muestra la diferencia porque parte del precio requiere presupuesto.',
    );
    await setReview(page, { pending: false, error: 'Tiempo agotado' });
    await expect(section(page, 'review-error')).toContainText('No se pudo aplicar el cambio.');
    await setReview(page, { comparison: R_CUR });
    await expect(review).toContainText('Tu selección es igual a tu suscripción actual.');
  });

  test('the locale attribute switches the language', async ({ page }) => {
    const review = await addReview(page, { comparison: R_ENT });
    await review.evaluate((element) => element.setAttribute('locale', 'es-ES'));
    await expect(review.locator('h2')).toHaveText('Revisa tu cambio');
  });

  test('messages override a text', async ({ page }) => {
    const review = await addReview(page, {
      comparison: R_ENT,
      messages: { 'pricing.reviewTitle': 'Check your move' },
    });
    await expect(review.locator('h2')).toHaveText('Check your move');
  });
});
