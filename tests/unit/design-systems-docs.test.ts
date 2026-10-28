import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

// The file must exist before it is read, so a missing file is an assertion failure.
function read(path: string): string {
  const full = `${repoRoot}${path}`;
  expect(existsSync(full), `${path} exists`).toBe(true);
  return readFileSync(full, 'utf8');
}

const SECTIONS = [
  'Tailwind CSS v3',
  'Tailwind CSS v4',
  'CSS Modules',
  'Mapping tokens to host variables',
  'Fonts',
  'Dark mode',
  'Density',
  'State attributes',
  'Container breakpoints stay fixed',
];

// Second-level headings outside fenced code blocks, in document order.
function headings(text: string): string[] {
  const found: string[] = [];
  let fenced = false;
  for (const line of text.split('\n')) {
    if (/^```/.test(line)) fenced = !fenced;
    else if (!fenced && line.startsWith('## ')) found.push(line.slice(3).trim());
  }
  return found;
}

// The text of a `## ` section, up to the next `## ` heading (subsections included).
function section(text: string, title: string): string {
  const lines = text.split('\n');
  let fenced = false;
  let start = -1;
  let end = lines.length;
  lines.forEach((line, index) => {
    if (/^```/.test(line)) fenced = !fenced;
    if (fenced || !line.startsWith('## ')) return;
    if (start === -1 && line.slice(3).trim() === title) start = index + 1;
    else if (start !== -1 && end === lines.length) end = index;
  });
  expect(start, `section ${title}`).toBeGreaterThan(-1);
  return lines.slice(start, end).join('\n');
}

const codeBlocks = (text: string): string[] =>
  [...text.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((match) => match[1] ?? '');

const squash = (text: string): string => text.replace(/\s+/g, ' ').trim();

const markdownLink = /\]\([^)\s]*design-systems\.md(#[^)\s]*)?\)/;

// [utest->req~design-systems-guide~1]
describe('docs/design-systems.md', () => {
  const guide = (): string => read('docs/design-systems.md');

  it('has the nine second-level sections in the specified order', () => {
    expect(headings(guide())).toEqual(SECTIONS);
  });

  it('is linked with a Markdown link from the README, the theming guide and the API reference', () => {
    for (const path of ['README.md', 'docs/theming.md', 'docs/api-reference.md']) {
      expect(read(path), path).toMatch(markdownLink);
    }
  });

  it('Tailwind v3 section gives the preflight reset and the fix rule', () => {
    const text = section(guide(), 'Tailwind CSS v3');
    expect(text).toContain('background-color: transparent');
    expect(text).toContain('<button>');
    const fix =
      "pricing-renderer[data-pr-root] button[data-pr-part='cta'][data-kind='primary'] { background-color: var(--pr-color-accent); color: var(--pr-color-on-accent); }";
    expect(codeBlocks(text).map(squash)).toContain(fix);
    expect(text).toContain('preflight: false');
    expect(text).toContain("a[data-pr-part='cta']");
    expect(text).not.toContain('not affected');
  });

  it('Tailwind v4 section orders the layers before the tailwindcss import in one block', () => {
    const blocks = codeBlocks(section(guide(), 'Tailwind CSS v4'));
    const order = '@layer theme, base, pricing-renderer, components, utilities;';
    const block = blocks.find((code) => code.split('\n').includes(order));
    expect(block, 'a code block with the layer line').toBeDefined();
    const lines = (block ?? '').split('\n');
    const layerLine = lines.indexOf(order);
    const importLine = lines.findIndex((line) => /@import\s+['"]tailwindcss['"]/.test(line));
    expect(importLine).toBeGreaterThan(-1);
    expect(layerLine).toBeLessThan(importLine);
  });

  it('CSS Modules section escapes the element and uses the part hooks', () => {
    const text = section(guide(), 'CSS Modules');
    expect(text).toContain(':global(pricing-renderer)');
    expect(text).toContain('[data-pr-part=');
  });

  it('mapping section names the shadcn overlay and the v3 mapping', () => {
    const text = section(guide(), 'Mapping tokens to host variables');
    expect(text).toContain('pricing-renderer/tokens-shadcn.css');
    expect(text).toContain('hsl(var(--primary))');
    expect(guide()).toContain('theme-minimal.css');
  });

  it('documents every state attribute', () => {
    const text = section(guide(), 'State attributes');
    for (const name of [
      'data-current',
      'data-selected',
      'data-featured',
      'data-available',
      'data-kind',
    ]) {
      expect(text, name).toContain(name);
    }
  });

  it('breakpoints section lists each breakpoint and --pr-plan-columns', () => {
    const text = section(guide(), 'Container breakpoints stay fixed');
    for (const value of ['600px', '840px', '1040px', '1200px', '1280px', '--pr-plan-columns']) {
      expect(text, value).toContain(value);
    }
  });

  it('density section says the default writes no density attribute', () => {
    expect(section(guide(), 'Density')).toMatch(/no density attribute/);
  });

  it('never sets a font family token to inherit', () => {
    expect(guide()).not.toMatch(/--pr-font-family(-display)?\s*:\s*inherit/);
  });
});

// [utest->req~theming-docs-accuracy~1]
describe('docs/theming.md', () => {
  const theming = (): string => read('docs/theming.md');

  it('names the structural layer and not the removed pricing-renderer.base entry', () => {
    expect(theming()).toContain('@layer pricing-renderer');
    expect(theming()).not.toContain('pricing-renderer.base');
  });

  it('does not misuse the layer name as a nested layer block', () => {
    expect(theming()).not.toMatch(/@layer\s+pricing-renderer\s*\{[^}]*@layer\s+pricing-renderer\b/);
  });

  it('shows no renderer import wrapped in layer()', () => {
    const pattern = /@import\s+['"]pricing-renderer\/[^'"]+['"]\s+layer\(/;
    for (const line of theming().split('\n')) {
      expect(line).not.toMatch(pattern);
    }
    expect(read('docs/design-systems.md')).not.toMatch(pattern);
  });

  it('never sets a font family token to inherit', () => {
    expect(theming()).not.toMatch(/--pr-font-family(-display)?\s*:\s*inherit/);
  });

  it('names each new token with its default on one line', () => {
    const lines = theming().split('\n');
    const defaults: Record<string, string> = {
      '--pr-font-family': 'unset',
      '--pr-font-family-display': 'unset',
      '--pr-font-weight-regular': '400',
      '--pr-font-weight-medium': '500',
      '--pr-font-weight-bold': '700',
      '--pr-font-weight-heavy': '800',
      '--pr-line-height': '1.5',
      '--pr-sticky-top': '0px',
      '--pr-table-max-height': '80dvh',
      '--pr-table-min-width': '720px',
      '--pr-z-dialog': '1000',
      '--pr-plan-columns': 'unset',
    };
    for (const [token, value] of Object.entries(defaults)) {
      const tokenPattern = new RegExp(`${token}(?![\\w-])`);
      expect(
        lines.some((line) => tokenPattern.test(line) && line.includes(value)),
        `${token} with ${value}`,
      ).toBe(true);
    }
  });
});

describe('docs/api-reference.md', () => {
  it('lists the CSS overlays, the style prop and density', () => {
    const text = read('docs/api-reference.md');
    expect(text).toContain('tokens-shadcn.css');
    expect(text).toContain('theme-minimal.css');
    expect(text).toMatch(/`style`/);
    expect(text).toContain('density');
  });
});
