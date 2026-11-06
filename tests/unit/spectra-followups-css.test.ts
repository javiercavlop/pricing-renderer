import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../src/styles/base.css', import.meta.url), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);

// The text of the `{ ... }` block that follows `header` (nested braces are balanced).
function blockAfter(source: string, header: RegExp): string {
  const match = header.exec(source);
  if (!match) return '';
  let depth = 0;
  const start = source.indexOf('{', match.index);
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start + 1, index);
  }
  return '';
}

describe('spectra follow-ups css', () => {
  // Pills may shrink below the width of a long unbroken word.
  it('lets .pr-tag and .pr-badge shrink', () => {
    const rule = /pr-tag,\s*pricing-renderer\[data-pr-root\] \.pr-badge\s*\{[^}]*\}/.exec(css);
    expect(rule).not.toBeNull();
    expect(rule?.[0]).toMatch(/min-inline-size:\s*0\s*;/);
    expect(rule?.[0]).toMatch(/max-inline-size:\s*100%\s*;/);
    expect(rule?.[0]).toMatch(/overflow-wrap:\s*anywhere\s*;/);
    const badges = /\.pr-plan-card__badges\s*\{[^}]*\}/.exec(css);
    expect(badges).not.toBeNull();
    expect(badges?.[0]).toMatch(/min-inline-size:\s*0\s*;/);
    expect(badges?.[0]).toMatch(/max-inline-size:\s*100%\s*;/);
  });

  // The caps keep smaller token values in effect.
  it('keeps the token caps of the 840px container block', () => {
    const wide = blockAfter(css, /@container pricing-renderer \(min-width: 840px\)/);
    const block = blockAfter(wide, /\.pr-content\s*\{/);
    expect(block).toMatch(/gap:\s*min\(var\(--pr-space-section\),\s*var\(--pr-space-5\)\)\s*;/);
    expect(block).toMatch(
      /padding-block-start:\s*min\(var\(--pr-shell-padding\),\s*var\(--pr-space-4\)\)\s*;/,
    );
  });

  // UX-3: below 840px the space above the plans carries the same caps, so the first plan price
  // fits in the first screen of a phone. Measured on the clickup fixture at 375x812: the price
  // bottom moves from 820.8px (8.8px past the 812px fold) to 776.8px, 35.2px inside it.
  it('gives the narrow container block the same caps as the 840px one', () => {
    const narrow = blockAfter(css, /@container pricing-renderer \(max-width: 839\.98px\)/);
    expect(narrow).not.toBe('');
    const content = blockAfter(narrow, /\.pr-content\s*\{/);
    expect(content).toMatch(/gap:\s*min\(var\(--pr-space-section\),\s*var\(--pr-space-5\)\)\s*;/);
    expect(content).toMatch(
      /padding-block-start:\s*min\(var\(--pr-shell-padding\),\s*var\(--pr-space-4\)\)\s*;/,
    );
    // The space after the plans is unchanged: what the gap cap removes is added back here.
    const afterPlans = blockAfter(narrow, /\.pr-content > \[data-pr-part='plans'\] ~ \*\s*\{/);
    expect(afterPlans).toMatch(
      /margin-block-start:\s*calc\(\s*var\(--pr-space-section\) -\s*min\(var\(--pr-space-section\),\s*var\(--pr-space-5\)\)\s*\)\s*;/,
    );
    const heading = blockAfter(narrow, /\[data-pr-part='plans'\] > \.pr-section__heading\s*\{/);
    expect(heading).toMatch(/margin-block-end:\s*var\(--pr-space-3\)\s*;/);
  });
});
