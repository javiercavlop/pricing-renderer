import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The entry `src/react/index.ts` is a client module. Next.js rejects `export *` in a client module,
// so the entry names every export of the headless entry instead.
const reactRoot = fileURLToPath(new URL('../../src/react/', import.meta.url));

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function sourceOf(file: string): string {
  return stripComments(readFileSync(`${reactRoot}${file}`, 'utf8'));
}

// The names of `export { a, b } from '<from>'` (runtime) or `export type { a, b } from '<from>'`.
function exportedNames(text: string, kind: 'runtime' | 'type', from: string): string[] {
  const keyword = kind === 'type' ? 'export\\s+type' : 'export';
  const pattern = new RegExp(`${keyword}\\s*\\{([^}]*)\\}\\s*from\\s*'${from}'`, 'g');
  return [...text.matchAll(pattern)].flatMap((match) =>
    (match[1] ?? '')
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part !== '')
      .map((part) => (part.split(/\s+as\s+/).pop() ?? part).trim()),
  );
}

// [utest->req~react-entry-reexports-headless~1]
describe('the react entry names every export of the headless entry', () => {
  const headless = sourceOf('headless.ts');
  const index = sourceOf('index.ts');

  it('has no export-star in the client entry', () => {
    expect(index).not.toMatch(/export\s*\*/);
  });

  it('reads the exports of the headless entry', () => {
    expect(exportedNames(headless, 'runtime', './[a-z-]+\\.js')).toEqual(
      expect.arrayContaining(['PricingRendererProvider', 'usePricingSource']),
    );
  });

  it('writes every export of headless as a named export from another module', () => {
    const rest = headless.replace(/export\s+(type\s+)?\{[^}]*\}\s*from\s*'\.\/[a-z-]+\.js';?/g, '');
    expect(rest).not.toMatch(/\bexport\b/);
  });

  it('exports each runtime name of headless by name from headless', () => {
    const runtime = exportedNames(headless, 'runtime', './[a-z-]+\\.js');
    expect(runtime.length).toBeGreaterThan(0);
    expect(exportedNames(index, 'runtime', './headless\\.js').sort()).toEqual(
      expect.arrayContaining([...runtime].sort()),
    );
  });

  it('exports each type name of headless by name from headless', () => {
    const types = exportedNames(headless, 'type', './[a-z-]+\\.js');
    expect(types.length).toBeGreaterThan(0);
    expect(exportedNames(index, 'type', './headless\\.js').sort()).toEqual(
      expect.arrayContaining([...types].sort()),
    );
  });
});
