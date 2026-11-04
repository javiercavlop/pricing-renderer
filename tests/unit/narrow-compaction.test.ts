import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// CSS contract of the compaction above the plans below 840px (UX-3, docs/agent-work/ux-review/
// report.md), read from the stylesheet text. The same three rules apply from 840px; the two blocks
// must not drift. Layout itself is measured by tests/browser/ux-stress.spec.ts.

type Rule = { selectors: string[]; declarations: Map<string, string> };
type Block = { prelude: string; rules: Rule[]; blocks: Block[] };

const baseCss = readFileSync(
  fileURLToPath(new URL('../../src/styles/base.css', import.meta.url)),
  'utf8',
);

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

// One space between tokens, none inside parentheses (the stylesheet wraps a long calc()).
function collapse(value: string): string {
  const spaced = value.replace(/\s+/g, ' ');
  return spaced.replace(/\( /g, '(').replace(/ \)/g, ')').trim();
}

function parseBlock(css: string, prelude = ''): Block {
  const block: Block = { prelude, rules: [], blocks: [] };
  let index = 0;
  while (index < css.length) {
    const open = css.indexOf('{', index);
    if (open === -1) break;
    const head = css.slice(index, open).trim();
    let depth = 1;
    let close = open + 1;
    while (depth > 0 && close < css.length) {
      if (css[close] === '{') depth += 1;
      if (css[close] === '}') depth -= 1;
      close += 1;
    }
    const body = css.slice(open + 1, close - 1);
    if (head.startsWith('@')) {
      block.blocks.push(parseBlock(body, collapse(head)));
    } else {
      const declarations = new Map<string, string>();
      for (const declaration of body.split(';')) {
        const colon = declaration.indexOf(':');
        if (colon === -1) continue;
        declarations.set(
          declaration.slice(0, colon).trim().toLowerCase(),
          collapse(declaration.slice(colon + 1)),
        );
      }
      block.rules.push({ selectors: head.split(',').map(collapse), declarations });
    }
    index = close;
  }
  return block;
}

const sheet = parseBlock(stripComments(baseCss));
const layer = sheet.blocks.find((block) => block.prelude === '@layer pricing-renderer');
const narrow = layer?.blocks.filter(
  (block) => block.prelude === '@container pricing-renderer (max-width: 839.98px)',
);
const wide = layer?.blocks.filter(
  (block) => block.prelude === '@container pricing-renderer (min-width: 840px)',
);

const root = 'pricing-renderer[data-pr-root]';
const contentSelector = `${root} .pr-content`;
const afterPlansSelector = `${root} .pr-content > [data-pr-part='plans'] ~ *`;
const headingSelector = `${root} [data-pr-part='plans'] > .pr-section__heading`;

const gapValue = 'min(var(--pr-space-section), var(--pr-space-5))';
const expected = new Map<string, Map<string, string>>([
  [
    contentSelector,
    new Map([
      ['gap', gapValue],
      ['padding-block-start', 'min(var(--pr-shell-padding), var(--pr-space-4))'],
    ]),
  ],
  [
    afterPlansSelector,
    new Map([['margin-block-start', `calc(var(--pr-space-section) - ${gapValue})`]]),
  ],
  [headingSelector, new Map([['margin-block-end', 'var(--pr-space-3)']])],
]);

function findRule(block: Block | undefined, selector: string): Rule | undefined {
  return block?.rules.find((rule) => rule.selectors.join(',') === selector);
}

// Declarations of the three rules that the UX-3 compaction sets, in one block.
function compactionOf(block: Block | undefined): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {};
  for (const [selector, properties] of expected) {
    const rule = findRule(block, selector);
    result[selector] = Object.fromEntries(
      [...properties.keys()].map((property) => [property, rule?.declarations.get(property) ?? '']),
    );
  }
  return result;
}

function allSelectors(block: Block): string[] {
  return [...block.rules.flatMap((rule) => rule.selectors), ...block.blocks.flatMap(allSelectors)];
}

describe('compaction above the plans below 840px (UX-3)', () => {
  it('has exactly one max-width 839.98px container block in the layer', () => {
    expect(layer).toBeDefined();
    expect(narrow).toHaveLength(1);
  });

  it('contains the three rules with the exact declarations and nothing else', () => {
    const block = narrow?.[0];
    expect(block?.blocks).toEqual([]);
    expect(block?.rules.map((rule) => rule.selectors)).toEqual(
      [...expected.keys()].map((selector) => [selector]),
    );
    for (const [selector, properties] of expected) {
      const rule = findRule(block, selector);
      expect([...(rule?.declarations ?? [])], selector).toEqual([...properties]);
    }
  });

  it('keeps the host override possible: tokens inside min(), no literal lengths', () => {
    const block = narrow?.[0];
    const values = (block?.rules ?? []).flatMap((rule) => [...rule.declarations.values()]);
    expect(values.length).toBe(4);
    for (const value of values) {
      expect(value, value).toMatch(/var\(--pr-/);
      expect(value, value).not.toMatch(/\d(px|rem|em|%|cqi|vw|vh)\b/);
    }
    for (const property of ['gap', 'padding-block-start']) {
      const rule = findRule(block, contentSelector);
      expect(rule?.declarations.get(property), property).toMatch(/^min\(var\(--pr-[\w-]+\), /);
    }
  });

  it('adds back to the margin after the plans exactly what the gap cap removes', () => {
    const block = narrow?.[0];
    const gap = findRule(block, contentSelector)?.declarations.get('gap');
    const margin = findRule(block, afterPlansSelector)?.declarations.get('margin-block-start');
    expect(gap).toBe(gapValue);
    expect(margin).toBe(`calc(var(--pr-space-section) - ${gap})`);
  });

  it('declares the same three properties identically from 840px', () => {
    expect(wide).toHaveLength(1);
    expect(compactionOf(narrow?.[0])).toEqual(compactionOf(wide?.[0]));
    for (const properties of Object.values(compactionOf(narrow?.[0]))) {
      for (const value of Object.values(properties)) expect(value).not.toBe('');
    }
  });

  it('does not touch the plan card or anything inside it', () => {
    const selectors = narrow?.[0] ? allSelectors(narrow[0]) : [];
    expect(selectors.length).toBeGreaterThan(0);
    for (const selector of selectors) expect(selector).not.toMatch(/\.pr-plan-card/);
  });

  it('comes after the base rules it overrides, so the equal specificity resolves to it', () => {
    const baseRule = findRule(layer, contentSelector);
    expect(baseRule?.declarations.get('gap')).toBe('var(--pr-space-section)');
    expect(baseCss.indexOf(`${contentSelector} {`)).toBeLessThan(
      baseCss.indexOf('(max-width: 839.98px)'),
    );
  });
});
