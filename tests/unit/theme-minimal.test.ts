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

type SectionName = 'light' | 'dark' | 'auto';

// The same slicing as addon-marker.test.ts: light, then the dark list, then the auto media block.
function sectionsOf(css: string): Record<SectionName, string> {
  const darkStart = css.indexOf("[theme='dark']");
  const autoStart = css.indexOf('@media (prefers-color-scheme: dark)');
  expect(darkStart, "the [theme='dark'] section").toBeGreaterThan(0);
  expect(autoStart, 'the auto media section').toBeGreaterThan(darkStart);
  return {
    light: css.slice(0, darkStart),
    dark: css.slice(darkStart, autoStart),
    auto: css.slice(autoStart),
  };
}

const SECTION_NAMES: SectionName[] = ['light', 'dark', 'auto'];

function tokenNames(section: string): string[] {
  return [...new Set([...section.matchAll(/(--pr-[\w-]+)\s*:/g)].map((match) => match[1]!))].sort();
}

function valueOf(section: string, name: string): string | undefined {
  const match = new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(section);
  return match?.[1]?.replace(/\s+/g, ' ').trim();
}

// [utest->req~theme-minimal-tokens~1]
describe('theme-minimal.css tokens', () => {
  it('uses the pricing-renderer.theme layer', () => {
    expect(readCss(minimalPath)).toMatch(/@layer\s+pricing-renderer\.theme\s*\{/);
  });

  for (const name of SECTION_NAMES) {
    it(`declares the same --pr-* names as theme.css in the ${name} section`, () => {
      const reference = sectionsOf(readCss(themePath))[name];
      const minimal = sectionsOf(readCss(minimalPath))[name];
      expect(tokenNames(reference).length).toBeGreaterThan(0);
      expect(tokenNames(minimal)).toEqual(tokenNames(reference));
    });
  }

  it('has the .dark selectors in the dark list', () => {
    const css = readCss(minimalPath);
    const { dark } = sectionsOf(css);
    const list = dark.slice(0, dark.indexOf('{'));
    expect(list).toContain("pricing-renderer[data-pr-root][theme='dark']");
    expect(list).toContain("[data-theme='dark'] pricing-renderer[data-pr-root]");
    expect(list).toContain("pricing-change-review[theme='dark']");
    expect(list).toContain("[data-theme='dark'] pricing-change-review");
    expect(list).toContain('.dark pricing-renderer[data-pr-root]');
    expect(list).toContain('.dark pricing-change-review');
  });
});

// [utest->req~theme-minimal-flat~1]
describe('theme-minimal.css is flat', () => {
  it('sets every --pr-shadow-* token to none', () => {
    const css = readCss(minimalPath);
    const declared = [...css.matchAll(/(--pr-shadow[\w-]*)\s*:\s*([^;]+);/g)];
    expect(declared.length).toBeGreaterThan(0);
    for (const [, name, value] of declared) {
      expect(value!.trim(), name).toBe('none');
    }
  });

  for (const name of SECTION_NAMES) {
    it(`uses currentColor for both borders in the ${name} section`, () => {
      const section = sectionsOf(readCss(minimalPath))[name];
      const reference = sectionsOf(readCss(themePath))[name];
      for (const token of ['--pr-color-border', '--pr-color-border-strong']) {
        expect(valueOf(reference, token), `${token} in theme.css`).toBeDefined();
        expect(valueOf(section, token)?.toLowerCase(), token).toBe('currentcolor');
      }
    });
  }

  it('has no box-shadow declaration outside the tokens', () => {
    expect(readCss(minimalPath)).not.toMatch(/(^|[^-\w])box-shadow\s*:/);
  });
});

type Rgb = [number, number, number];

function hex(section: string, name: string): Rgb {
  const match = new RegExp(`${name}\\s*:\\s*#([0-9a-fA-F]{6})\\b`).exec(section);
  expect(match, `${name} as a six-digit hex`).not.toBeNull();
  const value = match![1]!;
  return [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16)) as Rgb;
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

// [utest->req~theme-minimal-contrast~1]
describe('theme-minimal.css contrast', () => {
  it('computes contrast with a known pair', () => {
    expect(contrast([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
  });

  const pairs: Array<[string, string]> = [
    ['--pr-color-text', '--pr-color-surface'],
    ['--pr-color-muted', '--pr-color-surface'],
    ['--pr-color-on-accent', '--pr-color-accent'],
    ['--pr-color-link', '--pr-color-surface'],
    ['--pr-color-focus', '--pr-color-surface'],
  ];

  for (const name of SECTION_NAMES) {
    for (const [foreground, background] of pairs) {
      it(`has at least 4.5:1 for ${foreground} on ${background} in the ${name} section`, () => {
        const section = sectionsOf(readCss(minimalPath))[name];
        expect(contrast(hex(section, foreground), hex(section, background))).toBeGreaterThanOrEqual(
          4.5,
        );
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
