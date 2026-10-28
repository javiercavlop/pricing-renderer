import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// [utest->req~host-dark-class~1]
// A host `.dark` class darkens the renderer like [data-theme='dark'] does, with the same tokens.

const themePath = fileURLToPath(new URL('../../src/styles/theme.css', import.meta.url));

function readTheme(): string {
  expect(existsSync(themePath), 'src/styles/theme.css should exist').toBe(true);
  return readFileSync(themePath, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
}

interface Rule {
  selectors: string[];
  declarations: Record<string, string>;
}

function parseRule(css: string, marker: string): Rule {
  const pattern = new RegExp(`([^{}]*${marker}[^{}]*)\\{([^{}]*)\\}`);
  const match = pattern.exec(css);
  expect(match, `a rule containing ${marker}`).not.toBeNull();
  const selectors = match![1]!
    .split(',')
    .map((selector) => selector.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const declarations: Record<string, string> = {};
  for (const declaration of match![2]!.split(';')) {
    const colon = declaration.indexOf(':');
    if (colon < 0) continue;
    declarations[declaration.slice(0, colon).trim()] = declaration
      .slice(colon + 1)
      .replace(/\s+/g, ' ')
      .trim();
  }
  return { selectors, declarations };
}

const DARK_DECLARATIONS: Record<string, string> = {
  'color-scheme': 'dark',
  '--pr-color-text': '#f4f3fb',
  '--pr-color-muted': '#aaa8ba',
  '--pr-color-surface': '#181820',
  '--pr-color-surface-raised': '#22222c',
  '--pr-color-surface-subtle': '#202028',
  '--pr-color-border': '#353541',
  '--pr-color-border-strong': '#555463',
  '--pr-color-accent': '#9b8cff',
  '--pr-color-on-accent': '#14121f',
  '--pr-color-link': '#b8adff',
  '--pr-color-focus': '#b8adff',
  '--pr-color-success': '#66d9ad',
  '--pr-color-warning': '#ffc66d',
  '--pr-color-warning-surface': '#302613',
  '--pr-color-overlay': '#050507',
  '--pr-shadow-sm': '0 1px 2px rgb(0 0 0 / 28%), 0 8px 30px rgb(0 0 0 / 18%)',
};

describe('host .dark class selectors', () => {
  it('keeps the existing dark selectors and adds the .dark ones', () => {
    const { selectors } = parseRule(readTheme(), "\\[theme='dark'\\]");
    expect(selectors).toEqual(
      expect.arrayContaining([
        "pricing-renderer[data-pr-root][theme='dark']",
        "[data-theme='dark'] pricing-renderer[data-pr-root]",
        "pricing-change-review[theme='dark']",
        "[data-theme='dark'] pricing-change-review",
        '.dark pricing-renderer[data-pr-root]',
        '.dark pricing-change-review',
      ]),
    );
  });

  it("appends the .dark selectors after [theme='dark']", () => {
    const { selectors } = parseRule(readTheme(), "\\[theme='dark'\\]");
    const first = selectors.indexOf("pricing-renderer[data-pr-root][theme='dark']");
    expect(first).toBe(0);
    expect(selectors.indexOf('.dark pricing-renderer[data-pr-root]')).toBeGreaterThan(first);
    expect(selectors.indexOf('.dark pricing-change-review')).toBeGreaterThan(first);
  });

  it('keeps the same declaration block as before', () => {
    const { declarations } = parseRule(readTheme(), "\\[theme='dark'\\]");
    expect(declarations).toEqual(DARK_DECLARATIONS);
  });

  it('leaves the auto media block unchanged', () => {
    const css = readTheme();
    const start = css.indexOf('@media (prefers-color-scheme: dark)');
    expect(start).toBeGreaterThan(0);
    const media = css.slice(start);
    expect(media).not.toContain('.dark');
    const rule = parseRule(media, "\\[theme='auto'\\]");
    expect(rule.selectors).toEqual([
      "pricing-renderer[data-pr-root][theme='auto']",
      "pricing-change-review[theme='auto']",
    ]);
    const expected = { ...DARK_DECLARATIONS };
    delete expected['--pr-shadow-sm'];
    expect(rule.declarations).toEqual(expected);
  });
});
