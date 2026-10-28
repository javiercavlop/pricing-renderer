import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Optional design tokens of base.css (phase 1a, decisions D2-D6 of
// docs/agent-work/phase1a-design-system/intake.md), read from the stylesheet text. Every token is
// optional: base.css uses var(--pr-x, <value it had before>) and theme.css declares none of them,
// so the default look does not change. Computed values are measured by
// tests/browser/design-tokens.spec.ts.

const stylesRoot = fileURLToPath(new URL('../../src/styles/', import.meta.url));
const baseCss = readFileSync(`${stylesRoot}base.css`, 'utf8');
const themeCss = readFileSync(`${stylesRoot}theme.css`, 'utf8');

type Rule = {
  selectors: string[];
  declarations: [string, string][];
  context: string[];
  index: number;
};

const newTokens = [
  '--pr-font-family',
  '--pr-font-family-display',
  '--pr-font-weight-regular',
  '--pr-font-weight-medium',
  '--pr-font-weight-bold',
  '--pr-font-weight-heavy',
  '--pr-line-height',
  '--pr-sticky-top',
  '--pr-table-max-height',
  '--pr-table-min-width',
  '--pr-z-dialog',
  '--pr-plan-columns',
];

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function collapse(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

// Splits on commas outside parentheses and brackets.
function splitTopLevel(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of value) {
    if (char === '(' || char === '[') depth += 1;
    if (char === ')' || char === ']') depth -= 1;
    if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

// Every style rule of a stylesheet in source order, with the at-rule preludes around it.
function parseRules(css: string): Rule[] {
  const rules: Rule[] = [];
  const walk = (text: string, context: string[]) => {
    let position = 0;
    while (position < text.length) {
      const open = text.indexOf('{', position);
      if (open === -1) break;
      const head = collapse(text.slice(position, open));
      let depth = 1;
      let close = open + 1;
      while (depth > 0 && close < text.length) {
        if (text[close] === '{') depth += 1;
        if (text[close] === '}') depth -= 1;
        close += 1;
      }
      const body = text.slice(open + 1, close - 1);
      if (head.startsWith('@')) walk(body, [...context, head]);
      else {
        const declarations: [string, string][] = [];
        for (const declaration of body.split(';')) {
          const colon = declaration.indexOf(':');
          if (colon === -1) continue;
          declarations.push([
            declaration.slice(0, colon).trim().toLowerCase(),
            collapse(declaration.slice(colon + 1)),
          ]);
        }
        rules.push({
          selectors: splitTopLevel(head).map(collapse),
          declarations,
          context,
          index: rules.length,
        });
      }
      position = close;
    }
  };
  walk(stripComments(css), []);
  return rules;
}

const rules = parseRules(baseCss);
const layerName = '@layer pricing-renderer';
const root = 'pricing-renderer[data-pr-root]';
const inLayer = (rule: Rule) => rule.context[0] === layerName;
// Rules of the renderer; the rules of pricing-change-review and the keyframes are left out.
const rendererRules = rules.filter((rule) => rule.selectors.every((s) => s.startsWith(root)));

function values(rule: Rule, property: string): string[] {
  return rule.declarations.filter(([name]) => name === property).map(([, value]) => value);
}

function withSelector(selector: string, scope: Rule[] = rules): Rule[] {
  return scope.filter((rule) => rule.selectors.includes(selector));
}

function only(selector: string, scope: Rule[] = rules): Rule {
  const found = withSelector(selector, scope);
  expect(found, `rules with selector "${selector}"`).toHaveLength(1);
  return found[0];
}

// Rules whose selector list is exactly one selector (the roots, not the grouped reset).
const single = rules.filter((rule) => rule.selectors.length === 1);

// The values of a property in every renderer rule that lists the selector.
function valuesAt(selector: string, property: string): string[] {
  return withSelector(selector, rules).flatMap((rule) => values(rule, property));
}

describe('optional design tokens (phase 1a)', () => {
  // [utest->req~token-fallbacks~1]
  it('has a layered renderer stylesheet to read', () => {
    expect(rules.length).toBeGreaterThan(100);
    expect(rendererRules.length).toBeGreaterThan(100);
    expect(rules.every((rule) => rule.context.length === 0 || inLayer(rule))).toBe(true);
  });

  // [utest->req~token-fallbacks~1]
  it('declares none of the new tokens in theme.css or in base.css', () => {
    const declared = new RegExp(`(^|[\\s;{])(${newTokens.join('|')})\\s*:`, 'g');
    for (const [name, css] of [
      ['theme.css', themeCss],
      ['base.css', baseCss],
    ]) {
      const found = [...stripComments(css).matchAll(declared)].map((match) => match[2]);
      expect(found, `new tokens declared in ${name}`).toEqual([]);
    }
  });

  // [utest->req~token-fallbacks~1]
  it('uses every new token in base.css, each with a fallback (font-family aside)', () => {
    const used = new Map<string, string[]>();
    for (const match of stripComments(baseCss).matchAll(/var\(\s*(--pr-[\w-]+)\s*([,)])/g)) {
      if (!newTokens.includes(match[1])) continue;
      used.set(match[1], [...(used.get(match[1]) ?? []), match[2]]);
    }
    for (const token of newTokens) expect(used.has(token), `${token} is used`).toBe(true);
    for (const [token, endings] of used) {
      // The root font-family has no fallback: unset, it is invalid at computed-value time and the
      // inherited property inherits, like font: inherit. Never use the keyword inherit as a value.
      if (token === '--pr-font-family') continue;
      expect(endings, `${token} has a fallback at every use`).not.toContain(')');
    }
  });

  // [utest->req~font-family-tokens~1]
  it('sets the font-family of both roots from --pr-font-family after font: inherit', () => {
    for (const selector of [root, 'pricing-change-review']) {
      const rootRule = only(selector, single);
      const names = rootRule.declarations.map(([name]) => name);
      expect(names, `${selector} declarations`).toContain('font');
      expect(values(rootRule, 'font')).toEqual(['inherit']);
      expect(values(rootRule, 'font-family')).toEqual(['var(--pr-font-family)']);
      expect(names.indexOf('font-family')).toBeGreaterThan(names.indexOf('font'));
    }
  });

  // [utest->req~font-family-tokens~1]
  it('sets the display font on the hero title, section h3, plan h4 and price amount', () => {
    const display = 'var(--pr-font-family-display, var(--pr-font-family))';
    const sites = [
      `${root} .pr-hero__title`,
      `${root} :where(.pr-section__heading, .pr-configurator, .pr-metadata) h3`,
      `${root} .pr-plan-card__top h4`,
      `${root} .pr-price__amount`,
    ];
    for (const site of sites) {
      expect(valuesAt(site, 'font-family'), `font-family of ${site}`).toEqual([display]);
    }
    const all = rules.flatMap((rule) => values(rule, 'font-family'));
    expect(new Set(all)).toEqual(new Set([display, 'var(--pr-font-family)']));
    expect(all.some((value) => /inherit/.test(value))).toBe(false);
  });

  // [utest->req~font-weight-tokens~1]
  it('has no bare numeric font-weight in any rule of base.css', () => {
    const weights = rules.flatMap((rule) => values(rule, 'font-weight'));
    expect(weights).toHaveLength(37);
    expect(weights.filter((value) => /^\d+$/.test(value))).toEqual([]);
  });

  // [utest->req~font-weight-tokens~1]
  it('groups the weights into four tokens with the old literal as fallback', () => {
    const group: Record<number, string> = {
      400: 'regular',
      500: 'medium',
      650: 'medium',
      700: 'bold',
      750: 'bold',
      780: 'bold',
      790: 'bold',
      800: 'heavy',
      900: 'heavy',
    };
    const weights = rules.flatMap((rule) => values(rule, 'font-weight'));
    const used = new Set<string>();
    const fallbacks: Record<string, number> = {};
    for (const weight of weights) {
      const match = /^var\(--pr-font-weight-(regular|medium|bold|heavy), (\d+)\)$/.exec(weight);
      expect(match, `font-weight "${weight}" uses a weight token`).not.toBeNull();
      if (!match) continue;
      used.add(match[1]);
      expect(match[1], `token for fallback ${match[2]}`).toBe(group[Number(match[2])]);
      fallbacks[match[2]] = (fallbacks[match[2]] ?? 0) + 1;
    }
    expect([...used].sort()).toEqual(['bold', 'heavy', 'medium', 'regular']);
    // The literals of the stylesheet before the tokens, renderer and review rules together (400
    // twice, 500 once, 650 five times, 700 five times, 750 twelve times, 780 once, 790 twice, 800
    // twice, 900 once), plus the six heading rules that took the UA bold and now get 700 (section
    // h3, plan h4, add-on h4, dialog h3, review h2 and review section h3).
    expect(fallbacks).toEqual({
      '400': 2,
      '500': 1,
      '650': 5,
      '700': 11,
      '750': 12,
      '780': 1,
      '790': 2,
      '800': 2,
      '900': 1,
    });
  });

  // [utest->req~font-weight-tokens~1]
  it('gives the six heading rules that took the user-agent bold an explicit bold weight', () => {
    const bold = 'var(--pr-font-weight-bold, 700)';
    for (const site of [
      `${root} :where(.pr-section__heading, .pr-configurator, .pr-metadata) h3`,
      `${root} .pr-plan-card__top h4`,
      `${root} .pr-addon-card h4`,
      `${root} .pr-dialog h3`,
      'pricing-change-review .pr-cr-header h2',
      "pricing-change-review [data-pr-part='change-review'] > section > h3",
    ]) {
      expect(valuesAt(site, 'font-weight'), `font-weight of ${site}`).toEqual([bold]);
    }
  });

  // [utest->req~line-height-token~1]
  it('reads the line height of both roots from --pr-line-height', () => {
    const renderer = only(root, single);
    const review = only('pricing-change-review', single);
    expect(values(renderer, 'line-height')).toEqual(['var(--pr-line-height, 1.5)']);
    expect(values(review, 'line-height')).toEqual(['var(--pr-line-height, 1.5)']);
    for (const rule of [renderer, review]) {
      const names = rule.declarations.map(([name]) => name);
      expect(names.indexOf('line-height')).toBeGreaterThan(names.indexOf('font'));
    }
  });

  // [utest->req~sticky-top-token~1]
  it('classifies every sticky rule, so a new one needs a decision', () => {
    const sticky = rules
      .filter((rule) => values(rule, 'position').includes('sticky'))
      .map((rule) => rule.selectors.join(', '))
      .sort();
    // Measured against the page (use --pr-sticky-top): the comparison toolbar and, from 840px,
    // the add-on-layout summary (it sticks at the top there, at the bottom below 840px).
    // Not measured against the page (never use it): the first column and the header cells of the
    // comparison table stick inside .pr-table-scroll (inline-start and block-start of the scroll
    // box), the mobile summary sticks to the bottom, and the change-review actions stick to the
    // bottom of their container.
    const expected = [
      `${root} .pr-comparison-toolbar`,
      `${root} .pr-comparison-table :where(th, td):first-child`,
      `${root} .pr-comparison-table thead th`,
      `${root} .pr-summary`,
      "pricing-change-review [data-pr-part='change-actions']",
    ];
    expect(sticky).toEqual(expected.sort());
  });

  // [utest->req~sticky-top-token~1]
  it('offsets the toolbar and the 840px summary by --pr-sticky-top, and nothing else', () => {
    const toolbar = only(`${root} .pr-comparison-toolbar`);
    expect(values(toolbar, 'inset-block-start')).toEqual(['var(--pr-sticky-top, 0px)']);

    const summary = rules.filter(
      (rule) =>
        rule.selectors.includes(`${root} .pr-summary`) &&
        rule.context.includes('@container pricing-renderer (min-width: 840px)'),
    );
    expect(summary).toHaveLength(1);
    expect(values(summary[0], 'inset-block-start')).toEqual([
      'calc(var(--pr-sticky-top, 0px) + var(--pr-space-4))',
    ]);

    const usesToken = (rule: Rule) =>
      rule.declarations.some(([, value]) => value.includes('--pr-sticky-top'));
    const users = rules.filter(usesToken).map((rule) => rule.selectors.join(', '));
    expect(users.sort()).toEqual([`${root} .pr-comparison-toolbar`, `${root} .pr-summary`].sort());
  });

  // [utest->req~sticky-top-token~1]
  it('keeps the table header offsets inside the scroll box at 0', () => {
    const head = only(`${root} .pr-comparison-table thead th`);
    expect(values(head, 'inset-block-start')).toEqual(['0']);
    const column = only(`${root} .pr-comparison-table :where(th, td):first-child`);
    expect(values(column, 'inset-inline-start')).toEqual(['0']);
  });

  // [utest->req~table-size-tokens~1]
  it('keeps max-block-size 80vh and sets the token with 80dvh inside @supports', () => {
    const scroll = `${root} .pr-table-scroll`;
    const plain = rules.filter((rule) => rule.selectors.includes(scroll) && inLayer(rule));
    const base = plain.filter((rule) => rule.context.length === 1);
    expect(base).toHaveLength(1);
    expect(values(base[0], 'max-block-size')).toEqual(['80vh']);

    const guarded = plain.filter((rule) =>
      rule.context.includes('@supports (max-block-size: 1dvh)'),
    );
    expect(guarded).toHaveLength(1);
    expect(guarded[0].context).toEqual([layerName, '@supports (max-block-size: 1dvh)']);
    expect(values(guarded[0], 'max-block-size')).toEqual(['var(--pr-table-max-height, 80dvh)']);
    // After the plain rule, so it wins where dvh is supported.
    expect(guarded[0].index).toBeGreaterThan(base[0].index);
    expect(plain.flatMap((rule) => values(rule, 'max-block-size'))).not.toContain('80dvh');
  });

  // [utest->req~table-size-tokens~1]
  it('reads the comparison table min-width from --pr-table-min-width', () => {
    const table = only(`${root} .pr-comparison-table`);
    expect(values(table, 'min-width')).toEqual(['var(--pr-table-min-width, 720px)']);
  });

  // [utest->req~dialog-z-token~1]
  it('reads the dialog z-index from --pr-z-dialog', () => {
    const dialog = only(`${root} .pr-dialog-backdrop`);
    expect(values(dialog, 'z-index')).toEqual(['var(--pr-z-dialog, 1000)']);
    expect(rules.flatMap((rule) => values(rule, 'z-index'))).not.toContain('1000');
  });

  // [utest->req~plan-columns-token~1]
  it('wraps every plan grid grid-template-columns in --pr-plan-columns', () => {
    const planGrid = (selector: string) => /\.pr-plan-grid(?![\w-])/.test(selector);
    const planRules = rules.filter((rule) => rule.selectors.some(planGrid));
    const columns = planRules.flatMap((rule) => values(rule, 'grid-template-columns'));
    // Base, 600 (two rules), 840 (three), 1040 (two) and 1280 (two).
    expect(columns).toHaveLength(10);
    const unwrapped: string[] = [];
    for (const value of columns) {
      const match = /^var\(--pr-plan-columns, (.+)\)$/.exec(value);
      expect(match, `grid-template-columns "${value}" uses the token`).not.toBeNull();
      if (match) unwrapped.push(match[1]);
    }
    const counts: Record<string, number> = {};
    for (const value of unwrapped) counts[value] = (counts[value] ?? 0) + 1;
    expect(counts).toEqual({
      'minmax(0, 1fr)': 1,
      'repeat(2, minmax(0, 1fr))': 2,
      'repeat(2, minmax(0, 320px))': 1,
      'repeat(3, minmax(0, 1fr))': 3,
      'repeat(4, minmax(0, 1fr))': 2,
      'repeat(auto-fit, minmax(220px, 320px))': 1,
    });
  });

  // [utest->req~plan-columns-token~1]
  it('splits the shared rules so the add-on and variable grids never get the token', () => {
    const grids = (selector: string) => /\.pr-(addon|variable)-grid(?![\w-])/.test(selector);
    const planGrid = (selector: string) => /\.pr-plan-grid(?![\w-])/.test(selector);
    const shared = rules.filter(
      (rule) => rule.selectors.some(planGrid) && rule.selectors.some(grids),
    );
    expect(shared.map((rule) => rule.selectors)).toEqual([]);

    const others = rules.filter((rule) => rule.selectors.some(grids));
    expect(others.length).toBeGreaterThan(0);
    for (const rule of others) {
      for (const [name, value] of rule.declarations) {
        expect(value, `${rule.selectors.join(', ')} ${name}`).not.toContain('--pr-plan-columns');
      }
    }
    // Their own columns are what the shared rules gave them.
    const columnsAt = (grid: string, band: string | null) => {
      const prelude = `@container pricing-renderer (min-width: ${band})`;
      const inBand = (rule: Rule) =>
        band === null ? rule.context.length === 1 : rule.context.includes(prelude);
      return others
        .filter((rule) => rule.selectors.includes(`${root} .pr-${grid}-grid`) && inBand(rule))
        .flatMap((rule) => values(rule, 'grid-template-columns'));
    };
    expect(columnsAt('addon', null)).toContain('minmax(0, 1fr)');
    expect(columnsAt('addon', '600px')).toContain('repeat(2, minmax(0, 1fr))');
    expect(columnsAt('addon', '1200px')).toContain('repeat(3, minmax(0, 1fr))');
    expect(columnsAt('variable', null)).toContain('minmax(0, 1fr)');
    expect(columnsAt('variable', '600px')).toContain('repeat(2, minmax(0, 1fr))');
  });
});
