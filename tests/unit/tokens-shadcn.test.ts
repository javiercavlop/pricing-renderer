import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const cssPath = fileURLToPath(new URL('../../src/styles/tokens-shadcn.css', import.meta.url));
const packagePath = fileURLToPath(new URL('../../package.json', import.meta.url));

function readOverlay(): string {
  expect(existsSync(cssPath), 'src/styles/tokens-shadcn.css should exist').toBe(true);
  return readFileSync(cssPath, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
}

interface Block {
  prelude: string;
  body: string;
}

// Statements and blocks at the top level of a stylesheet (depth 0), in order.
function topLevel(css: string): Block[] {
  const blocks: Block[] = [];
  let depth = 0;
  let start = 0;
  let bodyStart = 0;
  let prelude = '';
  for (let index = 0; index < css.length; index += 1) {
    const char = css[index];
    if (char === '{') {
      if (depth === 0) {
        prelude = css.slice(start, index).replace(/\s+/g, ' ').trim();
        bodyStart = index + 1;
      }
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        blocks.push({ prelude, body: css.slice(bodyStart, index) });
        start = index + 1;
      }
    } else if (char === ';' && depth === 0) {
      const statement = css.slice(start, index + 1).replace(/\s+/g, ' ');
      blocks.push({ prelude: statement.trim(), body: '' });
      start = index + 1;
    }
  }
  return blocks;
}

function declarationsOf(body: string): Record<string, string> {
  const declarations: Record<string, string> = {};
  for (const declaration of body.split(';')) {
    const colon = declaration.indexOf(':');
    if (colon < 0) continue;
    declarations[declaration.slice(0, colon).trim()] = declaration
      .slice(colon + 1)
      .replace(/\s+/g, ' ')
      .trim();
  }
  return declarations;
}

function overlayRules(): Block[] {
  const blocks = topLevel(readOverlay());
  const layer = blocks.find((block) => block.prelude === '@layer pricing-renderer.shadcn');
  expect(layer, 'a @layer pricing-renderer.shadcn block').toBeDefined();
  return topLevel(layer!.body);
}

const isDark = (rule: Block): boolean => rule.prelude.includes('.dark');

function declarationsWhere(filter: (rule: Block) => boolean): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const rule of overlayRules().filter(filter)) {
    Object.assign(merged, declarationsOf(rule.body));
  }
  return merged;
}

// [utest->req~tokens-shadcn-overlay~2]
describe('tokens-shadcn.css overlay', () => {
  it('starts with the layer order statement', () => {
    const blocks = topLevel(readOverlay());
    expect(blocks[0]?.prelude).toBe('@layer pricing-renderer.theme, pricing-renderer.shadcn;');
  });

  it('puts every other rule in the pricing-renderer.shadcn layer', () => {
    const blocks = topLevel(readOverlay()).slice(1);
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      expect(block.prelude).toBe('@layer pricing-renderer.shadcn');
    }
  });

  it('does not declare the tokens shadcn has no variable for', () => {
    const css = readOverlay();
    for (const name of ['success', 'warning', 'warning-surface', 'overlay']) {
      expect(css).not.toMatch(new RegExp(`--pr-color-${name}\\s*:`));
    }
    expect(css).not.toMatch(/--pr-shadow[\w-]*\s*:/);
  });
});

// [utest->req~tokens-shadcn-mapping~1]
describe('tokens-shadcn.css mapping', () => {
  const mapping: Record<string, string> = {
    '--pr-color-accent': 'var(--primary)',
    '--pr-color-on-accent': 'var(--primary-foreground)',
    '--pr-color-text': 'var(--foreground)',
    '--pr-color-muted': 'var(--muted-foreground)',
    '--pr-color-surface': 'var(--card)',
    '--pr-color-surface-raised': 'var(--popover)',
    '--pr-color-surface-subtle': 'var(--muted)',
    '--pr-color-border': 'var(--border)',
    '--pr-color-border-strong': 'var(--input)',
    '--pr-color-focus': 'var(--ring)',
    '--pr-color-link': 'var(--primary)',
    '--pr-radius-lg': 'var(--radius)',
    '--pr-radius-md': 'calc(var(--radius) - 2px)',
    '--pr-radius-sm': 'calc(var(--radius) - 4px)',
  };

  it('maps every token to its shadcn variable', () => {
    const declarations = declarationsWhere((rule) => !isDark(rule));
    for (const [token, value] of Object.entries(mapping)) {
      expect(declarations[token], token).toBe(value);
    }
  });

  it('applies the light rule to the renderer and the change review', () => {
    const light = overlayRules().filter((rule) => !isDark(rule));
    const selectors = light.flatMap((rule) => rule.prelude.split(',').map((s) => s.trim()));
    expect(selectors).toContain('pricing-renderer[data-pr-root]');
    expect(selectors).toContain('pricing-change-review');
  });

  it('sets color-scheme light by default', () => {
    expect(declarationsWhere((rule) => !isDark(rule))['color-scheme']).toBe('light');
  });

  it("sets color-scheme dark under the .dark selectors with theme='auto'", () => {
    const dark = overlayRules().filter(isDark);
    expect(dark.length).toBeGreaterThan(0);
    const selectors = dark.flatMap((rule) => rule.prelude.split(',').map((s) => s.trim()));
    expect(selectors).toEqual([
      ".dark pricing-renderer[data-pr-root][theme='auto']",
      ".dark pricing-change-review[theme='auto']",
    ]);
    expect(selectors).not.toContain('.dark pricing-renderer[data-pr-root]');
    expect(selectors).not.toContain('.dark pricing-change-review');
    expect(declarationsWhere(isDark)['color-scheme']).toBe('dark');
    expect(Object.keys(declarationsWhere(isDark))).toEqual(['color-scheme']);
  });
});

// [utest->req~tokens-shadcn-export~1]
describe('tokens-shadcn.css package export', () => {
  it('exports ./tokens-shadcn.css from dist/styles', () => {
    const manifest = JSON.parse(readFileSync(packagePath, 'utf8')) as {
      exports: Record<string, unknown>;
    };
    expect(manifest.exports['./tokens-shadcn.css']).toBe('./dist/styles/tokens-shadcn.css');
  });
});
