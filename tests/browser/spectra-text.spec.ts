import { expect, test } from '@playwright/test';
import {
  applyPricing,
  fixtures,
  measureOverflow,
  measureText,
  openRenderer,
  probeLongString,
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
        // Last: the probes add text nodes to the rendered DOM.
        const probes = [await probeLongString(page, 'value'), await probeLongString(page, 'label')];
        console.info(
          `SPECTRA_TEXT ${JSON.stringify({
            fixture: fixture.saas,
            viewport,
            awkwardBreaks: text.awkwardBreaks,
            truncatedTexts: text.truncatedTexts,
            overflow,
            probes,
          })}`,
        );

        expect(state).toBe('ready');
        // [utest->spectra-item10:AC1]
        if (gatedBreaks.has(fixture.saas)) expect(text.awkwardBreaks.examples).toEqual([]);
        // [utest->spectra-item10:AC2]
        expect(text.truncatedTexts.examples).toEqual([]);
        // [utest->spectra-item10:AC5]
        expect(overflow.examples).toEqual([]);
        // [utest->spectra-item10:AC3] Okta has no plans and may have no value cell or plan name
        // outside the table; every other pricing must offer both.
        for (const probe of probes) {
          if (fixture.saas !== 'okta') expect(probe.found).toBe(true);
          if (!probe.found) continue;
          expect(probe.lines).toBeGreaterThan(1);
          expect(probe.insideCard).toBe(true);
          expect(probe.insideRenderer).toBe(true);
        }
        expect(errors).toEqual([]);
      });
    }
  }
});
