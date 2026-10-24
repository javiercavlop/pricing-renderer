import { expect, test } from '@playwright/test';
import {
  applyPricing,
  fixtures,
  measureOverflow,
  measureText,
  openRenderer,
  planCount,
  probeLongString,
  probeReplacedText,
  readFixture,
  type Viewport,
} from './helpers/spectra.js';

// Spectra item 10 (docs/agent-work/spectra-item10-text/spec.md): short words are never split while
// long unbroken strings still wrap. Every test prints one SPECTRA_TEXT JSON line.

const viewports: Viewport[] = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 375, height: 812 },
];

// The pricings where phase 1 saw "Unlimited" or "PROFESSIONAL" split inside the word.
const gatedBreaks = new Set([
  'mailchimp',
  'microsoft365Business',
  'salesforce',
  'zoom',
  'figma',
  'github',
]);

test.beforeEach(({ browserName }) => {
  test.skip(browserName !== 'chromium', 'The spectra checks run in chromium only.');
});

test.describe('spectra text', () => {
  for (const fixture of fixtures) {
    for (const viewport of viewports) {
      test(`${fixture.saas} ${viewport.width}x${viewport.height}`, async ({ page }) => {
        test.setTimeout(60_000);
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await openRenderer(page, viewport);
        const state = await applyPricing(page, readFixture(fixture.saas));
        const text = await measureText(page);
        const overflow = await measureOverflow(page);
        // Last: the probes change the rendered DOM. The hero and add-on/breakdown probes replace
        // text, so they run after the others, and only at 375x812.
        const probes = [await probeLongString(page, 'value'), await probeLongString(page, 'label')];
        const narrow = viewport.width === 375;
        const hero = narrow
          ? await probeReplacedText(page, '[data-pr-part="hero"] h2', '[data-pr-part="hero"]')
          : null;
        const heroOverflow = narrow ? await measureOverflow(page) : null;
        const detail = narrow
          ? await probeReplacedText(
              page,
              '.pr-addon-effects dd, .pr-breakdown__name',
              '.pr-addon-card, .pr-summary',
            )
          : null;
        console.info(
          `SPECTRA_TEXT ${JSON.stringify({
            fixture: fixture.saas,
            viewport,
            awkwardBreaks: text.awkwardBreaks,
            truncatedTexts: text.truncatedTexts,
            overflow,
            probes,
            hero,
            heroOverflow,
            detail,
          })}`,
        );

        expect(state).toBe('ready');
        // [utest->spectra-item10:AC1] inspectedWords > 0 shows the measurement saw text; the
        // word limit may cap it on large pricings, which is printed only.
        if (gatedBreaks.has(fixture.saas)) {
          expect(text.awkwardBreaks.examples).toEqual([]);
          expect(text.awkwardBreaks.inspectedWords).toBeGreaterThan(0);
        }
        // [utest->spectra-item10:AC2]
        expect(text.truncatedTexts.examples).toEqual([]);
        // [utest->spectra-item10:AC5]
        expect(overflow.examples).toEqual([]);
        // [utest->spectra-item10:AC3] Every pricing with plans must offer both targets. A pricing
        // without plans (okta) may have none outside the table; a target it has must still wrap.
        const required = planCount(fixture.saas) > 0;
        for (const probe of probes) {
          if (required) expect(probe.found).toBe(true);
          if (!probe.found) continue;
          expect(probe.lines).toBeGreaterThan(1);
          expect(probe.insideCard).toBe(true);
          expect(probe.insideRenderer).toBe(true);
        }
        // [utest->spectra-item10:AC7] The hero is not wider than the renderer with a long title;
        // every pricing renders a hero title.
        if (narrow) expect(hero?.found).toBe(true);
        if (hero?.found) {
          expect(hero.lines).toBeGreaterThan(1);
          expect(hero.insideRenderer).toBe(true);
          expect(heroOverflow?.examples).toEqual([]);
        }
        // [utest->spectra-item10:AC8] Skipped when no add-on effect value or breakdown name is
        // rendered without opening anything.
        if (detail?.found) {
          expect(detail.lines).toBeGreaterThan(1);
          expect(detail.insideCard).toBe(true);
          expect(detail.insideRenderer).toBe(true);
        }
        expect(errors).toEqual([]);
      });
    }
  }
});
