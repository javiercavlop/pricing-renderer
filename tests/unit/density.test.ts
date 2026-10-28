import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

const recorded = vi.hoisted(() => ({ props: [] as Record<string, unknown>[] }));

vi.mock('@lit/react', () => ({
  createComponent: () => (props: Record<string, unknown>) => {
    recorded.props.push(props);
    return null;
  },
}));

// Opt-in `density` setting: the property and attribute of the element, the React prop and the
// compact spacing block of base.css. The default look does not change. Computed values are measured
// by tests/browser/density.spec.ts.

const stylesRoot = fileURLToPath(new URL('../../src/styles/', import.meta.url));
const elementRoot = fileURLToPath(new URL('../../src/element/', import.meta.url));
const baseCss = readFileSync(`${stylesRoot}base.css`, 'utf8');
const themeCss = readFileSync(`${stylesRoot}theme.css`, 'utf8');

interface ElementClass {
  properties: Record<string, { attribute?: string | false; reflect?: boolean; type?: unknown }>;
  observedAttributes: string[];
  new (): { density: unknown };
}

async function loadElement(): Promise<ElementClass> {
  const loaded: unknown = await import('../../src/element/pricing-renderer-element.js');
  return (loaded as { PricingRendererElement: ElementClass }).PricingRendererElement;
}

// [utest->req~density-attribute~1]
describe('density property of the element', () => {
  it('is a reflected property with the density attribute, and the attribute is observed', async () => {
    const Element = await loadElement();
    const entry = Element.properties.density;
    expect(entry, 'density is declared in static properties').toBeDefined();
    expect(entry?.reflect).toBe(true);
    expect(entry?.attribute === undefined || entry.attribute === 'density').toBe(true);
    expect(Element.observedAttributes).toContain('density');
  });

  it('defaults to comfortable', async () => {
    const Element = await loadElement();
    expect(new Element().density).toBe('comfortable');
  });

  it('keeps comfortable and compact', async () => {
    const Element = await loadElement();
    const element = new Element();
    element.density = 'compact';
    expect(element.density).toBe('compact');
    element.density = 'comfortable';
    expect(element.density).toBe('comfortable');
  });

  it('reads any other value back as comfortable', async () => {
    const Element = await loadElement();
    const element = new Element();
    for (const invalid of ['tight', 'Compact', '', 'compact ', 0, null, undefined, {}]) {
      element.density = 'compact';
      element.density = invalid;
      expect(element.density, String(invalid)).toBe('comfortable');
    }
  });
});

interface Mounted {
  density: unknown;
  updateComplete: Promise<boolean>;
  connectedCallback(): void;
  attributeChangedCallback(name: string, old: string | null, value: string | null): void;
  hasAttribute(name: string): boolean;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  update(changed: unknown): void;
  firstUpdated(): void;
  updated(): void;
}

// Runs the Lit update cycle in node on the DOM shim of Lit. Rendering, the first load and the size
// observer need a DOM, so they are stand-ins; ReactiveElement.update still reflects the properties
// to attributes. The shim calls no attributeChangedCallback, so the density attribute methods call
// it as a browser does, also when Lit reflects or the element removes the attribute itself.
async function mount(beforeConnect?: (element: Mounted) => void): Promise<Mounted> {
  const Element = await loadElement();
  const { ReactiveElement } = await import('lit');
  const reflect = (ReactiveElement.prototype as unknown as Mounted).update;
  const element = new Element() as unknown as Mounted;
  const setAttribute = element.setAttribute.bind(element);
  const removeAttribute = element.removeAttribute.bind(element);
  element.setAttribute = (name, value) => {
    const old = element.getAttribute(name);
    setAttribute(name, value);
    if (name === 'density') element.attributeChangedCallback(name, old, value);
  };
  element.removeAttribute = (name) => {
    const old = element.getAttribute(name);
    removeAttribute(name);
    if (name === 'density' && old !== null) element.attributeChangedCallback(name, old, null);
  };
  element.update = (changed) => reflect.call(element, changed);
  element.firstUpdated = () => undefined;
  element.updated = () => undefined;
  beforeConnect?.(element);
  element.connectedCallback();
  await element.updateComplete;
  return element;
}

async function setDensityAttribute(element: Mounted, value: string | null): Promise<void> {
  if (value === null) element.removeAttribute('density');
  else element.setAttribute('density', value);
  await element.updateComplete;
}

// [utest->req~density-attribute~1]
describe('density attribute of a connected element', () => {
  it('is not added when density is never set', async () => {
    const element = await mount();
    expect(element.hasAttribute('data-pr-root'), 'the element was connected').toBe(true);
    expect(element.hasAttribute('density')).toBe(false);
    expect(element.density).toBe('comfortable');
    // a later update of another property does not add it either
    (element as unknown as { theme: string }).theme = 'dark';
    await element.updateComplete;
    expect(element.hasAttribute('density')).toBe(false);
  });

  it('reflects density="compact" when the property is set', async () => {
    const element = await mount();
    element.density = 'compact';
    await element.updateComplete;
    expect(element.getAttribute('density')).toBe('compact');
  });

  it('reflects a property set before the first update', async () => {
    const element = await mount((host) => {
      host.density = 'compact';
    });
    expect(element.getAttribute('density')).toBe('compact');
  });

  it('removes the attribute when unset, as an undefined React prop', async () => {
    const element = await mount();
    element.density = undefined;
    await element.updateComplete;
    expect(element.hasAttribute('density'), 'undefined on a fresh element').toBe(false);

    element.density = 'compact';
    await element.updateComplete;
    element.density = undefined;
    await element.updateComplete;
    expect(element.hasAttribute('density'), 'undefined after compact').toBe(false);
    expect(element.density).toBe('comfortable');

    element.density = 'compact';
    await element.updateComplete;
    element.density = null;
    await element.updateComplete;
    expect(element.hasAttribute('density'), 'null after compact').toBe(false);
  });

  it('keeps a host attribute and reads unknown values as comfortable', async () => {
    const element = await mount();
    await setDensityAttribute(element, 'compact');
    expect(element.density).toBe('compact');
    expect(element.getAttribute('density')).toBe('compact');

    await setDensityAttribute(element, 'tight');
    expect(element.density).toBe('comfortable');
    expect(element.getAttribute('density')).toBe('tight');

    await setDensityAttribute(element, null);
    expect(element.density).toBe('comfortable');
    expect(element.hasAttribute('density')).toBe(false);
  });

  it('restores comfortable when an early compact attribute is removed', async () => {
    const element = await mount((host) => host.setAttribute('density', 'compact'));
    expect(element.density).toBe('compact');
    expect(element.getAttribute('density')).toBe('compact');

    await setDensityAttribute(element, null);
    expect(element.density).toBe('comfortable');
    expect(element.hasAttribute('density')).toBe(false);
  });
});

// [utest->req~density-attribute~1]
describe('density default stays unchanged', () => {
  it('writes no data-density attribute in any source of the element', () => {
    const files = readdirSync(elementRoot).filter((file) => file.endsWith('.ts'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(readFileSync(`${elementRoot}${file}`, 'utf8'), file).not.toContain('data-density');
    }
  });

  it('does not use density in the stylesheet theme', () => {
    expect(themeCss.toLowerCase()).not.toContain('density');
  });

  it('declares no spacing token in base.css outside the compact block', () => {
    const outside = stripComments(baseCss).replace(compactBlockPattern, '');
    const declared = [...outside.matchAll(spacingDeclaration)].map((match) => match[1]);
    expect(declared).toEqual([]);
  });
});

// Type-checks a TSX snippet like tests/unit/react-style-prop.test.ts.
function typeCheckSnippet(source: string): ts.Diagnostic[] {
  const snippetPath = fileURLToPath(new URL('./__snippet__.tsx', import.meta.url));
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

const header = `
  import * as React from 'react';
  import { PricingRenderer } from '../../src/react/index.js';
  declare const s: string;
`;

const element = (attributes: string): string =>
  `${header}\nexport const element = <PricingRenderer yaml={s} ${attributes} />;`;

// [utest->req~density-react~1]
describe('React density prop', () => {
  it('accepts comfortable and compact', () => {
    expect(messages(typeCheckSnippet(element(`density="comfortable"`)))).toEqual([]);
    expect(messages(typeCheckSnippet(element(`density="compact"`)))).toEqual([]);
  });

  it('rejects any other string', () => {
    expect(typeCheckSnippet(element(`density="tight"`)).length).toBeGreaterThan(0);
  });

  it('rejects a non-string value', () => {
    expect(typeCheckSnippet(element(`density={42}`)).length).toBeGreaterThan(0);
  });

  it('passes density to the underlying component unchanged', async () => {
    const { PricingRenderer } = await import('../../src/react/index.js');
    const renderFn = (
      PricingRenderer as unknown as {
        render: (props: Record<string, unknown>, ref: unknown) => unknown;
      }
    ).render;
    for (const density of ['compact', 'comfortable']) {
      const rendered = renderFn({ yaml: 'name: x', density }, null) as {
        type: (props: Record<string, unknown>) => unknown;
        props: Record<string, unknown>;
      };
      rendered.type(rendered.props);
      expect(recorded.props.at(-1)?.density).toBe(density);
    }
  });
});

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

const spacingDeclaration = /(?:^|[\s;{])(--pr-space-[\w-]+|--pr-shell-padding)\s*:/g;
// The compact block, whatever the quotes, the extra selectors or the at-rule around it.
const compactBlockPattern = /[^{}]*\[\s*density\s*=\s*["']?compact["']?\s*\][^{}]*\{[^{}]*\}/g;

function collapse(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function compactBlocks(): { selector: string; declarations: [string, string][] }[] {
  return [...stripComments(baseCss).matchAll(compactBlockPattern)].map((match) => {
    const text = match[0];
    const open = text.indexOf('{');
    const declarations: [string, string][] = [];
    for (const declaration of text.slice(open + 1, -1).split(';')) {
      const colon = declaration.indexOf(':');
      if (colon === -1) continue;
      declarations.push([
        declaration.slice(0, colon).trim().toLowerCase(),
        collapse(declaration.slice(colon + 1)),
      ]);
    }
    return { selector: collapse(text.slice(0, open)), declarations };
  });
}

const remTotal = (value: string): number =>
  [...value.matchAll(/(\d*\.?\d+)rem/g)].reduce((sum, match) => sum + Number(match[1]), 0);

// The defaults of theme.css: the first declaration of every spacing token.
function themeDefaults(): Map<string, string> {
  const defaults = new Map<string, string>();
  for (const match of stripComments(themeCss).matchAll(
    /(--pr-space-[\w-]+|--pr-shell-padding)\s*:\s*([^;]+);/g,
  )) {
    if (!defaults.has(match[1])) defaults.set(match[1], collapse(match[2]));
  }
  return defaults;
}

// [utest->req~density-compact-tokens~1]
describe('compact density block of base.css', () => {
  it('has one pricing-renderer[density=compact] block', () => {
    const blocks = compactBlocks();
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.selector.replace(/"/g, "'")).toBe("pricing-renderer[density='compact']");
  });

  it('sets only spacing custom properties, including --pr-space-4 and --pr-space-5', () => {
    const declarations = compactBlocks()[0]?.declarations ?? [];
    const names = declarations.map(([name]) => name);
    expect(names).toContain('--pr-space-4');
    expect(names).toContain('--pr-space-5');
    const stray = names.filter((name) => !/^(--pr-space-[\w-]+|--pr-shell-padding)$/.test(name));
    expect(stray, 'declarations that are not spacing tokens').toEqual([]);
    expect(names.some((name) => /color|shadow|font|radius/.test(name))).toBe(false);
  });

  it('uses smaller rem values than the theme.css defaults', () => {
    const defaults = themeDefaults();
    const declarations = compactBlocks()[0]?.declarations ?? [];
    expect(declarations.length).toBeGreaterThan(0);
    for (const [name, value] of declarations) {
      const base = defaults.get(name);
      expect(base, `${name} has a default in theme.css`).toBeDefined();
      expect(remTotal(value), `${name} is in rem`).toBeGreaterThan(0);
      expect(remTotal(value), `${name}: ${value} against ${base}`).toBeLessThan(
        remTotal(base ?? ''),
      );
    }
  });
});
