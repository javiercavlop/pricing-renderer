// Keeps the names used in the documentation (event names, diagnostic codes,
// event detail fields) in sync with the code. The source files are the single
// source of truth: names are derived from src/ by regex, then the docs are
// checked in both directions (complete, and nothing invented).
//
// Regexes used:
// - dispatched events:   new CustomEvent<...>('name'  or  new CustomEvent('name'
// - diagnostic codes:    'PR_[A-Z_]+' as a quoted string literal in src/
// - code tokens in docs: PR_[A-Z_]+ anywhere in the text
// - listener contexts in docs (only these are checked for event names):
//     addEventListener('pricing-...')   Vue  @pricing-...   handler onPricingXxx
//     rows of the events table:  | `pricing-...` |
//   Other tokens (the <pricing-renderer> tag, pricing-renderer-react-demo,
//   CSS parts, package names) are never inspected.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (rel: string): string => readFileSync(join(root, rel), 'utf8');

const listFiles = (dir: string, exts: string[]): string[] => {
  const abs = join(root, dir);
  if (!existsSync(abs)) return [];
  const out: string[] = [];
  const walk = (current: string): void => {
    for (const name of readdirSync(current)) {
      if (name === 'node_modules' || name === 'dist') continue;
      const full = join(current, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (exts.some((ext) => name.endsWith(ext))) out.push(full);
    }
  };
  walk(abs);
  return out;
};

const sourceFiles = ['src/core', 'src/yaml', 'src/element'].flatMap((dir) =>
  listFiles(dir, ['.ts']),
);
const sourceText = (files: string[]): string =>
  files.map((file) => readFileSync(file, 'utf8')).join('\n');

const eventNames = new Set(
  [
    ...sourceText(listFiles('src/element', ['.ts'])).matchAll(
      /new CustomEvent(?:<[^>(]*>)?\(\s*'([a-z-]+)'/g,
    ),
  ].map((m) => m[1]!),
);

const diagnosticCodes = new Set(
  [...sourceText(sourceFiles).matchAll(/'(PR_[A-Z_]+)'/g)].map((m) => m[1]!),
);

const actionDetailKeys = (): string[] => {
  const body = /export interface PricingActionDetail \{([^}]*)\}/.exec(
    read('src/element/events.ts'),
  )?.[1];
  return [...(body ?? '').matchAll(/^\s*(\w+)\??:/gm)].map((m) => m[1]!);
};

const docPath = (rel: string): string => join(root, rel);
const docText = (rel: string): string => (existsSync(docPath(rel)) ? read(rel) : '');

const kebab = (name: string): string =>
  name
    .replace(/^on/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();

describe('documentation stays in sync with the code', () => {
  it('derives the real events and diagnostic codes from the source', () => {
    expect([...eventNames].sort()).toEqual(
      ['pricing-action', 'pricing-diagnostic', 'pricing-ready', 'pricing-selection-change'].sort(),
    );
    expect(diagnosticCodes.size).toBeGreaterThan(0);
    expect(actionDetailKeys()).toEqual(
      expect.arrayContaining(['actionId', 'planId', 'href', 'selection', 'resolved', 'metadata']),
    );
  });

  describe('docs/events.md', () => {
    it('exists', () => {
      expect(existsSync(docPath('docs/events.md'))).toBe(true);
    });

    it('mentions every event name', () => {
      const text = docText('docs/events.md');
      for (const name of eventNames) expect(text, name).toContain(name);
    });

    it('mentions every diagnostic code found in the source', () => {
      const text = docText('docs/events.md');
      for (const code of diagnosticCodes) expect(text, code).toContain(code);
    });

    it('explains cancelation and the detail payload', () => {
      const text = docText('docs/events.md');
      for (const word of ['preventDefault', 'cancelable', 'detail']) {
        expect(text, word).toContain(word);
      }
    });

    it('documents every field of the pricing-action detail', () => {
      const text = docText('docs/events.md');
      for (const key of actionDetailKeys()) expect(text, key).toContain(key);
    });
  });

  describe('docs/vue.md', () => {
    it('exists and covers the Vue integration points', () => {
      expect(existsSync(docPath('docs/vue.md'))).toBe(true);
      const text = docText('docs/vue.md');
      for (const word of ['isCustomElement', '.prop', 'pricing-action']) {
        expect(text, word).toContain(word);
      }
    });
  });

  describe('no invented names', () => {
    const vueExamples = listFiles('examples/vue', [
      '.vue',
      '.ts',
      '.js',
      '.mjs',
      '.html',
      '.md',
      '.yml',
      '.yaml',
    ]);
    const docs: Array<[string, string]> = [
      ['docs/events.md', docText('docs/events.md')],
      ['docs/vue.md', docText('docs/vue.md')],
      ['README.md', docText('README.md')],
      ...vueExamples.map((file): [string, string] => [file, readFileSync(file, 'utf8')]),
    ];

    it('only uses diagnostic codes that exist in the source', () => {
      for (const [name, text] of docs) {
        for (const [code] of text.matchAll(/PR_[A-Z_]+/g)) {
          expect(diagnosticCodes.has(code), `${name}: ${code}`).toBe(true);
        }
      }
    });

    it('only uses real event names in listeners and the events table', () => {
      const patterns = [
        /addEventListener\(\s*['"`]([^'"`]+)['"`]/g,
        /@(pricing-[a-z-]+)/g,
        /^\|\s*`(pricing-[a-z-]+)`\s*\|/gm,
      ];
      // the element tag shares the prefix and can head a table row
      const notEvents = new Set(['pricing-renderer']);
      for (const [name, text] of docs) {
        for (const pattern of patterns) {
          for (const m of text.matchAll(pattern)) {
            const used = m[1]!;
            if (notEvents.has(used)) continue;
            // addEventListener on other targets (click, ...) is not our concern
            if (pattern.source.startsWith('addEventListener') && !used.startsWith('pricing-')) {
              continue;
            }
            expect(eventNames.has(used), `${name}: ${used}`).toBe(true);
          }
        }
        for (const m of text.matchAll(/\bon(Pricing[A-Za-z]+)\b/g)) {
          const used = kebab(m[1]!);
          expect(eventNames.has(used), `${name}: ${m[0]}`).toBe(true);
        }
      }
    });
  });
});
