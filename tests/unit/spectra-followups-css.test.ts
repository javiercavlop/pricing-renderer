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
  // [utest->spectra-followups:AC1] Pills may shrink below the width of a long unbroken word.
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

  // [utest->spectra-followups:AC2] The caps keep smaller token values in effect.
  it('keeps the token caps of the 840px container block', () => {
    const wide = blockAfter(css, /@container pricing-renderer \(min-width: 840px\)/);
    const block = blockAfter(wide, /\.pr-content\s*\{/);
    expect(block).toMatch(/gap:\s*min\(var\(--pr-space-section\),\s*var\(--pr-space-5\)\)\s*;/);
    expect(block).toMatch(
      /padding-block-start:\s*min\(var\(--pr-shell-padding\),\s*var\(--pr-space-4\)\)\s*;/,
    );
  });
});
