import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Locator, Page } from '@playwright/test';
import { compareSelections } from '../../../src/core/index.js';
import type { PricingSelection, SelectionComparison } from '../../../src/core/index.js';
import { parsePricingYaml } from '../../../src/yaml/index.js';

// Shared by the review page specs. The comparisons are those of the "Definitions" of
// openspec/changes/add-subscription-change-flow/design.md. They are computed here, in the test
// process, and passed to the page as JSON (they are JSON-safe).

type Raw = Record<string, unknown>;

const acmePath = fileURLToPath(new URL('../../fixtures/acme-pricing.yml', import.meta.url));
const acme = parsePricingYaml(readFileSync(acmePath, 'utf8')).value!;

// C: the Growth contract.
const contract: Partial<PricingSelection> = {
  planId: 'growth',
  addOns: {
    extraStorage: { selected: true, quantity: 2 },
    prioritySuccess: { selected: true, quantity: 1 },
  },
};

function side(selection: Partial<PricingSelection>) {
  return { pricing: acme, selection };
}

// Growth + 2 Extra Storage + Priority Success, upgraded to Enterprise.
export const R_ENT: SelectionComparison = compareSelections({
  before: side(contract),
  after: side({ ...contract, planId: 'enterprise' }),
});

// The same contract, downgraded to Starter with 150 GB in use.
export const R_START: SelectionComparison = compareSelections({
  before: side(contract),
  after: side({ ...contract, planId: 'starter' }),
  currentUsage: { storage: 150 },
});

// Nothing changes.
export const R_CUR: SelectionComparison = compareSelections({
  before: side(contract),
  after: side(contract),
});

export type RecordedReviewEvent = {
  bubbles: boolean;
  composed: boolean;
  cancelable: boolean;
  // the detail and the comparison of the element, as JSON, when the event was dispatched
  detail: { comparison?: unknown };
  elementComparison: unknown;
  sameObject: boolean;
  sameNestedObject: boolean;
};

type ReviewElement = HTMLElement & { updateComplete: Promise<unknown> };

type Store = { __reviewEvents?: Record<string, RecordedReviewEvent[]> };

// Appends a new <pricing-change-review id="review"> to the body with the given properties and
// waits for its first update. `locale` is en-US unless the properties name another.
export async function addReview(page: Page, props: Raw = {}): Promise<Locator> {
  await page.evaluate(async (props) => {
    const element = document.createElement('pricing-change-review') as ReviewElement;
    element.id = 'review';
    Object.assign(element, { locale: 'en-US' }, props);
    document.body.append(element);
    await element.updateComplete;
  }, props);
  return page.locator('#review');
}

// Sets properties on the review element and waits for the update that follows.
export async function setReview(page: Page, props: Raw): Promise<void> {
  await page.evaluate(async (props) => {
    const element = document.querySelector('#review') as ReviewElement;
    Object.assign(element, props);
    await element.updateComplete;
  }, props);
}

// Records every event of one name on the review element from now on. `cancel` calls
// preventDefault() on each of them.
export async function recordReviewEvents(
  page: Page,
  name: string,
  options: { cancel?: boolean } = {},
): Promise<void> {
  await page.evaluate(
    ({ name, cancel }) => {
      const element = document.querySelector('#review') as ReviewElement & {
        comparison?: Record<string, unknown>;
      };
      const store = window as unknown as Store;
      const events = (store.__reviewEvents ??= {});
      const list: RecordedReviewEvent[] = (events[name] = []);
      element.addEventListener(name, (event) => {
        if (cancel) event.preventDefault();
        const detail = (event as CustomEvent<{ comparison?: Record<string, unknown> }>).detail;
        list.push({
          bubbles: event.bubbles,
          composed: event.composed,
          cancelable: event.cancelable,
          detail: JSON.parse(JSON.stringify(detail)),
          elementComparison: JSON.parse(JSON.stringify(element.comparison ?? null)),
          sameObject: detail.comparison === element.comparison,
          sameNestedObject: detail.comparison?.plan === element.comparison?.plan,
        });
      });
    },
    { name, cancel: options.cancel ?? false },
  );
}

export async function reviewEvents(page: Page, name: string): Promise<RecordedReviewEvent[]> {
  return page.evaluate((name) => (window as unknown as Store).__reviewEvents?.[name] ?? [], name);
}

export const confirmButton = '#review [data-pr-part="review-confirm"]';
export const backButton = '#review [data-pr-part="review-back"]';
