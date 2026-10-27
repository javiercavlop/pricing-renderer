import { expect, test } from '@playwright/test';
import {
  addRenderer,
  C,
  countEvents,
  eventCount,
  markers,
  openDemo,
  planCta,
  PV,
  recordDiagnostics,
  recordedDiagnostics,
  renderedDiagnosticCount,
  setProps,
} from './helpers/change-flow.js';

// The current selection of the element (add-subscription-change-flow, phase C). The scenarios are
// those of openspec/changes/add-subscription-change-flow/specs/current-selection/spec.md; the
// definitions (C, PV) are in its design.md. The unit tests of the types, the messages and the
// manifest are in tests/unit/change-flow-element.test.ts.

const planCard = '[data-pr-part="plan-card"]';
const addOnCard = '[data-pr-part="add-on-card"]';

test.beforeEach(async ({ page }) => {
  await openDemo(page);
});

// [utest->req~current-selection-plan-mark~1]
test.describe('current plan mark', () => {
  test('Growth contract: one card is current and has the badge', async ({ page }) => {
    await setProps(page, { currentSelection: C });
    const current = page.locator(`pricing-renderer ${planCard}[data-current]`);
    await expect(current).toHaveCount(1);
    await expect(current).toHaveAttribute('data-plan-id', 'growth');
    await expect(current).toHaveAttribute('data-current', 'true');
    await expect(current.locator('[data-pr-part="current-badge"]')).toHaveText('Your plan');
  });

  test('Spanish: the badge reads Tu plan', async ({ page }) => {
    await setProps(page, { currentSelection: C });
    await page.selectOption('#locale', 'es-ES');
    await expect(page.locator('pricing-renderer [data-pr-part="current-badge"]')).toHaveText(
      'Tu plan',
    );
  });
});

// [utest->req~current-selection-plan-cta~1]
test('the current plan CTA is a disabled Current plan button and sends no action', async ({
  page,
}) => {
  const growth = planCta(page, 'growth');
  await expect(growth).toHaveText('Start free trial');
  await expect(growth).toHaveJSProperty('tagName', 'A');
  await countEvents(page, 'pricing-action');
  await setProps(page, { currentSelection: C });
  await growth.click({ force: true });
  await expect(growth).toHaveJSProperty('tagName', 'BUTTON');
  await expect(growth).toBeDisabled();
  await expect(growth).not.toHaveAttribute('href', /.*/);
  await expect(growth).toHaveAttribute('data-relation', 'current');
  await expect(growth).toHaveText('Current plan');
  expect(await eventCount(page, 'pricing-action')).toBe(0);
});

// [utest->req~current-selection-relation-labels~1]
test.describe('other plans are labelled by relation', () => {
  test('Starter and Enterprise around Growth', async ({ page }) => {
    await setProps(page, { currentSelection: C });
    const starter = planCta(page, 'starter');
    await expect(starter).toHaveAttribute('data-relation', 'downgrade');
    await expect(starter).toHaveText('Downgrade to Starter');
    const enterprise = planCta(page, 'enterprise');
    await expect(enterprise).toHaveAttribute('data-relation', 'upgrade');
    await expect(enterprise).toHaveText('Upgrade to Enterprise');
    await expect(enterprise).toHaveAttribute('href', 'https://example.com/contact');
  });

  test('Spanish', async ({ page }) => {
    await setProps(page, { currentSelection: C });
    await page.selectOption('#locale', 'es-ES');
    await expect(planCta(page, 'starter')).toHaveText('Bajar a Starter');
    await expect(planCta(page, 'enterprise')).toHaveText('Mejorar a Enterprise');
  });
});

// [utest->req~current-selection-addons~1]
test.describe('current add-ons are marked', () => {
  test('Growth contract', async ({ page }) => {
    await setProps(page, { currentSelection: C });
    for (const id of ['extraStorage', 'prioritySuccess']) {
      const card = page.locator(`pricing-renderer ${addOnCard}[data-add-on-id="${id}"]`);
      await expect(card).toHaveAttribute('data-current', 'true');
      await expect(card.locator('[data-pr-part="current-add-on-badge"]')).toHaveText('Current');
    }
    const compliance = page.locator(`pricing-renderer ${addOnCard}[data-add-on-id="compliance"]`);
    await expect(compliance).not.toHaveAttribute('data-current', /.*/);
    await expect(compliance.locator('[data-pr-part="current-add-on-badge"]')).toHaveCount(0);
  });

  test('an add-on removed by reconciliation is not current', async ({ page }) => {
    await setProps(page, {
      currentSelection: {
        planId: 'starter',
        addOns: { extraStorage: { selected: true, quantity: 2 } },
      },
    });
    await expect(page.locator(`pricing-renderer ${addOnCard}[data-current]`)).toHaveCount(0);
  });

  test('add-ons without a plan are not marked', async ({ page }) => {
    await setProps(page, {
      currentSelection: { addOns: { extraStorage: { selected: true, quantity: 3 } } },
    });
    await expect(page.locator(`pricing-renderer ${markers}`)).toHaveCount(0);
  });
});

// [utest->req~current-selection-keeps-selection~1]
test.describe('the user selection is not changed', () => {
  test('uncontrolled element on Starter', async ({ page }) => {
    await countEvents(page, 'pricing-selection-change');
    await setProps(page, { currentSelection: C });
    const starterRadio = page.locator('pricing-renderer input[name="pr-plan"][value="starter"]');
    await expect(starterRadio).toBeChecked();
    await expect(page.locator('pricing-renderer .pr-summary')).toContainText('€20');
    const planId = await page.evaluate(
      () =>
        (
          document.querySelector('pricing-renderer') as HTMLElement & {
            resolvedState: { selection: { planId: string } };
          }
        ).resolvedState.selection.planId,
    );
    expect(planId).toBe('starter');
    expect(await eventCount(page, 'pricing-selection-change')).toBe(0);
  });

  test('controlled element keeps its selection object', async ({ page }) => {
    const result = await page.evaluate(async (current) => {
      const element = document.querySelector('pricing-renderer') as HTMLElement & {
        selection?: unknown;
        currentSelection?: unknown;
        resolvedState: { selection: unknown };
        updateComplete: Promise<unknown>;
      };
      const selection = structuredClone(element.resolvedState.selection);
      element.selection = selection;
      await element.updateComplete;
      const before = JSON.stringify(selection);
      element.currentSelection = current;
      await element.updateComplete;
      return {
        same: element.selection === selection,
        unchanged: JSON.stringify(selection) === before,
      };
    }, C);
    expect(result).toEqual({ same: true, unchanged: true });
  });
});

// [utest->req~current-selection-detached~1]
test('the element keeps a copy: a later change of the host object is not seen', async ({
  page,
}) => {
  const unchanged = await page.evaluate(async (current) => {
    const element = document.querySelector('pricing-renderer') as HTMLElement & {
      currentSelection?: unknown;
      requestUpdate: () => void;
      updateComplete: Promise<unknown>;
    };
    const input = structuredClone(current) as Record<string, unknown>;
    const copy = structuredClone(current) as Record<string, unknown>;
    element.currentSelection = input;
    await element.updateComplete;
    input.planId = 'starter';
    element.requestUpdate();
    await element.updateComplete;
    copy.planId = 'starter';
    return JSON.stringify(input) === JSON.stringify(copy);
  }, C);
  expect(unchanged).toBe(true);
  const growth = page.locator(`pricing-renderer ${planCard}[data-plan-id="growth"]`);
  const starter = page.locator(`pricing-renderer ${planCard}[data-plan-id="starter"]`);
  await expect(growth).toHaveAttribute('data-current', 'true');
  await expect(starter).not.toHaveAttribute('data-current', /.*/);
});

// [utest->req~current-selection-unknown-plan~1]
test('an unknown current plan marks nothing and keeps the 0.1.0 labels', async ({ page }) => {
  await setProps(page, { currentSelection: { planId: 'legacy' } });
  await expect(page.locator(`pricing-renderer ${markers}`)).toHaveCount(0);
  await expect(planCta(page, 'starter')).toHaveText('Start with Starter');
  await expect(planCta(page, 'growth')).toHaveText('Start free trial');
  await expect(planCta(page, 'enterprise')).toHaveText('Contact sales');
});

// [utest->req~current-selection-diagnostics~1]
test.describe('current selection diagnostics', () => {
  test('a legacy plan and a ghost add-on give one event, not rendered', async ({ page }) => {
    await recordDiagnostics(page);
    const before = await renderedDiagnosticCount(page);
    await setProps(page, {
      currentSelection: {
        planId: 'legacy',
        addOns: { ghost: { selected: true, quantity: 1 } },
      },
    });
    await page.evaluate(async () => {
      const element = document.querySelector('pricing-renderer') as HTMLElement & {
        requestUpdate: () => void;
        updateComplete: Promise<unknown>;
      };
      element.requestUpdate();
      await element.updateComplete;
    });
    const events = await recordedDiagnostics(page);
    expect(events).toHaveLength(1);
    expect(events[0]?.diagnostics.map((item) => [item.code, item.path, item.severity])).toEqual([
      ['PR_CURRENT_SELECTION_UNKNOWN_PLAN', 'currentSelection.planId', 'warning'],
      ['PR_CURRENT_SELECTION_UNKNOWN_ADDON', 'currentSelection.addOns.ghost', 'warning'],
    ]);
    expect(await renderedDiagnosticCount(page)).toBe(before);
  });

  test('known ids give no event', async ({ page }) => {
    await recordDiagnostics(page);
    await setProps(page, { currentSelection: C });
    expect(await recordedDiagnostics(page)).toEqual([]);
  });
});

// [utest->req~current-selection-private-plan~1]
test.describe('a private current plan', () => {
  test('hidden by public-only: the other plans are still labelled by relation', async ({
    page,
  }) => {
    await addRenderer(
      page,
      { pricing: PV, visibility: 'public-only', currentSelection: { planId: 'legacy' } },
      { diagnostics: true },
    );
    await expect(page.locator(`#extra ${planCard}[data-current]`)).toHaveCount(0);
    await expect(planCta(page, 'basic', '#extra')).toHaveText('Downgrade to Basic');
    await expect(planCta(page, 'pro', '#extra')).toHaveText('Upgrade to Pro');
    const codes = (await recordedDiagnostics(page)).flatMap((event) =>
      event.diagnostics.map((item) => item.code),
    );
    expect(codes).not.toContain('PR_CURRENT_SELECTION_UNKNOWN_PLAN');
  });

  test('visibility all: the Legacy card is current', async ({ page }) => {
    await addRenderer(page, {
      pricing: PV,
      visibility: 'public-only',
      currentSelection: { planId: 'legacy' },
    });
    await setProps(page, { visibility: 'all' }, '#extra');
    const legacy = page.locator(`#extra ${planCard}[data-plan-id="legacy"]`);
    await expect(legacy).toHaveAttribute('data-current', 'true');
    await expect(planCta(page, 'legacy', '#extra')).toHaveText('Current plan');
  });
});

// [utest->req~current-selection-unset~1]
test.describe('without a current selection nothing changes', () => {
  test('default demo page', async ({ page }) => {
    await expect(page.locator(`pricing-renderer ${markers}`)).toHaveCount(0);
    await expect(planCta(page, 'starter')).toHaveText('Start with Starter');
    await expect(planCta(page, 'growth')).toHaveText('Start free trial');
    await expect(planCta(page, 'enterprise')).toHaveText('Contact sales');
  });

  test('set, then cleared', async ({ page }) => {
    await setProps(page, { currentSelection: C });
    await expect(page.locator(`pricing-renderer ${planCard}[data-current]`)).toHaveCount(1);
    await setProps(page, { currentSelection: undefined });
    await expect(page.locator(`pricing-renderer ${markers}`)).toHaveCount(0);
    const growth = planCta(page, 'growth');
    await expect(growth).toHaveJSProperty('tagName', 'A');
    await expect(growth).toHaveText('Start free trial');
  });

  // The committed baselines of tests/browser/pricing-renderer.spec.ts set none of the new
  // properties, so that spec passes unchanged without --update-snapshots (run by the browser check).
});
