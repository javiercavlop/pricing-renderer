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

const headings = (text: string): string[] =>
  text
    .split('\n')
    .filter((line) => /^#{1,6}\s/.test(line))
    .map((line) => line.replace(/^#{1,6}\s+/, ''));

// [utest->req~design-systems-guide~1]
describe('docs/design-systems.md', () => {
  const guide = (): string => read('docs/design-systems.md');

  it('has a heading for every integration topic', () => {
    const found = headings(guide());
    for (const topic of [
      'Tailwind CSS v3',
      'Tailwind CSS v4',
      'CSS Modules',
      'Mapping tokens',
      'Fonts',
      'Dark mode',
      'Density',
      'State attributes',
      'Container breakpoints',
    ]) {
      expect(
        found.some((heading) => heading.includes(topic)),
        `heading ${topic}`,
      ).toBe(true);
    }
  });

  it('gives the layer order line, the CSS Modules selector and the overlay files', () => {
    const text = guide();
    expect(text.split('\n')).toContain(
      '@layer theme, base, pricing-renderer, components, utilities;',
    );
    expect(text).toContain(':global(pricing-renderer)');
    expect(text).toContain('tokens-shadcn.css');
    expect(text).toContain('theme-minimal.css');
  });

  it('documents every state attribute', () => {
    const text = guide();
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

  it('is linked from the README and from the theming guide', () => {
    expect(read('README.md')).toContain('design-systems.md');
    expect(read('docs/theming.md')).toContain('design-systems.md');
  });
});

// [utest->req~theming-docs-accuracy~1]
describe('docs/theming.md', () => {
  it('does not mention the removed pricing-renderer.base entry', () => {
    expect(read('docs/theming.md')).not.toContain('pricing-renderer.base');
  });

  it('mentions each new token', () => {
    const text = read('docs/theming.md');
    for (const token of [
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
    ]) {
      expect(text, token).toContain(token);
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
