import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// All DOM metrics describe the collapsed default state: 30 rows per group, first group expanded.

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
  // The demo page uses smooth scrolling; jump instantly so later reads see the final position.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  return state;
}

async function collectMetrics(viewport: Viewport) {
  const renderer = document.querySelector('pricing-renderer') as HTMLElement;
  const jump = (top: number) => window.scrollTo({ top, behavior: 'instant' });
  jump(0);
  const viewportHeight = window.innerHeight;
  const round = (value: number) => Math.round(value * 100) / 100;
  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  const rendererTop = Math.round(renderer.getBoundingClientRect().top + window.scrollY);
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

  // Fully inside the viewport: sized (not display:none) and neither above nor below the fold.
  const fullyInViewport = (element: Element | null) => {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.bottom <= viewportHeight;
  };
  const firstScreen = () => {
    const rects = planCards.map((card) => card.getBoundingClientRect());
    return {
      planCardsVisible: rects.filter((rect) => rect.top < viewportHeight && rect.bottom > 0).length,
      firstPriceVisible: fullyInViewport(firstPrice),
      firstCtaVisible: fullyInViewport(firstCta),
      summaryVisible: fullyInViewport(summary),
    };
  };
  const firstViewportPageTop = firstScreen();

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
        if (truncated.length < 3) {
          truncated.push({ selector: describe(element), text: snippet(element) });
        }
      }
    }
    const clamp = style.getPropertyValue('-webkit-line-clamp');
    if (clamp && clamp !== 'none' && element.scrollHeight > element.clientHeight + 1) {
      truncatedCount += 1;
      if (truncated.length < 3) {
        truncated.push({ selector: `${describe(element)} (line-clamp)`, text: snippet(element) });
      }
    }
  }

  // Best effort: a word (split on whitespace, without hyphens, slashes or soft hyphens)
  // whose own client rects sit on more than one line was split by overflow-wrap.
  let awkwardBreaks = 0;
  const awkwardExamples: string[] = [];
  let inspectedWords = 0;
  let cappedAtWordLimit = false;
  const wordLimit = 6000;
  const separators = new RegExp('[-/\\u00ad\\u2010-\\u2014]');
  const walker = document.createTreeWalker(renderer, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    const value = node.textContent ?? '';
    if (!parent || !value.trim() || !isRendered(parent)) continue;
    if (parent.closest('script, style, .pr-sr-only')) continue;
    for (const match of value.matchAll(/\S{4,}/g)) {
      if (separators.test(match[0])) continue;
      if (inspectedWords >= wordLimit) {
        cappedAtWordLimit = true;
        break;
      }
      inspectedWords += 1;
      const wordRange = document.createRange();
      wordRange.setStart(node, match.index ?? 0);
      wordRange.setEnd(node, (match.index ?? 0) + match[0].length);
      const tops = new Set([...wordRange.getClientRects()].map((rect) => Math.round(rect.top)));
      const lines = [...tops].sort((a, b) => a - b);
      if (lines.length > 1 && lines[lines.length - 1] - lines[0] > 4) {
        awkwardBreaks += 1;
        if (awkwardExamples.length < 3) awkwardExamples.push(`${describe(parent)}: ${match[0]}`);
      }
    }
  }

  const rendererHeight = renderer.getBoundingClientRect().height;

  // Scroll the renderer to the top of the viewport: the demo page has its own chrome above it.
  jump(rendererTop);
  await nextFrame();
  const firstViewport = firstScreen();
  const rendererBox = renderer.getBoundingClientRect();
  // The scroll is clamped on short pages, so the renderer may not reach the top of the viewport.
  const rendererTopAfterScroll = round(rendererBox.top);
  const firstCtaBottom = firstCta ? firstCta.getBoundingClientRect().bottom : null;
  const firstRowBottoms: number[] = [];
  for (const card of planCards) {
    const box = card.getBoundingClientRect();
    if (Math.round(box.top + window.scrollY) === rowTops[0]) firstRowBottoms.push(box.bottom);
  }
  const planGridBottomOffset = {
    firstPlanRow:
      firstRowBottoms.length === 0
        ? null
        : Math.round(Math.max(...firstRowBottoms) - rendererBox.top),
    firstCta: firstCtaBottom === null ? null : Math.round(firstCtaBottom - rendererBox.top),
  };

  // Effective stickiness: scroll the middle of the comparison table into view.
  const headerCell = renderer.querySelector('.pr-comparison-table thead th');
  const firstCell = renderer.querySelector(
    '.pr-comparison-table tbody tr[data-pr-part="comparison-row"] > :first-child',
  );
  let stickyHeaderEffective: boolean | null = null;
  let stickyFirstColumnEffective: boolean | null = null;
  if (table && headerCell) {
    const scroller = table.closest('.pr-table-scroll');
    // The table scrolls vertically inside its box (max-block-size), so the header pins to the box:
    // scroll the box to its middle, bring it into view and compare the header with the box top.
    if (scroller && scroller.scrollHeight > scroller.clientHeight + 1) {
      const scrollerTop = scroller.getBoundingClientRect().top + window.scrollY;
      // A summary docked and sticky at the top of the page covers the top of the viewport, so the
      // box is brought in below it.
      const dockedSummary = renderer.querySelector('.pr-flow > .pr-summary');
      const clearance =
        dockedSummary && getComputedStyle(dockedSummary).position === 'sticky'
          ? dockedSummary.getBoundingClientRect().height +
            (parseFloat(getComputedStyle(dockedSummary).top) || 0)
          : 0;
      jump(Math.max(0, Math.round(scrollerTop - clearance - 20)));
      scroller.scrollTop = (scroller.scrollHeight - scroller.clientHeight) / 2;
      await nextFrame();
      if (scroller.scrollTop > 2) {
        const box = scroller.getBoundingClientRect();
        const offset = parseFloat(getComputedStyle(headerCell).top) || 0;
        const expectedTop = box.top + scroller.clientTop + offset;
        const headerBox = headerCell.getBoundingClientRect();
        const topmost = document.elementFromPoint(
          headerBox.left + headerBox.width / 2,
          headerBox.top + headerBox.height / 2,
        );
        stickyHeaderEffective =
          Math.abs(headerBox.top - expectedTop) <= 2 && !!topmost && headerCell.contains(topmost);
      }
      scroller.scrollTop = 0;
    }
    if (scroller && firstCell && scroller.scrollWidth > scroller.clientWidth + 1) {
      scroller.scrollLeft = 200;
      await nextFrame();
      if (scroller.scrollLeft > 2) {
        const offset = parseFloat(getComputedStyle(firstCell).left) || 0;
        const expectedLeft = scroller.getBoundingClientRect().left + offset;
        stickyFirstColumnEffective =
          Math.abs(firstCell.getBoundingClientRect().left - expectedLeft) <= 2;
      }
      scroller.scrollLeft = 0;
    }
  }
  jump(0);
  await nextFrame();

  return {
    viewport,
    rendererHeight: round(rendererHeight),
    documentHeight: document.documentElement.scrollHeight,
    rendererHeightInViewports: round(rendererHeight / viewportHeight),
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    rendererOverflowX: { count: overflowing.length, examples: overflowing.slice(0, 3) },
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
    rendererTop,
    rendererTopAfterScroll,
    firstViewport,
    firstViewportPageTop,
    planGridBottomOffset,
    stickyHeader: isPinned(positionOf(headerCell)),
    stickyFirstColumn: isPinned(positionOf(firstCell)),
    stickyHeaderEffective,
    stickyFirstColumnEffective,
    truncatedTexts: { count: truncatedCount, examples: truncated },
    awkwardBreaks: {
      count: awkwardBreaks,
      examples: awkwardExamples,
      inspectedWords,
      cappedAtWordLimit,
    },
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
    contrastExamples: nodes.slice(0, 3).map((node) => ({
      target: node.target.join(' '),
      summary: node.any[0]?.message ?? node.failureSummary ?? '',
    })),
  };
}

function summaryLine(metrics: Metrics): string {
  type Counted = { count?: number; cappedAtWordLimit?: boolean };
  const m = metrics as {
    fixture?: string;
    theme?: string;
    locale?: string;
    viewport?: Viewport;
    rendererHeightInViewports?: number;
    rendererTop?: number;
    planCardCount?: number;
    planCardsPerRow?: number[];
    planCardWidths?: { min: number } | null;
    firstViewport?: Record<string, number | boolean>;
    stickyHeader?: boolean | null;
    stickyFirstColumn?: boolean | null;
    stickyHeaderEffective?: boolean | null;
    stickyFirstColumnEffective?: boolean | null;
    truncatedTexts?: Counted;
    awkwardBreaks?: Counted;
    contrastViolations?: number;
  };
  const flag = (value: unknown) => (typeof value === 'boolean' ? (value ? '1' : '0') : 'n');
  const count = (value: number | undefined) => (typeof value === 'number' ? String(value) : '-');
  const fv = m.firstViewport ?? {};
  return [
    'SPECTRA_SUMMARY',
    m.fixture,
    m.viewport?.width,
    m.theme,
    m.locale,
    `screens=${m.rendererHeightInViewports}`,
    `top=${m.rendererTop}`,
    `cards=${m.planCardCount}/${(m.planCardsPerRow ?? []).join('+')}`,
    `w=${m.planCardWidths?.min ?? '-'}`,
    `fv=${fv.planCardsVisible}/${flag(fv.firstPriceVisible)}/${flag(fv.firstCtaVisible)}`,
    `sticky=${flag(m.stickyHeader)}/${flag(m.stickyFirstColumn)}/${flag(m.stickyHeaderEffective)}/${flag(m.stickyFirstColumnEffective)}`,
    `trunc=${count(m.truncatedTexts?.count)}`,
    `breaks=${count(m.awkwardBreaks?.count)}`,
    `contrast=${count(m.contrastViolations)}`,
    ...(m.awkwardBreaks?.cappedAtWordLimit ? ['capped=1'] : []),
  ].join(' ');
}

async function report(testInfo: TestInfo, name: string, metrics: Metrics): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(summaryLine(metrics));
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
  metrics: Metrics,
  withContrast: boolean,
): Promise<void> {
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
  metrics: { rendererHeight?: unknown; planCardCount?: unknown; comparisonRows?: unknown },
  saas: string,
): Promise<void> {
  expect(state).toBe('ready');
  if (saas === 'okta') expect(metrics.planCardCount).toBe(0);
  else expect(Number(metrics.planCardCount)).toBeGreaterThan(0);
  const rows = metrics.comparisonRows as { rendered?: number } | undefined;
  expect(Number(rows?.rendered)).toBeGreaterThan(0);
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
        expectStickyHeader(metrics);
        expect(errors).toEqual([]);
      });
    }
  }
});

// [utest->req~sticky-table-scroll~1] A table layout never reports a header that scrolled away
// (2 px tolerance in collectMetrics); a table with 20 or more rows is taller than 80% of any
// tested viewport, so its box scrolls and the check must run and pass. Card layouts are exempt.
function expectStickyHeader(metrics: {
  comparisonLayout?: unknown;
  comparisonRows?: unknown;
  stickyHeaderEffective?: unknown;
}): void {
  if (metrics.comparisonLayout !== 'table') return;
  expect(metrics.stickyHeaderEffective).not.toBe(false);
  const rows = metrics.comparisonRows as { rendered?: number } | undefined;
  if (Number(rows?.rendered) >= 20) expect(metrics.stickyHeaderEffective).toBe(true);
}

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
            metrics,
            true,
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
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const viewport = viewports[0];
      await openRenderer(page, viewport);
      const state = await applyPricing(page, readFixture(saas), 'en', 'light');
      const yearly = page.locator('pricing-renderer input[name="pr-billing"][value="annual"]');
      await expect(yearly).toHaveCount(1);
      await yearly.evaluate((input: HTMLInputElement) => input.click());
      await expect(yearly).toBeChecked();
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
      expect(errors).toEqual([]);
    });
  }
});
