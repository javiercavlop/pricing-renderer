import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

type Viewport = { width: number; height: number };
type Metrics = Record<string, unknown>;

const fixturesRoot = fileURLToPath(new URL('../fixtures/spectra/', import.meta.url));

const fixtures = readdirSync(fixturesRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const years = readdirSync(`${fixturesRoot}${entry.name}`)
      .filter((file) => file.endsWith('.yml'))
      .sort();
    return { saas: entry.name, file: years[years.length - 1] };
  })
  .filter((fixture): fixture is { saas: string; file: string } => fixture.file !== undefined)
  .sort((a, b) => a.saas.localeCompare(b.saas));

const readFixture = (saas: string): string => {
  const fixture = fixtures.find((candidate) => candidate.saas === saas);
  if (!fixture) throw new Error(`Spectra fixture "${saas}" was not found.`);
  return readFileSync(`${fixturesRoot}${fixture.saas}/${fixture.file}`, 'utf8');
};

const viewports: Viewport[] = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 375, height: 812 },
];

const extremes = [
  'okta',
  'zoom',
  'clickup',
  'webflow',
  'salesforce',
  'github',
  'dropbox',
  'figma',
].filter((saas) => fixtures.some((fixture) => fixture.saas === saas));

const yearlySaas = ['zoom', 'webflow'];

test.beforeEach(({ browserName }) => {
  test.skip(browserName !== 'chromium', 'The visual review runs in chromium only.');
});

async function openRenderer(page: Page, viewport: Viewport): Promise<void> {
  await page.setViewportSize(viewport);
  await page.goto('/');
  await expect(page.locator('pricing-renderer .pr-plan-card')).toHaveCount(3);
}

async function applyPricing(
  page: Page,
  yaml: string,
  locale: string,
  theme: string,
): Promise<string> {
  const state = await page.evaluate(
    ({ yaml, locale, theme }) => {
      const renderer = document.querySelector('pricing-renderer') as
        | (HTMLElement & {
            yaml: string;
            locale: string;
            theme: string;
            updateComplete: Promise<unknown>;
            reload: () => Promise<unknown>;
          })
        | null;
      if (!renderer) throw new Error('Pricing renderer was not found.');
      const ready = new Promise<string>((resolve) => {
        const timer = window.setTimeout(() => resolve('timeout'), 20_000);
        renderer.addEventListener(
          'pricing-ready',
          () => {
            window.clearTimeout(timer);
            resolve('ready');
          },
          { once: true },
        );
      });
      renderer.locale = locale;
      renderer.theme = theme;
      document.documentElement.dataset.theme = theme;
      if (renderer.yaml === yaml) void renderer.reload();
      else renderer.yaml = yaml;
      return ready.then(async (result) => {
        await renderer.updateComplete;
        await document.fonts.ready;
        for (let frame = 0; frame < 3; frame += 1) {
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
        await renderer.updateComplete;
        return result;
      });
    },
    { yaml, locale, theme },
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  return state;
}

function collectMetrics(viewport: Viewport) {
  const renderer = document.querySelector('pricing-renderer') as HTMLElement;
  window.scrollTo(0, 0);
  const viewportHeight = window.innerHeight;
  const round = (value: number) => Math.round(value * 100) / 100;
  const describe = (element: Element) => {
    const names = Array.from(element.classList).slice(0, 2);
    const classes = names.map((name) => `.${name}`).join('');
    const part = element.getAttribute('data-pr-part');
    return `${element.tagName.toLowerCase()}${classes}${part ? `[data-pr-part=${part}]` : ''}`;
  };
  const snippet = (element: Element) =>
    (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
  const isRendered = (element: Element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== 'hidden';
  };
  const range = (values: number[]) =>
    values.length === 0
      ? null
      : { min: round(Math.min(...values)), max: round(Math.max(...values)) };
  const everyElement = [renderer, ...renderer.querySelectorAll('*')];

  const planCards = [...renderer.querySelectorAll('.pr-plan-card')];
  const planRects = planCards.map((card) => card.getBoundingClientRect());
  const rowBuckets = new Map<number, number>();
  for (const rect of planRects) {
    const top = Math.round(rect.top + window.scrollY);
    rowBuckets.set(top, (rowBuckets.get(top) ?? 0) + 1);
  }
  const rowTops = [...rowBuckets.keys()].sort((a, b) => a - b);
  const cardsPerRow = rowTops.map((top) => rowBuckets.get(top));
  const visiblePlanCards = planRects.filter((rect) => rect.top < viewportHeight && rect.bottom > 0);
  const addOnRects = [...renderer.querySelectorAll('.pr-addon-card')].map((card) =>
    card.getBoundingClientRect(),
  );

  const comparisonRows = [...renderer.querySelectorAll('[data-pr-part="comparison-row"]')];
  const table = renderer.querySelector('.pr-comparison-table');
  const comparisonLayout = table
    ? 'table'
    : renderer.querySelector('.pr-compact-comparison')
      ? 'cards'
      : 'none';
  const positionOf = (element: Element | null) =>
    element ? getComputedStyle(element).position : null;
  const isPinned = (position: string | null) =>
    position === null ? null : position === 'sticky' || position === 'fixed';

  const firstPrice = renderer.querySelector('.pr-plan-card .pr-price');
  const firstCta = renderer.querySelector('[data-pr-part="cta"]');
  const summary = renderer.querySelector('.pr-summary');
  const summaryRect = summary?.getBoundingClientRect();

  const overflowing: string[] = [];
  const truncated: { selector: string; text: string }[] = [];
  let truncatedCount = 0;
  for (const element of everyElement) {
    const style = getComputedStyle(element);
    if (style.display === 'inline' || style.display === 'contents') continue;
    if (element.clientWidth <= 1) continue;
    if (element.scrollWidth > element.clientWidth + 1) {
      const scroller = style.overflowX === 'auto' || style.overflowX === 'scroll';
      overflowing.push(`${describe(element)}${scroller ? ' (scroll container)' : ''}`);
      const clips =
        style.overflowX === 'hidden' ||
        style.overflowX === 'clip' ||
        style.textOverflow === 'ellipsis';
      if (clips) {
        truncatedCount += 1;
        if (truncated.length < 5) {
          truncated.push({ selector: describe(element), text: snippet(element) });
        }
      }
    }
    const clamp = style.getPropertyValue('-webkit-line-clamp');
    if (clamp && clamp !== 'none' && element.scrollHeight > element.clientHeight + 1) {
      truncatedCount += 1;
      if (truncated.length < 5) {
        truncated.push({ selector: `${describe(element)} (line-clamp)`, text: snippet(element) });
      }
    }
  }

  // Best effort: a word (split on whitespace, without hyphens, slashes or soft hyphens)
  // whose own client rects sit on more than one line was split by overflow-wrap.
  let awkwardBreaks = 0;
  const awkwardExamples: string[] = [];
  let inspectedWords = 0;
  const separators = new RegExp('[-/\\u00ad\\u2010-\\u2014]');
  const walker = document.createTreeWalker(renderer, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    const value = node.textContent ?? '';
    if (!parent || !value.trim() || !isRendered(parent)) continue;
    if (parent.closest('script, style, .pr-sr-only')) continue;
    for (const match of value.matchAll(/\S{4,}/g)) {
      if (inspectedWords >= 6000) break;
      if (separators.test(match[0])) continue;
      inspectedWords += 1;
      const wordRange = document.createRange();
      wordRange.setStart(node, match.index ?? 0);
      wordRange.setEnd(node, (match.index ?? 0) + match[0].length);
      const tops = new Set([...wordRange.getClientRects()].map((rect) => Math.round(rect.top)));
      const lines = [...tops].sort((a, b) => a - b);
      if (lines.length > 1 && lines[lines.length - 1] - lines[0] > 4) {
        awkwardBreaks += 1;
        if (awkwardExamples.length < 5) awkwardExamples.push(`${describe(parent)}: ${match[0]}`);
      }
    }
  }

  const rendererHeight = renderer.getBoundingClientRect().height;
  return {
    viewport,
    rendererHeight: round(rendererHeight),
    documentHeight: document.documentElement.scrollHeight,
    rendererHeightInViewports: round(rendererHeight / viewportHeight),
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    rendererOverflowX: { count: overflowing.length, examples: overflowing.slice(0, 5) },
    planCardCount: planCards.length,
    planCardWidths: range(planRects.map((rect) => rect.width)),
    planCardsPerRow: cardsPerRow,
    addOnCardCount: addOnRects.length,
    addOnCardHeights: range(addOnRects.map((rect) => rect.height)),
    comparisonRows: {
      rendered: comparisonRows.length,
      visible: comparisonRows.filter(isRendered).length,
    },
    comparisonLayout,
    firstViewport: {
      planCardsVisible: visiblePlanCards.length,
      firstPriceVisible: firstPrice
        ? firstPrice.getBoundingClientRect().bottom <= viewportHeight
        : false,
      firstCtaVisible: firstCta ? firstCta.getBoundingClientRect().bottom <= viewportHeight : false,
      summaryVisible: summaryRect
        ? summaryRect.height > 0 && summaryRect.top < viewportHeight && summaryRect.bottom > 0
        : false,
    },
    stickyHeader: isPinned(positionOf(renderer.querySelector('.pr-comparison-table thead th'))),
    stickyFirstColumn: isPinned(
      positionOf(
        renderer.querySelector(
          '.pr-comparison-table tbody tr[data-pr-part="comparison-row"] > :first-child',
        ),
      ),
    ),
    truncatedTexts: { count: truncatedCount, examples: truncated },
    awkwardBreaks: { count: awkwardBreaks, examples: awkwardExamples },
  };
}

async function contrast(page: Page): Promise<Metrics> {
  const results = await new AxeBuilder({ page })
    .include('pricing-renderer')
    .withRules(['color-contrast'])
    .analyze();
  const nodes = results.violations.flatMap((violation) => violation.nodes);
  return {
    contrastViolations: nodes.length,
    contrastExamples: nodes.slice(0, 5).map((node) => ({
      target: node.target.join(' '),
      summary: node.any[0]?.message ?? node.failureSummary ?? '',
    })),
  };
}

async function report(testInfo: TestInfo, name: string, metrics: Metrics): Promise<void> {
  const body = JSON.stringify(metrics);
  // eslint-disable-next-line no-console
  console.log(`SPECTRA_METRICS ${body}`);
  await testInfo.attach(`${name}-metrics`, { body, contentType: 'application/json' });
}

async function measure(
  page: Page,
  testInfo: TestInfo,
  name: string,
  base: Metrics,
  withContrast: boolean,
  viewport: Viewport,
): Promise<void> {
  const metrics = await page.evaluate(collectMetrics, viewport);
  const extra = withContrast ? await contrast(page) : {};
  await report(testInfo, name, { ...base, ...metrics, ...extra });
}

async function snap(page: Page, testInfo: TestInfo, name: string, clip?: Viewport): Promise<void> {
  const body = await page.screenshot(
    clip
      ? { type: 'jpeg', quality: 70, clip: { x: 0, y: 0, ...clip } }
      : { type: 'jpeg', quality: 70, fullPage: true },
  );
  await testInfo.attach(name, { body, contentType: 'image/jpeg' });
}

async function expectRendered(
  page: Page,
  state: string,
  metrics: { rendererHeight?: unknown; planCardCount?: unknown },
  saas: string,
): Promise<void> {
  expect(state).toBe('ready');
  if (saas === 'okta') expect(metrics.planCardCount).toBe(0);
  await expect(page.locator('pricing-renderer .pr-skeleton')).toHaveCount(0);
  expect(Number(metrics.rendererHeight)).toBeGreaterThan(0);
}

test.describe('spectra metrics', () => {
  for (const fixture of fixtures) {
    for (const viewport of viewports) {
      const label = `${viewport.width}x${viewport.height}`;
      test(`${fixture.saas} ${label}`, async ({ page }, testInfo) => {
        test.setTimeout(60_000);
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await openRenderer(page, viewport);
        const state = await applyPricing(page, readFixture(fixture.saas), 'en', 'light');
        const name = `${fixture.saas}-${viewport.width}-light-en`;
        const metrics = await page.evaluate(collectMetrics, viewport);
        await report(testInfo, name, {
          fixture: fixture.saas,
          theme: 'light',
          locale: 'en',
          ...metrics,
        });
        await expectRendered(page, state, metrics, fixture.saas);
        expect(errors).toEqual([]);
      });
    }
  }
});

test.describe('spectra captures', () => {
  for (const saas of extremes) {
    for (const viewport of viewports) {
      test(`${saas} ${viewport.width}`, async ({ page }, testInfo) => {
        test.setTimeout(120_000);
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        const yaml = readFixture(saas);
        const narrowOrWide = viewport.width === 1440 || viewport.width === 375;
        const variants = [
          { theme: 'light', locale: 'en', fold: narrowOrWide },
          ...(narrowOrWide
            ? [
                { theme: 'dark', locale: 'en', fold: false },
                { theme: 'light', locale: 'es', fold: false },
              ]
            : []),
        ];
        await openRenderer(page, viewport);
        for (const variant of variants) {
          const name = `${saas}-${viewport.width}-${variant.theme}-${variant.locale}`;
          const state = await applyPricing(page, yaml, variant.locale, variant.theme);
          const metrics = await page.evaluate(collectMetrics, viewport);
          if (variant.fold) await snap(page, testInfo, `${name}-fold`, viewport);
          await snap(page, testInfo, name);
          await measure(
            page,
            testInfo,
            name,
            { fixture: saas, theme: variant.theme, locale: variant.locale },
            true,
            viewport,
          );
          await expectRendered(page, state, metrics, saas);
        }
        expect(errors).toEqual([]);
      });
    }
  }

  for (const saas of yearlySaas.filter((id) => extremes.includes(id))) {
    test(`${saas} yearly 1440`, async ({ page }, testInfo) => {
      test.setTimeout(60_000);
      const viewport = viewports[0];
      await openRenderer(page, viewport);
      const state = await applyPricing(page, readFixture(saas), 'en', 'light');
      const yearly = page.locator('pricing-renderer input[name="pr-billing"]').last();
      await expect(yearly).toHaveCount(1);
      await yearly.evaluate((input: HTMLInputElement) => input.click());
      await page.evaluate(async () => {
        const renderer = document.querySelector('pricing-renderer') as HTMLElement & {
          updateComplete: Promise<unknown>;
        };
        await renderer.updateComplete;
        await new Promise((resolve) => requestAnimationFrame(resolve));
        await renderer.updateComplete;
      });
      expect(state).toBe('ready');
      await snap(page, testInfo, `${saas}-1440-light-en-yearly`);
    });
  }
});
