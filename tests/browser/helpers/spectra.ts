import { expect, type Page } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

// Shared by spectra-grid.spec.ts and spectra-text.spec.ts. The logic follows collectMetrics in
// spectra-review.spec.ts (a spec file is never imported). This module imports @playwright/test, so
// vitest cannot load it.

export type Viewport = { width: number; height: number };

const fixturesRoot = fileURLToPath(new URL('../../fixtures/spectra/', import.meta.url));

// The latest year of every SaaS in tests/fixtures/spectra, sorted by name.
export const fixtures = readdirSync(fixturesRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const years = readdirSync(`${fixturesRoot}${entry.name}`)
      .filter((file) => file.endsWith('.yml'))
      .sort();
    return { saas: entry.name, file: years[years.length - 1] };
  })
  .filter((fixture): fixture is { saas: string; file: string } => fixture.file !== undefined)
  .sort((a, b) => a.saas.localeCompare(b.saas));

export function readFixture(saas: string): string {
  const fixture = fixtures.find((candidate) => candidate.saas === saas);
  if (!fixture) throw new Error(`Spectra fixture "${saas}" was not found.`);
  return readFileSync(`${fixturesRoot}${fixture.saas}/${fixture.file}`, 'utf8');
}

// Number of entries under the top-level `plans` key of a fixture (0 for `plans: null`, as in okta).
export function planCount(saas: string): number {
  const document = parse(readFixture(saas)) as { plans?: unknown } | null;
  const plans = document?.plans;
  return plans && typeof plans === 'object' ? Object.keys(plans).length : 0;
}

export async function openRenderer(page: Page, viewport: Viewport): Promise<void> {
  await page.setViewportSize(viewport);
  await page.goto('/');
  await expect(page.locator('pricing-renderer .pr-plan-card')).toHaveCount(3);
}

export async function applyPricing(
  page: Page,
  yaml: string,
  locale = 'en',
  theme = 'light',
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

export type PlanGridMetrics = {
  containerWidth: number;
  planCardCount: number;
  cardsPerRow: number[];
  cardWidths: { min: number; max: number } | null;
  gridColumns: number;
  firstCtaVisible: boolean;
  rendererTopAfterScroll: number;
  firstCtaBottom: number | null;
  minTargetHeight: number | null;
  // Offsets are "top+height" in px relative to the renderer top (cards: to the first card top).
  layoutBreakdown: {
    viewportHeight: number;
    firstCardHeight: number | null;
    planSection: string | null;
    beforePlans: string;
    firstCardChildren: string;
  };
};

// Rows of plan cards, card widths and whether the first CTA is fully inside the viewport after
// scrolling the renderer to the top of the viewport (firstViewport.firstCtaVisible).
export async function measurePlanGrid(page: Page): Promise<PlanGridMetrics> {
  return page.evaluate(async () => {
    const renderer = document.querySelector('pricing-renderer') as HTMLElement;
    const jump = (top: number) => window.scrollTo({ top, behavior: 'instant' });
    const round = (value: number) => Math.round(value * 100) / 100;
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    jump(0);
    await nextFrame();
    const style = getComputedStyle(renderer);
    const containerWidth = round(
      renderer.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
    );
    const cards = [...renderer.querySelectorAll('.pr-plan-card')];
    const rects = cards.map((card) => card.getBoundingClientRect());
    const rows = new Map<number, number>();
    for (const rect of rects) {
      const top = Math.round(rect.top + window.scrollY);
      rows.set(top, (rows.get(top) ?? 0) + 1);
    }
    const cardsPerRow = [...rows.keys()].sort((a, b) => a - b).map((top) => rows.get(top) ?? 0);
    const widths = rects.map((rect) => rect.width);
    const grid = renderer.querySelector('.pr-plan-grid');
    const gridColumns = grid
      ? getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length
      : 0;
    const targets = [
      ...renderer.querySelectorAll('.pr-plan-card [data-pr-part="cta"], .pr-selection-control'),
    ]
      .map((element) => element.getBoundingClientRect().height)
      .filter((height) => height > 0);

    const rendererTop = Math.round(renderer.getBoundingClientRect().top + window.scrollY);
    jump(rendererTop);
    await nextFrame();
    const firstCta = renderer.querySelector('[data-pr-part="cta"]');
    const ctaBox = firstCta?.getBoundingClientRect() ?? null;
    const firstCtaVisible =
      !!ctaBox &&
      ctaBox.width > 0 &&
      ctaBox.height > 0 &&
      ctaBox.top >= 0 &&
      ctaBox.bottom <= window.innerHeight;
    const rendererTopAfterScroll = round(renderer.getBoundingClientRect().top);
    // Direct children of .pr-content before the plan section, then the first card's children.
    const describe = (element: Element) => {
      const part = element.getAttribute('data-pr-part');
      const names = Array.from(element.classList).slice(0, 2);
      return `${element.tagName.toLowerCase()}${names.map((name) => `.${name}`).join('')}${
        part ? `[${part}]` : ''
      }`;
    };
    const place = (element: Element, originTop: number) => {
      const box = element.getBoundingClientRect();
      return `${describe(element)} ${Math.round(box.top - originTop)}+${Math.round(box.height)}`;
    };
    const content = renderer.querySelector('.pr-content');
    const firstCard = renderer.querySelector('.pr-plan-card');
    const planSection =
      content && firstCard
        ? ([...content.children].find((child) => child.contains(firstCard)) ?? null)
        : null;
    const before: string[] = [];
    for (const child of content?.children ?? []) {
      if (child === planSection) break;
      before.push(place(child, rendererTopAfterScroll));
    }
    const cardTop = firstCard?.getBoundingClientRect().top ?? 0;
    const layoutBreakdown = {
      viewportHeight: window.innerHeight,
      firstCardHeight: firstCard ? Math.round(firstCard.getBoundingClientRect().height) : null,
      planSection: planSection ? place(planSection, rendererTopAfterScroll) : null,
      beforePlans: before.join('; ').slice(0, 600),
      firstCardChildren: [...(firstCard?.children ?? [])]
        .map((child) => place(child, cardTop))
        .join('; ')
        .slice(0, 600),
    };
    jump(0);
    await nextFrame();
    return {
      containerWidth,
      planCardCount: cards.length,
      cardsPerRow,
      cardWidths:
        widths.length === 0
          ? null
          : { min: round(Math.min(...widths)), max: round(Math.max(...widths)) },
      gridColumns,
      firstCtaVisible,
      rendererTopAfterScroll,
      firstCtaBottom: ctaBox ? round(ctaBox.bottom - rendererTopAfterScroll) : null,
      minTargetHeight: targets.length === 0 ? null : round(Math.min(...targets)),
      layoutBreakdown,
    };
  });
}

export type OverflowMetrics = { count: number; examples: string[] };

// Rendered elements whose box ends outside the renderer box by more than 1px. Elements inside a
// scroll or clip container (.pr-table-scroll, the billing switch, .pr-sr-only) are left out: the
// demo page clips the root, so the document scroll width cannot show this.
export async function measureOverflow(page: Page): Promise<OverflowMetrics> {
  return page.evaluate(() => {
    const renderer = document.querySelector('pricing-renderer') as HTMLElement;
    const box = renderer.getBoundingClientRect();
    const describe = (element: Element) => {
      const names = Array.from(element.classList).slice(0, 2);
      const part = element.getAttribute('data-pr-part');
      return `${element.tagName.toLowerCase()}${names.map((name) => `.${name}`).join('')}${
        part ? `[data-pr-part=${part}]` : ''
      }`;
    };
    const clipped = (element: Element) => {
      for (let node = element.parentElement; node && node !== renderer; node = node.parentElement) {
        if (getComputedStyle(node).overflowX !== 'visible') return true;
      }
      return false;
    };
    const offending: string[] = [];
    for (const element of renderer.querySelectorAll('*')) {
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      if (rect.right <= box.right + 1 && rect.left >= box.left - 1) continue;
      if (element.closest('.pr-sr-only') || clipped(element)) continue;
      offending.push(`${describe(element)} ${Math.round(rect.left)}-${Math.round(rect.right)}`);
    }
    return { count: offending.length, examples: offending.slice(0, 5) };
  });
}

export type TextMetrics = {
  awkwardBreaks: {
    count: number;
    examples: string[];
    inspectedWords: number;
    cappedAtWordLimit: boolean;
  };
  truncatedTexts: { count: number; examples: { selector: string; text: string }[] };
};

// awkwardBreaks and truncatedTexts exactly as collectMetrics counts them.
export async function measureText(page: Page): Promise<TextMetrics> {
  return page.evaluate(() => {
    const renderer = document.querySelector('pricing-renderer') as HTMLElement;
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

    const truncated: { selector: string; text: string }[] = [];
    let truncatedCount = 0;
    for (const element of [renderer, ...renderer.querySelectorAll('*')]) {
      const style = getComputedStyle(element);
      if (style.display === 'inline' || style.display === 'contents') continue;
      if (element.clientWidth <= 1) continue;
      if (element.scrollWidth > element.clientWidth + 1) {
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

    // A word (split on whitespace, without hyphens, slashes or soft hyphens) whose own client
    // rects sit on more than one line was split by overflow-wrap.
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

    return {
      awkwardBreaks: {
        count: awkwardBreaks,
        examples: awkwardExamples,
        inspectedWords,
        cappedAtWordLimit,
      },
      truncatedTexts: { count: truncatedCount, examples: truncated },
    };
  });
}

export type LongStringProbe = {
  found: boolean;
  target: string | null;
  inPlanCard: boolean;
  lines: number;
  insideCard: boolean;
  insideRenderer: boolean;
};

// Appends a 64-character string without spaces to a cell outside .pr-table-scroll and reports how
// it lays out. 'value': a value cell, a plan card value first; 'label': a plan name, the compact
// comparison dt first, else the plan card heading. It changes the DOM: call it last in a test.
export async function probeLongString(
  page: Page,
  kind: 'value' | 'label',
): Promise<LongStringProbe> {
  return page.evaluate(async (kind) => {
    const renderer = document.querySelector('pricing-renderer') as HTMLElement;
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    const isRendered = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== 'hidden';
    };
    const candidates = [
      ...renderer.querySelectorAll(kind === 'value' ? '.pr-value, dd, td' : 'dt, h4'),
    ].filter(
      (element) =>
        isRendered(element) && !element.closest('.pr-table-scroll, .pr-sr-only, .pr-segmented'),
    );
    const preferred = kind === 'value' ? '.pr-plan-card' : '.pr-feature-card';
    const fallback = kind === 'value' ? '*' : '.pr-plan-card';
    const target =
      candidates.find((element) => element.closest(preferred)) ??
      candidates.find((element) => element.closest(fallback)) ??
      null;
    if (!target) {
      return {
        found: false,
        target: null,
        inPlanCard: false,
        lines: 0,
        insideCard: false,
        insideRenderer: false,
      };
    }
    // Appended as its own text node, so the nodes the element template manages are left as they are.
    const probe = document.createTextNode(` ${'Unbroken'.repeat(8)}`);
    target.append(probe);
    await nextFrame();
    await nextFrame();
    const range = document.createRange();
    range.setStart(probe, 1);
    range.setEnd(probe, probe.length);
    const rects = [...range.getClientRects()].filter((rect) => rect.width > 0);
    const tops = [...new Set(rects.map((rect) => Math.round(rect.top)))].sort((a, b) => a - b);
    const lines = tops.filter((top, index) => index === 0 || top - tops[index - 1] > 4).length;
    const card =
      target.closest(
        '.pr-plan-card, .pr-feature-card, .pr-addon-card, .pr-metadata, .pr-summary',
      ) ?? renderer;
    const within = (outer: DOMRect) =>
      rects.every((rect) => rect.left >= outer.left - 1 && rect.right <= outer.right + 1);
    const names = Array.from(target.classList).slice(0, 2);
    return {
      found: true,
      target: `${target.tagName.toLowerCase()}${names.map((name) => `.${name}`).join('')}`,
      inPlanCard: !!target.closest('.pr-plan-card'),
      lines,
      insideCard: within(card.getBoundingClientRect()),
      insideRenderer: within(renderer.getBoundingClientRect()),
    };
  }, kind);
}

// Replaces the text of the first rendered element matching `selector` (outside .pr-table-scroll)
// with a 64-character string without spaces and reports how it lays out; `cardSelector` names the
// box it must stay in (the renderer when no ancestor matches). Only the data of the existing text
// nodes is changed, so the nodes the element template manages stay in place. It opens nothing and
// changes the DOM: call it last in a test.
export async function probeReplacedText(
  page: Page,
  selector: string,
  cardSelector: string,
): Promise<LongStringProbe> {
  return page.evaluate(
    async ({ selector, cardSelector }) => {
      const renderer = document.querySelector('pricing-renderer') as HTMLElement;
      const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
      const isRendered = (element: Element) => {
        const rect = element.getBoundingClientRect();
        return (
          rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== 'hidden'
        );
      };
      const target = [...renderer.querySelectorAll(selector)].find(
        (element) => isRendered(element) && !element.closest('.pr-table-scroll, .pr-sr-only'),
      );
      if (!target) {
        return {
          found: false,
          target: null,
          inPlanCard: false,
          lines: 0,
          insideCard: false,
          insideRenderer: false,
        };
      }
      const texts: Text[] = [];
      const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) texts.push(node as Text);
      const probe =
        texts.find((text) => text.data.trim() !== '') ??
        target.appendChild(document.createTextNode(''));
      for (const text of texts) if (text !== probe) text.data = '';
      probe.data = 'Unbroken'.repeat(8);
      await nextFrame();
      await nextFrame();
      const range = document.createRange();
      range.selectNodeContents(probe);
      const rects = [...range.getClientRects()].filter((rect) => rect.width > 0);
      const tops = [...new Set(rects.map((rect) => Math.round(rect.top)))].sort((a, b) => a - b);
      const lines = tops.filter((top, index) => index === 0 || top - tops[index - 1] > 4).length;
      const card = target.closest(cardSelector) ?? renderer;
      const within = (outer: DOMRect) =>
        rects.every((rect) => rect.left >= outer.left - 1 && rect.right <= outer.right + 1);
      const names = Array.from(target.classList).slice(0, 2);
      return {
        found: true,
        target: `${target.tagName.toLowerCase()}${names.map((name) => `.${name}`).join('')}`,
        inPlanCard: !!target.closest('.pr-plan-card'),
        lines,
        insideCard: within(card.getBoundingClientRect()),
        insideRenderer: within(renderer.getBoundingClientRect()),
      };
    },
    { selector, cardSelector },
  );
}
