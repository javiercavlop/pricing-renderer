import { expect, test, type Page } from '@playwright/test';
import { openRenderer } from './helpers/spectra.js';

// Two renderers on one page must not share an id, and every ARIA reference must stay inside its own
// renderer. The unit test with the same name is tests/unit/element-instance-ids.test.ts.
// [utest->req~element-instance-ids~1]

type InstanceElement = HTMLElement & {
  yaml?: string;
  updateComplete: Promise<unknown>;
  requestUpdate(): void;
  _pendingAddOnChange?: { addIds: string[]; removeIds: string[] };
};

// Adds a second renderer with the pricing of the first one and waits until it shows its plans.
async function addSecondRenderer(page: Page): Promise<void> {
  await page.evaluate(() => {
    const source = (document.querySelector('pricing-renderer') as InstanceElement).yaml;
    const renderer = document.createElement('pricing-renderer') as InstanceElement;
    renderer.id = 'second';
    renderer.yaml = source;
    document.body.append(renderer);
  });
  await expect(page.locator('#second [data-pr-part="plans"]')).toHaveCount(1);
}

// Opens the add-on confirmation dialog of every renderer, so every id of the element is rendered.
async function openDialogs(page: Page): Promise<void> {
  await page.evaluate(async () => {
    for (const renderer of document.querySelectorAll<InstanceElement>('pricing-renderer')) {
      const addOnId = renderer.querySelector<HTMLElement>('[data-add-on-id]')?.dataset.addOnId;
      if (!addOnId) continue;
      renderer._pendingAddOnChange = { addIds: [addOnId], removeIds: [] };
      renderer.requestUpdate();
      await renderer.updateComplete;
    }
  });
}

test.beforeEach(async ({ page }) => {
  await openRenderer(page, { width: 1280, height: 800 });
  await addSecondRenderer(page);
  await openDialogs(page);
});

test('no id appears twice in the document', async ({ page }) => {
  const duplicates = await page.evaluate(() => {
    const seen = new Map<string, number>();
    for (const element of document.querySelectorAll('[id]')) {
      seen.set(element.id, (seen.get(element.id) ?? 0) + 1);
    }
    return [...seen].filter(([, count]) => count > 1).map(([id]) => id);
  });
  expect(duplicates).toEqual([]);
});

test('every ARIA reference stays inside its renderer', async ({ page }) => {
  const unresolved = await page.evaluate(() => {
    const result: string[] = [];
    for (const renderer of document.querySelectorAll('pricing-renderer')) {
      const own = new Set([...renderer.querySelectorAll('[id]')].map((element) => element.id));
      for (const element of renderer.querySelectorAll(
        '[aria-labelledby], [aria-describedby], [aria-controls], [for]',
      )) {
        const values = ['aria-labelledby', 'aria-describedby', 'aria-controls', 'for']
          .map((name) => element.getAttribute(name))
          .filter((value): value is string => Boolean(value))
          .flatMap((value) => value.split(/\s+/));
        for (const value of values) if (!own.has(value)) result.push(value);
      }
    }
    return result;
  });
  expect(unresolved).toEqual([]);
});

test('each dialog is labelled by its own title', async ({ page }) => {
  const dialogs = page.locator('pricing-renderer .pr-dialog');
  await expect(dialogs).toHaveCount(2);
  const labels = await dialogs.evaluateAll((nodes) =>
    nodes.map((node) => {
      const owner = node.closest('pricing-renderer')!;
      const title = owner.querySelector(`[id="${node.getAttribute('aria-labelledby')}"]`);
      const description = owner.querySelector(`[id="${node.getAttribute('aria-describedby')}"]`);
      return {
        titleInside: title !== null && node.contains(title),
        descriptionInside: description !== null && node.contains(description),
        labelledby: node.getAttribute('aria-labelledby'),
      };
    }),
  );
  for (const label of labels) {
    expect(label.titleInside).toBe(true);
    expect(label.descriptionInside).toBe(true);
  }
  expect(labels[0]!.labelledby).not.toBe(labels[1]!.labelledby);
});
