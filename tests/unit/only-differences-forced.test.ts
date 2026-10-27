// The element is built in the node environment (no DOM): its render() returns a lit template that
// is flattened to text. Only the element decides about the toolbar (D9); the exported
// resolveOnlyDifferences stays as it is.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createPricingViewModel, deepEqual } from '../../src/core/index.js';
import { parsePricingYaml } from '../../src/yaml/index.js';

interface Host {
  yaml?: string;
  _revealedGroups: Set<string>;
  onlyDifferences?: boolean;
  toolbarThreshold: number;
  reload(): Promise<void>;
  requestUpdate: () => void;
  dispatchEvent: (event: Event) => boolean;
  render(): unknown;
  _expandedGroups: Set<string>;
  _compact: boolean;
  // private state the render reads
}

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

async function ready(yaml: string, onlyDifferences?: boolean): Promise<Host> {
  const loaded: unknown = await import('../../src/element/pricing-renderer-element.js');
  const Element = (loaded as { PricingRendererElement: new () => Host }).PricingRendererElement;
  const element = new Element();
  element.requestUpdate = () => undefined;
  element.dispatchEvent = () => true;
  element.yaml = yaml;
  if (onlyDifferences !== undefined) element.onlyDifferences = onlyDifferences;
  await element.reload();
  // the table layout, every group open and revealed in full (the element reveals 30 rows at a time)
  const groups = createPricingViewModel(parsePricingYaml(yaml).value!).comparisonGroups;
  element._compact = false;
  element._expandedGroups = new Set(groups.map((group) => group.id));
  element._revealedGroups = new Set(groups.map((group) => group.id));
  return element;
}

function flatten(template: unknown): string {
  if (Array.isArray(template)) return template.map(flatten).join('');
  if (
    typeof template === 'string' ||
    typeof template === 'number' ||
    typeof template === 'boolean'
  ) {
    return String(template);
  }
  if (typeof template === 'object' && template !== null && 'strings' in template) {
    const { strings, values } = template as { strings: string[]; values: unknown[] };
    return strings
      .map((text, index) => text + (index < values.length ? flatten(values[index]) : ''))
      .join('');
  }
  return '';
}

// 2 plans and `rows` boolean features in one group. The first 5 rows have the same value in both
// plans; the others differ.
function pricingYaml(rows: number): string {
  const ids = Array.from({ length: rows }, (_, index) => `f${String(index + 1).padStart(3, '0')}`);
  const features = ids.flatMap((id) => [
    `  ${id}:`,
    `    name: Row ${id}`,
    '    tag: General',
    '    valueType: BOOLEAN',
    '    defaultValue: false',
  ]);
  const included = ids.slice(5).flatMap((id) => [`      ${id}:`, '        value: true']);
  return [
    "syntaxVersion: '3.1'",
    'saasName: Forced Co',
    "version: '2026.01'",
    "createdAt: '2026-01-01'",
    'currency: EUR',
    'features:',
    ...features,
    'plans:',
    '  one:',
    '    name: Plan One',
    '    price: 10',
    '    unit: month',
    '  two:',
    '    name: Plan Two',
    '    price: 20',
    '    unit: month',
    '    features:',
    ...included,
    '',
  ].join('\n');
}

const TOOLBAR = 'data-pr-part="comparison-toolbar"';
const ROW = /data-pr-part="comparison-row"/g;
const rowCount = (text: string): number => text.match(ROW)?.length ?? 0;

// Rows are rendered with the first group open, as the element does by default.
async function render(yaml: string, onlyDifferences: boolean | undefined): Promise<string> {
  const element = await ready(yaml, onlyDifferences);
  return flatten(element.render());
}

// [utest->req~shorter-page-only-differences~2]
describe('only-differences with a hidden toolbar', () => {
  it('is ignored under the threshold: no toolbar and every row', async () => {
    const text = await render(pricingYaml(20), true);
    expect(text).not.toContain(TOOLBAR);
    expect(rowCount(text)).toBe(20);
  });

  it('shows the same rows as the unforced element', async () => {
    const forced = await render(pricingYaml(20), true);
    const unforced = await render(pricingYaml(20), undefined);
    expect(rowCount(forced)).toBe(rowCount(unforced));
  });

  it('is ignored when a high threshold hides the toolbar of a long comparison', async () => {
    const element = await ready(pricingYaml(60), true);
    element.toolbarThreshold = 200;
    const text = flatten(element.render());
    expect(text).not.toContain(TOOLBAR);
    expect(rowCount(text)).toBe(60);
  });
});

// [utest->req~shorter-page-only-differences~2]
describe('only-differences with a visible toolbar', () => {
  it('filters the rows and checks the box over the threshold', async () => {
    const text = await render(pricingYaml(50), true);
    expect(text).toContain(TOOLBAR);
    expect(rowCount(text)).toBe(45);
    const toolbar = text.slice(text.indexOf(TOOLBAR));
    expect(/<input[^>]*type="checkbox"[^>]*>/.exec(toolbar)?.[0]).toMatch(/\.checked=true/);
  });

  it('keeps every row when the value is false', async () => {
    const text = await render(pricingYaml(50), false);
    expect(text).toContain(TOOLBAR);
    const toolbar = text.slice(text.indexOf(TOOLBAR));
    expect(/<input[^>]*type="checkbox"[^>]*>/.exec(toolbar)?.[0]).toMatch(/\.checked=false/);
    expect(rowCount(text)).toBe(50);
  });

  it('shows the toolbar and drops the equal rows for the ClickUp fixture (174 rows)', async () => {
    const yaml = readFileSync(join(repoRoot, 'tests/fixtures/spectra/clickup/2024.yml'), 'utf8');
    const element = await ready(yaml, true);
    const text = flatten(element.render());
    expect(text).toContain(TOOLBAR);
    const toolbar = text.slice(text.indexOf(TOOLBAR));
    expect(/<input[^>]*type="checkbox"[^>]*>/.exec(toolbar)?.[0]).toMatch(/\.checked=true/);
    const unfiltered = await ready(yaml, false);
    const all = rowCount(flatten(unfiltered.render()));
    // the rows that differ across the plans, from the view model
    const rows = createPricingViewModel(parsePricingYaml(yaml).value!).comparisonGroups.flatMap(
      (group) => group.rows,
    );
    const differing = rows.filter((row) =>
      row.values.some((cell) => !deepEqual(cell.value, row.values[0]?.value)),
    );
    expect(all).toBe(rows.length);
    expect(differing.length).toBeGreaterThan(0);
    expect(differing.length).toBeLessThan(rows.length);
    expect(rowCount(text)).toBe(differing.length);
  });
});
