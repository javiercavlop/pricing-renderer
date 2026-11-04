// The element is built in the node environment (no DOM): its render() returns a lit template that
// is flattened to text, as in tests/unit/error-state.test.ts. The scenarios that need a DOM are in
// tests/browser/hide-sections.spec.ts. The scenarios are those of
// openspec/changes/add-react-headless/specs/hide-sections/spec.md.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

interface Host {
  yaml?: string;
  locale: string;
  mode: string;
  presentation?: { title?: string };
  hideSections?: unknown;
  reload(): Promise<void>;
  requestUpdate: () => void;
  dispatchEvent: (event: Event) => boolean;
  render(): unknown;
}

interface Converter {
  fromAttribute(value: string | null): readonly string[] | undefined;
}

const acmeYaml = readFileSync(
  fileURLToPath(new URL('../../tests/fixtures/acme-pricing.yml', import.meta.url)),
  'utf8',
);
const acmeTitle = 'Simple pricing that scales with you';

const sectionParts = {
  hero: 'hero',
  metadata: 'metadata',
  billing: 'billing',
  variables: 'variables',
  plans: 'plans',
  comparison: 'comparison',
  addOns: 'add-ons',
  summary: 'summary',
} as const;
type SectionName = keyof typeof sectionParts;
const sectionNames = Object.keys(sectionParts) as SectionName[];

let Element: new () => Host;
let converter: Converter | undefined;

beforeAll(async () => {
  const loaded = (await import('../../src/element/pricing-renderer-element.js')) as unknown as {
    PricingRendererElement: new () => Host;
    hideSectionsConverter?: Converter;
  };
  Element = loaded.PricingRendererElement;
  converter = loaded.hideSectionsConverter;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// A new element in the sense of the spec: built in node, with requestUpdate and dispatchEvent
// stubbed, showing Acme in catalog mode, ready.
async function ready(setup: Partial<Host> = {}): Promise<Host> {
  const element = new Element();
  element.requestUpdate = () => undefined;
  element.dispatchEvent = () => true;
  element.yaml = acmeYaml;
  element.locale = 'en-US';
  element.mode = 'catalog';
  Object.assign(element, setup);
  await element.reload();
  return element;
}

// Flattens a lit template (strings and values, nested templates and arrays) into plain text.
function flatten(template: unknown): string {
  if (Array.isArray(template)) return template.map(flatten).join('');
  if (typeof template === 'string' || typeof template === 'number') return String(template);
  if (typeof template === 'object' && template !== null && 'strings' in template) {
    const { strings, values } = template as { strings: string[]; values: unknown[] };
    return strings
      .map((text, index) => text + (index < values.length ? flatten(values[index]) : ''))
      .join('');
  }
  return '';
}

const squash = (text: string): string => text.replace(/\s+/g, ' ').trim();
const markup = (element: Host): string => flatten(element.render());
const partCount = (html: string, part: string): number =>
  html.split(`data-pr-part="${part}"`).length - 1;
const partCountOf = (html: string, name: SectionName): number =>
  partCount(html, sectionParts[name]);

// [utest->req~hide-sections-attribute-converter~1]
describe('hideSectionsConverter', () => {
  it('keeps the tokens that are section names, in their order', () => {
    expect(converter?.fromAttribute).toBeTypeOf('function');
    expect(converter?.fromAttribute(' hero  addOns ')).toEqual(['hero', 'addOns']);
    expect(converter?.fromAttribute('hero footer Plans addons')).toEqual(['hero']);
    expect(converter?.fromAttribute('\tsummary\nplans')).toEqual(['summary', 'plans']);
    expect(converter?.fromAttribute('')).toEqual([]);
    expect(converter?.fromAttribute(null)).toBeUndefined();
  });
});

// [utest->req~hide-sections-property~1]
describe('hideSections: not set', () => {
  it('renders each of the eight section parts once', async () => {
    const html = markup(await ready());
    for (const name of sectionNames) expect(partCountOf(html, name)).toBe(1);
  });
});

// [utest->req~hide-sections-property~1]
describe('hideSections: the property and the attribute', () => {
  it('is declared as a property that reads the hide-sections attribute', async () => {
    const declared = (
      Element as unknown as {
        elementProperties: Map<string, { attribute?: string | boolean; converter?: unknown }>;
      }
    ).elementProperties.get('hideSections');
    expect(declared).toBeDefined();
    expect(converter).toBeDefined();
    expect(declared?.attribute).toBe('hide-sections');
    expect(declared?.converter).toBe(converter);
  });
});

// [utest->req~hide-sections-render~1]
describe('hidden sections render nothing', () => {
  it.each(sectionNames)('hides %s only', async (name) => {
    const html = markup(await ready({ hideSections: [name] }));
    for (const other of sectionNames) {
      expect(partCountOf(html, other), `${other} with ${name} hidden`).toBe(other === name ? 0 : 1);
    }
  });

  it('hides several sections and keeps the others', async () => {
    const html = markup(await ready({ hideSections: ['plans', 'comparison'] }));
    expect(partCountOf(html, 'plans')).toBe(0);
    expect(partCountOf(html, 'comparison')).toBe(0);
    expect(partCountOf(html, 'hero')).toBe(1);
    expect(partCountOf(html, 'addOns')).toBe(1);
  });
});

// [utest->req~hide-sections-addons-summary~1]
describe('hidden add-ons keep the summary', () => {
  it('renders one summary outside any add-on layout, with the subtotal', async () => {
    const shown = markup(await ready());
    const html = markup(await ready({ hideSections: ['addOns'] }));
    expect(partCount(html, 'add-ons')).toBe(0);
    expect(partCount(html, 'add-on-card')).toBe(0);
    expect(html).not.toContain('pr-addon-layout');
    expect(partCount(html, 'summary')).toBe(1);
    const summary = /<aside[^>]*data-pr-part="summary"[\s\S]*?<strong>([\s\S]*?)<\/strong>/;
    const subtotal = (text: string): string => squash(summary.exec(text)?.[1] ?? '');
    expect(subtotal(html)).not.toBe('');
    expect(subtotal(html)).toBe(subtotal(shown));
  });
});

// [utest->req~hide-sections-addons-summary~1]
describe('all sections hidden', () => {
  it('renders the shell and no section part', async () => {
    const html = markup(await ready({ hideSections: [...sectionNames] }));
    expect(html).toContain('class="pr-shell"');
    for (const name of sectionNames) expect(partCountOf(html, name)).toBe(0);
  });
});

// [utest->req~hide-sections-addons-summary~1]
describe('loading and error are not sections', () => {
  it('renders the error state with every section hidden', async () => {
    const element = await ready({ hideSections: [...sectionNames], yaml: 'plans: [' });
    const html = markup(element);
    expect(html).toContain('pr-error');
    expect(html).toMatch(/<h2>\s*The pricing could not be rendered\.\s*<\/h2>/);
    expect(html).toContain('<p>');
    expect(partCount(html, 'diagnostics')).toBe(1);
  });
});

// The id of the element that the shell references, and the h2.pr-sr-only inside the shell.
function hiddenTitle(html: string): {
  shellLabel?: string;
  id?: string;
  text: string;
  count: number;
} {
  const valueOf = (tag: string, name: string): string | undefined => {
    const match = new RegExp(`(?<![\\w-])${name}=(?:"([^"]*)"|([^"\\s>]+))`).exec(tag);
    return match ? (match[1] ?? match[2]) : undefined;
  };
  const shell = /<section\b[^>]*class="pr-shell"[^>]*>/.exec(html)?.[0] ?? '';
  const headings = [...html.matchAll(/<h2\b([^>]*)>([\s\S]*?)<\/h2>/g)].filter((match) =>
    /class="pr-sr-only"/.test(match[1] ?? ''),
  );
  const first = headings[0];
  const id = first ? valueOf(first[1] ?? '', 'id') : undefined;
  const shellLabel = valueOf(shell, 'aria-labelledby');
  return {
    ...(shellLabel !== undefined ? { shellLabel } : {}),
    ...(id !== undefined ? { id } : {}),
    text: squash((first?.[2] ?? '').replace(/<[^>]*>/g, ' ')),
    count: headings.length,
  };
}

// [utest->req~hide-sections-hero-name~1]
describe('accessible name without the hero', () => {
  it('Hidden title markup', async () => {
    const html = markup(await ready({ hideSections: ['hero'] }));
    expect(partCount(html, 'hero')).toBe(0);
    const title = hiddenTitle(html);
    expect(title.count).toBe(1);
    expect(title.text).toBe(acmeTitle);
    expect(title.shellLabel).toBeTruthy();
    expect(title.id).toBe(title.shellLabel);
  });

  it('Presentation title', async () => {
    const html = markup(
      await ready({ hideSections: ['hero'], presentation: { title: 'Plans for teams' } }),
    );
    expect(hiddenTitle(html).text).toBe('Plans for teams');
  });

  it('adds no hidden title while the hero shows', async () => {
    expect(hiddenTitle(markup(await ready())).count).toBe(0);
  });
});

// [utest->req~hide-sections-unknown~2]
describe('unknown section tokens', () => {
  it('Unknown value set as a property', async () => {
    const html = markup(await ready({ hideSections: ['plans', 'footer'] }));
    expect(partCountOf(html, 'plans')).toBe(0);
    for (const name of sectionNames.filter((item) => item !== 'plans')) {
      expect(partCountOf(html, name)).toBe(1);
    }
  });

  it('Property that is not an array', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const warnings = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const element = await ready();
    for (const value of [null, 'hero', 1, { 0: 'hero', length: 1 }]) {
      element.hideSections = value;
      const html = markup(element);
      for (const name of sectionNames) {
        expect(partCountOf(html, name), `${name} with ${JSON.stringify(value)}`).toBe(1);
      }
    }
    expect(errors).not.toHaveBeenCalled();
    expect(warnings).not.toHaveBeenCalled();
  });

  it('keeps only the known tokens of an attribute value', () => {
    expect(converter?.fromAttribute).toBeTypeOf('function');
    expect(converter?.fromAttribute('hero footer Plans addons')).toEqual(['hero']);
  });
});

// Type-checks a TSX snippet with the strict options of tsconfig.base.json. The snippet is served
// from memory next to this file, so its relative imports resolve to src/** on disk.
function typeCheckSnippet(source: string): ts.Diagnostic[] {
  const snippetPath = fileURLToPath(new URL('./__hide_sections_snippet__.tsx', import.meta.url));
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2021,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    jsx: ts.JsxEmit.React,
    strict: true,
    noUncheckedIndexedAccess: true,
    verbatimModuleSyntax: true,
    skipLibCheck: true,
    noEmit: true,
    types: [],
  };
  const host = ts.createCompilerHost(options);
  const { fileExists, readFile: readHostFile, getSourceFile } = host;
  host.fileExists = (fileName) => fileName === snippetPath || fileExists(fileName);
  host.readFile = (fileName) => (fileName === snippetPath ? source : readHostFile(fileName));
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreate) =>
    fileName === snippetPath
      ? ts.createSourceFile(fileName, source, languageVersion, true, ts.ScriptKind.TSX)
      : getSourceFile(fileName, languageVersion, onError, shouldCreate);
  const program = ts.createProgram([snippetPath], options, host);
  return ts.getPreEmitDiagnostics(program, program.getSourceFile(snippetPath));
}

const messages = (diagnostics: ts.Diagnostic[]): string[] =>
  diagnostics.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));

// [utest->req~hide-sections-react-manifest~1]
describe('React prop and manifest for hidden sections', () => {
  const header = `
    import * as React from 'react';
    import { PricingRenderer } from '../../src/react/index.js';
    import type { PricingSectionName } from '../../src/react/index.js';
    import type { PricingSectionName as ElementSectionName } from '../../src/element/index.js';
    declare const source: string;
    export const names: readonly PricingSectionName[] = ['hero'] satisfies readonly ElementSectionName[];
  `;

  it('accepts section names and rejects others', () => {
    const accepted = typeCheckSnippet(
      `${header}\nexport const element = <PricingRenderer yaml={source} hideSections={['hero', 'comparison']} />;`,
    );
    expect(messages(accepted)).toEqual([]);
    const rejected = typeCheckSnippet(
      `${header}\nexport const element = <PricingRenderer yaml={source} hideSections={['footer']} />;`,
    );
    expect(rejected.map((diagnostic) => diagnostic.code)).toContain(2322);
  });

  it('lists the field and the attribute in custom-elements.json', () => {
    const manifest = JSON.parse(
      readFileSync(fileURLToPath(new URL('../../custom-elements.json', import.meta.url)), 'utf8'),
    ) as {
      modules: {
        declarations?: {
          name: string;
          members?: { kind: string; name: string }[];
          attributes?: { name: string; fieldName?: string }[];
        }[];
      }[];
    };
    const declaration = manifest.modules
      .flatMap((module) => module.declarations ?? [])
      .find((candidate) => candidate.name === 'PricingRendererElement');
    expect(declaration).toBeDefined();
    expect(declaration?.members).toContainEqual(
      expect.objectContaining({ kind: 'field', name: 'hideSections' }),
    );
    expect(declaration?.attributes).toContainEqual(
      expect.objectContaining({ name: 'hide-sections', fieldName: 'hideSections' }),
    );
  });
});
