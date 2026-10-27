import { expect, type Locator, type Page } from '@playwright/test';

// Shared by current-selection.spec.ts and plan-cta.spec.ts. The fixtures are the definitions of
// openspec/changes/add-subscription-change-flow/design.md (C, PV, PQ, PS). This module imports
// @playwright/test, so vitest cannot load it.

type Raw = Record<string, unknown>;

// C: the Growth contract of the Acme demo pricing.
export const C = {
  planId: 'growth',
  addOns: {
    extraStorage: { selected: true, quantity: 2 },
    prioritySuccess: { selected: true, quantity: 1 },
  },
};

const header = {
  syntaxVersion: '3.1',
  version: '1',
  createdAt: '2026-01-01',
  currency: 'EUR',
};

// PV: a private plan between two public ones.
export const PV: Raw = {
  ...header,
  saasName: 'Private',
  plans: { basic: { price: 10 }, legacy: { price: 15, private: true }, pro: { price: 30 } },
};

// PQ: Enterprise has a label price, so it requires a quote.
export const PQ: Raw = {
  ...header,
  saasName: 'Quote',
  plans: { basic: { price: 10 }, pro: { price: 30 }, enterprise: { price: 'Contact us' } },
};

// PS: plan ids with reserved characters.
export const PS: Raw = {
  ...header,
  saasName: 'Slash',
  plans: { 'pro plus/x': { price: 5 }, 'javascript:alert(1)': { price: 6 } },
};

export type RecordedAction = {
  keys: string[];
  cancelable: boolean;
  detail: {
    actionId: string;
    planId?: string;
    href?: string;
    relation?: string;
    source?: string;
    subtotal: number;
  };
};

export type RecordedDiagnostic = {
  diagnostics: { code: string; severity: string; path?: string }[];
};

// What the recorders keep on the page, as plain data.
type Store = {
  __actions?: RecordedAction[];
  __diagnostics?: RecordedDiagnostic[];
  __counts?: Record<string, number>;
};

type ChangeFlowElement = HTMLElement & {
  updateComplete: Promise<unknown>;
  applySelection: (selection: unknown) => unknown;
  pendingActionId?: string;
};

// The demo page (Acme, en-US, Starter selected, EUR 20 in the summary).
export async function openDemo(page: Page, width = 1440, height = 900): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto('/');
  await expect(page.locator('pricing-renderer .pr-plan-card')).toHaveCount(3);
  await expect(page.locator('pricing-renderer .pr-summary')).toContainText('€20');
}

// Sets properties on the element and waits for the update that follows.
export async function setProps(
  page: Page,
  props: Raw,
  selector = 'pricing-renderer',
): Promise<void> {
  await page.evaluate(
    async ({ props, selector }) => {
      const element = document.querySelector(selector) as ChangeFlowElement | null;
      if (!element) throw new Error(`${selector} was not found.`);
      Object.assign(element, props);
      await element.updateComplete;
    },
    { props, selector },
  );
}

// Calls applySelection(selection) and waits for the update that follows.
export async function applyContract(
  page: Page,
  selection: unknown = C,
  selector = 'pricing-renderer',
): Promise<void> {
  await page.evaluate(
    async ({ selection, selector }) => {
      const element = document.querySelector(selector) as ChangeFlowElement;
      element.applySelection(selection);
      await element.updateComplete;
    },
    { selection, selector },
  );
}

// Appends a new <pricing-renderer id="extra"> with the given properties and waits until it is
// ready and rendered. Its locale is en-US. With `diagnostics`, its pricing-diagnostic events are
// recorded from the start (read them with recordedDiagnostics).
export async function addRenderer(
  page: Page,
  props: Raw,
  options: { diagnostics?: boolean } = {},
): Promise<Locator> {
  await page.evaluate(
    async ({ props, diagnostics }) => {
      const element = document.createElement('pricing-renderer') as ChangeFlowElement;
      element.id = 'extra';
      Object.assign(element, { locale: 'en-US' }, props);
      const ready = new Promise<void>((resolve) => {
        element.addEventListener('pricing-ready', () => resolve(), { once: true });
      });
      if (diagnostics) {
        const store: RecordedDiagnostic[] = [];
        (window as unknown as Store).__diagnostics = store;
        element.addEventListener('pricing-diagnostic', ((event: CustomEvent) => {
          const items = event.detail.diagnostics as RecordedDiagnostic['diagnostics'];
          store.push({ diagnostics: items.map(({ code, severity }) => ({ code, severity })) });
        }) as EventListener);
      }
      document.body.append(element);
      await ready;
      await element.updateComplete;
    },
    { props, diagnostics: options.diagnostics ?? false },
  );
  return page.locator('#extra');
}

// Records the pricing-action events of the element as plain data. `cancel` calls preventDefault()
// on each, so link CTAs do not navigate. `pendingFromAction` sets pendingActionId to the action id.
export async function recordActions(
  page: Page,
  options: { selector?: string; cancel?: boolean; pendingFromAction?: boolean } = {},
): Promise<void> {
  await page.evaluate(
    ({ selector, cancel, pendingFromAction }) => {
      const element = document.querySelector(selector) as ChangeFlowElement;
      const store: RecordedAction[] = [];
      (window as unknown as Store).__actions = store;
      element.addEventListener('pricing-action', ((event: CustomEvent) => {
        const detail = event.detail as Record<string, unknown> & { resolved: { subtotal: number } };
        if (cancel) event.preventDefault();
        if (pendingFromAction) element.pendingActionId = detail.actionId as string;
        const copy = (key: string): Partial<RecordedAction['detail']> =>
          (key in detail ? { [key]: detail[key] } : {}) as Partial<RecordedAction['detail']>;
        store.push({
          keys: Object.keys(detail).sort(),
          cancelable: event.cancelable,
          detail: {
            actionId: detail.actionId as string,
            ...copy('planId'),
            ...copy('href'),
            ...copy('relation'),
            ...copy('source'),
            subtotal: detail.resolved.subtotal,
          },
        });
      }) as EventListener);
    },
    {
      selector: options.selector ?? 'pricing-renderer',
      cancel: options.cancel ?? false,
      pendingFromAction: options.pendingFromAction ?? false,
    },
  );
}

export async function recordedActions(page: Page): Promise<RecordedAction[]> {
  return page.evaluate(() => (window as unknown as Store).__actions ?? []);
}

// Records every pricing-diagnostic event of the element (codes, severities and paths).
export async function recordDiagnostics(page: Page, selector = 'pricing-renderer'): Promise<void> {
  await page.evaluate((selector) => {
    const element = document.querySelector(selector) as HTMLElement;
    const store: RecordedDiagnostic[] = [];
    (window as unknown as Store).__diagnostics = store;
    element.addEventListener('pricing-diagnostic', ((event: CustomEvent) => {
      const items = event.detail.diagnostics as RecordedDiagnostic['diagnostics'];
      store.push({
        diagnostics: items.map((item) => ({
          code: item.code,
          severity: item.severity,
          ...(item.path !== undefined ? { path: item.path } : {}),
        })),
      });
    }) as EventListener);
  }, selector);
}

export async function recordedDiagnostics(page: Page): Promise<RecordedDiagnostic[]> {
  return page.evaluate(() => (window as unknown as Store).__diagnostics ?? []);
}

// Counts the events of one name on the element from now on; read the count with eventCount().
export async function countEvents(
  page: Page,
  name: string,
  selector = 'pricing-renderer',
): Promise<void> {
  await page.evaluate(
    ({ name, selector }) => {
      const element = document.querySelector(selector) as HTMLElement;
      const store = window as unknown as Store;
      const counts = (store.__counts ??= {});
      counts[name] = 0;
      element.addEventListener(name, () => {
        counts[name] = (counts[name] ?? 0) + 1;
      });
    },
    { name, selector },
  );
}

export async function eventCount(page: Page, name: string): Promise<number> {
  return page.evaluate((name) => (window as unknown as Store).__counts?.[name] ?? 0, name);
}

// Number of items in the rendered diagnostics list (0 when the list is absent).
export async function renderedDiagnosticCount(
  page: Page,
  selector = 'pricing-renderer',
): Promise<number> {
  return page.locator(`${selector} [data-pr-part="diagnostics"] li`).count();
}

// The CTA of a plan card.
export function planCta(page: Page, planId: string, selector = 'pricing-renderer'): Locator {
  const card = `${selector} [data-pr-part="plan-card"][data-plan-id="${planId}"]`;
  return page.locator(`${card} [data-pr-part="cta"]`);
}

export function summaryAction(page: Page, selector = 'pricing-renderer'): Locator {
  return page.locator(`${selector} [data-pr-part="summary-action"]`);
}

export const markers = [
  '[data-current]',
  '[data-relation]',
  '[data-pr-part="current-badge"]',
  '[data-pr-part="current-add-on-badge"]',
].join(', ');
