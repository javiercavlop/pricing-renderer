import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement, type ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import ts from 'typescript';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  configurePricingRenderer,
  getPricingRendererConfig,
  mergePresentationOptions,
} from '../../src/core/index.js';

// Names the implementation uses (design D8), for the implementer:
//
// - `src/react/provider.ts` exports the component `PricingRendererProvider`
//   (props `config`, `messages`, `presentation`, `request`, `requestOrigins`, `loadPricing`,
//   `children`), the internal context object `PricingRendererContext` (value: the provider props
//   without `children`, `undefined` outside a provider) and the request filter
//   `filterProviderRequest(request, src, requestOrigins)`.
// - `filterProviderRequest(request: PricingRequestOptions | undefined, src: string | undefined,
//   requestOrigins?: readonly string[]): PricingRequestOptions | undefined` returns `undefined`
//   for an undefined request. It returns the request unchanged when `src` is an absolute URL whose
//   origin is the page origin (`globalThis.location.origin`, none on a server) or the origin of an
//   entry of `requestOrigins` (an entry that does not parse is ignored); otherwise it returns a
//   copy without `headers` and `credentials`. `maxBytes`, `timeoutMs` and the other fields stay.
//   It does not add `credentials: 'omit'`; the hook side (P3-6) does.
// - `src/react/headless.ts` exports `PricingRendererProvider` (and later the hooks), imports no Lit
//   module at runtime, and `src/react/index.ts` re-exports every runtime export of it.

const recorded = vi.hoisted(() => ({ props: [] as Record<string, unknown>[] }));

vi.mock('@lit/react', () => ({
  createComponent: () => (props: Record<string, unknown>) => {
    recorded.props.push(props);
    return null;
  },
}));

type Loose = Record<string, unknown>;

const providerPath = '../../src/react/provider.js';
const headlessPath = '../../src/react/headless.js';

let providerMod: Loose = {};
let headlessMod: Loose = {};

beforeAll(async () => {
  providerMod = (await import('../../src/react/provider.js')) as Loose;
  headlessMod = (await import('../../src/react/headless.js')) as Loose;
});

afterEach(() => {
  vi.unstubAllGlobals();
  configurePricingRenderer();
});

beforeEach(() => {
  recorded.props.length = 0;
  configurePricingRenderer();
});

const acmeYaml = 'name: Acme\n';

function providerComponent(): Parameters<typeof createElement>[0] {
  const provider = providerMod.PricingRendererProvider;
  expect(provider, `${providerPath} PricingRendererProvider`).toBeTypeOf('function');
  return provider as Parameters<typeof createElement>[0];
}

type FilterRequest = (
  request: Loose | undefined,
  src: string | undefined,
  origins?: readonly string[],
) => Loose | undefined;

function filterRequest(): FilterRequest {
  expect(providerMod.filterProviderRequest, 'filterProviderRequest').toBeTypeOf('function');
  return providerMod.filterProviderRequest as FilterRequest;
}

// Renders `PricingRenderer` with the props inside the providers, outermost first, with
// renderToString and returns the props the mocked base component recorded.
async function renderWrapper(props: Loose, providers: Loose[] = []): Promise<Loose> {
  const { PricingRenderer } = await import('../../src/react/index.js');
  let tree: ReactElement = createElement(PricingRenderer as never, props);
  for (const providerProps of [...providers].reverse()) {
    tree = createElement(providerComponent(), providerProps, tree) as ReactElement;
  }
  renderToString(tree);
  const last = recorded.props.at(-1);
  expect(last, 'the base component rendered').toBeDefined();
  return last as Loose;
}

const absentKeys = [
  'locale',
  'pricingPath',
  'selectionEnabled',
  'ctaEnabled',
  'variablesEnabled',
  'presentation',
  'messages',
  'request',
  'loadPricing',
];

// [utest->req~provider-config-precedence~1]
describe('provider config below instance settings', () => {
  const config = {
    locale: 'es-ES',
    pricingPath: '/catalog',
    selectionEnabled: false,
    ctaEnabled: false,
    variablesEnabled: false,
  };

  it('passes every key of the provider config', async () => {
    configurePricingRenderer({ locale: 'en-US' });
    const props = await renderWrapper({ yaml: acmeYaml }, [{ config }]);
    expect(props).toMatchObject(config);
  });

  it('lets the instance props win', async () => {
    configurePricingRenderer({ locale: 'en-US' });
    const instance = {
      locale: 'fr-FR',
      pricingPath: '/plans',
      selectionEnabled: true,
      ctaEnabled: true,
      variablesEnabled: true,
    };
    const props = await renderWrapper({ yaml: acmeYaml, ...instance }, [{ config }]);
    expect(props).toMatchObject(instance);
  });
});

// [utest->req~provider-presentation-precedence~1]
describe('provider presentation precedence', () => {
  const badge = (label: string) => [{ id: label, label, tone: 'accent' as const }];

  it('passes the merge of the provider config, the provider and the instance presentation', async () => {
    const configPresentation = {
      planBadges: { starter: badge('Config'), growth: badge('Config') },
    };
    const pp = { planBadges: { growth: badge('Provider') } };
    const ip = { planBadges: { starter: badge('Instance') } };
    const props = await renderWrapper({ yaml: acmeYaml, presentation: ip }, [
      { config: { presentation: configPresentation }, presentation: pp },
    ]);
    expect(props.presentation).toEqual(
      mergePresentationOptions(mergePresentationOptions(configPresentation, pp), ip),
    );
    type Merged = { planBadges: Record<string, { label: string }[]> };
    const planBadges = (props.presentation as Merged).planBadges;
    expect(planBadges.growth?.[0]?.label).toBe('Provider');
    expect(planBadges.starter?.[0]?.label).toBe('Instance');
  });

  it('passes the provider presentation merged with an instance presentation', async () => {
    const pp = { planBadges: { growth: badge('Provider') } };
    const ip = { planBadges: { starter: badge('Instance') } };
    const props = await renderWrapper({ yaml: acmeYaml, presentation: ip }, [{ presentation: pp }]);
    expect(props.presentation).toEqual(mergePresentationOptions(pp, ip));
  });

  it('lets the instance win and the provider beat the config on the same key', async () => {
    type Merged = { planBadges: Record<string, { label: string }[]> };
    const both = await renderWrapper(
      { yaml: acmeYaml, presentation: { planBadges: { growth: badge('Instance') } } },
      [{ presentation: { planBadges: { growth: badge('Provider') } } }],
    );
    expect((both.presentation as Merged).planBadges.growth).toEqual([
      { id: 'Instance', label: 'Instance', tone: 'accent' },
    ]);
    const overConfig = await renderWrapper({ yaml: acmeYaml }, [
      {
        config: { presentation: { planBadges: { growth: badge('Config') } } },
        presentation: { planBadges: { growth: badge('Provider') } },
      },
    ]);
    expect((overConfig.presentation as Merged).planBadges.growth).toEqual([
      { id: 'Provider', label: 'Provider', tone: 'accent' },
    ]);
  });

  it('passes the provider presentation when the instance sets none', async () => {
    const pp = { planBadges: { growth: badge('Provider') } };
    const props = await renderWrapper({ yaml: acmeYaml }, [{ presentation: pp }]);
    expect(props.presentation).toEqual(mergePresentationOptions(pp, undefined));
  });
});

// [utest->req~provider-messages-merge~1]
describe('provider messages merge per key', () => {
  it('replaces one key and keeps the others', async () => {
    const props = await renderWrapper({ yaml: acmeYaml, messages: { 'cta.select': 'Choose' } }, [
      { messages: { 'summary.title': 'Your plan', 'cta.select': 'Pick' } },
    ]);
    expect(props.messages).toEqual({ 'summary.title': 'Your plan', 'cta.select': 'Choose' });
  });

  it('passes the provider catalog when the instance sets none', async () => {
    const props = await renderWrapper({ yaml: acmeYaml }, [{ messages: { 'cta.select': 'Pick' } }]);
    expect(props.messages).toEqual({ 'cta.select': 'Pick' });
  });
});

// [utest->req~provider-request-loader~1]
describe('provider request and loader reach the wrapper', () => {
  const loader = (): Promise<string> => Promise.resolve('name: Acme\n');
  const src = 'https://example.com/acme.yml';

  it('passes the provider loadPricing and request when the instance sets none', async () => {
    const props = await renderWrapper({ src }, [
      { loadPricing: loader, request: { timeoutMs: 5000 } },
    ]);
    expect(Object.is(props.loadPricing, loader)).toBe(true);
    expect(props.request).toEqual({ timeoutMs: 5000 });
  });

  it('lets an instance request replace the provider request as a whole', async () => {
    const props = await renderWrapper({ src, request: { maxBytes: 4096 } }, [
      { loadPricing: loader, request: { timeoutMs: 5000 } },
    ]);
    expect(props.request).toEqual({ maxBytes: 4096 });
    expect(Object.is(props.loadPricing, loader)).toBe(true);
  });

  it('lets an instance loadPricing replace the provider loadPricing', async () => {
    const own = (): Promise<string> => Promise.resolve('name: Own\n');
    const props = await renderWrapper({ src, loadPricing: own }, [{ loadPricing: loader }]);
    expect(Object.is(props.loadPricing, own)).toBe(true);
  });
});

// [utest->req~provider-request-origin~1]
describe('provider request headers stay on allowed origins', () => {
  const request = {
    headers: { Authorization: 'Bearer t' },
    credentials: 'include' as const,
    timeoutMs: 5000,
  };

  it('drops headers and credentials for a foreign origin in the wrapper', async () => {
    vi.stubGlobal('location', { origin: 'https://app.example.com' });
    const props = await renderWrapper({ src: 'https://cdn.example.net/acme.yml' }, [{ request }]);
    expect(props.request).toEqual({ timeoutMs: 5000 });
  });

  it('keeps headers and credentials for the page origin in the wrapper', async () => {
    vi.stubGlobal('location', { origin: 'https://app.example.com' });
    const props = await renderWrapper({ src: 'https://app.example.com/acme.yml' }, [{ request }]);
    expect(props.request).toEqual(request);
  });

  it('keeps headers for a listed origin in the wrapper', async () => {
    vi.stubGlobal('location', { origin: 'https://app.example.com' });
    const props = await renderWrapper({ src: 'https://cdn.example.net/acme.yml' }, [
      { request, requestOrigins: ['https://cdn.example.net'] },
    ]);
    expect(props.request).toEqual(request);
  });

  it('uses an instance request as given, also on a foreign origin', async () => {
    vi.stubGlobal('location', { origin: 'https://app.example.com' });
    const own = { headers: { 'X-Key': 'k' }, credentials: 'include' as const };
    const props = await renderWrapper({ src: 'https://cdn.example.net/acme.yml', request: own }, [
      { request },
    ]);
    expect(props.request).toEqual(own);
  });

  describe('filterProviderRequest', () => {
    it('returns undefined for an undefined request', () => {
      expect(filterRequest()(undefined, 'https://a.example/x.yml', [])).toBeUndefined();
    });

    it('strips headers and credentials from a foreign origin, keeps the rest', () => {
      vi.stubGlobal('location', { origin: 'https://app.example.com' });
      const result = filterRequest()(
        { ...request, maxBytes: 10 },
        'https://cdn.example.net/a.yml',
        [],
      );
      expect(result).toEqual({ timeoutMs: 5000, maxBytes: 10 });
    });

    it('keeps the request for the page origin', () => {
      vi.stubGlobal('location', { origin: 'https://app.example.com' });
      expect(filterRequest()(request, 'https://app.example.com/a.yml', [])).toEqual(request);
    });

    it('has no page origin on a server, so only listed origins keep headers', () => {
      expect(globalThis.location).toBeUndefined();
      const filter = filterRequest();
      const cdn = ['https://cdn.example.net'];
      const stripped = { timeoutMs: 5000 };
      expect(filter(request, 'https://cdn.example.net/a.yml', cdn)).toEqual(request);
      expect(filter(request, 'https://app.example.com/a.yml', cdn)).toEqual(stripped);
      expect(filter(request, 'https://cdn.example.net/a.yml')).toEqual(stripped);
    });

    it('compares origins, not string prefixes', () => {
      vi.stubGlobal('location', { origin: 'https://app.example.com' });
      const filter = filterRequest();
      const stripped = { timeoutMs: 5000 };
      expect(filter(request, 'https://app.example.com.evil.net/a.yml', [])).toEqual(stripped);
      expect(filter(request, 'https://app.example.com@evil.net/a.yml', [])).toEqual(stripped);
      expect(filter(request, 'https://app.example.com:8443/a.yml', [])).toEqual(stripped);
    });

    it('reads each listed entry as an origin and ignores one that does not parse', () => {
      const filter = filterRequest();
      const src = 'https://cdn.example.net/a.yml';
      const listed = ['not a url', 'https://cdn.example.net/path'];
      expect(filter(request, src, listed)).toEqual(request);
      expect(filter(request, src, ['not a url'])).toEqual({ timeoutMs: 5000 });
    });

    it('compares origins case-insensitively and ignores a default port', () => {
      vi.stubGlobal('location', { origin: 'https://app.example.com' });
      expect(filterRequest()(request, 'HTTPS://APP.example.com:443/a.yml', [])).toEqual(request);
    });

    it('never matches a protocol-relative URL', () => {
      vi.stubGlobal('location', { origin: 'https://app.example.com' });
      const listed = ['https://cdn.example.net'];
      const result = filterRequest()(request, '//cdn.example.net/a.yml', listed);
      expect(result).toEqual({ timeoutMs: 5000 });
    });

    it('strips headers and credentials for a blob URL of the page origin', () => {
      vi.stubGlobal('location', { origin: 'https://app.example.com' });
      const result = filterRequest()(request, 'blob:https://app.example.com/1', []);
      expect(result).toEqual({ timeoutMs: 5000 });
      expect(result).not.toHaveProperty('headers');
      expect(result).not.toHaveProperty('credentials');
    });

    it('strips headers and credentials when src is not an absolute URL', () => {
      vi.stubGlobal('location', { origin: 'https://app.example.com' });
      const filter = filterRequest();
      const cdn = ['https://cdn.example.net'];
      expect(filter(request, '/acme.yml', cdn)).toEqual({ timeoutMs: 5000 });
      expect(filter(request, undefined, [])).toEqual({ timeoutMs: 5000 });
    });
  });
});

// [utest->req~provider-nearest~1]
describe('nearest provider wins', () => {
  it('passes the messages of the inner provider only', async () => {
    const props = await renderWrapper({ yaml: acmeYaml }, [
      { messages: { 'summary.title': 'Outer title', 'cta.select': 'Outer' } },
      { messages: { 'cta.select': 'Inner' } },
    ]);
    expect(props.messages).toEqual({ 'cta.select': 'Inner' });
    expect(props.messages).not.toHaveProperty('summary.title');
  });

  it('does not take the config of an outer provider', async () => {
    const props = await renderWrapper({ yaml: acmeYaml }, [
      { config: { locale: 'es-ES' } },
      { messages: { 'cta.select': 'Inner' } },
    ]);
    expect(Object.keys(props)).not.toContain('locale');
  });
});

// [utest->req~provider-no-global-write~1]
describe('provider keeps the global configuration', () => {
  it('renders its children and leaves the global locale alone', () => {
    const html = renderToString(
      createElement(
        providerComponent(),
        { config: { locale: 'es-ES' } },
        createElement('b', null, 'x'),
      ),
    );
    expect(html).toBe('<b>x</b>');
    expect(getPricingRendererConfig().locale).toBe('en-US');
  });

  it('leaves the global configuration unchanged for messages and presentation', async () => {
    const before = structuredClone(getPricingRendererConfig());
    renderToString(
      createElement(providerComponent(), {
        messages: { 'cta.select': 'Pick' },
        presentation: { planBadges: { growth: [{ id: 'a', label: 'A', tone: 'accent' }] } },
      }),
    );
    expect(getPricingRendererConfig()).toEqual(before);
    const props = await renderWrapper({ yaml: acmeYaml });
    expect(Object.keys(props)).not.toContain('messages');
    expect(Object.keys(props)).not.toContain('presentation');
  });

  it('gives a tree without a provider none of the provider settings', async () => {
    renderToString(createElement(providerComponent(), { config: { locale: 'es-ES' } }));
    const props = await renderWrapper({ yaml: acmeYaml });
    expect(Object.keys(props)).not.toContain('locale');
  });
});

// [utest->req~provider-absent-unchanged~2]
describe('no provider, no added settings', () => {
  it('passes none of the settings the host did not pass', async () => {
    configurePricingRenderer({ locale: 'es-ES', variablesEnabled: false });
    expect(providerComponent()).toBeDefined();
    const props = await renderWrapper({ yaml: acmeYaml });
    for (const key of absentKeys) expect(Object.keys(props)).not.toContain(key);
  });

  it('passes only the locale the host passed', async () => {
    configurePricingRenderer({ locale: 'es-ES', variablesEnabled: false });
    expect(providerComponent()).toBeDefined();
    const props = await renderWrapper({ yaml: acmeYaml, locale: 'fr-FR' });
    expect(props.locale).toBe('fr-FR');
    for (const key of absentKeys.filter((name) => name !== 'locale')) {
      expect(Object.keys(props)).not.toContain(key);
    }
  });
});

// Follows the runtime imports of a source file: every import and re-export declaration except
// `import type` and `export type`; a declaration whose specifiers are all inline `type` specifiers
// still counts (verbatimModuleSyntax keeps it as a side-effect import).
function runtimeSpecifiers(file: string): string[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      if (!node.importClause?.isTypeOnly) found.push(node.moduleSpecifier.text);
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      if (!node.isTypeOnly) found.push(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      found.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

function resolveRelative(from: string, specifier: string): string {
  const base = resolve(dirname(from), specifier);
  const candidates = [
    base.replace(/\.js$/, '.ts'),
    base.replace(/\.js$/, '.tsx'),
    base,
    join(base, 'index.ts'),
  ];
  const isFile = (path: string): boolean => existsSync(path) && statSync(path).isFile();
  const found = candidates.find(isFile);
  if (found === undefined) throw new Error(`Cannot resolve ${specifier} from ${from}`);
  return found;
}

const reactRoot = fileURLToPath(new URL('../../src/react/', import.meta.url));
const headlessFile = join(reactRoot, 'headless.ts');
const litPackage = /^(lit|lit-html|lit-element|@lit\/.*|lit\/.*)$/;

// [utest->req~react-headless-entry~1]
describe('headless entry loads no element code', () => {
  it('has a runtime import graph without lit, @lit/react or the element definition', () => {
    expect(existsSync(headlessFile), 'src/react/headless.ts exists').toBe(true);
    const seen = new Set<string>();
    const packages = new Set<string>();
    const queue = [headlessFile];
    while (queue.length > 0) {
      const file = queue.pop() as string;
      if (seen.has(file)) continue;
      seen.add(file);
      for (const specifier of runtimeSpecifiers(file)) {
        if (specifier.startsWith('.')) queue.push(resolveRelative(file, specifier));
        else packages.add(specifier);
      }
    }
    expect([...packages].filter((name) => litPackage.test(name))).toEqual([]);
    expect([...seen].filter((file) => /[\\/]element[\\/]define\.ts$/.test(file))).toEqual([]);
    expect([...seen].map((file) => file.replace(reactRoot, ''))).toContain('provider.ts');
  });

  it('exports the provider', () => {
    const provider = headlessMod.PricingRendererProvider;
    expect(provider, `${headlessPath} PricingRendererProvider`).toBeTypeOf('function');
  });
});

// [utest->req~react-entry-reexports-headless~1]
describe('react entry re-exports the headless entry', () => {
  it('exports every runtime export of the headless entry with the same identity', async () => {
    const keys = Object.keys(headlessMod);
    expect(keys).toContain('PricingRendererProvider');
    const entry = (await import('../../src/react/index.js')) as Loose;
    for (const key of keys) {
      expect(Object.is(entry[key], headlessMod[key]), key).toBe(true);
    }
  });
});

function listSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listSources(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const allowedReact = new Set([
  'createContext',
  'useContext',
  'useState',
  'useRef',
  'useMemo',
  'useCallback',
  'useEffect',
  'useLayoutEffect',
  'useSyncExternalStore',
  'useId',
  'forwardRef',
  'createElement',
  'Fragment',
]);
const allowedReactDom = new Set(['createPortal']);

// The runtime value uses of `react` and `react-dom` in one file: named value imports and the
// property accesses of namespace or default imports. Type-only imports and qualified names in type
// positions (`React.CSSProperties`) are not value uses.
function reactUses(file: string): { module: string; name: string }[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const uses: { module: string; name: string }[] = [];
  const namespaces = new Map<string, string>();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const module = statement.moduleSpecifier.text;
    if (module !== 'react' && !module.startsWith('react-dom')) continue;
    const clause = statement.importClause;
    if (!clause || clause.isTypeOnly) continue;
    if (clause.name) namespaces.set(clause.name.text, module);
    const bindings = clause.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings)) namespaces.set(bindings.name.text, module);
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        if (!element.isTypeOnly) {
          uses.push({ module, name: (element.propertyName ?? element.name).text });
        }
      }
    }
  }
  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
      const module = namespaces.get(node.expression.text);
      if (module !== undefined) uses.push({ module, name: node.name.text });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return uses;
}

// [utest->req~react-hooks-common-api~1]
describe('React API common to 18.2 and 19', () => {
  it('uses only the allowed runtime values and never use', () => {
    const files = listSources(reactRoot);
    const names = files.map((file) => file.replace(reactRoot, ''));
    expect(names).toEqual(expect.arrayContaining(['index.ts', 'headless.ts', 'provider.ts']));
    const uses = files.flatMap((file) => reactUses(file));
    expect(uses.map(({ name }) => name)).toContain('createContext');
    expect(uses.filter(({ name }) => name === 'use')).toEqual([]);
    const outside = uses.filter(({ module, name }) =>
      module === 'react' ? !allowedReact.has(name) : !allowedReactDom.has(name),
    );
    expect(outside).toEqual([]);
  });
});

// [utest->req~react-headless-no-new-peer~1]
describe('no new peer dependency', () => {
  it('lists exactly react and react-dom, optional, at the same range', () => {
    const manifestPath = fileURLToPath(new URL('../../package.json', import.meta.url));
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      peerDependencies: Loose;
      peerDependenciesMeta: Loose;
    };
    const range = '^18.2.0 || ^19.0.0';
    expect(manifest.peerDependencies).toEqual({ react: range, 'react-dom': range });
    expect(manifest.peerDependenciesMeta).toEqual({
      react: { optional: true },
      'react-dom': { optional: true },
    });
  });
});
