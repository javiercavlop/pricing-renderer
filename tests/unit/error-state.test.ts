// The element is built in the node environment (no DOM): its render() returns a lit template that
// is flattened to text. The same flow in a real browser is covered by
// tests/browser/element-error-state.spec.ts.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { PricingDiagnostic } from '../../src/core/index.js';

interface Host {
  locale: string;
  messages?: Record<string, string>;
  loadingLabel?: string;
  src?: string;
  requestUpdate: () => void;
  dispatchEvent: (event: Event) => boolean;
  render(): unknown;
  // private state the render reads
  _status: 'idle' | 'loading' | 'ready' | 'error';
  _diagnostics: PricingDiagnostic[];
}

async function build(): Promise<Host> {
  const loaded: unknown = await import('../../src/element/pricing-renderer-element.js');
  const Element = (loaded as { PricingRendererElement: new () => Host }).PricingRendererElement;
  const element = new Element();
  element.requestUpdate = () => undefined;
  element.dispatchEvent = () => true;
  return element;
}

function diagnostic(code: string, overrides: Partial<PricingDiagnostic> = {}): PricingDiagnostic {
  return { code, severity: 'error', message: `message of ${code}`, ...overrides };
}

async function failed(
  diagnostics: PricingDiagnostic[],
  setup: Partial<Pick<Host, 'locale' | 'messages' | 'src'>> = {},
): Promise<Host> {
  const element = await build();
  Object.assign(element, setup);
  element._status = 'error';
  element._diagnostics = diagnostics;
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

const detailsPattern = /<details\b[^>]*>[\s\S]*?<\/details>/g;
const squash = (text: string): string => text.replace(/\s+/g, ' ').trim();

// The text a reader sees without opening the details, tags removed.
function visibleText(html: string): string {
  return squash(html.replace(detailsPattern, ' ').replace(/<[^>]*>/g, ' '));
}

function detailsOf(html: string): string {
  return html.match(detailsPattern)?.[0] ?? '';
}

const sentences = {
  'en-US': {
    heading: 'The pricing could not be rendered.',
    errorSource: 'The pricing source could not be loaded.',
    errorFormat: 'The pricing file is not a valid Pricing2Yaml document.',
    errorVersion: 'This Pricing2Yaml version is not supported.',
    errorGeneric: 'The pricing data has errors.',
    errorDetails: 'Technical details',
    retry: 'Retry',
  },
  'es-ES': {
    heading: 'No se pudo renderizar el pricing.',
    errorSource: 'No se pudo cargar el origen del pricing.',
    errorFormat: 'El archivo de pricing no es un documento Pricing2Yaml válido.',
    errorVersion: 'Esta versión de Pricing2Yaml no es compatible.',
    errorGeneric: 'Los datos del pricing tienen errores.',
    errorDetails: 'Detalles técnicos',
    retry: 'Reintentar',
  },
} as const;

// [utest->req~error-state-human-message~1]
describe('error state: source error in English', () => {
  it('shows the sentence and no code outside a closed details', async () => {
    const element = await failed([diagnostic('PR_SOURCE_HTTP_ERROR')], { locale: 'en-US' });
    const html = flatten(element.render());
    const visible = visibleText(html);
    expect(visible).toContain(sentences['en-US'].errorSource);
    expect(visible).toContain(sentences['en-US'].heading);
    expect(visible).not.toContain('PR_');
    expect(visible).not.toContain('message of');
    const details = detailsOf(html);
    expect(details).toContain('class="pr-diagnostics"');
    expect(details).toContain('data-pr-part="diagnostics"');
    expect(details).not.toMatch(/<details[^>]*\sopen/);
    expect(details).toContain('PR_SOURCE_HTTP_ERROR');
    expect(details).toContain('message of PR_SOURCE_HTTP_ERROR');
    expect(squash(details)).toMatch(
      new RegExp(`<summary>\\s*${sentences['en-US'].errorDetails}\\s*</summary>`),
    );
  });

  it('renders only the heading, one sentence and the retry button when src is set', async () => {
    const element = await failed([diagnostic('PR_SOURCE_HTTP_ERROR')], {
      locale: 'en-US',
      src: 'https://example.com/pricing.yml',
    });
    const visible = visibleText(flatten(element.render()));
    expect(visible).toBe(
      `${sentences['en-US'].heading} ${sentences['en-US'].errorSource} ${sentences['en-US'].retry}`,
    );
  });

  it('renders no retry button without src', async () => {
    const element = await failed([diagnostic('PR_SOURCE_HTTP_ERROR')], { locale: 'en-US' });
    const html = flatten(element.render());
    expect(html).not.toContain('<button');
    expect(visibleText(html)).toBe(
      `${sentences['en-US'].heading} ${sentences['en-US'].errorSource}`,
    );
  });
});

// [utest->req~error-state-human-message~1]
describe('error state: version error in Spanish', () => {
  it('shows the Spanish sentence and the Spanish summary', async () => {
    const element = await failed([diagnostic('PR_VERSION_UNSUPPORTED_MAJOR')], { locale: 'es-ES' });
    const html = flatten(element.render());
    expect(visibleText(html)).toContain(sentences['es-ES'].errorVersion);
    expect(visibleText(html)).not.toContain('PR_');
    expect(squash(detailsOf(html))).toMatch(
      new RegExp(`<summary>\\s*${sentences['es-ES'].errorDetails}\\s*</summary>`),
    );
    expect(detailsOf(html)).toContain('PR_VERSION_UNSUPPORTED_MAJOR');
  });
});

// [utest->req~error-state-human-message~1]
describe('error state: unknown code', () => {
  it('shows the generic sentence', async () => {
    const element = await failed([diagnostic('PR_PLAN_PRICE_INVALID')], { locale: 'en-US' });
    const visible = visibleText(flatten(element.render()));
    expect(visible).toContain(sentences['en-US'].errorGeneric);
    expect(visible).not.toContain('PR_');
  });

  it('shows the generic sentence when no diagnostic has severity error', async () => {
    for (const list of [[], [diagnostic('PR_SOURCE_HTTP_ERROR', { severity: 'warning' })]]) {
      const element = await failed(list, { locale: 'en-US' });
      expect(visibleText(flatten(element.render()))).toContain(sentences['en-US'].errorGeneric);
    }
  });
});

// [utest->req~error-state-human-message~1]
describe('error state: category by code', () => {
  const cases: [string, keyof (typeof sentences)['en-US']][] = [
    ['PR_SOURCE_MISSING', 'errorSource'],
    ['PR_SOURCE_CONFLICT', 'errorSource'],
    ['PR_SOURCE_TOO_LARGE', 'errorSource'],
    ['PR_FETCH_UNAVAILABLE', 'errorSource'],
    ['PR_YAML_PARSE_ERROR', 'errorFormat'],
    ['PR_INPUT_INVALID', 'errorFormat'],
    ['PR_VERSION_UNSUPPORTED_MAJOR', 'errorVersion'],
    ['PR_VERSION_INVALID', 'errorVersion'],
    ['PR_SOMETHING_ELSE', 'errorGeneric'],
  ];
  it.each(cases)('%s uses %s', async (code, key) => {
    for (const locale of ['en-US', 'es-ES'] as const) {
      const element = await failed([diagnostic(code)], { locale });
      expect(visibleText(flatten(element.render()))).toContain(sentences[locale][key]);
    }
  });

  it('picks the first diagnostic with severity error, and lists every diagnostic', async () => {
    const element = await failed(
      [
        diagnostic('PR_SOURCE_HTTP_ERROR', { severity: 'warning' }),
        diagnostic('PR_YAML_PARSE_ERROR', { path: '$.plans' }),
        diagnostic('PR_VERSION_INVALID'),
      ],
      { locale: 'en-US' },
    );
    const html = flatten(element.render());
    const visible = visibleText(html);
    expect(visible).toContain(sentences['en-US'].errorFormat);
    expect(visible).not.toContain(sentences['en-US'].errorVersion);
    const details = detailsOf(html);
    for (const code of ['PR_SOURCE_HTTP_ERROR', 'PR_YAML_PARSE_ERROR', 'PR_VERSION_INVALID']) {
      expect(details).toContain(code);
      expect(details).toContain(`message of ${code}`);
    }
    expect(details).toContain('$.plans');
  });

  it('applies host messages overrides to the new keys', async () => {
    const element = await failed([diagnostic('PR_SOURCE_HTTP_ERROR')], {
      locale: 'es-ES',
      messages: {
        'pricing.errorSource': 'Sin conexión',
        'pricing.errorDetails': 'Códigos',
        'pricing.error': 'Fallo',
      },
    });
    const html = flatten(element.render());
    expect(visibleText(html)).toContain('Sin conexión');
    expect(visibleText(html)).toContain('Fallo');
    expect(visibleText(html)).not.toContain(sentences['es-ES'].errorSource);
    expect(detailsOf(html)).toContain('Códigos');
  });
});

// [utest->req~error-state-human-message~1]
describe('error state: styles', () => {
  it('removes the second box of the details inside the error box', () => {
    const css = readFileSync(new URL('../../src/styles/base.css', import.meta.url), 'utf8');
    const rule = new RegExp(
      String.raw`pricing-renderer\[data-pr-root\] \.pr-error \.pr-diagnostics\s*\{([^}]*)\}`,
    ).exec(css);
    expect(rule).not.toBeNull();
    const body = squash(rule?.[1] ?? '');
    expect(body).toContain('padding: 0;');
    expect(body).toContain('border: 0;');
    expect(body).toContain('background: none;');
  });
});

// [utest->req~loading-label-localized~1]
describe('loading state', () => {
  async function loading(setup: Partial<Pick<Host, 'locale' | 'messages' | 'loadingLabel'>>) {
    const element = await build();
    Object.assign(element, setup);
    element._status = 'loading';
    return flatten(element.render());
  }

  // The hidden heading and the status text.
  const labels = (html: string): string[] => [
    squash(/<h2[^>]*>([\s\S]*?)<\/h2>/.exec(html)?.[1] ?? ''),
    squash(/<span>([\s\S]*?)<\/span>/.exec(html)?.[1] ?? ''),
  ];

  it('uses pricing.loading of the locale for the heading and the status', async () => {
    expect(labels(await loading({ locale: 'es-ES' }))).toEqual([
      'Cargando precios…',
      'Cargando precios…',
    ]);
    expect(labels(await loading({ locale: 'en-US' }))).toEqual([
      'Loading pricing…',
      'Loading pricing…',
    ]);
  });

  it('uses the messages override', async () => {
    const html = await loading({
      locale: 'es-ES',
      messages: { 'pricing.loading': 'Un momento' },
    });
    expect(labels(html)).toEqual(['Un momento', 'Un momento']);
  });

  it('prefers loadingLabel', async () => {
    const html = await loading({
      locale: 'es-ES',
      messages: { 'pricing.loading': 'Un momento' },
      loadingLabel: 'Wait',
    });
    expect(labels(html)).toEqual(['Wait', 'Wait']);
  });

  it('also applies while idle', async () => {
    const element = await build();
    element.locale = 'es-ES';
    element._status = 'idle';
    expect(labels(flatten(element.render()))).toEqual(['Cargando precios…', 'Cargando precios…']);
  });
});
