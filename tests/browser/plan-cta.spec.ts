import { expect, test, type Page } from '@playwright/test';
import {
  addRenderer,
  applyContract,
  C,
  openDemo,
  planCta,
  PQ,
  PS,
  recordActions,
  recordedActions,
  setProps,
  summaryAction,
} from './helpers/change-flow.js';

// Plan CTAs and the summary action (add-subscription-change-flow, phase C). The scenarios are
// those of openspec/changes/add-subscription-change-flow/specs/plan-cta/spec.md; the definitions
// (C, PQ, PS) are in its design.md. The unit tests of the types, the messages, the React prop and
// the manifest are in tests/unit/change-flow-element.test.ts.

const planCards = '[data-pr-part="plan-card"]';
const radio = (planId: string, selector = 'pricing-renderer'): string =>
  `${selector} input[name="pr-plan"][value="${planId}"]`;

test.beforeEach(async ({ page }) => {
  await openDemo(page);
});

// The demo page of the summary scenarios: the contract is applied and marked as current.
async function applyAndMarkContract(page: Page): Promise<void> {
  await applyContract(page, C);
  await setProps(page, { currentSelection: C });
}

// [utest->req~cta-pending-property~1]
test('pending-action-id is an attribute of pendingActionId', async ({ page }) => {
  const value = await page.evaluate(() => {
    const element = document.querySelector('pricing-renderer') as HTMLElement & {
      pendingActionId?: string;
    };
    element.setAttribute('pending-action-id', 'start-growth');
    return element.pendingActionId;
  });
  expect(value).toBe('start-growth');
});

// [utest->req~cta-pending-state~1]
test.describe('pending CTA state', () => {
  test('Growth trial pending', async ({ page }) => {
    await setProps(page, { pendingActionId: 'start-growth' });
    const growth = planCta(page, 'growth');
    await expect(growth).toHaveAttribute('aria-busy', 'true');
    await expect(growth).toHaveAttribute('data-pending', 'true');
    await expect(growth).toHaveAttribute('aria-disabled', 'true');
    await expect(growth.locator('[data-pr-part="cta-pending"]')).toHaveText('Processing…');
  });

  test('summary action pending', async ({ page }) => {
    await applyAndMarkContract(page);
    await page.locator(radio('enterprise')).check({ force: true });
    await setProps(page, { pendingActionId: 'review-change' });
    const action = summaryAction(page);
    await expect(action).toHaveAttribute('aria-busy', 'true');
    await expect(action).toHaveAttribute('data-pending', 'true');
    await expect(action).toHaveAttribute('aria-disabled', 'true');
    await expect(action.locator('[data-pr-part="cta-pending"]')).toHaveText('Processing…');
    const busyPlanCtas = page.locator(
      `pricing-renderer ${planCards} [data-pr-part="cta"][aria-busy]`,
    );
    await expect(busyPlanCtas).toHaveCount(0);
  });

  test('cleared', async ({ page }) => {
    await setProps(page, { pendingActionId: 'start-growth' });
    await expect(planCta(page, 'growth')).toHaveAttribute('aria-busy', 'true');
    await setProps(page, { pendingActionId: undefined });
    const states = ['aria-busy', 'data-pending', 'aria-disabled'];
    const marked = states.map((name) => `pricing-renderer [data-pr-part="cta"][${name}]`);
    await expect(page.locator(marked.join(', '))).toHaveCount(0);
    await expect(page.locator('pricing-renderer [data-pr-part="cta-pending"]')).toHaveCount(0);
  });
});

// [utest->req~cta-pending-others~1]
test('every other CTA is aria-disabled while an action is pending', async ({ page }) => {
  await applyAndMarkContract(page);
  await setProps(page, { pendingActionId: 'review-change' });
  await expect(planCta(page, 'starter')).toHaveAttribute('aria-disabled', 'true');
  await expect(planCta(page, 'enterprise')).toHaveAttribute('aria-disabled', 'true');
  await expect(summaryAction(page)).toHaveAttribute('aria-disabled', 'true');
});

// [utest->req~cta-pending-no-event~1]
test('a pending action ignores activations, then CTAs work again', async ({ page }) => {
  await recordActions(page);
  const url = page.url();
  await setProps(page, { pendingActionId: 'start-growth' });
  await planCta(page, 'starter').click({ force: true });
  await planCta(page, 'growth').click({ force: true });
  expect(await recordedActions(page)).toEqual([]);
  expect(page.url()).toBe(url);
  await setProps(page, { pendingActionId: undefined });
  await planCta(page, 'starter').click();
  const actions = await recordedActions(page);
  expect(actions).toHaveLength(1);
  expect(actions[0]?.detail.actionId).toBe('start-starter');
});

// [utest->req~cta-pending-focus~1]
test('focus stays on the CTA that became pending', async ({ page }) => {
  await recordActions(page, { cancel: true, pendingFromAction: true });
  const growth = planCta(page, 'growth');
  await growth.focus();
  await expect(growth).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(growth).toHaveAttribute('aria-busy', 'true');
  await expect(growth).toBeFocused();
});

// [utest->req~cta-relation-labels-config~1]
test.describe('configured relation labels', () => {
  test('custom labels', async ({ page }) => {
    await setProps(page, {
      presentation: {
        ctas: [
          {
            id: 'start-starter',
            label: 'Start with Starter',
            planId: 'starter',
            labels: { downgrade: 'Move to Starter' },
          },
          {
            id: 'start-growth',
            label: 'Start free trial',
            planId: 'growth',
            labels: { current: 'Your current plan' },
          },
          {
            id: 'contact-enterprise',
            label: 'Contact sales',
            planId: 'enterprise',
            href: 'https://example.com/contact',
            labels: { upgrade: 'Talk to us about Enterprise' },
          },
        ],
      },
      currentSelection: C,
    });
    await expect(planCta(page, 'starter')).toHaveText('Move to Starter');
    await expect(planCta(page, 'growth')).toHaveText('Your current plan');
    await expect(planCta(page, 'enterprise')).toHaveText('Talk to us about Enterprise');
  });

  test('a label that is not a string is ignored', async ({ page }) => {
    await setProps(page, {
      presentation: {
        ctas: [
          {
            id: 'start-starter',
            label: 'Start with Starter',
            planId: 'starter',
            labels: { downgrade: 42 },
          },
        ],
      },
      currentSelection: C,
    });
    await expect(planCta(page, 'starter')).toHaveText('Downgrade to Starter');
  });
});

// [utest->req~cta-contact-sales~1]
test('a plan without a price is labelled Contact sales', async ({ page }) => {
  await addRenderer(page, { pricing: PQ, currentSelection: { planId: 'basic' } });
  await expect(planCta(page, 'basic', '#extra')).toHaveText('Current plan');
  await expect(planCta(page, 'pro', '#extra')).toHaveText('Upgrade to Pro');
  const enterprise = planCta(page, 'enterprise', '#extra');
  await expect(enterprise).toHaveText('Contact sales');
  await expect(enterprise).toHaveAttribute('data-relation', 'upgrade');
});

// [utest->req~cta-summary-action~1]
test('the summary action reviews the change and is outside every live region', async ({ page }) => {
  await applyAndMarkContract(page);
  await page.locator(radio('enterprise')).check({ force: true });
  const action = summaryAction(page);
  await expect(action).toHaveText('Review change (€75)');
  await expect(action).toBeEnabled();
  const liveAncestor = await action.evaluate((element) =>
    element.closest('[aria-live]:not([aria-live="off"])'),
  );
  expect(liveAncestor).toBeNull();
});

// [utest->req~cta-summary-action-quote~1]
test('the summary action asks for a quote when the selection requires one', async ({ page }) => {
  await addRenderer(page, { pricing: PQ, currentSelection: { planId: 'basic' } });
  await page.locator(radio('enterprise', '#extra')).check({ force: true });
  const action = summaryAction(page, '#extra');
  await expect(action).toHaveText('Contact sales');
  await expect(action).toBeEnabled();
});

// [utest->req~cta-summary-action-current~1]
test('the summary action is disabled while the selection equals the contract', async ({ page }) => {
  await applyAndMarkContract(page);
  const action = summaryAction(page);
  await expect(action).toBeDisabled();
  await expect(action).toHaveText('Review change (€80)');
});

// [utest->req~cta-summary-action-event~1]
test.describe('summary action event', () => {
  test('review an upgrade', async ({ page }) => {
    await applyAndMarkContract(page);
    await page.locator(radio('enterprise')).check({ force: true });
    await recordActions(page, { cancel: true });
    await summaryAction(page).click();
    const actions = await recordedActions(page);
    expect(actions).toHaveLength(1);
    expect(actions[0]?.detail).toEqual({
      actionId: 'review-change',
      planId: 'enterprise',
      relation: 'upgrade',
      source: 'summary',
      subtotal: 75,
    });
    expect(actions[0]?.cancelable).toBe(true);
  });

  test('contact sales', async ({ page }) => {
    await addRenderer(page, { pricing: PQ, currentSelection: { planId: 'basic' } });
    await page.locator(radio('enterprise', '#extra')).check({ force: true });
    await recordActions(page, { selector: '#extra', cancel: true });
    await summaryAction(page, '#extra').click();
    const actions = await recordedActions(page);
    expect(actions).toHaveLength(1);
    expect(actions[0]?.detail).toMatchObject({
      actionId: 'contact-sales',
      planId: 'enterprise',
      relation: 'upgrade',
      source: 'summary',
    });
  });
});

// [utest->req~cta-summary-action-absent~1]
test('no summary action without ctas or without a known current plan', async ({ page }) => {
  const action = summaryAction(page);
  await expect(action).toHaveCount(0);
  await setProps(page, { currentSelection: C, ctaEnabled: false });
  await expect(action).toHaveCount(0);
  await setProps(page, { currentSelection: { planId: 'legacy' }, ctaEnabled: true });
  await expect(action).toHaveCount(0);
});

// [utest->req~cta-href-template~1]
test.describe('plan id in CTA links', () => {
  test('Growth signup link', async ({ page }) => {
    await setProps(page, {
      presentation: {
        ctas: [
          {
            id: 'start-growth',
            label: 'Start free trial',
            planId: 'growth',
            href: 'https://example.com/signup?plan={planId}',
          },
        ],
      },
    });
    await recordActions(page, { cancel: true });
    const growth = planCta(page, 'growth');
    await growth.click();
    await expect(growth).toHaveAttribute('href', 'https://example.com/signup?plan=growth');
    const actions = await recordedActions(page);
    expect(actions[0]?.detail.href).toBe('https://example.com/signup?plan=growth');
  });

  test('reserved characters are encoded', async ({ page }) => {
    await addRenderer(page, {
      pricing: PS,
      presentation: {
        ctas: [
          {
            id: 'go',
            label: 'Go',
            planId: 'pro plus/x',
            href: '/checkout/{planId}?again={planId}',
          },
        ],
      },
    });
    const cta = planCta(page, 'pro plus/x', '#extra');
    await expect(cta).toHaveJSProperty('tagName', 'A');
    await expect(cta).toHaveAttribute('href', '/checkout/pro%20plus%2Fx?again=pro%20plus%2Fx');
  });
});

// [utest->req~cta-href-template-unsafe~1]
test('an expanded link that is not safe renders as a button', async ({ page }) => {
  await addRenderer(page, {
    pricing: PS,
    presentation: {
      ctas: [{ id: 'bad', label: 'Bad', planId: 'javascript:alert(1)', href: '{planId}' }],
    },
  });
  const cta = planCta(page, 'javascript:alert(1)', '#extra');
  await expect(cta).toHaveJSProperty('tagName', 'BUTTON');
  await expect(cta).toHaveText('Bad');
  await expect(cta).not.toHaveAttribute('href', /.*/);
});

// [utest->req~cta-event-relation~1]
test('plan CTA events carry the relation and the source', async ({ page }) => {
  await setProps(page, { currentSelection: C });
  await recordActions(page, { cancel: true });
  await planCta(page, 'enterprise').click();
  await planCta(page, 'starter').click();
  const actions = await recordedActions(page);
  expect(actions.map((action) => action.detail)).toEqual([
    {
      actionId: 'contact-enterprise',
      planId: 'enterprise',
      href: 'https://example.com/contact',
      relation: 'upgrade',
      source: 'plan',
      subtotal: 20,
    },
    {
      actionId: 'start-starter',
      planId: 'starter',
      relation: 'downgrade',
      source: 'plan',
      subtotal: 20,
    },
  ]);
});

// [utest->req~cta-event-unchanged~1]
test('without a current plan the event detail is the 0.1.0 detail', async ({ page }) => {
  await recordActions(page);
  await planCta(page, 'starter').click();
  const actions = await recordedActions(page);
  expect(actions[0]?.keys).toEqual(['actionId', 'planId', 'resolved', 'selection']);
});
