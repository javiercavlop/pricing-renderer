import { describe, expect, it } from 'vitest';
import { createPricingViewModel, normalizePricing } from '../../src/core/index.js';
import type { PricingViewModel } from '../../src/core/index.js';
import {
  renderCatalogMetadata,
  renderComparison,
  type RenderActions,
  type RenderState,
} from '../../src/element/renderers.js';

// Render tests for the changeset .changeset/safe-link-other-host-paths.md: a documentation link
// (`docUrl`, compact layout) and the catalog metadata URL are not rendered as links when the value
// points to another host. The https controls prove that each block renders when the value is safe.

const noop = (): void => undefined;
const actions: RenderActions = {
  selectPlan: noop,
  selectBilling: noop,
  updateVariable: noop,
  resetVariables: noop,
  toggleAddOn: noop,
  updateAddOnQuantity: noop,
  triggerAction: () => false,
  updateSearch: noop,
  updateOnlyDifferences: noop,
  toggleGroup: noop,
  setAllGroups: noop,
  revealGroup: noop,
  confirmAddOnChange: noop,
  cancelAddOnChange: noop,
  toggleBreakdown: noop,
};

function stateFor(viewModel: PricingViewModel, compact = false): RenderState {
  const all = new Set(viewModel.comparisonGroups.map((group) => group.id));
  return {
    viewModel,
    selection: viewModel.resolved.selection,
    compact,
    search: '',
    onlyDifferences: false,
    selectionEnabled: true,
    ctaEnabled: true,
    variablesEnabled: true,
    expandedGroups: all,
    revealedGroups: all,
    breakdownOpen: false,
    breakdownId: 'breakdown',
    actions,
  };
}

// Flattens a lit template (strings and values, nested templates and arrays) into plain text.
// Vitest runs in node without a DOM, so the template is read instead of rendered.
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

const header = { syntaxVersion: '3.1', version: '1', createdAt: '2026-01-01', currency: 'EUR' };

function viewModelFor(
  extra: { url?: string; docUrl?: string },
  mode?: 'catalog',
): PricingViewModel {
  const pricing = normalizePricing({
    ...header,
    saasName: 'Links',
    ...(extra.url === undefined ? {} : { url: extra.url }),
    features: {
      projects: {
        ...(extra.docUrl === undefined ? {} : { docUrl: extra.docUrl }),
      },
    },
    plans: {
      basic: { price: 5, features: { projects: { value: true } } },
      pro: { price: 10, features: { projects: { value: true } } },
    },
  } as never).value!;
  return createPricingViewModel(pricing, undefined, {
    locale: 'en-US',
    ...(mode ? { mode } : {}),
  });
}

const unsafe = ['//evil.example', '/\\evil.example', '/\t/evil.example'];
const safe = 'https://docs.example.com/projects';

describe('docUrl in the compact comparison layout', () => {
  it('renders an https value as a link that opens safely (control)', () => {
    const text = flatten(renderComparison(stateFor(viewModelFor({ docUrl: safe }), true)));
    expect(text).toContain('href=https://docs.example.com/projects');
    expect(text).toContain('target="_blank"');
    expect(text).toContain('rel="noopener noreferrer"');
  });

  for (const value of unsafe) {
    it(`does not render ${JSON.stringify(value)} as a link`, () => {
      const viewModel = viewModelFor({ docUrl: value });
      expect(viewModel.comparisonGroups.flatMap((group) => group.rows)[0]?.docUrl).toBe(value);
      const text = flatten(renderComparison(stateFor(viewModel, true)));
      expect(text).toContain('data-pr-part="comparison-row"');
      expect(text).not.toContain('target="_blank"');
      expect(text).not.toContain('evil.example');
    });
  }
});

describe('metadata.url in catalog mode', () => {
  it('renders an https value as a link under the URL label (control)', () => {
    const text = flatten(
      renderCatalogMetadata(stateFor(viewModelFor({ url: 'https://acme.example.com' }, 'catalog'))),
    );
    expect(text).toContain('<dt>URL</dt>');
    expect(text).toContain('href=https://acme.example.com');
    expect(text).toContain('target="_blank"');
    expect(text).toContain('rel="noopener noreferrer"');
  });

  for (const value of unsafe) {
    it(`does not render ${JSON.stringify(value)} as a link`, () => {
      const viewModel = viewModelFor({ url: value }, 'catalog');
      expect(viewModel.pricing.metadata.url).toBe(value);
      const text = flatten(renderCatalogMetadata(stateFor(viewModel)));
      expect(text).toContain('data-pr-part="metadata"');
      expect(text).not.toContain('<dt>URL</dt>');
      expect(text).not.toContain('target="_blank"');
      expect(text).not.toContain('evil.example');
    });
  }
});
