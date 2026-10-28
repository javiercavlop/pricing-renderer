import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { bands, expectedColumns } from '../browser/helpers/plan-columns.js';

// CSS contract of the plan grid (spectra-item8) and of word breaking (spectra-item10), read from
// the stylesheet text. Layout itself is measured by tests/browser/spectra-grid.spec.ts and
// tests/browser/spectra-text.spec.ts.

const stylesRoot = fileURLToPath(new URL('../../src/styles/', import.meta.url));
const baseCss = readFileSync(`${stylesRoot}base.css`, 'utf8');
const allCss = readdirSync(stylesRoot)
  .filter((file) => file.endsWith('.css'))
  .map((file) => readFileSync(`${stylesRoot}${file}`, 'utf8'))
  .join('\n');
const gridSpec = readFileSync(
  fileURLToPath(new URL('../../docs/agent-work/spectra-item8-grid/spec.md', import.meta.url)),
  'utf8',
);

// The bands and expectedColumns come from tests/browser/helpers/plan-columns.ts, which
// tests/browser/spectra-grid.spec.ts uses too; the test below checks them against the spec table.

type Rule = { selectors: string[]; declarations: Map<string, string>; order: number };
type Block = { prelude: string; rules: Rule[]; blocks: Block[] };

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

// Splits on a separator outside parentheses and brackets.
function splitTopLevel(value: string, separator: ','): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of value) {
    if (char === '(' || char === '[') depth += 1;
    if (char === ')' || char === ']') depth -= 1;
    if (char === separator && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

let ruleOrder = 0;

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
      block.blocks.push(parseBlock(body, head));
    } else {
      const declarations = new Map<string, string>();
      for (const declaration of body.split(';')) {
        const colon = declaration.indexOf(':');
        if (colon === -1) continue;
        declarations.set(
          declaration.slice(0, colon).trim().toLowerCase(),
          declaration
            .slice(colon + 1)
            .replace(/\s+/g, ' ')
            .trim(),
        );
      }
      block.rules.push({
        selectors: splitTopLevel(head.replace(/\s+/g, ' '), ','),
        declarations,
        order: (ruleOrder += 1),
      });
    }
    index = close;
  }
  return block;
}

const sheet = parseBlock(stripComments(baseCss));
const layer = sheet.blocks.find((block) => block.prelude === '@layer pricing-renderer');

function containerMin(prelude: string): number | null {
  const match = /^@container pricing-renderer \(min-width: (\d+)px\)$/.exec(prelude);
  return match ? Number(match[1]) : null;
}

function allRules(block: Block): Rule[] {
  return [...block.rules, ...block.blocks.flatMap(allRules)];
}

// Rules that apply at a container width, in source order (top-level layer rules and the matching
// @container blocks; @media and other blocks are left out).
function rulesAt(width: number): Rule[] {
  if (!layer) return [];
  const rules = [...layer.rules];
  for (const block of layer.blocks) {
    const min = containerMin(block.prelude);
    if (min !== null && width >= min) rules.push(...block.rules);
  }
  return rules.sort((a, b) => a.order - b.order);
}

// Compounds of a complex selector, split on descendant, >, + and ~ combinators outside parentheses.
function compounds(selector: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of selector) {
    if (char === '(' || char === '[') depth += 1;
    if (char === ')' || char === ']') depth -= 1;
    if (depth === 0 && /[\s>+~]/.test(char)) {
      if (current) parts.push(current);
      current = '';
    } else current += char;
  }
  if (current) parts.push(current);
  return parts;
}

function lastCompound(selector: string): string {
  return compounds(selector).at(-1) ?? '';
}

// Simple selectors of a compound: .class, #id, [attr], :pseudo, :pseudo(args), ::element, tag, *.
function simpleSelectors(compound: string): string[] {
  const parts: string[] = [];
  let index = 0;
  while (index < compound.length) {
    let end = index + 1;
    if (compound[index] === '[') {
      end = compound.indexOf(']', index) + 1;
    } else {
      if (compound[index] === ':' && compound[end] === ':') end += 1;
      while (end < compound.length && !/[.#:[(]/.test(compound[end])) end += 1;
      if (compound[end] === '(') {
        let depth = 0;
        for (; end < compound.length; end += 1) {
          if (compound[end] === '(') depth += 1;
          if (compound[end] === ')') depth -= 1;
          if (depth === 0) break;
        }
        end += 1;
      }
    }
    parts.push(compound.slice(index, end));
    index = end;
  }
  return parts;
}

function pseudoArgument(simple: string): string {
  return simple.slice(simple.indexOf('(') + 1, -1).trim();
}

type Specificity = [number, number, number];

function specificity(selector: string): Specificity {
  const total: Specificity = [0, 0, 0];
  for (const compound of compounds(selector)) {
    for (const simple of simpleSelectors(compound)) {
      let add: Specificity = [0, 0, 0];
      if (simple.startsWith(':where(')) add = [0, 0, 0];
      else if (/^:(is|not|has)\(/.test(simple)) {
        add = splitTopLevel(pseudoArgument(simple), ',')
          .map(specificity)
          .reduce((best, next) => (compare(next, best) > 0 ? next : best), [0, 0, 0]);
      } else if (simple.startsWith('#')) add = [1, 0, 0];
      else if (simple.startsWith('::')) add = [0, 0, 1];
      else if (/^[.:[]/.test(simple)) add = [0, 1, 0];
      else if (simple !== '*') add = [0, 0, 1];
      total[0] += add[0];
      total[1] += add[1];
      total[2] += add[2];
    }
  }
  return total;
}

function compare(a: Specificity, b: Specificity): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

const planGridClass = /^\.pr-plan-grid$/;

function targetsPlanGrid(selector: string): boolean {
  return simpleSelectors(lastCompound(selector)).some((simple) => planGridClass.test(simple));
}

// Whether the plan grid compound matches a grid with `plans` children. Only the forms this
// stylesheet needs are understood; anything else fails the test instead of being guessed.
function compoundMatches(compound: string, plans: number): boolean {
  return simpleSelectors(compound).every((simple) => {
    if (planGridClass.test(simple)) return true;
    if (/^:(where|is)\(/.test(simple)) {
      return splitTopLevel(pseudoArgument(simple), ',').some((item) =>
        compoundMatches(item, plans),
      );
    }
    if (simple.startsWith(':not(')) {
      return !splitTopLevel(pseudoArgument(simple), ',').some((item) =>
        compoundMatches(item, plans),
      );
    }
    if (simple.startsWith(':has(')) {
      const child = /^>\s*(.+)$/.exec(pseudoArgument(simple));
      if (!child) throw new Error(`Unsupported :has() form in "${compound}".`);
      const parts = simpleSelectors(child[1].trim());
      const nth = parts.map((part) => /^:nth-child\((\d+)\)$/.exec(part)).find(Boolean);
      const last = parts.includes(':last-child');
      if (parts.some((part) => !/^:nth-child\(\d+\)$/.test(part) && part !== ':last-child')) {
        throw new Error(`Unsupported child selector in "${compound}".`);
      }
      if (nth && last) return plans === Number(nth[1]);
      if (nth) return plans >= Number(nth[1]);
      return plans >= 1;
    }
    throw new Error(`Unsupported plan grid selector part "${simple}" in "${compound}".`);
  });
}

// Plan grid rules the evaluator below would get wrong: a rule outside the first
// `@layer pricing-renderer` block and its `@container pricing-renderer (min-width: Npx)` blocks
// (top level, @media, @supports, a second @layer, another @container prelude, nested blocks), and a
// `grid` or `grid-template` shorthand, which can set the columns too.
function unsupportedPlanGridRules(root: Block): string[] {
  const rootLayer = root.blocks.find((block) => block.prelude === '@layer pricing-renderer');
  const found: string[] = [];
  const visit = (block: Block, recognized: boolean) => {
    for (const rule of block.rules) {
      const selectors = rule.selectors.filter(targetsPlanGrid);
      if (selectors.length === 0) continue;
      const where = block.prelude || '(top level)';
      if (!recognized) found.push(`${where}: ${selectors.join(', ')}`);
      for (const shorthand of ['grid', 'grid-template']) {
        if (rule.declarations.has(shorthand)) {
          found.push(`${where}: ${shorthand} on ${selectors.join(', ')}`);
        }
      }
    }
    for (const child of block.blocks) {
      const known =
        (block === root && child === rootLayer) ||
        (block === rootLayer && containerMin(child.prelude) !== null);
      visit(child, known);
    }
  };
  visit(root, false);
  return found;
}

function assertPlanGridEvaluable(root: Block): void {
  const found = unsupportedPlanGridRules(root);
  if (found.length > 0) {
    throw new Error(`Plan grid rules the test cannot evaluate: ${found.join('; ')}`);
  }
}

type Winner = { value: string; selector: string };

// A plan grid value is `var(--pr-plan-columns, X)` (phase 1a) and evaluates to X. A value that is
// not a var() is returned as it is with a null variable, so the expectations below keep their
// values; the test "wraps every plan grid value in --pr-plan-columns" asserts the variable name.
function unwrapPlanColumns(value: string): { variable: string | null; value: string } {
  const match = /^var\((--[\w-]+),\s*(.+)\)$/.exec(value);
  return match ? { variable: match[1], value: match[2].trim() } : { variable: null, value };
}

// The grid-template-columns that wins for a plan grid with `plans` cards at a container width.
function planColumnsAt(width: number, plans: number): Winner | null {
  assertPlanGridEvaluable(sheet);
  let winner: (Winner & { specificity: Specificity; order: number }) | null = null;
  for (const rule of rulesAt(width)) {
    const declared = rule.declarations.get('grid-template-columns');
    if (!declared) continue;
    const value = unwrapPlanColumns(declared).value;
    for (const selector of rule.selectors) {
      if (!targetsPlanGrid(selector) || !compoundMatches(lastCompound(selector), plans)) continue;
      const candidate = { value, selector, specificity: specificity(selector), order: rule.order };
      if (
        !winner ||
        compare(candidate.specificity, winner.specificity) > 0 ||
        (compare(candidate.specificity, winner.specificity) === 0 && candidate.order > winner.order)
      ) {
        winner = candidate;
      }
    }
  }
  return winner && { value: winner.value, selector: winner.selector };
}

const fluid = (columns: number) => `repeat(${columns}, minmax(0, 1fr))`;
const planCounts = Array.from({ length: 14 }, (_, index) => index + 3);

describe('plan grid columns (spectra-item8)', () => {
  // [utest->spectra-item8:AC1]
  it('has container query blocks for the 840, 1040 and 1280 bands', () => {
    expect(layer).toBeDefined();
    const mins = (layer?.blocks ?? []).map((block) => containerMin(block.prelude));
    for (const min of [600, 840, 1040, 1280]) expect(mins).toContain(min);
  });

  // [utest->req~plan-columns-token~1]
  it('wraps every plan grid value in --pr-plan-columns', () => {
    const wrong: string[] = [];
    let checked = 0;
    for (const rule of allRules(layer ?? sheet)) {
      const declared = rule.declarations.get('grid-template-columns');
      if (!declared || !rule.selectors.some(targetsPlanGrid)) continue;
      checked += 1;
      if (unwrapPlanColumns(declared).variable !== '--pr-plan-columns') {
        wrong.push(`${rule.selectors.join(', ')}: ${declared}`);
      }
    }
    expect(checked).toBeGreaterThan(0);
    expect(wrong).toEqual([]);
    expect(unwrapPlanColumns('var(--pr-plan-columns, repeat(2, minmax(0, 1fr)))')).toEqual({
      variable: '--pr-plan-columns',
      value: 'repeat(2, minmax(0, 1fr))',
    });
  });

  // [utest->spectra-item8:AC2]
  it('uses fixed 320px plan tracks only in rules for one or two plans', () => {
    const offending: string[] = [];
    for (const rule of allRules(layer ?? sheet)) {
      const value = rule.declarations.get('grid-template-columns') ?? '';
      if (!value.includes('320px')) continue;
      for (const selector of rule.selectors) {
        if (!targetsPlanGrid(selector)) continue;
        const compound = lastCompound(selector);
        if (planCounts.some((plans) => compoundMatches(compound, plans))) offending.push(selector);
      }
    }
    expect(offending).toEqual([]);
  });

  // [utest->spectra-item8:AC3]
  it('keeps one column below 600px and two fluid columns from 600 to 839px', () => {
    for (const plans of [1, 2, ...planCounts]) {
      expect(planColumnsAt(0, plans)?.value, `${plans} plans below 600`).toBe('minmax(0, 1fr)');
      expect(planColumnsAt(599, plans)?.value, `${plans} plans at 599`).toBe('minmax(0, 1fr)');
    }
    for (const width of [600, 839]) {
      for (const plans of planCounts) {
        expect(planColumnsAt(width, plans)?.value, `${plans} plans at ${width}`).toBe(fluid(2));
      }
    }
  });

  // [utest->spectra-item8:AC4]
  it('selects the balanced fluid column count for 3 to 16 plans in every band', () => {
    for (const band of bands) {
      for (const width of [band.min, band.max]) {
        for (const plans of planCounts) {
          const expected = fluid(expectedColumns(plans, band.columns));
          expect(planColumnsAt(width, plans)?.value, `${plans} plans at ${width}`).toBe(expected);
        }
      }
    }
  });

  // [utest->spectra-item8:AC4]
  it('keeps the centered one and two plan tracks of at most 320px', () => {
    for (const plans of [1, 2]) {
      for (const width of [600, 839]) {
        expect(planColumnsAt(width, plans)?.value, `${plans} plans at ${width}`).toBe(
          'repeat(2, minmax(0, 320px))',
        );
      }
      for (const width of [840, 1040, 1279, 1280, 1600]) {
        expect(planColumnsAt(width, plans)?.value, `${plans} plans at ${width}`).toBe(
          'repeat(auto-fit, minmax(220px, 320px))',
        );
      }
    }
  });

  // [utest->spectra-item8:AC4]
  it('matches the column table of the spec', () => {
    const rows = gridSpec
      .split('\n')
      .map((line) => line.split('|').map((cell) => cell.trim()))
      .filter((cells) => /^\d+$/.test(cells[1] ?? ''));
    const table = new Map(rows.map((cells) => [Number(cells[1]), cells.slice(2, 6)]));
    for (const plans of planCounts) {
      const cells = table.get(plans);
      expect(cells, `spec row for ${plans} plans`).toBeDefined();
      expect(cells?.[0], `600-839 for ${plans}`).toMatch(/^2\b/);
      bands.forEach((band, index) => {
        const columns = String(expectedColumns(plans, band.columns));
        expect(cells?.[index + 1].split(' ')[0], `${band.name} for ${plans}`).toBe(columns);
      });
    }
  });

  it('refuses plan grid rules it cannot evaluate', () => {
    expect(unsupportedPlanGridRules(sheet)).toEqual([]);
    const layered = (inner: string) =>
      parseBlock(stripComments(`@layer pricing-renderer { ${inner} }`));
    const cases = [
      '@media (min-width: 900px) { .pr-plan-grid { grid-template-columns: 1fr; } }',
      '@supports (display: grid) { .pr-plan-grid { grid-template-columns: 1fr; } }',
      '@container (min-width: 900px) { .pr-plan-grid { grid-template-columns: 1fr; } }',
      '@container pricing-renderer (min-width: 900px) { @media print { .pr-plan-grid { gap: 0; } } }',
      '.pr-plan-grid { grid: auto / 1fr 1fr; }',
      '@container pricing-renderer (min-width: 900px) { .pr-plan-grid { grid-template: auto / 1fr; } }',
    ];
    for (const css of cases) {
      const root = layered(css);
      expect(unsupportedPlanGridRules(root), css).not.toEqual([]);
      expect(() => assertPlanGridEvaluable(root), css).toThrow();
    }
    const twoLayers = parseBlock(
      '@layer pricing-renderer { .pr-plan-grid { gap: 0; } } @layer pricing-renderer { .pr-plan-grid { gap: 1px; } }',
    );
    expect(unsupportedPlanGridRules(twoLayers)).toHaveLength(1);
    expect(unsupportedPlanGridRules(parseBlock('.pr-plan-grid { gap: 0; }'))).toHaveLength(1);
    expect(
      unsupportedPlanGridRules(layered('@media (hover: hover) { .pr-plan-card { gap: 0; } }')),
    ).toEqual([]);
  });

  it('balances the documented examples', () => {
    expect(expectedColumns(4, 3)).toBe(2);
    expect(expectedColumns(5, 4)).toBe(3);
    expect(expectedColumns(7, 3)).toBe(3);
    expect(expectedColumns(13, 4)).toBe(4);
    expect(expectedColumns(16, 3)).toBe(2);
    expect(expectedColumns(6, 4)).toBe(3);
  });
});

const forbiddenAnywhere = [
  /^\.pr-shell$/,
  /^\.pr-value(--[\w-]+)?$/,
  /^\.pr-comparison-table$/,
  /^\.pr-feature-card$/,
  /^\.pr-plan-card$/,
  /^\.pr-content$/,
  /^\.pr-flow$/,
];

// True when a compound (including :where/:is/:not arguments) names a value cell, dt, dd, th, td,
// one of the listed containers, the root element or the universal selector.
function namesForbiddenTarget(compound: string): boolean {
  if (/(^|[^\w-])(dt|dd|th|td)(?![\w-])/.test(compound)) return true;
  return simpleSelectors(compound).some((simple) => {
    if (/^:(where|is|not|has)\(/.test(simple)) {
      return splitTopLevel(pseudoArgument(simple).replace(/^[>+~]\s*/, ''), ',').some((item) =>
        namesForbiddenTarget(lastCompound(item)),
      );
    }
    return (
      forbiddenAnywhere.some((pattern) => pattern.test(simple)) ||
      simple === '*' ||
      simple === 'pricing-renderer'
    );
  });
}

describe('word breaking (spectra-item10)', () => {
  const rules = allRules(parseBlock(stripComments(allCss)));

  // [utest->spectra-item10:AC4]
  it('declares overflow-wrap: anywhere on no shell, cell, table, card or flow selector', () => {
    const offending = rules.flatMap((rule) => {
      const values = [
        rule.declarations.get('overflow-wrap'),
        rule.declarations.get('word-wrap'),
      ].filter(Boolean);
      if (!values.some((value) => /\banywhere\b/.test(value ?? ''))) return [];
      return rule.selectors.filter((selector) => namesForbiddenTarget(lastCompound(selector)));
    });
    expect(offending).toEqual([]);
  });

  // [utest->spectra-item10:AC4]
  it('still lets long strings wrap somewhere in the stylesheet', () => {
    const values = rules.flatMap((rule) => [
      rule.declarations.get('overflow-wrap') ?? '',
      rule.declarations.get('word-wrap') ?? '',
    ]);
    expect(values.some((value) => /\b(break-word|anywhere)\b/.test(value))).toBe(true);
  });

  // [utest->spectra-item10:AC4]
  it('never enables automatic hyphenation', () => {
    expect(allCss).not.toMatch(/(^|[\s;{])(-webkit-)?hyphens\s*:\s*auto/);
  });

  it('recognizes the forbidden targets', () => {
    expect(namesForbiddenTarget(lastCompound('pricing-renderer[data-pr-root] .pr-shell'))).toBe(
      true,
    );
    expect(namesForbiddenTarget(lastCompound('.pr-feature-card :where(dt, dd)'))).toBe(true);
    expect(namesForbiddenTarget(lastCompound('.pr-comparison-table :where(th, td)'))).toBe(true);
    expect(namesForbiddenTarget(lastCompound('.pr-plan-card .pr-value--code'))).toBe(true);
    expect(namesForbiddenTarget(lastCompound('.pr-hero__title'))).toBe(false);
    expect(namesForbiddenTarget(lastCompound('.pr-plan-card__top'))).toBe(false);
  });
});
