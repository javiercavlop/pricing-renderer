// Doc-content checks for the docs-only items of phase0-hygiene: pricingPath as deprecated metadata
// (item 5), the theming guide against the stylesheets (item 7) and the kept-price breakdown note
// (item 10). Markdown carries no trace tags in this repository, so the tags are here.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createPricingRendererConfig } from '../../src/core/index.js';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

function read(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

// Line breaks and runs of spaces do not matter to a sentence of prose.
function prose(path: string): string {
  return read(path).replace(/\s+/g, ' ');
}

function sourceFiles(dir: string): string[] {
  return readdirSync(join(repoRoot, dir)).flatMap((name) => {
    const path = `${dir}/${name}`;
    return statSync(join(repoRoot, path)).isDirectory() ? sourceFiles(path) : [path];
  });
}

// [utest->req~pricing-path-deprecated~1]
describe('pricingPath is documented as deprecated metadata', () => {
  const pages = [
    'README.md',
    'docs/configuration.md',
    'docs/architecture.md',
    'docs/vue.md',
    'docs/i18n.md',
    'docs/api-reference.md',
    'docs/events.md',
  ];

  it.each(pages)('%s names pricingPath together with the word deprecated', (page) => {
    expect(prose(page)).toMatch(/`pricing-?[Pp]ath`[^.]{0,200}deprecated/);
  });

  it.each(pages)('%s says it has no runtime effect', (page) => {
    expect(prose(page)).toMatch(
      /no (runtime )?effect|nothing in the (renderer|element) reads|has no effect/,
    );
  });

  it('keeps the compatibility and host router wording on the three main pages', () => {
    for (const page of ['README.md', 'docs/configuration.md', 'docs/api-reference.md']) {
      const text = prose(page);
      expect(text, page).toMatch(/pricingPath/);
      expect(text, page).toMatch(/deprecated/);
      expect(text, page).toMatch(/compatibility/);
      expect(text, page).toMatch(/host router/);
    }
  });

  it('leaves the code as it is: no @deprecated tag, the value is still validated', () => {
    for (const file of sourceFiles('src').filter((name) => /\.(ts|tsx|css)$/.test(name))) {
      expect(read(file), file).not.toContain('@deprecated');
    }
    const config = createPricingRendererConfig({ locale: 'es-es', pricingPath: '/precios/' });
    expect(config.pricingPath).toBe('/precios');
    expect(config.locale).toBe('es-ES');
  });
});

// [utest->req~theming-layer-docs~1]
describe('the theming guide matches the stylesheets', () => {
  const guide = read('docs/theming.md');
  const text = prose('docs/theming.md');

  it('names the layers that the stylesheets declare', () => {
    expect(read('src/styles/base.css').trimStart()).toMatch(/^@layer pricing-renderer \{/);
    expect(read('src/styles/theme.css').trimStart()).toMatch(/^@layer pricing-renderer\.theme \{/);
    expect(guide).toContain('@layer pricing-renderer`');
    expect(guide).toContain('pricing-renderer.theme');
  });

  it('does not name a pricing-renderer.base layer', () => {
    expect(guide).not.toContain('pricing-renderer.base');
    expect(text).toMatch(/`base\.css`\) live directly in the `pricing-renderer` layer/);
  });

  it('documents the summary end padding of base.css and the room for the toggle', () => {
    const css = read('src/styles/base.css');
    expect(css).toMatch(
      /\.pr-summary \{[^}]*padding-inline-end: calc\(var\(--pr-space-4\) \+ 24px \+ var\(--pr-space-2\)\);/s,
    );
    expect(guide).toContain("[data-pr-part='summary']");
    expect(text).toContain('padding-inline-end');
    expect(text).toContain('var(--pr-space-4) + 24px + var(--pr-space-2)');
    expect(text).toMatch(/breakdown-toggle/);
    expect(text).toMatch(/keep the end padding at least as wide as the toggle/);
  });
});

// [utest->req~breakdown-kept-price-doc~1]
describe('the API reference states the kept-price breakdown line of the element', () => {
  // the list items of the breakdown section: a line that starts with "- " up to the next one
  const items = read('docs/api-reference.md')
    .split(/\n\n/)
    .flatMap((block) => block.split(/\n(?=- )/))
    .map((item) => item.replace(/\s+/g, ' '));

  it('has the note in the list item of the minQuantity: 0 note', () => {
    const item = items.find((entry) => entry.includes('minQuantity: 0'));
    expect(item).toBeDefined();
    expect(item).toContain('last valid price');
    expect(item).toContain('<pricing-renderer>');
    expect(item).toMatch(/more than 0/);
    expect(item).toMatch(/`quantity`, `unitAmount`, `billingMultiplier` and `amount`/);
  });

  it('matches what the element does with a kept price', () => {
    const element = read('src/element/pricing-renderer-element.ts');
    const keptLine = element.slice(element.indexOf('const keptLine'));
    expect(keptLine).toMatch(/quantity: kept\.quantity,/);
    expect(keptLine).toMatch(/unitAmount: kept\.baseAmount,/);
    expect(keptLine).toMatch(/billingMultiplier: kept\.billingMultiplier,/);
    expect(keptLine).toMatch(/amount: kept\.amount,/);
    expect(keptLine).toMatch(/requiresQuote: false,/);
  });
});

describe('the other notes of phase0-hygiene are in the docs', () => {
  it('says that an equal object does not reload and how to force a fetch', () => {
    const api = prose('docs/api-reference.md');
    expect(api).toContain('are compared by content');
    expect(api).toContain('`useCallback` or `useMemo`');
    expect(api).toMatch(/`reload\(\)` always loads/);
    expect(prose('README.md')).toContain('`useCallback` or `useMemo`');
  });

  it('says that the only-differences filter is off while the toolbar is hidden', () => {
    expect(prose('docs/api-reference.md')).toMatch(
      /The filter is off while the toolbar is hidden, whatever `only-differences` says/,
    );
  });

  it('lists the error state keys in the i18n guide', () => {
    const i18n = prose('docs/i18n.md');
    const keys = ['errorSource', 'errorFormat', 'errorVersion', 'errorGeneric', 'errorDetails'];
    for (const key of keys) {
      expect(i18n).toContain(`pricing.${key}`);
    }
    expect(prose('docs/events.md')).toContain('data-pr-part="diagnostics"');
  });

  it('has no cast on the typed events in the examples of events.md', () => {
    expect(read('docs/events.md')).not.toMatch(/event as Pricing(Action|Diagnostic|Ready)Event/);
  });
});
