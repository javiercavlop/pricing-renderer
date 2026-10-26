import { expect, test, type Page } from '@playwright/test';
import {
  applyPricing,
  openRenderer,
  planCount,
  readFixture,
  revealAllRows,
  type Viewport,
} from './helpers/spectra.js';

// Spectra item 6 (docs/agent-work/spectra-item6-addon-marker/spec.md): comparison rows that only an
// add-on provides show an "Add-on" marker instead of an em dash. GitHub has 32 such rows (R9).

const saas = 'github';
const expectedRows = 32;
const marker = '.pr-value--addon';
const rowsWithMarker = `[data-pr-part="comparison-row"]:has(${marker})`;

const viewports: Viewport[] = [
  { width: 1440, height: 900 }, // table layout
  { width: 375, height: 812 }, // compact layout
];

const texts = {
  en: { visible: 'Add-on', sr: 'Available as add-on' },
  es: { visible: 'Complemento', sr: 'Disponible como complemento' },
} as const;

test.beforeEach(({ browserName }) => {
  test.skip(browserName !== 'chromium', 'The spectra checks run in chromium only.');
});

async function openComparison(
  page: Page,
  viewport: Viewport,
  locale: string,
  theme = 'light',
): Promise<void> {
  await openRenderer(page, viewport);
  const state = await applyPricing(page, readFixture(saas), locale, theme);
  expect(state, 'the pricing should reach the ready state').toBe('ready');
  const compact = viewport.width < 768;
  await expect(
    page.locator(compact ? '.pr-compact-comparison' : '.pr-comparison-table'),
    `the ${compact ? 'compact' : 'table'} comparison layout at ${viewport.width}px`,
  ).toHaveCount(1);
  expect(
    await revealAllRows(page),
    'every comparison group and remaining row should be revealable',
  ).toBe(true);
}

type Contrast = { count: number; worst: number | null; failures: string[] };

// Contrast of the marker text colour over its background; translucent layers are composited over
// the nearest opaque ancestor background. Handles rgb()/rgba() and color(srgb ...) results.
async function measureContrast(page: Page): Promise<Contrast> {
  return page.evaluate((selector) => {
    type Rgba = [number, number, number, number];
    const parse = (value: string): Rgba | null => {
      const match = value.trim().match(/^(rgba?|color)\((.*)\)$/i);
      if (!match) return null;
      const isColorFn = match[1]?.toLowerCase() === 'color';
      if (isColorFn && !/^srgb\s/i.test(match[2] ?? '')) return null;
      const body = (match[2] ?? '').replace(/^srgb\s+/i, '');
      const [colour = '', slashAlpha] = body.split('/');
      const parts = colour.split(/[\s,]+/).filter(Boolean);
      let alpha = slashAlpha;
      if (alpha === undefined && !isColorFn && parts.length === 4) alpha = parts.pop();
      const channels = parts.slice(0, 3).map((part) => {
        const number = parseFloat(part);
        if (part.endsWith('%')) return number / 100;
        return isColorFn ? number : number / 255;
      });
      if (channels.length !== 3 || channels.some((channel) => Number.isNaN(channel))) return null;
      let a = 1;
      if (alpha !== undefined) {
        a = alpha.trim().endsWith('%') ? parseFloat(alpha) / 100 : parseFloat(alpha);
      }
      return [channels[0] ?? 0, channels[1] ?? 0, channels[2] ?? 0, Number.isNaN(a) ? 1 : a];
    };
    const over = (top: Rgba, bottom: Rgba): Rgba => {
      const a = top[3] + bottom[3] * (1 - top[3]);
      if (a === 0) return [0, 0, 0, 0];
      const mix = (index: 0 | 1 | 2) =>
        (top[index] * top[3] + bottom[index] * bottom[3] * (1 - top[3])) / a;
      return [mix(0), mix(1), mix(2), a];
    };
    const linear = (channel: number) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    const luminance = (colour: Rgba) =>
      0.2126 * linear(colour[0]) + 0.7152 * linear(colour[1]) + 0.0722 * linear(colour[2]);

    const failures: string[] = [];
    let worst: number | null = null;
    const markers = [...document.querySelectorAll(selector)];
    for (const element of markers) {
      // Background layers from the marker up to the first opaque one (white as the last resort).
      let background: Rgba = [1, 1, 1, 1];
      const layers: Rgba[] = [];
      for (let node: Element | null = element; node; node = node.parentElement) {
        const layer = parse(getComputedStyle(node).backgroundColor);
        if (!layer) {
          failures.push(`unparsable background ${getComputedStyle(node).backgroundColor}`);
          break;
        }
        if (layer[3] === 0) continue;
        layers.push(layer);
        if (layer[3] >= 1) break;
      }
      for (const layer of layers.reverse()) background = over(layer, background);
      const textColour = parse(getComputedStyle(element).color);
      if (!textColour) {
        failures.push(`unparsable colour ${getComputedStyle(element).color}`);
        continue;
      }
      const text = over(textColour, background);
      const light = Math.max(luminance(text), luminance(background));
      const dark = Math.min(luminance(text), luminance(background));
      const ratio = (light + 0.05) / (dark + 0.05);
      worst = worst === null ? ratio : Math.min(worst, ratio);
      if (ratio < 4.5 && failures.length < 5) {
        const colour = getComputedStyle(element).color;
        failures.push(`${colour} on rgba(${background.join(', ')}) = ${ratio.toFixed(2)}`);
      }
    }
    return { count: markers.length, worst, failures };
  }, marker);
}

type Shape = {
  markerCount: number;
  mismatches: string[];
  tooTall: string[];
  wrapped: string[];
  overflowing: string[];
};

// Visible text, screen reader text, line count and cell overflow of every marker.
async function measureMarkers(
  page: Page,
  expected: { visible: string; sr: string },
  compact: boolean,
): Promise<Shape> {
  return page.evaluate(
    ({ selector, expected, compact }) => {
      const mismatches: string[] = [];
      const tooTall: string[] = [];
      const wrapped: string[] = [];
      const overflowing: string[] = [];
      const markers = [...document.querySelectorAll<HTMLElement>(selector)];
      for (const element of markers) {
        const visible = element.querySelector<HTMLElement>(':scope > [aria-hidden="true"]');
        const sr = element.querySelector<HTMLElement>(':scope > .pr-sr-only');
        const visibleText = visible?.textContent?.trim();
        const srText = sr?.textContent?.trim();
        if (visibleText !== expected.visible || srText !== expected.sr) {
          if (mismatches.length < 5) {
            mismatches.push(`visible=${String(visibleText)} sr=${String(srText)}`);
          }
        }
        const style = getComputedStyle(element);
        const fontSize = parseFloat(style.fontSize);
        const lineHeight =
          style.lineHeight === 'normal' ? fontSize * 1.2 : parseFloat(style.lineHeight);
        const height = element.getBoundingClientRect().height;
        if (height >= 2 * lineHeight && tooTall.length < 5) {
          tooTall.push(`height ${height.toFixed(1)} line-height ${lineHeight.toFixed(1)}`);
        }
        if (visible) {
          const range = document.createRange();
          range.selectNodeContents(visible);
          const tops = new Set(
            [...range.getClientRects()]
              .filter((rect) => rect.width > 0)
              .map((rect) => Math.round(rect.top / 4)),
          );
          if (tops.size > 1 && wrapped.length < 5) {
            wrapped.push(`${visibleText ?? ''} spans ${tops.size} lines`);
          }
        }
        if (compact) {
          const cell = element.closest('dd');
          const outside = cell !== null && !cell.closest('.pr-table-scroll');
          if (cell && outside && cell.scrollWidth > cell.clientWidth + 1) {
            if (overflowing.length < 5) {
              overflowing.push(`dd ${cell.scrollWidth} > ${cell.clientWidth}`);
            }
          }
        }
      }
      return { markerCount: markers.length, mismatches, tooTall, wrapped, overflowing };
    },
    { selector: marker, expected, compact },
  );
}

test.describe('spectra add-on marker', () => {
  for (const viewport of viewports) {
    const compact = viewport.width < 768;
    const layout = compact ? 'compact' : 'table';

    test.describe(`${layout} layout (${viewport.width}px)`, () => {
      // [utest->spectra-item6:AC7] [utest->spectra-item6:AC2]
      test('marks every add-on-only row, one marker per plan, no em dash', async ({ page }) => {
        test.setTimeout(60_000);
        await openComparison(page, viewport, 'en');
        const plans = planCount(saas);
        expect(plans, 'the github fixture should have plans').toBeGreaterThan(0);

        await expect(
          page.locator(rowsWithMarker),
          `rows with ${marker} after revealing every group and remaining row`,
        ).toHaveCount(expectedRows);

        const rows = await page.locator(rowsWithMarker).evaluateAll(
          (elements, selector) =>
            elements.map((row) => ({
              markers: row.querySelectorAll(selector).length,
              excluded: row.querySelectorAll('.pr-value--excluded').length,
            })),
          marker,
        );
        const badMarkers = rows.filter((row) => row.markers !== plans);
        expect(badMarkers, `rows without exactly ${plans} markers`).toEqual([]);
        const withExcluded = rows.filter((row) => row.excluded !== 0);
        expect(withExcluded, 'add-on-only rows must not contain .pr-value--excluded').toEqual([]);
      });

      for (const theme of ['light', 'dark']) {
        // [utest->spectra-item6:AC6]
        test(`marker contrast is at least 4.5:1 in the ${theme} theme`, async ({ page }) => {
          test.setTimeout(60_000);
          await openComparison(page, viewport, 'en', theme);
          const contrast = await measureContrast(page);
          expect(contrast.count, `markers found in the ${theme} theme`).toBe(
            expectedRows * planCount(saas),
          );
          expect(contrast.failures, `contrast failures in the ${theme} theme`).toEqual([]);
          expect(contrast.worst, 'worst contrast ratio').toBeGreaterThanOrEqual(4.5);
        });
      }

      for (const locale of ['en', 'es'] as const) {
        // [utest->spectra-item6:AC2] [utest->spectra-item6:AC3]
        test(`marker text and single line in ${locale}`, async ({ page }) => {
          test.setTimeout(60_000);
          await openComparison(page, viewport, locale);
          const shape = await measureMarkers(page, texts[locale], compact);
          expect(shape.markerCount, 'markers rendered').toBe(expectedRows * planCount(saas));
          const wanted = texts[locale].visible;
          expect(shape.mismatches, `markers whose texts differ from ${wanted}`).toEqual([]);
          expect(shape.tooTall, 'markers taller than two line heights').toEqual([]);
          expect(shape.wrapped, 'markers whose visible text wraps').toEqual([]);
          expect(shape.overflowing, 'cells that overflow horizontally').toEqual([]);
        });
      }
    });
  }
});
