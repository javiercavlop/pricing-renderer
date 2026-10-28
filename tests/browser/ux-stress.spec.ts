import { expect, test, type Page } from '@playwright/test';
import { buildStressYaml, findStressFixture } from '../fixtures/stress/build.js';
import { loneLastCard } from '../fixtures/stress/metrics.js';
import {
  applyPricing,
  measureOverflow,
  measurePlanGrid,
  openRenderer,
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

const variants: Variant[] = [
  { viewport: { width: 1440, height: 900 }, theme: 'light', locale: 'en' },
  { viewport: { width: 375, height: 812 }, theme: 'dark', locale: 'es' },
];

const openMs = 15_000;
const applyPricingMs = 25_000;
const resizeMs = 8_000;
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

test.describe('ux stress summary', () => {
  for (const id of subset) {
    test(`${id} renders and reports its layout`, async ({ page }) => {
      test.setTimeout(60_000);
      page.setDefaultTimeout(pageTimeoutMs);
      page.setDefaultNavigationTimeout(navigationTimeoutMs);
      const fixture = findStressFixture(id);
      const yaml = buildStressYaml(fixture);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await bounded('open the renderer', openMs, openRenderer(page, variants[0]!.viewport));

      for (const variant of variants) {
        const name = `${id} ${variant.viewport.width} ${variant.theme} ${variant.locale}`;
        const startedAt = Date.now();
        await bounded(`${name}: resize`, resizeMs, page.setViewportSize(variant.viewport));
        const state = await bounded(
          `${name}: apply the pricing`,
          applyPricingMs,
          applyPricing(page, yaml, variant.locale, variant.theme),
        );
        expect(state, `${name}: the pricing should reach the ready state`).toBe('ready');

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

        const rows = grid.cardsPerRow;
        const summary = {
          fixture: id,
          counts: fixture.counts,
          viewport: `${variant.viewport.width}x${variant.viewport.height}`,
          theme: variant.theme,
          locale: variant.locale,
          elapsedMs: Date.now() - startedAt,
          documentHeightInViewports: ux.documentHeightInViewports,
          rendererHeightInViewports: ux.rendererHeightInViewports,
          firstViewport: { pageTop: ux.pageTop, rendererTop: ux.rendererTop },
          horizontalScroll: {
            pagePx: ux.pageScrollOverflowPx,
            rendererOverflowCount: overflow.count,
            rendererOverflowExamples: overflow.examples,
          },
          sticky: ux.sticky,
          comparisonLayout: ux.comparisonLayout,
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
      }

      expect(errors, 'the page should not throw').toEqual([]);
    });
  }
});
