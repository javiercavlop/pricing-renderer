import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { createPricingViewModel } from '../../src/core/index.js';
import type { PricingViewModel } from '../../src/core/index.js';
import * as renderers from '../../src/element/renderers.js';
import type { RenderActions, RenderState } from '../../src/element/renderers.js';
import { parsePricingYaml } from '../../src/yaml/index.js';

// SPECTRA item 2 over the SPECTRA fixtures (latest year per SaaS). The new exports are reached
// through a typed cast, so a missing export fails when the test runs and not when the file loads.

interface ShorterPageApi {
  comparisonRowTotal(viewModel: PricingViewModel): number;
  resolveOnlyDifferences(
    viewModel: PricingViewModel,
    initial: boolean | undefined,
    toolbarThreshold?: number,
  ): boolean;
}

const api = renderers as unknown as typeof renderers & ShorterPageApi;
const { renderComparison } = renderers;

type ShorterState = RenderState & { toolbarThreshold?: number };

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const fixturesRoot = join(repoRoot, 'tests/fixtures/spectra');

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

function count(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

interface Fixture {
  saas: string;
  file: string;
  viewModel: PricingViewModel;
}

// The latest year of every SaaS, as tests/browser/helpers/spectra.ts picks them.
function loadFixtures(): Fixture[] {
  return readdirSync(fixturesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const years = readdirSync(join(fixturesRoot, entry.name))
        .filter((file) => file.endsWith('.yml'))
        .sort();
      return { saas: entry.name, file: years[years.length - 1] };
    })
    .filter((item): item is { saas: string; file: string } => item.file !== undefined)
    .sort((a, b) => a.saas.localeCompare(b.saas))
    .map(({ saas, file }) => {
      const source = readFileSync(join(fixturesRoot, saas, file), 'utf8');
      const parsed = parsePricingYaml(source);
      if (!parsed.value) throw new Error(`Cannot parse ${saas}/${file}`);
      return { saas, file, viewModel: createPricingViewModel(parsed.value) };
    });
}

function rowTotal(viewModel: PricingViewModel): number {
  return viewModel.comparisonGroups.reduce((total, group) => total + group.rows.length, 0);
}

// Measured from the data (docs/agent-work/visual-review-spectra/metrics.json agrees).
const AUTO_ON = ['canva', 'clickup', 'dropbox', 'postman', 'salesforce', 'webflow', 'zoom'];

describe('SPECTRA fixtures', () => {
  let fixtures: Fixture[] = [];

  beforeAll(() => {
    fixtures = loadFixtures();
  });

  it('loads the 37 fixtures', () => {
    expect(fixtures).toHaveLength(37);
  });

  // [utest->req~shorter-page-auto-default~1]
  describe('automatic only differences', () => {
    it('counts every comparison row before any filter', () => {
      for (const { saas, viewModel } of fixtures) {
        expect(api.comparisonRowTotal(viewModel), saas).toBe(rowTotal(viewModel));
      }
    });

    it('is on exactly when there are more than 100 rows and at least 2 plans', () => {
      for (const { saas, viewModel } of fixtures) {
        const expected = rowTotal(viewModel) > 100 && viewModel.plans.length >= 2;
        expect(api.resolveOnlyDifferences(viewModel, undefined), saas).toBe(expected);
      }
    });

    it('is on for the pinned list only', () => {
      const on = fixtures
        .filter(({ viewModel }) => api.resolveOnlyDifferences(viewModel, undefined))
        .map(({ saas }) => saas);
      expect(on).toEqual(AUTO_ON);
    });

    it('is off for Deskera (exactly 100 rows) and Okta (no plans)', () => {
      const deskera = fixtures.find((item) => item.saas === 'deskera')!.viewModel;
      expect(rowTotal(deskera)).toBe(100);
      expect(api.resolveOnlyDifferences(deskera, undefined)).toBe(false);
      const okta = fixtures.find((item) => item.saas === 'okta')!.viewModel;
      expect(okta.plans).toHaveLength(0);
      expect(rowTotal(okta)).toBeGreaterThan(100);
      expect(api.resolveOnlyDifferences(okta, undefined)).toBe(false);
    });
  });

  // [utest->req~shorter-page-counter~1]
  it('prints a counter that matches the rendered rows in every combination', () => {
    const failures: string[] = [];
    let checked = 0;
    for (const { saas, viewModel } of fixtures) {
      if (viewModel.plans.length === 0) continue;
      const total = api.comparisonRowTotal(viewModel);
      const first = viewModel.comparisonGroups[0]?.id;
      const all = new Set(viewModel.comparisonGroups.map((group) => group.id));
      const expansions: Array<[string, Set<string>]> = [
        ['first', new Set(first === undefined ? [] : [first])],
        ['all', all],
      ];
      for (const onlyDifferences of [false, true]) {
        for (const search of ['', 'a']) {
          for (const compact of [false, true]) {
            for (const [expansion, expandedGroups] of expansions) {
              const state: ShorterState = {
                viewModel,
                selection: viewModel.resolved.selection,
                compact,
                search,
                onlyDifferences,
                selectionEnabled: true,
                ctaEnabled: true,
                variablesEnabled: true,
                expandedGroups,
                revealedGroups: new Set(),
                breakdownOpen: false,
                breakdownId: 'breakdown',
                actions,
                toolbarThreshold: 0,
              };
              const label = `${saas} differences=${onlyDifferences} search='${search}' compact=${compact} expanded=${expansion}`;
              const text = flatten(renderComparison(state));
              const counters = [...text.matchAll(/<span aria-live="polite">([^<]*)<\/span>/g)];
              const match =
                counters.length === 1
                  ? /^\s*(\d+) of (\d+) items\s*$/.exec(counters[0]![1]!)
                  : null;
              checked += 1;
              if (!match) {
                failures.push(`${label}: ${counters.length} counters, none readable`);
                continue;
              }
              const rendered = compact
                ? count(text, /class="pr-feature-card"/g)
                : count(text, /data-pr-part="comparison-row"/g);
              if (Number(match[1]) !== rendered || Number(match[2]) !== total) {
                failures.push(`${label}: counter ${match[1]} of ${match[2]}, rendered ${rendered}`);
              }
            }
          }
        }
      }
    }
    expect(checked).toBe(36 * 16);
    expect(failures.slice(0, 10), `${failures.length} mismatches`).toEqual([]);
  });
});
