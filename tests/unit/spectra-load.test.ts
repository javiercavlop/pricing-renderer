import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parsePricingYaml } from '../../src/yaml/index.js';

const root = fileURLToPath(new URL('../fixtures/spectra/', import.meta.url));

interface Counts {
  plans: number;
  features: number;
  usageLimits: number;
  addOns: number;
}

const expected: Record<string, Counts> = {
  'box/2024.yml': { plans: 5, features: 50, usageLimits: 10, addOns: 9 },
  'buffer/2024.yml': { plans: 4, features: 76, usageLimits: 16, addOns: 3 },
  'canva/2024.yml': { plans: 4, features: 92, usageLimits: 14, addOns: 0 },
  'circleci/2024.yml': { plans: 3, features: 49, usageLimits: 9, addOns: 7 },
  'clickup/2024.yml': { plans: 4, features: 136, usageLimits: 38, addOns: 2 },
  'clockify/2024.yml': { plans: 6, features: 72, usageLimits: 0, addOns: 4 },
  'crowdcast/2024.yml': { plans: 3, features: 17, usageLimits: 5, addOns: 4 },
  'databox/2024.yml': { plans: 5, features: 64, usageLimits: 8, addOns: 8 },
  'deskera/2024.yml': { plans: 3, features: 100, usageLimits: 0, addOns: 0 },
  'dropbox/2024.yml': { plans: 5, features: 86, usageLimits: 17, addOns: 4 },
  'evernote/2024.yml': { plans: 4, features: 32, usageLimits: 7, addOns: 0 },
  'figma/2024.yml': { plans: 6, features: 91, usageLimits: 2, addOns: 0 },
  'github/2024.yml': { plans: 3, features: 81, usageLimits: 9, addOns: 14 },
  'hypercontext/2024.yml': { plans: 4, features: 63, usageLimits: 0, addOns: 0 },
  'jira/2024.yml': { plans: 4, features: 60, usageLimits: 6, addOns: 1 },
  'mailchimp/2024.yml': { plans: 4, features: 90, usageLimits: 8, addOns: 5 },
  'microsoft365Business/2024.yml': { plans: 4, features: 60, usageLimits: 4, addOns: 1 },
  'notion/2024.yml': { plans: 4, features: 58, usageLimits: 7, addOns: 2 },
  'okta/2024.yml': { plans: 0, features: 140, usageLimits: 1, addOns: 18 },
  'openphone/2024.yml': { plans: 3, features: 48, usageLimits: 4, addOns: 6 },
  'overleaf/2024.yml': { plans: 4, features: 16, usageLimits: 2, addOns: 0 },
  'planable/2024.yml': { plans: 4, features: 41, usageLimits: 11, addOns: 5 },
  'postman/2024.yml': { plans: 4, features: 100, usageLimits: 12, addOns: 12 },
  'pumble/2024.yml': { plans: 4, features: 34, usageLimits: 7, addOns: 0 },
  'quip/2024.yml': { plans: 3, features: 15, usageLimits: 0, addOns: 0 },
  'salesforce/2024.yml': { plans: 3, features: 111, usageLimits: 13, addOns: 14 },
  'shopify/2022.yml': { plans: 3, features: 38, usageLimits: 5, addOns: 1 },
  'slack/2024.yml': { plans: 4, features: 44, usageLimits: 7, addOns: 4 },
  'tableau/2024.yml': { plans: 3, features: 41, usageLimits: 1, addOns: 7 },
  'trello/2024.yml': { plans: 4, features: 41, usageLimits: 5, addOns: 1 },
  'trustmary/2024.yml': { plans: 4, features: 44, usageLimits: 5, addOns: 1 },
  'userguiding/2024.yml': { plans: 3, features: 59, usageLimits: 9, addOns: 11 },
  'webflow/2024.yml': { plans: 15, features: 94, usageLimits: 24, addOns: 3 },
  'wrike/2024.yml': { plans: 5, features: 81, usageLimits: 5, addOns: 5 },
  'zapier/2024.yml': { plans: 4, features: 51, usageLimits: 3, addOns: 4 },
  'zenhub/2024.yml': { plans: 2, features: 39, usageLimits: 4, addOns: 0 },
  'zoom/2024.yml': { plans: 5, features: 143, usageLimits: 8, addOns: 16 },
};

const fixtures = Object.keys(expected);

function findYaml(dir: string, prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? findYaml(join(dir, entry.name), `${prefix}${entry.name}/`)
      : entry.name.endsWith('.yml')
        ? [`${prefix}${entry.name}`]
        : [],
  );
}

describe('SPECTRA fixtures integrity', () => {
  const listed = readFileSync(join(root, 'SHA256SUMS'), 'utf8')
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const match = /^([0-9a-f]{64}) [ *](.+)$/.exec(line);
      if (!match) throw new Error(`Malformed SHA256SUMS line: ${line}`);
      return { digest: match[1], file: match[2] };
    });

  it('lists exactly the YAML files on disk', () => {
    expect(listed.map((entry) => entry.file).sort()).toEqual(findYaml(root).sort());
    expect(listed).toHaveLength(37);
  });

  it('expects the same files as SHA256SUMS', () => {
    expect([...fixtures].sort()).toEqual(listed.map((entry) => entry.file).sort());
  });

  it.each(listed.map((entry) => [entry.file, entry.digest]))(
    'matches the sha256 of %s',
    (file, digest) => {
      const bytes = readFileSync(join(root, file));
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(digest);
    },
  );
});

describe.each(fixtures)('SPECTRA fixture %s', (file) => {
  const result = parsePricingYaml(readFileSync(join(root, file), 'utf8'));
  const codes = result.diagnostics.map((diagnostic) => diagnostic.code);

  it('loads without errors', () => {
    expect(result.ok).toBe(true);
    expect(result.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
  });

  const emptyPlans = file === 'okta/2024.yml';

  it(`${emptyPlans ? 'reports' : 'does not report'} PR_PLANS_EMPTY`, () => {
    expect(codes.includes('PR_PLANS_EMPTY')).toBe(emptyPlans);
  });

  it('matches the expected counts', () => {
    const pricing = result.value;
    expect(pricing).toBeDefined();
    expect({
      plans: pricing?.plans.length,
      features: pricing?.features.length,
      usageLimits: pricing?.usageLimits.length,
      addOns: pricing?.addOns.length,
    }).toEqual(expected[file]);
  });

  if (file === 'trello/2024.yml') {
    it('loads the hand-edited unlimited power-ups limit as Infinity', () => {
      const limit = result.value?.usageLimits.find((item) => item.id === 'powerUpsLimit');
      expect(limit?.defaultValue).toBe(Infinity);
    });
  }
});
