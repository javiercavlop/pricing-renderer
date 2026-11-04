import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { buildStressYaml, findStressFixture } from '../fixtures/stress/build.js';
import {
  addOnRowSpreads,
  countCellsFullyInside,
  intersectsViewport,
  loneLastCard,
} from '../fixtures/stress/metrics.js';
import {
  applyPricing,
  measureOverflow,
  measurePlanGrid,
  measureText,
  openRenderer,
  revealAllRows,
  type Viewport,
} from './helpers/spectra.js';

// UX stress summary over the synthetic pricings of tests/fixtures/stress. It measures how the
// renderer lays out the extremes SPECTRA found (no plans, 140+ features, 16-38 limits, 15 plans)
// and prints one SPECTRA_UX_SUMMARY JSON line per fixture and variant. It records the
// state of today's renderer and asserts only what holds today: the page does not throw and the
// component renders. A known problem (a long page, a hidden call to action, a lone last card)
// shows up in the printed numbers and never fails the test.

// Three fixtures cover the extremes: no plans (okta), many usage limits (clickup) and 15 plans
// (webflow). The whole summary has to stay far below the CI job budget, so every await
// is bounded and the numbers include the time each variant took (elapsedMs).
const subset = ['okta-usd-monthly', 'clickup-usd-monthly', 'webflow-eur-monthly'];

type Variant = { viewport: Viewport; theme: 'light' | 'dark'; locale: 'en' | 'es' };

// 1440 and 375 cross light/en with dark/es; 1024 adds the tablet width in light/en.
const variants: Variant[] = [
  { viewport: { width: 1440, height: 900 }, theme: 'light', locale: 'en' },
  { viewport: { width: 1440, height: 900 }, theme: 'dark', locale: 'es' },
  { viewport: { width: 375, height: 812 }, theme: 'light', locale: 'en' },
  { viewport: { width: 375, height: 812 }, theme: 'dark', locale: 'es' },
  { viewport: { width: 1024, height: 768 }, theme: 'light', locale: 'en' },
];

// UX_STRESS_ALL=1 runs all six shapes (USD, monthly) instead of the three fixtures above.
const allShapes = [
  'okta-usd-monthly',
  'clickup-usd-monthly',
  'webflow-eur-monthly',
  'zoom-usd-monthly',
  'salesforce-usd-monthly',
  'github-usd-monthly',
];

const axeMs = 20_000;
const openMs = 15_000;
const applyPricingMs = 25_000;
const measureMs = 8_000;
const pageTimeoutMs = 8_000;
const navigationTimeoutMs = 15_000;

test.beforeEach(({ browserName }) => {
  test.skip(browserName !== 'chromium', 'The UX stress summary runs in chromium only.');
});

// Races `work` against a timer so one stuck step fails with its name instead of using up the test
// timeout. It does not cancel the work: the test timeout and the page close clean that up.
async function bounded<T>(label: string, ms: number, work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} took longer than ${ms} ms`)), ms);
  });
  work.catch(() => undefined);
  try {
    return await Promise.race([work, limit]);
  } finally {
    clearTimeout(timer);
  }
}

async function measureUx(page: Page) {
  return page.evaluate(async () => {
    const renderer = document.querySelector('pricing-renderer') as HTMLElement;
    const jump = (top: number) => window.scrollTo({ top, behavior: 'instant' });
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    const round = (value: number) => Math.round(value * 100) / 100;
    const viewportHeight = window.innerHeight;

    // Fully inside the viewport: sized (not display:none) and neither above nor below the fold.
    const fullyInViewport = (element: Element | null) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.bottom <= viewportHeight;
    };
    const firstScreen = () => {
      const cards = [...renderer.querySelectorAll('.pr-plan-card')];
      const visibleCards = cards.filter((card) => {
        const rect = card.getBoundingClientRect();
        return rect.height > 0 && rect.top < viewportHeight && rect.bottom > 0;
      });
      return {
        planCardsVisible: visibleCards.length,
        plansVisible: visibleCards.length > 0,
        priceVisible: fullyInViewport(renderer.querySelector('.pr-plan-card .pr-price')),
        ctaVisible: fullyInViewport(renderer.querySelector('[data-pr-part="cta"]')),
      };
    };

    jump(0);
    await nextFrame();
    const rendererHeight = renderer.getBoundingClientRect().height;
    const documentHeight = document.documentElement.scrollHeight;
    const documentWidth = document.documentElement.scrollWidth;
    const pageTop = firstScreen();

    // The demo page has its own chrome above the renderer: look again with the renderer on top.
    jump(Math.round(renderer.getBoundingClientRect().top + window.scrollY));
    await nextFrame();
    const rendererTop = firstScreen();

    // Effective stickiness, as the SPECTRA review measures it: scroll the middle of the table
    // into view and compare the header (and the first column) with the box that scrolls.
    const table = renderer.querySelector('.pr-comparison-table');
    const headerCell = renderer.querySelector('.pr-comparison-table thead th');
    const firstCell = renderer.querySelector(
      '.pr-comparison-table tbody tr[data-pr-part="comparison-row"] > :first-child',
    );
    const pinned = (element: Element | null) => {
      if (!element) return null;
      const position = getComputedStyle(element).position;
      return position === 'sticky' || position === 'fixed';
    };
    let headerEffective: boolean | null = null;
    let firstColumnEffective: boolean | null = null;
    const scroller = table?.closest('.pr-table-scroll') ?? null;
    if (scroller && headerCell && scroller.scrollHeight > scroller.clientHeight + 1) {
      const scrollerTop = scroller.getBoundingClientRect().top + window.scrollY;
      jump(Math.max(0, Math.round(scrollerTop - 20)));
      scroller.scrollTop = (scroller.scrollHeight - scroller.clientHeight) / 2;
      await nextFrame();
      if (scroller.scrollTop > 2) {
        const offset = parseFloat(getComputedStyle(headerCell).top) || 0;
        const box = scroller.getBoundingClientRect();
        const headerBox = headerCell.getBoundingClientRect();
        const topmost = document.elementFromPoint(
          headerBox.left + headerBox.width / 2,
          headerBox.top + headerBox.height / 2,
        );
        const expectedTop = box.top + scroller.clientTop + offset;
        const aligned = Math.abs(headerBox.top - expectedTop) <= 2;
        headerEffective = aligned && !!topmost && headerCell.contains(topmost);
      }
      scroller.scrollTop = 0;
    }
    if (scroller && firstCell && scroller.scrollWidth > scroller.clientWidth + 1) {
      scroller.scrollLeft = 200;
      await nextFrame();
      if (scroller.scrollLeft > 2) {
        const offset = parseFloat(getComputedStyle(firstCell).left) || 0;
        const expectedLeft = scroller.getBoundingClientRect().left + offset;
        const left = firstCell.getBoundingClientRect().left;
        firstColumnEffective = Math.abs(left - expectedLeft) <= 2;
      }
      scroller.scrollLeft = 0;
    }
    jump(0);
    await nextFrame();

    // Height of the first element of each data-pr-part, in viewports, to see which section is long.
    const sectionHeightsInViewports: Record<string, number> = {};
    for (const part of new Set(
      [...renderer.querySelectorAll('[data-pr-part]')].map(
        (element) => element.getAttribute('data-pr-part') ?? '',
      ),
    )) {
      const first = renderer.querySelector(`[data-pr-part="${part}"]`);
      if (first) {
        sectionHeightsInViewports[part] = Math.round(
          first.getBoundingClientRect().height / viewportHeight,
        );
      }
    }

    return {
      sectionHeightsInViewports,
      documentHeight,
      documentHeightInViewports: round(documentHeight / viewportHeight),
      rendererHeightInViewports: round(rendererHeight / viewportHeight),
      pageScrollOverflowPx: Math.max(0, documentWidth - window.innerWidth),
      comparisonLayout: table
        ? 'table'
        : renderer.querySelector('.pr-compact-comparison')
          ? 'cards'
          : 'none',
      pageTop,
      rendererTop,
      sticky: {
        header: pinned(headerCell),
        firstColumn: pinned(firstCell),
        headerEffective,
        firstColumnEffective,
      },
    };
  });
}

// Plan header cells (not the feature column) of the comparison table against the scroll box, at
// scrollLeft 0. The pure counting lives in metrics.ts.
async function measureVisiblePlanColumns(page: Page): Promise<number | null> {
  const boxes = await page.evaluate(() => {
    const renderer = document.querySelector('pricing-renderer') as HTMLElement;
    const table = renderer.querySelector('.pr-comparison-table');
    const scroller = table?.closest('.pr-table-scroll') ?? null;
    if (!table || !scroller) return null;
    scroller.scrollLeft = 0;
    const box = scroller.getBoundingClientRect();
    const cells = [...table.querySelectorAll('thead th')].slice(1).map((cell) => {
      const rect = cell.getBoundingClientRect();
      return { left: rect.left, right: rect.right };
    });
    return { scroller: { left: box.left, right: box.right }, cells };
  });
  return boxes ? countCellsFullyInside(boxes.cells, boxes.scroller) : null;
}

// Add-on grid: height spread per grid row, cards rendered and disabled, and whether the summary
// shares the viewport with the first, middle and last card scrolled to the centre. Null without
// add-on cards.
async function measureAddOns(page: Page) {
  const raw = await page.evaluate(async () => {
    const renderer = document.querySelector('pricing-renderer') as HTMLElement;
    const cards = [...renderer.querySelectorAll<HTMLElement>('.pr-addon-card')];
    if (cards.length === 0) return null;
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    window.scrollTo({ top: 0, behavior: 'instant' });
    await nextFrame();
    const rects = cards.map((card) => {
      const rect = card.getBoundingClientRect();
      return { top: rect.top + window.scrollY, height: rect.height };
    });
    const disabled = cards.filter((card) => card.getAttribute('data-available') === 'false').length;
    const summary = renderer.querySelector('[data-pr-part="summary"]');
    const picks = [0, Math.floor((cards.length - 1) / 2), cards.length - 1];
    const summaryRects: ({ top: number; bottom: number } | null)[] = [];
    for (const index of picks) {
      cards[index]!.scrollIntoView({ block: 'center', behavior: 'instant' });
      await nextFrame();
      const rect = summary?.getBoundingClientRect();
      summaryRects.push(rect ? { top: rect.top, bottom: rect.bottom } : null);
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
    await nextFrame();
    return {
      rects,
      disabled,
      summaryRects,
      viewportHeight: window.innerHeight,
    };
  });
  if (!raw) return null;
  const visible = raw.summaryRects.map((rect) =>
    rect ? intersectsViewport(rect, raw.viewportHeight) : null,
  );
  return {
    cardsRendered: raw.rects.length,
    cardsDisabled: raw.disabled,
    rowSpreads: addOnRowSpreads(raw.rects),
    summaryInViewport: { first: visible[0], middle: visible[1], last: visible[2] },
  };
}

async function measureContrast(page: Page) {
  const results = await new AxeBuilder({ page })
    .include('pricing-renderer')
    .withRules(['color-contrast'])
    .analyze();
  const nodes = results.violations.flatMap((violation) => violation.nodes);
  return {
    violations: nodes.length,
    targets: nodes.slice(0, 3).map((node) => node.target.join(' ')),
  };
}

// Sets the layout attribute and waits for the re-render.
async function setLayout(page: Page, layout: string): Promise<void> {
  await page.evaluate(async (value) => {
    const renderer = document.querySelector('pricing-renderer') as HTMLElement & {
      updateComplete: Promise<unknown>;
    };
    renderer.setAttribute('layout', value);
    await renderer.updateComplete;
    for (let frame = 0; frame < 3; frame += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }, layout);
}

// Height of the renderer in viewports after every group and "show more" is open. It mutates the
// page, so it runs last in a pass; the next pass opens a fresh page.
async function measureExpanded(page: Page) {
  const finished = await revealAllRows(page);
  const height = await page.evaluate(() => {
    const renderer = document.querySelector('pricing-renderer') as HTMLElement;
    return Math.round((renderer.getBoundingClientRect().height / window.innerHeight) * 100) / 100;
  });
  return { rendererHeightInViewports: height, finished };
}

const fixtureIds = process.env.UX_STRESS_ALL === '1' ? allShapes : subset;

// A normal pass has 11 bounded steps (open, apply, six measures, axe, expand, visible check) whose
// limits sum to 124 s; the table pass has 13 steps (set and restore the layout) and 140 s. Those
// are limits for a stuck step, not the expected time. The test timeout is a cumulative cap sized on the typical
// time of a pass (open, apply and the measures take well under 20 s), with room: 30 s per pass.
// Six passes give 180 s. CI budget: 3 fixtures, and with retries 2 a test that times out runs 3
// times, so the worst case is 3 x 3 x 180 s = 27 min, below the 40 min --global-timeout
// (2400000 ms) and the 50 min job timeout of .github/workflows/ci.yml.
const passBudgetMs = 30_000;
const testTimeoutMs = (variants.length + 1) * passBudgetMs;

test.describe('ux stress summary', () => {
  for (const id of fixtureIds) {
    test(`${id} renders and reports its layout`, async ({ page }) => {
      test.setTimeout(testTimeoutMs);
      page.setDefaultTimeout(pageTimeoutMs);
      page.setDefaultNavigationTimeout(navigationTimeoutMs);
      const fixture = findStressFixture(id);
      const yaml = buildStressYaml(fixture);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const startedTotal = Date.now();

      // One pass: apply the pricing, measure everything, print one line. layoutVariant is "auto"
      // for the default layout and "table" for the forced scrolling table.
      const runPass = async (variant: Variant, layoutVariant: 'auto' | 'table') => {
        const name = `${id} ${variant.viewport.width} ${variant.theme} ${variant.locale} ${layoutVariant}`;
        const startedAt = Date.now();
        // A fresh page state per pass: the renderer keeps revealed groups across a reload, so a pass
        // that follows revealAllRows would otherwise measure expanded rows. openRenderer also sets
        // the viewport.
        await bounded(`${name}: open the renderer`, openMs, openRenderer(page, variant.viewport));
        const state = await bounded(
          `${name}: apply the pricing`,
          applyPricingMs,
          applyPricing(page, yaml, variant.locale, variant.theme),
        );
        expect(state, `${name}: the pricing should reach the ready state`).toBe('ready');
        if (layoutVariant === 'table') {
          await bounded(`${name}: set the layout`, measureMs, setLayout(page, 'table'));
        }

        const ux = await bounded(`${name}: measure the layout`, measureMs, measureUx(page));
        const grid = await bounded(
          `${name}: measure the plan grid`,
          measureMs,
          measurePlanGrid(page),
        );
        const overflow = await bounded(
          `${name}: measure the overflow`,
          measureMs,
          measureOverflow(page),
        );
        const text = await bounded(`${name}: measure the text`, measureMs, measureText(page));
        const visiblePlanColumns = await bounded(
          `${name}: measure the plan columns`,
          measureMs,
          measureVisiblePlanColumns(page),
        );
        const addOns = await bounded(
          `${name}: measure the add-ons`,
          measureMs,
          measureAddOns(page),
        );
        const contrast = await bounded(`${name}: axe color-contrast`, axeMs, measureContrast(page));
        // Last: it opens every group, so nothing after it sees the collapsed page.
        const expanded = await bounded(`${name}: expand`, measureMs, measureExpanded(page));
        if (layoutVariant === 'table') {
          await bounded(`${name}: restore the layout`, measureMs, setLayout(page, 'auto'));
        }

        const rows = grid.cardsPerRow;
        const summary = {
          fixture: id,
          counts: fixture.counts,
          viewport: `${variant.viewport.width}x${variant.viewport.height}`,
          theme: variant.theme,
          locale: variant.locale,
          layoutVariant,
          elapsedMs: Date.now() - startedAt,
          documentHeightInViewports: ux.documentHeightInViewports,
          rendererHeightInViewports: ux.rendererHeightInViewports,
          expanded,
          firstViewport: { pageTop: ux.pageTop, rendererTop: ux.rendererTop },
          horizontalScroll: {
            pagePx: ux.pageScrollOverflowPx,
            rendererOverflowCount: overflow.count,
            rendererOverflowExamples: overflow.examples,
          },
          sticky: ux.sticky,
          comparisonLayout: ux.comparisonLayout,
          visiblePlanColumns,
          sectionHeightsInViewports: ux.sectionHeightsInViewports,
          planGrid: {
            cards: grid.planCardCount,
            columns: grid.gridColumns,
            cardsPerRow: rows,
            cardWidths: grid.cardWidths,
            firstCtaBottom: grid.firstCtaBottom,
            layoutBreakdown: grid.layoutBreakdown,
            loneLastCard: loneLastCard(grid.gridColumns, rows),
          },
          text: {
            awkwardBreaks: text.awkwardBreaks,
            truncatedTexts: text.truncatedTexts,
          },
          addOns,
          contrast,
        };
        console.info(`SPECTRA_UX_SUMMARY ${JSON.stringify(summary)}`);

        // Only what holds today: the component renders.
        await bounded(
          `${name}: renderer visible`,
          measureMs,
          expect(page.locator('pricing-renderer'), name).toBeVisible(),
        );
        expect(ux.documentHeight, `${name}: the page has a height`).toBeGreaterThan(0);
        expect(Number.isFinite(ux.rendererHeightInViewports), name).toBe(true);
        expect(ux.rendererHeightInViewports, `${name}: renderer height`).toBeGreaterThan(0);
        if (fixture.counts.plans === 0) {
          expect(grid.planCardCount, `${name}: no plan cards without plans`).toBe(0);
        } else {
          expect(grid.planCardCount, `${name}: plan cards are rendered`).toBeGreaterThan(0);
        }
      };

      const tableVariant = variants.find(
        (variant) => variant.viewport.width === 375 && variant.theme === 'light',
      );
      for (const variant of variants) {
        await runPass(variant, 'auto');
        if (variant === tableVariant) await runPass(variant, 'table');
      }

      const totalMs = Date.now() - startedTotal;
      console.info(`SPECTRA_UX_TOTAL ${JSON.stringify({ fixture: id, totalMs })}`);
      expect(errors, 'the page should not throw').toEqual([]);
    });
  }
});
