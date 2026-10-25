import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (path: string): Promise<string> =>
  readFile(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

async function renderedParts(): Promise<string[]> {
  const sources = await Promise.all([
    read('../../src/element/renderers.ts'),
    read('../../src/element/pricing-renderer-element.ts'),
  ]);
  const parts = new Set<string>();
  for (const source of sources) {
    for (const match of source.matchAll(/data-pr-part="([a-z0-9-]+)"/g)) parts.add(match[1]!);
  }
  return [...parts].sort();
}

async function documentedParts(): Promise<string[]> {
  const doc = await read('../../docs/theming.md');
  const start = doc.indexOf('Stable values:');
  expect(start).toBeGreaterThan(-1);
  const paragraph = doc.slice(start).split(/\n\s*\n/)[1] ?? '';
  return [...paragraph.matchAll(/`([^`]+)`/g)].map((match) => match[1]!).sort();
}

describe('docs/theming.md stable part hooks', () => {
  it('lists every data-pr-part value the code renders', async () => {
    const documented = new Set(await documentedParts());
    const missing = (await renderedParts()).filter((part) => !documented.has(part));
    expect(missing).toEqual([]);
  });

  it('lists only values the code renders', async () => {
    const rendered = new Set(await renderedParts());
    const stale = (await documentedParts()).filter((part) => !rendered.has(part));
    expect(stale).toEqual([]);
  });
});
