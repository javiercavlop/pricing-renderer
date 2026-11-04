// Guard for the "API reference coverage" signal of objective O3 (INTENT.md, "API reference coverage").
// Proposal P-20261104-2. It covers value exports only; type exports, attributes, events and parts are
// not part of this guard. Every value export of every JavaScript entry of the package must appear in the
// code text (fenced blocks and inline spans) of docs/api-reference.md, or sit on the PENDING list below.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

type Namespace = Record<string, unknown>;

// Static map from package subpath to its source module. A package.json entry missing here fails.
const loaders: Record<string, () => Promise<Namespace>> = {
  '.': () => import('../../src/core/index.js'),
  './yaml': () => import('../../src/yaml/index.js'),
  './element': () => import('../../src/element/index.js'),
  './define': () => import('../../src/element/define.js'),
  './define-change-review': () => import('../../src/element/define-change-review.js'),
  './react': () => import('../../src/react/index.js'),
  './react/headless': () => import('../../src/react/headless.js'),
  './space': () => import('../../src/space/index.js'),
};

// Names exported but not yet documented. Sorted per entry. Remove a name when it is documented.
const PENDING: Record<string, string[]> = {
  '.': [
    'applySelectionChange', // core, P3-15b
    'applySelectionInput', // core, P3-15b
    'asRecord', // core, later docs slice
    'cloneValue', // core, later docs slice
    'createPriceStabilizer', // core, later docs slice
    'deepEqual', // core, later docs slice
    'getAtPath', // core, later docs slice
    'humanizeIdentifier', // core, later docs slice
    'isRecord', // core, later docs slice
    'planSelectionChange', // core, P3-15b
    'selectionFromSearchParams', // core, P3-15b
    'selectionInEffect', // core, P3-15b
    'selectionToSearchParams', // core, P3-15b
    'selectionWithAddOnQuantity', // core, P3-15b
    'selectionWithVariable', // core, P3-15b
    'setAtPath', // core, later docs slice
    'unwrapValue', // core, later docs slice
  ],
  './yaml': [
    'loadPricingSource', // yaml, B2b
  ],
  './react': [
    'PricingRendererProvider', // react, P3-15b
    'usePricingRendererState', // react, P3-15b
    'usePricingSelection', // react, P3-15b
    'usePricingSource', // react, P3-15b
  ],
  './react/headless': [
    'PricingRendererProvider', // react/headless, P3-15b
    'usePricingRendererState', // react/headless, P3-15b
    'usePricingSelection', // react/headless, P3-15b
    'usePricingSource', // react/headless, P3-15b
  ],
};

/** Code text of a markdown document: fenced blocks first, then inline spans of the remaining text. */
function codeText(markdown: string): string {
  const parts: string[] = [];
  const rest = markdown.replace(/^[ \t]*(```|~~~)[^\n]*\n[\s\S]*?^[ \t]*\1[ \t]*$/gm, (block) => {
    parts.push(block);
    return '\n';
  });
  for (const span of rest.matchAll(/`([^`\n]+)`/g)) parts.push(span[1] ?? '');
  return parts.join('\n');
}

function isDocumented(name: string, code: string): boolean {
  return new RegExp(`\\b${name}\\b`).test(code);
}

const read = (path: string) => readFileSync(new URL(path, `file://${repoRoot}`), 'utf8');
const sourceExists = (source: string) => existsSync(new URL(source, `file://${repoRoot}`));

const pkg = JSON.parse(read('package.json')) as {
  exports: Record<string, string | { default?: string }>;
};

const entries = Object.entries(pkg.exports).flatMap(([subpath, target]) => {
  const dflt = typeof target === 'string' ? target : target.default;
  if (typeof dflt !== 'string' || !dflt.endsWith('.js')) return [];
  return [{ subpath, source: dflt.replace(/^\.\/dist\//, 'src/').replace(/\.js$/, '.ts') }];
});

const code = codeText(read('docs/api-reference.md'));

const exportsByEntry = new Map<string, string[]>();
for (const { subpath, source } of entries) {
  const load = loaders[subpath];
  if (!load || !sourceExists(source)) continue;
  exportsByEntry.set(subpath, Object.keys(await load()).sort());
}

describe('API reference coverage', () => {
  it('maps every JavaScript entry of package.json to an existing source module', () => {
    expect(entries.length).toBeGreaterThan(0);
    for (const { subpath, source } of entries) {
      expect(loaders[subpath], `${subpath}: add it to the loaders map of this test`).toBeDefined();
      expect(sourceExists(source), `${subpath}: missing ${source}`).toBe(true);
    }
    const subpaths = new Set(entries.map((entry) => entry.subpath));
    const extra = Object.keys(loaders).filter((key) => !subpaths.has(key));
    expect(extra, 'loaders map has entries that are not in package.json exports').toEqual([]);
  });

  for (const { subpath } of entries) {
    const names = exportsByEntry.get(subpath) ?? [];
    const pending = new Set(PENDING[subpath] ?? []);

    it(`${subpath}: every value export is documented or pending`, () => {
      const missing = names.filter((name) => !pending.has(name) && !isDocumented(name, code));
      expect(
        missing,
        `${subpath}: ${missing.join(', ')} not documented; document it in docs/api-reference.md or add it to PENDING with a reason`,
      ).toEqual([]);
    });

    it(`${subpath}: PENDING lists only exported, undocumented names`, () => {
      const stale = [...pending].filter(
        (name) => !names.includes(name) || isDocumented(name, code),
      );
      expect(stale, `${subpath}: ${stale.join(', ')} is stale; remove it from PENDING`).toEqual([]);
    });
  }

  it('reports the coverage', () => {
    const unique = new Set([...exportsByEntry.values()].flat());
    const documented = [...unique].filter((name) => isDocumented(name, code)).length;
    const pct = unique.size === 0 ? 100 : Math.round((documented / unique.size) * 100);
    const perEntry = [...exportsByEntry]
      .map(([subpath, names]) => {
        const count = names.filter((name) => isDocumented(name, code)).length;
        return `${subpath} ${count}/${names.length}`;
      })
      .join(', ');
    console.info(
      `API reference coverage: ${documented}/${unique.size} unique value exports (${pct}%)`,
    );
    console.info(`API reference coverage per entry: ${perEntry}`);
  });

  describe('matcher', () => {
    it('counts a name inside a fenced block', () => {
      const text = codeText('Intro\n\n```ts\nconst x = translate("a");\n```\n');
      expect(isDocumented('translate', text)).toBe(true);
    });

    it('ignores a name that only appears in prose', () => {
      const text = codeText('We translate things here, see `other`.');
      expect(isDocumented('translate', text)).toBe(false);
    });

    it('matches whole words only', () => {
      const text = codeText('`PricingRendererElement`');
      expect(isDocumented('PricingRenderer', text)).toBe(false);
      expect(isDocumented('PricingRendererElement', text)).toBe(true);
    });

    it('does not split backticks inside a fence into spans', () => {
      const text = codeText('```ts\nconst s = `hello ${name}`;\n```\nprose hidden here\n');
      expect(isDocumented('hidden', text)).toBe(false);
      expect(isDocumented('hello', text)).toBe(true);
    });
  });
});
