import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const minimalPath = fileURLToPath(new URL('../../src/styles/theme-minimal.css', import.meta.url));
const themePath = fileURLToPath(new URL('../../src/styles/theme.css', import.meta.url));
const packagePath = fileURLToPath(new URL('../../package.json', import.meta.url));

function readCss(path: string): string {
  expect(existsSync(path), `${path} should exist`).toBe(true);
  return readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
}

interface Rule {
  // enclosing at-rules, outermost first, e.g. ['@layer pricing-renderer.theme', '@media (...)']
  context: string[];
  selectors: string[];
  declarations: Map<string, string>;
}

const collapse = (value: string): string => value.replace(/\s+/g, ' ').trim();

function matchingBrace(css: string, open: number): number {
  let depth = 0;
  for (let index = open; index < css.length; index += 1) {
    if (css[index] === '{') depth += 1;
    else if (css[index] === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  throw new Error('unbalanced braces');
}

// Parses comment-free CSS into style rules with their enclosing at-rules. Statements without a
// block (`@layer a, b;`) are skipped.
function parseRules(css: string, context: string[] = []): Rule[] {
  const rules: Rule[] = [];
  let start = 0;
  let index = 0;
  while (index < css.length) {
    const char = css[index];
    if (char === ';') {
      start = index + 1;
    } else if (char === '{') {
      const end = matchingBrace(css, index);
      const prelude = collapse(css.slice(start, index));
      const body = css.slice(index + 1, end);
      if (prelude.startsWith('@')) {
        rules.push(...parseRules(body, [...context, prelude]));
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
        rules.push({
          context,
          selectors: prelude.split(',').map(collapse),
          declarations,
        });
      }
      start = end + 1;
      index = end;
    }
    index += 1;
  }
  return rules;
}

const summary = (rule: Rule): unknown => ({
  context: rule.context,
  selectors: rule.selectors,
  properties: [...rule.declarations.keys()].sort(),
});

const minimalRules = (): Rule[] => parseRules(readCss(minimalPath));
const themeRules = (): Rule[] => parseRules(readCss(themePath));

// [utest->req~theme-minimal-tokens~1]
describe('theme-minimal.css tokens', () => {
  it('uses the pricing-renderer.theme layer for every rule', () => {
    const rules = minimalRules();
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) expect(rule.context[0]).toBe('@layer pricing-renderer.theme');
  });

  it('has the same rules as theme.css: layer, media, selector list, properties, order', () => {
    const reference = themeRules();
    expect(reference.length).toBeGreaterThan(0);
    expect(minimalRules().map(summary)).toEqual(reference.map(summary));
  });

  it('has the .dark selectors in the dark rule', () => {
    const dark = minimalRules().find((rule) =>
      rule.selectors.includes("pricing-renderer[data-pr-root][theme='dark']"),
    );
    expect(dark, 'the dark rule').toBeDefined();
    expect(dark?.selectors).toEqual(
      expect.arrayContaining([
        "[data-theme='dark'] pricing-renderer[data-pr-root]",
        "pricing-change-review[theme='dark']",
        "[data-theme='dark'] pricing-change-review",
        '.dark pricing-renderer[data-pr-root]',
        '.dark pricing-change-review',
      ]),
    );
  });
});

const COLOR_TOKENS_FLAT_EXEMPT = new Set([
  '--pr-color-border',
  '--pr-color-border-strong',
  '--pr-color-success',
  '--pr-color-warning',
  '--pr-color-warning-surface',
]);

// [utest->req~theme-minimal-flat~1]
describe('theme-minimal.css is flat', () => {
  it('sets every --pr-shadow-* token to none', () => {
    const declared = minimalRules().flatMap((rule) =>
      [...rule.declarations].filter(([name]) => name.startsWith('--pr-shadow')),
    );
    expect(declared.length).toBeGreaterThan(0);
    for (const [name, value] of declared) expect(value, name).toBe('none');
  });

  it('sets both borders to currentColor in every rule that declares them', () => {
    const rules = minimalRules().filter((rule) => rule.declarations.has('--pr-color-border'));
    expect(rules.length).toBeGreaterThanOrEqual(3);
    for (const rule of rules) {
      for (const token of ['--pr-color-border', '--pr-color-border-strong']) {
        expect(rule.declarations.get(token)?.toLowerCase(), token).toBe('currentcolor');
      }
    }
  });

  it('declares every other --pr-color-* token as a six-digit gray hex', () => {
    const required = [
      '--pr-color-text',
      '--pr-color-muted',
      '--pr-color-surface',
      '--pr-color-surface-raised',
      '--pr-color-surface-subtle',
      '--pr-color-accent',
      '--pr-color-on-accent',
      '--pr-color-link',
      '--pr-color-focus',
      '--pr-color-overlay',
    ];
    const rules = minimalRules();
    for (const token of required) {
      expect(
        rules.some((rule) => rule.declarations.has(token)),
        `${token} is declared`,
      ).toBe(true);
    }
    for (const rule of rules) {
      for (const [name, value] of rule.declarations) {
        if (!name.startsWith('--pr-color-') || COLOR_TOKENS_FLAT_EXEMPT.has(name)) continue;
        expect(value, name).toMatch(/^#([0-9a-f]{2})\1\1$/i);
      }
    }
  });

  it('has no box-shadow declaration outside the tokens', () => {
    expect(readCss(minimalPath)).not.toMatch(/(^|[^-\w])box-shadow\s*:/);
  });
});

type Rgb = [number, number, number];

function toRgb(value: string | undefined, name: string): Rgb {
  const match = /^#([0-9a-f]{6})$/i.exec(value ?? '');
  expect(match, `${name} as a six-digit hex`).not.toBeNull();
  const hexValue = match![1]!;
  return [0, 2, 4].map((index) => parseInt(hexValue.slice(index, index + 2), 16)) as Rgb;
}

function luminance(color: Rgb): number {
  const [r, g, b] = color.map((component) => {
    const scaled = component / 255;
    return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(first: Rgb, second: Rgb): number {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light! + 0.05) / (dark! + 0.05);
}

// The light, dark and theme='auto' rules; a token missing from a dark rule comes from the light one.
function tokenSets(): Record<'light' | 'dark' | 'auto', Map<string, string>> {
  const rules = minimalRules();
  const light = rules.find((rule) => rule.selectors.includes('pricing-change-review'));
  const dark = rules.find((rule) =>
    rule.selectors.includes("pricing-renderer[data-pr-root][theme='dark']"),
  );
  const auto = rules.find(
    (rule) =>
      rule.context.some((entry) => entry.includes('prefers-color-scheme: dark')) &&
      rule.selectors.includes("pricing-renderer[data-pr-root][theme='auto']") &&
      rule.declarations.has('--pr-color-text'),
  );
  expect(light, 'the light rule').toBeDefined();
  expect(dark, 'the dark rule').toBeDefined();
  expect(auto, "the theme='auto' rule").toBeDefined();
  return {
    light: light!.declarations,
    dark: new Map([...light!.declarations, ...dark!.declarations]),
    auto: new Map([...light!.declarations, ...auto!.declarations]),
  };
}

const TEXT_TOKENS = ['--pr-color-text', '--pr-color-muted'];
const SURFACES = ['--pr-color-surface', '--pr-color-surface-raised', '--pr-color-surface-subtle'];

const pairs: Array<[string, string]> = [
  ...TEXT_TOKENS.flatMap((text) => SURFACES.map((surface): [string, string] => [text, surface])),
  ['--pr-color-on-accent', '--pr-color-accent'],
  ['--pr-color-link', '--pr-color-surface'],
  ['--pr-color-link', '--pr-color-surface-raised'],
  // extra, not in the requirement
  ['--pr-color-focus', '--pr-color-surface'],
];

// [utest->req~theme-minimal-contrast~1]
describe('theme-minimal.css contrast', () => {
  it('computes contrast with a known pair', () => {
    expect(contrast([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
  });

  it('checks the nine pairs of the requirement', () => {
    expect(pairs.slice(0, 9)).toHaveLength(9);
  });

  for (const name of ['light', 'dark', 'auto'] as const) {
    for (const [foreground, background] of pairs) {
      it(`has at least 4.5:1 for ${foreground} on ${background} in the ${name} rule`, () => {
        const tokens = tokenSets()[name];
        const ratio = contrast(
          toRgb(tokens.get(foreground), foreground),
          toRgb(tokens.get(background), background),
        );
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});

// [utest->req~theme-minimal-export~1]
describe('theme-minimal.css package export', () => {
  it('exports ./theme-minimal.css from dist/styles', () => {
    const manifest = JSON.parse(readFileSync(packagePath, 'utf8')) as {
      exports: Record<string, unknown>;
    };
    expect(manifest.exports['./theme-minimal.css']).toBe('./dist/styles/theme-minimal.css');
  });
});
