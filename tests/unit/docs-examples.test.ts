// Keeps the names used in the documentation (event names, diagnostic codes,
// event detail fields) in sync with the code. The source files are the single
// source of truth: names are derived from src/ by regex, then the docs are
// checked in both directions (complete per row, and nothing invented).
//
// Regexes used:
// - dispatched events:   new CustomEvent<...>('name'  or  new CustomEvent('name'
// - diagnostic codes:    'PR_[A-Z_]+' as a quoted string literal in src/; it must
//                        equal every PR_[A-Z_]+ token in src/ (any quote style)
//                        and stay >= 30 so the set cannot shrink silently
// - code tokens in docs: PR_[A-Z_]+ anywhere in the text
// - listener contexts in docs (only these are checked for event names):
//     addEventListener('pricing-...')   Vue  @pricing-...
//     rows of the events table:  | `pricing-...` |
//   Each context must match at least once, so a changed row form fails
//   instead of passing vacuously. Other tokens (the <pricing-renderer> tag,
//   pricing-renderer-react-demo, CSS parts, package names) are never inspected.
// - completeness: docs/events.md has a `| \`name\` ...|` row per event (padding allowed) and a
//   <td><code>PR_XXX</code></td> cell per code; docs/vue.md has @name per
//   event; the README events list has - `name` per event.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
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

// The events of <pricing-renderer>. <pricing-change-review> (src/element/change-review-*.ts) has
// its own events, which are documented with its UI (add-subscription-change-flow, phase F5).
const isRenderer = (file: string): boolean => !basename(file).startsWith('change-review-');
const rendererFiles = listFiles('src/element', ['.ts']).filter(isRenderer);
const eventPattern = /new CustomEvent(?:<[^>(]*>)?\(\s*'([a-z-]+)'/g;
const eventMatches = sourceText(rendererFiles).matchAll(eventPattern);
const eventNames = new Set([...eventMatches].map((m) => m[1]!));

const diagnosticCodes = new Set(
  [...sourceText(sourceFiles).matchAll(/'(PR_[A-Z_]+)'/g)].map((m) => m[1]!),
);
// every PR_XXX token in any quote style (or none): a code built in a template
// string or double quotes must show up here and fail the equality check
const anyCodeTokens = new Set(sourceText(sourceFiles).match(/PR_[A-Z_]+/g) ?? []);

const actionDetailKeys = (): string[] => {
  const body = /export interface PricingActionDetail \{([^}]*)\}/.exec(
    read('src/element/events.ts'),
  )?.[1];
  return [...(body ?? '').matchAll(/^\s*(\w+)\??:/gm)].map((m) => m[1]!);
};

const docPath = (rel: string): string => join(root, rel);
const docText = (rel: string): string => (existsSync(docPath(rel)) ? read(rel) : '');

describe('documentation stays in sync with the code', () => {
  it('derives the real events and diagnostic codes from the source', () => {
    expect([...eventNames].sort()).toEqual(
      ['pricing-action', 'pricing-diagnostic', 'pricing-ready', 'pricing-selection-change'].sort(),
    );
    expect(diagnosticCodes.size).toBeGreaterThanOrEqual(30);
    expect([...anyCodeTokens].sort()).toEqual([...diagnosticCodes].sort());
    expect(actionDetailKeys()).toEqual(
      expect.arrayContaining(['actionId', 'planId', 'href', 'selection', 'resolved', 'metadata']),
    );
  });

  describe('docs/events.md', () => {
    it('exists', () => {
      expect(existsSync(docPath('docs/events.md'))).toBe(true);
    });

    it('has a table row for every event name', () => {
      const text = docText('docs/events.md');
      // prettier pads table cells, so allow whitespace before the closing pipe
      for (const name of eventNames) {
        expect(text, name).toMatch(new RegExp(`^\\|\\s*\`${name}\`\\s*\\|`, 'm'));
      }
    });

    it('has a table cell for every diagnostic code found in the source', () => {
      const text = docText('docs/events.md');
      for (const code of diagnosticCodes) {
        expect(text, code).toContain(`<td><code>${code}</code></td>`);
      }
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

    it('listens to every event name with a Vue listener', () => {
      const text = docText('docs/vue.md');
      for (const name of eventNames) expect(text, name).toContain(`@${name}`);
    });
  });

  describe('README.md', () => {
    it('lists every event name in the public events list', () => {
      const text = docText('README.md');
      for (const name of eventNames) expect(text, name).toContain(`- \`${name}\``);
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
      ...vueExamples.map((file): [string, string] => [
        relative(root, file),
        readFileSync(file, 'utf8'),
      ]),
    ];

    it('scans the documents that must exist', () => {
      expect(existsSync(docPath('docs/events.md'))).toBe(true);
      expect(existsSync(docPath('docs/vue.md'))).toBe(true);
    });

    it('only uses diagnostic codes that exist in the source', () => {
      for (const [name, text] of docs) {
        for (const [code] of text.matchAll(/PR_[A-Z_]+/g)) {
          expect(diagnosticCodes.has(code), `${name}: ${code}`).toBe(true);
        }
      }
    });

    it('only uses real event names in listeners and the events table', () => {
      const patterns = [
        {
          label: 'addEventListener',
          regex: /addEventListener\(\s*['"`]([^'"`]+)['"`]/g,
          onlyPricingPrefixed: true,
        },
        { label: 'vue listener', regex: /@(pricing-[a-z-]+)/g, onlyPricingPrefixed: false },
        {
          label: 'events table',
          regex: /^\|\s*`(pricing-[a-z-]+)`\s*\|/gm,
          onlyPricingPrefixed: false,
        },
      ];
      // the element tag shares the prefix and can head a table row
      const notEvents = new Set(['pricing-renderer']);
      const checkedIn = (label: string, file: string): number => {
        const text = docs.find(([name]) => name === file)?.[1] ?? '';
        return [...text.matchAll(patterns.find((p) => p.label === label)!.regex)].length;
      };
      for (const [name, text] of docs) {
        for (const { regex, onlyPricingPrefixed } of patterns) {
          for (const m of text.matchAll(regex)) {
            const used = m[1]!;
            if (notEvents.has(used)) continue;
            // addEventListener on other targets (click, ...) is not our concern
            if (onlyPricingPrefixed && !used.startsWith('pricing-')) continue;
            expect(eventNames.has(used), `${name}: ${used}`).toBe(true);
          }
        }
      }
      // a pattern that stops matching must not pass vacuously
      expect(
        checkedIn('events table', 'docs/events.md') + checkedIn('events table', 'README.md'),
        'events table rows',
      ).toBeGreaterThan(0);
      expect(
        checkedIn('vue listener', 'docs/vue.md'),
        'vue listeners in docs/vue.md',
      ).toBeGreaterThan(0);
    });
  });
});
