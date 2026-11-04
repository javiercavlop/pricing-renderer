// Guard for the "API reference coverage" signal of objective O3 (INTENT.md, "API reference coverage").
// Proposal P-20261104-2. It covers value exports only; type exports, attributes, events and parts are
// not part of this guard. Every value export of every JavaScript entry of the package must appear in the
// code text (fenced blocks and inline spans) of docs/api-reference.md, or sit on the PENDING list below.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

type Namespace = Record<string, unknown>;
type ExportTarget = string | Record<string, unknown>;

// Static map from package subpath to its source module and loader. A package.json JS entry missing
// here fails, and `source` must equal the path derived from package.json.
const loaders: Record<string, { source: string; load: () => Promise<Namespace> }> = {
  '.': { source: 'src/core/index.ts', load: () => import('../../src/core/index.js') },
  './yaml': { source: 'src/yaml/index.ts', load: () => import('../../src/yaml/index.js') },
  './element': {
    source: 'src/element/index.ts',
    load: () => import('../../src/element/index.js'),
  },
  './define': {
    source: 'src/element/define.ts',
    load: () => import('../../src/element/define.js'),
  },
  './define-change-review': {
    source: 'src/element/define-change-review.ts',
    load: () => import('../../src/element/define-change-review.js'),
  },
  './react': { source: 'src/react/index.ts', load: () => import('../../src/react/index.js') },
  './react/headless': {
    source: 'src/react/headless.ts',
    load: () => import('../../src/react/headless.js'),
  },
  './space': { source: 'src/space/index.ts', load: () => import('../../src/space/index.js') },
};

// Non-JS package.json exports: a string target with one of these extensions, or package.json itself.
const ASSET_EXTENSIONS = ['.css', '.json'];

/** Classify every package.json export as a JS entry (with derived source), an asset, or unknown. */
function classifyExports(exportsField: Record<string, ExportTarget>) {
  const entries: { subpath: string; source: string }[] = [];
  const assets: string[] = [];
  const unknown: string[] = [];
  for (const [subpath, target] of Object.entries(exportsField)) {
    if (typeof target === 'string' && ASSET_EXTENSIONS.some((ext) => target.endsWith(ext))) {
      assets.push(subpath);
      continue;
    }
    const dflt = typeof target === 'string' ? target : target.default;
    if (typeof dflt !== 'string' || !dflt.endsWith('.js')) {
      unknown.push(subpath);
      continue;
    }
    entries.push({ subpath, source: dflt.replace(/^\.\/dist\//, 'src/').replace(/\.js$/, '.ts') });
  }
  return { entries, assets, unknown };
}

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
  // The closing fence uses the opener's character and is at least as long (CommonMark).
  const rest = markdown.replace(
    /^[ \t]*(([`~])\2{2,})[^\n]*\n[\s\S]*?^[ \t]*\1\2*[ \t]*$/gm,
    (block) => {
      parts.push(block);
      return '\n';
    },
  );
  for (const span of rest.matchAll(/`([^`\n]+)`/g)) parts.push(span[1] ?? '');
  return parts.join('\n');
}

function isDocumented(name: string, code: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`).test(code);
}

const read = (path: string) => readFileSync(new URL(path, `file://${repoRoot}`), 'utf8');
const sourceExists = (source: string) => existsSync(new URL(source, `file://${repoRoot}`));

const pkg = JSON.parse(read('package.json')) as {
  exports: Record<string, ExportTarget>;
};

const { entries, unknown } = classifyExports(pkg.exports);

const code = codeText(read('docs/api-reference.md'));

const exportsByEntry = new Map<string, string[]>();
for (const { subpath, source } of entries) {
  const loader = loaders[subpath];
  if (!loader || loader.source !== source || !sourceExists(source)) continue;
  exportsByEntry.set(subpath, Object.keys(await loader.load()).sort());
}

describe('API reference coverage', () => {
  it('maps every JavaScript entry of package.json to an existing source module', () => {
    for (const subpath of unknown) {
      expect.fail(
        `package.json export ${subpath} is not a JS entry the guard understands: add it to the loaders map or the asset allow-list`,
      );
    }
    expect(entries.length).toBeGreaterThan(0);
    for (const { subpath, source } of entries) {
      const loader = loaders[subpath];
      expect(loader, `${subpath}: add it to the loaders map of this test`).toBeDefined();
      expect(loader?.source, `${subpath}: loader source differs from package.json`).toBe(source);
      expect(sourceExists(source), `${subpath}: missing ${source}`).toBe(true);
    }
    const subpaths = new Set(entries.map((entry) => entry.subpath));
    const extra = Object.keys(loaders).filter((key) => !subpaths.has(key));
    expect(extra, 'loaders map has entries that are not in package.json exports').toEqual([]);
    const unknownPending = Object.keys(PENDING).filter((key) => !subpaths.has(key));
    expect(unknownPending, 'PENDING has entries that are not in package.json exports').toEqual([]);
  });

  for (const { subpath } of entries) {
    const loaded = exportsByEntry.has(subpath);
    const names = exportsByEntry.get(subpath) ?? [];
    const pending = new Set(PENDING[subpath] ?? []);

    it(`${subpath}: every value export is documented or pending`, () => {
      expect(loaded, `${subpath}: entry not loaded: see mapping test`).toBe(true);
      const missing = names.filter((name) => !pending.has(name) && !isDocumented(name, code));
      expect(
        missing,
        `${subpath}: ${missing.join(', ')} not documented; document it in docs/api-reference.md or add it to PENDING with a reason`,
      ).toEqual([]);
    });

    it(`${subpath}: PENDING lists only exported, undocumented names`, () => {
      expect(loaded, `${subpath}: entry not loaded: see mapping test`).toBe(true);
      const stale = [...pending].filter(
        (name) => !names.includes(name) || isDocumented(name, code),
      );
      expect(stale, `${subpath}: ${stale.join(', ')} is stale; remove it from PENDING`).toEqual([]);
    });
  }

  it('reports the coverage', () => {
    const unique = new Set([...exportsByEntry.values()].flat());
    expect(unique.size).toBeGreaterThan(0);
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

    it('handles a four-backtick fence that contains a three-backtick line', () => {
      const text = codeText('````md\n```ts\nshown\n```\nstill inside\n````\nprose hidden here\n');
      expect(isDocumented('still', text)).toBe(true);
      expect(isDocumented('hidden', text)).toBe(false);
    });

    it('escapes regex metacharacters in a name', () => {
      expect(isDocumented('a.c', codeText('`abc`'))).toBe(false);
      expect(isDocumented('a.c', codeText('`a.c`'))).toBe(true);
    });
  });

  describe('export classification', () => {
    it('classifies the real package.json exports without unknowns', () => {
      expect(unknown).toEqual([]);
      expect(classifyExports(pkg.exports).assets).toContain('./base.css');
    });

    it('flags a conditional export without a default', () => {
      const result = classifyExports({ './x': { import: './dist/x.js' } });
      expect(result.unknown).toEqual(['./x']);
      expect(result.entries).toEqual([]);
    });

    it('flags nested conditions, .mjs targets and unknown string targets', () => {
      const result = classifyExports({
        './a': { default: { import: './dist/a.js' } },
        './b': { default: './dist/b.mjs' },
        './c': './dist/c.js.map',
      });
      expect(result.unknown).toEqual(['./a', './b', './c']);
    });

    it('accepts js entries and allow-listed assets', () => {
      const result = classifyExports({
        './x': { types: './dist/x.d.ts', default: './dist/x.js' },
        './s.css': './dist/s.css',
        './package.json': './package.json',
      });
      expect(result.entries).toEqual([{ subpath: './x', source: 'src/x.ts' }]);
      expect(result.assets).toEqual(['./s.css', './package.json']);
      expect(result.unknown).toEqual([]);
    });
  });
});
